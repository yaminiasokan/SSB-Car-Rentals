import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Btn, Field, Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg, fieldErrors } from '../services/api';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.name.trim().length < 2) er.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = 'Enter a valid email address';
    if (!/^[6-9]\d{9}$/.test(f.phone.trim())) er.phone = 'Enter a valid 10-digit mobile number';
    if (f.password.length < 8) er.password = 'Use at least 8 characters';
    else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) er.password = 'Include at least one letter and one number';
    if (f.confirm !== f.password) er.confirm = 'Passwords do not match';
    setErrors(er); setError('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const u = await register({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password });
      toast.success(`Welcome to SSB Car Rentals, ${u.name.split(' ')[0]}!`);
      navigate('/dashboard', { replace: true });
    } catch (err) { setErrors(fieldErrors(err)); setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <form className="card card-gold auth-card" onSubmit={submit} noValidate>
        <span className="eyebrow">Join SSB</span>
        <h2>Create account</h2>
        {error && <Notice kind="bad">{error}</Notice>}
        <Field label="Full name" error={errors.name}><input className={`input ${errors.name ? 'invalid' : ''}`} value={f.name} onChange={set('name')} autoComplete="name" autoFocus /></Field>
        <Field label="Email" error={errors.email}><input className={`input ${errors.email ? 'invalid' : ''}`} type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        <Field label="Mobile number" error={errors.phone}><input className={`input ${errors.phone ? 'invalid' : ''}`} value={f.phone} onChange={set('phone')} inputMode="tel" maxLength={10} autoComplete="tel" /></Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters with a letter and a number."><input className={`input ${errors.password ? 'invalid' : ''}`} type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Field label="Confirm password" error={errors.confirm}><input className={`input ${errors.confirm ? 'invalid' : ''}`} type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
        <Btn type="submit" loading={busy} className="btn-gold btn-block" icon={UserPlus}>Create account</Btn>
        <p className="center muted" style={{ margin: 0 }}>Already registered? <Link to="/login" className="gold">Sign in</Link></p>
      </form>
    </div>
  );
}
