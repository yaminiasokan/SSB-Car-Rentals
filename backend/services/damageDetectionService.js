/**
 * AI AutoInspect — damage detection service.
 *
 * ⚠️  DEMO / MOCK IMPLEMENTATION.
 * This is NOT a trained computer-vision model. It produces deterministic placeholder findings
 * (seeded from the image bytes) so the full inspect → review → decide workflow can be built and
 * demonstrated. Two identical photos always return "no damage"; two different photos may return
 * a plausible-looking finding.
 *
 * To integrate a real model, replace the body of `analyzeDamage()` (e.g. call a Python/ONNX/
 * cloud vision service that compares the before/after images) and return the same JSON shape.
 * Nothing else in the app needs to change.
 *
 * Results must ALWAYS be verified by a human — the app never charges customers automatically.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { AI_DISCLAIMER } = require('../config/constants');

const ENGINE = {
  name: 'SSB Demo Analyzer',
  version: '0.1.0-mock',
  mock: true,
  note: 'Placeholder analysis for demonstration — not a trained model. Verify every finding manually.',
};

const DETECTION_RATE = 0.65;
const BACKEND_ROOT = path.join(__dirname, '..');

// Where each type of damage can appear in each photo slot (region = % of image width/height).
const CANDIDATES = {
  front: [
    { type: 'Scratch', location: 'Front bumper', region: { x: 15, y: 68, w: 70, h: 16 } },
    { type: 'Bumper damage', location: 'Front bumper', region: { x: 15, y: 68, w: 70, h: 16 } },
    { type: 'Broken headlight', location: 'Left headlight', region: { x: 21, y: 50, w: 14, h: 10 } },
    { type: 'Paint damage', location: 'Hood', region: { x: 25, y: 34, w: 50, h: 14 } },
    { type: 'Cracked glass', location: 'Windshield', region: { x: 27, y: 20, w: 46, h: 14 } },
  ],
  rear: [
    { type: 'Scratch', location: 'Rear bumper', region: { x: 15, y: 68, w: 70, h: 16 } },
    { type: 'Dent', location: 'Rear bumper', region: { x: 30, y: 68, w: 40, h: 16 } },
    { type: 'Broken headlight', location: 'Tail light', region: { x: 68, y: 50, w: 14, h: 10 } },
    { type: 'Paint damage', location: 'Boot lid', region: { x: 25, y: 36, w: 50, h: 14 } },
  ],
  left: [
    { type: 'Scratch', location: 'Left doors', region: { x: 34, y: 42, w: 32, h: 16 } },
    { type: 'Dent', location: 'Left doors', region: { x: 40, y: 45, w: 16, h: 12 } },
    { type: 'Paint damage', location: 'Left front fender', region: { x: 68, y: 46, w: 16, h: 14 } },
    { type: 'Cracked glass', location: 'Left window', region: { x: 34, y: 27, w: 34, h: 13 } },
  ],
  right: [
    { type: 'Scratch', location: 'Right doors', region: { x: 34, y: 42, w: 32, h: 16 } },
    { type: 'Dent', location: 'Right doors', region: { x: 44, y: 45, w: 16, h: 12 } },
    { type: 'Paint damage', location: 'Right rear quarter', region: { x: 16, y: 46, w: 16, h: 14 } },
    { type: 'Cracked glass', location: 'Right window', region: { x: 34, y: 27, w: 34, h: 13 } },
  ],
  interior: [
    { type: 'Missing/damaged component', location: 'Seat upholstery', region: { x: 15, y: 40, w: 30, h: 30 } },
    { type: 'Missing/damaged component', location: 'Floor mat', region: { x: 30, y: 74, w: 40, h: 16 } },
  ],
  dashboard: [
    { type: 'Missing/damaged component', location: 'Infotainment unit', region: { x: 38, y: 40, w: 24, h: 18 } },
    { type: 'Missing/damaged component', location: 'Dashboard trim', region: { x: 15, y: 30, w: 70, h: 10 } },
  ],
  wheels: [
    { type: 'Wheel/rim damage', location: 'Front-left wheel', region: { x: 26, y: 20, w: 48, h: 60 } },
    { type: 'Wheel/rim damage', location: 'Rear-right wheel', region: { x: 30, y: 24, w: 40, h: 52 } },
  ],
};

// [minor, moderate, severe] repair estimates in INR
const COSTS = {
  Scratch: [[500, 1500], [2000, 4000], [4000, 8000]],
  Dent: [[1500, 3000], [3000, 7000], [7000, 15000]],
  'Bumper damage': [[2500, 5000], [5000, 12000], [12000, 25000]],
  'Paint damage': [[1500, 3500], [3500, 8000], [8000, 18000]],
  'Broken headlight': [[3000, 6000], [6000, 12000], [12000, 25000]],
  'Cracked glass': [[2000, 4000], [4000, 9000], [9000, 20000]],
  'Wheel/rim damage': [[1500, 3000], [3000, 7000], [7000, 14000]],
  'Missing/damaged component': [[500, 2000], [2000, 6000], [6000, 15000]],
};
const SEVERITIES = ['Minor', 'Moderate', 'Severe'];

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function readImage(img) {
  const ref = typeof img === 'string' ? img : img.filePath || img.url;
  if (!ref) throw new Error('Image reference missing');
  const abs = path.isAbsolute(ref) && fs.existsSync(ref) ? ref : path.join(BACKEND_ROOT, ref.replace(/^\//, ''));
  return fs.readFileSync(abs);
}

/**
 * Compare one BEFORE image with one AFTER image.
 * @param {string|{slot?:string,filePath?:string,url?:string}} beforeImage
 * @param {string|{slot?:string,filePath?:string,url?:string}} afterImage
 * @returns {Promise<{damageDetected:boolean, damages:Array}>}
 */
