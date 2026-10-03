import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, Upload, X, Wand2, ScanSearch, Save, ChevronDown, ListChecks, Images } from 'lucide-react';
import InspectLoader from '../components/InspectLoader';
import { Btn, Empty, ErrorState, Loader, Notice, PageHeader, Plate, StatusBadge } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { bookingApi, inspectionApi, damageApi, assetUrl, errMsg } from '../services/api';
import { AI_DISCLAIMER, SLOTS } from '../utils/constants';
import { makeDemoPhoto } from '../utils/demoImages';
import { fmtDateTime } from '../utils/format';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CONDITIONS = ['OK', 'Minor issue', 'Damaged', 'Missing'];

function Preview({ file, url, alt }) {
  const src = useMemo(() => (file ? URL.createObjectURL(file) : url ? assetUrl(url) : ''), [file, url]);
  useEffect(() => () => { if (file && src) URL.revokeObjectURL(src); }, [file, src]);
  return src ? <img src={src} alt={alt} /> : null;
}

function SlotCard({ slot, existing, file, note, readOnly, onFile, onClear, onNote }) {
  const has = !!(file || existing);
  return (
    <div className={`slot ${has ? 'has' : ''}`}>
      <div className="slot-img">
        {has ? <Preview file={file} url={existing?.url} alt={`${slot.label} photo`} /> : <div className="slot-empty"><Camera size={26} /><span>{slot.label}</span></div>}
        {file && <span className="slot-new">New</span>}
        {file && !readOnly && <button className="slot-x" onClick={onClear} aria-label={`Remove new ${slot.label} photo`}><X size={14} /></button>}
      </div>
      <div className="slot-foot">
        <b>{slot.label}</b>
        {!readOnly && <label className="btn btn-outline btn-sm slot-btn"><Upload size={13} /> {has ? 'Replace' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }} /></label>}
      </div>
      {readOnly ? (note ? <small className="muted">Note: {note}</small> : null)
        : <input className="input slot-note" placeholder="Note (e.g. existing scratch)" value={note} maxLength={300} onChange={(e) => onNote(e.target.value)} aria-label={`${slot.label} note`} />}
    </div>
  );
}

