import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { jobsAPI, categoriesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCategoryIcon, HIDDEN_CATEGORIES } from '../utils/iconMap';
import AddressMap from '../components/AddressMap';
import ProfileLink from '../components/ProfileLink';

import { useSync } from '../context/SyncContext';

export default function JobListings() {
  const revision = useSync("jobs","categories");
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');

  const getStatusBadgeClass = (status) => {
    const badgeMap = {
      open: 'badge-success',
      in_progress: 'badge-primary',
      completed: 'badge-info',
      cancelled: 'badge-danger',
    };

    return badgeMap[status] || 'badge-info';
  };

  useEffect(() => {
    categoriesAPI.getAll()
      .then(cats => setCategories(cats.filter(c => !HIDDEN_CATEGORIES.includes(c.name))))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let ignore = false;

    const loadJobs = async () => {
      setLoading(true);

      try {
        const params = categoryFilter ? { category: categoryFilter } : undefined;
        let data = [];

        if (user?.role === 'household') {
          data = await jobsAPI.getMyJobs(params);
        } else if (user?.role === 'helper') {
          data = await jobsAPI.getForHelper(params);
        } else {
          data = await jobsAPI.getAll({ ...(params || {}), status: 'open' });
        }

        if (!ignore) {
          setJobs(data);
        }
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setJobs([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadJobs();

    return () => {
      ignore = true;
    };
  }, [authLoading, categoryFilter, user?.role, revision]);

  const pageTitle = user?.role === 'household'
    ? 'My Job Board'
    : user?.role === 'helper'
      ? 'Matching Job Board'
      : 'Job Board';

  const pageSubtitle = user?.role === 'household'
    ? 'Only your job offers are shown here.'
    : user?.role === 'helper'
      ? 'Browse open job offers that match your service categories.'
      : 'Browse available jobs posted by households';

  return (
    <div className="page">
      <div className="container">
        <div className="page-header animate-fade-in">
          <h1>{pageTitle}</h1>
          <p>{pageSubtitle}</p>
        </div>

        <div className="filters-bar glass-card-static" style={{ marginBottom: 24 }}>
          <div className="filter-row">
            <select className="form-input filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {user?.role === 'household' && (
              <Link to="/jobs/post" className="btn btn-primary">+ Post a Job</Link>
            )}
          </div>
        </div>

        {loading || authLoading ? <LoadingSpinner /> : jobs.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-bullhorn" style={{ fontSize: '2rem' }}></i>
            <h3>No jobs found</h3>
            <p>{user?.role === 'household' ? 'You have not posted any jobs in this category yet.' : 'No matching jobs are available right now.'}</p>
          </div>
        ) : (
          <div className="stagger-children">
            {jobs.map(job => (
              <div key={job.id} className="booking-item glass-card" id={`job-${job.id}`}>
                <div className="booking-item-header">
                  <div className="booking-item-info">
                    <h3>{job.title}</h3>
                    <p className="text-secondary">
                      <i className={getCategoryIcon(job.category_name)}></i> {job.category_name} · Posted by{' '}
                      <ProfileLink userId={job.poster_id || job.user_id} role="household" name={job.poster_name} />
                      · {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`badge ${getStatusBadgeClass(job.status)}`}>
                      {job.status?.replace('_', ' ')}
                    </span>
                    <span className="badge badge-info">{job.application_count || 0} applications</span>
                  </div>
                </div>
                <p className="text-secondary" style={{ margin: '8px 0' }}>{job.description?.substring(0, 200)}{job.description?.length > 200 ? '...' : ''}</p>
                <div className="booking-item-details">
                  <span><i className="fas fa-money-bill-wave"></i> Budget: ৳{job.budget || 'Negotiable'}</span>
                  <span><i className="fas fa-map-marker-alt"></i> {job.location}</span>
                  {job.preferred_date && <span><i className="fas fa-calendar"></i> {new Date(job.preferred_date).toLocaleDateString()}</span>}
                </div>
                <AddressMap address={job.location} label="Job map" />
                <div className="booking-item-actions" style={{ marginTop: 12 }}>
                  <Link to={`/jobs/${job.id}`} className="btn btn-primary btn-sm">View Details</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
