import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { categoriesAPI } from '../utils/api';
import { getCategoryIcon, HIDDEN_CATEGORIES } from '../utils/iconMap';
import AddressMap, { addressPlaceholder } from '../components/AddressMap';

export default function Register() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('household');
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', phone: '',
    location: '', bio: '', hourly_rate: '', experience_years: '',
  });
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    categoriesAPI.getAll()
      .then(cats => setCategories(cats.filter(c => !HIDDEN_CATEGORIES.includes(c.name))))
      .catch(console.error);
  }, []);

  const updateField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const toggleCategory = (catId) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (role === 'helper' && selectedCategories.length === 0) {
      return setError('Please select at least one work category');
    }

    setLoading(true);
    try {
      const payload = { ...form, role, selectedCategories };
      delete payload.confirmPassword;
      const user = await register(payload);
      if (user.role === 'helper') navigate('/helper/dashboard');
      else navigate('/helpers');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="container">
        <div className="auth-container animate-fade-in">
          <div className="auth-card glass-card-static" style={{ maxWidth: 520 }}>
            <div className="auth-header">
              <span className="auth-icon"><i className="fas fa-user-plus"></i></span>
              <h1>Join At Your Service</h1>
              <p>Create your free account</p>
            </div>

            {/* Role Selection */}
            <div className="role-selector">
              <button
                className={`role-option ${role === 'household' ? 'active' : ''}`}
                onClick={() => { setRole('household'); setStep(1); }}
                type="button"
                id="role-household"
              >
                <span className="role-icon"><i className="fas fa-home"></i></span>
                <span>Household</span>
                <small>I need help</small>
              </button>
              <button
                className={`role-option ${role === 'helper' ? 'active' : ''}`}
                onClick={() => { setRole('helper'); setStep(1); }}
                type="button"
                id="role-helper"
              >
                <span className="role-icon"><i className="fas fa-wrench"></i></span>
                <span>Helper</span>
                <small>I provide services</small>
              </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} id="register-form">
              {step === 1 && (
                <div className="animate-fade-in">
                  <div className="form-group">
                    <label htmlFor="reg-name">Full Name</label>
                    <input type="text" id="reg-name" className="form-input" placeholder="Your full name" value={form.name} onChange={updateField('name')} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-email">Email Address</label>
                    <input type="email" id="reg-email" className="form-input" placeholder="your@email.com" value={form.email} onChange={updateField('email')} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-password">Password</label>
                    <input type="password" id="reg-password" className="form-input" placeholder="Minimum 6 characters" value={form.password} onChange={updateField('password')} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-confirm">Confirm Password</label>
                    <input type="password" id="reg-confirm" className="form-input" placeholder="Confirm your password" value={form.confirmPassword} onChange={updateField('confirmPassword')} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-phone">Phone Number</label>
                    <input type="tel" id="reg-phone" className="form-input" placeholder="01XXXXXXXXX" value={form.phone} onChange={updateField('phone')} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-nid">
                      NID Card Number <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>(Required for Security)</span>
                    </label>
                    <input type="text" id="reg-nid" className="form-input" placeholder="e.g., 19982691234500123" value={form.nid_number || ''} onChange={updateField('nid_number')} required />
                    <small className="field-help">Your NID is securely stored for platform safety & verification.</small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-location">Address / Location</label>
                    <input type="text" id="reg-location" className="form-input" placeholder={addressPlaceholder()} value={form.location} onChange={updateField('location')} />
                    <small className="field-help">Include house/flat number, road, block, area, and city.</small>
                  </div>
                  <AddressMap address={form.location} label="Map preview" />

                  {role === 'helper' ? (
                    <button type="button" className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => setStep(2)}>
                      Next: Professional Details <i className="fas fa-arrow-right"></i>
                    </button>
                  ) : (
                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading} id="register-submit">
                      {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                  )}
                </div>
              )}

              {step === 2 && role === 'helper' && (
                <div className="animate-fade-in">
                  <div className="form-group">
                    <label>Select Your Work Categories <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>(at least one required)</span></label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`role-option ${selectedCategories.includes(cat.id) ? 'active' : ''}`}
                          onClick={() => toggleCategory(cat.id)}
                          style={{ padding: '10px 8px', fontSize: '0.85rem' }}
                        >
                          <i className={getCategoryIcon(cat.name)}></i>
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-bio">Bio / About You</label>
                    <textarea id="reg-bio" className="form-input" placeholder="Tell households about your skills and experience..." value={form.bio} onChange={updateField('bio')} rows={3} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="reg-rate">Hourly Rate (৳)</label>
                      <input type="number" id="reg-rate" className="form-input" placeholder="e.g., 500" value={form.hourly_rate} onChange={updateField('hourly_rate')} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="reg-exp">Years of Experience</label>
                      <input type="number" id="reg-exp" className="form-input" placeholder="e.g., 3" value={form.experience_years} onChange={updateField('experience_years')} />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}><i className="fas fa-arrow-left"></i> Back</button>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} id="register-submit" style={{ flex: 1 }}>
                      {loading ? 'Creating account...' : 'Create Helper Account'}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <p className="auth-footer-text">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
