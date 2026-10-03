import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { Btn, Field, Notice } from '../components/ui';
import { authApi, errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ResetPassword() {
  const { token } = useParams();
  const { accept } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) er.password = 'Use at least 8 characters with a letter and a number';
    if (f.confirm !== f.password) er.confirm = 'Passwords do not match';
    setErrors(er); setError('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try { accept(await authApi.reset(token, { password: f.password })); toast.success('Password updated. You are signed in.'); navigate('/dashboard', { replace: true }); }
    catch (x) { setError(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <form className="card card-gold auth-card" onSubmit={submit} noValidate>
        <span className="eyebrow">Account recovery</span>
        <h2>Reset password</h2>
        {error && <Notice kind="bad">{error} <Link to="/forgot-password" className="gold">Request a new link</Link></Notice>}
        <Field label="New password" error={errors.password}><input className={`input ${errors.password ? 'invalid' : ''}`} type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" autoFocus /></Field>
        <Field label="Confirm new password" error={errors.confirm}><input className={`input ${errors.confirm ? 'invalid' : ''}`} type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" /></Field>
        <Btn type="submit" loading={busy} className="btn-gold btn-block" icon={KeyRound}>Update password</Btn>
      </form>
    </div>
  );
}
