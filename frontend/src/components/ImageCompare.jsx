import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { assetUrl } from '../services/api';
import { slotLabel } from '../utils/constants';

/** Side-by-side BEFORE / AFTER with a heat-map style overlay on suspected damage regions. */
export default function ImageCompare({ slot, before, after, damages = [], highlight, onHighlight }) {
  const [overlay, setOverlay] = useState(true);
  const marks = damages.filter((d) => d.slot === slot && d.region && d.decision !== 'rejected');
  const Pane = ({ title, img, showMarks }) => (
    <figure className="cmp-pane">
      <figcaption>{title}</figcaption>
      <div className="cmp-img">
        {img ? <img src={assetUrl(img.url)} alt={`${title} — ${slotLabel(slot)}`} /> : <div className="cmp-missing">No {title.toLowerCase()} photo for this angle</div>}
        {showMarks && overlay && img && marks.map((d) => (
          <button
            type="button" key={d._id || `${d.type}-${d.location}`}
            className={`heat sev-${d.severity.toLowerCase()} ${highlight === d._id ? 'hl' : ''}`}
            style={{ left: `${d.region.x}%`, top: `${d.region.y}%`, width: `${d.region.w}%`, height: `${d.region.h}%` }}
            title={`${d.type} — ${d.location} (${d.severity}, ${Math.round(d.confidence * 100)}% confidence)`}
            onMouseEnter={() => onHighlight?.(d._id)} onMouseLeave={() => onHighlight?.(null)}
            aria-label={`${d.type} at ${d.location}, ${d.severity}`}
          ><span>{d.type}</span></button>
        ))}
      </div>
      {img?.note && <div className="cmp-note">Note: {img.note}</div>}
    </figure>
  );
  return (
    <div>
      <div className="row between mb-2" style={{ flexWrap: 'wrap' }}>
        <div className="legend"><i className="lg minor" /> Minor <i className="lg moderate" /> Moderate <i className="lg severe" /> Severe</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOverlay((o) => !o)}>{overlay ? <EyeOff size={15} /> : <Eye size={15} />} {overlay ? 'Hide' : 'Show'} damage overlay</button>
      </div>
      <div className="cmp-grid"><Pane title="Before" img={before} /><Pane title="After" img={after} showMarks /></div>
      {marks.length === 0 && after && <p className="hint mt-1">No suspected damage marked on this angle.</p>}
    </div>
  );
}
