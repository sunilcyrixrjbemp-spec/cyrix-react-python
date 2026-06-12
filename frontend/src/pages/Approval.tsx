import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SuccessPopup from '../components/SuccessPopup';

interface ApprovalItem {
  type: 'Expense' | 'Limit';
  id: string;
  req_type?: string; 
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

  // Manager Override Remark state
  const [managerRemark, setManagerRemark] = useState('');
  const [managerRemarkError, setManagerRemarkError] = useState(false);

  // Comparison modal state
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareData, setCompareData] = useState<any>(null);
  const [compareModalLoading, setCompareModalLoading] = useState(false);
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
    setManagerRemark('');
    setManagerRemarkError(false);

    try {
      const detailRes = await fetch(`/api/approval/detail?id=${expId}&type=Expense&user_id=${currentUserId}`);
      const detailDataObj = await detailRes.json();
      if (!detailRes.ok || !detailDataObj.success) throw new Error(detailDataObj.message);

      const empId = detailDataObj.expense.user_id;

      const initRes = await fetch(`/api/expense/init?user_id=${empId}`);
      const initDataObj = await initRes.json();
      if (!initRes.ok || !initDataObj.success) throw new Error(initDataObj.message);

      setEditRules(initDataObj.allowance);
      setEditFacilities(initDataObj.facilities);
      setEditUser(initDataObj.user);

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

  const openOverrideComparison = async (expId: string) => {
    setCompareModalLoading(true);
    setShowCompareModal(true);
    setCompareData(null);
    try {
      const res = await fetch(`/api/approval/detail?id=${expId}&type=Expense&user_id=${currentUserId}`);
      const data = await res.json();
      if (data.success) {
        setCompareData(data);
      } else {
        showToast(data.message || 'Error fetching override details.', 'danger');
        setShowCompareModal(false);
      }
    } catch (err) {
      showToast('Error connecting to API.', 'danger');
      setShowCompareModal(false);
    } finally {
      setCompareModalLoading(false);
    }
  };

  const submitEditExpense = async () => {
    if (!actionId) return;
    if (!managerRemark.trim()) {
      setManagerRemarkError(true);
      return;
    }
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
          legs: editFormValues.legs,
          remark: managerRemark
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

  const getStatusBadge = (status: string) => {
    const st = (status || 'Pending').toLowerCase();
    let cls = 'badge-warning text-white';
    if (st === 'approved') cls = 'badge-success';
    if (st === 'rejected') cls = 'badge-danger';
    return <span className={`badge ${cls}`}>{status || 'Pending'}</span>;
  };

  const formatDate = (str: string) => {
    if (!str) return '—';
    try {
      return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return str;
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {isLoading && (
        <div className="d-flex justify-content-center align-items-center" style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 9999 }}>
          <div className="text-center">
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
            <p className="mt-2 font-weight-bold">Loading approvals...</p>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="alert alert-dark d-flex align-items-center justify-content-between shadow-lg px-4 py-3 border-0" style={{ position: 'fixed', bottom: '80px', left: '20px', right: '20px', zIndex: 1040, borderRadius: '12px' }}>
          <div>
            <i className="fas fa-tasks mr-2 text-warning"></i>
            <span className="font-weight-bold">{selectedIds.size} items selected for batch action</span>
          </div>
          <div className="d-flex" style={{ gap: '10px' }}>
            <button className="btn btn-success btn-sm font-weight-bold" onClick={() => handleBulkAction('Approved')}>
              <i className="fas fa-check-double mr-1"></i> Approve Selected
            </button>
            <button className="btn btn-danger btn-sm font-weight-bold" onClick={() => handleBulkAction('Rejected')}>
              <i className="fas fa-ban mr-1"></i> Reject Selected
            </button>
            <button className="btn btn-light btn-sm" onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="row align-items-center mb-4">
        <div className="col-sm-6">
          <h1 className="m-0 font-weight-bold text-dark h3">
            <i className="fas fa-check-circle mr-2 text-success"></i> Approval Center
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Review, edit, and approve pending claims and limit extensions.</p>
        </div>
        <div className="col-sm-6 text-sm-right mt-3 mt-sm-0">
          <div className="d-inline-flex align-items-center w-100 justify-content-sm-end" style={{ gap: '10px' }}>
            <div className="input-group" style={{ maxWidth: '300px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search queries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="input-group-append">
                <span className="input-group-text"><i className="fas fa-search"></i></span>
              </div>
            </div>
            <button className="btn btn-outline-secondary" onClick={loadData}>
              <i className="fas fa-sync-alt mr-1"></i> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* STATS SMALL BOXES */}
      <div className="row mb-3">
        <div className="col-lg-3 col-6">
          <div className="small-box bg-warning text-white shadow-sm">
            <div className="inner">
              <h3 className="text-white">{pendingCount}</h3>
              <p className="text-white">Pending Requests</p>
            </div>
            <div className="icon text-white" style={{ opacity: 0.3 }}>
              <i className="fas fa-hourglass-half text-white"></i>
            </div>
          </div>
        </div>
        <div className="col-lg-3 col-6">
          <div className="small-box bg-success shadow-sm">
            <div className="inner">
              <h3>₹{pendingAmountSum.toLocaleString('en-IN')}</h3>
              <p>Pending Expense Sum</p>
            </div>
            <div className="icon">
              <i className="fas fa-money-bill-wave"></i>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="d-none d-md-block">
        <div className="card card-success card-outline shadow-sm">
          <div className="card-header border-bottom d-flex align-items-center justify-content-between p-3">
            <h3 className="card-title font-weight-bold text-dark m-0">Awaiting Action</h3>
            <div className="custom-control custom-checkbox">
              <input
                type="checkbox"
                className="custom-control-input"
                id="selectAllCheck"
                checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                onChange={(e) => toggleSelectAll(e.target.checked)}
              />
              <label className="custom-control-label pl-2 font-weight-bold text-muted" htmlFor="selectAllCheck" style={{ fontSize: '13px' }}>Select All</label>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-striped table-hover table-bordered mb-0 align-middle">
                <thead className="bg-light text-secondary">
                  <tr>
                    <th style={{ width: '40px' }} className="text-center">Select</th>
                    <th>Request ID</th>
                    <th>Employee</th>
                    <th>E-Code</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>District</th>
                    <th>Value/Amount</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center p-5 text-muted">
                        <i className="fas fa-check-double fa-3x mb-3 text-gray"></i>
                        <p className="font-weight-bold mb-0">No pending approvals found.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((e) => {
                      const isSelected = selectedIds.has(e.id);
                      return (
                        <tr key={e.id} className={isSelected ? 'bg-light' : ''} style={{ cursor: 'pointer' }} onClick={() => openPanel(e.id, e.type)}>
                          <td className="text-center" onClick={(ev) => { ev.stopPropagation(); toggleSelectRow(e.id); }}>
                            <div className="custom-control custom-checkbox">
                              <input
                                type="checkbox"
                                className="custom-control-input"
                                checked={isSelected}
                                readOnly
                              />
                              <label className="custom-control-label" style={{ cursor: 'pointer' }}></label>
                            </div>
                          </td>
                          <td><span className="badge badge-light border font-weight-bold text-monospace">{e.id}</span></td>
                          <td className="font-weight-bold text-primary">{e.full_name}</td>
                          <td><span className="badge badge-secondary">{e.e_code}</span></td>
                          <td>
                            {e.type === 'Limit' ? (
                              <span className="badge bg-warning text-white"><i className="fas fa-chart-bar mr-1"></i> Limit ({e.req_type})</span>
                            ) : (
                              <span className="badge bg-info"><i className="fas fa-receipt mr-1"></i> Expense</span>
                            )}
                          </td>
                          <td>{formatDate(e.date)}</td>
                          <td>{e.district || '—'}</td>
                          <td className="font-weight-bold">
                            {e.type === 'Limit' ? (
                              e.req_type === 'KM' ? `+${e.amount} KM` : `+₹${e.amount}`
                            ) : (
                              <div className="d-flex align-items-center justify-content-between">
                                <span>₹{parseFloat(e.amount as any).toFixed(2)}</span>
                                {(e as any).is_edited === 1 && (
                                  <button 
                                    className="btn btn-link btn-xs p-0 ml-2 text-warning"
                                    onClick={(ev) => { ev.stopPropagation(); openOverrideComparison(e.id); }}
                                    title="View Manager Override Details"
                                  >
                                    <i className="fas fa-eye" style={{ fontSize: '13px' }}></i>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td>{getStatusBadge(e.status)}</td>
                          <td className="text-center" onClick={(ev) => ev.stopPropagation()}>
                            <div className="d-flex justify-content-center" style={{ gap: '6px' }}>
                              {e.type === 'Expense' && (
                                <button className="btn btn-outline-secondary btn-xs" onClick={() => triggerEditExpense(e.id)} title="Edit Claim">
                                  <i className="fas fa-edit"></i>
                                </button>
                              )}
                              <button className="btn btn-outline-success btn-xs" onClick={() => triggerApprove(e.id, e.type)} title="Approve">
                                <i className="fas fa-check"></i>
                              </button>
                              <button className="btn btn-outline-danger btn-xs" onClick={() => triggerReject(e.id, e.type)} title="Reject">
                                <i className="fas fa-times"></i>
                              </button>
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
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="d-md-none">
        {paginatedItems.length === 0 ? (
          <div className="card card-body text-center p-5 text-muted shadow-sm">
            <i className="fas fa-check-double fa-3x mb-3 text-gray"></i>
            <p className="font-weight-bold mb-0">No pending approvals found.</p>
          </div>
        ) : (
          paginatedItems.map((e) => {
            const isSelected = selectedIds.has(e.id);
            return (
              <div className="card card-success card-outline shadow-sm mb-3" key={e.id} onClick={() => openPanel(e.id, e.type)}>
                <div className="card-header p-3 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <div onClick={(ev) => { ev.stopPropagation(); toggleSelectRow(e.id); }} className="mr-3">
                      <div className="custom-control custom-checkbox">
                        <input type="checkbox" className="custom-control-input" checked={isSelected} readOnly />
                        <label className="custom-control-label"></label>
                      </div>
                    </div>
                    <div>
                      <h6 className="font-weight-bold text-primary mb-0">{e.full_name}</h6>
                      <small className="text-muted">{e.e_code} · {formatDate(e.date)}</small>
                    </div>
                  </div>
                  <span className="badge badge-light border text-monospace">{e.id}</span>
                </div>
                <div className="card-body p-3 text-secondary" style={{ fontSize: '13px', lineHeight: '1.6' }}>
                  <div className="row">
                    <div className="col-6"><strong>Type:</strong> {e.type} {e.req_type ? `(${e.req_type})` : ''}</div>
                    <div className="col-6"><strong>District:</strong> {e.district || '—'}</div>
                    <div className="col-12 mt-1">
                      <strong>Amount:</strong>{' '}
                      <span className="text-dark font-weight-bold">
                        {e.type === 'Limit' ? (
                          e.req_type === 'KM' ? `+${e.amount} KM` : `+₹${e.amount}`
                        ) : (
                          <span className="d-inline-flex align-items-center">
                            ₹{parseFloat(e.amount as any).toFixed(2)}
                            {(e as any).is_edited === 1 && (
                              <button 
                                className="btn btn-link btn-xs p-0 ml-2 text-warning"
                                onClick={(ev) => { ev.stopPropagation(); openOverrideComparison(e.id); }}
                                title="View Manager Override Details"
                              >
                                <i className="fas fa-eye" style={{ fontSize: '12px' }}></i>
                              </button>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <hr className="my-2" />
                  <div className="d-flex align-items-center justify-content-between" onClick={(ev) => ev.stopPropagation()}>
                    <span>{getStatusBadge(e.status)}</span>
                    <div className="d-flex" style={{ gap: '8px' }}>
                      {e.type === 'Expense' && (
                        <button className="btn btn-outline-secondary btn-xs py-1 px-2" onClick={() => triggerEditExpense(e.id)}>
                          <i className="fas fa-edit mr-1"></i> Edit
                        </button>
                      )}
                      <button className="btn btn-success btn-xs py-1 px-2" onClick={() => triggerApprove(e.id, e.type)}>
                        <i className="fas fa-check mr-1"></i> Approve
                      </button>
                      <button className="btn btn-danger btn-xs py-1 px-2" onClick={() => triggerReject(e.id, e.type)}>
                        <i className="fas fa-times mr-1"></i> Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DETAIL SLIDE-OVER PANEL */}
      {showPanel && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => setShowPanel(false)}></div>
          <div className="card shadow-lg" style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            right: 0,
            width: '100%',
            maxWidth: '600px',
            zIndex: 1050,
            borderRadius: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s ease both'
          }}>
            <div className="card-header bg-dark text-white border-0 d-flex justify-content-between align-items-center p-3">
              <div>
                <h4 className="card-title font-weight-bold text-white m-0">
                  <i className="fas fa-search-plus mr-2 text-white"></i>
                  {panelItemType === 'Limit' ? 'Limit Extension Details' : 'Expense Claim Details'}
                </h4>
                <small className="text-light d-block mt-1">{panelItemId}</small>
              </div>
              <button className="close text-white" onClick={() => setShowPanel(false)} style={{ background: 'none', border: 'none', outline: 'none', fontSize: '24px' }}>&times;</button>
            </div>
            
            <div className="card-body p-4" style={{ overflowY: 'auto', flex: 1 }}>
              {panelLoading ? (
                <div className="text-center p-5">
                  <i className="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
                  <p className="font-weight-bold">Fetching details...</p>
                </div>
              ) : detailData && panelItemType === 'Limit' ? (
                <div>
                  <h6 className="font-weight-bold text-uppercase text-secondary border-bottom pb-2 mb-3">Employee Details</h6>
                  <div className="row text-secondary" style={{ fontSize: '14px', lineHeight: '2' }}>
                    <div className="col-5"><strong>Employee Name:</strong></div><div className="col-7 text-dark">{detailData.request?.full_name}</div>
                    <div className="col-5"><strong>Employee Code:</strong></div><div className="col-7 text-dark"><span className="badge badge-secondary">{detailData.request?.e_code}</span></div>
                    <div className="col-5"><strong>Grade:</strong></div><div className="col-7 text-dark">{detailData.request?.grade}</div>
                    <div className="col-5"><strong>District:</strong></div><div className="col-7 text-dark">{detailData.request?.district_name}</div>
                    <div className="col-5"><strong>Limit Type:</strong></div><div className="col-7 text-dark"><span className="badge badge-warning text-white">{detailData.request?.request_type} Extension</span></div>
                    <div className="col-5"><strong>Requested Value:</strong></div><div className="col-7 text-danger font-weight-bold" style={{ fontSize: '16px' }}>{detailData.request?.request_type === 'KM' ? `${detailData.request?.requested_value} KM` : `₹${detailData.request?.requested_value}`}</div>
                  </div>
                </div>
              ) : detailData && panelItemType === 'Expense' ? (
                <div>
                  <h6 className="font-weight-bold text-uppercase text-secondary border-bottom pb-2 mb-3">Employee Details</h6>
                  <div className="row text-secondary mb-4" style={{ fontSize: '14px', lineHeight: '2' }}>
                    <div className="col-5"><strong>Employee Name:</strong></div><div className="col-7 text-dark font-weight-bold">{detailData.expense?.full_name}</div>
                    <div className="col-5"><strong>Employee Code:</strong></div><div className="col-7 text-dark"><span className="badge badge-secondary">{detailData.expense?.e_code}</span></div>
                    <div className="col-5"><strong>Area / District:</strong></div><div className="col-7 text-dark">{detailData.expense?.district}</div>
                  </div>

                  {detailData.expense?.is_edited === 1 && (
                    <div className="alert alert-warning p-2 d-flex align-items-center justify-content-between mb-3" style={{ borderRadius: '8px', fontSize: '12px' }}>
                      <div>
                        <i className="fas fa-exclamation-triangle mr-2 text-warning"></i>
                        <span>Modified by manager override.</span>
                      </div>
                      <button 
                        className="btn btn-warning btn-xs py-1 font-weight-bold" 
                        onClick={() => openOverrideComparison(detailData.expense.exp_id)}
                      >
                        <i className="fas fa-eye mr-1"></i> Compare Original
                      </button>
                    </div>
                  )}

                  <h6 className="font-weight-bold text-uppercase text-secondary border-bottom pb-2 mb-3">Expense Summary</h6>
                  <div className="row mb-4">
                    <div className="col-3 text-center">
                      <div className="p-2 border rounded bg-light">
                        <small className="text-muted text-uppercase d-block" style={{ fontSize: '9px' }}>DA</small>
                        <strong style={{ fontSize: '14px' }}>₹{detailData.expense?.da_amount || 0}</strong>
                      </div>
                    </div>
                    <div className="col-3 text-center">
                      <div className="p-2 border rounded bg-light">
                        <small className="text-muted text-uppercase d-block" style={{ fontSize: '9px' }}>Hotel</small>
                        <strong style={{ fontSize: '14px' }}>₹{detailData.expense?.hotel_amount || 0}</strong>
                      </div>
                    </div>
                    <div className="col-3 text-center">
                      <div className="p-2 border rounded bg-light">
                        <small className="text-muted text-uppercase d-block" style={{ fontSize: '9px' }}>Other</small>
                        <strong style={{ fontSize: '14px' }}>₹{detailData.expense?.other_expense_amount || 0}</strong>
                      </div>
                    </div>
                    <div className="col-3 text-center">
                      <div className="p-2 border rounded bg-success-light text-success border-success">
                        <small className="text-success text-uppercase d-block" style={{ fontSize: '9px' }}>Total</small>
                        <strong style={{ fontSize: '14px' }}>₹{detailData.expense?.total_amount || 0}</strong>
                      </div>
                    </div>
                  </div>

                  <h6 className="font-weight-bold text-uppercase text-secondary border-bottom pb-2 mb-3">Leg-wise Journey Detail</h6>
                  {(detailData.itineraries || []).map((leg, idx) => (
                    <div key={idx} className="card card-secondary card-outline shadow-sm mb-3">
                      <div className="card-header p-3 d-flex justify-content-between align-items-center border-bottom-0">
                        <div className="d-flex align-items-center">
                          <span className="badge badge-secondary mr-2" style={{ borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{leg.leg_number}</span>
                          <span className="font-weight-bold text-dark" style={{ fontSize: '14px' }}>{leg.from_location} &rarr; {leg.to_location}</span>
                        </div>
                        <span className="text-primary font-weight-bold">₹{(leg.travel_amount + leg.sub_amount + leg.da_amount + leg.hotel_amount + leg.other_amount).toFixed(2)}</span>
                      </div>
                      <div className="card-body p-3 pt-0 text-secondary" style={{ fontSize: '13px' }}>
                        <div className="p-2 border rounded bg-light mb-2">
                          <div className="row">
                            <div className="col-6"><strong>Mode:</strong> {leg.travel_mode || '—'} ({leg.distance_km} KM)</div>
                            <div className="col-6"><strong>Travel cost:</strong> ₹{leg.travel_amount}</div>
                          </div>
                          {leg.sub_mode && (
                            <div className="row mt-1 border-top pt-1">
                              <div className="col-6"><strong>Submode:</strong> {leg.sub_mode}</div>
                              <div className="col-6"><strong>Sub cost:</strong> ₹{leg.sub_amount}</div>
                            </div>
                          )}
                        </div>
                        {leg.leg_number === 1 && (
                          <div className="p-2 border rounded bg-light mb-2">
                            <div className="row">
                              <div className="col-6"><strong>DA Amount:</strong> ₹{leg.da_amount}</div>
                              <div className="col-6"><strong>Hotel Amount:</strong> ₹{leg.hotel_amount}</div>
                            </div>
                          </div>
                        )}
                        {leg.other_amount > 0 && (
                          <div className="p-2 border rounded bg-light mb-2">
                            <div className="row">
                              <div className="col-6"><strong>Other desc:</strong> {leg.other_desc || '—'}</div>
                              <div className="col-6"><strong>Other cost:</strong> ₹{leg.other_amount}</div>
                            </div>
                          </div>
                        )}
                        {(leg.ws_assigned > 0 || leg.ws_closed > 0 || leg.ws_pms > 0 || leg.ws_asset > 0) && (
                          <div className="p-2 border rounded bg-light mb-2">
                            <strong className="text-secondary d-block mb-1 text-uppercase" style={{ fontSize: '9px' }}>Work Summary</strong>
                            <div className="row text-center font-weight-bold text-dark">
                              <div className="col-3"><small className="d-block text-muted">Assign</small>{leg.ws_assigned}</div>
                              <div className="col-3"><small className="d-block text-muted">Closed</small>{leg.ws_closed}</div>
                              <div className="col-3"><small className="d-block text-muted">PMS</small>{leg.ws_pms}</div>
                              <div className="col-3"><small className="d-block text-muted">Asset</small>{leg.ws_asset}</div>
                            </div>
                          </div>
                        )}
                        <div className="mt-2">
                          <strong>Visit Purpose:</strong> {leg.visit_purpose || '—'}
                        </div>

                        {/* Attachments */}
                        {leg.attachments && leg.attachments.length > 0 && (
                          <div className="mt-3">
                            <strong className="text-secondary d-block mb-2 text-uppercase" style={{ fontSize: '9px' }}>Bill Attachments</strong>
                            <div className="d-flex flex-wrap" style={{ gap: '10px' }}>
                              {leg.attachments.map((att, aIdx) => (
                                <a key={aIdx} href={att.url} target="_blank" rel="noreferrer" className="d-inline-block p-1 border rounded text-center" style={{ width: '80px', textDecoration: 'none', background: '#fff' }}>
                                  <img src={att.url} alt={att.bill_type} className="img-thumbnail" style={{ width: '70px', height: '60px', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
                                  <span className="d-block text-muted text-uppercase mt-1" style={{ fontSize: '8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{att.bill_type.replace('_', ' ')}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* ACTION TIMELINE */}
                  <div className="card shadow-sm border-0 mb-3 bg-light" style={{ borderRadius: '8px' }}>
                    <div className="card-body p-3">
                      <h6 className="font-weight-bold text-uppercase text-secondary mb-3" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                        Action Timeline
                      </h6>
                      <div className="d-flex flex-column" style={{ gap: '12px', fontSize: '13px' }}>
                        <div className="d-flex align-items-start" style={{ gap: '10px' }}>
                          <div className="text-success mt-1" style={{ fontSize: '10px' }}>●</div>
                          <div>
                            <strong className="text-dark">Submitted</strong>
                            <div className="text-muted" style={{ fontSize: '11px' }}>{formatDate(detailData.expense.created_at || detailData.expense.submitted_at)}</div>
                          </div>
                        </div>

                        <div className="d-flex align-items-start" style={{ gap: '10px' }}>
                          <div className={detailData.expense.level_first_approver_time ? "text-success mt-1" : "text-secondary mt-1"} style={{ fontSize: '10px' }}>●</div>
                          <div>
                            <strong className="text-dark">Level 1 Action ({detailData.expense.l1_name || 'L1 Manager'})</strong>
                            {detailData.expense.level_first_approver_time ? (
                              <div className="text-muted" style={{ fontSize: '11px' }}>Approved on {formatDate(detailData.expense.level_first_approver_time)}</div>
                            ) : (
                              <div className="text-muted" style={{ fontSize: '11px' }}>Pending / No action yet</div>
                            )}
                          </div>
                        </div>

                        <div className="d-flex align-items-start" style={{ gap: '10px' }}>
                          <div className={detailData.expense.level_second_approver_time ? "text-success mt-1" : "text-secondary mt-1"} style={{ fontSize: '10px' }}>●</div>
                          <div>
                            <strong className="text-dark">Level 2 Action ({detailData.expense.l2_name || 'L2 Manager'})</strong>
                            {detailData.expense.level_second_approver_time ? (
                              <div className="text-muted" style={{ fontSize: '11px' }}>Approved on {formatDate(detailData.expense.level_second_approver_time)}</div>
                            ) : (
                              <div className="text-muted" style={{ fontSize: '11px' }}>Pending / No action yet</div>
                            )}
                          </div>
                        </div>

                        {detailData.expense.status === 'Rejected' && (
                          <div className="d-flex align-items-start" style={{ gap: '10px' }}>
                            <div className="text-danger mt-1" style={{ fontSize: '10px' }}>●</div>
                            <div>
                              <strong className="text-danger">Rejected</strong>
                              {detailData.expense.reject_reason && (
                                <div className="p-2 mt-1 border rounded bg-danger-light text-danger" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                                  Reason: {detailData.expense.reject_reason}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            
            <div className="card-footer bg-light border-0 p-3 d-flex" style={{ gap: '10px' }}>
              <button className="btn btn-secondary flex-fill btn-sm" onClick={() => setShowPanel(false)}>Close</button>
              {detailData && detailData.can_action ? (
                <>
                  {panelItemType === 'Limit' ? (
                    <button className="btn btn-outline-primary flex-fill btn-sm" onClick={() => triggerEditLimit(panelItemId!, detailData.request?.requested_value)}><i className="fas fa-edit mr-1"></i> Edit</button>
                  ) : (
                    <button className="btn btn-outline-primary flex-fill btn-sm" onClick={() => triggerEditExpense(panelItemId!)}><i className="fas fa-edit mr-1"></i> Edit</button>
                  )}
                  <button className="btn btn-danger flex-fill btn-sm" onClick={() => triggerReject(panelItemId!, panelItemType!)}><i className="fas fa-ban mr-1"></i> Reject</button>
                  <button className="btn btn-success flex-fill btn-sm" onClick={() => triggerApprove(panelItemId!, panelItemType!)}><i className="fas fa-check mr-1"></i> Approve</button>
                </>
              ) : (
                <div className="text-center w-100 font-weight-bold text-muted" style={{ fontSize: '13px' }}>This request has already been processed.</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* BOOTSTRAP APPROVE CONFIRM MODAL */}
      {showApproveModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1070 }} tabIndex={-1} role="dialog" onClick={() => setShowApproveModal(false)}>
            <div className="modal-dialog modal-dialog-centered modal-sm" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-body text-center p-4">
                  <div className="text-success mb-3" style={{ fontSize: '40px' }}><i className="fas fa-check-circle"></i></div>
                  <h5 className="font-weight-bold">Confirm Approval</h5>
                  <p className="text-muted" style={{ fontSize: '13px' }}>Are you sure you want to approve this {actionType === 'Limit' ? 'limit request' : 'expense claim'} ({actionId})?</p>
                  <div className="d-flex" style={{ gap: '10px' }}>
                    <button type="button" className="btn btn-secondary flex-fill btn-sm" onClick={() => setShowApproveModal(false)}>Cancel</button>
                    <button type="button" className="btn btn-success flex-fill btn-sm" onClick={submitApprove}>Approve</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BOOTSTRAP REJECT MODAL */}
      {showRejectModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1070 }} tabIndex={-1} role="dialog" onClick={() => setShowRejectModal(false)}>
            <div className="modal-dialog modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-danger text-white border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-white"><i className="fas fa-ban mr-2 text-white"></i> Reject Request</h5>
                  <button type="button" className="close text-white" onClick={() => setShowRejectModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-4">
                  <p className="text-muted" style={{ fontSize: '13px' }}>Please state the reason for rejecting request: <span className="font-weight-bold text-dark">{actionId}</span>.</p>
                  <div className="form-group mb-2">
                    <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Rejection Reason <span className="text-danger">*</span></label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="State reason here..."
                      value={rejectReason}
                      onChange={(e) => { setRejectReason(e.target.value); setRejectError(false); }}
                    />
                    {rejectError && <small className="text-danger font-weight-bold d-block mt-1">Rejection reason is required!</small>}
                  </div>
                </div>
                <div className="modal-footer bg-light border-top-0 justify-content-end p-3">
                  <button type="button" className="btn btn-secondary px-4 btn-sm" onClick={() => setShowRejectModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-danger px-4 btn-sm" onClick={submitReject}>Confirm Reject</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BOOTSTRAP EDIT LIMIT VALUE MODAL */}
      {showEditLimitModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1070 }} tabIndex={-1} role="dialog" onClick={() => setShowEditLimitModal(false)}>
            <div className="modal-dialog modal-dialog-centered modal-sm" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-dark text-white border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-white"><i className="fas fa-edit mr-2 text-white"></i> Edit Limit</h5>
                  <button type="button" className="close text-white" onClick={() => setShowEditLimitModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-4">
                  <div className="form-group">
                    <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Requested Value</label>
                    <input
                      type="number"
                      className="form-control text-center font-weight-bold text-primary"
                      style={{ fontSize: '18px' }}
                      value={editLimitValue}
                      onChange={(e) => setEditLimitValue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light border-top-0 justify-content-end p-3">
                  <button type="button" className="btn btn-secondary px-4 btn-sm" onClick={() => setShowEditLimitModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary px-4 btn-sm" onClick={submitEditLimit}>Save</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BOOTSTRAP MANAGER EDIT EXPENSE MODAL */}
      {showEditExpenseModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1070 }} tabIndex={-1} role="dialog" onClick={() => setShowEditExpenseModal(false)}>
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-primary text-white border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-white"><i className="fas fa-edit mr-2 text-white"></i> Edit Claim: {actionId}</h5>
                  <button type="button" className="close text-white" onClick={() => setShowEditExpenseModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {editModalLoading ? (
                    <div className="text-center p-5">
                      <div className="spinner-border text-primary" role="status"></div>
                      <p className="mt-2 font-weight-bold">Loading editor data...</p>
                    </div>
                  ) : (
                    <div>
                      {/* Summary fields */}
                      <div className="row p-3 border rounded bg-light mb-4">
                        <div className="col-md-3 form-group mb-2">
                          <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>DA Amount</label>
                          <input
                            type="number"
                            className="form-control"
                            value={editFormValues.da_amount}
                            onChange={(e) => {
                              const nextForm = { ...editFormValues, da_amount: parseFloat(e.target.value) || 0 };
                              nextForm.total_amount = recalculateEditTotal(nextForm);
                              setEditFormValues(nextForm);
                            }}
                          />
                        </div>
                        <div className="col-md-3 form-group mb-2">
                          <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Hotel Amount</label>
                          <input
                            type="number"
                            className="form-control"
                            value={editFormValues.hotel_amount}
                            onChange={(e) => {
                              const nextForm = { ...editFormValues, hotel_amount: parseFloat(e.target.value) || 0 };
                              nextForm.total_amount = recalculateEditTotal(nextForm);
                              setEditFormValues(nextForm);
                            }}
                          />
                        </div>
                        <div className="col-md-3 form-group mb-2">
                          <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Other Amount</label>
                          <input
                            type="number"
                            className="form-control"
                            value={editFormValues.other_expense_amount}
                            onChange={(e) => {
                              const nextForm = { ...editFormValues, other_expense_amount: parseFloat(e.target.value) || 0 };
                              nextForm.total_amount = recalculateEditTotal(nextForm);
                              setEditFormValues(nextForm);
                            }}
                          />
                        </div>
                        <div className="col-md-3 form-group mb-2">
                          <label className="font-weight-bold text-success text-uppercase" style={{ fontSize: '11px' }}>Total Amount</label>
                          <input
                            type="number"
                            className="form-control font-weight-bold text-success"
                            value={editFormValues.total_amount}
                            readOnly
                            style={{ background: '#e2f0d9' }}
                          />
                        </div>
                      </div>

                      {/* Itineraries List */}
                      <h6 className="font-weight-bold text-dark border-bottom pb-2 mb-3">Adjust Itinerary Legs</h6>
                      <div className="d-flex flex-column" style={{ gap: '15px' }}>
                        {editFormValues.legs.map((leg, idx) => {
                          const isOutdoor = leg.travel_type === 'Outdoor';
                          const legAllowedModes = ['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto'];
                          const legFromList = getFacilityDropdownList(leg.from_district);
                          const legToList = getFacilityDropdownList(leg.to_district);

                          return (
                            <div className="p-3 border rounded bg-white" key={leg.id} style={{ borderLeft: '4px solid #007bff !important' }}>
                              <div className="d-flex justify-content-between mb-3 align-items-center">
                                <h6 className="font-weight-bold text-primary mb-0">Leg {idx + 1}</h6>
                                <div className="btn-group btn-group-toggle btn-group-sm">
                                  <button type="button" className={`btn ${leg.travel_type === 'In-District' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => handleEditTravelTypeToggle(idx, 'In-District')}>In-District</button>
                                  <button type="button" className={`btn ${leg.travel_type === 'Outdoor' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => handleEditTravelTypeToggle(idx, 'Outdoor')}>Outdoor</button>
                                </div>
                              </div>

                              <div className="row">
                                {isOutdoor && (
                                  <div className="col-md-6 form-group mb-3">
                                    <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>From District</label>
                                    <select className="form-control" value={leg.from_district} onChange={(e) => updateEditLeg(idx, 'from_district', e.target.value)}>{getDistrictDropdowns()}</select>
                                  </div>
                                )}
                                <div className="col-md-6 form-group mb-3">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>To District</label>
                                  <select className="form-control" value={leg.to_district} disabled={!isOutdoor} onChange={(e) => updateEditLeg(idx, 'to_district', e.target.value)}>{getDistrictDropdowns()}</select>
                                </div>
                                <div className="col-md-6 form-group mb-3">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>From Location</label>
                                  <input type="text" className="form-control" placeholder="From station/hospital..." list={`edit_list_from_${idx}`} value={leg.from_location} onChange={(e) => updateEditLeg(idx, 'from_location', e.target.value)} />
                                  <datalist id={`edit_list_from_${idx}`}>{legFromList.map(f => <option key={f} value={f} />)}</datalist>
                                </div>
                                <div className="col-md-6 form-group mb-3">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>To Location</label>
                                  <input type="text" className="form-control" placeholder="To station/hospital..." list={`edit_list_to_${idx}`} value={leg.to_location} onChange={(e) => updateEditLeg(idx, 'to_location', e.target.value)} />
                                  <datalist id={`edit_list_to_${idx}`}>{legToList.map(t => <option key={t} value={t} />)}</datalist>
                                </div>
                                <div className="col-md-4 form-group mb-3">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Travel Mode</label>
                                  <select className="form-control" value={leg.travel_mode} onChange={(e) => updateEditLeg(idx, 'travel_mode', e.target.value)}>
                                    <option value="">Select Mode</option>
                                    {legAllowedModes.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                </div>
                                <div className="col-md-4 form-group mb-3">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Distance (KM)</label>
                                  <input type="number" className="form-control" readOnly={!['Bike', 'Car'].includes(leg.travel_mode)} value={leg.distance_km} onChange={(e) => updateEditLeg(idx, 'distance_km', parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="col-md-4 form-group mb-3">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Travel Amount</label>
                                  <input type="number" className="form-control font-weight-bold text-primary" value={leg.travel_amount} onChange={(e) => updateEditLeg(idx, 'travel_amount', parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="col-md-6 form-group mb-3">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Sub Mode</label>
                                  <input type="text" className="form-control" placeholder="e.g. Auto, Ferry" value={leg.sub_mode} onChange={(e) => updateEditLeg(idx, 'sub_mode', e.target.value)} />
                                </div>
                                <div className="col-md-6 form-group mb-3">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Sub Amount</label>
                                  <input type="number" className="form-control font-weight-bold" value={leg.sub_amount} onChange={(e) => updateEditLeg(idx, 'sub_amount', parseFloat(e.target.value) || 0)} />
                                </div>
                                
                                <div className="col-12 mt-2">
                                  <small className="font-weight-bold text-secondary text-uppercase d-block mb-1" style={{ fontSize: '10px' }}>Work Summary (Calls & PMS)</small>
                                  <div className="row text-center">
                                    <div className="col-3 form-group"><label style={{ fontSize: '10px' }}>Assigned</label><input type="number" className="form-control form-control-sm" value={leg.ws_assigned} onChange={(e) => updateEditLeg(idx, 'ws_assigned', parseInt(e.target.value) || 0)} /></div>
                                    <div className="col-3 form-group"><label style={{ fontSize: '10px' }}>Closed</label><input type="number" className="form-control form-control-sm" value={leg.ws_closed} onChange={(e) => updateEditLeg(idx, 'ws_closed', parseInt(e.target.value) || 0)} /></div>
                                    <div className="col-3 form-group"><label style={{ fontSize: '10px' }}>PMS</label><input type="number" className="form-control form-control-sm" value={leg.ws_pms} onChange={(e) => updateEditLeg(idx, 'ws_pms', parseInt(e.target.value) || 0)} /></div>
                                    <div className="col-3 form-group"><label style={{ fontSize: '10px' }}>Asset</label><input type="number" className="form-control form-control-sm" value={leg.ws_asset} onChange={(e) => updateEditLeg(idx, 'ws_asset', parseInt(e.target.value) || 0)} /></div>
                                  </div>
                                </div>
                                <div className="col-12 form-group mt-2">
                                  <label className="font-weight-bold text-secondary text-uppercase" style={{ fontSize: '11px' }}>Visit Purpose</label>
                                  <input type="text" className="form-control" value={leg.visit_purpose} onChange={(e) => updateEditLeg(idx, 'visit_purpose', e.target.value)} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button type="button" className="btn btn-outline-primary w-100 mt-3 p-3 font-weight-bold" style={{ borderStyle: 'dashed' }} onClick={addNewEditLeg}>
                        + Append Another Journey Leg
                      </button>

                      {/* Manager remark for modifications */}
                      <div className="form-group mt-3 pt-3 border-top">
                        <label className="font-weight-bold text-danger text-uppercase" style={{ fontSize: '11px' }}>
                          Manager Override Reason/Remark <span className="text-danger">*</span>
                        </label>
                        <textarea
                          className={`form-control ${managerRemarkError ? 'is-invalid' : ''}`}
                          rows={2}
                          placeholder="Enter the reason for modifying this claim's details/amounts..."
                          value={managerRemark}
                          onChange={(e) => {
                            setManagerRemark(e.target.value);
                            setManagerRemarkError(false);
                          }}
                        />
                        {managerRemarkError && (
                          <div className="invalid-feedback font-weight-bold">
                            Manager override remark is required to save modifications.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer bg-light border-top-0 justify-content-end p-3">
                  <button type="button" className="btn btn-secondary px-4 btn-sm" onClick={() => setShowEditExpenseModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary px-4 btn-sm" onClick={submitEditExpense}>Save Overrides</button>
                </div>
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

      {/* BOOTSTRAP OVERRIDE COMPARISON MODAL */}
      {showCompareModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1070 }} tabIndex={-1} role="dialog" onClick={() => setShowCompareModal(false)}>
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-dark text-white border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-white">
                    <i className="fas fa-eye mr-2 text-white"></i> Override Comparison
                  </h5>
                  <button type="button" className="close text-white" onClick={() => setShowCompareModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                  {compareModalLoading ? (
                    <div className="text-center p-5">
                      <div className="spinner-border text-primary" role="status"></div>
                      <p className="mt-2 font-weight-bold">Loading override history...</p>
                    </div>
                  ) : compareData ? (
                    <div>
                      {/* Summary card comparison */}
                      <div className="row text-center mb-4">
                        <div className="col-md-6 mb-3 mb-md-0">
                          <div className="p-3 border rounded bg-light">
                            <span className="text-muted font-weight-bold text-uppercase d-block" style={{ fontSize: '10px' }}>Original Total</span>
                            <h3 className="font-weight-bold text-dark mt-1">₹{compareData.expense?.original_amount?.toFixed(2) || '0.00'}</h3>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="p-3 border rounded bg-success-light border-success text-success">
                            <span className="text-success font-weight-bold text-uppercase d-block" style={{ fontSize: '10px' }}>Manager Override Total</span>
                            <h3 className="font-weight-bold text-success mt-1">₹{compareData.expense?.total_amount?.toFixed(2) || '0.00'}</h3>
                          </div>
                        </div>
                      </div>

                      {/* Manager Remark Card */}
                      <div className="card bg-light border-0 mb-4" style={{ borderRadius: '8px' }}>
                        <div className="card-body p-3">
                          <span className="text-muted font-weight-bold text-uppercase d-block mb-1" style={{ fontSize: '10px' }}>Manager Remarks / Reason</span>
                          <p className="text-dark font-italic mb-0" style={{ fontSize: '13px' }}>
                            "{compareData.expense?.manager_edit_remark || 'No remark provided.'}"
                          </p>
                        </div>
                      </div>

                      {/* Leg-by-leg Comparison Table */}
                      <h6 className="font-weight-bold text-dark border-bottom pb-2 mb-3">Itinerary Changes</h6>
                      <div className="table-responsive">
                        <table className="table table-bordered table-striped align-middle" style={{ fontSize: '12px' }}>
                          <thead className="bg-light text-secondary">
                            <tr>
                              <th>Leg</th>
                              <th>Field</th>
                              <th>Original Claim (Before Edit)</th>
                              <th>Overridden Claim (Final)</th>
                            </tr>
                          </thead>
                           <tbody>
                             {(() => {
                               let originalLegs: any[] = [];
                               try {
                                 if (compareData.expense?.original_details) {
                                   originalLegs = JSON.parse(compareData.expense.original_details);
                                 }
                               } catch (e) {
                                 originalLegs = [];
                               }

                               const maxLegs = Math.max(originalLegs.length, (compareData.itineraries || []).length);
                               const rows: any[] = [];

                               for (let i = 0; i < maxLegs; i++) {
                                 const orig = originalLegs[i];
                                 const curr = compareData.itineraries?.[i];

                                 // Helper function to compare and render text color change
                                 const renderCell = (oVal: any, cVal: any, formatFn?: (v: any) => string) => {
                                   const oStr = formatFn ? formatFn(oVal) : String(oVal ?? '—');
                                   const cStr = formatFn ? formatFn(cVal) : String(cVal ?? '—');
                                   if (oStr !== cStr) {
                                     return {
                                       o: <span className="text-danger font-weight-bold">{oStr}</span>,
                                       c: <span className="text-success font-weight-bold">{cStr}</span>
                                     };
                                   }
                                   return { o: <span>{oStr}</span>, c: <span>{cStr}</span> };
                                 };

                                 if (!orig && curr) {
                                   rows.push(
                                     <tr key={`leg-${i}-added`}>
                                       <td className="font-weight-bold text-success text-center">Leg {i + 1}</td>
                                       <td colSpan={3} className="text-success font-weight-bold bg-success-light">
                                         [Added by Manager] Journey: {curr.from_location} &rarr; {curr.to_location} ({curr.travel_mode}, ₹{(curr.travel_amount + curr.sub_amount).toFixed(2)})
                                       </td>
                                     </tr>
                                   );
                                 } else if (orig && !curr) {
                                   rows.push(
                                     <tr key={`leg-${i}-deleted`}>
                                       <td className="font-weight-bold text-danger text-center">Leg {i + 1}</td>
                                       <td colSpan={3} className="text-danger font-weight-bold bg-danger-light text-decoration-line-through">
                                         [Deleted by Manager] Journey: {orig.from_location} &rarr; {orig.to_location} ({orig.travel_mode}, ₹{(orig.travel_amount + orig.sub_amount).toFixed(2)})
                                       </td>
                                     </tr>
                                   );
                                 } else if (orig && curr) {
                                   const journeyComp = renderCell(
                                     `${orig.from_location || ''} → ${orig.to_location || ''}`,
                                     `${curr.from_location || ''} → ${curr.to_location || ''}`
                                   );
                                   const modeComp = renderCell(
                                     `${orig.travel_mode || '—'} (${orig.distance_km || 0} KM)`,
                                     `${curr.travel_mode || '—'} (${curr.distance_km || 0} KM)`
                                   );
                                   const amtComp = renderCell(
                                     orig.travel_amount,
                                     curr.travel_amount,
                                     (v) => `₹${parseFloat(v || 0).toFixed(2)}`
                                   );
                                   const subComp = renderCell(
                                     orig.sub_amount > 0 ? `${orig.sub_mode || 'Sub'}: ₹${orig.sub_amount}` : '—',
                                     curr.sub_amount > 0 ? `${curr.sub_mode || 'Sub'}: ₹${curr.sub_amount}` : '—'
                                   );

                                   const hasDiff = 
                                     `${orig.from_location || ''} → ${orig.to_location || ''}` !== `${curr.from_location || ''} → ${curr.to_location || ''}` ||
                                     `${orig.travel_mode || '—'} (${orig.distance_km || 0} KM)` !== `${curr.travel_mode || '—'} (${curr.distance_km || 0} KM)` ||
                                     orig.travel_amount !== curr.travel_amount ||
                                     orig.sub_amount !== curr.sub_amount;

                                   rows.push(
                                     <tr key={`leg-${i}`} className={hasDiff ? "table-warning-light" : ""}>
                                       <td rowSpan={4} className="font-weight-bold text-center align-middle" style={{ width: '70px', background: '#f8fafc' }}>Leg {i + 1}</td>
                                       <td><strong>Route</strong></td>
                                       <td>{journeyComp.o}</td>
                                       <td>{journeyComp.c}</td>
                                     </tr>,
                                     <tr key={`leg-${i}-mode`} className={hasDiff ? "table-warning-light" : ""}>
                                       <td><strong>Mode (KM)</strong></td>
                                       <td>{modeComp.o}</td>
                                       <td>{modeComp.c}</td>
                                     </tr>,
                                     <tr key={`leg-${i}-amt`} className={hasDiff ? "table-warning-light" : ""}>
                                       <td><strong>Travel Cost</strong></td>
                                       <td>{amtComp.o}</td>
                                       <td>{amtComp.c}</td>
                                     </tr>,
                                     <tr key={`leg-${i}-sub`} className={hasDiff ? "table-warning-light" : ""}>
                                       <td><strong>Sub-cost</strong></td>
                                       <td>{subComp.o}</td>
                                       <td>{subComp.c}</td>
                                     </tr>
                                   );
                                 }
                               }
                               return rows;
                             })()}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   ) : null}
                 </div>
                 <div className="modal-footer bg-light border-top-0 justify-content-end p-3">
                   <button type="button" className="btn btn-secondary px-4 btn-sm" onClick={() => setShowCompareModal(false)}>Close</button>
                 </div>
               </div>
             </div>
           </div>
         </>
       )}

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
    </div>
  );
}
