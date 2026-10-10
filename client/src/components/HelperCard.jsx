import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import ProfileLink from './ProfileLink';
import { getCategoryIcon } from '../utils/iconMap';

export default function HelperCard({ helper }) {
  const name = helper.name || 'Helper';
  const initial = name.charAt(0).toUpperCase();
  const services = helper.services || [];

  // Deduplicate categories so each one only shows once
  const uniqueCategories = [];
  const seen = new Set();
  services.forEach(s => {
    const catName = s.category_name;
    if (catName && !seen.has(catName)) {
      seen.add(catName);
      uniqueCategories.push(catName);
    }
  });

  return (
    <div className="helper-card glass-card" id={`helper-card-${helper.id}`}>
      <div className="helper-card-header">
        <div className="helper-avatar">
          {helper.avatar_url ? (
            <img src={helper.avatar_url} alt={name} className="avatar avatar-lg" />
          ) : (
            <div className="avatar avatar-lg avatar-placeholder">{initial}</div>
          )}
          {helper.is_verified && <span className="verified-badge" title="Verified"><i className="fas fa-check"></i></span>}
        </div>
        <div className="helper-info">
          <h3 className="helper-name">
            <ProfileLink helperId={helper.id} role="helper" name={name} />
          </h3>
          <p className="helper-location"><i className="fas fa-map-marker-alt"></i> {helper.location || 'Location not set'}</p>
          <div className="helper-rating">
            {Number(helper.total_reviews) > 0 ? <>
              <StarRating rating={helper.avg_rating} />
              <span className="rating-text">{Number(helper.avg_rating).toFixed(1)} ({helper.total_reviews})</span>
            </> : <span className="rating-text">Not rated yet</span>}
          </div>
        </div>
      </div>

      <p className="helper-bio">{helper.bio ? helper.bio.substring(0, 100) + (helper.bio.length > 100 ? '...' : '') : 'No bio available'}</p>

      <div className="helper-services-tags">
        {uniqueCategories.slice(0, 3).map((catName, i) => (
          <span key={i} className="service-tag">
            <i className={getCategoryIcon(catName)}></i> {catName}
          </span>
        ))}
        {uniqueCategories.length > 3 && <span className="service-tag more">+{uniqueCategories.length - 3}</span>}
      </div>

      <div className="helper-card-footer">
        <span className="helper-rate">
          ৳{helper.hourly_rate || 0}<small>/hr</small>
        </span>
        <Link to={`/helpers/${helper.id}`} className="btn btn-primary btn-sm">
          View Profile
        </Link>
      </div>
    </div>
  );
}
