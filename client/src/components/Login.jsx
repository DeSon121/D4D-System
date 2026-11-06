import React, { useState } from 'react';

export default function Login({ onLoginSuccess, switchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log in');
      }

      // Save token and user info to localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d4d-auth-page">
      <div className="d4d-auth-split">
        {/* Campus IT Branding Panel */}
        <div className="d4d-auth-branding">
          <div className="d4d-brand-logo">
            <span>🛡️ D4D Campus IT</span>
          </div>
          <h1>Technology problems? We've got you covered.</h1>
          <p>Your campus IT support, simplified. Submit and track your support requests in one place.</p>
          <div className="d4d-brand-features">
            <div className="d4d-brand-feature-item">
              <div className="d4d-feature-icon">✓</div>
              <span>Submit support tickets</span>
            </div>
            <div className="d4d-brand-feature-item">
              <div className="d4d-feature-icon">✓</div>
              <span>Track progress</span>
            </div>
          </div>
        </div>

        {/* Authentication Card */}
        <div className="d4d-auth-card">
          <div className="d4d-auth-header">
            <h2>Welcome back</h2>
            <p>Sign in to access your support dashboard.</p>
          </div>
          {error && <div className="d4d-alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="d4d-form-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                type="email"
                id="login-email"
                className="d4d-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
            <div className="d4d-form-group">
              <label htmlFor="login-password">Password</label>
              <input
                type="password"
                id="login-password"
                className="d4d-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>
            <button type="submit" disabled={loading} className="d4d-btn-primary">
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
          <div className="d4d-auth-footer">
            Don't have an account? <button onClick={switchToRegister} className="d4d-auth-link">Register here</button>
          </div>
        </div>
      </div>
    </div>
  );
}