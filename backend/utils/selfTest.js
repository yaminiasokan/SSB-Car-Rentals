/**
 * Database-free checks for the core business logic:  npm test
 * (pricing rules, AI damage service contract, removed-vehicle guard)
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { computePrice } = require('../services/pricingService');
const { analyzeDamage, analyzeInspection, CANDIDATES, COSTS } = require('../services/damageDetectionService');
const { REMOVED_MODELS, PROMOS, SERVICES } = require('../config/constants');

let passed = 0;
const test = async (name, fn) => { try { await fn(); passed += 1; console.log(`  ✓ ${name}`); } catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; } };

// securityDeposit is included on purpose, set to a nonzero legacy-style value, to prove computePrice
// ignores it completely — SSB CAR RENTALS charges no security deposit, on any vehicle.
const innova = { pricePerDay: 5000, pricePerHour: 500, securityDeposit: 10000 };
const baleno = { pricePerDay: 2000, pricePerHour: 200, securityDeposit: 5000 };
const dzire = { pricePerDay: 2500, pricePerHour: 250, securityDeposit: 5000 };
const t0 = new Date('2026-10-01T09:00:00+05:30');
const plus = (h) => new Date(t0.getTime() + h * 36e5);

(async () => {
  console.log('Pricing');
  await test('₹5,000 × 3 days + 12% tax, no security deposit', () => {
    const p = computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(72) });
    assert.equal(p.baseAmount, 15000); assert.equal(p.taxAmount, 1800); assert.equal(p.deposit, 0);
    assert.equal(p.total, 16800); assert.equal(p.lines[0].detail, '₹5,000 × 3 days');
  });
  await test('deposit is always ₹0, even when the vehicle record carries a nonzero securityDeposit', () => {
    assert.equal(computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(24) }).deposit, 0);
    assert.equal(computePrice({ vehicle: { ...innova, securityDeposit: 99999 }, pickupAt: t0, returnAt: plus(24) }).deposit, 0);
  });
  await test('optional services are per-day for childSeat/insurance, tax applies', () => {
    const p = computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(72), services: ['childSeat', 'insurance'] });
    const services = 150 * 3 + 400 * 3;
    assert.equal(p.servicesAmount, services); assert.equal(p.taxAmount, Math.round((15000 + services) * 0.12)); assert.equal(p.total, 15000 + services + p.taxAmount);
  });
  await test('additionalDriver is a flat ₹800 trip charge, not multiplied by days', () => {
    const p = computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(72), services: ['additionalDriver'] });
    assert.equal(p.servicesAmount, SERVICES.additionalDriver.price); assert.equal(p.servicesAmount, 800);
  });
  await test('doorstepDelivery: 10 km or below is a flat ₹500', () => {
    const p = computePrice({ vehicle: baleno, pickupAt: t0, returnAt: plus(48), services: ['doorstepDelivery'], deliveryKm: 10 });
    assert.equal(p.servicesAmount, 500);
  });
  await test('doorstepDelivery: above 10 km adds ₹50 per extra km (examples from the brief)', () => {
    const at = (km) => computePrice({ vehicle: baleno, pickupAt: t0, returnAt: plus(48), services: ['doorstepDelivery'], deliveryKm: km }).servicesAmount;
    assert.equal(at(11), 550); assert.equal(at(12), 600); assert.equal(at(15), 750); assert.equal(at(20), 1000);
  });
  await test('doorstepDelivery without a distance is rejected', () => {
    assert.throws(() => computePrice({ vehicle: baleno, pickupAt: t0, returnAt: plus(48), services: ['doorstepDelivery'] }), /delivery distance/);
  });
  await test('short rental uses hourly rate', () => {
    const p = computePrice({ vehicle: baleno, pickupAt: t0, returnAt: plus(6) });
    assert.equal(p.baseAmount, 1200);
  });
  await test('hourly extra is capped at one day rate', () => {
    const p = computePrice({ vehicle: dzire, pickupAt: t0, returnAt: plus(20) });
    assert.equal(p.baseAmount, 2500);
  });
  await test('26 hours = 1 day + 2 extra hours; billingDays used for max-km, not childSeat', () => {
    const p = computePrice({ vehicle: baleno, pickupAt: t0, returnAt: plus(26), services: ['childSeat'] });
    assert.equal(p.baseAmount, 2000 + 400); assert.equal(p.billingDays, 2); assert.equal(p.servicesAmount, 300); assert.equal(p.maxKm, 600);
  });
  await test('max km scales with billing days (300 km/day)', () => {
    assert.equal(computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(24) }).maxKm, 300);
    assert.equal(computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(72) }).maxKm, 900);
  });
  await test('SSB10 is 10% capped at ₹1,000', () => {
    const p = computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(72), promo: PROMOS.SSB10 });
    assert.equal(p.discount, 1000); assert.equal(p.promoCode, 'SSB10');
    assert.equal(p.total, 15000 - 1000 + Math.round(14000 * 0.12));
  });
  await test('LONGTRIP is rejected (not applied) on a 2-day rental', () => {
    const p = computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(48), promo: PROMOS.LONGTRIP });
    assert.equal(p.discount, 0); assert.equal(p.promoCode, null); assert.ok(p.promoMessage);
  });
  await test('free-delivery reward waives only the delivery line', () => {
    const p = computePrice({ vehicle: dzire, pickupAt: t0, returnAt: plus(48), services: ['doorstepDelivery'], deliveryKm: 10, promo: { code: 'SSBR-X', kind: 'free_service', service: 'doorstepDelivery', label: 'Free delivery' } });
    assert.equal(p.discount, 500);
  });
  await test('return before pickup and sub-minimum rentals are rejected', () => {
    assert.throws(() => computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(-2) }), /after pickup/);
    assert.throws(() => computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(2) }), /minimum/);
  });
  await test('unknown service is rejected', () => {
    assert.throws(() => computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(48), services: ['jetpack'] }), /Unknown service/);
  });
  await test('Navigation is not a service — it was removed and cannot be priced', () => {
    assert.ok(!SERVICES.gps); assert.ok(!SERVICES.navigation);
    assert.throws(() => computePrice({ vehicle: innova, pickupAt: t0, returnAt: plus(48), services: ['gps'] }), /Unknown service/);
  });

  console.log('Inventory rules');
  await test('removed models are blocked; the SSB fleet models are not', () => {
    const blocked = (s) => REMOVED_MODELS.some((re) => re.test(s));
    assert.ok(blocked('Tata Altroz')); assert.ok(blocked('Renault Duster'));
    ['Maruti Suzuki Swift Dzire', 'Maruti Suzuki Baleno', 'Toyota Glanza', 'Maruti Suzuki Ertiga', 'Toyota Innova Crysta', 'Kia Carens', 'Tata Tiago', 'Hyundai Xcent', 'Renault Triber', 'Maruti Suzuki XL6'].forEach((n) => assert.ok(!blocked(n), n));
  });
  await test('seed data never creates the removed vehicles, and covers both cities', () => {
    const seed = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf8');
    const names = [...seed.matchAll(/name: '([^']+)', brand/g)].map((m) => m[1]);
    assert.equal(names.length, 15); assert.ok(names.every((n) => !/altroz|duster/i.test(n)));
  });

  console.log('AI damage service (mock)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssb-'));
  const write = (name, content) => { const f = path.join(tmp, name); fs.writeFileSync(f, content); return f; };
  await test('identical photos → no damage', async () => {
    const a = write('a.jpg', 'same-bytes'); const b = write('b.jpg', 'same-bytes');
    assert.deepEqual(await analyzeDamage({ slot: 'front', filePath: a }, { slot: 'front', filePath: b }), { damageDetected: false, damages: [] });
  });
  await test('different photos → deterministic result in the documented JSON shape', async () => {
    let hit = null;
    for (let i = 0; i < 40 && !hit; i++) {
      const a = write(`x${i}.jpg`, `before-${i}`); const b = write(`y${i}.jpg`, `after-${i}`);
      const r1 = await analyzeDamage({ slot: 'front', filePath: a }, { slot: 'front', filePath: b });
      const r2 = await analyzeDamage({ slot: 'front', filePath: a }, { slot: 'front', filePath: b });
      assert.deepEqual(r1, r2, 'must be deterministic');
      if (r1.damageDetected) hit = r1;
    }
    assert.ok(hit, 'expected at least one detection across 40 samples');
    const d = hit.damages[0];
    assert.ok(['Minor', 'Moderate', 'Severe'].includes(d.severity)); assert.ok(d.confidence > 0 && d.confidence <= 1);
    assert.ok(d.estimatedRepairCost.min <= d.estimatedRepairCost.max); assert.ok(d.type && d.location && d.region);
  });
  await test('every candidate type has a repair-cost table', () => {
    Object.values(CANDIDATES).flat().forEach((c) => assert.ok(COSTS[c.type], c.type));
  });
  await test('inspection analysis reports engine as mock and skips unmatched slots', async () => {
    const mk = (n) => write(n, n);
    const before = { images: [{ slot: 'front', url: mk('bf') }, { slot: 'rear', url: mk('br') }] };
    const after = { images: [{ slot: 'front', url: mk('af') }, { slot: 'left', url: mk('al') }] };
    const r = await analyzeInspection(before, after);
    assert.deepEqual(r.analysedSlots, ['front']); assert.equal(r.engine.mock, true); assert.match(r.disclaimer, /requires human verification/);
  });
  await test('analysis fails cleanly when nothing can be read', async () => {
    await assert.rejects(analyzeInspection({ images: [{ slot: 'front', url: '/nope-1.jpg' }] }, { images: [{ slot: 'front', url: '/nope-2.jpg' }] }), /AI analysis failed/);
  });

  console.log(`\n${passed} checks passed${process.exitCode ? ' — with failures' : ''}.`);
})();
