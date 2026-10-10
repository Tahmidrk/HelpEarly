import { useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usersAPI, getMediaUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AddressMap from '../components/AddressMap';
import StarRating from '../components/StarRating';

export default function UserProfile() {
  const revision = useSync('helpers');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeRole } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    usersAPI.getOne(id)
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, revision]);

  if (loading) return <LoadingSpinner />;

  if (error || !profile) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <i className="fas fa-user-slash"></i>
            <h3>{error || 'Profile unavailable'}</h3>
            <p>This account may be inactive or removed.</p>
          </div>
        </div>
      </div>
    );
  }

  const initial = profile.name?.charAt(0).toUpperCase() || '?';
  const canHelperChat = (user?.role === 'both' ? activeRole : user?.role) === 'helper'
    && ['household', 'both'].includes(profile.role)
    && Number(user.id) !== Number(profile.id);

  const handleChat = () => {
    if (!user) return navigate('/login');
    navigate(`/chat?userId=${profile.id}`);
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="helper-profile-header glass-card-static animate-fade-in">
          <div className="profile-main">
            <div className="profile-avatar-section">
              {profile.avatar_url ? (
                <img src={getMediaUrl(profile.avatar_url)} alt={profile.name} className="avatar avatar-xl" />
              ) : (
                <div className="avatar avatar-xl avatar-placeholder">{initial}</div>
              )}
            </div>
            <div className="profile-info-section">
              <h1>{profile.name}</h1>
              <p className="profile-location">
                <i className="fas fa-map-marker-alt"></i> {profile.location || 'Location not set'}
              </p>
              <div className="profile-meta">
                <span className={`badge ${['helper', 'both'].includes(profile.role) ? 'badge-primary' : profile.role === 'admin' ? 'badge-danger' : 'badge-info'}`}>
                  {profile.role}
                </span>
                <span className="meta-item">
                  <i className="fas fa-calendar"></i> Joined {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
              {['helper', 'both'].includes(profile.role) && (
                <div className="profile-meta" style={{ marginTop: 10 }}>
                  {Number(profile.total_reviews) > 0 ? <>
                    <StarRating rating={profile.avg_rating} />
                    <span className="rating-value">{Number(profile.avg_rating).toFixed(1)}</span>
                    <span className="review-count">({profile.total_reviews} reviews)</span>
                  </> : <span className="review-count">Not rated yet</span>}
                </div>
              )}
              {canHelperChat && (
                <div className="profile-actions" style={{ marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={handleChat} id="household-chat-btn">
                    <i className="fas fa-comments"></i> Chat with Household
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="glass-card-static">
            <h3 style={{ marginBottom: 12 }}><i className="fas fa-id-card"></i> Profile Details</h3>
            {['helper', 'both'].includes(profile.role) ? (
              <>
                <p style={{ marginBottom: 16 }}>{profile.bio || 'No helper bio added yet.'}</p>
                <div className="booking-item-details">
                  <span><i className="fas fa-money-bill-wave"></i> ৳{profile.hourly_rate || 0}/hr</span>
                  <span><i className="fas fa-briefcase"></i> {profile.experience_years || 0} years experience</span>
                  <span><i className="fas fa-circle" style={{ fontSize: '0.5rem', color: profile.is_available ? 'var(--success)' : 'var(--danger)' }}></i> {profile.is_available ? 'Available' : 'Unavailable'}</span>
                  <span>{profile.is_verified ? <><i className="fas fa-check-circle"></i> Verified</> : <><i className="fas fa-clock"></i> Not verified</>}</span>
                </div>
                {profile.helper_profile_id && (
                  <Link to={`/helpers/${profile.helper_profile_id}`} className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                    View Full Helper Profile
                  </Link>
                )}
              </>
            ) : (
              <p className="text-secondary">
                This is a {profile.role === 'admin' ? 'platform administrator' : 'household member'} account.
              </p>
            )}
          </div>
          <AddressMap address={profile.location} label={`${profile.name} location map`} />
        </div>
      </div>
    </div>
  );
}
