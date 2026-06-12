import React, { useState, useEffect } from 'react';
import '../css/admin.css';

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

  const showToast = (msg: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 4000);
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const dropRes = await fetch('/api/dropdowns');
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
      const res = await fetch('/api/users');
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
      const res = await fetch(`/api/districts?zone=${encodeURIComponent(zone)}`);
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
      const res = await fetch(`/api/districts?zone=${encodeURIComponent(zone)}`);
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
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/status`, {
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
        const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
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
      district_name: '', // loaded asynchronously below
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
    
    // Always keep defaults
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

    const url = editUserId ? `/api/users/${encodeURIComponent(editUserId)}` : '/api/users';
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

  // Filter users based on query
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

  // Approver selection lists
  const potentialApprovers = users.filter(u =>
    ['Manager', 'Admin', 'Superadmin', 'Coordinator', 'Divisional Manager', 'District Incharge'].includes(u.role)
  );

  return (
    <>
      {isLoading && (
        <div id="loadingOverlay" style={{ display: 'flex', opacity: 1 }}>
          <div className="loader-wrapper">
            <div className="loader"></div>
          </div>
          <div id="loaderText">Loading configuration...</div>
        </div>
      )}

      {/* Desktop Header */}
      <div className="page-header desktop-only">
        <div>
          <p className="page-breadcrumb">Cyrix Healthcare / System</p>
          <h1 className="page-title">⚙️ User Management</h1>
        </div>
        <div className="page-header-right">
          <div className="search-wrap">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search ID, Name, District..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={openAddModal}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add New User
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* Mobile Header Bar */}
        <div style={{ display: 'flex', gap: '12px' }} className="hide-desktop">
          <div className="search-wrap" style={{ flex: 1 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={openAddModal} style={{ padding: '10px', flexShrink: 0 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h2 className="table-title">All System Users</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-2)', background: 'var(--surface-2)', padding: '4px 12px', border: '1px solid var(--border)', borderRadius: '999px', fontWeight: 600 }}>
              {filteredUsers.length} users
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>E-Code</th>
                  <th>Designation</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Upkaran ID</th>
                  <th>DOB</th>
                  <th>Joining</th>
                  <th>Zone</th>
                  <th>District</th>
                  <th>Grade</th>
                  <th>Role</th>
                  <th>L1 Approver</th>
                  <th>L2 Approver</th>
                  <th>Failed Attempts</th>
                  <th>Status</th>
                  <th className="sticky-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="empty-state">
                      <div className="empty-icon">👥</div>
                      <div className="empty-text">No users found.</div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.user_id} onClick={() => viewUserDetails(u)}>
                      <td data-label="User ID">
                        <div className="cell-val">
                          <span className="user-id-tag">{u.user_id}</span>
                        </div>
                      </td>
                      <td data-label="Full Name">
                        <div className="cell-val">
                          <strong>{u.full_name}</strong>
                        </div>
                      </td>
                      <td data-label="E-Code"><div className="cell-val">{u.e_code}</div></td>
                      <td data-label="Designation"><div className="cell-val">{u.designation}</div></td>
                      <td data-label="Mobile"><div className="cell-val">{u.mobile_number}</div></td>
                      <td data-label="Email"><div className="cell-val">{u.mail_id}</div></td>
                      <td data-label="Upkaran ID"><div className="cell-val">{u.e_upkaran_id || '—'}</div></td>
                      <td data-label="DOB"><div className="cell-val">{u.date_of_birth}</div></td>
                      <td data-label="Joining"><div className="cell-val">{u.date_joining}</div></td>
                      <td data-label="Zone"><div className="cell-val">{u.zone_name}</div></td>
                      <td data-label="District"><div className="cell-val">{u.district_name}</div></td>
                      <td data-label="Grade"><div className="cell-val">{u.grade}</div></td>
                      <td data-label="Role">
                        <div className="cell-val">
                          <span style={{ background: 'var(--primary-50)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
                            {u.role}
                          </span>
                        </div>
                      </td>
                      <td data-label="L1 Approver"><div className="cell-val">{u.level_first_approver || '—'}</div></td>
                      <td data-label="L2 Approver"><div className="cell-val">{u.level_second_approver || '—'}</div></td>
                      <td data-label="Failed Attempts">
                        <div className="cell-val">
                          <span className="failed-count">{u.failed_attempts || 0}</span>
                        </div>
                      </td>
                      <td data-label="Status" onClick={(e) => e.stopPropagation()}>
                        <div className="cell-val">
                          <select
                            className="status-select"
                            value={u.account_status}
                            onChange={(e) => updateAccountStatus(u.user_id, e.target.value)}
                          >
                            <option value="Active">✅ Active</option>
                            <option value="Locked">🔒 Locked</option>
                            <option value="In-Active">⛔ In-Active</option>
                          </select>
                        </div>
                      </td>
                      <td data-label="Actions" onClick={(e) => e.stopPropagation()}>
                        <div className="cell-val" style={{ width: '100%' }}>
                          <div className="action-btns">
                            <button className="btn-edit" onClick={() => openEditModal(u)}>
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg> Edit
                            </button>
                            <button className="btn-delete" onClick={() => deleteUser(u.user_id)}>
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg> Delete
                            </button>
                          </div>
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

      {/* Add / Edit Modal Overlay */}
      <div className={`modal-overlay ${showAddEditModal ? 'active' : ''}`} onClick={() => setShowAddEditModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="modal-title">{editUserId ? `Edit User: ${editUserId}` : 'Add New User'}</h2>
          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>User ID</label>
                <input
                  type="text"
                  readOnly
                  className="readonly-id"
                  value={editUserId ? editUserId : dropdowns.next_id}
                />
              </div>
              <div className="form-group">
                <label>Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={formValues.full_name}
                  onChange={(e) => setFormValues(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>E-Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="EMP-001"
                  value={formValues.e_code}
                  onChange={(e) => setFormValues(prev => ({ ...prev, e_code: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Designation <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Field Engineer"
                  value={formValues.designation}
                  onChange={(e) => setFormValues(prev => ({ ...prev, designation: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Mobile Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="9876543210"
                  value={formValues.mobile_number}
                  onChange={(e) => setFormValues(prev => ({ ...prev, mobile_number: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Email Address <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="email"
                  required
                  placeholder="user@cyrix.com"
                  value={formValues.mail_id}
                  onChange={(e) => setFormValues(prev => ({ ...prev, mail_id: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>E-Upkaran ID</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={formValues.e_upkaran_id}
                  onChange={(e) => setFormValues(prev => ({ ...prev, e_upkaran_id: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Date of Birth <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="date"
                  required
                  value={formValues.date_of_birth}
                  onChange={(e) => setFormValues(prev => ({ ...prev, date_of_birth: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Date of Joining <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="date"
                  required
                  value={formValues.date_joining}
                  onChange={(e) => setFormValues(prev => ({ ...prev, date_joining: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Grade <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  required
                  value={formValues.grade}
                  onChange={(e) => setFormValues(prev => ({ ...prev, grade: e.target.value }))}
                >
                  <option value="">Select</option>
                  {dropdowns.grades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Role <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  required
                  value={formValues.role}
                  onChange={(e) => setFormValues(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="">Select</option>
                  {dropdowns.roles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Zone <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  required
                  value={formValues.zone_name}
                  onChange={(e) => handleZoneChange(e.target.value)}
                >
                  <option value="">Select</option>
                  {dropdowns.zones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>District <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  required
                  value={formValues.district_name}
                  onChange={(e) => setFormValues(prev => ({ ...prev, district_name: e.target.value }))}
                >
                  <option value="">Select</option>
                  {districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>L1 Approver</label>
                <select
                  value={formValues.level_first_approver}
                  onChange={(e) => setFormValues(prev => ({ ...prev, level_first_approver: e.target.value }))}
                >
                  <option value="">Select Approver / None</option>
                  {potentialApprovers.map(a => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.full_name} ({a.user_id}) - {a.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>L2 Approver</label>
                <select
                  value={formValues.level_second_approver}
                  onChange={(e) => setFormValues(prev => ({ ...prev, level_second_approver: e.target.value }))}
                >
                  <option value="">Select Approver / None</option>
                  {potentialApprovers.map(a => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.full_name} ({a.user_id}) - {a.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder={editUserId ? 'Leave blank to keep current' : 'Enter password'}
                  required={!editUserId}
                  value={formValues.password}
                  onChange={(e) => setFormValues(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-1)', marginBottom: '10px', display: 'block' }}>
                  Page Access Permissions
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', background: 'var(--surface-2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  {PERMISSION_OPTIONS.map(opt => {
                    const isChecked = (formValues.allowed_menus || 'dashboard,expense,profile')
                      .split(',')
                      .map(m => m.trim().toLowerCase())
                      .includes(opt.id);

                    return (
                      <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: opt.defaultAllowed ? 'not-allowed' : 'pointer', userSelect: 'none', fontSize: '14px', color: 'var(--text-1)' }}>
                        <input
                          type="checkbox"
                          checked={opt.defaultAllowed || isChecked}
                          disabled={opt.defaultAllowed}
                          onChange={(e) => handlePermissionChange(opt.id, e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                        />
                        <span>{opt.label}</span>
                        {opt.defaultAllowed && (
                          <span style={{ fontSize: '10px', color: 'var(--text-3)', fontStyle: 'italic' }}> (Default)</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddEditModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {isSaving ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* View User Modal Overlay */}
      <div className={`modal-overlay ${showViewModal ? 'active' : ''}`} onClick={() => setShowViewModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <h2 className="modal-title" style={{ border: 'none', padding: 0, margin: 0 }}>User Details</h2>
            <button
              type="button"
              onClick={() => setShowViewModal(false)}
              style={{ background: 'var(--surface-2)', border: 'none', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', cursor: 'pointer' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {selectedUser && (
            <div className="detail-grid">
              <div className="detail-item"><label>User ID</label><p>{selectedUser.user_id}</p></div>
              <div className="detail-item"><label>Full Name</label><p>{selectedUser.full_name}</p></div>
              <div className="detail-item"><label>E-Code</label><p>{selectedUser.e_code}</p></div>
              <div className="detail-item"><label>Designation</label><p>{selectedUser.designation}</p></div>
              <div className="detail-item"><label>Mobile</label><p>{selectedUser.mobile_number}</p></div>
              <div className="detail-item"><label>Email</label><p>{selectedUser.mail_id}</p></div>
              <div className="detail-item"><label>Upkaran ID</label><p>{selectedUser.e_upkaran_id || '—'}</p></div>
              <div className="detail-item"><label>DOB</label><p>{selectedUser.date_of_birth}</p></div>
              <div className="detail-item"><label>Joining Date</label><p>{selectedUser.date_joining}</p></div>
              <div className="detail-item"><label>Grade</label><p>{selectedUser.grade}</p></div>
              <div className="detail-item"><label>Role</label><p>{selectedUser.role}</p></div>
              <div className="detail-item"><label>Zone</label><p>{selectedUser.zone_name}</p></div>
              <div className="detail-item"><label>District</label><p>{selectedUser.district_name}</p></div>
              <div className="detail-item"><label>L1 Approver</label><p>{selectedUser.level_first_approver || '—'}</p></div>
              <div className="detail-item"><label>L2 Approver</label><p>{selectedUser.level_second_approver || '—'}</p></div>
              <div className="detail-item"><label>Failed Attempts</label><p>{selectedUser.failed_attempts || 0}</p></div>
              <div className="detail-item"><label>Status</label><p>{selectedUser.account_status}</p></div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <label>Allowed Menus</label>
                <p style={{ marginTop: '4px', color: 'var(--text-1)', fontWeight: 600 }}>
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
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((toast, idx) => {
          let bg = 'var(--text)';
          let icon = 'ℹ️';
          if (toast.type === 'success') { bg = 'var(--success)'; icon = '✅'; }
          if (toast.type === 'danger') { bg = 'var(--danger)'; icon = '❌'; }
          if (toast.type === 'warning') { bg = 'var(--warning)'; icon = '⚠️'; }

          return (
            <div
              key={idx}
              style={{
                background: 'white',
                color: bg,
                padding: '14px 20px',
                borderRadius: '10px',
                marginTop: '10px',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: 'var(--shadow-md)',
                borderLeft: `4px solid ${bg}`,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                pointerEvents: 'auto'
              }}
            >
              <span>{icon}</span> <span>{toast.msg}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
