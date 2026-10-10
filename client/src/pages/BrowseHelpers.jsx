import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { helpersAPI, categoriesAPI } from '../utils/api';
import HelperCard from '../components/HelperCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { HIDDEN_CATEGORIES } from '../utils/iconMap';

export default function BrowseHelpers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [helpers, setHelpers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    location: searchParams.get('location') || '',
    min_rating: searchParams.get('min_rating') || '',
    sort: searchParams.get('sort') || '',
    page: 1,
  });

  useEffect(() => {
    categoriesAPI.getAll()
      .then(cats => setCategories(cats.filter(c => !HIDDEN_CATEGORIES.includes(c.name))))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });

    helpersAPI.getAll(params)
      .then((data) => {
        setHelpers(data.helpers || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const updateFilter = (key, value) => {
    const updated = { ...filters, [key]: value, page: 1 };
    setFilters(updated);
    const params = {};
    Object.entries(updated).forEach(([k, v]) => { if (v) params[k] = v; });
    setSearchParams(params);
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header animate-fade-in">
          <h1>Find Helpers</h1>
          <p>Browse trusted professionals near you</p>
        </div>

        {/* Filters Bar */}
        <div className="filters-bar glass-card-static animate-fade-in" id="filters-bar">
          <div className="filter-row">
            <div className="filter-search">
              <i className="fas fa-search search-icon-sm"></i>
              <input
                type="text"
                className="form-input"
                placeholder="Search by name or service..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                id="filter-search"
              />
            </div>
            <select className="form-input filter-select" value={filters.category} onChange={(e) => updateFilter('category', e.target.value)} id="filter-category">
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="text"
              className="form-input filter-location"
              placeholder="Area, road, or city..."
              value={filters.location}
              onChange={(e) => updateFilter('location', e.target.value)}
              id="filter-location"
            />
            <input
              type="number"
              className="form-input filter-price"
              placeholder="Max Rate (৳)..."
              value={filters.max_rate || ''}
              onChange={(e) => updateFilter('max_rate', e.target.value)}
              id="filter-max-rate"
              style={{ maxWidth: 140 }}
            />
            <select className="form-input filter-select" value={filters.min_rating} onChange={(e) => updateFilter('min_rating', e.target.value)} id="filter-rating">
              <option value="">Any Rating</option>
              <option value="4">4.0+ Stars</option>
              <option value="4.5">4.5+ Stars</option>
              <option value="4.8">4.8+ Stars</option>
            </select>
            <select className="form-input filter-select" value={filters.sort || ''} onChange={(e) => updateFilter('sort', e.target.value)} id="filter-sort">
              <option value="">Sort By</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="reviews">Most Reviews</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <LoadingSpinner text="Finding helpers..." />
        ) : helpers.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-search" style={{ fontSize: '2rem' }}></i>
            <h3>No helpers found</h3>
            <p>Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <>
            <p className="results-count">{helpers.length} helper{helpers.length !== 1 ? 's' : ''} found</p>
            <div className="grid grid-3 stagger-children">
              {helpers.map((helper) => (
                <HelperCard key={helper.id} helper={helper} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    className={`page-btn ${filters.page === i + 1 ? 'active' : ''}`}
                    onClick={() => setFilters({ ...filters, page: i + 1 })}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
