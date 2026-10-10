import { useState, useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import { Link } from 'react-router-dom';
import { categoriesAPI, helpersAPI } from '../utils/api';
import HelperCard from '../components/HelperCard';
import { getCategoryIcon, HIDDEN_CATEGORIES } from '../utils/iconMap';

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: 'fas fa-search-location',
    title: 'Post or Browse',
    desc: 'Search for a verified helper nearby or post your job with photos and a description.',
  },
  {
    step: '02',
    icon: 'fas fa-star',
    title: 'Compare & Choose',
    desc: 'Review ratings, prices, experience, and availability. Our system recommends the best match.',
  },
  {
    step: '03',
    icon: 'fas fa-comments',
    title: 'Chat & Confirm',
    desc: 'Message the helper directly through the app. Agree on timing and price before booking.',
  },
  {
    step: '04',
    icon: 'fas fa-check-circle',
    title: 'Get It Done',
    desc: 'Helper arrives, completes the job. Rate and review to help the community.',
  },
];

const WHY_US = [
  {
    icon: 'fas fa-map-marker-alt',
    color: '#00bcd4',
    title: 'Location-Based Matching',
    desc: 'Our Smart Recommendation System ranks helpers by distance, rating, price, and availability — so you find the right person fast.',
  },
  {
    icon: 'fas fa-bolt',
    color: '#f59e0b',
    title: 'Emergency / Urgent Mode',
    desc: 'Pipe burst? Power cut? Instantly broadcast your urgent request to all nearby available helpers and get help within minutes.',
  },
  {
    icon: 'fas fa-camera',
    color: '#22c55e',
    title: 'Photo-Based Job Requests',
    desc: 'Upload photos of the problem so helpers understand exactly what is needed before submitting a proposal.',
  },
  {
    icon: 'fas fa-shield-alt',
    color: '#3b82f6',
    title: 'Verified Helpers',
    desc: 'Every helper goes through admin review before they can take jobs. Ratings and reviews keep the platform accountable.',
  },
  {
    icon: 'fas fa-wallet',
    color: '#8b5cf6',
    title: 'Transparent Pricing',
    desc: 'Helpers submit their own offers. You compare and choose — no hidden fees, no surprises.',
  },
  {
    icon: 'fas fa-clock',
    color: '#ef4444',
    title: 'Advance Scheduling',
    desc: 'Book now or schedule for a future date. Re-book trusted helpers with one tap.',
  },
];

const ROLES = [
  {
    icon: 'fas fa-home',
    label: 'Households',
    color: '#00bcd4',
    bg: 'rgba(0,188,212,0.08)',
    points: [
      'Browse & filter verified helpers',
      'Post jobs with photos',
      'Get smart helper recommendations',
      'In-app chat with helpers',
      'Emergency urgent requests',
      'Schedule & manage bookings',
      'Rate & review services',
    ],
    cta: 'Find a Helper',
    to: '/helpers',
  },
  {
    icon: 'fas fa-hard-hat',
    label: 'Service Helpers',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    points: [
      'Receive nearby job alerts',
      'Browse & submit proposals',
      'Set your own pricing',
      'Manage active bookings',
      'Track earnings & payments',
      'Toggle availability on/off',
      'Build reputation with reviews',
    ],
    cta: 'Join as Helper',
    to: '/register',
  },
];

const STATS = [
  { value: '5+', label: 'Service Categories' },
  { value: '3', label: 'User Roles' },
  { value: 'Real-time', label: 'In-App Chat' },
  { value: 'Smart', label: 'Recommendations' },
];

