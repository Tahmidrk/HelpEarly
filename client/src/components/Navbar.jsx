import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EmergencyModal from './EmergencyModal';

export default function Navbar() {
  const { user, activeRole, switchMode, logout } = useAuth();
  const role = user?.role === 'both' ? activeRole : user?.role;
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [showEmergency, setShowEmergency] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' ? 'active' : '';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`) ? 'active' : '';
  };

  return (
    <nav className="navbar" id="main-navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <img src="/logo.svg" alt="At Your Service" className="brand-logo" />
          <span className="brand-text">At Your Service</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {/* Common link */}
          <Link to="/" className={`nav-link ${isActive('/')}`} onClick={() => setMenuOpen(false)}>
            Home
          </Link>

          {/* Household: Browse Helpers is their main page */}
          {(!user || role === 'household') && (
            <Link to="/helpers" className={`nav-link ${isActive('/helpers')}`} onClick={() => setMenuOpen(false)}>
              Browse Helpers
            </Link>
          )}

          {/* Helper: Dashboard + Browse Jobs */}
          {user && role === 'helper' && (
            <>
              <Link to="/helper/dashboard" className={`nav-link ${isActive('/helper/dashboard')}`} onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <Link to="/jobs" className={`nav-link ${isActive('/jobs')}`} onClick={() => setMenuOpen(false)}>
                Browse Jobs
              </Link>
            </>
          )}

          {/* Household: Dashboard + Job Board + Chat + Emergency */}
          {user && role === 'household' && (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`} onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <Link to="/jobs" className={`nav-link ${isActive('/jobs')}`} onClick={() => setMenuOpen(false)}>
                Job Board
              </Link>
              <Link to="/chat" className={`nav-link ${isActive('/chat')}`} onClick={() => setMenuOpen(false)}>
                Chat
              </Link>
              <button
                type="button"
                className="nav-link btn-emergency-nav"
                onClick={() => { setShowEmergency(true); setMenuOpen(false); }}
                style={{
                  color: 'var(--danger)',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <i className="fas fa-ambulance animate-pulse" /> Emergency
              </button>
            </>
          )}

          <EmergencyModal isOpen={showEmergency} onClose={() => setShowEmergency(false)} />

          {/* Helper: Chat */}
          {user && role === 'helper' && (
            <Link to="/chat" className={`nav-link ${isActive('/chat')}`} onClick={() => setMenuOpen(false)}>
              Chat
            </Link>
          )}

          {/* Admin */}
          {user && user.role === 'admin' && (
            <Link to="/admin" className={`nav-link ${isActive('/admin')}`} onClick={() => setMenuOpen(false)}>
              Admin Panel
            </Link>
          )}

          {user && <Link to="/notifications" className={`nav-link ${isActive('/notifications')}`} onClick={() => setMenuOpen(false)}>Notifications</Link>}
          {user && role !== 'admin' && <Link to="/emergency" className={`nav-link ${isActive('/emergency')}`} onClick={() => setMenuOpen(false)}>Emergency requests</Link>}
          {/* Profile - for logged in users */}
          {user && (
            <Link to="/profile" className={`nav-link ${isActive('/profile')}`} onClick={() => setMenuOpen(false)}>
              Profile
            </Link>
          )}

          {user ? (
            <button className="nav-link mobile-menu-action" onClick={handleLogout} type="button">
              Logout
            </button>
          ) : (
            <div className="mobile-menu-auth">
              <Link to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/register" className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>Sign Up</Link>
            </div>
          )}
        </div>

        <div className="navbar-actions">
          {/* Mode Switcher for User (Household vs Worker) */}
          {user?.role === 'both' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-full)',
                padding: '3px',
                border: '1px solid var(--border-color)',
                marginRight: 10,
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${activeRole === 'household' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
                onClick={() => {
                  switchMode('household');
                  if (location.pathname.startsWith('/helper/dashboard')) navigate('/dashboard');
                }}
              >
                <i className="fas fa-home" /> Household
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeRole === 'helper' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
                onClick={() => {
                  switchMode('helper');
                  if (location.pathname.startsWith('/dashboard') || location.pathname === '/helpers') navigate('/helper/dashboard');
                }}
              >
                <i className="fas fa-wrench" /> Worker
              </button>
            </div>
          )}

          <button
            className="btn btn-ghost btn-sm theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle dark mode"
            type="button"
          >
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {user ? (
            <div className="navbar-user">
              <Link to="/profile" className="navbar-user-name profile-link" onClick={() => setMenuOpen(false)}>
                {user.name?.split(' ')[0]}
              </Link>
              <button className="btn btn-sm btn-secondary" onClick={handleLogout} id="logout-btn">
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-ghost">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}

          <button className="mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            <span className={`hamburger ${menuOpen ? 'open' : ''}`}></span>
          </button>
        </div>
      </div>
    </nav>
  );
}
