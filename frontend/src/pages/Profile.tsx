import React, { useState, useEffect } from 'react';
import '../css/profile.css';
import Loader from '../components/Loader';

interface ProfileData {
  user_id: string;
  e_code: string;
  full_name: string;
  designation: string;
  mobile_number: string;
  mail_id: string;
  zone_name: string;
  district_name: string;
  role: string;
  grade: string;
  level_first_approver: string;
  level_second_approver: string;
  date_of_birth?: string;
  date_joining?: string;
  e_upkaran_id?: string;
  reportees?: any[];
}

interface TeamMember {
  user_id: string;
  full_name: string;
  designation: string;
  role: string;
  e_code: string;
  manager_name: string;
}

interface HistoryItem {
  id: string;
  name: string;
}

export default function Profile() {
  const [profileHistory, setProfileHistory] = useState<HistoryItem[]>([]);
  const [currentProfile, setCurrentProfile] = useState<ProfileData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState('Loading Profile...');
  const [userRole, setUserRole] = useState('');
  const [myUserId, setMyUserId] = useState('');

  // Password Change Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // Profile Request State
  const [updateAllowed, setUpdateAllowed] = useState(true);
  const [updateCheckMsg, setUpdateCheckMsg] = useState('');
  const [reqSuccess, setReqSuccess] = useState('');
  const [reqError, setReqError] = useState('');

  // Form edit fields
  const [editName, setEditName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editDoj, setEditDoj] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUpkaran, setEditUpkaran] = useState('');
  const [editZone, setEditZone] = useState('');
  const [editDistrict, setEditDistrict] = useState('');

  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);

  const showToast = (msg: string, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const loggedInId = localStorage.getItem('logged_in_user_id') || localStorage.getItem('user_id') || '';
    const role = localStorage.getItem('user_role') || '';
    setUserRole(role);
    setMyUserId(loggedInId.replace(/['"]/g, '').trim());

    if (loggedInId) {
      setProfileHistory([{ id: loggedInId.replace(/['"]/g, '').trim(), name: 'My Profile' }]);
    }
  }, []);

  useEffect(() => {
    if (profileHistory.length > 0) {
      fetchProfileAndTeam();
    }
  }, [profileHistory]);

  const fetchProfileAndTeam = async () => {
    const currentObj = profileHistory[profileHistory.length - 1];
    setLoaderMessage(`Loading ${currentObj.name}...`);
    setIsLoading(true);

    try {
      const pRes = await fetch(`/api/profile?user_id=${currentObj.id}`);
      const pData = await pRes.json();

      if (pRes.ok && pData.success) {
        setCurrentProfile(pData.profile);
        
        if (currentObj.name === 'My Profile' && pData.profile.full_name) {
          setProfileHistory(prev => {
            const copy = [...prev];
            copy[copy.length - 1].name = pData.profile.full_name;
            return copy;
          });
        }

        // Initialize update request form values with current details
        if (currentObj.id === myUserId) {
          setEditName(pData.profile.full_name || '');
          setEditDob(pData.profile.date_of_birth || '');
          setEditDoj(pData.profile.date_joining || '');
          setEditMobile(pData.profile.mobile_number || '');
          setEditEmail(pData.profile.mail_id || '');
          setEditUpkaran(pData.profile.e_upkaran_id || '');
          setEditZone(pData.profile.zone_name || '');
          setEditDistrict(pData.profile.district_name || '');

          // Check if update request is allowed
          const checkRes = await fetch(`/api/profile/update-request-check?user_id=${myUserId}`);
          const checkData = await checkRes.json();
          if (checkRes.ok) {
            setUpdateAllowed(checkData.allowed);
            if (!checkData.allowed) {
              setUpdateCheckMsg(checkData.message);
            }
          }
        }

        const tRes = await fetch(`/api/team?manager_id=${currentObj.id}`);
        const tData = await tRes.json();
        if (tRes.ok && tData.success && tData.team) {
          setTeamMembers(tData.team);
        } else {
          setTeamMembers([]);
        }
      } else {
        showToast('Could not load profile: ' + (pData.message || 'Unknown error'), 'danger');
      }
    } catch (err) {
      console.error("Error loading profile details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const drillDown = (id: string, name: string) => {
    setProfileHistory(prev => [...prev, { id, name }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = (index: number) => {
    setProfileHistory(prev => prev.slice(0, index + 1));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match!');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setPassError('Password must be at least 8 characters, and contain uppercase, lowercase, digit, and special character (@$!%*?&).');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: myUserId,
          old_password: oldPassword,
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPassSuccess(data.message || 'Password changed successfully!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast('Password changed successfully!', 'success');
      } else {
        setPassError(data.message || 'Failed to change password.');
      }
    } catch (err) {
      setPassError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateReqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqError('');
    setReqSuccess('');

    const new_data = {
      full_name: editName,
      date_of_birth: editDob,
      date_joining: editDoj,
      mobile_number: editMobile,
      mail_id: editEmail,
      e_upkaran_id: editUpkaran,
      zone_name: editZone,
      district_name: editDistrict
    };

    setIsLoading(true);
    try {
      const res = await fetch('/api/profile/update-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: myUserId,
          new_data
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReqSuccess(data.message || 'Profile update request raised successfully!');
        setUpdateAllowed(false);
        setUpdateCheckMsg('You already have a profile update request pending review.');
        showToast('Profile request raised!', 'success');
      } else {
        setReqError(data.message || 'Failed to submit profile update request.');
      }
    } catch (err) {
      setReqError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getBreadcrumbs = () => {
    if (profileHistory.length <= 1) {
      return <span className="font-weight-bold text-dark">My Profile</span>;
    }

    return (
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb mb-0 align-items-center" style={{ background: 'transparent', padding: 0 }}>
          <li className="breadcrumb-item">
            <button className="btn btn-link p-0 text-primary font-weight-bold align-items-center" onClick={() => goBack(profileHistory.length - 2)} style={{ textDecoration: 'none' }}>
              <i className="fas fa-chevron-left mr-1"></i> Back
            </button>
          </li>
          {profileHistory.map((item, index) => {
            const isLast = index === profileHistory.length - 1;
            const label = index === 0 ? 'My Profile' : item.name;
            return isLast ? (
              <li key={index} className="breadcrumb-item active text-dark font-weight-bold pl-2" aria-current="page">
                {label}
              </li>
            ) : (
              <li key={index} className="breadcrumb-item">
                <button className="btn btn-link p-0 text-secondary" onClick={() => goBack(index)} style={{ textDecoration: 'none' }}>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  };

  const renderTeamSection = (viewMode: 'desktop' | 'mobile') => {
    if (!teamMembers || teamMembers.length === 0) return null;

    const rolesWithReportees = ['Manager', 'Coordinator', 'Divisional Manager', 'Project Head'];
    const distinctManagers = Array.from(new Set(teamMembers.map(emp => emp.manager_name || 'No Manager Assigned')));
    const isAdmin = ['Admin', 'HR', 'Superadmin'].includes(userRole);

    const buildCard = (emp: TeamMember) => {
      const hasReportees = rolesWithReportees.includes(emp.role);
      return (
        <div key={emp.user_id} className="team-member-circle shadow-sm border p-3 bg-white text-center rounded m-2" onClick={() => drillDown(emp.user_id, emp.full_name)} style={{ cursor: 'pointer', minWidth: '120px' }}>
          <div className="tmc-avatar mx-auto mb-2 bg-light rounded-circle d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', position: 'relative' }}>
            <svg viewBox="0 0 24 24" style={{ width: '35px', height: '35px', fill: '#6c757d' }}>
              <path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1.5h16V17c0-2.66-5.33-4-8-4z" />
            </svg>
            {hasReportees && <span className="badge badge-primary position-absolute" style={{ top: 0, right: 0, borderRadius: '50%' }}>+</span>}
          </div>
          <div className="font-weight-bold text-truncate" style={{ fontSize: '13px' }}>{emp.full_name || 'Unknown'}</div>
          <div className="text-muted" style={{ fontSize: '11px' }}>({emp.e_code || 'N/A'})</div>
        </div>
      );
    };

    return (
      <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-header bg-indigo text-white" style={{ borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <h5 className="mb-0 font-weight-bold"><i className="fas fa-users mr-2"></i> Organization Hierarchy & Team</h5>
        </div>
        <div className="card-body p-3">
          {distinctManagers.length > 1 || isAdmin ? (
            Object.entries(
              teamMembers.reduce((acc: any, emp) => {
                const m = emp.manager_name || 'No Manager Assigned';
                if (!acc[m]) acc[m] = [];
                acc[m].push(emp);
                return acc;
              }, {})
            ).map(([mName, emps]: any) => (
              <div className="mb-3 border-bottom pb-2" key={mName}>
                <h6 className="font-weight-bold text-secondary mb-2">Reporting to: {mName} ({emps.length})</h6>
                <div className="d-flex flex-wrap">
                  {emps.map((emp: any) => buildCard(emp))}
                </div>
              </div>
            ))
          ) : (
            <div>
              <h6 className="font-weight-bold text-secondary mb-2">My Direct Team ({teamMembers.length})</h6>
              <div className="d-flex flex-wrap">
                {teamMembers.map(emp => buildCard(emp))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getLocations = (p: ProfileData) => {
    const locs = [];
    if (p.district_name) locs.push(p.district_name);
    if (p.zone_name) locs.push(p.zone_name);
    return locs.join(', ') || 'N/A';
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
        {toasts.map(t => (
          <div key={t.id} className={`alert alert-${t.type} shadow`} role="alert">
            {t.msg}
          </div>
        ))}
      </div>

      {/* DESKTOP VIEWPORT DESIGN */}
      <div className="d-none d-md-block">
        <div className="d-flex justify-content-between align-items-center mb-3">
          {getBreadcrumbs()}
        </div>

        {currentProfile && (
          <div className="row">
            {/* Left Profile details block */}
            <div className="col-md-5">
              <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                <div className="bg-primary p-4 text-center text-white" style={{ position: 'relative' }}>
                  <div className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '100px', height: '100px', fontSize: '48px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    <i className="fas fa-user"></i>
                  </div>
                  <h4 className="font-weight-bold mb-1">{currentProfile.full_name}</h4>
                  <p className="mb-2 text-white-50" style={{ fontSize: '14px' }}>{currentProfile.designation}</p>
                  <span className="badge badge-light text-primary px-3 py-2 font-weight-bold" style={{ borderRadius: '30px' }}>{currentProfile.role}</span>
                </div>
                <div className="card-body p-4">
                  <div className="row mb-3">
                    <div className="col-sm-5 text-muted font-weight-bold">Employee Code:</div>
                    <div className="col-sm-7 font-weight-bold text-dark">{currentProfile.e_code}</div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-sm-5 text-muted font-weight-bold">Mobile Number:</div>
                    <div className="col-sm-7">{currentProfile.mobile_number}</div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-sm-5 text-muted font-weight-bold">Email Address:</div>
                    <div className="col-sm-7">{currentProfile.mail_id}</div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-sm-5 text-muted font-weight-bold">District / Zone:</div>
                    <div className="col-sm-7">{getLocations(currentProfile)}</div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-sm-5 text-muted font-weight-bold">E-Upkaran ID:</div>
                    <div className="col-sm-7 mono font-weight-bold text-primary">{currentProfile.e_upkaran_id || 'N/A'}</div>
                  </div>
                  <div className="border-top pt-3 mt-3">
                    <h6 className="font-weight-bold text-secondary mb-2">Mapped Approver Authorities</h6>
                    <div className="d-flex justify-content-between bg-light p-2 rounded">
                      <span>L1: <strong>{currentProfile.level_first_approver || 'None'}</strong></span>
                      <span>L2: <strong>{currentProfile.level_second_approver || 'None'}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Forms block */}
            <div className="col-md-7">
              {profileHistory.length === 1 && (
                <>
                  {/* Change Password Form */}
                  <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px' }}>
                    <div className="card-header bg-dark text-white" style={{ borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                      <h5 className="mb-0 font-weight-bold"><i className="fas fa-key mr-2 text-warning"></i> Secure Password Update</h5>
                    </div>
                    <div className="card-body p-4">
                      {passError && <div className="alert alert-danger">{passError}</div>}
                      {passSuccess && <div className="alert alert-success">{passSuccess}</div>}

                      <form onSubmit={handlePasswordSubmit}>
                        <div className="form-group mb-3">
                          <label className="font-weight-bold">Current Password</label>
                          <input 
                            type={showPasswords ? 'text' : 'password'} 
                            className="form-control" 
                            required 
                            placeholder="Current Password" 
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                          />
                        </div>
                        <div className="form-group mb-3">
                          <label className="font-weight-bold">New Password</label>
                          <input 
                            type={showPasswords ? 'text' : 'password'} 
                            className="form-control" 
                            required 
                            placeholder="New Secure Password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>
                        <div className="form-group mb-3">
                          <label className="font-weight-bold">Confirm New Password</label>
                          <input 
                            type={showPasswords ? 'text' : 'password'} 
                            className="form-control" 
                            required 
                            placeholder="Confirm New Password" 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </div>
                        <div className="form-check mb-3">
                          <input 
                            type="checkbox" 
                            className="form-check-input" 
                            id="showPassDesk" 
                            checked={showPasswords}
                            onChange={() => setShowPasswords(!showPasswords)}
                          />
                          <label className="form-check-label text-muted" htmlFor="showPassDesk">Show Passwords</label>
                        </div>
                        <button type="submit" className="btn btn-primary px-4 font-weight-bold">Update Password</button>
                      </form>
                    </div>
                  </div>

                  {/* Profile Update Request Form */}
                  <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px' }}>
                    <div className="card-header bg-primary text-white" style={{ borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                      <h5 className="mb-0 font-weight-bold"><i className="fas fa-edit mr-2"></i> Request Personal Details Modification</h5>
                    </div>
                    <div className="card-body p-4">
                      {!updateAllowed ? (
                        <div className="alert alert-warning border-warning">
                          <i className="fas fa-exclamation-triangle mr-2"></i> {updateCheckMsg || "You are currently locked from submitting details updates."}
                        </div>
                      ) : (
                        <>
                          <div className="alert alert-info text-dark" style={{ fontSize: '13px' }}>
                            <i className="fas fa-info-circle mr-1"></i> Raised requests will go to the Admin portal for verification. Approved details are updated in 14 days intervals.
                          </div>
                          {reqSuccess && <div className="alert alert-success">{reqSuccess}</div>}
                          {reqError && <div className="alert alert-danger">{reqError}</div>}

                          <form onSubmit={handleUpdateReqSubmit}>
                            <div className="row">
                              <div className="col-md-6 mb-3">
                                <label className="font-weight-bold">Full Name</label>
                                <input type="text" className="form-control" required value={editName} onChange={(e) => setEditName(e.target.value)} />
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="font-weight-bold">E-Upkaran ID</label>
                                <input type="text" className="form-control" value={editUpkaran} onChange={(e) => setEditUpkaran(e.target.value)} />
                              </div>
                            </div>
                            <div className="row">
                              <div className="col-md-6 mb-3">
                                <label className="font-weight-bold">Mobile Number</label>
                                <input type="text" className="form-control" required value={editMobile} onChange={(e) => setEditMobile(e.target.value)} />
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="font-weight-bold">Email Address</label>
                                <input type="email" className="form-control" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                              </div>
                            </div>
                            <div className="row">
                              <div className="col-md-6 mb-3">
                                <label className="font-weight-bold">Date of Birth</label>
                                <input type="date" className="form-control" required value={editDob} onChange={(e) => setEditDob(e.target.value)} />
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="font-weight-bold">Date of Joining</label>
                                <input type="date" className="form-control" required value={editDoj} onChange={(e) => setEditDoj(e.target.value)} />
                              </div>
                            </div>
                            <div className="row">
                              <div className="col-md-6 mb-3">
                                <label className="font-weight-bold">Working Zone</label>
                                <input type="text" className="form-control" required value={editZone} onChange={(e) => setEditZone(e.target.value)} />
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="font-weight-bold">Working District</label>
                                <input type="text" className="form-control" required value={editDistrict} onChange={(e) => setEditDistrict(e.target.value)} />
                              </div>
                            </div>
                            <button type="submit" className="btn btn-success px-4 font-weight-bold">Submit Update Request</button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Hierarchical Team grid */}
              {renderTeamSection('desktop')}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE VIEWPORT DESIGN */}
      <div className="d-md-none">
        <div className="mb-3">
          {getBreadcrumbs()}
        </div>

        {currentProfile && (
          <div className="p-1">
            {/* Banner Employee Summary Card */}
            <div className="card shadow-sm border-0 mb-3" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div className="bg-primary p-3 text-center text-white">
                <div className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center mx-auto mb-2" style={{ width: '70px', height: '70px', fontSize: '30px' }}>
                  <i className="fas fa-user"></i>
                </div>
                <h5 className="font-weight-bold mb-0">{currentProfile.full_name}</h5>
                <small className="d-block mb-2 text-white-50">{currentProfile.designation} ({currentProfile.e_code})</small>
                <span className="badge badge-light text-primary px-3 py-1 font-weight-bold" style={{ borderRadius: '30px', fontSize: '11px' }}>{currentProfile.role}</span>
              </div>
            </div>

            {/* Profile Detail Accordion Card */}
            <div className="card shadow-sm border-0 mb-3" style={{ borderRadius: '12px' }}>
              <div className="card-header bg-light">
                <h6 className="mb-0 font-weight-bold text-dark"><i className="fas fa-info-circle mr-2 text-primary"></i> Personal Details</h6>
              </div>
              <div className="card-body p-3" style={{ fontSize: '13px' }}>
                <div className="d-flex justify-content-between mb-2 pb-2 border-bottom">
                  <span className="text-muted">Mobile Number:</span>
                  <span className="font-weight-bold">{currentProfile.mobile_number}</span>
                </div>
                <div className="d-flex justify-content-between mb-2 pb-2 border-bottom">
                  <span className="text-muted">Email ID:</span>
                  <span className="font-weight-bold">{currentProfile.mail_id}</span>
                </div>
                <div className="d-flex justify-content-between mb-2 pb-2 border-bottom">
                  <span className="text-muted">Zone & District:</span>
                  <span className="font-weight-bold">{getLocations(currentProfile)}</span>
                </div>
                <div className="d-flex justify-content-between mb-2 pb-2 border-bottom">
                  <span className="text-muted">E-Upkaran ID:</span>
                  <span className="font-weight-bold text-primary font-monospace">{currentProfile.e_upkaran_id || 'N/A'}</span>
                </div>
                <div className="mt-2 bg-light p-2 rounded">
                  <div className="text-muted font-weight-bold mb-1" style={{ fontSize: '11px' }}>APPROVERS:</div>
                  <div className="d-flex justify-content-between" style={{ fontSize: '12px' }}>
                    <span>L1: <strong>{currentProfile.level_first_approver || 'None'}</strong></span>
                    <span>L2: <strong>{currentProfile.level_second_approver || 'None'}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {profileHistory.length === 1 && (
              <>
                {/* Change Password Form (Mobile) */}
                <div className="card shadow-sm border-0 mb-3" style={{ borderRadius: '12px' }}>
                  <div className="card-header bg-dark text-white">
                    <h6 className="mb-0 font-weight-bold text-white"><i className="fas fa-key mr-2 text-warning"></i> Change Password</h6>
                  </div>
                  <div className="card-body p-3">
                    {passError && <div className="alert alert-danger p-2" style={{ fontSize: '12px' }}>{passError}</div>}
                    {passSuccess && <div className="alert alert-success p-2" style={{ fontSize: '12px' }}>{passSuccess}</div>}

                    <form onSubmit={handlePasswordSubmit}>
                      <div className="form-group mb-2">
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Current Password</label>
                        <input 
                          type={showPasswords ? 'text' : 'password'} 
                          className="form-control form-control-sm" 
                          required 
                          placeholder="Current Password" 
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                        />
                      </div>
                      <div className="form-group mb-2">
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>New Password</label>
                        <input 
                          type={showPasswords ? 'text' : 'password'} 
                          className="form-control form-control-sm" 
                          required 
                          placeholder="New Password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <div className="form-group mb-2">
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Confirm New Password</label>
                        <input 
                          type={showPasswords ? 'text' : 'password'} 
                          className="form-control form-control-sm" 
                          required 
                          placeholder="Confirm New Password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                      <div className="form-check mb-2">
                        <input 
                          type="checkbox" 
                          className="form-check-input" 
                          id="showPassMob" 
                          checked={showPasswords}
                          onChange={() => setShowPasswords(!showPasswords)}
                        />
                        <label className="form-check-label text-muted" htmlFor="showPassMob" style={{ fontSize: '12px' }}>Show Passwords</label>
                      </div>
                      <button type="submit" className="btn btn-primary btn-block btn-sm font-weight-bold py-2">Change Password</button>
                    </form>
                  </div>
                </div>

                {/* Profile Update Form (Mobile) */}
                <div className="card shadow-sm border-0 mb-3" style={{ borderRadius: '12px' }}>
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0 font-weight-bold text-white"><i className="fas fa-edit mr-2"></i> Update Details Request</h6>
                  </div>
                  <div className="card-body p-3">
                    {!updateAllowed ? (
                      <div className="alert alert-warning p-2" style={{ fontSize: '12px' }}>
                        <i className="fas fa-exclamation-triangle mr-1"></i> {updateCheckMsg || "Lock active."}
                      </div>
                    ) : (
                      <>
                        {reqSuccess && <div className="alert alert-success p-2" style={{ fontSize: '12px' }}>{reqSuccess}</div>}
                        {reqError && <div className="alert alert-danger p-2" style={{ fontSize: '12px' }}>{reqError}</div>}

                        <form onSubmit={handleUpdateReqSubmit}>
                          <div className="form-group mb-2">
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>Full Name</label>
                            <input type="text" className="form-control form-control-sm" required value={editName} onChange={(e) => setEditName(e.target.value)} />
                          </div>
                          <div className="form-group mb-2">
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>E-Upkaran ID</label>
                            <input type="text" className="form-control form-control-sm" value={editUpkaran} onChange={(e) => setEditUpkaran(e.target.value)} />
                          </div>
                          <div className="form-group mb-2">
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>Mobile Number</label>
                            <input type="text" className="form-control form-control-sm" required value={editMobile} onChange={(e) => setEditMobile(e.target.value)} />
                          </div>
                          <div className="form-group mb-2">
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>Email Address</label>
                            <input type="email" className="form-control form-control-sm" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                          </div>
                          <div className="form-group mb-2">
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>Date of Birth</label>
                            <input type="date" className="form-control form-control-sm" required value={editDob} onChange={(e) => setEditDob(e.target.value)} />
                          </div>
                          <div className="form-group mb-2">
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>Date of Joining</label>
                            <input type="date" className="form-control form-control-sm" required value={editDoj} onChange={(e) => setEditDoj(e.target.value)} />
                          </div>
                          <div className="form-group mb-2">
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>Working Zone</label>
                            <input type="text" className="form-control form-control-sm" required value={editZone} onChange={(e) => setEditZone(e.target.value)} />
                          </div>
                          <div className="form-group mb-3">
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>Working District</label>
                            <input type="text" className="form-control form-control-sm" required value={editDistrict} onChange={(e) => setEditDistrict(e.target.value)} />
                          </div>
                          <button type="submit" className="btn btn-success btn-block btn-sm font-weight-bold py-2">Submit Request</button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Hierarchy Team list (Mobile) */}
            {renderTeamSection('mobile')}
          </div>
        )}
      </div>

      <Loader show={isLoading} message={loaderMessage} />
    </div>
  );
}
