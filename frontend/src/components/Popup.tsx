import React from 'react';

interface PopupProps {
  message: string;
  show: boolean;
  onClose: () => void;
  isError?: boolean;
}

export default function Popup({ message, show, onClose, isError = true }: PopupProps) {
  if (!show) return null;
  return (
    <>
      <div className="popup-overlay" style={{ display: 'block' }} onClick={onClose}></div>
      <div className="custom-popup" style={{ display: 'block' }}>
        <div className={isError ? "error-icon-wrapper" : "icon-wrapper success"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isError ? (
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
        </div>
        <h3 id="popupMsg" style={{ color: 'var(--primary-dark)', fontSize: '16px', marginBottom: '24px', fontWeight: 700, lineHeight: 1.4 }}>
          {message}
        </h3>
        <button className="submit-btn" onClick={onClose} style={{ margin: 0 }}>
          OK, Got it
        </button>
      </div>
    </>
  );
}
