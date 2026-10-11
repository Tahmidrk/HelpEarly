import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { categoriesAPI } from '../utils/api';
import { useSync } from '../context/SyncContext';
import { getCategoryIcon } from '../utils/iconMap';

export default function Footer() {
  const [categories, setCategories] = useState([]);
  const revision = useSync('helpers', 'jobs');
  useEffect(() => {
    let active = true;
    categoriesAPI.getAll().then(rows => { if (active) setCategories(rows); }).catch(() => {});
    return () => { active = false; };
  }, [revision]);
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <img src="/logo.svg" alt="At Your Service" className="footer-logo" />
            <span className="brand-text">At Your Service</span>
            <p className="footer-desc">
              Connecting households with trusted local service workers across Bangladesh —
              quickly, safely, and transparently.
            </p>
          </div>
          <div className="footer-links-group">
            <h4>Platform</h4>
            <Link to="/helpers">Find Helpers</Link>
            <Link to="/jobs">Job Board</Link>
            <Link to="/jobs/post">Post a Job</Link>
            <Link to="/register">Become a Helper</Link>
          </div>
          <div className="footer-links-group">
            <h4>Services</h4>
            {categories.slice(0, 5).map(category => (
              <Link key={category.id} to={`/helpers?category=${category.id}`}><i className={getCategoryIcon(category.name)} /> {category.name}</Link>
            ))}
          </div>
          <div className="footer-links-group">
            <h4>Support</h4>
            <a href="#">Help Center</a>
            <a href="#">Safety Guidelines</a>
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            &copy; {new Date().getFullYear()} At Your Service &mdash; Academic Project (SDP II).
            All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
