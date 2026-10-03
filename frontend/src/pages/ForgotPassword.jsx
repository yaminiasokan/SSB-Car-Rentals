import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Btn, Field, Notice } from '../components/ui';
import { authApi, errMsg, fieldErrors } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Enter a valid email address'); return; }
    setErr(''); setError(''); setBusy(true);
    try { setDone(await authApi.forgot({ email: email.trim() })); } catch (x) { setErr(fieldErrors(x).email || ''); setError(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <form className="card card-gold auth-card" onSubmit={submit} noValidate>
        <span className="eyebrow">Account recovery</span>
        <h2>Forgot password</h2>
        {done ? (
          <>
            <Notice kind="ok">{done.message}</Notice>
            {done.demoResetUrl && <Notice kind="info">Demo mode: no email is sent. <a className="gold" href={done.demoResetUrl}>Open your reset link</a>.</Notice>}
          </>
        ) : (
          <>
            <p className="muted">Enter your account email and we'll send a link to reset your password. The link is valid for 30 minutes.</p>
            {error && <Notice kind="bad">{error}</Notice>}
            <Field label="Email" error={err}><input className={`input ${err ? 'invalid' : ''}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus /></Field>
            <Btn type="submit" loading={busy} className="btn-gold btn-block" icon={Mail}>Send reset link</Btn>
          </>
        )}
        <p className="center muted" style={{ margin: 0 }}><Link to="/login" className="gold">Back to sign in</Link></p>
      </form>
    </div>
  );
}
