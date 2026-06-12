import React from 'react';

interface SuccessPopupProps {
  show?: boolean;
  title?: string;
  message?: string;
  amount?: number;
  date?: string;
  claimId?: string;
  onClose?: () => void;
  actionLabel?: string;
}

export default function SuccessPopup({
  show = false,
  title = "Claim Submitted Successfully!",
  message = "We have received your claim and a notification has been sent for approval.",
  amount,
  date,
  claimId,
  onClose,
  actionLabel = "Back to Dashboard"
}: SuccessPopupProps) {
  if (!show) return null;

  return (
    <div className="success-popup-overlay">
      <style>{`
        .success-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(16px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 99999;
          animation: popupFadeIn 0.3s ease;
        }

        .success-popup-card {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 24px;
          box-shadow: 0 30px 60px rgba(15, 23, 42, 0.15);
          width: 100%;
          max-width: 440px;
          padding: 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: popupSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
          margin: 16px;
        }

        .success-checkmark-wrapper {
          margin-bottom: 24px;
        }

        .animated-check {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: block;
          stroke-width: 4;
          stroke: #059669;
          stroke-miterlimit: 10;
          box-shadow: inset 0px 0px 0px #059669;
          animation: checkFill 0.4s ease-in-out 0.4s forwards, checkScale 0.3s ease-in-out 0s both;
        }

        .animated-check-circle {
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          stroke-width: 4;
          stroke-miterlimit: 10;
          stroke: #059669;
          fill: none;
          animation: checkStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }

        .animated-check-path {
          transform-origin: 50% 50%;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: checkStroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
        }

        .success-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 8px;
          letter-spacing: -0.3px;
        }

        .success-desc {
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          line-height: 1.5;
          margin: 0 0 28px;
        }

        .success-receipt-card {
          width: 100%;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 32px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .receipt-label {
          color: #64748b;
          font-weight: 600;
        }

        .receipt-value {
          color: #1e293b;
          font-weight: 700;
        }

        .receipt-value.price {
          color: #0f172a;
          font-size: 16px;
          font-weight: 800;
        }

        .success-action-btn {
          width: 100%;
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.1s ease;
          box-shadow: 0 4px 12px rgba(37,99,235,0.25);
        }

        .success-action-btn:hover {
          background: #1d4ed8;
        }

        .success-action-btn:active {
          transform: scale(0.98);
        }

        @keyframes checkStroke {
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes checkScale {
          0%, 100% {
            transform: none;
          }
          50% {
            transform: scale3d(1.1, 1.1, 1);
          }
        }

        @keyframes checkFill {
          100% {
            box-shadow: inset 0px 0px 0px 40px #d1fae5;
          }
        }

        @keyframes popupFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes popupSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div className="success-popup-card">
        <div className="success-checkmark-wrapper">
          <svg className="animated-check" viewBox="0 0 52 52">
            <circle className="animated-check-circle" cx="26" cy="26" r="25" fill="none" />
            <path className="animated-check-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>

        <h3 className="success-title">{title}</h3>
        <p className="success-desc">{message}</p>

        {(amount !== undefined || claimId || date) && (
          <div className="success-receipt-card">
            {claimId && (
              <div className="receipt-row">
                <span className="receipt-label">Claim ID</span>
                <span className="receipt-value mono">{claimId}</span>
              </div>
            )}
            {date && (
              <div className="receipt-row">
                <span className="receipt-label">Expense Date</span>
                <span className="receipt-value">{date}</span>
              </div>
            )}
            {amount !== undefined && (
              <div className="receipt-row" style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px', marginTop: '4px' }}>
                <span className="receipt-label" style={{ color: '#0f172a', fontWeight: 700 }}>Total Amount</span>
                <span className="receipt-value price">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        )}

        <button className="success-action-btn" onClick={onClose}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
