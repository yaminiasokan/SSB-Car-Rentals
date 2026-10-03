import { Check, AlertTriangle } from 'lucide-react';
import { Spinner } from './ui';

export const INSPECT_STEPS = ['Uploading images...', 'Analyzing vehicle condition...', 'Comparing before and after...', 'Generating damage report...', 'Inspection completed.'];

export default function InspectLoader({ stage, error, onRetry, onClose }) {
  const pct = Math.min(100, Math.round(((stage + (stage >= INSPECT_STEPS.length - 1 ? 1 : 0.5)) / INSPECT_STEPS.length) * 100));
  return (
    <div className="inspect-loader card card-gold">
      <h3>AI AutoInspect</h3>
      <div className="progress mb-2" aria-hidden="true"><i style={{ width: error ? '100%' : `${pct}%`, background: error ? 'var(--bad)' : undefined }} /></div>
      <ol>
        {INSPECT_STEPS.map((s, i) => {
          const state = error && i === stage ? 'fail' : i < stage || (i === stage && stage === INSPECT_STEPS.length - 1) ? 'done' : i === stage ? 'now' : '';
          return (
            <li key={s} className={state}>
              <span className="ic">{state === 'done' ? <Check size={15} /> : state === 'now' ? <Spinner /> : state === 'fail' ? <AlertTriangle size={15} /> : i + 1}</span>
              {s}
            </li>
          );
        })}
      </ol>
      {error && (
        <div className="notice notice-bad mt-2" role="alert"><AlertTriangle size={20} /><div><strong>AI analysis failed.</strong><div>{error}</div>
          <div className="row mt-1"><button className="btn btn-gold btn-sm" onClick={onRetry}>Retry</button><button className="btn btn-ghost btn-sm" onClick={onClose}>Back to photos</button></div></div></div>
      )}
      <p className="hint mt-2">AI-assisted detection — requires human verification.</p>
    </div>
  );
}
