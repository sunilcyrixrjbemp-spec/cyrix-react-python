import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Concern {
  id: number;
  user_id: string;
  exp_id?: string;
  message: string;
  reply?: string;
  replied_by?: string;
  status: 'Open' | 'Resolved';
  created_at: string;
  updated_at: string;
  submitter_name: string;
  submitter_ecode: string;
  submitter_role: string;
}

interface UserClaim {
  exp_id: string;
  expense_date: string;
  total_amount: number;
  status: string;
}

interface Toast {
  msg: string;
  type: 'success' | 'danger' | 'info' | 'warning';
}

export default function HelpCenter() {
  const navigate = useNavigate();
  const currentUserId = (localStorage.getItem('logged_in_user_id') || '').replace(/['"]/g, '').trim();
  const userRole = localStorage.getItem('user_role') || 'Engineer';

  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [claims, setClaims] = useState<UserClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modals state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [activeConcern, setActiveConcern] = useState<Concern | null>(null);

  // Form states
  const [selectedClaimId, setSelectedClaimId] = useState('');
  const [concernMessage, setConcernMessage] = useState('');
  const [concernMessageError, setConcernMessageError] = useState(false);
  
  const [replyText, setReplyText] = useState('');
  const [replyTextError, setReplyTextError] = useState(false);

  const [isActionLoading, setIsActionLoading] = useState(false);

  const isManagement = ['Admin', 'Superadmin', 'Coordinator', 'Manager', 'Divisional Manager'].includes(userRole);

  const showToast = (msg: string, type: Toast['type'] = 'info') => {
    setToasts(prev => [...prev, { msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 4000);
  };

  useEffect(() => {
    if (!currentUserId) {
      navigate('/');
      return;
    }
    loadData();
    if (!isManagement) {
      loadUserClaims();
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/help_center?user_id=${currentUserId}`);
      const data = await res.json();
      if (data.success) {
        setConcerns(data.concerns || []);
      } else {
        showToast(data.message || 'Failed to retrieve concerns list.', 'danger');
      }
    } catch (err) {
      showToast('Network error loading Help Center data.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserClaims = async () => {
    try {
      const res = await fetch(`/api/month?user_id=${currentUserId}`);
      const data = await res.json();
      if (data.success) {
        setClaims(data.expenses || []);
      }
    } catch (err) {
      console.error('Failed to load user claims for dropdown', err);
    }
  };

  const handlePostConcern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concernMessage.trim()) {
      setConcernMessageError(true);
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await fetch('/api/help_center', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId
        },
        body: JSON.stringify({
          exp_id: selectedClaimId || null,
          message: concernMessage
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Concern registered successfully. A coordinator will reply soon.', 'success');
        setShowSubmitModal(false);
        setConcernMessage('');
        setSelectedClaimId('');
        loadData();
      } else {
        showToast(data.message || 'Failed to register concern.', 'danger');
      }
    } catch (err) {
      showToast('Network error while submitting concern.', 'danger');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConcern || !replyText.trim()) {
      setReplyTextError(true);
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await fetch('/api/help_center', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId
        },
        body: JSON.stringify({
          id: activeConcern.id,
          reply: replyText
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Reply saved and concern resolved.', 'success');
        setShowReplyModal(false);
        setReplyText('');
        setActiveConcern(null);
        loadData();
      } else {
        showToast(data.message || 'Failed to submit reply.', 'danger');
      }
    } catch (err) {
      showToast('Network error while saving reply.', 'danger');
    } finally {
      setIsActionLoading(false);
    }
  };

  const triggerReply = (c: Concern) => {
    setActiveConcern(c);
    setReplyText('');
    setReplyTextError(false);
    setShowReplyModal(true);
  };

  const getStatusBadge = (status: Concern['status']) => {
    return status === 'Resolved' ? (
      <span className="badge badge-success"><i className="fas fa-check-circle mr-1"></i> Resolved</span>
    ) : (
      <span className="badge badge-warning text-white"><i className="fas fa-hourglass-half mr-1"></i> Open</span>
    );
  };

  return (
    <div style={{ width: '100%' }}>
      {isLoading && (
        <div className="d-flex justify-content-center align-items-center" style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 9999 }}>
          <div className="text-center">
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
            <p className="mt-2 font-weight-bold">Loading Help desk concerns...</p>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="row align-items-center mb-4">
        <div className="col-sm-6">
          <h1 className="m-0 font-weight-bold text-dark h3">
            <i className="fas fa-question-circle mr-2 text-warning"></i> Help Center
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
            {isManagement 
              ? 'Answer queries and clarify concerns raised by field engineers regarding claims.'
              : 'Submit claims queries or disputes and check coordinator responses.'}
          </p>
        </div>
        <div className="col-sm-6 text-sm-right mt-3 mt-sm-0">
          {!isManagement && (
            <button className="btn btn-warning font-weight-bold text-dark" onClick={() => { setConcernMessage(''); setSelectedClaimId(''); setConcernMessageError(false); setShowSubmitModal(true); }}>
              <i className="fas fa-plus-circle mr-1"></i> Raise Concern
            </button>
          )}
          <button className="btn btn-outline-secondary ml-2" onClick={loadData}>
            <i className="fas fa-sync-alt mr-1"></i> Refresh
          </button>
        </div>
      </div>

      {/* CONCERNS LIST */}
      <div className="card card-warning card-outline shadow-sm border-0" style={{ borderRadius: '12px' }}>
        <div className="card-header border-0 bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
          <h5 className="font-weight-bold text-dark mb-0">Help Desk Queue</h5>
          <span className="badge badge-warning text-dark font-weight-bold">{concerns.length} total</span>
        </div>
        <div className="card-body p-0">
          {concerns.length === 0 ? (
            <div className="text-center p-5 text-muted">
              <i className="fas fa-check-circle fa-3x mb-3 text-success"></i>
              <p className="font-weight-bold mb-0">No concerns recorded.</p>
              <p className="text-muted mb-0" style={{ fontSize: '12px' }}>All queries have been successfully addressed.</p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="d-none d-md-block">
                <div className="table-responsive">
                  <table className="table table-striped table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
                    <thead className="bg-light text-secondary">
                      <tr>
                        <th>Concern ID</th>
                        {isManagement && <th>Engineer</th>}
                        <th>Claim ID</th>
                        <th>Query/Message</th>
                        <th>Status</th>
                        <th>Resolution / Reply</th>
                        {isManagement && <th className="text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {concerns.map((c) => (
                        <tr key={c.id}>
                          <td><span className="badge badge-light border text-monospace">CON-{c.id}</span></td>
                          {isManagement && (
                            <td>
                              <div className="font-weight-bold text-dark">{c.submitter_name}</div>
                              <small className="text-muted">{c.submitter_ecode} · {c.submitter_role}</small>
                            </td>
                          )}
                          <td>
                            {c.exp_id ? (
                              <span className="badge badge-light border text-monospace font-weight-bold">{c.exp_id}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td style={{ maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            <div className="text-dark font-weight-bold">{c.message}</div>
                            <small className="text-muted">Raised on {new Date(c.created_at).toLocaleString('en-IN')}</small>
                          </td>
                          <td>{getStatusBadge(c.status)}</td>
                          <td style={{ maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {c.reply ? (
                              <div className="p-2 border rounded bg-success-light text-success-dark">
                                <strong className="d-block text-uppercase" style={{ fontSize: '9px' }}>Replied by {c.replied_by}:</strong>
                                <span className="font-italic">"{c.reply}"</span>
                                <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>
                                  Resolved on {new Date(c.updated_at).toLocaleString('en-IN')}
                                </small>
                              </div>
                            ) : (
                              <span className="text-muted font-italic">Waiting for reply...</span>
                            )}
                          </td>
                          {isManagement && (
                            <td className="text-center">
                              {c.status === 'Open' ? (
                                <button className="btn btn-primary btn-xs px-3 py-1 font-weight-bold" onClick={() => triggerReply(c)}>
                                  <i className="fas fa-reply mr-1"></i> Reply
                                </button>
                              ) : (
                                <span className="text-muted font-italic" style={{ fontSize: '12px' }}>Resolved</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE CARD VIEW */}
              <div className="d-md-none p-3 bg-light">
                {concerns.map((c) => (
                  <div key={c.id} className="card card-warning card-outline shadow-sm mb-3">
                    <div className="card-header p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge badge-light border text-monospace">CON-{c.id}</span>
                        {c.exp_id && <span className="badge badge-secondary ml-2 font-weight-bold">{c.exp_id}</span>}
                      </div>
                      {getStatusBadge(c.status)}
                    </div>
                    <div className="card-body p-3 text-secondary" style={{ fontSize: '13px', lineHeight: '1.6' }}>
                      {isManagement && (
                        <div className="mb-2 pb-2 border-bottom">
                          <strong>Engineer:</strong> {c.submitter_name} ({c.submitter_ecode})
                        </div>
                      )}
                      <div className="mb-2">
                        <strong>Concern Query:</strong>
                        <p className="text-dark font-weight-bold mb-1">{c.message}</p>
                        <small className="text-muted">Raised at {new Date(c.created_at).toLocaleString('en-IN')}</small>
                      </div>

                      {c.reply ? (
                        <div className="p-2 border rounded bg-success-light text-success mt-2">
                          <strong className="d-block text-uppercase" style={{ fontSize: '8px' }}>Replied by {c.replied_by}:</strong>
                          <span className="font-italic">"{c.reply}"</span>
                          <small className="d-block text-muted mt-1" style={{ fontSize: '9px' }}>
                            Resolved at {new Date(c.updated_at).toLocaleString('en-IN')}
                          </small>
                        </div>
                      ) : (
                        <div className="mt-2 text-muted font-italic">Waiting for resolution...</div>
                      )}

                      {isManagement && c.status === 'Open' && (
                        <div className="mt-3 pt-2 border-top text-right">
                          <button className="btn btn-primary btn-xs py-1 px-3" onClick={() => triggerReply(c)}>
                            <i className="fas fa-reply mr-1"></i> Reply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* BOOTSTRAP SUBMIT CONCERN MODAL (For Engineers) */}
      {showSubmitModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex={-1} role="dialog" onClick={() => setShowSubmitModal(false)}>
            <div className="modal-dialog modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-warning text-dark border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-dark"><i className="fas fa-question-circle mr-2"></i> Raise Claim Concern</h5>
                  <button type="button" className="close" onClick={() => setShowSubmitModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <form onSubmit={handlePostConcern}>
                  <div className="modal-body p-4">
                    <div className="form-group mb-3">
                      <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Select Related Claim (Optional)</label>
                      <select 
                        className="form-control"
                        value={selectedClaimId}
                        onChange={(e) => setSelectedClaimId(e.target.value)}
                      >
                        <option value="">No Specific Claim (General Issue)</option>
                        {claims.map((claim) => (
                          <option key={claim.exp_id} value={claim.exp_id}>
                            {claim.exp_id} ({new Date(claim.expense_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}) — ₹{claim.total_amount} [{claim.status}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group mb-3">
                      <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>State your query or issue <span className="text-danger">*</span></label>
                      <textarea
                        className={`form-control ${concernMessageError ? 'is-invalid' : ''}`}
                        rows={4}
                        placeholder="Please details the problem, error, or clarification needed..."
                        value={concernMessage}
                        onChange={(e) => { setConcernMessage(e.target.value); setConcernMessageError(false); }}
                        required
                      />
                      {concernMessageError && <div className="invalid-feedback font-weight-bold">Concern description is required.</div>}
                    </div>
                  </div>
                  <div className="modal-footer bg-light border-top-0 justify-content-end p-3">
                    <button type="button" className="btn btn-secondary px-4 btn-sm" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-warning px-4 btn-sm text-dark font-weight-bold" disabled={isActionLoading}>
                      {isActionLoading ? 'Submitting...' : 'Submit Concern'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BOOTSTRAP REPLY MODAL (For Management) */}
      {showReplyModal && activeConcern && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex={-1} role="dialog" onClick={() => setShowReplyModal(false)}>
            <div className="modal-dialog modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-primary text-white border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-white"><i className="fas fa-reply mr-2 text-white"></i> Answer Concern Query</h5>
                  <button type="button" className="close text-white" onClick={() => setShowReplyModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <form onSubmit={handlePostReply}>
                  <div className="modal-body p-4">
                    <div className="p-3 border rounded bg-light mb-3" style={{ fontSize: '13px' }}>
                      <strong className="text-secondary d-block text-uppercase mb-1" style={{ fontSize: '9px' }}>Engineer query:</strong>
                      <span className="font-weight-bold text-dark">"{activeConcern.message}"</span>
                      {activeConcern.exp_id && <small className="d-block text-muted mt-1 font-weight-bold">Claim reference: {activeConcern.exp_id}</small>}
                    </div>

                    <div className="form-group mb-3">
                      <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Your reply / Resolution explanation <span className="text-danger">*</span></label>
                      <textarea
                        className={`form-control ${replyTextError ? 'is-invalid' : ''}`}
                        rows={4}
                        placeholder="State what needs to be changed, why it was actioned, or provide instructions..."
                        value={replyText}
                        onChange={(e) => { setReplyText(e.target.value); setReplyTextError(false); }}
                        required
                      />
                      {replyTextError && <div className="invalid-feedback font-weight-bold">Reply text is required.</div>}
                    </div>
                  </div>
                  <div className="modal-footer bg-light border-top-0 justify-content-end p-3">
                    <button type="button" className="btn btn-secondary px-4 btn-sm" onClick={() => setShowReplyModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary px-4 btn-sm" disabled={isActionLoading}>
                      {isActionLoading ? 'Saving...' : 'Resolve & Close'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TOAST LIST */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, pointerEvents: 'none' }}>
        {toasts.map((toast, idx) => {
          let bg = 'bg-info text-white';
          let icon = 'fas fa-info-circle';
          if (toast.type === 'success') { bg = 'bg-success text-white'; icon = 'fas fa-check-circle'; }
          if (toast.type === 'danger') { bg = 'bg-danger text-white'; icon = 'fas fa-exclamation-circle'; }
          if (toast.type === 'warning') { bg = 'bg-warning text-dark'; icon = 'fas fa-exclamation-triangle'; }

          return (
            <div key={idx} className={`toast show border-0 shadow-lg ${bg} mb-2`} style={{ minWidth: '250px', borderRadius: '8px', pointerEvents: 'auto', opacity: 0.95 }}>
              <div className="toast-body p-3 d-flex align-items-center">
                <i className={`${icon} mr-2`} style={{ fontSize: '18px' }}></i>
                <span className="font-weight-bold">{toast.msg}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
