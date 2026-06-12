import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/style.css'; // Uses master CSS layouts
import SuccessPopup from '../components/SuccessPopup';

interface ApprovalItem {
  type: 'Expense' | 'Limit';
  id: string;
  req_type?: string; // For Limit requests ('KM' | 'AUTO')
  full_name: string;
  e_code: string;
  district: string;
  date: string;
  amount: number;
  status: string;
  can_action: boolean;
  action_level?: string;
  submitted_at: string;
}

interface ItineraryLegDetail {
  itinerary_id: string;
  exp_id: string;
  leg_number: number;
  from_location: string;
  to_location: string;
  from_district: string;
  to_district: string;
  travel_mode: string;
  distance_km: number;
  travel_amount: number;
  sub_mode: string;
  sub_km: number;
  sub_amount: number;
  da_amount: number;
  hotel_amount: number;
  other_desc: string;
  other_amount: number;
  visit_purpose: string;
  ws_assigned: number;
  ws_closed: number;
  ws_pms: number;
  ws_asset: number;
  travel_type: 'In-District' | 'Outdoor';
  attachments: Array<{
    bill_type: string;
    url: string;
    raw_url: string;
  }>;
}

interface DetailData {
  type: 'Expense' | 'Limit';
  expense?: any;
  request?: any;
  itineraries?: ItineraryLegDetail[];
  can_action: boolean;
  action_level?: string;
}

interface Toast {
  msg: string;
  type: 'success' | 'danger' | 'info' | 'warning';
}

