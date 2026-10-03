import { useEffect } from 'react';
import { Star, X, Inbox, AlertCircle, CheckCircle2, Info, Check } from 'lucide-react';
import { STATUS_CLASS } from '../utils/constants';
import { cx } from '../utils/format';

export const Spinner = () => <span className="spinner" aria-hidden="true" />;

export function Loader({ label = 'Loading…' }) {
  return <div className="loader" role="status"><div className="ring" /><span>{label}</span></div>;
}

export const Skeleton = ({ h = 20, w = '100%', style }) => <div className="skeleton" style={{ height: h, width: w, ...style }} />;

export function Empty({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="empty">
      <Icon size={40} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Button with built-in loading state */
export function Btn({ loading, children, className = 'btn-gold', icon: Icon, ...rest }) {
  return (
    <button {...rest} className={cx('btn', className)} disabled={loading || rest.disabled}>
      {loading ? <Spinner /> : Icon ? <Icon size={17} /> : null}
      {children}
    </button>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="notice notice-bad" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Something went wrong.</strong>
        <div>{message}</div>
        {onRetry && <button className="btn btn-outline btn-sm mt-1" onClick={() => onRetry()}>Try again</button>}
      </div>
    </div>
  );
}

export function Notice({ kind = '', icon, children }) {
  const Icon = icon || (kind === 'bad' ? AlertCircle : kind === 'ok' ? CheckCircle2 : Info);
  return <div className={cx('notice', kind && `notice-${kind}`)}><Icon size={20} /><div>{children}</div></div>;
}

export function StatusBadge({ status, children }) {
  return <span className={cx('badge', STATUS_CLASS[status])}>{children || status}</span>;
}

export const Plate = ({ children, large }) => <span className={cx('plate', large && 'plate-lg')}>{children}</span>;

export function Field({ label, error, hint, children, className }) {
  return (
    <div className={cx('field', className)}>
      {label && <label>{label}</label>}
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  );
}

export function StarRating({ value = 0, onChange, size = 18, label }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={label || `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(value);
        const star = <Star size={size} fill={on ? 'currentColor' : 'none'} className={on ? '' : 'off'} />;
        return onChange
          ? <button type="button" key={n} onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} style={{ background: 'none', border: 0, padding: 1, color: 'inherit' }}>{star}</button>
          : <span key={n}>{star}</span>;
      })}
    </span>
  );
}

export function Modal({ title, onClose, children, large }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', large && 'modal-lg')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, children, confirmLabel = 'Confirm', danger, loading, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="muted">{children}</div>
      <div className="form-actions">
        <Btn className={danger ? 'btn-danger' : 'btn-gold'} loading={loading} onClick={onConfirm}>{confirmLabel}</Btn>
        <button className="btn btn-ghost" onClick={onClose}>Keep as is</button>
      </div>
    </Modal>
  );
}

/** Estimated eco score — informational only */
export function EcoBadge({ score, compact }) {
  const tone = score >= 75 ? '#3fb27f' : score >= 60 ? '#d4af37' : '#e8a838';
  return (
    <div className="eco" title="Estimated eco score — informational only">
      <div className="eco-ring" style={{ '--p': `${score}%`, '--c': tone }}><span>{score}</span></div>
      {!compact && <div><strong>Eco Score</strong><div className="hint">Estimated · informational only</div></div>}
    </div>
  );
}

export function Stepper({ steps, current }) {
  return (
    <ol className="stepper">
      {steps.map((s, i) => (
        <li key={s} className={cx(i < current && 'done', i === current && 'now')}>
          <span className="dot">{i < current ? <Check size={14} /> : i + 1}</span>
          <span className="lbl">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="page-head">
      <div className="container">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {children && <p className="muted" style={{ maxWidth: 640 }}>{children}</p>}
      </div>
    </div>
  );
}
