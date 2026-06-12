import React from 'react';

interface LoaderProps {
  message?: string;
  show?: boolean;
}

export default function Loader({ message = "Loading...", show = false }: LoaderProps) {
  if (!show) return null;
  return (
    <div className="modern-loader-overlay">
      <style>{`
        .modern-loader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(12px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 99999;
          animation: fadeIn 0.3s ease;
        }

        .modern-loader-card {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 32px;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          max-width: 250px;
          text-align: center;
        }

        .modern-spinner {
          width: 48px;
          height: 48px;
          position: relative;
        }

        .double-bounce1, .double-bounce2 {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: var(--primary, #3b82f6);
          opacity: 0.6;
          position: absolute;
          top: 0;
          left: 0;
          animation: sk-bounce 2.0s infinite ease-in-out;
        }

        .double-bounce2 {
          animation-delay: -1.0s;
          background-color: var(--primary-dark, #1d4ed8);
        }

        .modern-loader-text {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-1, #1e293b);
          letter-spacing: 0.5px;
        }

        @keyframes sk-bounce {
          0%, 100% { 
            transform: scale(0.0);
          } 50% { 
            transform: scale(1.0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div className="modern-loader-card">
        <div className="modern-spinner">
          <div className="double-bounce1"></div>
          <div className="double-bounce2"></div>
        </div>
        <div className="modern-loader-text">{message}</div>
      </div>
    </div>
  );
}
