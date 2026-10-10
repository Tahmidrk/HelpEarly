import { useEffect, useState } from 'react';
import { categoriesAPI, helpersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

export default function WorkerSettings() {
  const { updateUser } = useAuth();
  const revision = useSync('helpers', 'profile', 'categories');
  const [profile, setProfile] = useState(null), [categories, setCategories] = useState([]), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    Promise.all([helpersAPI.getMyProfile(), categoriesAPI.getAll()]).then(([p, c]) => {
      if (!disposed) { setProfile(p); setCategories(c); setError(''); }
    }).catch(err => { if (!disposed) setError(err.message); });
    return () => { disposed = true; };
  }, [revision, retry]);
  const start = () => setForm({ category: profile.primary_category || '', bio: profile.bio || '', hourly_rate: profile.hourly_rate || 0, experience_years: profile.experience_years || 0, services: (profile.services || []).map(s => ({ id: s.id, service_name: s.service_name, price: s.price })) });
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const updated = await helpersAPI.saveSettings({ ...form, hourly_rate: Number(form.hourly_rate), experience_years: Number(form.experience_years), services: form.services.map(s => ({ ...s, price: Number(s.price) })) });
      updateUser(updated); setProfile(updated.helperProfile); setForm(null);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const service = (index, key, value) => setForm(previous => ({ ...previous, services: previous.services.map((s, i) => i === index ? { ...s, [key]: value } : s) }));
  return <div className="glass-card-static parity-card">
    <h3>Worker category and service prices</h3>
    {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {!form ? <><p className="text-secondary">Category: {profile?.primary_category || 'Not set'}</p><button className="btn btn-secondary btn-sm" disabled={!profile} onClick={start}>Edit category and services</button></> : <form onSubmit={save}>
      <div className="form-group"><label htmlFor="worker-category">Primary category</label><select id="worker-category" className="form-input" required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="">Choose your trade</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select><small className="field-help">Saving assigns these services to your selected primary category.</small></div>
      <div className="form-group"><label htmlFor="worker-bio">Bio</label><textarea id="worker-bio" className="form-input" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></div>
      <div className="form-row"><label>Hourly rate (৳)<input className="form-input" type="number" min="0" step="0.01" required value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: e.target.value })} /></label><label>Experience (years)<input className="form-input" type="number" min="0" step="1" required value={form.experience_years} onChange={e => setForm({ ...form, experience_years: e.target.value })} /></label></div>
      {form.services.map((s, index) => <div className="parity-row parity-actions" key={s.id || `new-${index}`}>
        <label>Service name<input className="form-input" maxLength={100} required value={s.service_name} onChange={e => service(index, 'service_name', e.target.value)} /></label>
        <label>Price (৳)<input className="form-input" type="number" min="0" step="0.01" required value={s.price} onChange={e => service(index, 'price', e.target.value)} /></label>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setForm({ ...form, services: form.services.filter((_, i) => i !== index) })}>Remove service {index + 1}</button>
      </div>)}
      <div className="parity-row parity-actions"><button type="button" className="btn btn-secondary btn-sm" disabled={form.services.length >= 100} onClick={() => setForm({ ...form, services: [...form.services, { service_name: '', price: '' }] })}>Add service</button><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save worker settings'}</button><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setForm(null)}>Cancel</button></div>
    </form>}
  </div>;
}
