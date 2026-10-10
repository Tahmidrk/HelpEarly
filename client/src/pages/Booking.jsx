import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { helpersAPI, bookingsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AddressMap, { addressPlaceholder } from '../components/AddressMap';
import ProfileLink from '../components/ProfileLink';

const MAX_PHOTOS = 3;

export default function Booking() {
  const { helperId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [helper, setHelper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const selectedServiceId = searchParams.get('service');

  const [form, setForm] = useState({
    service_id: selectedServiceId || '',
    booking_date: '',
    booking_time: '10:00',
    service_description: '',
    offered_fee: '',
    notes: '',
    address: user?.location || '',
  });

  useEffect(() => {
    helpersAPI.getOne(helperId)
      .then((data) => {
        setHelper(data);
        if (selectedServiceId) setForm(prev => ({ ...prev, service_id: selectedServiceId }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [helperId]);

  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL);
  }, [previews]);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    const toAdd = files.slice(0, MAX_PHOTOS - photos.length);
    if (!toAdd.length) return;
    setPhotos(prev => [...prev, ...toAdd]);
    setPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removePhoto = (i) => {
    URL.revokeObjectURL(previews[i]);
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const selectedService = helper?.services?.find(s => String(s.id) === String(form.service_id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('helper_id', parseInt(helperId));
      if (form.service_id) fd.append('service_id', parseInt(form.service_id));
      fd.append('booking_date', `${form.booking_date}T${form.booking_time}:00`);
      fd.append('service_description', form.service_description.trim());
      if (form.notes) fd.append('notes', form.notes);
      fd.append('total_price', form.offered_fee);
      fd.append('address', form.address);
      photos.forEach(f => fd.append('photos', f));

      await bookingsAPI.create(fd);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!helper) return <div className="page"><div className="container"><div className="empty-state"><h3>Helper not found</h3></div></div></div>;

  if (success) {
    return (
      <div className="page">
        <div className="container">
          <div className="success-card glass-card-static animate-scale-in" style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
            <span style={{ fontSize: '4rem', display: 'block', marginBottom: 16, color: 'var(--success)' }}><i className="fas fa-check-circle"></i></span>
            <h2>Booking Submitted!</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
              Your booking request has been sent to{' '}
              <ProfileLink userId={helper.user_id} helperId={helper.id} role="helper" name={helper.name} />.
              You'll be notified when they confirm.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>My Bookings</button>
              <button className="btn btn-secondary" onClick={() => navigate('/helpers')}>Browse More</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="booking-layout animate-fade-in">
          {/* Booking Form */}
          <div className="booking-form-card glass-card-static">
            <h1><i className="fas fa-calendar-plus"></i> Book a Service</h1>
            <p className="text-secondary">
              Fill in the details to book{' '}
              <ProfileLink userId={helper.user_id} helperId={helper.id} role="helper" name={helper.name} />
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} id="booking-form">
              <div className="form-group">
                <label htmlFor="booking-service">Service</label>
                <select id="booking-service" className="form-input" value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
                  <option value="">-- Select a service --</option>
                  {(helper.services || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.service_name} - ৳{s.price}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="booking-description">Services You Need</label>
                <textarea id="booking-description" className="form-input" placeholder="Describe exactly what you need done"
                  value={form.service_description} onChange={(e) => setForm({ ...form, service_description: e.target.value })} rows={4} required />
              </div>

              <div className="form-group">
                <label htmlFor="booking-offer">Your Offered Fee (৳)</label>
                <input type="number" id="booking-offer" className="form-input" min="1" step="0.01" placeholder="Enter your offer"
                  value={form.offered_fee} onChange={(e) => setForm({ ...form, offered_fee: e.target.value })} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="booking-date">
                    <i className="fas fa-calendar-alt" style={{ marginRight: 6, color: 'var(--accent)' }} />
                    Schedule Date
                  </label>
                  <input type="date" id="booking-date" className="form-input" value={form.booking_date}
                    onChange={(e) => setForm({ ...form, booking_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]} required />
                  <small className="field-help">Book today or schedule days/weeks in advance.</small>
                </div>
                <div className="form-group">
                  <label htmlFor="booking-time">
                    <i className="fas fa-clock" style={{ marginRight: 6, color: 'var(--accent)' }} />
                    Preferred Time
                  </label>
                  <input type="time" id="booking-time" className="form-input" value={form.booking_time}
                    onChange={(e) => setForm({ ...form, booking_time: e.target.value })} required />
                  <small className="field-help">Select arrival time slot.</small>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="booking-address">Full Service Address</label>
                <input type="text" id="booking-address" className="form-input" placeholder={addressPlaceholder()}
                  value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                <small className="field-help">Include house/flat number, road, block, area, and city.</small>
              </div>

              <AddressMap address={form.address} />

              <div className="form-group">
                <label htmlFor="booking-notes">Notes (Optional)</label>
                <textarea id="booking-notes" className="form-input" placeholder="Any special instructions..."
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>

              {/* ── Photo Attachment ── */}
              <div className="form-group">
                <label>
                  <i className="fas fa-camera" style={{ marginRight: 6, color: 'var(--accent)' }} />
                  Attach Photos
                  <span className="field-optional-tag">Optional</span>
                </label>
                <p className="field-help" style={{ marginBottom: 10 }}>
                  Share photos of the problem so the helper knows what to expect.
                </p>
                {previews.length > 0 && (
                  <div className="photo-preview-grid">
                    {previews.map((src, i) => (
                      <div className="photo-preview-item" key={i}>
                        <img src={src} alt={`Attachment ${i + 1}`} />
                        <button type="button" className="photo-remove-btn" onClick={() => removePhoto(i)} aria-label="Remove">
                          <i className="fas fa-times" />
                        </button>
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <button type="button" className="photo-add-more-btn" onClick={() => fileInputRef.current?.click()}>
                        <i className="fas fa-plus" /><span>Add more</span>
                      </button>
                    )}
                  </div>
                )}
                {previews.length === 0 && (
                  <button type="button" className="photo-upload-btn" onClick={() => fileInputRef.current?.click()} id="booking-photo-btn">
                    <i className="fas fa-cloud-upload-alt" />
                    <span>Attach photos</span>
                    <small>JPG, PNG, WebP — max 5MB each</small>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  multiple style={{ display: 'none' }} onChange={handlePhotoChange} id="booking-photo-input" />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={submitting} id="booking-submit">
                {submitting ? 'Submitting...' : 'Confirm Booking'}
              </button>
            </form>
          </div>

          {/* Summary Sidebar */}
          <div className="booking-summary glass-card-static">
            <h3>Booking Summary</h3>
            <div className="summary-helper">
              <div className="avatar avatar-lg avatar-placeholder">{helper.name?.charAt(0)}</div>
              <div>
                <p className="summary-name">
                  <ProfileLink userId={helper.user_id} helperId={helper.id} role="helper" name={helper.name} />
                </p>
                <p className="text-secondary"><i className="fas fa-map-marker-alt"></i> {helper.location}</p>
              </div>
            </div>
            <div className="summary-details">
              {selectedService && (
                <div className="summary-row">
                  <span>Service</span>
                  <span>{selectedService.service_name}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Date</span>
                <span>{form.booking_date || 'Not selected'}</span>
              </div>
              <div className="summary-row">
                <span>Time</span>
                <span>{form.booking_time}</span>
              </div>
              <div className="summary-divider"></div>
              {form.address && (
                <div className="summary-row" style={{ display: 'block' }}>
                  <span>Address</span>
                  <p style={{ color: 'var(--text-primary)', marginTop: 4 }}>{form.address}</p>
                </div>
              )}
              <div className="summary-row total">
                <span>Your Offer</span>
                <span>{form.offered_fee ? `৳${form.offered_fee}` : 'Not entered'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
