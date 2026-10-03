import { useState } from 'react';
import { BadgeCheck, Save, KeyRound } from 'lucide-react';
import { Btn, Field, Notice, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { userApi, errMsg, fieldErrors } from '../services/api';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: user.name, phone: user.phone, address: user.address || '', licenseNumber: user.license?.number || '', licenseExpiry: user.license?.expiry ? user.license.expiry.slice(0, 10) : '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErr, setPwErr] = useState({});
  const [pwBusy, setPwBusy] = useState(false);

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); };

  const save = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.name.trim().length < 2) er.name = 'Enter your full name';
    if (!/^[6-9]\d{9}$/.test(f.phone.trim())) er.phone = 'Enter a valid 10-digit mobile number';
    if (f.licenseNumber && !/^[A-Za-z0-9][A-Za-z0-9\s\-/]{6,19}$/.test(f.licenseNumber.trim())) er.licenseNumber = 'Enter a valid driving licence number';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { const r = await userApi.updateProfile({ name: f.name.trim(), phone: f.phone.trim(), address: f.address.trim(), licenseNumber: f.licenseNumber.trim(), licenseExpiry: f.licenseExpiry || '' }); setUser(r.user); toast.success('Profile updated.'); }
    catch (x) { setErrors(fieldErrors(x)); toast.error(errMsg(x)); } finally { setBusy(false); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    const er = {};
    if (!pw.currentPassword) er.currentPassword = 'Enter your current password';
    if (pw.newPassword.length < 8 || !/[A-Za-z]/.test(pw.newPassword) || !/\d/.test(pw.newPassword)) er.newPassword = 'Use at least 8 characters with a letter and a number';
    if (pw.confirm !== pw.newPassword) er.confirm = 'Passwords do not match';
    setPwErr(er);
    if (Object.keys(er).length) return;
    setPwBusy(true);
    try { await userApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }); setPw({ currentPassword: '', newPassword: '', confirm: '' }); toast.success('Password updated.'); }
    catch (x) { setPwErr(fieldErrors(x)); toast.error(errMsg(x)); } finally { setPwBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow="My account" title="Profile" />
      <div className="container section-tight">
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <form className="card card-gold stack" onSubmit={save} noValidate>
            <h3>Personal details &amp; licence</h3>
            <Field label="Full name" error={errors.name}><input className={`input ${errors.name ? 'invalid' : ''}`} value={f.name} onChange={set('name')} /></Field>
            <Field label="Email" hint="Your email is your login and can't be changed here."><input className="input" value={user.email} disabled /></Field>
            <Field label="Phone" error={errors.phone}><input className={`input ${errors.phone ? 'invalid' : ''}`} value={f.phone} onChange={set('phone')} maxLength={10} inputMode="tel" /></Field>
            <Field label="Address"><textarea className="input" value={f.address} onChange={set('address')} maxLength={300} /></Field>
            <div className="grid grid-2">
              <Field label="Driving licence number" error={errors.licenseNumber}><input className={`input ${errors.licenseNumber ? 'invalid' : ''}`} value={f.licenseNumber} onChange={set('licenseNumber')} style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Licence expiry"><input className="input" type="date" value={f.licenseExpiry} onChange={set('licenseExpiry')} /></Field>
            </div>
            {user.license?.number && (user.license.verified ? <span className="badge b-ok"><BadgeCheck size={13} /> Licence verified by SSB</span> : <Notice kind="info">Your licence will be verified against the original at pickup.</Notice>)}
            <Btn type="submit" loading={busy} icon={Save}>Save changes</Btn>
          </form>
          <form className="card stack" onSubmit={changePw} noValidate>
            <h3>Change password</h3>
            <Field label="Current password" error={pwErr.currentPassword}><input className={`input ${pwErr.currentPassword ? 'invalid' : ''}`} type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
            <Field label="New password" error={pwErr.newPassword}><input className={`input ${pwErr.newPassword ? 'invalid' : ''}`} type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Confirm new password" error={pwErr.confirm}><input className={`input ${pwErr.confirm ? 'invalid' : ''}`} type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
            <Btn type="submit" loading={pwBusy} className="btn-outline" icon={KeyRound}>Update password</Btn>
          </form>
        </div>
      </div>
    </>
  );
}
