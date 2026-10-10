import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { jobsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCategoryIcon } from '../utils/iconMap';
import AddressMap from '../components/AddressMap';
import ProfileLink from '../components/ProfileLink';
import PhotoGallery from '../components/PhotoGallery';

import { useSync } from '../context/SyncContext';

export default function JobDetail() {
  const revision = useSync("jobs");
  const { id } = useParams();
  const { user, activeRole } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [appForm, setAppForm] = useState({ cover_message: '', proposed_price: '' });
  const [showApplyForm, setShowApplyForm] = useState(false);

  useEffect(() => {
    setLoading(true);
    setErrorMessage('');
    jobsAPI.getOne(id)
      .then(setJob)
      .catch((error) => { console.error(error); setJob(null); setErrorMessage(error.message); })
      .finally(() => setLoading(false));
  }, [id, revision]);

  const handleApply = async (e) => {
    e.preventDefault();
    setApplying(true);
    try {
      await jobsAPI.apply(id, appForm);
      const updated = await jobsAPI.getOne(id);
      setJob(updated);
      setShowApplyForm(false);
      alert('Application submitted!');
    } catch (err) { alert(err.message); }
    finally { setApplying(false); }
  };

  const handleAppAction = async (appId, status) => {
    try {
      await jobsAPI.updateApplication(appId, { status });
      const updated = await jobsAPI.getOne(id);
      setJob(updated);
    } catch (err) { alert(err.message); }
  };

  if (loading) return <LoadingSpinner />;
  if (!job) return <div className="page"><div className="container"><div className="empty-state"><h3>{errorMessage || 'Job not found'}</h3></div></div></div>;

  const isOwner = user?.id === job.user_id;
  const role = user?.role === 'both' ? activeRole : user?.role;
  const hasApplied = Boolean(job.viewer_application);

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="glass-card-static animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: 8 }}><i className={getCategoryIcon(job.category_name)}></i> {job.category_name}</span>
              <h1 style={{ fontSize: '1.8rem' }}>{job.title}</h1>
              <p className="text-secondary">
                Posted by{' '}
                <ProfileLink userId={job.poster_id || job.user_id} role="household" name={job.poster_name} />
                {' '}· {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`badge ${job.status === 'open' ? 'badge-success' : 'badge-warning'}`}>{job.status}</span>
          </div>

          <p style={{ marginBottom: 24, lineHeight: 1.8 }}>{job.description}</p>

          <div className="booking-item-details" style={{ marginBottom: 24 }}>
            <span><i className="fas fa-money-bill-wave"></i> Budget: ৳{job.budget || 'Negotiable'}</span>
            <span><i className="fas fa-map-marker-alt"></i> {job.location}</span>
            {job.preferred_date && <span><i className="fas fa-calendar"></i> Preferred: {new Date(job.preferred_date).toLocaleDateString()}</span>}
          </div>
          <PhotoGallery photos={job.photos} />
          <AddressMap address={job.location} label="Job map" />

          {role === 'helper' && !isOwner && job.status === 'open' && (
            <div style={{ marginBottom: 24 }}>
              {hasApplied ? (
                <div className="glass-card-static" style={{ background: 'var(--bg-tertiary)' }}>
                  <h3 style={{ marginBottom: 8 }}>Application Submitted</h3>
                  <p className="text-secondary">Status: <strong style={{ color: 'var(--text-primary)' }}>{job.viewer_application.status}</strong></p>
                </div>
              ) : !showApplyForm ? (
                <button className="btn btn-primary btn-lg" onClick={() => setShowApplyForm(true)}><i className="fas fa-file-alt"></i> Apply for this Job</button>
              ) : (
                <form onSubmit={handleApply} className="animate-fade-in" style={{ background: 'var(--bg-tertiary)', padding: 24, borderRadius: 'var(--radius-md)' }}>
                  <h3 style={{ marginBottom: 16 }}>Submit Application</h3>
                  <div className="form-group">
                    <label>Your Proposed Price (৳)</label>
                    <input type="number" className="form-input" placeholder="e.g., 1500" value={appForm.proposed_price}
                      onChange={(e) => setAppForm({ ...appForm, proposed_price: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Cover Message</label>
                    <textarea className="form-input" placeholder="Tell the client why you're a great fit..." value={appForm.cover_message}
                      onChange={(e) => setAppForm({ ...appForm, cover_message: e.target.value })} rows={3} required />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={applying}>{applying ? 'Submitting...' : 'Submit Application'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowApplyForm(false)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {!user && (<p className="text-secondary" style={{ marginBottom: 16 }}><a href="/login">Login</a> as a helper to apply for this job.</p>)}
        </div>

        {isOwner && role === 'household' && job.applications && job.applications.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ marginBottom: 16 }}>Applications ({job.applications.length})</h2>
            <div className="stagger-children">
              {job.applications.map(app => (
                <div key={app.id} className="booking-item glass-card">
                  <div className="booking-item-header">
                    <div className="booking-item-info">
                      <h3>
                        <ProfileLink
                          userId={app.helper_user_id}
                          helperId={app.helper_id}
                          role="helper"
                          name={app.helper_name}
                        />
                      </h3>
                      <p className="text-secondary"><i className="fas fa-star" style={{ color: '#f59e0b' }}></i> {Number(app.total_reviews) > 0 ? `${Number(app.avg_rating).toFixed(1)} · ${app.total_reviews} reviews` : 'Not rated yet'}</p>
                    </div>
                    <span className={`badge ${app.status === 'accepted' ? 'badge-success' : app.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{app.status}</span>
                  </div>
                  <p style={{ margin: '8px 0' }}>{app.cover_message}</p>
                  <div className="booking-item-details">
                    <span><i className="fas fa-money-bill-wave"></i> Proposed: ৳{app.proposed_price}</span>
                    <span><i className="fas fa-calendar"></i> Applied: {new Date(app.created_at).toLocaleDateString()}</span>
                  </div>
                  {app.status === 'pending' && (
                    <div className="booking-item-actions" style={{ marginTop: 8 }}>
                      <button className="btn btn-success btn-sm" onClick={() => handleAppAction(app.id, 'accepted')}><i className="fas fa-check"></i> Accept</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleAppAction(app.id, 'rejected')}><i className="fas fa-times"></i> Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
