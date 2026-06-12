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

  useEffect(() => {
    if (localStorage.getItem('logged_in_user_id')) {
      navigate('/home');
    }
  }, [navigate]);

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
        if (data.requires_password_change) {
          navigate(`/reset-password?token=TEMP_${encodeURIComponent(data.user_id)}`);
          return;
        }

        localStorage.clear();
        localStorage.setItem('logged_in_user_id', data.user_id);
        localStorage.setItem('display_name', data.full_name);
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('allowed_menus', data.allowed_menus || 'dashboard,expense,profile');
        
        // Set session cookie for convenience
        document.cookie = `user_id=${encodeURIComponent(data.user_id)}; path=/; max-age=86400;`;
        
        navigate('/home');
      } else {
        setPopupMsg(data.message || "Invalid credentials.");
        setIsError(true);
        setShowPopup(true);
      }
    } catch (err) {
      setPopupMsg("Unable to connect. Please try again later.");
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
            <Link to="/reset?tab=forgot">Forgot Password</Link>
            <span className="divider">|</span>
            <Link to="/reset?tab=unlock">Unlock Account</Link>
          </div>
        </form>

        <footer>
          <p>&copy; Designed &amp; Developed by <a href="https://sunilbishnoi.co.in" target="_blank" rel="noopener noreferrer">Sunil Bishnoi</a></p>
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
