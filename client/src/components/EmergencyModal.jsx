import { useState, useEffect } from 'react';
import { categoriesAPI, emergencyAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { HIDDEN_CATEGORIES } from '../utils/iconMap';
import { Link } from 'react-router-dom';

export default function EmergencyModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [helpersCount, setHelpersCount] = useState(0);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    category_id: '',
    category_name: '',
    location: user?.location || '',
    contact_phone: user?.phone || '',
  });

  useEffect(() => {
    if (isOpen) {
      setSent(false);
      setError('');
      setForm(previous => ({ ...previous, location: user?.location || '', contact_phone: user?.phone || '' }));
      categoriesAPI.getAll()
        .then(cats => setCategories(cats.filter(c => !HIDDEN_CATEGORIES.includes(c.name))))
        .catch(err => setError(err.message));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    const cat = categories.find(c => String(c.id) === String(catId));
    setForm({ ...form, category_id: catId, category_name: cat ? cat.name : '' });
  };

  const handleNotify = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await emergencyAPI.notify(form);
      setHelpersCount(res.helpersNotified || 0);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 9999 }}>
      <div className="modal-content glass-card-static" style={{ maxWidth: 420, width: '90%', borderTop: '4px solid var(--danger)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '1.25rem' }}>
            <i className="fas fa-ambulance animate-pulse" /> Emergency Service
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="fas fa-times" /></button>
        </div>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {sent ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <span style={{ fontSize: '3rem', color: 'var(--success)', display: 'block', marginBottom: 8 }}>
              <i className="fas fa-check-circle" />
            </span>
            <h3>Alert Broadcasted!</h3>
            <p className="text-secondary" style={{ margin: '8px 0 16px', fontSize: '0.9rem' }}>
              Sent to <strong>{helpersCount}</strong> local worker{helpersCount !== 1 ? 's' : ''} with your phone number and location. Free workers will call your SIM directly.
            </p>
            <Link to="/emergency" className="btn btn-secondary" onClick={onClose}>Track request</Link>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleNotify}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 600 }}>Required Service</label>
              <select className="form-input" value={form.category_id} onChange={handleCategoryChange} required>
                <option value="">Select Service (e.g. Cleaning, Plumbing)</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 600 }}>Your Location</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. House 12, Road 4, Dhanmondi, Dhaka"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="emergency-phone">Contact phone</label>
              <input id="emergency-phone" className="form-input" type="tel" maxLength={50} required value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
            <button
              type="submit"
              className="btn btn-danger"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold' }}
              disabled={loading}
            >
              {loading ? 'Sending Alert...' : <><i className="fas fa-paper-plane" /> SEND ALERT</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
