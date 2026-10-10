import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { helpersAPI, getMediaUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCategoryIcon } from '../utils/iconMap';
import AddressMap from '../components/AddressMap';

import { useSync } from '../context/SyncContext';

export default function HelperProfile() {
  const revision = useSync("helpers");
  const { id } = useParams();
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();
  const [helper, setHelper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('services');

  useEffect(() => {
    helpersAPI.getOne(id)
      .then(setHelper)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, revision]);

  if (loading) return <LoadingSpinner />;
  if (!helper) return <div className="page"><div className="container"><div className="empty-state"><i className="fas fa-frown" style={{ fontSize: '2rem' }}></i><h3>Helper not found</h3></div></div></div>;

  const canBook = !user || ((user.role === 'both' ? activeRole : user.role) === 'household' && Number(user.id) !== Number(helper.user_id));
  const canChat = !user || Number(user.id) !== Number(helper.user_id);
  const initial = helper.name?.charAt(0).toUpperCase();

  const handleChat = () => {
    if (!user) return navigate('/login');
    navigate(`/chat?userId=${helper.user_id}`);
  };

  // Deduplicate categories from services
  const uniqueCategories = [];
  const seen = new Set();
  (helper.services || []).forEach(s => {
    if (s.category_name && !seen.has(s.category_name)) {
      seen.add(s.category_name);
      uniqueCategories.push(s.category_name);
    }
  });

  return (
    <div className="page">
      <div className="container">
        {/* Profile Header */}
        <div className="helper-profile-header glass-card-static animate-fade-in">
          <div className="profile-top">
            <div className="profile-avatar-section">
              {helper.avatar_url ? (
                <img src={getMediaUrl(helper.avatar_url)} alt={helper.name} className="avatar avatar-xl" />
              ) : (
                <div className="avatar avatar-xl avatar-placeholder">{initial}</div>
              )}
              {helper.is_verified && <div className="verified-large"><i className="fas fa-check-circle"></i> Verified</div>}
            </div>
            <div className="profile-details">
              <h1>{helper.name}</h1>
              <p className="profile-location"><i className="fas fa-map-marker-alt"></i> {helper.location || 'Location not set'}</p>
              <div className="profile-rating">
                {Number(helper.total_reviews) > 0 ? <>
                  <StarRating rating={helper.avg_rating} />
                  <span className="rating-value">{Number(helper.avg_rating).toFixed(1)}</span>
                  <span className="review-count">({helper.total_reviews} reviews)</span>
                </> : <span className="review-count">Not rated yet</span>}
              </div>
              <div className="profile-meta">
                <span className="meta-item"><i className="fas fa-money-bill-wave"></i> ৳{helper.hourly_rate}/hr</span>
                <span className="meta-item"><i className="fas fa-briefcase"></i> {helper.experience_years || 0} years exp.</span>
                <span className={`meta-item ${helper.is_available ? 'available' : 'unavailable'}`}>
                  <i className="fas fa-circle" style={{ fontSize: '0.5rem', verticalAlign: 'middle' }}></i> {helper.is_available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              {/* Work Categories */}
              {uniqueCategories.length > 0 && (
                <div className="helper-services-tags" style={{ marginTop: 10 }}>
                  {uniqueCategories.map((catName, i) => (
                    <span key={i} className="service-tag">
                      <i className={getCategoryIcon(catName)}></i> {catName}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="profile-actions">
              {canBook && <Link to={`/book/${id}`} className="btn btn-primary btn-lg" id="book-btn"><i className="fas fa-calendar-check"></i> Book Now</Link>}
              {canChat && <button className="btn btn-secondary btn-lg" onClick={handleChat} id="chat-btn"><i className="fas fa-comments"></i> Chat</button>}
            </div>
          </div>
          <AddressMap address={helper.location} label="Helper location map" />
          {helper.bio && <p className="profile-bio">{helper.bio}</p>}
        </div>

        {/* Tabs */}
        <div className="tabs" id="profile-tabs">
          <button className={`tab ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>
            Services ({helper.services?.length || 0})
          </button>
          <button className={`tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
            Reviews ({helper.reviews?.length || 0})
          </button>
        </div>

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div className="services-list stagger-children">
            {(helper.services || []).length === 0 ? (
              <div className="empty-state"><i className="fas fa-clipboard-list" style={{ fontSize: '2rem' }}></i><h3>No services listed yet</h3></div>
            ) : (
              helper.services.map((service) => (
                <div key={service.id} className="service-item glass-card" id={`service-${service.id}`}>
                  <div className="service-info">
                    <span className="service-category-badge"><i className={getCategoryIcon(service.category_name)}></i> {service.category_name}</span>
                    <h3>{service.service_name}</h3>
                    <p>{service.description}</p>
                  </div>
                  <div className="service-price-action">
                    <span className="service-price">৳{service.price}</span>
                    {canBook && <Link to={`/book/${id}?service=${service.id}`} className="btn btn-primary btn-sm">Book This</Link>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="reviews-list stagger-children">
            {(helper.reviews || []).length === 0 ? (
              <div className="empty-state"><i className="fas fa-star" style={{ fontSize: '2rem' }}></i><h3>No reviews yet</h3></div>
            ) : (
              helper.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