async function analyzeDamage(beforeImage, afterImage, opts = {}) {
  const before = readImage(beforeImage);
  const after = readImage(afterImage);
  const slot = opts.slot || (typeof afterImage === 'object' ? afterImage.slot : undefined) || 'front';

  if (before.equals(after) || !CANDIDATES[slot]) return { damageDetected: false, damages: [] };

  const seed = crypto.createHash('sha256').update(before).update(after).digest();
  const rand = mulberry32(seed.readUInt32BE(0));
  if (rand() > DETECTION_RATE) return { damageDetected: false, damages: [] };

  const cand = CANDIDATES[slot][Math.floor(rand() * CANDIDATES[slot].length)];
  const r = rand();
  const sev = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;
  const [min, max] = COSTS[cand.type][sev];
  return {
    damageDetected: true,
    damages: [{
      type: cand.type,
      location: cand.location,
      severity: SEVERITIES[sev],
      confidence: Math.round((0.62 + rand() * 0.35) * 100) / 100,
      estimatedRepairCost: { min, max },
      slot,
      region: cand.region,
    }],
  };
}

/**
 * Analyse every photo slot present in BOTH inspections.
 * Slots are analysed independently so one unreadable file doesn't fail the whole report.
 */
async function analyzeInspection(beforeInspection, afterInspection) {
  const beforeBySlot = new Map(beforeInspection.images.filter((i) => i.slot !== 'extra').map((i) => [i.slot, i]));
  const pairs = afterInspection.images.filter((i) => i.slot !== 'extra' && beforeBySlot.has(i.slot));
  if (!pairs.length) throw new AppError('The before and after inspections have no matching photo angles to compare.', 422);

  const damages = [];
  const analysed = [];
  const failed = [];
  for (const after of pairs) {
    try {
      const res = await analyzeDamage(beforeBySlot.get(after.slot), after, { slot: after.slot });
      analysed.push(after.slot);
      damages.push(...res.damages);
    } catch (e) {
      failed.push(after.slot);
    }
  }
  if (!analysed.length) throw new AppError('AI analysis failed: the inspection images could not be read. Please re-upload and try again.', 502);
  return { damageDetected: damages.length > 0, damages, analysedSlots: analysed, failedSlots: failed, engine: ENGINE, disclaimer: AI_DISCLAIMER };
}

module.exports = { analyzeDamage, analyzeInspection, ENGINE, CANDIDATES, COSTS };
