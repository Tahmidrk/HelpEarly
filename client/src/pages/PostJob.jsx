import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI, categoriesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { HIDDEN_CATEGORIES } from '../utils/iconMap';
import AddressMap, { addressPlaceholder } from '../components/AddressMap';

const MAX_PHOTOS = 3;

export default function PostJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [photos, setPhotos] = useState([]);       // File objects
  const [previews, setPreviews] = useState([]);
  const previewsRef = useRef([]);
  previewsRef.current = previews;   // Data URLs for preview
  const [form, setForm] = useState({
    category_id: '', title: '', description: '', budget: '',
    location: user?.location || '', preferred_date: '',
  });

  useEffect(() => {
    categoriesAPI.getAll()
      .then(cats => setCategories(cats.filter(c => !HIDDEN_CATEGORIES.includes(c.name))))
      .catch(console.error);
  }, []);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => previewsRef.current.forEach(URL.revokeObjectURL);
  }, []);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;

    const newPreviews = toAdd.map(f => URL.createObjectURL(f));
    setPhotos(prev => [...prev, ...toAdd]);
    setPreviews(prev => [...prev, ...newPreviews]);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removePhoto = (index) => {
    URL.revokeObjectURL(previews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      // Build FormData so we can attach photos
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      photos.forEach(f => fd.append('photos', f));

      await jobsAPI.create(fd);
      navigate('/dashboard');
    } catch (err) { if (err.name !== 'AbortError') alert(err.message); }
    finally { submitting.current = false; setLoading(false); }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="glass-card-static animate-fade-in">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1><i className="fas fa-bullhorn" /> Post a Job</h1>
            <p>Describe what you need and helpers will apply</p>
          </div>

          <form onSubmit={handleSubmit} id="post-job-form">
            <div className="form-group">
              <label>Job Title</label>
              <input type="text" className="form-input" placeholder="e.g., Need deep cleaning for 3-bedroom apartment"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
                <option value="">Select a category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-input" placeholder="Describe the job in detail. Include any specific requirements..."
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Budget (৳)</label>
                <input type="number" className="form-input" placeholder="e.g., 2000"
                  value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} required min="1" />
              </div>
              <div className="form-group">
                <label>Preferred Date</label>
                <input type="date" className="form-input"
                  value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                  min={new Date().toLocaleDateString('en-CA')} required />
              </div>
            </div>
            <div className="form-group">
              <label>Job Address</label>
              <input type="text" className="form-input" placeholder={addressPlaceholder()}
                value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
              <small className="field-help">Use a real address format so helpers can see the area on the map.</small>
            </div>
            <AddressMap address={form.location} label="Job map preview" />

            {/* ── Photo Upload ── */}
            <div className="form-group">
              <label>
                <i className="fas fa-camera" style={{ marginRight: 6, color: 'var(--accent)' }} />
                Problem Photos
                <span className="field-optional-tag">Optional</span>
              </label>
              <p className="field-help" style={{ marginBottom: 10 }}>
                Upload up to {MAX_PHOTOS} photos of the problem so helpers understand the job before applying.
              </p>

              {/* Preview grid */}
              {previews.length > 0 && (
                <div className="photo-preview-grid">
                  {previews.map((src, i) => (
                    <div className="photo-preview-item" key={i}>
                      <img src={src} alt={`Photo ${i + 1}`} />
                      <button
                        type="button"
                        className="photo-remove-btn"
                        onClick={() => removePhoto(i)}
                        aria-label="Remove photo"
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      className="photo-add-more-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <i className="fas fa-plus" />
                      <span>Add more</span>
                    </button>
                  )}
                </div>
              )}

              {/* Upload button (shown when no photos yet) */}
              {previews.length === 0 && (
                <button
                  type="button"
                  className="photo-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  id="post-job-photo-btn"
                >
                  <i className="fas fa-cloud-upload-alt" />
                  <span>Click to upload photos</span>
                  <small>JPG, PNG, WebP — max 5MB each</small>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
                id="post-job-photo-input"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading} id="post-job-submit">
              {loading ? 'Posting...' : 'Post Job'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