export default function Approval() {
  const navigate = useNavigate();
  const currentUserId = (localStorage.getItem('logged_in_user_id') || '').replace(/['"]/g, '').trim();
  const storedRole = localStorage.getItem('user_role') || 'Approver';

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Side Details Panel state
  const [showPanel, setShowPanel] = useState(false);
  const [panelItemId, setPanelItemId] = useState<string | null>(null);
  const [panelItemType, setPanelItemType] = useState<'Expense' | 'Limit' | null>(null);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  // Individual Actions Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'Expense' | 'Limit' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState(false);

  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successPopupData, setSuccessPopupData] = useState({
    title: '',
    message: '',
    amount: undefined as number | undefined,
    date: '',
    claimId: ''
  });

  // Edit limit amount modal
  const [showEditLimitModal, setShowEditLimitModal] = useState(false);
  const [editLimitValue, setEditLimitValue] = useState('');

  // Manager Edit Expense modal
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [editFormValues, setEditFormValues] = useState({
    da_amount: 0,
    hotel_amount: 0,
    other_expense_amount: 0,
    total_amount: 0,
    legs: [] as any[]
  });
  const [editRules, setEditRules] = useState<any>({});
  const [editFacilities, setEditFacilities] = useState<any>({});
  const [editUser, setEditUser] = useState<any>({});
  const [editModalLoading, setEditModalLoading] = useState(false);

  const PER_PAGE = 15;

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
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setSelectedIds(new Set());
    try {
      const res = await fetch(`/api/approval/list?user_id=${currentUserId}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.expenses || []);
      } else {
        showToast(data.message || 'Failed to retrieve approval queue.', 'danger');
      }
    } catch (err) {
      showToast('Network error loading approvals.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  // Stats calculation
  const pendingItems = items.filter(e => e.can_action === true);
  const pendingCount = pendingItems.length;
  const pendingAmountSum = pendingItems.reduce(
    (sum, e) => sum + (e.type === 'Expense' ? parseFloat(e.amount as any) || 0 : 0),
    0
  );

  // Search filtering
  const filteredItems = items.filter(e => {
    if (!e.can_action) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (e.id || '').toLowerCase().includes(q) ||
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.e_code || '').toLowerCase().includes(q) ||
      (e.type || '').toLowerCase().includes(q)
    );
  });

  // Pagination bounds
  const totalPages = Math.ceil(filteredItems.length / PER_PAGE) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Selection handlers
  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allPendingIds = filteredItems.map(e => e.id);
      setSelectedIds(new Set(allPendingIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Bulk operations
  const handleBulkAction = async (action: 'Approved' | 'Rejected') => {
    if (selectedIds.size === 0) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/approval/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          ids: Array.from(selectedIds),
          action,
          reason: action === 'Rejected' ? `Rejection via bulk manager action.` : ''
        })
      });
      const data = await res.json();
      if (data.success) {
        const count = selectedIds.size;
        setSelectedIds(new Set());
        setSuccessPopupData({
          title: `Bulk Action Succeeded!`,
          message: `${action} bulk execution for ${count} request(s) completed successfully.`,
          amount: undefined,
          date: '',
          claimId: ''
        });
        setShowSuccessPopup(true);
        loadData();
      } else {
        showToast(data.message || 'Bulk execution failed.', 'danger');
      }
    } catch (err) {
      showToast('Network error during bulk action.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  // Detail panel loading
  const openPanel = async (id: string, type: 'Expense' | 'Limit') => {
    setPanelItemId(id);
    setPanelItemType(type);
    setDetailData(null);
    setPanelLoading(true);
    setShowPanel(true);
    try {
      const res = await fetch(`/api/approval/detail?id=${id}&type=${type}&user_id=${currentUserId}`);
      const data = await res.json();
      if (data.success) {
        setDetailData(data);
      } else {
        showToast(data.message || 'Error fetching details.', 'danger');
      }
    } catch (err) {
      showToast('Error connecting to panel API.', 'danger');
    } finally {
      setPanelLoading(false);
    }
  };

  // Action prompts
  const triggerApprove = (id: string, type: 'Expense' | 'Limit') => {
    setActionId(id);
    setActionType(type);
    setShowApproveModal(true);
  };

  const triggerReject = (id: string, type: 'Expense' | 'Limit') => {
    setActionId(id);
    setActionType(type);
    setRejectReason('');
    setRejectError(false);
    setShowRejectModal(true);
  };

  const submitApprove = async () => {
    if (!actionId || !actionType) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/approval/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionId,
          type: actionType,
          action: 'Approved',
          user_id: currentUserId
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowApproveModal(false);
        setShowPanel(false);
        setSuccessPopupData({
          title: 'Request Approved!',
          message: `The pending request ${actionId} has been approved successfully.`,
          amount: undefined,
          date: '',
          claimId: actionId || ''
        });
        setShowSuccessPopup(true);
        loadData();
      } else {
        showToast(data.message || 'Approval failed.', 'danger');
      }
    } catch (err) {
      showToast('Network failure.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const submitReject = async () => {
    if (!actionId || !actionType) return;
    if (!rejectReason.trim()) {
      setRejectError(true);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/approval/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionId,
          type: actionType,
          action: 'Rejected',
          reason: rejectReason,
          user_id: currentUserId
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowRejectModal(false);
        setShowPanel(false);
        setSuccessPopupData({
          title: 'Request Rejected!',
          message: `The pending request ${actionId} has been rejected.`,
          amount: undefined,
          date: '',
          claimId: actionId || ''
        });
        setShowSuccessPopup(true);
        loadData();
      } else {
        showToast(data.message || 'Rejection action failed.', 'danger');
      }
    } catch (err) {
      showToast('Network failure.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  // Limit edits
  const triggerEditLimit = (id: string, value: number) => {
    setActionId(id);
    setEditLimitValue(value.toString());
    setShowEditLimitModal(true);
  };

  const submitEditLimit = async () => {
    if (!actionId || !editLimitValue) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/approval/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exp_id: actionId,
          type: 'Limit',
          requested_value: parseFloat(editLimitValue),
          user_id: currentUserId
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Limit value modified successfully.', 'success');
        setShowEditLimitModal(false);
        if (showPanel && panelItemId === actionId) {
          openPanel(actionId, 'Limit');
        }
        loadData();
      } else {
        showToast(data.message || 'Failed to edit amount.', 'danger');
      }
    } catch (err) {
      showToast('Connection error.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  // Expense edits (pre-load rules and facilities for employee)
  const triggerEditExpense = async (expId: string) => {
    setActionId(expId);
    setEditModalLoading(true);
    setShowEditExpenseModal(true);

    try {
      // Get current itineraries detail
      const detailRes = await fetch(`/api/approval/detail?id=${expId}&type=Expense&user_id=${currentUserId}`);
      const detailDataObj = await detailRes.json();
      if (!detailRes.ok || !detailDataObj.success) throw new Error(detailDataObj.message);

      const empId = detailDataObj.expense.user_id;

      // Get employee's allowance rules
      const initRes = await fetch(`/api/expense/init?user_id=${empId}`);
      const initDataObj = await initRes.json();
      if (!initRes.ok || !initDataObj.success) throw new Error(initDataObj.message);

      setEditRules(initDataObj.allowance);
      setEditFacilities(initDataObj.facilities);
      setEditUser(initDataObj.user);

      // Pre-fill form values
      const exp = detailDataObj.expense;
      setEditFormValues({
        da_amount: exp.da_amount || 0,
        hotel_amount: exp.hotel_amount || 0,
        other_expense_amount: exp.other_expense_amount || 0,
        total_amount: exp.total_amount || 0,
        legs: (detailDataObj.itineraries || []).map((leg: any) => ({
          id: leg.itinerary_id,
          from_location: leg.from_location || '',
          to_location: leg.to_location || '',
          from_district: leg.from_district || initDataObj.user.home_district,
          to_district: leg.to_district || initDataObj.user.home_district,
          travel_mode: leg.travel_mode || '',
          distance_km: leg.distance_km || 0,
          travel_amount: leg.travel_amount || 0,
          sub_mode: leg.sub_mode || '',
          sub_amount: leg.sub_amount || 0,
          ws_assigned: leg.ws_assigned || 0,
          ws_closed: leg.ws_closed || 0,
          ws_pms: leg.ws_pms || 0,
          ws_asset: leg.ws_asset || 0,
          visit_purpose: leg.visit_purpose || '',
          travel_type: leg.travel_type || 'In-District'
        }))
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to load editor.', 'danger');
      setShowEditExpenseModal(false);
    } finally {
      setEditModalLoading(false);
    }
  };

  // Recalculates total edit modal values
  const recalculateEditTotal = (formVal: typeof editFormValues) => {
    let sum = 0;
    sum += parseFloat(formVal.da_amount as any) || 0;
    sum += parseFloat(formVal.hotel_amount as any) || 0;
    sum += parseFloat(formVal.other_expense_amount as any) || 0;
    formVal.legs.forEach(leg => {
      sum += parseFloat(leg.travel_amount as any) || 0;
      sum += parseFloat(leg.sub_amount as any) || 0;
    });
    return sum;
  };

  const updateEditLeg = (idx: number, field: string, val: any) => {
    setEditFormValues(prev => {
      const nextLegs = prev.legs.map((leg, lIdx) => {
        if (lIdx === idx) {
          const nextLeg = { ...leg, [field]: val };

          // Mode bike/car automatic travel calculations
          if (field === 'distance_km' || field === 'travel_mode') {
            const mode = field === 'travel_mode' ? val : leg.travel_mode;
            const km = field === 'distance_km' ? parseFloat(val) || 0 : leg.distance_km;

            if (mode === 'Bike') {
              nextLeg.travel_amount = parseFloat((km * (editRules.rate_bike || 4.5)).toFixed(2));
            } else if (mode === 'Car') {
              nextLeg.travel_amount = parseFloat((km * (editRules.rate_car || 9.0)).toFixed(2));
            }
          }
          return nextLeg;
        }
        return leg;
      });

      const updatedForm = { ...prev, legs: nextLegs };
      updatedForm.total_amount = recalculateEditTotal(updatedForm);
      return updatedForm;
    });
  };

  const handleEditTravelTypeToggle = (idx: number, val: 'In-District' | 'Outdoor') => {
    setEditFormValues(prev => {
      const nextLegs = prev.legs.map((leg, lIdx) => {
        if (lIdx === idx) {
          const updatedLeg = { ...leg, travel_type: val };
          if (val === 'Outdoor') {
            updatedLeg.from_district = leg.from_district || editUser.home_district;
          } else {
            updatedLeg.from_district = editUser.home_district;
            updatedLeg.to_district = editUser.home_district;
          }
          return updatedLeg;
        }
        return leg;
      });
      return { ...prev, legs: nextLegs };
    });
  };

  const addNewEditLeg = () => {
    setEditFormValues(prev => {
      const nextLegs = [
        ...prev.legs,
        {
          id: `new_${Date.now()}`,
          from_location: '',
          to_location: '',
          from_district: editUser.home_district,
          to_district: editUser.home_district,
          travel_mode: '',
          distance_km: 0,
          travel_amount: 0,
          sub_mode: '',
          sub_amount: 0,
          ws_assigned: 0,
          ws_closed: 0,
          ws_pms: 0,
          ws_asset: 0,
          visit_purpose: '',
          travel_type: 'In-District'
        }
      ];
      const updatedForm = { ...prev, legs: nextLegs };
      updatedForm.total_amount = recalculateEditTotal(updatedForm);
      return updatedForm;
    });
    showToast('✓ Leg appended. Modify fields below.', 'info');
  };

  const submitEditExpense = async () => {
    if (!actionId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/approval/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exp_id: actionId,
          type: 'Expense',
          user_id: currentUserId,
          da_amount: editFormValues.da_amount,
          hotel_amount: editFormValues.hotel_amount,
          other_expense_amount: editFormValues.other_expense_amount,
          total_amount: editFormValues.total_amount,
          legs: editFormValues.legs
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Expense details successfully overridden.', 'success');
        setShowEditExpenseModal(false);
        if (showPanel && panelItemId === actionId) {
          openPanel(actionId, 'Expense');
        }
        loadData();
      } else {
        showToast(data.message || 'Error updating expense claims.', 'danger');
      }
    } catch (err) {
      showToast('Network error saving.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const getDistrictDropdowns = () => {
    return (
      <>
        <option value="">Select</option>
        {Object.keys(editFacilities || {}).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </>
    );
  };

  const getFacilityDropdownList = (dist: string) => {
    if (!dist) return [];
    const defaults = [`Railway Station ${dist}`, `Bus Station ${dist}`, 'Hotel'];
    if (dist === 'Jodhpur') defaults.push('Jodhpur Office');
    const mapped = editFacilities[dist] || [];
    return [...defaults, ...mapped];
  };

  return (
    <>
      {isLoading && (
        <div id="loadingOverlay" style={{ display: 'flex', opacity: 1 }}>
          <div className="loader-wrapper">
            <div className="loader"></div>
          </div>
          <div id="loaderText">Loading approvals workflow...</div>
        </div>
      )}

      {/* Bulk Action Strip */}
      <div id="bulkActionBar" className={selectedIds.size > 0 ? 'active' : ''}>
        <div id="bulkActionBar-left">
          <span id="bulkActionBar-count">{selectedIds.size} selected</span>
        </div>
        <div id="bulkActionBar-actions">
          <button className="bulk-approve" onClick={() => handleBulkAction('Approved')} title="Approve Selected">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="bulk-btn-text">Approve Selected</span>
          </button>
          <button className="bulk-reject" onClick={() => handleBulkAction('Rejected')} title="Reject Selected">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="bulk-btn-text">Reject Selected</span>
          </button>
          <button id="clearSelection" onClick={() => setSelectedIds(new Set())} title="Clear Selection">
            Clear
          </button>
        </div>
      </div>

      {/* Sticky Breadcrumb and title */}
      <div className="top-sticky-wrapper">
        <header className="page-header desktop-only">
          <div>
            <p className="page-breadcrumb">Cyrix Healthcare / Action Required</p>
            <h1 className="page-title">Approval Center</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-3)', marginTop: '4px' }}>Review and action pending claims</p>
          </div>
          <div className="page-header-right">
            <button className="btn btn-outline" onClick={loadData}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
              Refresh
            </button>
          </div>
        </header>
      </div>

      <div className="content-area">
        {/* STATS */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon pending">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="stat-info">
              <p>Pending Action</p>
              <h3>{pendingCount}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon total">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth="2.5" />
                <circle cx="12" cy="12" r="2" strokeWidth="2.5" />
                <path d="M6 12h.01M18 12h.01" strokeWidth="2.5" />
              </svg>
            </div>
            <div className="stat-info">
              <p>Total Amount</p>
              <h3>₹{pendingAmountSum.toFixed(0)}</h3>
            </div>
          </div>
        </div>

        {/* Filters and search box */}
        <div className="controls-row">
          <div className="search-box input-with-icon" style={{ flex: 1, maxWidth: '100%' }}>
            <svg className="input-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, ID, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Mobile select all toggle */}
        <div className="mobile-select-all hide-desktop" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'white', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
          <input
            type="checkbox"
            className="table-checkbox"
            checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
            onChange={(e) => toggleSelectAll(e.target.checked)}
          />
          <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-dark)', flex: 1 }}>Select All Pending Actions</label>
        </div>

        <div className="table-card">
          <div className="table-container">
            <table id="expTable" className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>E-Code</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Details</th>
                  <th className="amount-cell">Value/Amount</th>
                  <th>Status</th>
                  <th className="sticky-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)', fontWeight: 600 }}>
                      No items awaiting approval.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((e) => {
                    const isSelected = selectedIds.has(e.id);
                    return (
                      <tr key={e.id} className={isSelected ? 'selected' : ''} style={{ cursor: 'pointer' }}>
                        <td style={{ textAlign: 'center' }} onClick={(ev) => { ev.stopPropagation(); toggleSelectRow(e.id); }}>
                          <input
                            type="checkbox"
                            className="table-checkbox"
                            checked={isSelected}
                            readOnly
                          />
                        </td>
                        <td data-label="ID" onClick={() => openPanel(e.id, e.type)}>
                          <div className="cell-val">
                            <span className="user-id-tag">{e.id}</span>
                          </div>
                        </td>
                        <td data-label="Employee" onClick={() => openPanel(e.id, e.type)}>
                          <div className="cell-val">
                            <strong>{e.full_name}</strong>
                          </div>
                        </td>
                        <td data-label="E-Code" onClick={() => openPanel(e.id, e.type)}><div className="cell-val">{e.e_code}</div></td>
                        <td data-label="Type" onClick={() => openPanel(e.id, e.type)}>
                          <div className="cell-val">
                            {e.type === 'Limit' ? (
                              <span style={{ background: 'var(--warning-light)', color: 'var(--warning)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                Limit ({e.req_type})
                              </span>
                            ) : (
                              <span style={{ background: 'var(--info-light)', color: 'var(--info)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                Expense
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-label="Date" onClick={() => openPanel(e.id, e.type)}><div className="cell-val">{e.date}</div></td>
                        <td data-label="Details" onClick={() => openPanel(e.id, e.type)}><div className="cell-val" style={{ color: 'var(--text-2)', fontSize: '13px' }}>{e.district || '—'}</div></td>
                        <td data-label="Value/Amount" className="amount-cell" onClick={() => openPanel(e.id, e.type)}>
                          <div className="cell-val">
                            {e.type === 'Limit' ? (
                              e.req_type === 'KM' ? `+${e.amount} KM` : `+₹${e.amount}`
                            ) : (
                              `₹${parseFloat(e.amount as any).toFixed(2)}`
                            )}
                          </div>
                        </td>
                        <td data-label="Status" onClick={() => openPanel(e.id, e.type)}>
                          <div className="cell-val">
                            <span className="status-badge warning">{e.status}</span>
                          </div>
                        </td>
                        <td data-label="Actions" onClick={(ev) => ev.stopPropagation()}>
                          <div className="cell-val">
                            <div className="action-btns">
                              {e.type === 'Expense' && (
                                <button className="btn-compact" onClick={() => triggerEditExpense(e.id)} title="Edit Claim">✎</button>
                              )}
                              <button className="btn-compact success" onClick={() => triggerApprove(e.id, e.type)} title="Approve">✓</button>
                              <button className="btn-compact danger" onClick={() => triggerReject(e.id, e.type)} title="Reject">✕</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              style={{ background: 'white', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pgNum) => (
              <button
                key={pgNum}
                style={{
                  background: pgNum === currentPage ? 'var(--primary)' : 'white',
                  color: pgNum === currentPage ? 'white' : 'var(--text)',
                  border: `1px solid ${pgNum === currentPage ? 'var(--primary)' : 'var(--border)'}`,
                  padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
                }}
                onClick={() => setCurrentPage(pgNum)}
              >
                {pgNum}
              </button>
            ))}
            <button
              style={{ background: 'white', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Detail Slide-in Panel */}
      <div className={`detail-panel ${showPanel ? 'open' : ''}`}>
        <div className="panel-header">
          <div>
            <h3>{panelItemType === 'Limit' ? 'Limit Extension Details' : 'Expense Claim Details'}</h3>
            <p>{panelItemId}</p>
          </div>
          <button className="panel-close" onClick={() => setShowPanel(false)}>×</button>
        </div>

        <div className="panel-body">
          {panelLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-3)', fontWeight: 600 }}>
              Loading...
            </div>
          )}

          {detailData && panelItemType === 'Limit' && (
            <>
              <div className="sec-heading">Employee Details</div>
              <div className="info-card">
                <div className="info-row"><div className="info-label">Employee Name</div><div className="info-val">{detailData.request?.full_name}</div></div>
                <div className="info-row"><div className="info-label">E-Code</div><div className="info-val">{detailData.request?.e_code}</div></div>
                <div className="info-row"><div className="info-label">Grade</div><div className="info-val">{detailData.request?.grade}</div></div>
                <div className="info-row"><div className="info-label">Home District</div><div className="info-val">{detailData.request?.district_name}</div></div>
                <div className="info-row"><div className="info-label">Extension Request</div><div className="info-val" style={{ color: 'var(--warning)' }}>Monthly {detailData.request?.request_type} Limit</div></div>
                <div className="info-row"><div className="info-label">Requested Value</div><div className="val-large" style={{ color: 'var(--danger)' }}>{detailData.request?.request_type === 'KM' ? `${detailData.request?.requested_value} KM` : `₹${detailData.request?.requested_value}`}</div></div>
              </div>
            </>
          )}

          {detailData && panelItemType === 'Expense' && (
            <>
              <div className="sec-heading">Employee Details</div>
              <div className="info-card">
                <div className="info-row"><div className="info-label">Employee Name</div><div className="info-val">{detailData.expense?.full_name}</div></div>
                <div className="info-row"><div className="info-label">E-Code</div><div className="info-val">{detailData.expense?.e_code}</div></div>
                <div className="info-row"><div className="info-label">Working Area / Districts</div><div className="info-val">{detailData.expense?.district}</div></div>
              </div>

              <div className="sec-heading">Expense Summary Breakup</div>
              <div className="bk-grid">
                <div className="bk-card"><div className="bk-label">Daily Allowance</div><div className="bk-val">₹{detailData.expense?.da_amount || 0}</div></div>
                <div className="bk-card"><div className="bk-label">Hotel Expense</div><div className="bk-val">₹{detailData.expense?.hotel_amount || 0}</div></div>
                <div className="bk-card"><div className="bk-label">Other Expense</div><div className="bk-val">₹{detailData.expense?.other_expense_amount || 0}</div></div>
                <div className="bk-card"><div className="bk-label">Total Claimed</div><div className="bk-val total">₹{detailData.expense?.total_amount || 0}</div></div>
              </div>

              <div className="sec-heading">Leg-wise Journey Detail</div>
              {(detailData.itineraries || []).map((leg, idx) => (
                <div key={idx} className="leg-wrapper">
                  <div className="leg-head">
                    <div className="leg-head-left">
                      <div className="leg-num">{leg.leg_number}</div>
                      <div>
                        <div className="leg-route">{leg.from_location} → {leg.to_location}</div>
                        <div className="leg-sub">{leg.travel_type} · {leg.to_district}</div>
                      </div>
                    </div>
                    <div className="leg-head-right">
                      <div className="leg-total-amt">₹{(leg.travel_amount + leg.sub_amount + leg.da_amount + leg.hotel_amount + leg.other_amount).toFixed(2)}</div>
                      <div className="leg-total-lbl">Leg Total</div>
                    </div>
                  </div>
                  <div className="leg-body">
                    <div className="nested-box">
                      <div className="nb-grid">
                        <div className="nb-item"><span className="nb-label">Travel Mode</span><span className="nb-val">{leg.travel_mode || '—'} ({leg.distance_km} KM)</span></div>
                        <div className="nb-item"><span className="nb-label">Travel Cost</span><span className="nb-val">₹{leg.travel_amount}</span></div>
                      </div>
                      {leg.sub_mode && (
                        <div className="nb-grid" style={{ marginTop: '12px' }}>
                          <div className="nb-item"><span className="nb-label">Extra Conn Mode</span><span className="nb-val">{leg.sub_mode}</span></div>
                          <div className="nb-item"><span className="nb-label">Extra Conn Cost</span><span className="nb-val">₹{leg.sub_amount}</span></div>
                        </div>
                      )}
                    </div>
                    {leg.leg_number === 1 && (
                      <div className="nested-box">
                        <div className="nb-grid">
                          <div className="nb-item"><span className="nb-label">DA Amount</span><span className="nb-val">₹{leg.da_amount}</span></div>
                          <div className="nb-item"><span className="nb-label">Hotel Amount</span><span className="nb-val">₹{leg.hotel_amount}</span></div>
                        </div>
                      </div>
                    )}
                    {leg.other_amount > 0 && (
                      <div className="nested-box">
                        <div className="nb-grid">
                          <div className="nb-item"><span className="nb-label">Other Desc</span><span className="nb-val">{leg.other_desc || '—'}</span></div>
                          <div className="nb-item"><span className="nb-label">Other Cost</span><span className="nb-val">₹{leg.other_amount}</span></div>
                        </div>
                      </div>
                    )}
                    {(leg.ws_assigned > 0 || leg.ws_closed > 0 || leg.ws_pms > 0 || leg.ws_asset > 0) && (
                      <div className="nested-box">
                        <div className="leg-sec-title">Work Summary</div>
                        <div className="nb-grid-4">
                          <div className="nb-item"><span className="nb-label">Assigned</span><span className="nb-val">{leg.ws_assigned}</span></div>
                          <div className="nb-item"><span className="nb-label">Closed</span><span className="nb-val">{leg.ws_closed}</span></div>
                          <div className="nb-item"><span className="nb-label">PMS</span><span className="nb-val">{leg.ws_pms}</span></div>
                          <div className="nb-item"><span className="nb-label">Asset Tag</span><span className="nb-val">{leg.ws_asset}</span></div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: '12px' }}>
                      <span className="nb-label">Visit Purpose:</span> <span style={{ fontSize: '13px', fontWeight: 600 }}>{leg.visit_purpose || '—'}</span>
                    </div>

                    {/* Image Attachments */}
                    {leg.attachments && leg.attachments.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <div className="leg-sec-title">Uploaded Attachments</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                          {leg.attachments.map((att, aIdx) => (
                            <a
                              key={aIdx}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="att-box"
                            >
                              <img
                                className="att-thumb-img"
                                src={att.url}
                                alt={att.bill_type}
                                onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                              />
                              <span className="att-lbl">{att.bill_type.replace('_', ' ')}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Panel Sticky Footer */}
        {detailData && (
          <div className="panel-footer">
            <button className="pf-btn btn-p-close" onClick={() => setShowPanel(false)}>Close</button>
            {detailData.can_action ? (
              <>
                {panelItemType === 'Limit' ? (
                  <button className="pf-btn btn-p-edit" onClick={() => triggerEditLimit(panelItemId!, detailData.request?.requested_value)}>Edit</button>
                ) : (
                  <button className="pf-btn btn-p-edit" onClick={() => triggerEditExpense(panelItemId!)}>Edit</button>
                )}
                <button className="pf-btn btn-p-reject" onClick={() => triggerReject(panelItemId!, panelItemType!)}>Reject</button>
                <button className="pf-btn btn-p-approve" onClick={() => triggerApprove(panelItemId!, panelItemType!)}>Approve</button>
              </>
            ) : (
              <span style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', fontWeight: 600, padding: '10px' }}>
                Item stage already processed.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Panel Backdrop overlay */}
      {showPanel && <div className="panel-overlay active" onClick={() => setShowPanel(false)}></div>}

      {/* Approve Confirm Modal */}
      {showApproveModal && (
        <div className="modal-overlay active" onClick={() => setShowApproveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" fill="none" stroke="var(--success)" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="modal-title" style={{ textAlign: 'center', fontSize: '18px', color: 'var(--primary-dark)', margin: '0 0 8px', fontWeight: 800 }}>Approve Request</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '14px', marginBottom: '24px', fontWeight: 500 }}>
              Are you sure you want to approve this {actionType === 'Limit' ? 'limit request' : 'expense claim'}?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowApproveModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={submitApprove} style={{ flex: 1, background: 'var(--success)' }}>
                Confirm Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay active" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" fill="none" stroke="var(--danger)" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h3 className="modal-title" style={{ textAlign: 'center', fontSize: '18px', color: 'var(--primary-dark)', margin: '0 0 8px', fontWeight: 800 }}>Reject Request</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '14px', marginBottom: '20px', fontWeight: 500 }}>Provide a clear reason for rejecting this request.</p>

            <div style={{ width: '100%' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase' }}>Rejection Reason <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea
                rows={4}
                placeholder="State the reason clearly..."
                value={rejectReason}
                onChange={(e) => { setRejectReason(e.target.value); setRejectError(false); }}
                style={{ width: '100%', padding: '12px 16px', border: '1.5px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font)', fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
              {rejectError && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px', fontWeight: 600 }}>Rejection reason is required!</p>}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', width: '100%' }}>
              <button className="btn btn-outline" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={submitReject} style={{ background: 'var(--danger)', color: 'white' }}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Limit Amount Modal */}
      {showEditLimitModal && (
        <div className="modal-overlay active" onClick={() => setShowEditLimitModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="panel-header" style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--border)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', boxShadow: 'none', position: 'static' }}>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '18px' }}>✎ Edit Limit Amount</h3>
              <button className="panel-close" onClick={() => setShowEditLimitModal(false)}>×</button>
            </div>
            <div style={{ paddingTop: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Requested Value</label>
              <input
                type="number"
                value={editLimitValue}
                onChange={(e) => setEditLimitValue(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontFamily: 'var(--font)', fontSize: '16px', fontWeight: 700, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-outline" onClick={() => setShowEditLimitModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitEditLimit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Edit Expense Form Modal */}
      {showEditExpenseModal && (
        <div className="modal-overlay active" onClick={() => setShowEditExpenseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="panel-header" style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--border)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', boxShadow: 'none', position: 'static' }}>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '18px' }}>✎ Edit Expense Claim: {actionId}</h3>
              <button className="panel-close" onClick={() => setShowEditExpenseModal(false)}>×</button>
            </div>

            {editModalLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: 600 }}>
                Loading editor...
              </div>
            ) : (
              <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', background: 'var(--surface-2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>DA Amount</label>
                    <input
                      type="number"
                      value={editFormValues.da_amount}
                      onChange={(e) => {
                        const nextForm = { ...editFormValues, da_amount: parseFloat(e.target.value) || 0 };
                        nextForm.total_amount = recalculateEditTotal(nextForm);
                        setEditFormValues(nextForm);
                      }}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontFamily: 'var(--font)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Hotel Amount</label>
                    <input
                      type="number"
                      value={editFormValues.hotel_amount}
                      onChange={(e) => {
                        const nextForm = { ...editFormValues, hotel_amount: parseFloat(e.target.value) || 0 };
                        nextForm.total_amount = recalculateEditTotal(nextForm);
                        setEditFormValues(nextForm);
                      }}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontFamily: 'var(--font)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Other Amount</label>
                    <input
                      type="number"
                      value={editFormValues.other_expense_amount}
                      onChange={(e) => {
                        const nextForm = { ...editFormValues, other_expense_amount: parseFloat(e.target.value) || 0 };
                        nextForm.total_amount = recalculateEditTotal(nextForm);
                        setEditFormValues(nextForm);
                      }}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontFamily: 'var(--font)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Total Amount</label>
                    <input
                      type="number"
                      value={editFormValues.total_amount}
                      readOnly
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--success)', background: 'var(--success-light)', fontWeight: 800, color: 'var(--success)', fontSize: '16px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-dark)', textTransform: 'uppercase', marginBottom: '16px', display: 'block', borderBottom: '2px solid var(--border)', paddingBottom: '8px' }}>
                    Itinerary Adjustment
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {editFormValues.legs.map((leg, idx) => {
                      const isOutdoor = leg.travel_type === 'Outdoor';
                      const legAllowedModes = ['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto'];
                      const legFromList = getFacilityDropdownList(leg.from_district);
                      const legToList = getFacilityDropdownList(leg.to_district);

                      return (
                        <div key={leg.id} style={{ border: '1px solid var(--border)', borderLeft: '4px solid var(--primary-light)', padding: '20px', borderRadius: '12px', background: 'var(--surface)' }}>
                          <h4 style={{ margin: '0 0 16px', fontSize: '15px', color: 'var(--primary-dark)', fontWeight: 800 }}>Leg {idx + 1}</h4>

                          <div className="travel-type-toggle" style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                            <label className="toggle-option" style={{ flex: 1 }}>
                              <input
                                type="radio"
                                name={`edit_travel_type_${idx}`}
                                value="In-District"
                                checked={leg.travel_type === 'In-District'}
                                onChange={() => handleEditTravelTypeToggle(idx, 'In-District')}
                                style={{ display: 'none' }}
                              />
                              <span className="toggle-label" style={{
                                display: 'block', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center', fontWeight: 600, cursor: 'pointer',
                                background: leg.travel_type === 'In-District' ? 'var(--primary-50)' : 'var(--surface-2)',
                                color: leg.travel_type === 'In-District' ? 'var(--primary)' : 'inherit',
                                borderColor: leg.travel_type === 'In-District' ? 'var(--primary-light)' : 'var(--border)'
                              }}>In-District</span>
                            </label>
                            <label className="toggle-option" style={{ flex: 1 }}>
                              <input
                                type="radio"
                                name={`edit_travel_type_${idx}`}
                                value="Outdoor"
                                checked={leg.travel_type === 'Outdoor'}
                                onChange={() => handleEditTravelTypeToggle(idx, 'Outdoor')}
                                style={{ display: 'none' }}
                              />
                              <span className="toggle-label" style={{
                                display: 'block', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center', fontWeight: 600, cursor: 'pointer',
                                background: leg.travel_type === 'Outdoor' ? 'var(--primary-50)' : 'var(--surface-2)',
                                color: leg.travel_type === 'Outdoor' ? 'var(--primary)' : 'inherit',
                                borderColor: leg.travel_type === 'Outdoor' ? 'var(--primary-light)' : 'var(--border)'
                              }}>Outdoor</span>
                            </label>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            {isOutdoor && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>From District</label>
                                <select
                                  value={leg.from_district}
                                  onChange={(e) => updateEditLeg(idx, 'from_district', e.target.value)}
                                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }}
                                >
                                  {getDistrictDropdowns()}
                                </select>
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>To District</label>
                              <select
                                value={leg.to_district}
                                disabled={!isOutdoor}
                                onChange={(e) => updateEditLeg(idx, 'to_district', e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', background: !isOutdoor ? 'var(--surface-2)' : 'transparent' }}
                              >
                                {getDistrictDropdowns()}
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>From Location</label>
                              <input
                                type="text"
                                placeholder="Type location..."
                                list={`edit_list_from_${idx}`}
                                value={leg.from_location}
                                onChange={(e) => updateEditLeg(idx, 'from_location', e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }}
                              />
                              <datalist id={`edit_list_from_${idx}`}>
                                {legFromList.map(f => <option key={f} value={f} />)}
                              </datalist>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>To Location</label>
                              <input
                                type="text"
                                placeholder="Type location..."
                                list={`edit_list_to_${idx}`}
                                value={leg.to_location}
                                onChange={(e) => updateEditLeg(idx, 'to_location', e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }}
                              />
                              <datalist id={`edit_list_to_${idx}`}>
                                {legToList.map(t => <option key={t} value={t} />)}
                              </datalist>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Travel Mode</label>
                              <select
                                value={leg.travel_mode}
                                onChange={(e) => updateEditLeg(idx, 'travel_mode', e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }}
                              >
                                <option value="">Select</option>
                                {legAllowedModes.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Distance (KM)</label>
                              <input
                                type="number"
                                readOnly={!['Bike', 'Car'].includes(leg.travel_mode)}
                                value={leg.distance_km}
                                onChange={(e) => updateEditLeg(idx, 'distance_km', parseFloat(e.target.value) || 0)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', background: !['Bike', 'Car'].includes(leg.travel_mode) ? 'var(--surface-2)' : 'transparent' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Travel ₹</label>
                              <input
                                type="number"
                                value={leg.travel_amount}
                                onChange={(e) => {
                                  updateEditLeg(idx, 'travel_amount', parseFloat(e.target.value) || 0);
                                }}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '15px', fontWeight: 700 }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Sub Mode & ₹</label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                  type="text"
                                  placeholder="Mode"
                                  value={leg.sub_mode}
                                  onChange={(e) => updateEditLeg(idx, 'sub_mode', e.target.value)}
                                  style={{ width: '50%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }}
                                />
                                <input
                                  type="number"
                                  placeholder="₹"
                                  value={leg.sub_amount}
                                  onChange={(e) => {
                                    updateEditLeg(idx, 'sub_amount', parseFloat(e.target.value) || 0);
                                  }}
                                  style={{ width: '50%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '15px', fontWeight: 700, color: 'var(--primary)' }}
                                />
                              </div>
                            </div>
                          </div>

                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '16px 0 8px', borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>Work Summary</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Assigned</label>
                              <input type="number" value={leg.ws_assigned} onChange={(e) => updateEditLeg(idx, 'ws_assigned', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Closed</label>
                              <input type="number" value={leg.ws_closed} onChange={(e) => updateEditLeg(idx, 'ws_closed', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>PMS</label>
                              <input type="number" value={leg.ws_pms} onChange={(e) => updateEditLeg(idx, 'ws_pms', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Asset</label>
                              <input type="number" value={leg.ws_asset} onChange={(e) => updateEditLeg(idx, 'ws_asset', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Visit Purpose</label>
                            <input
                              type="text"
                              value={leg.visit_purpose}
                              onChange={(e) => updateEditLeg(idx, 'visit_purpose', e.target.value)}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <button type="button" onClick={addNewEditLeg} style={{ width: '100%', padding: '14px', background: 'var(--primary-50)', border: '2px dashed var(--primary)', color: 'var(--primary)', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                    + Add New Journey Leg
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <button className="btn btn-outline" onClick={() => setShowEditExpenseModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={submitEditExpense}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local toast alerts */}
      <div className="toast-container">
        {toasts.map((toast, idx) => {
          let bg = 'var(--text)';
          if (toast.type === 'success') bg = 'var(--success)';
          if (toast.type === 'danger') bg = 'var(--danger)';
          if (toast.type === 'warning') bg = 'var(--warning)';

          return (
            <div
              key={idx}
              className="premium-toast"
              style={{
                borderLeft: `4px solid ${bg}`,
                color: bg
              }}
            >
              <span>
                {toast.type === 'success' && '✅'}
                {toast.type === 'danger' && '❌'}
                {toast.type === 'warning' && '⚠️'}
                {toast.type === 'info' && 'ℹ️'}
              </span>
              <span>{toast.msg}</span>
            </div>
          );
        })}
      </div>

      <SuccessPopup
        show={showSuccessPopup}
        title={successPopupData.title}
        message={successPopupData.message}
        amount={successPopupData.amount}
        date={successPopupData.date}
        claimId={successPopupData.claimId}
        onClose={() => setShowSuccessPopup(false)}
        actionLabel="Done"
      />
    </>
  );
}
