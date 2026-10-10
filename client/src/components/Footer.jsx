import { Link } from 'react-router-dom';

export default function Footer() {
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
            <Link to="/helpers?category=1"><i className="fas fa-broom" /> Cleaning</Link>
            <Link to="/helpers?category=2"><i className="fas fa-wrench" /> Plumbing</Link>
            <Link to="/helpers?category=3"><i className="fas fa-bolt" /> Electrical</Link>
            <Link to="/helpers?category=4"><i className="fas fa-hammer" /> Carpentry</Link>
            <Link to="/helpers?category=5"><i className="fas fa-tools" /> Handyman</Link>
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
