import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { helpersAPI, bookingsAPI, jobsAPI, categoriesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCategoryIcon, HIDDEN_CATEGORIES } from '../utils/iconMap';
import AddressMap from '../components/AddressMap';
import ComplaintPanel from '../components/ComplaintPanel';
import ProfileLink from '../components/ProfileLink';

import { useSync } from '../context/SyncContext';

export default function HelperDashboard() {
  const revision = useSync("bookings","jobs","helpers","profile","categories");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('bookings');
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshError,setRefreshError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [newService, setNewService] = useState({ category_id: '', service_name: '', description: '', price: '' });
  const [showAddService, setShowAddService] = useState(false);

  useEffect(() => {
    Promise.all([
      helpersAPI.getMyProfile(),
      bookingsAPI.getAll(),
      jobsAPI.getMyApplications(),
      categoriesAPI.getAll(),
    ]).then(([p, b, a, c]) => {
      setProfile(p);
      setBookings(b);
      setApplications(a);
      setCategories(c.filter(cat => !HIDDEN_CATEGORIES.includes(cat.name)));
      if (p && !editMode) setEditForm({ bio: p.bio || '', hourly_rate: p.hourly_rate || 0, is_available: p.is_available, experience_years: p.experience_years || 0 });
      setRefreshError('');
    }).catch(error=>setRefreshError(error.message)).finally(() => setLoading(false));
  }, [revision]);

  const handleUpdateProfile = async () => {
    try {
      await helpersAPI.update(editForm);
      setProfile({ ...profile, ...editForm });
      setEditMode(false);
    } catch (err) { alert(err.message); }
  };

  const handleBookingAction = async (id, status) => {
    try {
      await bookingsAPI.update(id, { status });
      setBookings(bookings.map(b => b.id === id ? { ...b, status } : b));
    } catch (err) { alert(err.message); }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      const result = await helpersAPI.addService(newService);
      setProfile({ ...profile, services: [...(profile.services || []), result] });
      setNewService({ category_id: '', service_name: '', description: '', price: '' });
      setShowAddService(false);
    } catch (err) { alert(err.message); }
  };

  const handleDeleteService = async (serviceId) => {
    if (!confirm('Delete this service?')) return;
    try {
      await helpersAPI.deleteService(serviceId);
      setProfile({ ...profile, services: profile.services.filter(s => s.id !== serviceId) });
    } catch (err) { alert(err.message); }
  };

  const statusBadge = (status) => {
    const map = { pending: 'badge-warning', confirmed: 'badge-info', in_progress: 'badge-primary', completed: 'badge-success', cancelled: 'badge-danger', accepted: 'badge-success', rejected: 'badge-danger' };
    return <span className={`badge ${map[status] || 'badge-primary'}`}>{status}</span>;
  };

  if (loading) return <LoadingSpinner />;

  const earnings = bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

  return (
    <div className="page">
      <div className="container">
        {refreshError && <p role="alert">Could not refresh: {refreshError}. Retrying; previous records remain visible.</p>}
        <div className="page-header animate-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Helper Dashboard <i className="fas fa-wrench"></i></h1>
            <p>Manage your services, bookings and applications</p>
          </div>
          {profile && (
            <div className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                Status: <strong style={{ color: profile.is_available ? 'var(--success)' : 'var(--danger)' }}>
                  {profile.is_available ? 'Available' : 'Unavailable'}
                </strong>
              </span>
              <button
                className={`btn btn-sm ${profile.is_available ? 'btn-danger' : 'btn-success'}`}
                onClick={async () => {
                  const newStatus = !profile.is_available;
                  try {
                    await helpersAPI.update({ is_available: newStatus });
                    setProfile({ ...profile, is_available: newStatus });
                    setEditForm({ ...editForm, is_available: newStatus });
                  } catch (e) { alert(e.message); }
                }}
              >
                {profile.is_available ? 'Go Offline' : 'Go Online'}
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-4 stagger-children" style={{ marginBottom: 32 }}>
          <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--info-bg)' }}><i className="fas fa-clipboard-list"></i></div><div className="stat-info"><h3>{bookings.length}</h3><p>Total Requests</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--warning-bg)' }}><i className="fas fa-hourglass-half"></i></div><div className="stat-info"><h3>{bookings.filter(b => b.status === 'pending').length}</h3><p>Pending</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--success-bg)' }}><i className="fas fa-money-bill-wave"></i></div><div className="stat-info"><h3>৳{earnings}</h3><p>Total Earnings</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)' }}><i className="fas fa-star"></i></div><div className="stat-info"><h3>{Number(profile?.total_reviews) > 0 ? Number(profile.avg_rating).toFixed(1) : 'Not rated'}</h3><p>{Number(profile?.total_reviews) > 0 ? `Rating (${profile.total_reviews})` : 'No reviews yet'}</p></div></div>
        </div>

        <div className="tabs">
          <button className={`tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>Booking Requests</button>
          <button className={`tab ${activeTab === 'wallet' ? 'active' : ''}`} onClick={() => setActiveTab('wallet')}>Earnings & Wallet ৳</button>
          <button className={`tab ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>My Services</button>
          <button className={`tab ${activeTab === 'applications' ? 'active' : ''}`} onClick={() => setActiveTab('applications')}>Job Applications</button>
          <button className={`tab ${activeTab === 'complaints' ? 'active' : ''}`} onClick={() => setActiveTab('complaints')}>Complaints</button>
          <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
        </div>

        {/* Bookings */}
        {activeTab === 'bookings' && (
          <div className="stagger-children">
            {bookings.length === 0 ? (
              <div className="empty-state"><i className="fas fa-clipboard-list" style={{ fontSize: '2rem' }}></i><h3>No bookings yet</h3><p>Booking requests will appear here</p></div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="booking-item glass-card">
                  <div className="booking-item-header">
                    <div className="booking-item-info">
                      <h3>{b.service_name || 'General Service'}</h3>
                      <p className="text-secondary">
                        Client:{' '}
                        <ProfileLink userId={b.client_id || b.user_id} role="household" name={b.client_name} />
                      </p>
                    </div>
                    {statusBadge(b.status)}
                  </div>
                  <div className="booking-item-details">
                    <span>
                      <i className="fas fa-calendar-alt" style={{ color: 'var(--accent)' }}></i>{' '}
                      {new Date(b.booking_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span>
                      <i className="fas fa-clock" style={{ color: 'var(--accent)' }}></i>{' '}
                      {new Date(b.booking_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span><i className="fas fa-map-marker-alt"></i> {b.address || 'N/A'}</span>
                    <span><i className="fas fa-money-bill-wave"></i> ৳{b.total_price || 0}</span>
                    {b.client_phone && <span><i className="fas fa-phone"></i> {b.client_phone}</span>}
                  </div>
                  <AddressMap address={b.address} label="Service map" />
                  {b.notes && <p className="booking-notes"><i className="fas fa-sticky-note"></i> {b.notes}</p>}
                  <div className="booking-item-actions">
                    {b.status === 'pending' && (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => handleBookingAction(b.id, 'confirmed')}><i className="fas fa-check"></i> Accept</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleBookingAction(b.id, 'cancelled')}><i className="fas fa-times"></i> Decline</button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleBookingAction(b.id, 'in_progress')}>Start Work</button>
                    )}
                    {b.status === 'in_progress' && (
                      <button className="btn btn-success btn-sm" onClick={() => handleBookingAction(b.id, 'completed')}>Mark Complete</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Earnings & Wallet */}
        {activeTab === 'wallet' && (
          <div className="stagger-children">
            <div className="glass-card-static" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Total Earnings Balance</h3>
                <p className="text-secondary" style={{ margin: '4px 0 0' }}>Track income from all completed customer bookings</p>
              </div>
              <h1 style={{ color: 'var(--success)', margin: 0 }}>৳{earnings}</h1>
            </div>

            <h3>Payment History ({bookings.filter(b => b.status === 'completed').length} completed jobs)</h3>
            {bookings.filter(b => b.status === 'completed').length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-wallet" style={{ fontSize: '2rem' }}></i>
                <h3>No earnings history yet</h3>
                <p>Complete booking requests to see your payments here.</p>
              </div>
            ) : (
              bookings.filter(b => b.status === 'completed').map((b) => (
                <div key={b.id} className="booking-item glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{b.service_name || 'Service Job'}</h4>
                    <p className="text-secondary" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                      Client: {b.client_name} · Date: {new Date(b.booking_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)' }}>+ ৳{b.total_price || 0}</span>
                    <div><span className="badge badge-success">Paid</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'services' && (
          <div>
            <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowAddService(!showAddService)}>
              {showAddService ? 'Cancel' : '+ Add Service'}
            </button>
            {showAddService && (
              <form className="glass-card-static animate-fade-in" style={{ marginBottom: 24 }} onSubmit={handleAddService}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select className="form-input" value={newService.category_id} onChange={(e) => setNewService({ ...newService, category_id: e.target.value })} required>
                      <option value="">Select</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price (৳)</label>
                    <input type="number" className="form-input" placeholder="e.g., 1000" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Service Name</label>
                  <input type="text" className="form-input" placeholder="e.g., Deep Home Cleaning" value={newService.service_name} onChange={(e) => setNewService({ ...newService, service_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-input" placeholder="Describe what's included..." value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} rows={2} />
                </div>
                <button type="submit" className="btn btn-primary">Save Service</button>
              </form>
            )}
            <div className="stagger-children">
              {(profile?.services || []).map(s => (
                <div key={s.id} className="service-item glass-card">
                  <div className="service-info">
                    <span className="service-category-badge"><i className={getCategoryIcon(s.category_name)}></i> {s.category_name}</span>
                    <h3>{s.service_name}</h3>
                    <p>{s.description}</p>
                  </div>
                  <div className="service-price-action">
                    <span className="service-price">৳{s.price}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteService(s.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Applications */}
        {activeTab === 'applications' && (
          <div className="stagger-children">
            <div style={{ marginBottom: 16 }}>
              <Link to="/jobs" className="btn btn-secondary">Browse Available Jobs <i className="fas fa-arrow-right"></i></Link>
            </div>
            {applications.length === 0 ? (
              <div className="empty-state"><i className="fas fa-clipboard-list" style={{ fontSize: '2rem' }}></i><h3>No applications yet</h3><p>Browse the job board and apply!</p></div>
            ) : (
              applications.map(a => (
                <div key={a.id} className="booking-item glass-card">
                  <div className="booking-item-header">
                    <div className="booking-item-info">
                      <h3>{a.title}</h3>
                      <p className="text-secondary">
                        <i className={getCategoryIcon(a.category_name)}></i> {a.category_name} · Posted by{' '}
                        <ProfileLink userId={a.poster_id || a.user_id} role="household" name={a.poster_name} />
                      </p>
                    </div>
                    {statusBadge(a.status)}
                  </div>
                  <div className="booking-item-details">
                    <span><i className="fas fa-money-bill-wave"></i> Budget: ৳{a.budget}</span>
                    <span><i className="fas fa-map-marker-alt"></i> {a.location}</span>
                    <span>Your bid: ৳{a.proposed_price}</span>
                  </div>
                  <AddressMap address={a.location} label="Job map" />
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'complaints' && <ComplaintPanel />}

        {/* Profile */}
        {activeTab === 'profile' && profile && (
          <div className="glass-card-static animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2>My Profile</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(!editMode)}>
                {editMode ? 'Cancel' : <><i className="fas fa-pen"></i> Edit</>}
              </button>
            </div>
            {editMode ? (
              <div>
                <div className="form-group"><label>Bio</label><textarea className="form-input" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} /></div>
                <div className="form-row">
                  <div className="form-group"><label>Hourly Rate (৳)</label><input type="number" className="form-input" value={editForm.hourly_rate} onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })} /></div>
                  <div className="form-group"><label>Experience (years)</label><input type="number" className="form-input" value={editForm.experience_years} onChange={(e) => setEditForm({ ...editForm, experience_years: e.target.value })} /></div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={editForm.is_available} onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })} />
                    Available for work
                  </label>
                </div>
                <button className="btn btn-primary" onClick={handleUpdateProfile}>Save Changes</button>
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: 16 }}>{profile.bio || 'No bio set'}</p>
                <div className="booking-item-details">
                  <span><i className="fas fa-money-bill-wave"></i> ৳{profile.hourly_rate}/hr</span>
                  <span><i className="fas fa-briefcase"></i> {profile.experience_years} years</span>
                  <span><i className="fas fa-circle" style={{ fontSize: '0.5rem', color: profile.is_available ? 'var(--success)' : 'var(--danger)', verticalAlign: 'middle' }}></i> {profile.is_available ? 'Available' : 'Unavailable'}</span>
                  <span>{profile.is_verified ? <><i className="fas fa-check-circle" style={{ color: 'var(--success)' }}></i> Verified</> : <><i className="fas fa-clock"></i> Not verified</>}</span>
                  <span><i className="fas fa-star" style={{ color: '#f59e0b' }}></i> {Number(profile.total_reviews) > 0 ? `${Number(profile.avg_rating).toFixed(1)} (${profile.total_reviews} reviews)` : 'Not rated yet'}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
