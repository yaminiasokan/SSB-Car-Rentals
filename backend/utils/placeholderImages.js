/**
 * Generates simple schematic SVG "photos" for the seeded demo inspections, so the before/after
 * comparison and damage overlay can be demonstrated without real photographs.
 * Coordinates match the damage regions in services/damageDetectionService.js (800×500 canvas).
 */
const fs = require('fs');
const path = require('path');

const W = 800; const H = 500;
const px = (r) => ({ X: r.x * 8, Y: r.y * 5, W: r.w * 8, H: r.h * 5 });

const drawings = {
  front: `<rect x="140" y="100" width="520" height="320" rx="40" fill="#242424" stroke="#d4af37" stroke-opacity=".5"/>
    <polygon points="220,100 580,100 620,170 180,170" fill="#0e2233"/><rect x="160" y="170" width="480" height="70" fill="#3a3a3a"/>
    <rect x="170" y="250" width="110" height="50" rx="10" fill="#f4e9b1"/><rect x="520" y="250" width="110" height="50" rx="10" fill="#f4e9b1"/>
    <rect x="330" y="265" width="140" height="40" rx="6" fill="#111"/><rect x="120" y="340" width="560" height="80" rx="20" fill="#333"/>`,
  rear: `<rect x="140" y="100" width="520" height="320" rx="40" fill="#242424" stroke="#d4af37" stroke-opacity=".5"/>
    <polygon points="220,100 580,100 620,175 180,175" fill="#0e2233"/><rect x="160" y="180" width="480" height="70" fill="#3a3a3a"/>
    <rect x="144" y="250" width="110" height="50" rx="10" fill="#b3261e"/><rect x="546" y="250" width="110" height="50" rx="10" fill="#b3261e"/>
    <rect x="340" y="285" width="120" height="40" rx="4" fill="#e9e2c2"/><rect x="120" y="340" width="560" height="80" rx="20" fill="#333"/>`,
  left: `<rect x="100" y="190" width="600" height="180" rx="45" fill="#242424" stroke="#d4af37" stroke-opacity=".5"/>
    <polygon points="250,135 560,135 620,200 200,200" fill="#0e2233"/><rect x="272" y="210" width="256" height="80" rx="8" fill="#303030"/>
    <circle cx="240" cy="370" r="52" fill="#111" stroke="#888" stroke-width="6"/><circle cx="570" cy="370" r="52" fill="#111" stroke="#888" stroke-width="6"/>`,
  interior: `<rect x="60" y="80" width="680" height="380" rx="30" fill="#1a1a1a" stroke="#d4af37" stroke-opacity=".4"/>
    <rect x="120" y="200" width="240" height="150" rx="24" fill="#3a3129"/><rect x="440" y="200" width="240" height="150" rx="24" fill="#3a3129"/>
    <rect x="240" y="370" width="320" height="80" rx="10" fill="#2a2a2a"/>`,
  dashboard: `<rect x="60" y="100" width="680" height="330" rx="30" fill="#1a1a1a" stroke="#d4af37" stroke-opacity=".4"/>
    <rect x="120" y="150" width="560" height="50" rx="8" fill="#2c2c2c"/><rect x="304" y="200" width="192" height="90" rx="8" fill="#0d0d0d" stroke="#d4af37" stroke-opacity=".6"/>
    <circle cx="200" cy="350" r="55" fill="#101010" stroke="#d4af37"/><circle cx="600" cy="350" r="55" fill="#101010" stroke="#d4af37"/>`,
  wheels: `<circle cx="400" cy="250" r="185" fill="#111" stroke="#666" stroke-width="10"/><circle cx="400" cy="250" r="120" fill="#2b2b2b" stroke="#aaa" stroke-width="6"/>
    ${[0, 72, 144, 216, 288].map((a) => `<line x1="400" y1="250" x2="${400 + 120 * Math.cos((a * Math.PI) / 180)}" y2="${250 + 120 * Math.sin((a * Math.PI) / 180)}" stroke="#bbb" stroke-width="14"/>`).join('')}
    <circle cx="400" cy="250" r="26" fill="#d4af37"/>`,
};
drawings.right = drawings.left;

function marks(damage) {
  if (!damage) return '';
  const { X, Y, W: w, H: h } = px(damage.region);
  if (/headlight|glass/i.test(damage.type)) {
    return `<polyline points="${X},${Y} ${X + w * 0.35},${Y + h * 0.4} ${X + w * 0.2},${Y + h * 0.6} ${X + w * 0.7},${Y + h} ${X + w * 0.6},${Y + h * 0.45} ${X + w},${Y + h * 0.2}" fill="none" stroke="#f5f5f5" stroke-width="3"/>`;
  }
  if (/dent/i.test(damage.type)) return `<ellipse cx="${X + w / 2}" cy="${Y + h / 2}" rx="${w / 2.4}" ry="${h / 2.6}" fill="#000" fill-opacity=".45" stroke="#888"/>`;
  return [0.25, 0.5, 0.75].map((f) => `<line x1="${X + w * 0.08}" y1="${Y + h * (f + 0.15)}" x2="${X + w * 0.6}" y2="${Y + h * (f - 0.2)}" stroke="#ececec" stroke-width="3" stroke-linecap="round"/>`).join('');
}

function renderSlotSvg({ slot, tag, damage }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#0c0c0c"/>
<rect x="0" y="420" width="${W}" height="80" fill="#151515"/>
${drawings[slot]}${marks(damage)}
<text x="24" y="40" fill="#d4af37" font-family="Arial,sans-serif" font-size="22" font-weight="700">${slot.toUpperCase()} — ${tag}</text>
<text x="24" y="482" fill="#777" font-family="Arial,sans-serif" font-size="14">SSB demo placeholder photo (generated for seed data)</text>
</svg>`;
}

/** Writes an SVG into uploads/seed and returns its public URL. */
function writeSlotImage(name, opts) {
  const dir = path.join(__dirname, '..', 'uploads', 'seed');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.svg`), renderSlotSvg(opts));
  return `/uploads/seed/${name}.svg`;
}

module.exports = { writeSlotImage, renderSlotSvg };
