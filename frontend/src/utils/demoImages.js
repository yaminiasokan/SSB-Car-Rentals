/**
 * Generates demo "photos" in the browser (PNG via canvas) so AutoInspect can be tried
 * without a camera. The AFTER variant adds random scuff marks so it differs from BEFORE.
 */
const draw = {
  front: (c) => { c.fillStyle = '#242424'; c.fillRect(140, 100, 520, 320); c.fillStyle = '#0e2233'; c.fillRect(220, 100, 360, 70); c.fillStyle = '#f4e9b1'; c.fillRect(170, 250, 110, 50); c.fillRect(520, 250, 110, 50); c.fillStyle = '#333'; c.fillRect(120, 340, 560, 80); },
  rear: (c) => { c.fillStyle = '#242424'; c.fillRect(140, 100, 520, 320); c.fillStyle = '#0e2233'; c.fillRect(220, 100, 360, 75); c.fillStyle = '#b3261e'; c.fillRect(144, 250, 110, 50); c.fillRect(546, 250, 110, 50); c.fillStyle = '#333'; c.fillRect(120, 340, 560, 80); },
  side: (c) => { c.fillStyle = '#242424'; c.fillRect(100, 190, 600, 180); c.fillStyle = '#0e2233'; c.fillRect(250, 135, 310, 65); c.fillStyle = '#111'; [240, 570].forEach((x) => { c.beginPath(); c.arc(x, 370, 52, 0, 7); c.fill(); }); },
  interior: (c) => { c.fillStyle = '#3a3129'; c.fillRect(120, 200, 240, 150); c.fillRect(440, 200, 240, 150); },
  dashboard: (c) => { c.fillStyle = '#2c2c2c'; c.fillRect(120, 150, 560, 50); c.fillStyle = '#0d0d0d'; c.fillRect(304, 200, 192, 90); },
  wheels: (c) => { c.fillStyle = '#111'; c.beginPath(); c.arc(400, 250, 185, 0, 7); c.fill(); c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(400, 250, 120, 0, 7); c.fill(); },
};

export function makeDemoPhoto(slot, variant = 'before') {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 500;
  const c = canvas.getContext('2d');
  c.fillStyle = '#0c0c0c'; c.fillRect(0, 0, 800, 500);
  c.fillStyle = '#151515'; c.fillRect(0, 420, 800, 80);
  (draw[slot] || draw.side)(c);
  if (variant === 'after') {
    c.strokeStyle = '#ececec'; c.lineWidth = 3; c.lineCap = 'round';
    const x = 160 + Math.random() * 380; const y = 210 + Math.random() * 150;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x, y + i * 12); c.lineTo(x + 90 + Math.random() * 40, y + i * 12 - 26); c.stroke(); }
  }
  c.fillStyle = '#d4af37'; c.font = 'bold 22px Arial'; c.fillText(`${slot.toUpperCase()} — ${variant.toUpperCase()}`, 24, 40);
  c.fillStyle = '#777'; c.font = '14px Arial'; c.fillText('Demo photo generated in browser', 24, 482);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(new File([blob], `${variant}-${slot}-${Date.now()}.png`, { type: 'image/png' })), 'image/png'));
}
