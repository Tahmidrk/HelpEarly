import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [loginType, setLoginType] = useState('user'); // 'user' or 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, restoreError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (loginType === 'admin' && user.role !== 'admin') {
        setError('This account does not have Admin access privileges.');
        return;
      }
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'helper') navigate('/helper/dashboard');
      else navigate('/helpers');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="container">
        <div className="auth-container animate-fade-in">
          <div className="auth-card glass-card-static">
            <div className="auth-header">
              <span className="auth-icon"><i className="fas fa-lock"></i></span>
              <h1>Welcome Back</h1>
              <p>Sign in to your At Your Service account</p>
            </div>

            {/* Login Type Selector */}
            <div className="role-selector" style={{ marginBottom: 20 }}>
              <button
                type="button"
                className={`role-option ${loginType === 'user' ? 'active' : ''}`}
                onClick={() => setLoginType('user')}
              >
                <span className="role-icon"><i className="fas fa-user" /></span>
                <span>User Login</span>
                <small>Household & Helper</small>
              </button>
              <button
                type="button"
                className={`role-option ${loginType === 'admin' ? 'active' : ''}`}
                onClick={() => setLoginType('admin')}
              >
                <span className="role-icon"><i className="fas fa-shield-alt" /></span>
                <span>Admin Login</span>
                <small>Platform Control</small>
              </button>
            </div>

            {(error || restoreError) && <div className="alert alert-error">{error || restoreError}</div>}

            <form onSubmit={handleSubmit} id="login-form">
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <input
                  type="email"
                  id="login-email"
                  className="form-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  type="password"
                  id="login-password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading} id="login-submit">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="auth-footer-text">
              Don't have an account? <Link to="/register">Create one</Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