function Picker() {
  const { isStaff } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    if (isStaff) return (await inspectionApi.eligible()).bookings;
    return (await bookingApi.mine()).bookings.filter((b) => ['Confirmed', 'Active', 'Completed'].includes(b.status));
  }, [isStaff]);
  return (
    <>
      <PageHeader eyebrow="AI AutoInspect" title="Vehicle inspections">{isStaff ? 'Record before/after photos, run the AI-assisted comparison, and verify the report.' : 'Add your before-rental photos so any pre-existing marks are on record.'}</PageHeader>
      <div className="container section-tight">
        {loading && <Loader />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {data?.length === 0 && <Empty icon={ScanSearch} title="No bookings to inspect yet">Confirmed and active bookings appear here.</Empty>}
        <div className="grid grid-auto">
          {data?.map((b) => (
            <Link key={b._id} to={`/auto-inspect/${b._id}`} className="card card-hover">
              <div className="row between"><Plate>{b.bookingId}</Plate><StatusBadge status={b.status} /></div>
              <h3 className="mt-2">{b.vehicle?.name}</h3>
              <div className="muted">{isStaff && b.user ? `${b.user.name} · ` : ''}{fmtDateTime(b.pickupAt)}</div>
              <div className="row-wrap mt-1"><span className={`badge ${b.inspection?.before ? 'b-ok' : ''}`}>Before {b.inspection?.before ? '✓' : '—'}</span><span className={`badge ${b.inspection?.after ? 'b-ok' : ''}`}>After {b.inspection?.after ? '✓' : '—'}</span></div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function Workspace({ bookingId }) {
  const { isStaff, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const booking = useAsync(() => bookingApi.get(bookingId), [bookingId]);
  const insp = useAsync(() => inspectionApi.forBooking(bookingId), [bookingId]);
  const cfg = useAsync(() => inspectionApi.config(), []);

  const [tab, setTab] = useState('before');
  const [draft, setDraft] = useState({ before: { files: {}, extras: [], notes: '', slotNotes: {}, checklist: {}, touched: false }, after: { files: {}, extras: [], notes: '', slotNotes: {}, checklist: {}, touched: false } });
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState(-1);
  const [aiError, setAiError] = useState('');

  const inspections = insp.data?.inspections || [];
  const saved = { before: inspections.find((i) => i.type === 'before'), after: inspections.find((i) => i.type === 'after') };
  const d = draft[tab];
  const cur = saved[tab];
  const b = booking.data?.booking;

  // seed notes/checklist from saved inspection once loaded
  useEffect(() => {
    if (!insp.data) return;
    setDraft((s) => {
      const next = { ...s };
      ['before', 'after'].forEach((t) => {
        const sv = insp.data.inspections.find((i) => i.type === t);
        if (sv && !s[t].touched) {
          next[t] = { ...s[t], notes: sv.notes || '', slotNotes: Object.fromEntries(sv.images.map((im) => [im.slot, im.note || ''])), checklist: Object.fromEntries((sv.checklist || []).map((c) => [c.item, { status: c.status, note: c.note }])) };
        }
      });
      return next;
    });
  }, [insp.data]);

  const patch = (p) => setDraft((s) => ({ ...s, [tab]: { ...s[tab], ...p, touched: true } }));
  const setFile = (slot, file) => patch({ files: { ...d.files, [slot]: file } });
  const clearFile = (slot) => { const f = { ...d.files }; delete f[slot]; patch({ files: f }); };
  const setNote = (slot, v) => patch({ slotNotes: { ...d.slotNotes, [slot]: v } });
  const setCheck = (item, p) => patch({ checklist: { ...d.checklist, [item]: { status: 'OK', note: '', ...d.checklist[item], ...p } } });

  const allowed = b && (tab === 'before' ? ['Confirmed', 'Active'].includes(b.status) : ['Active', 'Completed'].includes(b.status));
  const canEdit = !!b && allowed && (isStaff || tab === 'before') && !(tab === 'after' && !isStaff);
  const readOnlyAfter = tab === 'after' && !isStaff;
  const pending = Object.keys(d.files).length + d.extras.length;
  const hasAny = pending > 0 || (cur?.images.length || 0) > 0;

  const fillDemo = async () => {
    const files = { ...d.files };
    for (const s of SLOTS) if (!files[s.key] && !cur?.images.find((i) => i.slot === s.key)) files[s.key] = await makeDemoPhoto(s.key, tab);
    // for AFTER, also replace unchanged angles with differing demo photos so the analyzer has something to compare
    if (tab === 'after') for (const s of SLOTS) if (!files[s.key]) files[s.key] = await makeDemoPhoto(s.key, 'after');
    patch({ files });
    toast.info('Demo photos added — these are generated in your browser, not real vehicle photos.');
  };

  // `type` is explicit so "Run AI analysis" can save the AFTER photos even while the Before tab is showing.
  const save = async (type = tab, quiet = false) => {
    const dd = draft[type];
    const fd = new FormData();
    fd.append('bookingId', bookingId); fd.append('type', type); fd.append('notes', dd.notes || '');
    fd.append('slotNotes', JSON.stringify(dd.slotNotes));
    const allItems = [...(cfg.data?.checklist.EXTERIOR || []), ...(cfg.data?.checklist.INTERIOR || [])];
    fd.append('checklist', JSON.stringify(allItems.map((item) => ({ item, status: dd.checklist[item]?.status || 'OK', note: dd.checklist[item]?.note || '' }))));
    Object.entries(dd.files).forEach(([slot, f]) => fd.append(slot, f));
    dd.extras.forEach((f) => fd.append('extra', f));
    const res = await inspectionApi.submit(fd);
    setDraft((st) => ({ ...st, [type]: { ...st[type], files: {}, extras: [], touched: false } }));
    await Promise.all([insp.reload(true), booking.reload(true)]);
    if (!quiet) toast.success(`${type === 'before' ? 'Before' : 'After'}-rental inspection saved.`);
    return res;
  };

  const doSave = async () => {
    setSaving(true);
    try { await save(tab); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  const runAnalysis = async () => {
    setAiError(''); setStage(0);
    try {
      if (draft.after.touched && (Object.keys(draft.after.files).length || draft.after.extras.length)) await save('after', true); // Step 1: uploading images
      await sleep(600);
      setStage(1);
      const request = damageApi.analyze(bookingId).then((r) => ({ ok: r })).catch((e) => ({ err: e })); // Step 2: analysing (real request runs here)
      await sleep(1000); setStage(2); await sleep(1000); setStage(3);
      const out = await request;
      if (out.err) throw out.err;
      await sleep(700); setStage(4); await sleep(900);
      navigate(isAdmin ? `/admin/damage-reports/${out.ok.report._id}` : `/damage-reports/${out.ok.report._id}`);
    } catch (e) { setAiError(errMsg(e)); }
  };

  if (booking.loading || insp.loading || cfg.loading) return <Loader label="Loading inspection…" />;
  const err = booking.error || insp.error || cfg.error;
  if (err) return <div className="container section"><ErrorState message={err} onRetry={() => { booking.reload(); insp.reload(); cfg.reload(); }} /></div>;

  const report = booking.data.damageReport;
  const bothSaved = saved.before && saved.after;
  const groups = [['Exterior', cfg.data.checklist.EXTERIOR], ['Interior', cfg.data.checklist.INTERIOR]];

  return (
    <>
      <PageHeader eyebrow="AI AutoInspect" title={b.vehicle.name}>
        <Plate>{b.bookingId}</Plate> <StatusBadge status={b.status} /> <span className="muted"> {b.customer.name} · {fmtDateTime(b.pickupAt)} → {fmtDateTime(b.returnAt)}</span>
      </PageHeader>
      <div className="container section-tight">
        <Notice icon={ScanSearch}><strong>{AI_DISCLAIMER}</strong> The damage analyzer in this build is a <em>demo placeholder</em>, not a trained model, and nothing is ever charged automatically.</Notice>

        <div className="tabs mt-2" role="tablist">
          <button role="tab" aria-selected={tab === 'before'} className={`tab ${tab === 'before' ? 'active' : ''}`} onClick={() => setTab('before')}>Before rental {saved.before && '✓'}</button>
          {(isStaff || saved.after) && <button role="tab" aria-selected={tab === 'after'} className={`tab ${tab === 'after' ? 'active' : ''}`} onClick={() => setTab('after')}>After rental {saved.after && '✓'}</button>}
        </div>

        {!allowed && <div className="mb-2"><Notice kind="info">{tab === 'before' ? 'Before-rental photos can be recorded for confirmed or active bookings.' : 'After-rental photos can be recorded once the rental is active or completed (when the vehicle is returned).'}</Notice></div>}
        {readOnlyAfter && <div className="mb-2"><Notice kind="info">After-rental photos are taken by SSB staff at return. You can view them here.</Notice></div>}

        {tab === 'before' && !saved.before && <p className="muted">These photos become the <strong>baseline condition</strong>. Note anything already present, like “Existing minor scratch on rear bumper.”</p>}
        {tab === 'after' && <p className="muted">Take the same angles as the baseline. The AI-assisted comparison looks at each matching angle.</p>}

        <h3 className="row"><Images size={20} className="gold" /> Photos</h3>
        <div className="slot-grid">
          {SLOTS.map((s) => (
            <SlotCard key={s.key} slot={s} existing={cur?.images.find((i) => i.slot === s.key)} file={d.files[s.key]} note={d.slotNotes[s.key] || ''} readOnly={!canEdit}
              onFile={(f) => setFile(s.key, f)} onClear={() => clearFile(s.key)} onNote={(v) => setNote(s.key, v)} />
          ))}
        </div>

        {(canEdit || cur?.images.some((i) => i.slot === 'extra')) && (
          <div className="mt-2">
            <h4>Additional photos</h4>
            <div className="row-wrap">
              {cur?.images.filter((i) => i.slot === 'extra').map((i) => <div key={i.url} className="extra"><img src={assetUrl(i.url)} alt="Additional" /></div>)}
              {d.extras.map((f, i) => <div key={i} className="extra"><Preview file={f} alt="New additional" /><button className="slot-x" onClick={() => patch({ extras: d.extras.filter((_, j) => j !== i) })} aria-label="Remove photo"><X size={14} /></button></div>)}
              {canEdit && <label className="btn btn-outline btn-sm"><Upload size={14} /> Add photos<input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { patch({ extras: [...d.extras, ...Array.from(e.target.files)].slice(0, 6) }); e.target.value = ''; }} /></label>}
            </div>
          </div>
        )}

        <h3 className="row mt-3"><ListChecks size={20} className="gold" /> Inspection checklist</h3>
        <div className="grid grid-2">
          {groups.map(([title, items]) => (
            <details className="card checklist" key={title} open>
              <summary><b>{title}</b><ChevronDown size={16} /></summary>
              {items.map((item) => {
                const c = d.checklist[item] || { status: 'OK', note: '' };
                return (
                  <div className="check-row" key={item}>
                    <span>{item}</span>
                    <select className={`input cond cond-${c.status.replace(' ', '-').toLowerCase()}`} value={c.status} disabled={!canEdit} onChange={(e) => setCheck(item, { status: e.target.value })} aria-label={`${item} condition`}>{CONDITIONS.map((x) => <option key={x}>{x}</option>)}</select>
                    <input className="input" placeholder="Note" value={c.note} disabled={!canEdit} maxLength={300} onChange={(e) => setCheck(item, { note: e.target.value })} aria-label={`${item} note`} />
                  </div>
                );
              })}
            </details>
          ))}
        </div>
        <div className="field mt-2"><label>General notes</label><textarea className="input" value={d.notes} disabled={!canEdit} maxLength={1000} onChange={(e) => patch({ notes: e.target.value })} placeholder="Fuel level, odometer, anything else worth recording…" /></div>

        {canEdit && (
          <div className="form-actions">
            <Btn loading={saving} icon={Save} onClick={doSave} disabled={!hasAny}>Save {tab}-rental inspection</Btn>
            <button className="btn btn-ghost" onClick={fillDemo}><Wand2 size={16} /> Fill with demo photos</button>
          </div>
        )}

        {isStaff && (
          <div className="card card-gold mt-3">
            <h3><ScanSearch size={20} className="gold" /> AI damage analysis</h3>
            {report ? (
              <>
                <p className="muted">A report already exists for this booking: <Plate>{report.reportId}</Plate> <StatusBadge status={report.status} /></p>
                <Link to={isAdmin ? `/admin/damage-reports/${report._id}` : `/damage-reports/${report._id}`} className="btn btn-gold">Open damage report</Link>
              </>
            ) : (
              <>
                <p className="muted">Compares the after-rental photos against the baseline and creates a report for human review.</p>
                {!bothSaved && <Notice kind="info">Save both the before and after inspections first.</Notice>}
                <div className="form-actions"><Btn icon={ScanSearch} onClick={runAnalysis} disabled={!bothSaved && !(tab === 'after' && draft.after.touched && saved.before)} className="btn-gold">Run AI analysis</Btn></div>
              </>
            )}
          </div>
        )}
      </div>
      {stage >= 0 && (
        <div className="modal-back"><div style={{ width: 'min(520px,100%)' }}><InspectLoader stage={stage} error={aiError} onRetry={runAnalysis} onClose={() => { setStage(-1); setAiError(''); }} /></div></div>
      )}
    </>
  );
}

export default function AutoInspect() {
  const { bookingId } = useParams();
  return bookingId ? <Workspace bookingId={bookingId} key={bookingId} /> : <Picker />;
}
