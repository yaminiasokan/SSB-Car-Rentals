'use strict';
/**
 * A very small data-mapper on top of node-postgres (`pg`).
 *
 * Each model declares which API property maps to which column. Rows come back as plain objects shaped
 * like the JSON the frontend already understands: `_id`, camelCase names and nested groups
 * (`pricing.total`, `customer.name`, `license.number`, …). Null columns are omitted, exactly as the
 * previous document store omitted unset fields.
 *
 *   ['pricing.total', 'pricing_total']            plain column
 *   ['pricing.lines', 'pricing_lines', 'json']    JSONB column (always JSON.stringify-ed on write)
 *   ['passwordHash',  'password_hash', 'hidden']  never returned unless { hidden: true } is requested
 *
 * All functions take an optional `db` as their last argument: the shared pool by default, or the client
 * handed to you by `tx()` in ./pool.js so several statements can share one transaction.
 * Everything is parameterised ($1, $2 …) — user input is never concatenated into SQL.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// Loaded lazily so the mapper (and its tests) work without opening a connection pool.
const defaultDb = () => require('./pool').pool;

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!isPlainObject(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const pickDoc = (doc, select) => {
  if (!doc) return null;
  if (!select) return { ...doc };
  const keys = Array.isArray(select) ? select : String(select).split(/\s+/).filter(Boolean);
  const out = { _id: doc._id };
  keys.forEach((k) => { if (doc[k] !== undefined) out[k] = doc[k]; });
  return out;
};

function defineModel({ table, fields: declared }) {
  const fields = [...declared, ['createdAt', 'created_at'], ['updatedAt', 'updated_at']]
    .map(([path, col, kind]) => ({ path, col, kind: kind || null }));
  const byPath = new Map(fields.map((f) => [f.path, f]));
  const columnOf = (path) => (path === '_id' ? 'id' : (byPath.get(path) || {}).col);

  /** DB row -> API object (or null). */
  function toDoc(row, { hidden = false } = {}) {
    if (!row) return null;
    const doc = { _id: row.id };
    for (const f of fields) {
      if (f.kind === 'hidden' && !hidden) continue;
      const v = row[f.col];
      if (v === null || v === undefined) continue;
      setPath(doc, f.path, v);
    }
    return doc;
  }

  /** { pricing: { total: 5 }, status: 'x' } -> [{ path, col, kind, value }, …]; undefined values are skipped. */
  function flatten(patch, prefix = '', out = []) {
    for (const [key, value] of Object.entries(patch || {})) {
      if (value === undefined) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      const f = byPath.get(path);
      if (f) out.push({ ...f, value });
      else if (isPlainObject(value)) flatten(value, path, out);
      else throw new Error(`${table}: unknown field "${path}"`);
    }
    return out;
  }

  const bind = (f, params) => {
    if (f.kind === 'json') {
      params.push(f.value === null ? null : JSON.stringify(f.value)); // pg would turn a JS array into a PG array
      return `$${params.length}::jsonb`;
    }
    params.push(f.value);
    return `$${params.length}`;
  };

  const orderBy = (sort) => {
    if (!sort || !sort.length) return '';
    return ` ORDER BY ${sort.map(([path, dir]) => {
      const col = columnOf(path);
      if (!col) throw new Error(`${table}: cannot sort by unknown field "${path}"`);
      return `${col} ${String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
    }).join(', ')}`;
  };

  /** Equality filters. A malformed UUID can never match (instead of raising "invalid input syntax for type uuid"). */
  function equality(where, params) {
    const out = [];
    for (const [path, value] of Object.entries(where || {})) {
      if (value === undefined) continue;
      const col = columnOf(path);
      if (!col) throw new Error(`${table}: cannot filter by unknown field "${path}"`);
      if (value === null) { out.push(`${col} IS NULL`); continue; }
      if ((col === 'id' || col.endsWith('_id')) && !isUuid(String(value))) { out.push('FALSE'); continue; }
      params.push(value);
      out.push(`${col} = $${params.length}`);
    }
    return out;
  }

  const tail = ({ sort, limit } = {}) => `${orderBy(sort)}${limit ? ` LIMIT ${Math.max(1, Math.floor(Number(limit)))}` : ''}`;
  const run = async (db, sql, params, opts) => (await db.query(sql, params)).rows.map((r) => toDoc(r, opts));

  // ---------------------------------------------------------------- writes
  /** INSERT … RETURNING *. With { onConflict: 'col' } a duplicate is skipped and null is returned. */
  async function insert(data, db = defaultDb(), { onConflict } = {}) {
    const entries = flatten(data);
    const params = [];
    const cols = entries.map((f) => f.col);
    const vals = entries.map((f) => bind(f, params));
    let sql = cols.length
      ? `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')})`
      : `INSERT INTO ${table} DEFAULT VALUES`;
    if (onConflict) sql += ` ON CONFLICT (${onConflict}) DO NOTHING`;
    const { rows } = await db.query(`${sql} RETURNING *`, params);
    return toDoc(rows[0]);
  }

  /** UPDATE the given fields (dotted paths / nested objects both work); bumps updated_at. Returns the new doc or null. */
  async function update(id, patch, db = defaultDb()) {
    if (!isUuid(id)) return null;
    const entries = flatten(patch);
    const params = [];
    const sets = entries.map((f) => `${f.col} = ${bind(f, params)}`);
    if (!entries.some((f) => f.col === 'updated_at')) sets.push('updated_at = now()');
    params.push(id);
    const { rows } = await db.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    return toDoc(rows[0]);
  }

  async function remove(id, db = defaultDb()) {
    if (!isUuid(id)) return false;
    const { rowCount } = await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return rowCount > 0;
  }

  // ---------------------------------------------------------------- reads
  async function findById(id, db = defaultDb(), opts) {
    if (!isUuid(id)) return null;
    const { rows } = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return toDoc(rows[0], opts);
  }

  /** SELECT … FOR UPDATE — use inside tx() to serialise concurrent changes to one row. */
  async function lockById(id, db) {
    if (!isUuid(id)) return null;
    const { rows } = await db.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
    return toDoc(rows[0]);
  }

  async function findByIds(ids, db = defaultDb()) {
    const valid = [...new Set((ids || []).map(String).filter(isUuid))];
    if (!valid.length) return [];
    return run(db, `SELECT * FROM ${table} WHERE id = ANY($1::uuid[])`, [valid]);
  }

  /** find({ user: id, kind: 'booking' }, { sort: [['createdAt', 'desc']], limit: 20, hidden: false }) */
  async function find(where = {}, opts = {}, db = defaultDb()) {
    const params = [];
    const clauses = equality(where, params);
    const sql = `SELECT * FROM ${table}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}${tail(opts)}`;
    return run(db, sql, params, opts);
  }

  async function findOne(where, opts = {}, db = defaultDb()) {
    return (await find(where, { ...opts, limit: 1 }, db))[0] || null;
  }

  /** Free-form WHERE written by the caller with $1… placeholders (never interpolate user input into `clause`). */
  async function where(clause, params = [], opts = {}, db = defaultDb()) {
    return run(db, `SELECT * FROM ${table} WHERE ${clause || 'TRUE'}${tail(opts)}`, params, opts);
  }

  async function countWhere(clause, params = [], db = defaultDb()) {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${clause || 'TRUE'}`, params);
    return rows[0].n;
  }

  async function count(whereObj = {}, db = defaultDb()) {
    const params = [];
    const clauses = equality(whereObj, params);
    return countWhere(clauses.join(' AND '), params, db);
  }

  async function exists(whereObj, db = defaultDb()) {
    return (await count(whereObj, db)) > 0;
  }

  return { table, fields, toDoc, insert, update, remove, findById, lockById, findByIds, find, findOne, where, countWhere, count, exists };
}

/**
 * Replaces id strings with related documents, like a "populate":
 *   await populate(bookings, [{ path: 'vehicle', model: Vehicle, select: 'name images' },
 *                             { path: 'user', model: User, select: 'name email' }]);
 * Works on one doc or an array, batches one query per relation, sets missing relations to null,
 * and supports { populate: [...] } for nested relations.
 */
async function populate(target, specs, db = defaultDb()) {
  const list = (Array.isArray(target) ? target : [target]).filter(Boolean);
  for (const spec of [].concat(specs)) {
    const { path, model, select, populate: nested } = spec;
    const ids = [...new Set(list.map((d) => d[path]).filter((v) => typeof v === 'string'))];
    if (!ids.length) continue;
    const related = await model.findByIds(ids, db);
    if (nested) await populate(related, nested, db);
    const byId = new Map(related.map((r) => [r._id, r]));
    for (const d of list) {
      if (typeof d[path] === 'string') d[path] = pickDoc(byId.get(d[path]), select);
    }
  }
  return target;
}

module.exports = { defineModel, populate, pickDoc, isUuid, isPlainObject, UUID_RE };
