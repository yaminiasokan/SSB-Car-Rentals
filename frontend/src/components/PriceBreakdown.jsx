import { Notice } from './ui';
import { inr } from '../utils/format';

/** Fully transparent price breakdown — every charge is listed. */
export default function PriceBreakdown({ pricing }) {
  if (!pricing) return null;
  const p = pricing;
  return (
    <div className="breakdown">
      <div className="bd-section">Vehicle rental</div>
      {p.lines.map((l) => <div className="bd-row" key={l.key}><span>{l.label}<small>{l.detail}</small></span><b>{inr(l.amount)}</b></div>)}
      {p.serviceLines?.length > 0 && <div className="bd-section">Additional services</div>}
      {p.serviceLines?.map((l) => <div className="bd-row" key={l.key}><span>{l.label}<small>{l.detail}</small></span><b>{inr(l.amount)}</b></div>)}
      {p.discount > 0 && <div className="bd-row good"><span>Discount<small>{p.promoCode}{p.promoLabel ? ` — ${p.promoLabel}` : ''}</small></span><b>− {inr(p.discount)}</b></div>}
      <div className="bd-row"><span>Taxes (GST {Math.round(p.taxRate * 100)}%)<small>on rental + services − discount</small></span><b>{inr(p.taxAmount)}</b></div>
      <div className="bd-row sub"><span>Rental total</span><b>{inr(p.rentalTotal)}</b></div>
      {p.deposit > 0 && <div className="bd-row"><span>Security deposit<small>Refundable after return &amp; inspection</small></span><b>{inr(p.deposit)}</b></div>}
      <div className="bd-total"><span>TOTAL</span><b className="gold-text">{inr(p.total)}</b></div>
      {p.promoMessage && <Notice kind="info">{p.promoMessage}</Notice>}
      <p className="hint" style={{ marginTop: 10 }}>No security deposit. No hidden charges. Fuel, tolls and fines during the rental are not included.</p>
    </div>
  );
}
