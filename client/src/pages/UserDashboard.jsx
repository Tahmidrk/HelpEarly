import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookingsAPI, jobsAPI, reviewsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import LoadingSpinner from '../components/LoadingSpinner';
import AddressMap from '../components/AddressMap';
import ComplaintPanel from '../components/ComplaintPanel';
import ProfileLink from '../components/ProfileLink';

export default function UserDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ bookingId: null, helperId: null, rating: 0, comment: '' });

  useEffect(() => {
    Promise.all([
      bookingsAPI.getAll().catch(() => []),
      jobsAPI.getMyJobs().catch(() => []),
    ]).then(([b, j]) => {
      setBookings(b);
      setMyJobs(j);
    }).finally(() => setLoading(false));
  }, []);

  const handleStatusUpdate = async (id, status) => {
    try {
      await bookingsAPI.update(id, { status });
      setBookings(bookings.map(b => b.id === id ? { ...b, status } : b));
    } catch (err) { alert(err.message); }
  };

  const handleReview = async () => {
    if (!reviewForm.rating) return alert('Choose a rating first.');
    try {
      await reviewsAPI.create({
        helper_id: reviewForm.helperId,
        booking_id: reviewForm.bookingId,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      setReviewForm({ bookingId: null, helperId: null, rating: 0, comment: '' });
      alert('Review submitted!');
    } catch (err) { alert(err.message); }
  };

  const statusBadge = (status) => {
    const map = { pending: 'badge-warning', confirmed: 'badge-info', in_progress: 'badge-primary', completed: 'badge-success', cancelled: 'badge-danger', open: 'badge-success' };
    return <span className={`badge ${map[status] || 'badge-primary'}`}>{status}</span>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <div className="container">
        <div className="page-header animate-fade-in">
          <h1>Welcome, {user?.name?.split(' ')[0]}!</h1>
          <p>Manage your bookings and job posts</p>
        </div>

        {/* Stats */}
        <div className="grid grid-4 stagger-children" style={{ marginBottom: 32 }}>
          <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--info-bg)' }}><i className="fas fa-list"></i></div><div className="stat-info"><h3>{bookings.length}</h3><p>Total Bookings</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--warning-bg)' }}><i className="fas fa-hourglass-half"></i></div><div className="stat-info"><h3>{bookings.filter(b => b.status === 'pending').length}</h3><p>Pending</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--success-bg)' }}><i className="fas fa-check-circle"></i></div><div className="stat-info"><h3>{bookings.filter(b => b.status === 'completed').length}</h3><p>Completed</p></div></div>
          <div className="stat-card"><div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)' }}><i className="fas fa-megaphone"></i></div><div className="stat-info"><h3>{myJobs.length}</h3><p>Job Posts</p></div></div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>My Bookings</button>
          <button className={`tab ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>My Job Posts</button>
          <button className={`tab ${activeTab === 'complaints' ? 'active' : ''}`} onClick={() => setActiveTab('complaints')}>Complaints</button>
        </div>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="stagger-children">
            {bookings.length === 0 ? (
              <div className="empty-state"><i className="fas fa-calendar"></i><h3>No bookings yet</h3><p>Find a helper and book your first service!</p><Link to="/helpers" className="btn btn-primary" style={{ marginTop: 16 }}>Find Helpers</Link></div>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="booking-item glass-card" id={`booking-${booking.id}`}>
                  <div className="booking-item-header">
                    <div className="booking-item-info">
                      <h3>{booking.service_name || 'General Service'} {booking.category_icon}</h3>
                      <p className="text-secondary">
                        Helper:{' '}
                        <ProfileLink
                          userId={booking.helper_user_id}
                          helperId={booking.helper_profile_id || booking.helper_id}
                          role="helper"
                          name={booking.helper_name}
                        />
                      </p>
                    </div>
                    {statusBadge(booking.status)}
                  </div>
                  <div className="booking-item-details">
                    <span>
                      <i className="fas fa-calendar-alt" style={{ color: 'var(--accent)' }}></i>{' '}
                      {new Date(booking.booking_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span>
                      <i className="fas fa-clock" style={{ color: 'var(--accent)' }}></i>{' '}
                      {new Date(booking.booking_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span><i className="fas fa-map-marker-alt"></i> {booking.address || 'N/A'}</span>
                    <span><i className="fas fa-dollar-sign"></i> ৳{booking.total_price || 0}</span>
                  </div>
                  <AddressMap address={booking.address} label="Service map" />
                  {booking.notes && <p className="booking-notes"><i className="fas fa-note-sticky"></i> {booking.notes}</p>}
                  <div className="booking-item-actions">
                    {booking.status === 'pending' && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate(booking.id, 'cancelled')}>Cancel</button>
                    )}
                    {booking.status === 'completed' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link to={`/book/${booking.helper_profile_id || booking.helper_id}`} className="btn btn-secondary btn-sm">
                          <i className="fas fa-redo"></i> Rebook Worker
                        </Link>
                        {!reviewForm.bookingId && (
                          <button className="btn btn-primary btn-sm" onClick={() => setReviewForm({ ...reviewForm, bookingId: booking.id, helperId: booking.helper_id })}>
                            <i className="fas fa-star"></i> Leave Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {reviewForm.bookingId === booking.id && (
                    <div className="review-form-inline animate-fade-in">
                      <StarRating rating={reviewForm.rating} onRate={(r) => setReviewForm({ ...reviewForm, rating: r })} />
                      <textarea className="form-input" placeholder="Write your review..." value={reviewForm.comment}
                        onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} rows={2} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={handleReview}>Submit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setReviewForm({ bookingId: null, helperId: null, rating: 0, comment: '' })}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="stagger-children">
            <div style={{ marginBottom: 16 }}>
              <Link to="/jobs/post" className="btn btn-primary">+ Post New Job</Link>
            </div>
            {myJobs.length === 0 ? (
              <div className="empty-state"><i className="fas fa-megaphone"></i><h3>No job posts yet</h3><p>Post a job to receive applications from helpers</p></div>
            ) : (
              myJobs.map((job) => (
                <div key={job.id} className="booking-item glass-card">
                  <div className="booking-item-header">
                    <div className="booking-item-info"><h3>{job.title}</h3><p className="text-secondary">{job.category_icon} {job.category_name}</p></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-info">{job.application_count || 0} apps</span>
                      {statusBadge(job.status)}
                    </div>
                  </div>
                  <p className="text-secondary" style={{ margin: '8px 0' }}>{job.description?.substring(0, 150)}...</p>
                  <div className="booking-item-details">
                    <span><i className="fas fa-dollar-sign"></i> Budget: ৳{job.budget || 'Negotiable'}</span>
                    <span><i className="fas fa-map-marker-alt"></i> {job.location}</span>
                  </div>
                  <AddressMap address={job.location} label="Job map" />
                  <Link to={`/jobs/${job.id}`} className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>View Details & Applications</Link>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'complaints' && <ComplaintPanel />}
      </div>
    </div>
  );
}
