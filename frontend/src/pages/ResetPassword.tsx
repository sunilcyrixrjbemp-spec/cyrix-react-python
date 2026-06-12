import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../css/login.css';
import Popup from '../components/Popup';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popupMsg, setPopupMsg] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setPopupMsg("Invalid or missing reset token.");
      setIsError(true);
      setShowPopup(true);
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      setPopupMsg("Please fill in all password fields.");
      setIsError(true);
      setShowPopup(true);
      return;
    }

    if (password !== confirmPassword) {
      setPopupMsg("Passwords do not match.");
      setIsError(true);
      setShowPopup(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: password.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPopupMsg(data.message || "Password updated successfully! Redirecting to login...");
        setIsError(false);
        setShowPopup(true);
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setPopupMsg(data.message || "Password reset failed.");
        setIsError(true);
        setShowPopup(true);
      }
    } catch (err) {
      setPopupMsg("Network connection error. Try again.");
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
          <h1>Reset Password</h1>
          <p>Set a new secure password for your account</p>
        </div>

        <form onSubmit={handleSubmit} id="resetForm">
          <div className="form-group">
            <label htmlFor="new_password">New Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="new_password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirm_password">Confirm Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirm_password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0 24px', cursor: 'pointer' }} onClick={() => setShowPassword(!showPassword)}>
            <input
              type="checkbox"
              checked={showPassword}
              onChange={() => {}}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-2)', userSelect: 'none' }}>Show Passwords</span>
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading} id="submitBtn">
            {isLoading ? (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Saving Password...
              </>
            ) : (
              'Save New Password'
            )}
          </button>
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
