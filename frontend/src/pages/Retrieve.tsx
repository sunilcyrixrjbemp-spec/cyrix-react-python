import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../css/retrieve.css';
import Popup from '../components/Popup';

export default function Retrieve() {
  const navigate = useNavigate();
  const [rStep, setRStep] = useState(1);
  const [rEcode, setREcode] = useState('');
  const [rDob, setRDob] = useState('');
  const [rDoj, setRDoj] = useState('');
  const [rOtp, setROtp] = useState('');
  const [retrievedId, setRetrievedId] = useState('');

  // Timer state
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins
  const [timerActive, setTimerActive] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Dialogs
  const [popupMsg, setPopupMsg] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState('Message');
  const [isErrorPopup, setIsErrorPopup] = useState(true);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerActive(false);
            setResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timeLeft]);

  const showCustomDialog = (title: string, text: string, isErr: boolean) => {
    setPopupTitle(title);
    setPopupMsg(text);
    setIsErrorPopup(isErr);
    setShowPopup(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const requestOTP = async (isResend = false) => {
    if (!isResend) {
      setIsLoading(true);
    } else {
      setIsResending(true);
    }

    try {
      const res = await fetch('/api/retrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          e_code: rEcode.trim(),
          dob: rDob,
          doj: rDoj,
          action: 'SEND_OTP'
        })
      });
      const data = await res.json();
      if (data.success) {
        setRStep(2);
        setTimeLeft(300);
        setTimerActive(true);
        setResendDisabled(true);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rStep === 1) {
      await requestOTP(false);
    } else {
      setIsLoading(true);
      try {
        const res = await fetch('/api/retrive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            e_code: rEcode.trim(),
            dob: rDob,
            doj: rDoj,
            otp: rOtp.trim(),
            action: 'VERIFY_RETRIEVE'
          })
        });
        const data = await res.json();
        if (data.success) {
          if (timerRef.current) clearInterval(timerRef.current);
          setRetrievedId(data.user_id);
        } else {
          showCustomDialog("Failed", data.message || "OTP verification failed.", true);
        }
      } catch (e) {
        showCustomDialog("Error", "Retrieval Failed. Server connection issue.", true);
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
          <h1>Retrieve ID</h1>
          {!retrievedId && <p id="subtitle">Verify identity to proceed</p>}
        </div>

        {retrievedId ? (
          <div id="idDisplay" style={{ display: 'block', textAlign: 'center', margin: '20px 0' }}>
            <div className="success-icon-wrapper" style={{ width: '60px', height: '60px', background: 'var(--success-light)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 style={{ color: 'var(--primary-dark)', fontSize: '18px', marginBottom: '8px', fontWeight: 800 }}>ID Found!</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '20px', fontWeight: 500 }}>Your registered User ID is:</p>
            <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '12px', fontSize: '20px', fontWeight: 800, color: 'var(--primary-dark)', border: '1px solid var(--border)', letterSpacing: '1px', marginBottom: '24px' }}>
              <span id="resultId">{retrievedId}</span>
            </div>
            <Link to="/" className="submit-btn" style={{ textDecoration: 'none', display: 'block', margin: 0, textAlign: 'center', lineHeight: '20px' }}>
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} id="retriveForm">
            {rStep === 1 ? (
              <div id="r-inputs">
                <div className="form-group">
                  <label>E-Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    id="r_ecode"
                    required
                    placeholder="EMP-XXX"
                    value={rEcode}
                    onChange={(e) => setREcode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    id="r_dob"
                    required
                    value={rDob}
                    onChange={(e) => setRDob(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Joining <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    id="r_doj"
                    required
                    value={rDoj}
                    onChange={(e) => setRDoj(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div id="r-otp-section" className="otp-area">
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label>Verification Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    id="r_otp"
                    maxLength={6}
                    placeholder="000000"
                    value={rOtp}
                    onChange={(e) => setROtp(e.target.value)}
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
                  <div id="timerTextContainer" className="timer-text">
                    {timeLeft > 0 ? (
                      <>Expires in: <span id="countdownTimer" className="timer-countdown">{formatTime(timeLeft)}</span></>
                    ) : (
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>OTP Expired</span>
                    )}
                  </div>
                  <button
                    type="button"
                    id="resendOtpBtn"
                    className="resend-btn"
                    onClick={() => requestOTP(true)}
                    disabled={resendDisabled || isResending}
                  >
                    {isResending ? 'Sending...' : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" id="r_btn" className="submit-btn" disabled={isLoading} style={{ marginTop: '10px' }}>
              {isLoading ? (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Processing...
                </>
              ) : rStep === 1 ? (
                'Send OTP'
              ) : (
                'Retrieve ID'
              )}
            </button>

            <div className="form-footer">
              <Link to="/">&larr; Back to Login</Link>
            </div>
          </form>
        )}
      </div>

      <Popup
        message={popupMsg}
        show={showPopup}
        onClose={() => setShowPopup(false)}
        isError={isErrorPopup}
      />
    </div>
  );
}
