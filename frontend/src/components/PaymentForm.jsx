import { useEffect, useRef, useState } from 'react';
import { Smartphone, CreditCard, Landmark, Banknote, ShieldCheck, AlertCircle, QrCode, UploadCloud, X, CheckCircle2, Copy } from 'lucide-react';
import { Btn, Field, Notice } from './ui';
import { errMsg, fieldErrors } from '../services/api';
import { inr } from '../utils/format';
import { COMPANY_UPI_ID } from '../utils/constants';

// Drop the real payment QR in src/assets/payment-qr.{png,jpg,jpeg,webp} and it's used automatically.
const qrImage = Object.values(import.meta.glob('../assets/payment-qr.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }))[0];

const METHODS = [
  { key: 'UPI', icon: Smartphone }, { key: 'Credit Card', icon: CreditCard }, { key: 'Debit Card', icon: CreditCard },
  { key: 'Net Banking', icon: Landmark }, { key: 'Cash on Pickup', icon: Banknote },
];
const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Indian Overseas Bank', 'Canara Bank', 'Test Bank (Fail)'];
const SCREENSHOT_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_SCREENSHOT_MB = 5;

function PaymentScanner({ amount }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(COMPANY_UPI_ID).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <div className="pay-scanner card card-gold" style={{ padding: 16, textAlign: 'center' }}>
      <h4 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}><QrCode size={18} /> PAYMENT SCANNER</h4>
      <p className="muted" style={{ marginBottom: 12 }}>Scan &amp; Pay</p>
      {qrImage
        ? <img src={qrImage} alt="SSB Car Rentals payment QR code" style={{ width: 220, height: 220, maxWidth: '100%', borderRadius: 12, border: '1px solid var(--border, #e5c76b55)' }} />
        : <div className="skeleton" style={{ width: 220, height: 220, maxWidth: '100%', margin: '0 auto', borderRadius: 12 }} />}
      <p className="mt-2" style={{ fontSize: 14 }}>UPI ID: <b>{COMPANY_UPI_ID}</b>{' '}
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy} aria-label="Copy UPI ID"><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button>
      </p>
      <div className="row between mt-2" style={{ alignItems: 'baseline' }}>
        <span className="muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Amount to pay</span>
        <b className="gold-text" style={{ fontFamily: 'var(--display)', fontSize: '1.6rem' }}>{inr(amount)}</b>
      </div>
    </div>
  );
}

function ScreenshotUpload({ file, preview, error, onChange, onRemove }) {
  const inputRef = useRef(null);
  return (
    <div className="mt-2">
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>UPLOAD PAYMENT SCREENSHOT</label>
      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png" hidden
        onChange={(e) => onChange(e.target.files?.[0] || null)} />
      {!file ? (
        <button type="button" className={`btn btn-outline btn-block ${error ? 'invalid' : ''}`} onClick={() => inputRef.current?.click()}>
          <UploadCloud size={16} /> Choose / Browse payment screenshot (JPG, JPEG or PNG)
        </button>
      ) : (
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          {preview && <img src={preview} alt="Payment screenshot preview" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #0002' }} />}
          <div className="stack" style={{ gap: 6 }}>
            <span className="badge b-ok" style={{ width: 'fit-content' }}><CheckCircle2 size={13} /> {file.name}</span>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}>Change</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}><X size={13} /> Remove</button>
            </div>
          </div>
        </div>
      )}
      {error && <span className="err">{error}</span>}
      <p className="hint mt-1">After you pay, upload a screenshot of the confirmation from your UPI or banking app. Payment verification stays pending until our team checks it.</p>
    </div>
  );
}

