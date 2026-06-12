import React, { useState, useEffect } from 'react';

interface User {
  user_id: string;
  full_name: string;
  e_code: string;
  designation: string;
  mobile_number: string;
  mail_id: string;
  e_upkaran_id?: string;
  date_of_birth: string;
  date_joining: string;
  zone_name: string;
  district_name: string;
  grade: string;
  role: string;
  level_first_approver?: string;
  level_second_approver?: string;
  account_status: string;
  failed_attempts: number;
  allowed_menus?: string;
}

const PERMISSION_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard', defaultAllowed: true },
  { id: 'expense', label: 'Submit Claim', defaultAllowed: true },
  { id: 'profile', label: 'Profile', defaultAllowed: true },
  { id: 'admin', label: 'Admin Panel', defaultAllowed: false },
  { id: 'approval', label: 'Approval Center', defaultAllowed: false },
  { id: 'report', label: 'Analytics', defaultAllowed: false },
  { id: 'upload', label: 'Data Sync', defaultAllowed: false },
  { id: 'month', label: 'Month Summary', defaultAllowed: false }
];

interface Dropdowns {
  zones: string[];
  roles: string[];
  grades: string[];
  next_id: string;
}

interface Toast {
  msg: string;
  type: 'success' | 'danger' | 'info' | 'warning';
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdowns, setDropdowns] = useState<Dropdowns>({ zones: [], roles: [], grades: [], next_id: '' });
  const [districts, setDistricts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'users' | 'profile-requests' | 'audit-logs' | 'error-logs'>('users');

  // Profile update requests state
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [profileRequestsLoading, setProfileRequestsLoading] = useState(false);

  // System logs state
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formValues, setFormValues] = useState({
    full_name: '',
    e_code: '',
    designation: '',
    mobile_number: '',
    mail_id: '',
    e_upkaran_id: '',
    date_of_birth: '',
    date_joining: '',
    grade: '',
    role: '',
    zone_name: '',
    district_name: '',
    level_first_approver: '',
    level_second_approver: '',
    password: '',
    account_status: 'Active',
    allowed_menus: 'dashboard,expense,profile'
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'profile-requests') {
      loadProfileRequests();
    } else if (activeTab === 'audit-logs') {
      loadLogs('action');
    } else if (activeTab === 'error-logs') {
      loadLogs('error');
    }
  }, [activeTab]);

  const loadProfileRequests = async () => {
    setProfileRequestsLoading(true);
    try {
      const res = await fetch('/api/admin/profile-requests');
      const data = await res.json();
      if (data.success) {
        setProfileRequests(data.requests || []);
      } else {
        showToast(data.message || 'Failed to load profile requests.', 'danger');
      }
    } catch (err) {
      showToast('Network error loading profile requests.', 'danger');
    } finally {
      setProfileRequestsLoading(false);
    }
  };

  const loadLogs = async (type: 'action' | 'error') => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?type=${type}`);
      const data = await res.json();
      if (data.success) {
        if (type === 'action') {
          setSystemLogs(data.logs || []);
        } else {
          setErrorLogs(data.logs || []);
        }
      } else {
        showToast(data.message || 'Failed to load system logs.', 'danger');
      }
    } catch (err) {
      showToast('Network error loading logs.', 'danger');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleProfileRequestAction = async (id: number, action: 'Approve' | 'Reject') => {
    if (!window.confirm(`Are you sure you want to ${action.toLowerCase()} this profile update request?`)) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/profile-requests/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Request successfully ${action.toLowerCase()}d.`, 'success');
        loadProfileRequests();
      } else {
        showToast(data.message || 'Action failed.', 'danger');
      }
    } catch (err) {
      showToast('Network failure.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string, type: Toast['type'] = 'info') => {
    setToasts(prev => [...prev, { msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 4000);
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const dropRes = await fetch('/api/admin/dropdowns');
      const dropData = await dropRes.json();
      if (dropData.success) {
        setDropdowns({
          zones: dropData.zones || [],
          roles: dropData.roles || [],
          grades: dropData.grades || [],
          next_id: dropData.next_id || 'AUTO'
        });
      }

      await loadUsers();
    } catch (err) {
      showToast('Error initializing data from server.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      showToast('Failed to retrieve user accounts.', 'danger');
    }
  };

  const handleZoneChange = async (zone: string) => {
    setFormValues(prev => ({ ...prev, zone_name: zone, district_name: '' }));
    if (!zone) {
      setDistricts([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/districts?zone=${encodeURIComponent(zone)}`);
      const data = await res.json();
      if (data.success) {
        setDistricts(data.districts || []);
      }
    } catch (err) {
      showToast('Error loading district details.', 'danger');
    }
  };

  const loadDistrictsForEdit = async (zone: string, targetDistrict: string) => {
    if (!zone) return;
    try {
      const res = await fetch(`/api/admin/districts?zone=${encodeURIComponent(zone)}`);
      const data = await res.json();
      if (data.success) {
        setDistricts(data.districts || []);
        setFormValues(prev => ({ ...prev, district_name: targetDistrict }));
      }
    } catch (err) {
      console.error('Error loading districts for edit', err);
    }
  };

  const updateAccountStatus = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`User ${userId} status updated to ${newStatus}`, 'success');
        loadUsers();
      } else {
        showToast(data.message || 'Status update failed', 'danger');
      }
    } catch (err) {
      showToast('Error updating status', 'danger');
    }
  };

  const deleteUser = async (userId: string) => {
    if (window.confirm('Delete this user? This cannot be undone.')) {
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          showToast('User deleted successfully', 'success');
          loadUsers();
        } else {
          showToast(data.message || 'Failed to delete user', 'danger');
        }
      } catch (err) {
        showToast('Failed to delete user', 'danger');
      }
    }
  };

  const openAddModal = () => {
    setEditUserId(null);
    setFormValues({
      full_name: '',
      e_code: '',
      designation: '',
      mobile_number: '',
      mail_id: '',
      e_upkaran_id: '',
      date_of_birth: '',
      date_joining: '',
      grade: '',
      role: '',
      zone_name: '',
      district_name: '',
      level_first_approver: '',
      level_second_approver: '',
      password: '',
      account_status: 'Active',
      allowed_menus: 'dashboard,expense,profile'
    });
    setDistricts([]);
    setShowAddEditModal(true);
  };

  const openEditModal = (u: User) => {
    setEditUserId(u.user_id);
    setFormValues({
      full_name: u.full_name || '',
      e_code: u.e_code || '',
      designation: u.designation || '',
      mobile_number: u.mobile_number || '',
      mail_id: u.mail_id || '',
      e_upkaran_id: u.e_upkaran_id || '',
      date_of_birth: u.date_of_birth || '',
      date_joining: u.date_joining || '',
      grade: u.grade || '',
      role: u.role || '',
      zone_name: u.zone_name || '',
      district_name: '', 
      level_first_approver: u.level_first_approver || '',
      level_second_approver: u.level_second_approver || '',
      password: '',
      account_status: u.account_status || 'Active',
      allowed_menus: u.allowed_menus || 'dashboard,expense,profile'
    });
    loadDistrictsForEdit(u.zone_name, u.district_name);
    setShowAddEditModal(true);
  };

  const handlePermissionChange = (menuId: string, checked: boolean) => {
    const currentMenus = (formValues.allowed_menus || 'dashboard,expense,profile')
      .split(',')
      .map(m => m.trim().toLowerCase());
    let newMenus: string[];
    if (checked) {
      if (!currentMenus.includes(menuId)) {
        newMenus = [...currentMenus, menuId];
      } else {
        newMenus = currentMenus;
      }
    } else {
      newMenus = currentMenus.filter(m => m !== menuId);
    }
    
    if (!newMenus.includes('dashboard')) newMenus.push('dashboard');
    if (!newMenus.includes('expense')) newMenus.push('expense');
    if (!newMenus.includes('profile')) newMenus.push('profile');

    setFormValues(prev => ({
      ...prev,
      allowed_menus: newMenus.join(',')
    }));
  };

  const viewUserDetails = (u: User) => {
    setSelectedUser(u);
    setShowViewModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const url = editUserId ? `/api/admin/users/${encodeURIComponent(editUserId)}` : '/api/admin/users';
    const method = editUserId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddEditModal(false);
        showToast(editUserId ? 'User updated successfully' : 'User created successfully', 'success');
        loadUsers();
      } else {
        showToast(data.message || 'Error saving user details.', 'danger');
      }
    } catch (err) {
      showToast('Network error while saving user.', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.user_id && u.user_id.toLowerCase().includes(q)) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.e_code && u.e_code.toLowerCase().includes(q)) ||
      (u.mobile_number && u.mobile_number.includes(q)) ||
      (u.district_name && u.district_name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  const potentialApprovers = users.filter(u =>
    ['Manager', 'Admin', 'Superadmin', 'Coordinator', 'Divisional Manager', 'District Incharge'].includes(u.role)
  );

  return (
    <div style={{ width: '100%' }}>
      {isLoading && (
        <div className="d-flex justify-content-center align-items-center" style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 9999 }}>
          <div className="text-center">
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
            <p className="mt-2 font-weight-bold">Loading System Directory...</p>
          </div>
        </div>
      )}

      {/* HEADER NAVBAR */}
      <div className="row align-items-center mb-4">
        <div className="col-sm-6">
          <h1 className="m-0 font-weight-bold text-dark h3">
            <i className="fas fa-user-shield mr-2 text-danger"></i> Admin Console
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Manage user accounts, page access permissions, system audit logs, and profile change requests.</p>
        </div>
        <div className="col-sm-6 text-sm-right mt-3 mt-sm-0">
          {activeTab === 'users' && (
            <div className="d-inline-flex align-items-center w-100 justify-content-sm-end" style={{ gap: '10px' }}>
              <div className="input-group" style={{ maxWidth: '300px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="input-group-append">
                  <span className="input-group-text"><i className="fas fa-search"></i></span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={openAddModal}>
                <i className="fas fa-plus-circle mr-1"></i> Add User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* HORIZONTALLY SCROLLABLE PREMIUM TAB BAR */}
      <ul className="nav nav-tabs mb-4 bg-white p-2 rounded shadow-sm border-0" style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', gap: '5px' }}>
        <li className="nav-item">
          <button 
            className={`nav-link border-0 font-weight-bold text-uppercase py-2 px-4 ${activeTab === 'users' ? 'active bg-primary text-white' : 'text-secondary'}`}
            style={{ borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease-in-out', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('users')}
          >
            <i className="fas fa-users mr-2"></i> User Directory
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link border-0 font-weight-bold text-uppercase py-2 px-4 ${activeTab === 'profile-requests' ? 'active bg-primary text-white' : 'text-secondary'}`}
            style={{ borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease-in-out', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('profile-requests')}
          >
            <i className="fas fa-id-card mr-2"></i> Update Requests
            {profileRequests.filter(r => r.status === 'Pending').length > 0 && (
              <span className="badge badge-danger ml-2">{profileRequests.filter(r => r.status === 'Pending').length}</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link border-0 font-weight-bold text-uppercase py-2 px-4 ${activeTab === 'audit-logs' ? 'active bg-primary text-white' : 'text-secondary'}`}
            style={{ borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease-in-out', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('audit-logs')}
          >
            <i className="fas fa-history mr-2"></i> Audit Logs
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link border-0 font-weight-bold text-uppercase py-2 px-4 ${activeTab === 'error-logs' ? 'active bg-primary text-white' : 'text-secondary'}`}
            style={{ borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease-in-out', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('error-logs')}
          >
            <i className="fas fa-exclamation-triangle mr-2"></i> Error Logs
          </button>
        </li>
      </ul>

      {activeTab === 'users' && (
        <>
          {/* DESKTOP VIEWPORT DESIGN */}
          <div className="d-none d-md-block">
        <div className="card card-primary card-outline shadow-sm">
          <div className="card-header border-bottom d-flex align-items-center justify-content-between p-3">
            <h3 className="card-title font-weight-bold text-dark m-0">All System Users</h3>
            <span className="badge badge-primary">{filteredUsers.length} total</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-striped table-hover table-bordered mb-0 align-middle">
                <thead className="bg-light text-secondary">
                  <tr>
                    <th>User ID</th>
                    <th>Full Name</th>
                    <th>E-Code</th>
                    <th>Designation</th>
                    <th>Mobile</th>
                    <th>Email</th>
                    <th>Zone</th>
                    <th>District</th>
                    <th>Role</th>
                    <th>L1 Approver</th>
                    <th>L2 Approver</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center p-5 text-muted">
                        <i className="fas fa-users fa-3x mb-3 text-gray"></i>
                        <p className="font-weight-bold mb-0">No users found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.user_id} style={{ cursor: 'pointer' }} onClick={() => viewUserDetails(u)}>
                        <td><span className="badge badge-light border text-monospace">{u.user_id}</span></td>
                        <td className="font-weight-bold text-primary">{u.full_name}</td>
                        <td><span className="badge badge-secondary">{u.e_code}</span></td>
                        <td>{u.designation}</td>
                        <td>{u.mobile_number}</td>
                        <td style={{ fontSize: '13px' }}>{u.mail_id}</td>
                        <td>{u.zone_name}</td>
                        <td>{u.district_name}</td>
                        <td><span className="badge badge-info">{u.role}</span></td>
                        <td style={{ fontSize: '13px' }}>{u.level_first_approver || '—'}</td>
                        <td style={{ fontSize: '13px' }}>{u.level_second_approver || '—'}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="form-select form-select-sm font-weight-bold text-uppercase"
                            value={u.account_status}
                            onChange={(e) => updateAccountStatus(u.user_id, e.target.value)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '12px',
                              borderRadius: '4px',
                              color: u.account_status === 'Active' ? '#28a745' : u.account_status === 'Locked' ? '#dc3545' : '#6c757d',
                              borderColor: '#ced4da'
                            }}
                          >
                            <option value="Active">Active</option>
                            <option value="Locked">Locked</option>
                            <option value="In-Active">In-Active</option>
                          </select>
                        </td>
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="d-flex justify-content-center" style={{ gap: '6px' }}>
                            <button className="btn btn-outline-primary btn-xs" onClick={() => openEditModal(u)} title="Edit Account">
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="btn btn-outline-danger btn-xs" onClick={() => deleteUser(u.user_id)} title="Delete Account">
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE VIEWPORT DESIGN */}
      <div className="d-md-none">
        {filteredUsers.length === 0 ? (
          <div className="card card-body text-center p-5 text-muted shadow-sm">
            <i className="fas fa-users fa-3x mb-3 text-gray"></i>
            <p className="font-weight-bold mb-0">No users found.</p>
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div className="card card-primary card-outline shadow-sm mb-3" key={u.user_id} onClick={() => viewUserDetails(u)}>
              <div className="card-header p-3 d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="font-weight-bold text-primary mb-0">{u.full_name}</h6>
                  <small className="text-muted">{u.designation} · <span className="font-weight-bold">{u.e_code}</span></small>
                </div>
                <span className="badge badge-light border text-monospace">{u.user_id}</span>
              </div>
              <div className="card-body p-3 text-secondary" style={{ fontSize: '13px', lineHeight: '1.6' }}>
                <div className="row">
                  <div className="col-6"><strong>Role:</strong> {u.role}</div>
                  <div className="col-6"><strong>District:</strong> {u.district_name}</div>
                  <div className="col-12 mt-1"><strong>Mobile:</strong> {u.mobile_number}</div>
                  <div className="col-12"><strong>Email:</strong> {u.mail_id}</div>
                </div>
                <hr className="my-2" />
                <div className="d-flex align-items-center justify-content-between mt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="d-inline-flex align-items-center">
                    <span className="mr-2 font-weight-bold" style={{ fontSize: '12px' }}>STATUS:</span>
                    <select
                      className="form-select form-select-sm font-weight-bold text-uppercase"
                      value={u.account_status}
                      onChange={(e) => updateAccountStatus(u.user_id, e.target.value)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        color: u.account_status === 'Active' ? '#28a745' : u.account_status === 'Locked' ? '#dc3545' : '#6c757d',
                        borderColor: '#ced4da'
                      }}
                    >
                      <option value="Active">Active</option>
                      <option value="Locked">Locked</option>
                      <option value="In-Active">In-Active</option>
                    </select>
                  </div>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <button className="btn btn-outline-primary btn-xs py-1 px-2" onClick={() => openEditModal(u)}>
                      <i className="fas fa-edit mr-1"></i> Edit
                    </button>
                    <button className="btn btn-outline-danger btn-xs py-1 px-2" onClick={() => deleteUser(u.user_id)}>
                      <i className="fas fa-trash-alt mr-1"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </>
      )}

      {/* PROFILE UPDATE REQUESTS TAB */}
      {activeTab === 'profile-requests' && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="card-header border-0 bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
            <h5 className="font-weight-bold text-dark mb-0">Profile Update Requests</h5>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadProfileRequests}>
              <i className="fas fa-sync-alt mr-1"></i> Refresh
            </button>
          </div>
          <div className="card-body p-0">
            {profileRequestsLoading ? (
              <div className="text-center p-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-2 font-weight-bold">Fetching update requests...</p>
              </div>
            ) : profileRequests.length === 0 ? (
              <div className="text-center p-5 text-muted">
                <i className="fas fa-check-double fa-3x mb-3 text-success"></i>
                <p className="font-weight-bold mb-0">All caught up! No pending profile changes.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle mb-0">
                  <thead className="bg-light text-secondary">
                    <tr>
                      <th>Submitted At</th>
                      <th>User ID</th>
                      <th>Name / E-Code</th>
                      <th>Requested Changes</th>
                      <th>Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileRequests.map((req) => {
                      let newDataMap: Record<string, string> = {};
                      try {
                        newDataMap = JSON.parse(req.new_data || '{}');
                      } catch (e) {
                        newDataMap = {};
                      }

                      return (
                        <tr key={req.id}>
                          <td style={{ fontSize: '13px' }}>{new Date(req.created_at).toLocaleString('en-IN')}</td>
                          <td><span className="badge badge-light border text-monospace">{req.user_id}</span></td>
                          <td>
                            <div className="font-weight-bold text-primary">{req.full_name}</div>
                            <small className="text-muted">{req.e_code}</small>
                          </td>
                          <td>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', maxWidth: '350px' }}>
                              {Object.entries(newDataMap).map(([k, v]) => (
                                <div key={k} className="p-1 border rounded bg-white">
                                  <strong className="text-uppercase text-secondary" style={{ fontSize: '9px' }}>{k.replace('_', ' ')}:</strong>
                                  <span className="d-block text-dark font-weight-bold">{String(v || '—')}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${req.status === 'Pending' ? 'badge-warning text-white' : req.status === 'Approved' ? 'badge-success' : 'badge-danger'}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="text-center">
                            {req.status === 'Pending' ? (
                              <div className="d-inline-flex" style={{ gap: '6px' }}>
                                <button 
                                  className="btn btn-success btn-xs font-weight-bold px-2 py-1"
                                  onClick={() => handleProfileRequestAction(req.id, 'Approve')}
                                >
                                  <i className="fas fa-check mr-1"></i> Approve
                                </button>
                                <button 
                                  className="btn btn-danger btn-xs font-weight-bold px-2 py-1"
                                  onClick={() => handleProfileRequestAction(req.id, 'Reject')}
                                >
                                  <i className="fas fa-times mr-1"></i> Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted font-italic" style={{ fontSize: '12px' }}>Processed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit-logs' && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="card-header border-0 bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
            <h5 className="font-weight-bold text-dark mb-0">System Action Logs</h5>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => loadLogs('action')}>
              <i className="fas fa-sync-alt mr-1"></i> Refresh
            </button>
          </div>
          <div className="card-body p-0">
            {logsLoading ? (
              <div className="text-center p-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-2 font-weight-bold">Loading action logs...</p>
              </div>
            ) : systemLogs.length === 0 ? (
              <div className="text-center p-5 text-muted">
                <i className="fas fa-history fa-3x mb-3"></i>
                <p className="font-weight-bold mb-0">No system action logs available.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
                  <thead className="bg-light text-secondary">
                    <tr>
                      <th>Timestamp</th>
                      <th>User ID</th>
                      <th>Full Name</th>
                      <th>Action Executed</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                        <td><span className="badge badge-light border text-monospace">{log.user_id || 'System'}</span></td>
                        <td className="font-weight-bold text-dark">{log.full_name || 'System/Guest'}</td>
                        <td className="font-weight-bold text-primary">{log.action}</td>
                        <td>{log.ip_address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ERROR LOGS TAB */}
      {activeTab === 'error-logs' && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="card-header border-0 bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
            <h5 className="font-weight-bold text-dark mb-0">System Error & Fault Logs</h5>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => loadLogs('error')}>
              <i className="fas fa-sync-alt mr-1"></i> Refresh
            </button>
          </div>
          <div className="card-body p-0">
            {logsLoading ? (
              <div className="text-center p-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-2 font-weight-bold">Loading error logs...</p>
              </div>
            ) : errorLogs.length === 0 ? (
              <div className="text-center p-5 text-muted">
                <i className="fas fa-heart fa-3x mb-3 text-success"></i>
                <p className="font-weight-bold mb-0">Zero errors! The system is running flawlessly.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
                  <thead className="bg-light text-secondary">
                    <tr>
                      <th>Timestamp</th>
                      <th>User ID</th>
                      <th>Error Message</th>
                      <th>Path</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorLogs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr>
                          <td>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                          <td><span className="badge badge-light border text-monospace">{log.user_id || 'System'}</span></td>
                          <td className="font-weight-bold text-danger">{log.error_message}</td>
                          <td className="text-muted">{log.path || 'N/A'}</td>
                          <td>
                            {log.stack_trace && (
                              <button 
                                className="btn btn-link btn-xs p-0 font-weight-bold"
                                onClick={() => {
                                  const el = document.getElementById(`stack-${log.id}`);
                                  if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
                                }}
                              >
                                Toggle Stack
                              </button>
                            )}
                          </td>
                        </tr>
                        {log.stack_trace && (
                          <tr id={`stack-${log.id}`} style={{ display: 'none', backgroundColor: '#fdf3f2' }}>
                            <td colSpan={5} className="p-3">
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', color: '#721c24' }}>
                                {log.stack_trace}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOOTSTRAP ADD / EDIT MODAL */}
      {showAddEditModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex={-1} role="dialog" onClick={() => setShowAddEditModal(false)}>
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-primary text-white border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-white">
                    <i className={editUserId ? "fas fa-user-edit mr-2 text-white" : "fas fa-user-plus mr-2 text-white"}></i>
                    {editUserId ? `Edit User: ${editUserId}` : 'Add New User'}
                  </h5>
                  <button type="button" className="close text-white" onClick={() => setShowAddEditModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <form onSubmit={handleFormSubmit}>
                  <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <div className="row">
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>User ID</label>
                        <input
                          type="text"
                          readOnly
                          className="form-control bg-light text-primary font-weight-bold"
                          value={editUserId ? editUserId : dropdowns.next_id}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Full Name <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="Enter full name"
                          value={formValues.full_name}
                          onChange={(e) => setFormValues(prev => ({ ...prev, full_name: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Employee Code <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="e.g. EMP-001"
                          value={formValues.e_code}
                          onChange={(e) => setFormValues(prev => ({ ...prev, e_code: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Designation <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="e.g. Field Engineer"
                          value={formValues.designation}
                          onChange={(e) => setFormValues(prev => ({ ...prev, designation: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Mobile Number <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="10-digit mobile number"
                          value={formValues.mobile_number}
                          onChange={(e) => setFormValues(prev => ({ ...prev, mobile_number: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Email Address <span className="text-danger">*</span></label>
                        <input
                          type="email"
                          className="form-control"
                          required
                          placeholder="user@cyrix.com"
                          value={formValues.mail_id}
                          onChange={(e) => setFormValues(prev => ({ ...prev, mail_id: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>E-Upkaran ID</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Optional"
                          value={formValues.e_upkaran_id}
                          onChange={(e) => setFormValues(prev => ({ ...prev, e_upkaran_id: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Date of Birth <span className="text-danger">*</span></label>
                        <input
                          type="date"
                          className="form-control"
                          required
                          value={formValues.date_of_birth}
                          onChange={(e) => setFormValues(prev => ({ ...prev, date_of_birth: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Date of Joining <span className="text-danger">*</span></label>
                        <input
                          type="date"
                          className="form-control"
                          required
                          value={formValues.date_joining}
                          onChange={(e) => setFormValues(prev => ({ ...prev, date_joining: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Grade <span className="text-danger">*</span></label>
                        <select
                          className="form-control"
                          required
                          value={formValues.grade}
                          onChange={(e) => setFormValues(prev => ({ ...prev, grade: e.target.value }))}
                        >
                          <option value="">Select Grade</option>
                          {dropdowns.grades.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Role <span className="text-danger">*</span></label>
                        <select
                          className="form-control"
                          required
                          value={formValues.role}
                          onChange={(e) => setFormValues(prev => ({ ...prev, role: e.target.value }))}
                        >
                          <option value="">Select Role</option>
                          {dropdowns.roles.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Zone <span className="text-danger">*</span></label>
                        <select
                          className="form-control"
                          required
                          value={formValues.zone_name}
                          onChange={(e) => handleZoneChange(e.target.value)}
                        >
                          <option value="">Select Zone</option>
                          {dropdowns.zones.map(z => (
                            <option key={z} value={z}>{z}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>District <span className="text-danger">*</span></label>
                        <select
                          className="form-control"
                          required
                          value={formValues.district_name}
                          onChange={(e) => setFormValues(prev => ({ ...prev, district_name: e.target.value }))}
                        >
                          <option value="">Select District</option>
                          {districts.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>L1 Approver</label>
                        <select
                          className="form-control"
                          value={formValues.level_first_approver}
                          onChange={(e) => setFormValues(prev => ({ ...prev, level_first_approver: e.target.value }))}
                        >
                          <option value="">Select L1 Manager (None)</option>
                          {potentialApprovers.map(a => (
                            <option key={a.user_id} value={a.user_id}>
                              {a.full_name} ({a.user_id}) - {a.role}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>L2 Approver</label>
                        <select
                          className="form-control"
                          value={formValues.level_second_approver}
                          onChange={(e) => setFormValues(prev => ({ ...prev, level_second_approver: e.target.value }))}
                        >
                          <option value="">Select L2 Manager (None)</option>
                          {potentialApprovers.map(a => (
                            <option key={a.user_id} value={a.user_id}>
                              {a.full_name} ({a.user_id}) - {a.role}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Password</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder={editUserId ? 'Leave blank to keep current' : 'Enter password'}
                          required={!editUserId}
                          value={formValues.password}
                          onChange={(e) => setFormValues(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                      
                      <div className="col-12 mt-3">
                        <label className="font-weight-bold text-secondary text-uppercase mb-2" style={{ fontSize: '12px' }}>
                          Page Access Permissions
                        </label>
                        <div className="p-3 border rounded bg-light" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                          {PERMISSION_OPTIONS.map(opt => {
                            const isChecked = (formValues.allowed_menus || 'dashboard,expense,profile')
                              .split(',')
                              .map(m => m.trim().toLowerCase())
                              .includes(opt.id);

                            return (
                              <div className="custom-control custom-checkbox" key={opt.id}>
                                <input
                                  type="checkbox"
                                  className="custom-control-input"
                                  id={`perm-${opt.id}`}
                                  checked={opt.defaultAllowed || isChecked}
                                  disabled={opt.defaultAllowed}
                                  onChange={(e) => handlePermissionChange(opt.id, e.target.checked)}
                                  style={{ cursor: opt.defaultAllowed ? 'not-allowed' : 'pointer' }}
                                />
                                <label className="custom-control-label pl-2" htmlFor={`perm-${opt.id}`} style={{ cursor: opt.defaultAllowed ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                                  {opt.label}
                                  {opt.defaultAllowed && <span className="text-muted font-italic" style={{ fontSize: '10px' }}> (Default)</span>}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer bg-light border-top-0 justify-content-end p-3">
                    <button type="button" className="btn btn-secondary px-4 btn-sm" onClick={() => setShowAddEditModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary px-4 btn-sm" disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save mr-1"></i> Save User
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BOOTSTRAP VIEW USER MODAL */}
      {showViewModal && selectedUser && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex={-1} role="dialog" onClick={() => setShowViewModal(false)}>
            <div className="modal-dialog modal-dialog-centered modal-lg" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-dark text-white border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-white">
                    <i className="fas fa-id-card mr-2 text-white"></i> User Details
                  </h5>
                  <button type="button" className="close text-white" onClick={() => setShowViewModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-4">
                  <div className="row text-secondary" style={{ fontSize: '14px', lineHeight: '2' }}>
                    <div className="col-sm-6 mb-2"><strong>User ID:</strong> <span className="badge badge-light border text-monospace text-dark px-2">{selectedUser.user_id}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Full Name:</strong> <span className="font-weight-bold text-dark">{selectedUser.full_name}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Employee Code:</strong> <span className="badge badge-secondary">{selectedUser.e_code}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Designation:</strong> <span className="text-dark">{selectedUser.designation}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Mobile Number:</strong> <span className="text-dark">{selectedUser.mobile_number}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Email Address:</strong> <span className="text-dark">{selectedUser.mail_id}</span></div>
                    <div className="col-sm-6 mb-2"><strong>E-Upkaran ID:</strong> <span className="text-dark">{selectedUser.e_upkaran_id || '—'}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Date of Birth:</strong> <span className="text-dark">{selectedUser.date_of_birth}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Date of Joining:</strong> <span className="text-dark">{selectedUser.date_joining}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Grade:</strong> <span className="text-dark">{selectedUser.grade}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Role:</strong> <span className="badge badge-info">{selectedUser.role}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Zone:</strong> <span className="text-dark">{selectedUser.zone_name}</span></div>
                    <div className="col-sm-6 mb-2"><strong>District:</strong> <span className="text-dark">{selectedUser.district_name}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Level 1 Approver:</strong> <span className="text-dark">{selectedUser.level_first_approver || '—'}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Level 2 Approver:</strong> <span className="text-dark">{selectedUser.level_second_approver || '—'}</span></div>
                    <div className="col-sm-6 mb-2"><strong>Failed Attempts:</strong> <span className="badge badge-warning text-dark">{selectedUser.failed_attempts || 0}</span></div>
                    <div className="col-sm-6 mb-2">
                      <strong>Account Status:</strong> 
                      <span className={`badge ml-2 ${selectedUser.account_status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                        {selectedUser.account_status}
                      </span>
                    </div>
                    
                    <div className="col-12 mt-3">
                      <hr className="my-2" />
                      <strong>Allowed Menu Access Roles:</strong>
                      <p className="mt-1 font-weight-bold text-dark mb-0">
                        {(selectedUser.allowed_menus || 'dashboard,expense,profile')
                          .split(',')
                          .map(m => m.trim())
                          .map(m => {
                            const match = PERMISSION_OPTIONS.find(opt => opt.id === m.toLowerCase());
                            return match ? match.label : m;
                          })
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light border-top-0 justify-content-end p-3">
                  <button type="button" className="btn btn-secondary px-4 btn-sm" onClick={() => setShowViewModal(false)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast Notification Area */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, pointerEvents: 'none' }}>
        {toasts.map((toast, idx) => {
          let bg = 'bg-info text-white';
          let icon = 'fas fa-info-circle';
          if (toast.type === 'success') { bg = 'bg-success text-white'; icon = 'fas fa-check-circle'; }
          if (toast.type === 'danger') { bg = 'bg-danger text-white'; icon = 'fas fa-exclamation-circle'; }
          if (toast.type === 'warning') { bg = 'bg-warning text-dark'; icon = 'fas fa-exclamation-triangle'; }

          return (
            <div
              key={idx}
              className={`toast show border-0 shadow-lg ${bg} mb-2`}
              style={{
                minWidth: '250px',
                borderRadius: '8px',
                pointerEvents: 'auto',
                opacity: 0.95
              }}
            >
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
