import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../css/reset.css';
import Popup from '../components/Popup';

export default function Reset() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'forgot' | 'unlock'>('forgot');

  // Forgot Password state
  const [fStep, setFStep] = useState(1);
  const [fUser, setFUser] = useState('');
  const [fDob, setFDob] = useState('');
  const [fDoj, setFDoj] = useState('');
  const [fOtp, setFOtp] = useState('');
  const [fPass, setFPass] = useState('');
  const [fConf, setFConf] = useState('');
  const [fTimeLeft, setFTimeLeft] = useState(300); // 5 mins
  const [fTimerActive, setFTimerActive] = useState(false);
  const [fResendDisabled, setFResendDisabled] = useState(true);

  // Unlock Account state
  const [uStep, setUStep] = useState(1);
  const [uUser, setUUser] = useState('');
  const [uEcode, setUEcode] = useState('');
  const [uDob, setUDob] = useState('');
  const [uDoj, setUDoj] = useState('');
  const [uOtp, setUOtp] = useState('');
  const [uTimeLeft, setUTimeLeft] = useState(300); // 5 mins
  const [uTimerActive, setUTimerActive] = useState(false);
  const [uResendDisabled, setUResendDisabled] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  // Dialogs
  const [popupMsg, setPopupMsg] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState('Message');
  const [isErrorPopup, setIsErrorPopup] = useState(true);
  const [redirectOnClose, setRedirectOnClose] = useState(false);

  const timerRef = useRef<any>(null);

  // General Timer handler
  useEffect(() => {
    if (activeTab === 'forgot' && fTimerActive && fTimeLeft > 0) {
      timerRef.current = setInterval(() => {
        setFTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setFTimerActive(false);
            setFResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (activeTab === 'unlock' && uTimerActive && uTimeLeft > 0) {
      timerRef.current = setInterval(() => {
        setUTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setUTimerActive(false);
            setUResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTab, fTimerActive, fTimeLeft, uTimerActive, uTimeLeft]);

  const switchTab = (tab: 'forgot' | 'unlock') => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveTab(tab);
    setFStep(1);
    setUStep(1);
    setFTimerActive(false);
    setUTimerActive(false);
    setFOtp('');
    setFPass('');
    setFConf('');
    setUOtp('');
  };

  const showCustomDialog = (title: string, text: string, isErr: boolean, redirect = false) => {
    setPopupTitle(title);
    setPopupMsg(text);
    setIsErrorPopup(isErr);
    setRedirectOnClose(redirect);
    setShowPopup(true);
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    if (redirectOnClose) {
      navigate('/');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Forgot Password Logic ──
  const requestForgotOTP = async (isResend = false) => {
    if (!isResend) {
      setIsLoading(true);
    } else {
      setIsResending(true);
    }

    try {
      const res = await fetch('/api/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: fUser.trim(),
          dob: fDob,
          doj: fDoj,
          action: 'SEND_OTP'
        })
      });
      const data = await res.json();
      if (data.success) {
        setFStep(2);
        setFTimeLeft(300);
        setFTimerActive(true);
        setFResendDisabled(true);
        if (isResend) {
          showCustomDialog("OTP Sent", "A new verification code has been sent to your registered email.", false);
        }
      } else {
        showCustomDialog("Verification Failed", data.message || "Invalid details.", true);
      }
    } catch (e) {
      showCustomDialog("Error", "Server Connection Failed. Please try again.", true);
    } finally {
      setIsLoading(false);
      setIsResending(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fStep === 1) {
      await requestForgotOTP(false);
    } else {
      if (fPass !== fConf) {
        showCustomDialog("Error", "Passwords do not match!", true);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch('/api/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: fUser.trim(),
            dob: fDob,
            doj: fDoj,
            otp: fOtp.trim(),
            new_password: fPass,
            action: 'VERIFY_RESET'
          })
        });
        const data = await res.json();
        if (data.success) {
          if (timerRef.current) clearInterval(timerRef.current);
          showCustomDialog("Password Reset!", "Your password has been changed successfully.", false, true);
        } else {
          showCustomDialog("Failed", data.message || "OTP verification failed.", true);
        }
      } catch (e) {
        showCustomDialog("Error", "Update Failed. Server connection issue.", true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // ── Unlock Account Logic ──
  const requestUnlockOTP = async (isResend = false) => {
    if (!isResend) {
      setIsLoading(true);
    } else {
      setIsResending(true);
    }

    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uUser.trim(),
          e_code: uEcode.trim(),
          dob: uDob,
          doj: uDoj,
          action: 'SEND_OTP'
        })
      });
      const data = await res.json();
      if (data.success) {
        setUStep(2);
        setUTimeLeft(300);
        setUTimerActive(true);
        setUResendDisabled(true);
        if (isResend) {
          showCustomDialog("OTP Sent", "A new verification code has been sent to your registered email.", false);
        }
      } else {
        showCustomDialog("Verification Failed", data.message || "Invalid details.", true);
      }
    } catch (e) {
      showCustomDialog("Error", "Server Connection Failed. Please try again.", true);
    } finally {
      setIsLoading(false);
      setIsResending(false);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uStep === 1) {
      await requestUnlockOTP(false);
    } else {
      setIsLoading(true);
      try {
        const res = await fetch('/api/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: uUser.trim(),
            e_code: uEcode.trim(),
            dob: uDob,
            doj: uDoj,
            otp: uOtp.trim(),
            action: 'VERIFY_UNLOCK'
          })
        });
        const data = await res.json();
        if (data.success) {
          if (timerRef.current) clearInterval(timerRef.current);
          showCustomDialog("Account Unlocked!", "Your account has been unlocked successfully.", false, true);
        } else {
          showCustomDialog("Failed", data.message || "OTP verification failed.", true);
        }
      } catch (e) {
        showCustomDialog("Error", "Unlock Failed. Server connection issue.", true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="login-body">
      <div className="login-card">
        <div className="header-text">
          <img src="/logo.png" alt="Cyrix Logo" className="cyrix-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <h1>Account Help</h1>
          <p id="subtitle">Verify identity to proceed</p>
        </div>

        <div className="tab-container">
          <button
            className={`tab-btn ${activeTab === 'forgot' ? 'active' : ''}`}
            id="t-forgot"
            onClick={() => switchTab('forgot')}
          >
            Forgot Password
          </button>
          <button
            className={`tab-btn ${activeTab === 'unlock' ? 'active' : ''}`}
            id="t-unlock"
            onClick={() => switchTab('unlock')}
          >
            Unlock Account
          </button>
        </div>

        {/* Forgot Password Form */}
        {activeTab === 'forgot' && (
          <form onSubmit={handleForgotSubmit} id="forgotForm">
            {fStep === 1 ? (
              <div id="f-identity">
                <div className="form-group">
                  <label>User ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    id="f_user"
                    required
                    placeholder="RJ001"
                    value={fUser}
                    onChange={(e) => setFUser(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    id="f_dob"
                    required
                    value={fDob}
                    onChange={(e) => setFDob(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Joining <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    id="f_doj"
                    required
                    value={fDoj}
                    onChange={(e) => setFDoj(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div id="f-otp-section" className="otp-area">
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label>Verification Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    id="f_otp"
                    maxLength={6}
                    placeholder="000000"
                    value={fOtp}
                    onChange={(e) => setFOtp(e.target.value)}
                    style={{
                      textAlign: 'center',
                      letterSpacing: '8px',
                      fontWeight: 800,
                      fontSize: '18px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>

                <div className="otp-actions-wrap">
                  <div id="f_timerTextContainer" className="timer-text">
                    {fTimeLeft > 0 ? (
                      <>Expires in: <span id="f_countdownTimer" className="timer-countdown">{formatTime(fTimeLeft)}</span></>
                    ) : (
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>OTP Expired</span>
                    )}
                  </div>
                  <button
                    type="button"
                    id="f_resendOtpBtn"
                    className="resend-btn"
                    onClick={() => requestForgotOTP(true)}
                    disabled={fResendDisabled || isResending}
                  >
                    {isResending ? 'Sending...' : 'Resend OTP'}
                  </button>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>New Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="password"
                    id="f_pass"
                    required
                    placeholder="Enter new password"
                    value={fPass}
                    onChange={(e) => setFPass(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="password"
                    id="f_conf"
                    required
                    placeholder="Confirm new password"
                    value={fConf}
                    onChange={(e) => setFConf(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button type="submit" id="f_btn" className="submit-btn" disabled={isLoading} style={{ marginTop: '10px' }}>
              {isLoading ? (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Processing...
                </>
              ) : fStep === 1 ? (
                'Send OTP'
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}

        {/* Unlock Account Form */}
        {activeTab === 'unlock' && (
          <form onSubmit={handleUnlockSubmit} id="unlockForm">
            {uStep === 1 ? (
              <div id="u-identity">
                <div className="form-group">
                  <label>User ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    id="u_user"
                    required
                    placeholder="RJ001"
                    value={uUser}
                    onChange={(e) => setUUser(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>E-Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    id="u_ecode"
                    required
                    placeholder="EMP-XXX"
                    value={uEcode}
                    onChange={(e) => setUEcode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    id="u_dob"
                    required
                    value={uDob}
                    onChange={(e) => setUDob(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Joining <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    id="u_doj"
                    required
                    value={uDoj}
                    onChange={(e) => setUDoj(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div id="u-otp-section" className="otp-area">
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label>Verification Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    id="u_otp"
                    maxLength={6}
                    placeholder="000000"
                    value={uOtp}
                    onChange={(e) => setUOtp(e.target.value)}
                    style={{
                      textAlign: 'center',
                      letterSpacing: '8px',
                      fontWeight: 800,
                      fontSize: '18px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>

                <div className="otp-actions-wrap">
                  <div id="u_timerTextContainer" className="timer-text">
                    {uTimeLeft > 0 ? (
                      <>Expires in: <span id="u_countdownTimer" className="timer-countdown">{formatTime(uTimeLeft)}</span></>
                    ) : (
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>OTP Expired</span>
                    )}
                  </div>
                  <button
                    type="button"
                    id="u_resendOtpBtn"
                    className="resend-btn"
                    onClick={() => requestUnlockOTP(true)}
                    disabled={uResendDisabled || isResending}
                  >
                    {isResending ? 'Sending...' : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" id="u_btn" className="submit-btn" disabled={isLoading} style={{ marginTop: '10px' }}>
              {isLoading ? (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Processing...
                </>
              ) : uStep === 1 ? (
                'Send OTP'
              ) : (
                'Unlock Account'
              )}
            </button>
          </form>
        )}

        <div className="form-footer">
          <Link to="/">&larr; Back to Login</Link>
        </div>
      </div>

      <Popup
        message={popupMsg}
        show={showPopup}
        onClose={handlePopupClose}
        isError={isErrorPopup}
      />
    </div>
  );
}
