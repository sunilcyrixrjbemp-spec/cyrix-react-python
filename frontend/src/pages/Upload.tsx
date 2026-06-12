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
    <div className="container-fluid pt-3">
      {/* Page Header */}
      <div className="row mb-3 align-items-center">
        <div className="col-sm-6">
          <h1 className="m-0 font-weight-bold text-dark"><i className="fas fa-cloud-upload-alt mr-2 text-primary"></i> Data Sync</h1>
        </div>
      </div>

      <div className="card card-primary card-outline shadow-sm mb-4">
        <div className="card-header p-0 border-bottom-0">
          <ul className="nav nav-tabs" id="custom-tabs-four-tab" role="tablist" style={{ padding: '10px 10px 0' }}>
            <li className="nav-item">
              <button className={`nav-link ${currentTab === 'asset' ? 'active' : ''}`} onClick={() => switchTab('asset')} style={{ fontWeight: 600, border: 'none', background: 'transparent' }}>
                Asset Report
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${currentTab === 'penalty' ? 'active' : ''}`} onClick={() => switchTab('penalty')} style={{ fontWeight: 600, border: 'none', background: 'transparent' }}>
                Penalty Report
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${currentTab === 'revenue' ? 'active' : ''}`} onClick={() => switchTab('revenue')} style={{ fontWeight: 600, border: 'none', background: 'transparent' }}>
                Revenue Report
              </button>
            </li>
          </ul>
        </div>
        
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <h4 className="font-weight-bold text-dark m-0">
              {report.title}
            </h4>
            <button className="btn btn-outline-primary btn-sm" onClick={downloadTemplate}>
              <i className="fas fa-download mr-1"></i> CSV Template
            </button>
          </div>

          {/* Drop Zone */}
          {!selectedFile && (
            <div
              className={`border border-dashed border-primary rounded p-5 text-center bg-light ${isDragOver ? 'bg-secondary' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ cursor: 'pointer', transition: 'background-color 0.2s', borderStyle: 'dashed', borderWidth: '2px' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" id="csvFile" accept=".csv" onChange={handleFileSelect} ref={fileInputRef} style={{ display: 'none' }} />
              <div>
                <div className="text-primary mb-3" style={{ fontSize: '32px' }}>
                  <i className="fas fa-cloud-upload-alt"></i>
                </div>
                <h5 className="font-weight-bold text-dark">Drop your CSV file here</h5>
                <p className="text-muted mb-2">or click to browse from your device</p>
                <small className="text-secondary d-block">Only .csv files accepted • Max size 50MB • Up to 2,00,000 rows at once</small>
              </div>
            </div>
          )}

          {/* File Preview */}
          {selectedFile && (
            <div className="alert alert-success d-flex align-items-center justify-content-between p-3 mb-3" role="alert" style={{ background: '#d1f7ec', color: '#0d7a5f', border: '1px solid #a2eed8' }}>
              <div className="d-flex align-items-center">
                <i className="fas fa-file-csv fa-2x mr-3"></i>
                <div>
                  <h6 className="alert-heading font-weight-bold mb-1" style={{ color: '#0d7a5f' }}>{selectedFile.name}</h6>
                  <p className="mb-0 small">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); removeFile(); }} disabled={isProcessing}>
                <i className="fas fa-times-circle mr-1"></i> Remove
              </button>
            </div>
          )}

          {/* Progress */}
          {showProgress && (
            <div className="progress-group mb-3">
              <span className="progress-text font-weight-bold text-muted">{progressLabel}</span>
              <span className="float-right progress-number"><b>{Math.round(progressPct)}%</b></span>
              <div className="progress progress-sm" style={{ height: '8px', background: '#dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="progress-bar bg-primary" style={{ width: `${progressPct}%`, height: '100%' }}></div>
              </div>
            </div>
          )}

          {/* Result Summary */}
          {uploadResult && (
            <div className="mt-4">
              <div className="row text-center mb-3">
                <div className="col-3 border-right">
                  <h3 className="font-weight-bold text-success m-0">{uploadResult.inserted || 0}</h3>
                  <span className="text-muted text-uppercase small font-weight-bold">Inserted</span>
                </div>
                {uploadResult.updated !== undefined && (
                  <div className="col-3 border-right">
                    <h3 className="font-weight-bold text-info m-0">{uploadResult.updated || 0}</h3>
                    <span className="text-muted text-uppercase small font-weight-bold">Updated</span>
                  </div>
                )}
                <div className="col-3 border-right">
                  <h3 className="font-weight-bold text-secondary m-0">{uploadResult.skipped || 0}</h3>
                  <span className="text-muted text-uppercase small font-weight-bold">Skipped</span>
                </div>
                <div className="col-3">
                  <h3 className="font-weight-bold text-danger m-0">{uploadResult.errors || 0}</h3>
                  <span className="text-muted text-uppercase small font-weight-bold">Failed</span>
                </div>
              </div>

              {fails.length > 0 && (
                <div className="card card-danger card-outline mb-0">
                  <div className="card-header py-2">
                    <h6 className="card-title font-weight-bold text-danger m-0">
                      <i className="fas fa-exclamation-triangle mr-1"></i> Error Log Details
                    </h6>
                  </div>
                  <div className="card-body p-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <ul className="pl-3 mb-0 text-danger small">
                      {fails.slice(0, 100).map((f, i) => (
                        <li key={i}>Row {f.row} — {f.id}: {f.reason}</li>
                      ))}
                      {fails.length > 100 && <li>...and {fails.length - 100} more</li>}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="card-footer bg-light d-flex align-items-center justify-content-between py-3 flex-wrap gap-2">
          <span className="text-muted small">
            {selectedFile ? `📄 ${selectedFile.name} ready to upload` : 'Select a CSV file to proceed with upload'}
          </span>
          <button className="btn btn-primary" onClick={uploadCSV} disabled={!selectedFile || isProcessing}>
            {isProcessing ? (
              <>
                <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>
                Processing...
              </>
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt mr-1"></i> Upload CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* TOAST SYSTEM */}
      <div className="toast-container" style={{ position: 'fixed', bottom: '80px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' }}>
        {toasts.map((toast) => {
          const colors: Record<string, string> = { success: '#28a745', danger: '#dc3545', error: '#dc3545', warning: '#ffc107', info: '#17a2b8' };
          return (
            <div
              key={toast.id}
              className={`toast show`}
              style={{
                background: 'white',
                color: colors[toast.type] || colors.info,
                padding: '12px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderLeft: `4px solid ${colors[toast.type] || colors.info}`,
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <i className={toast.type === 'success' ? 'fas fa-check-circle' : toast.type === 'error' || toast.type === 'danger' ? 'fas fa-times-circle' : 'fas fa-info-circle'}></i>
              <span>{toast.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