export default function Home() {
  const revision = useSync('helpers', 'categories');
  const [categories, setCategories] = useState([]);
  const [featuredHelpers, setFeaturedHelpers] = useState([]);

  useEffect(() => {
    categoriesAPI.getAll()
      .then((cats) => setCategories(cats.filter((c) => !HIDDEN_CATEGORIES.includes(c.name))))
      .catch(console.error);
    helpersAPI.getAll({ limit: 6, sort: 'rating_desc' })
      .then((data) => setFeaturedHelpers(data.helpers || []))
      .catch(console.error);
  }, [revision]);

  return (
    <div className="page home-page">

      {/* ── Hero ── */}
      <section className="hero ays-hero">
        <div className="container">
          <div className="hero-content animate-fade-in">
            <div className="hero-badge">
              <i className="fas fa-map-marker-alt" /> Bangladesh&apos;s Home Service Platform
            </div>
            <h1 className="hero-title">
              Find Trusted{' '}
              <span className="gradient-text">Home Service Workers</span>{' '}
              Near You
            </h1>
            <p className="hero-subtitle">
              Connect with verified local plumbers, electricians, cleaners, carpenters, and
              more. Post your job, compare proposals, chat, and book — all in one place.
            </p>
            <div className="hero-actions">
              <Link to="/helpers" className="btn btn-primary btn-lg" id="hero-browse-btn">
                <i className="fas fa-search" /> Browse Helpers
              </Link>
              <Link to="/jobs/post" className="btn btn-outline-teal btn-lg" id="hero-post-job-btn">
                <i className="fas fa-plus-circle" /> Post a Job
              </Link>
              <Link to="/register" className="btn btn-secondary btn-lg" id="hero-join-btn">
                <i className="fas fa-hard-hat" /> Join as Helper
              </Link>
            </div>
            <div className="hero-stats">
              {STATS.map((s) => (
                <div className="hero-stat" key={s.label}>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Emergency Banner ── */}
      <section className="emergency-banner">
        <div className="container emergency-inner">
          <div className="emergency-icon-wrap">
            <i className="fas fa-exclamation-triangle" />
          </div>
          <div className="emergency-text">
            <strong>Need help right now?</strong>
            <span>Use Emergency Mode to instantly alert nearby available helpers.</span>
          </div>
          <Link to="/jobs/post" className="btn btn-emergency" id="emergency-mode-btn">
            <i className="fas fa-bolt" /> Emergency Request
          </Link>
        </div>
      </section>

      {/* ── Service Categories ── */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Browse by <span className="gradient-text">Service Category</span></h2>
            <p>Find the right expert for every home task</p>
          </div>
          <div className="categories-grid stagger-children">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/helpers?category=${cat.id}`}
                className="category-card glass-card"
                id={`category-${cat.id}`}
              >
                <div className="category-icon">
                  <i className={getCategoryIcon(cat.name)} />
                </div>
                <h3>{cat.name}</h3>
                <p>{cat.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="section how-it-works-section">
        <div className="container">
          <div className="section-header">
            <h2>How <span className="gradient-text">At Your Service</span> Works</h2>
            <p>Book a trusted home service helper in four simple steps</p>
          </div>
          <div className="hiw-grid stagger-children">
            {HOW_IT_WORKS.map((step) => (
              <div className="hiw-card glass-card" key={step.step}>
                <div className="hiw-step-num">{step.step}</div>
                <div className="hiw-icon">
                  <i className={step.icon} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ── */}
      <section className="section why-section">
        <div className="container">
          <div className="section-header">
            <h2>Why Choose <span className="gradient-text">At Your Service?</span></h2>
            <p>Purpose-built for households and service workers across Bangladesh</p>
          </div>
          <div className="why-grid stagger-children">
            {WHY_US.map((item) => (
              <div className="why-card glass-card" key={item.title}>
                <div className="why-icon" style={{ color: item.color, background: `${item.color}18` }}>
                  <i className={item.icon} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Role Cards ── */}
      <section className="section roles-section">
        <div className="container">
          <div className="section-header">
            <h2>One Platform, <span className="gradient-text">Multiple Roles</span></h2>
            <p>Whether you need a service or provide one, At Your Service has you covered</p>
          </div>
          <div className="roles-grid">
            {ROLES.map((role) => (
              <div
                className="role-showcase-card glass-card"
                key={role.label}
                style={{ borderTopColor: role.color }}
              >
                <div className="role-showcase-icon" style={{ color: role.color, background: role.bg }}>
                  <i className={role.icon} />
                </div>
                <h3>{role.label}</h3>
                <ul className="role-points">
                  {role.points.map((pt) => (
                    <li key={pt}>
                      <i className="fas fa-check" style={{ color: role.color }} /> {pt}
                    </li>
                  ))}
                </ul>
                <Link to={role.to} className="btn btn-primary btn-sm role-cta-btn" id={`role-cta-${role.label.replace(/\s+/g, '-').toLowerCase()}`}>
                  {role.cta} <i className="fas fa-arrow-right" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Helpers ── */}
      {featuredHelpers.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2>Top Rated <span className="gradient-text">Helpers</span></h2>
              <p>Highest rated professionals ready for your next job</p>
            </div>
            <div className="grid grid-3 stagger-children">
              {featuredHelpers.slice(0, 3).map((helper) => (
                <HelperCard key={helper.id} helper={helper} />
              ))}
            </div>
            <div className="section-footer">
              <Link to="/helpers" className="btn btn-secondary btn-lg" id="view-all-helpers-btn">
                View All Helpers <i className="fas fa-arrow-right" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Smart Recommendation CTA ── */}
      <section className="section">
        <div className="container">
          <div className="smart-rec-card glass-card">
            <div className="smart-rec-left">
              <div className="smart-rec-icon">
                <i className="fas fa-brain" />
              </div>
              <div>
                <h2>Smart Helper <span className="gradient-text">Recommendation</span></h2>
                <p>
                  Our recommendation engine scores every available helper by distance, rating,
                  price, availability, and service match — then surfaces the best options at
                  the top so you don't have to search manually.
                </p>
                <div className="smart-rec-tags">
                  {['Nearby Location', 'High Rating', 'Fair Price', 'Available Now', 'Category Match'].map((t) => (
                    <span className="badge badge-primary" key={t}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <Link to="/helpers" className="btn btn-primary btn-lg" id="smart-rec-cta-btn">
              <i className="fas fa-magic" /> See Recommendations
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section">
        <div className="container">
          <div className="cta-card glass-card">
            <h2>Ready to Get Started?</h2>
            <p>
              Join households and skilled workers across Bangladesh on At Your Service —
              the platform that connects the right people, quickly and transparently.
            </p>
            <div className="cta-actions">
              <Link to="/register" className="btn btn-primary btn-lg" id="final-cta-register-btn">
                Create Free Account
              </Link>
              <Link to="/helpers" className="btn btn-secondary btn-lg" id="final-cta-browse-btn">
                Explore Helpers
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
