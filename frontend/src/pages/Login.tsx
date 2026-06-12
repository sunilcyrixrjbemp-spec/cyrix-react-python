import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../css/login.css';
import Popup from '../components/Popup';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popupMsg, setPopupMsg] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [isError, setIsError] = useState(false);

  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('CYRIX_API_URL') || '');

  useEffect(() => {
    if (localStorage.getItem('logged_in_user_id')) {
      navigate('/home');
    }
  }, [navigate]);

  const handleSaveServerUrl = () => {
    localStorage.setItem('CYRIX_API_URL', serverUrl.trim());
    setPopupMsg(serverUrl.trim() ? `Server API URL configured to: ${serverUrl.trim()}` : "API URL reset to default cloud route.");
    setIsError(false);
    setShowPopup(true);
    setShowServerConfig(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setPopupMsg("User ID and Password are required.");
      setIsError(true);
      setShowPopup(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: username.trim(),
          password: password.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.clear();
        localStorage.setItem('logged_in_user_id', data.user_id);
        localStorage.setItem('display_name', data.full_name);
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('allowed_menus', data.allowed_menus || 'dashboard,expense,profile');
        if (serverUrl.trim()) {
          localStorage.setItem('CYRIX_API_URL', serverUrl.trim());
        }
        
        // Explicitly set cookie so that API calls from browser naturally send the session ID to the backend
        document.cookie = `user_id=${encodeURIComponent(data.user_id)}; path=/; max-age=86400;`;
        
        navigate('/home');
      } else {
        setPopupMsg(data.message || "Invalid credentials.");
        setIsError(true);
        setShowPopup(true);
      }
    } catch (err) {
      setPopupMsg("Server Connection Failed. Please try again.");
      setIsError(true);
      setShowPopup(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-body">
      <div className="login-card">
        <div className="header-text">
          <img src="/logo.png" alt="Cyrix Logo" className="cyrix-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <h1>Cyrix Healthcare</h1>
          <p>Field management system</p>
        </div>

        <form onSubmit={handleSubmit} id="loginForm">
          <div className="form-group">
            <label htmlFor="username">User ID</label>
            <input
              type="text"
              id="username"
              placeholder="e.g. RJ001"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-text-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading} id="loginBtn">
            {isLoading ? (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Verifying...
              </>
            ) : (
              'Login to Dashboard'
            )}
          </button>

          <div className="form-footer">
            <Link to="/reset">Account Help</Link>
            <span className="divider">|</span>
            <Link to="/retrieve">Retrieve ID</Link>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '12.5px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {showServerConfig ? "Hide Connection Settings" : "Configure API Server URL"}
            </button>
          </div>

          {showServerConfig && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-1)', display: 'block', marginBottom: '6px' }}>Backend API Server URL</label>
              <input
                type="text"
                placeholder="e.g. http://localhost:8000"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.15)', fontSize: '13px', background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-1)', marginBottom: '8px', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                Leave blank to use default cloud route. Set to <code>http://localhost:8000</code> to connect to your local Python API server.
              </p>
              <button
                type="button"
                onClick={handleSaveServerUrl}
                style={{ width: '100%', padding: '8px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Save Connection URL
              </button>
            </div>
          )}
        </form>

        <footer>
          <p>&copy; Designed & Developed by <a href="https://sunilbishnoi.co.in" target="_blank" rel="noopener noreferrer">Sunil Bishnoi</a></p>
        </footer>
      </div>

      <Popup
        message={popupMsg}
        show={showPopup}
        onClose={() => setShowPopup(false)}
        isError={isError}
      />
    </div>
  );
}