/** onPay(method, details, screenshotFile) must return a promise; throw to show a failure. */
export default function PaymentForm({ amount, allowCash = true, onPay, label = 'Pay' }) {
  const [method, setMethod] = useState('UPI');
  const [f, setF] = useState({ upiId: '', cardNumber: '', cardName: '', expiry: '', cvv: '', bank: '' });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [preview, setPreview] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const methods = allowCash ? METHODS : METHODS.filter((m) => m.key !== 'Cash on Pickup');
  const isCard = method.includes('Card');
  const needsScreenshot = method !== 'Cash on Pickup';

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const set = (k, fmt) => (e) => { const v = fmt ? fmt(e.target.value) : e.target.value; setF((s) => ({ ...s, [k]: v })); setErrors((er) => ({ ...er, [k]: undefined })); setFailure(''); };
  const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExp = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
  const fmtDigits = (max) => (v) => v.replace(/\D/g, '').slice(0, max);

  const setScreenshotFile = (file) => {
    setErrors((er) => ({ ...er, screenshot: undefined }));
    setUploaded(false);
    if (preview) URL.revokeObjectURL(preview);
    if (!file) { setScreenshot(null); setPreview(''); return; }
    if (!SCREENSHOT_TYPES.includes(file.type)) { setErrors((er) => ({ ...er, screenshot: 'Only JPG, JPEG or PNG images are allowed.' })); return; }
    if (file.size > MAX_SCREENSHOT_MB * 1024 * 1024) { setErrors((er) => ({ ...er, screenshot: `Image must be under ${MAX_SCREENSHOT_MB} MB.` })); return; }
    setScreenshot(file);
    setPreview(URL.createObjectURL(file));
  };
  const removeScreenshot = () => setScreenshotFile(null);

  const validate = () => {
    const e = {};
    if (method === 'UPI' && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(f.upiId.trim())) e.upiId = 'Enter a valid UPI ID, e.g. name@okbank';
    if (isCard) {
      if (f.cardNumber.replace(/\s/g, '').length !== 16) e.cardNumber = 'Enter the 16-digit card number';
      if (!f.cardName.trim()) e.cardName = 'Enter the name on the card';
      const m = f.expiry.match(/^(\d{2})\/(\d{2})$/);
      if (!m || +m[1] < 1 || +m[1] > 12) e.expiry = 'Use MM/YY';
      else if (new Date(2000 + +m[2], +m[1], 0, 23, 59) < new Date()) e.expiry = 'This card has expired';
      if (!/^\d{3,4}$/.test(f.cvv)) e.cvv = '3 or 4 digits';
    }
    if (method === 'Net Banking' && !f.bank) e.bank = 'Choose your bank';
    if (needsScreenshot && !screenshot) e.screenshot = 'Upload your payment screenshot before processing payment.';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true); setFailure('');
    try {
      await onPay(method, { upiId: f.upiId.trim(), cardNumber: f.cardNumber, cardName: f.cardName, expiry: f.expiry, cvv: f.cvv, bank: f.bank }, screenshot);
      if (screenshot) setUploaded(true);
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe);
      setFailure(errMsg(err));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="stack">
      <div className="pay-methods" role="radiogroup" aria-label="Payment method">
        {methods.map(({ key, icon: Icon }) => (
          <button type="button" key={key} role="radio" aria-checked={method === key} className={`pay-method ${method === key ? 'on' : ''}`} onClick={() => { setMethod(key); setErrors({}); setFailure(''); }}>
            <Icon size={20} /><span>{key}</span>
          </button>
        ))}
      </div>

      {needsScreenshot && <PaymentScanner amount={amount} />}

      {method === 'UPI' && (
        <Field label="UPI ID" error={errors.upiId} hint="Demo: any ID like name@okbank works. An ID containing “fail” simulates a declined payment.">
          <input className={`input ${errors.upiId ? 'invalid' : ''}`} value={f.upiId} onChange={set('upiId')} placeholder="name@okbank" autoComplete="off" inputMode="email" />
        </Field>
      )}
      {isCard && (
        <div className="grid grid-2">
          <Field label="Card number" error={errors.cardNumber} className="span-2" hint="Demo: use any 16 digits, e.g. 4242 4242 4242 4242. A number ending 0000 simulates a decline.">
            <input className={`input ${errors.cardNumber ? 'invalid' : ''}`} value={f.cardNumber} onChange={set('cardNumber', fmtCard)} placeholder="4242 4242 4242 4242" inputMode="numeric" autoComplete="off" />
          </Field>
          <Field label="Name on card" error={errors.cardName} className="span-2"><input className={`input ${errors.cardName ? 'invalid' : ''}`} value={f.cardName} onChange={set('cardName')} placeholder="As printed on the card" autoComplete="off" /></Field>
          <Field label="Expiry" error={errors.expiry}><input className={`input ${errors.expiry ? 'invalid' : ''}`} value={f.expiry} onChange={set('expiry', fmtExp)} placeholder="MM/YY" inputMode="numeric" autoComplete="off" /></Field>
          <Field label="CVV" error={errors.cvv}><input className={`input ${errors.cvv ? 'invalid' : ''}`} value={f.cvv} onChange={set('cvv', fmtDigits(4))} placeholder="•••" inputMode="numeric" type="password" autoComplete="off" /></Field>
        </div>
      )}
      {method === 'Net Banking' && (
        <Field label="Select bank" error={errors.bank}>
          <select className={`input ${errors.bank ? 'invalid' : ''}`} value={f.bank} onChange={set('bank')}><option value="">Choose your bank</option>{BANKS.map((b) => <option key={b}>{b}</option>)}</select>
        </Field>
      )}
      {method === 'Cash on Pickup' && <Notice kind="info">Pay <strong>{inr(amount)}</strong> in cash (or by UPI to our staff) when you collect the vehicle. Your booking is confirmed now and the car is held for you.</Notice>}

      {needsScreenshot && (
        <ScreenshotUpload file={screenshot} preview={preview} error={errors.screenshot} onChange={setScreenshotFile} onRemove={removeScreenshot} />
      )}
      {uploaded && <Notice kind="ok" icon={CheckCircle2}>Payment screenshot uploaded successfully — verification is pending review by our team.</Notice>}

      {failure && <Notice kind="bad" icon={AlertCircle}><strong>Payment failed.</strong> {failure}</Notice>}

      <Btn type="submit" loading={busy} className="btn-gold btn-block" icon={ShieldCheck}>
        {method === 'Cash on Pickup' ? 'Confirm booking' : `PROCESS PAYMENT — ${inr(amount)}`}
      </Btn>
      <p className="hint center">Demo mode: payments are simulated. No real money is processed and no card details are stored.</p>
    </form>
  );
}
