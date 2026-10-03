import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Btn, Field, Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg, fieldErrors } from '../services/api';

const DEMO = [['Customer', 'customer@ssbcarrentals.demo', 'Customer@123'], ['Admin', 'admin@ssbcarrentals.demo', 'Admin@123'], ['Staff', 'staff@ssbcarrentals.demo', 'Staff@123']];

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = 'Enter a valid email address';
    if (!f.password) er.password = 'Enter your password';
    setErrors(er); setError('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const u = await login(f.email.trim(), f.password);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`);
      navigate(state?.from || (u.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) { setErrors(fieldErrors(err)); setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <form className="card card-gold auth-card" onSubmit={submit} noValidate>
        <span className="eyebrow">Welcome back</span>
        <h2>Sign in</h2>
        {state?.from && <Notice kind="info">Please sign in to continue.</Notice>}
        {error && <Notice kind="bad">{error}</Notice>}
        <Field label="Email" error={errors.email}><input className={`input ${errors.email ? 'invalid' : ''}`} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" autoFocus /></Field>
        <Field label="Password" error={errors.password}>
          <div className="pw"><input className={`input ${errors.password ? 'invalid' : ''}`} type={show ? 'text' : 'password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        </Field>
        <div className="row between"><Link to="/forgot-password" className="gold" style={{ fontSize: '.9rem' }}>Forgot password?</Link></div>
        <Btn type="submit" loading={busy} className="btn-gold btn-block" icon={LogIn}>Sign in</Btn>
        <p className="center muted" style={{ margin: 0 }}>New to SSB? <Link to="/register" className="gold">Create an account</Link></p>
        {import.meta.env.DEV && (
          <div className="demo-box"><small className="muted">Dev only — fill demo credentials (run <code>npm run seed</code> first):</small>
            <div className="row-wrap mt-1">{DEMO.map(([l, e, p]) => <button key={l} type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ email: e, password: p })}>{l}</button>)}</div></div>
        )}
      </form>
    </div>
  );
}
