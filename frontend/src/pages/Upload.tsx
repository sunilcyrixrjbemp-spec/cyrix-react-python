import React, { useState, useRef } from 'react';
import '../css/style.css';
import '../css/upload.css';


interface UploadResult {
  success: boolean;
  inserted: number;
  updated?: number;
  skipped: number;
  errors: number;
  failLog: {
    row: number;
    id: string;
    reason: string;
  }[];
}

interface Toast {
  id: number;
  msg: string;
  type: string;
}

const REPORT_TYPES = {
  asset: {
    title: 'Asset Report Upload',
    endpoint: '/api/upload/asset',
    columns: ['District Name', 'Hospital Name', 'Equipment Name', 'QR Code', 'Asset Value'],
    template: 'asset_template.csv',
    icon: (
      <svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
        <path d="M3 21h18" />
        <path d="M9 10h.01" />
        <path d="M15 10h.01" />
        <path d="M9 14h.01" />
        <path d="M15 14h.01" />
        <path d="M9 18h.01" />
        <path d="M15 18h.01" />
      </svg>
    )
  },
  penalty: {
    title: 'Penalty Report Upload',
    endpoint: '/api/upload/penalty',
    columns: ['District Name', 'Hospital Type', 'Hospital Name', 'Bar Code', 'Equipment Name', 'Complaint ID', 'Complaint Raise Date', 'Complaint Close date', 'Complaint Status', 'Attend Date', 'Attend Penalty', 'Penalty', 'Total Penalty', 'Attend Engineer ID', 'Close Engineer ID', 'Open Month', 'Close Month'],
    template: 'penalty_template.csv',
    icon: (
      <svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  },
  revenue: {
    title: 'Revenue Report Upload',
    endpoint: '/api/upload/revenue',
    columns: ['District Name', 'DM Name', 'Facility Type', 'DI Name', 'Billing Amount', 'Open Penalty Feb', 'Purchase (Spare + Service)', 'CAMC', 'Total(Penalty+Purchase+CAMC)', 'R/M Achieved %', 'R & M Traget', 'Eligibility Month'],
    template: 'revenue_template.csv',
    icon: (
      <svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    )
  }
};

export default function Upload() {
  const [currentTab, setCurrentTab] = useState<'asset' | 'penalty' | 'revenue'>('asset');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload Progress
  const [showProgress, setShowProgress] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Initializing Upload...');

  // Results State
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (type: string, msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const switchTab = (tab: 'asset' | 'penalty' | 'revenue') => {
    setCurrentTab(tab);
    removeFile();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      showToast('error', 'Only .csv files accepted!');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast('error', 'File too large. Max 50MB.');
      return;
    }
    setSelectedFile(file);
    setUploadResult(null);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadResult(null);
    setShowProgress(false);
    setProgressPct(0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const downloadTemplate = () => {
    const report = REPORT_TYPES[currentTab];
    const csvContent = report.columns.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = report.template;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', `${report.template} downloaded successfully!`);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const readFirstLine = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const blob = file.slice(0, 4096);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const nl = text.indexOf('\n');
        resolve(nl === -1 ? text : text.substring(0, nl));
      };
      reader.onerror = reject;
      reader.readAsText(blob);
    });
  };

  const fakeProgress = (from: number, to: number, duration: number, callback: (pct: number) => void) => {
    const steps = 30;
    const stepDur = duration / steps;
    const stepVal = (to - from) / steps;
    let current = from;
    return setInterval(() => {
      current = Math.min(current + stepVal, to);
      callback(current);
    }, stepDur);
  };

  const uploadCSV = async () => {
    if (!selectedFile) return;
    const report = REPORT_TYPES[currentTab];

    setIsProcessing(true);
    setShowProgress(true);
    setProgressPct(0);
    setProgressLabel('Reading file structure...');

    try {
      const firstLine = await readFirstLine(selectedFile);
      const headerCols = firstLine.split(',').map((c) => c.trim().replace(/^"|"$/g, '').toLowerCase());
      const expectedCols = report.columns.map((c) => c.trim().toLowerCase());
      const missing = expectedCols.filter((ec) => !headerCols.includes(ec));

      if (missing.length > 0) {
        showToast('error', `Missing columns: ${missing.join(', ')}`);
        setIsProcessing(false);
        setTimeout(() => setShowProgress(false), 2000);
        return;
      }

      setProgressPct(20);
      setProgressLabel('Transmitting data to server...');

      const formData = new FormData();
      formData.append('file', selectedFile);

      // Fake timer to bridge server wait
      const interval = fakeProgress(20, 85, 2000, (pct) => {
        setProgressPct(pct);
      });

      const response = await fetch(report.endpoint, {
        method: 'POST',
        body: formData
      });

      clearInterval(interval);
      setProgressPct(95);
      setProgressLabel('Finalizing database injection...');

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `HTTP Error ${response.status}`);
      }

      const result = await response.json();
      setProgressPct(100);
      setProgressLabel('Upload Complete!');

      setUploadResult(result);
      showToast('success', `Upload complete! ${result.inserted} inserted, ${result.skipped} skipped.`);
    } catch (err: any) {
      showToast('error', 'Upload failed: ' + err.message);
      setProgressPct(0);
      setProgressLabel('Upload failed.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setShowProgress(false), 2000);
    }
  };

  const report = REPORT_TYPES[currentTab];
  const fails = uploadResult ? (uploadResult.failLog || []).filter((f) => f && f.reason && !f.reason.includes('Skipped') && !f.reason.includes('Duplicate')) : [];

  return (
    <div style={{ padding: '0 32px 40px' }} className="content-area">
      {/* Desktop Header */}
      <div className="page-header desktop-only" style={{ padding: '32px 0 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="page-header-icon" style={{ width: '44px', height: '44px', background: 'var(--primary-50)', color: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0 }} className="page-title">Bulk Data Upload</h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-3)' }}>Upload CSV files for Asset, Penalty, and Revenue reports directly into the database.</p>
        </div>
      </div>

      <div className="upload-container">
        {/* Tab Bar */}
        <div className="tab-bar">
          <button className={`tab-btn ${currentTab === 'asset' ? 'active' : ''}`} onClick={() => switchTab('asset')}>
            {REPORT_TYPES.asset.icon}
            Asset Report
          </button>
          <button className={`tab-btn ${currentTab === 'penalty' ? 'active' : ''}`} onClick={() => switchTab('penalty')}>
            {REPORT_TYPES.penalty.icon}
            Penalty Report
          </button>
          <button className={`tab-btn ${currentTab === 'revenue' ? 'active' : ''}`} onClick={() => switchTab('revenue')}>
            {REPORT_TYPES.revenue.icon}
            Revenue Report
          </button>
        </div>

        {/* Upload Card */}
        <div className="upload-card">
          <div className="upload-card-header">
            <h2 id="card-title">
              {report.icon}
              {report.title}
            </h2>
            <button className="btn-ghost" onClick={downloadTemplate}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginRight: '6px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              CSV Template
            </button>
          </div>

          {/* Drop Zone */}
          {!selectedFile && (
            <div
              className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
              id="dropZone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input type="file" id="csvFile" accept=".csv" onChange={handleFileSelect} ref={fileInputRef} />
              <div className="drop-icon">
                <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3>Drop your CSV file here</h3>
              <p>or click to browse from your device</p>
              <small>Only .csv files accepted • Max size 50MB • Up to 2,00,000 rows at once</small>
            </div>
          )}

          {/* File Preview */}
          {selectedFile && (
            <div className="file-preview show" id="filePreview">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--success)', marginRight: '8px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <div className="file-preview-info">
                <div className="file-preview-name">{selectedFile.name}</div>
                <div className="file-preview-size">{formatFileSize(selectedFile.size)}</div>
              </div>
              <button className="file-preview-remove" onClick={removeFile} disabled={isProcessing}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Progress */}
          {showProgress && (
            <div className="progress-wrap show" id="progressWrap">
              <div className="progress-label">
                <span>{progressLabel}</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="progress-bar-outer">
                <div className="progress-bar-inner" style={{ width: `${progressPct}%` }}></div>
              </div>
            </div>
          )}

          {/* Result Summary */}
          {uploadResult && (
            <div className="upload-result show">
              <div className="result-summary">
                <div className="result-box success">
                  <div className="result-icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></div>
                  <div className="result-box-num">{uploadResult.inserted || 0}</div>
                  <div className="result-box-label">Rows Inserted</div>
                </div>
                {uploadResult.updated !== undefined && (
                  <div className="result-box success">
                    <div className="result-icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg></div>
                    <div className="result-box-num">{uploadResult.updated || 0}</div>
                    <div className="result-box-label">Rows Updated</div>
                  </div>
                )}
                <div className="result-box skip">
                  <div className="result-icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg></div>
                  <div className="result-box-num">{uploadResult.skipped || 0}</div>
                  <div className="result-box-label">Rows Skipped</div>
                </div>
                <div className="result-box error">
                  <div className="result-icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></div>
                  <div className="result-box-num">{uploadResult.errors || 0}</div>
                  <div className="result-box-label">Rows Failed</div>
                </div>
              </div>

              {fails.length > 0 && (
                <div className="error-list" style={{ display: 'block' }}>
                  <h4>
                    <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Error Details Log
                  </h4>
                  <ul>
                    {fails.slice(0, 100).map((f, i) => (
                      <li key={i}>Row {f.row} — {f.id}: {f.reason}</li>
                    ))}
                    {fails.length > 100 && <li>...and {fails.length - 100} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="upload-footer">
            <span className="upload-footer-note">
              {selectedFile ? `📄 ${selectedFile.name} ready to upload` : 'Select a CSV file to proceed with upload'}
            </span>
            <button className="btn-primary" onClick={uploadCSV} disabled={!selectedFile || isProcessing}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isProcessing ? (
                  <>
                    <span className="spinner"></span>
                    Processing Data...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload CSV
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* TOAST SYSTEM */}
      <div className="toast-container">
        {toasts.map((toast) => {
          const colors: Record<string, string> = { success: 'var(--success)', danger: 'var(--danger)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' };
          return (
            <div
              key={toast.id}
              className={`toast ${toast.type}`}
              style={{
                background: 'white',
                color: colors[toast.type] || colors.info,
                padding: '14px 20px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: 'var(--shadow-md)',
                borderLeft: `4px solid ${colors[toast.type] || colors.info}`,
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                {toast.type === 'success' ? (
                  <svg className="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                ) : toast.type === 'error' ? (
                  <svg className="svg-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                ) : (
                  <svg className="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                )}
              </div>
              <span>{toast.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
