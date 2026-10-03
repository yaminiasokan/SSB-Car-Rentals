import { useId } from 'react';

/**
 * Side-profile car illustration in the SSB black-and-gold style.
 * Used wherever a vehicle has no uploaded photo (admin can upload real photos per vehicle).
 */
const SHAPES = {
  Sedan: {
    body: 'M18 122 L18 104 Q20 93 40 89 L92 83 Q118 50 160 46 L238 46 Q276 48 298 80 L346 86 Q380 92 382 112 L382 124 Q382 132 374 132 L26 132 Q18 132 18 122 Z',
    windows: ['M104 82 Q122 56 158 53 L184 53 L184 82 Z', 'M194 53 L236 53 Q262 56 280 82 L194 82 Z'], doors: [189],
  },
  Hatchback: {
    body: 'M22 124 L22 100 Q26 90 44 86 L80 82 Q94 52 132 46 L236 46 Q272 50 294 82 L348 88 Q380 94 382 114 L382 124 Q382 132 374 132 L30 132 Q22 132 22 124 Z',
    windows: ['M100 82 Q110 60 136 54 L170 54 L170 82 Z', 'M180 54 L234 54 Q258 58 276 82 L180 82 Z'], doors: [175],
  },
  MPV: {
    body: 'M18 124 L18 94 Q20 82 38 78 L62 74 Q76 42 112 36 L246 36 Q286 40 302 74 L352 82 Q382 90 384 112 L384 124 Q384 133 375 133 L27 133 Q18 133 18 124 Z',
    windows: ['M84 74 Q94 50 118 44 L148 44 L148 74 Z', 'M156 44 L204 44 L204 74 L156 74 Z', 'M212 44 L244 44 Q268 48 284 74 L212 74 Z'], doors: [152, 208],
  },
};

export default function CarArt({ type = 'Sedan', className = '', glow = true, label }) {
  const id = useId().replace(/:/g, '');
  const s = SHAPES[type] || SHAPES.Sedan;
  const wheel = (cx) => (
    <g key={cx}>
      <circle cx={cx} cy="132" r="33" fill="#000" />
      <circle cx={cx} cy="132" r="26" fill="#0f0f0f" stroke="#2c2c2c" strokeWidth="3" />
      <circle cx={cx} cy="132" r="16" fill="none" stroke={`url(#${id}g)`} strokeWidth="3" />
      {[0, 72, 144, 216, 288].map((a) => (
        <line key={a} x1={cx} y1="132" x2={cx + 15 * Math.cos((a * Math.PI) / 180)} y2={132 + 15 * Math.sin((a * Math.PI) / 180)} stroke={`url(#${id}g)`} strokeWidth="2.4" />
      ))}
      <circle cx={cx} cy="132" r="3.5" fill="#d4af37" />
    </g>
  );
  return (
    <svg viewBox="0 0 400 180" className={className} role="img" aria-label={label || `${type} car illustration`}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7e08a" /><stop offset=".5" stopColor="#d4af37" /><stop offset="1" stopColor="#8a6d1d" /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d3d3d" /><stop offset=".55" stopColor="#1c1c1c" /><stop offset="1" stopColor="#0a0a0a" /></linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1b3347" /><stop offset="1" stopColor="#07101a" /></linearGradient>
        <radialGradient id={`${id}s`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#d4af37" stopOpacity=".28" /><stop offset="1" stopColor="#d4af37" stopOpacity="0" /></radialGradient>
      </defs>
      {glow && <ellipse cx="200" cy="100" rx="190" ry="70" fill={`url(#${id}s)`} />}
      <ellipse cx="200" cy="163" rx="176" ry="8" fill="#000" opacity=".8" />
      <path d={s.body} fill={`url(#${id}b)`} stroke={`url(#${id}g)`} strokeWidth="1.6" />
      {s.windows.map((w) => <path key={w} d={w} fill={`url(#${id}w)`} stroke="#d4af37" strokeOpacity=".45" strokeWidth="1" />)}
      {s.doors.map((x) => <line key={x} x1={x} y1="84" x2={x} y2="126" stroke="#d4af37" strokeOpacity=".3" />)}
      <path d="M30 104 L372 104" stroke={`url(#${id}g)`} strokeWidth="1.6" opacity=".75" />
      <path d="M356 98 Q376 100 380 108 L362 108 Z" fill="#fff3bf" />
      <rect x="18" y="98" width="9" height="9" rx="2" fill="#b3261e" />
      {wheel(88)}{wheel(312)}
    </svg>
  );
}
