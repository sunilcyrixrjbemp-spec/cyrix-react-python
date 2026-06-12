import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../css/home.css';
import Loader from '../components/Loader';

interface ExpenseItem {
  id: string;
  date: string;
  amount: number;
  status: string;
  full_name: string;
  e_code: string;
  type?: string;
}

interface TeamMemberSummary {
  name: string;
  e_code: string;
  count: number;
  totalAmount: number;
  expenses: ExpenseItem[];
}

interface LegAttachment {
  url: string;
  bill_type: string;
}

interface LegDetail {
  leg_number: number;
  from_location: string;
  to_location: string;
  from_district: string;
  to_district: string;
  travel_mode: string;
  sub_mode?: string;
  sub_km?: number;
  distance_km: number;
  travel_amount: number;
  sub_amount?: number;
  da_amount: number;
  hotel_amount: number;
  other_desc?: string;
  other_amount?: number;
  ws_assigned: number;
  ws_closed: number;
  ws_pms: number;
  ws_asset: number;
  visit_purpose?: string;
  travel_type?: string;
  attachments: LegAttachment[];
}

interface ExpenseDetail {
  exp_id: string;
  user_id: string;
  full_name: string;
  e_code: string;
  grade: string;
  designation: string;
  district_name?: string;
  home_district?: string;
  mobile_number?: string;
  expense_date: string;
  total_amount: number;
  status: string;
  created_at?: string;
  submitted_at?: string;
  level_first_approver: string;
  level_second_approver: string;
  l1_name?: string;
  l2_name?: string;
  l1_action_date?: string;
  l2_action_date?: string;
  reject_reason?: string;
  action_level?: string;
  approved_by?: string;
  da_amount?: number;
  da?: number;
  hotel_amount?: number;
  hotel?: number;
  other_expense_amount?: number;
  oth_amount?: number;
}

const ICONS = {
  dashboard: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  admin: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  approval: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  expense: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  ),
  report: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  upload: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  month: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
};

const ALL_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, colorCls: 'c-purple', path: '/home', roles: ['Admin', 'Superadmin', 'Manager', 'Engineer', 'Coordinator', 'Accounts', 'Divisional Manager', 'District Incharge'] },
  { id: 'admin', label: 'Admin Panel', icon: ICONS.admin, colorCls: 'c-pink', path: '/admin', roles: ['Admin', 'Superadmin'] },
  { id: 'approval', label: 'Approval Center', icon: ICONS.approval, colorCls: 'c-green', path: '/approval', roles: ['Admin', 'Superadmin', 'Manager', 'Coordinator', 'Divisional Manager'] },
  { id: 'expense', label: 'Submit Claim', icon: ICONS.expense, colorCls: 'c-teal', path: '/expense', roles: ['Admin', 'Superadmin', 'Engineer'] },
  { id: 'report', label: 'Analytics', icon: ICONS.report, colorCls: 'c-blue', path: '/dashboard', roles: ['Admin', 'Superadmin', 'Engineer', 'Manager', 'Coordinator', 'Divisional Manager', 'District Incharge'] },
  { id: 'upload', label: 'Data Sync', icon: ICONS.upload, colorCls: 'c-orange', path: '/upload', roles: ['Admin', 'Superadmin'] },
  { id: 'month', label: 'Month Summary', icon: ICONS.month, colorCls: 'c-red', path: '/month', roles: ['Admin', 'Superadmin', 'Manager', 'Coordinator', 'Accounts', 'Divisional Manager'] }
];

export default function Home() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState('');
  const [myExpenses, setMyExpenses] = useState<ExpenseItem[]>([]);
  const [teamExpenses, setTeamExpenses] = useState<ExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaderMsg, setLoaderMsg] = useState('Fetching Data...');

  // Modal stats
  const [myStats, setMyStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 });
  const [teamStats, setTeamStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 });

  // List Popups
  const [listModalFilter, setListModalFilter] = useState<'All' | 'Approved' | 'Pending' | 'Rejected' | null>(null);
  const [listModalData, setListModalData] = useState<ExpenseItem[]>([]);
  const [listModalTitle, setListModalTitle] = useState('');
  
  // Team Members Modal
  const [teamModalFilter, setTeamModalFilter] = useState<'All' | 'Approved' | 'Pending' | 'Rejected' | null>(null);
  const [teamGroupedData, setTeamGroupedData] = useState<{ [key: string]: TeamMemberSummary }>({});

  // Slide-out Detail Panel
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [detailExpId, setDetailExpId] = useState('');
  const [detailType, setDetailType] = useState<'Expense' | 'Limit'>('Expense');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailExpense, setDetailExpense] = useState<ExpenseDetail | null>(null);
  const [detailItineraries, setDetailItineraries] = useState<LegDetail[]>([]);
  const [detailLimitReq, setDetailLimitReq] = useState<any | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('user_role') || '';
    const name = localStorage.getItem('display_name') || '';
    const uId = localStorage.getItem('logged_in_user_id') || localStorage.getItem('user_id') || '';
    const menus = localStorage.getItem('allowed_menus') || 'dashboard,expense,profile';

    if (!role || !uId) {
      navigate('/');
      return;
    }

    setUserId(uId.replace(/['"]/g, '').trim());
    setUserRole(role);
    setDisplayName(name);
    setAllowedMenus(menus.split(',').map(m => m.trim().toLowerCase()));

    const today = new Date();
    const defaultMonth = today.toISOString().slice(0, 7);
    setSelectedMonth(defaultMonth);
  }, [navigate]);

  useEffect(() => {
    if (userId && selectedMonth) {
      fetchDashboardData();
    }
  }, [userId, selectedMonth]);

  const fetchDashboardData = async () => {
    setLoaderMsg("Fetching Data...");
    setIsLoading(true);

    // 1. Fetch own expenses
    let ownExpensesList: ExpenseItem[] = [];
    try {
      const ownRes = await fetch(`/api/home/list?user_id=${userId}&month=${selectedMonth}`);
      if (!ownRes.ok && !['Admin', 'Superadmin'].includes(userRole)) {
        // Fallback
        const fallbackRes = await fetch(`/api/expense/list?user_id=${userId}&month=${selectedMonth}`);
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          ownExpensesList = fallbackData.success && fallbackData.expenses ? fallbackData.expenses : [];
        }
      } else if (ownRes.ok) {
        const data = await ownRes.json();
        ownExpensesList = data.success && data.expenses ? data.expenses : [];
      }
    } catch (e) {
      console.error("Error fetching own expenses", e);
    }
    setMyExpenses(ownExpensesList);

    // 2. Fetch Team expenses if authorized
    const showTeamStats = ['Manager', 'Admin', 'Superadmin', 'Coordinator', 'Divisional Manager'].includes(userRole);
    let teamExpensesList: ExpenseItem[] = [];
    if (showTeamStats) {
      try {
        const teamRes = await fetch(`/api/approval/list?user_id=${userId}&month=${selectedMonth}&status=All`);
        if (teamRes.ok) {
          const tData = await teamRes.json();
          teamExpensesList = tData.expenses || [];
        }
      } catch (e) {
        console.error("Error fetching team expenses", e);
      }
    }
    setTeamExpenses(teamExpensesList);

    // 3. Compute stats
    calculateStats(ownExpensesList, teamExpensesList);
    setIsLoading(false);
  };

  const calculateStats = (ownList: ExpenseItem[], tList: ExpenseItem[]) => {
    // My Stats
    let total = 0, approved = 0, pending = 0, rejected = 0;
    ownList.forEach(exp => {
      if (exp.type === 'Limit') return;
      const amt = exp.amount || 0;
      total += amt;
      const st = (exp.status || '').toLowerCase();
      if (st === 'approved') approved += amt;
      else if (st === 'rejected') rejected += amt;
      else pending += amt;
    });
    setMyStats({ total, approved, pending, rejected });

    // Team Stats
    let tTotal = 0, tApproved = 0, tPending = 0, tRejected = 0;
    tList.forEach(exp => {
      if (exp.type === 'Limit') return;
      const amt = exp.amount || 0;
      tTotal += amt;
      const st = (exp.status || '').toLowerCase();
      if (st === 'approved') tApproved += amt;
      else if (st === 'rejected') tRejected += amt;
      else tPending += amt;
    });
    setTeamStats({ total: tTotal, approved: tApproved, pending: tPending, rejected: tRejected });
  };

  const syncMonthFilter = (val: string) => {
    setSelectedMonth(val);
  };

  // Standard List Modal
  const openListModal = (filterType: 'All' | 'Approved' | 'Pending' | 'Rejected', dataset = myExpenses, customTitle: string | null = null) => {
    setTeamModalFilter(null); // Close team modal
    
    let filtered = dataset;
    let title = customTitle || (filterType === 'All' ? "All Expenses" : `${filterType} Expenses`);

    if (filterType !== 'All') {
      filtered = filtered.filter(exp => {
        const st = (exp.status || '').toLowerCase();
        if (filterType === 'Approved') return st === 'approved';
        if (filterType === 'Rejected') return st === 'rejected';
        if (filterType === 'Pending') return st !== 'approved' && st !== 'rejected';
        return true;
      });
    }

    setListModalTitle(title);
    setListModalFilter(filterType);
    setListModalData(filtered.filter(e => e.type !== 'Limit'));
  };

  const closeListModal = () => {
    setListModalFilter(null);
  };

  // Team Members Modal
  const openTeamEngineersModal = (filterType: 'All' | 'Approved' | 'Pending' | 'Rejected') => {
    closeListModal();

    let filtered = teamExpenses;
    if (filterType !== 'All') {
      filtered = filtered.filter(exp => {
        const st = (exp.status || '').toLowerCase();
        if (filterType === 'Approved') return st === 'approved';
        if (filterType === 'Rejected') return st === 'rejected';
        if (filterType === 'Pending') return st !== 'approved' && st !== 'rejected';
        return true;
      });
    }

    const grouped: { [key: string]: TeamMemberSummary } = {};
    filtered.forEach(exp => {
      if (exp.type === 'Limit') return;
      const ecode = exp.e_code || exp.full_name || 'Unknown';
      if (!grouped[ecode]) {
        grouped[ecode] = {
          name: exp.full_name || 'Unknown',
          e_code: ecode,
          count: 0,
          totalAmount: 0,
          expenses: []
        };
      }
      grouped[ecode].count++;
      grouped[ecode].totalAmount += exp.amount || 0;
      grouped[ecode].expenses.push(exp);
    });

    setTeamGroupedData(grouped);
    setTeamModalFilter(filterType);
  };

  const closeTeamEngineersModal = () => {
    setTeamModalFilter(null);
  };

  const openTeamEmployeeExpenses = (e_code: string) => {
    const empData = teamGroupedData[e_code];
    if (empData && empData.expenses) {
      closeTeamEngineersModal();
      const customTitle = `${empData.name}'s ${teamModalFilter === 'All' ? 'Expenses' : teamModalFilter + ' Expenses'}`;
      openListModal('All', empData.expenses, customTitle);
    }
  };

  // Side Detail Panel
  const openPanel = async (id: string, type: 'Expense' | 'Limit' = 'Expense') => {
    closeListModal();
    closeTeamEngineersModal();

    setDetailExpId(id);
    setDetailType(type);
    setDetailLoading(true);
    setDetailPanelOpen(true);
    setDetailExpense(null);
    setDetailItineraries([]);
    setDetailLimitReq(null);

    try {
      let res;
      if (type === 'Limit') {
        res = await fetch(`/api/approval/detail?id=${id}&type=Limit&user_id=${userId}`);
      } else {
        res = await fetch(`/api/home/detail?exp_id=${id}&user_id=${userId}`);
        if (!res.ok) {
          res = await fetch(`/api/approval/detail?id=${id}&type=Expense&user_id=${userId}`);
        }
      }

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (type === 'Limit') {
            setDetailLimitReq(data.request);
          } else {
            setDetailExpense(data.expense);
            setDetailItineraries(data.itineraries || []);
          }
        }
      }
    } catch (e) {
      console.error("Connection error loading details panel", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const closePanel = () => {
    setDetailPanelOpen(false);
  };

  // Helper date and badges
  const getStatusBadge = (status: string) => {
    const st = (status || 'Pending').toLowerCase();
    let cls = 'pending';
    if (st === 'approved') cls = 'approved';
    if (st === 'rejected') cls = 'rejected';
    return <span className={`status-badge ${cls}`}>{status || 'Pending'}</span>;
  };

  const formatDate = (str: string) => {
    if (!str) return '—';
    try {
      return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return str;
    }
  };

  const formatDateTime = (str: string) => {
    if (!str) return '—';
    try {
      const d = new Date(str);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return str;
    }
  };

  const showTeamSection = ['Manager', 'Admin', 'Superadmin', 'Coordinator', 'Divisional Manager'].includes(userRole);
  const activeMenuItems = ALL_MENU_ITEMS.filter(m => {
    if (!m.roles.includes(userRole)) return false;
    if (m.id === 'dashboard') return false;
    if (userRole === 'Admin' || userRole === 'Superadmin') return true;
    return allowedMenus.includes(m.id.toLowerCase());
  });

  return (
    <div style={{ width: '100%' }}>
      {/* WELCOME CARD (Desktop & Mobile) */}
      <div className="welcome-card desktop-only">
        <div className="welcome-text">
          <h1>
            Welcome, <span id="desktop-user-name">{displayName}</span>!
            <svg className="svg-icon" style={{ width: '28px', height: '28px', color: 'var(--primary)', marginLeft: '8px' }} viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </h1>
          <p>
            Track your submitted expense claims and their current status.
            <span className="role-badge" style={{ marginLeft: '8px' }}>
              <svg className="svg-icon" style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              <span id="desktop-user-role" style={{ marginLeft: '4px' }}>{userRole}</span>
            </span>
          </p>
        </div>
        <div className="month-filter-wrap">
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Select Month:</label>
          <input
            type="month"
            id="monthFilter"
            value={selectedMonth}
            onChange={(e) => syncMonthFilter(e.target.value)}
            className="month-filter-input"
            style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '14px', border: 'none', outline: 'none', background: 'transparent' }}
          />
        </div>
      </div>

      <div className="mobile-header-card hide-desktop">
        <div className="mhc-top">
          <div className="mhc-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="mhc-info">
            <h3 id="mobile-user-name">{displayName}</h3>
            <p>Field Management System</p>
          </div>
          <div className="mhc-role" id="mobile-role-chip">{userRole}</div>
        </div>
        <div className="mhc-bottom">
          <label>SELECT MONTH:</label>
          <input type="month" id="monthFilterMobile" value={selectedMonth} onChange={(e) => syncMonthFilter(e.target.value)} />
        </div>
      </div>

      {/* MY EXPENSES SECTION */}
      <div className="section-header-title hide-desktop" style={{ margin: '0 16px 12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-3)' }}>My Expenses</div>
      <div className="section-header-title desktop-only" style={{ marginTop: 0 }}>My Expenses</div>

      {/* 4 Stat Cards (Desktop) */}
      <div className="stats-grid desktop-only">
        <div className="stat-card total active" onClick={() => openListModal('All')}>
          <div className="stat-icon">{ICONS.expense}</div>
          <div className="stat-info"><h3>₹{myStats.total.toLocaleString('en-IN')}</h3><p>Total Claimed</p></div>
        </div>
        <div className="stat-card gold" onClick={() => openListModal('Approved')}>
          <div className="stat-icon">
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="stat-info"><h3>₹{myStats.approved.toLocaleString('en-IN')}</h3><p>Approved</p></div>
        </div>
        <div className="stat-card accent" onClick={() => openListModal('Pending')}>
          <div className="stat-icon">
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-info"><h3>₹{myStats.pending.toLocaleString('en-IN')}</h3><p>Pending</p></div>
        </div>
        <div className="stat-card green" onClick={() => openListModal('Rejected')}>
          <div className="stat-icon">
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="stat-info"><h3>₹{myStats.rejected.toLocaleString('en-IN')}</h3><p>Rejected</p></div>
        </div>
      </div>

      {/* 4 Stat Cards (Mobile) */}
      <div className="mobile-stats hide-desktop">
        <div className="mobile-stat-card active" onClick={() => openListModal('All')}>
          <div className="ms-icon" style={{ color: '#4f46e5', background: '#e0e7ff', borderRadius: '8px', padding: '6px' }}>{ICONS.expense}</div>
          <div className="ms-val">₹{myStats.total.toLocaleString('en-IN')}</div>
          <div className="ms-lbl">Total Claimed</div>
        </div>
        <div className="mobile-stat-card gold" onClick={() => openListModal('Approved')}>
          <div className="ms-icon" style={{ color: '#10b981', background: '#dcfce7', borderRadius: '8px', padding: '6px' }}>
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ms-val">₹{myStats.approved.toLocaleString('en-IN')}</div>
          <div className="ms-lbl">Approved</div>
        </div>
        <div className="mobile-stat-card accent" onClick={() => openListModal('Pending')}>
          <div className="ms-icon" style={{ color: '#d97706', background: '#fef9c3', borderRadius: '8px', padding: '6px' }}>
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="ms-val">₹{myStats.pending.toLocaleString('en-IN')}</div>
          <div className="ms-lbl">Pending</div>
        </div>
        <div className="mobile-stat-card green" onClick={() => openListModal('Rejected')}>
          <div className="ms-icon" style={{ color: '#ef4444', background: '#fee2e2', borderRadius: '8px', padding: '6px' }}>
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="ms-val">₹{myStats.rejected.toLocaleString('en-IN')}</div>
          <div className="ms-lbl">Rejected</div>
        </div>
      </div>

      {/* TEAM EXPENSES SECTION (If Manager/Approver) */}
      {showTeamSection && (
        <div style={{ marginTop: '16px' }}>
          <div className="section-header-title hide-desktop" style={{ margin: '0 16px 12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Team Expenses</div>
          <div className="section-header-title desktop-only" style={{ marginTop: '16px' }}>Team Expenses</div>

          {/* Team Stats Grid (Desktop) */}
          <div className="stats-grid desktop-only">
            <div className="stat-card total active" onClick={() => openTeamEngineersModal('All')}>
              <div className="stat-icon">{ICONS.expense}</div>
              <div className="stat-info"><h3>₹{teamStats.total.toLocaleString('en-IN')}</h3><p>Team Claimed</p></div>
            </div>
            <div className="stat-card gold" onClick={() => openTeamEngineersModal('Approved')}>
              <div className="stat-icon">
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="stat-info"><h3>₹{teamStats.approved.toLocaleString('en-IN')}</h3><p>Team Approved</p></div>
            </div>
            <div className="stat-card accent" onClick={() => openTeamEngineersModal('Pending')}>
              <div className="stat-icon">
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="stat-info"><h3>₹{teamStats.pending.toLocaleString('en-IN')}</h3><p>Team Pending</p></div>
            </div>
            <div className="stat-card green" onClick={() => openTeamEngineersModal('Rejected')}>
              <div className="stat-icon">
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div className="stat-info"><h3>₹{teamStats.rejected.toLocaleString('en-IN')}</h3><p>Team Rejected</p></div>
            </div>
          </div>

          {/* Team Stats Cards (Mobile) */}
          <div className="mobile-stats hide-desktop">
            <div className="mobile-stat-card active" onClick={() => openTeamEngineersModal('All')}>
              <div className="ms-icon" style={{ color: '#4f46e5', background: '#e0e7ff', borderRadius: '8px', padding: '6px' }}>{ICONS.expense}</div>
              <div className="ms-val">₹{teamStats.total.toLocaleString('en-IN')}</div>
              <div className="ms-lbl">Team Total</div>
            </div>
            <div className="mobile-stat-card gold" onClick={() => openTeamEngineersModal('Approved')}>
              <div className="ms-icon" style={{ color: '#10b981', background: '#dcfce7', borderRadius: '8px', padding: '6px' }}>
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ms-val">₹{teamStats.approved.toLocaleString('en-IN')}</div>
              <div className="ms-lbl">Team Approved</div>
            </div>
            <div className="mobile-stat-card accent" onClick={() => openTeamEngineersModal('Pending')}>
              <div className="ms-icon" style={{ color: '#d97706', background: '#fef9c3', borderRadius: '8px', padding: '6px' }}>
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="ms-val">₹{teamStats.pending.toLocaleString('en-IN')}</div>
              <div className="ms-lbl">Team Pending</div>
            </div>
            <div className="mobile-stat-card green" onClick={() => openTeamEngineersModal('Rejected')}>
              <div className="ms-icon" style={{ color: '#ef4444', background: '#fee2e2', borderRadius: '8px', padding: '6px' }}>
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div className="ms-val">₹{teamStats.rejected.toLocaleString('en-IN')}</div>
              <div className="ms-lbl">Team Rejected</div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Quick Actions */}
      <div className="quick-actions desktop-only">
        <div className="section-title">
          <svg className="svg-icon" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Quick Actions
        </div>
        <div className="action-grid" id="desktop-action-grid">
          {activeMenuItems.map(item => (
            <Link key={item.id} to={item.path} className="action-btn" style={{ textDecoration: 'none' }}>
              <div className="mobile-card">
                <div className={`mc-icon ${item.colorCls}`}>{item.icon}</div>
                <div className="mc-title">{item.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile Menu Grid */}
      <div className="mobile-menu-section hide-desktop">
        <div className="mobile-section-title">Quick Links</div>
        <div className="mobile-grid" id="mobile-grid">
          {activeMenuItems.map(item => (
            <Link key={item.id} to={item.path} className="mobile-card" style={{ textDecoration: 'none' }}>
              <div className={`mc-icon ${item.colorCls}`}>{item.icon}</div>
              <div className="mc-title">{item.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* POPUP 1: STANDARD LIST MODAL (Expenses) */}
      {listModalFilter !== null && (
        <div className="list-modal-overlay" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) closeListModal(); }}>
          <div className="list-modal">
            <div className="list-modal-header">
              <h3 id="listModalTitle"><span>{listModalTitle}</span></h3>
              <button className="panel-close" onClick={closeListModal}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="list-modal-body">
              <table id="listTable">
                <thead className="desktop-only">
                  <tr>
                    <th>Expense ID</th>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Amount (₹)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="listTableBody">
                  {listModalData.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: 600 }}>No expenses found.</td>
                    </tr>
                  ) : (
                    [...listModalData]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(exp => (
                        <tr key={exp.id} onClick={() => openPanel(exp.id, 'Expense')}>
                          <td data-label="Expense ID"><div className="cell-val mono">{exp.id}</div></td>
                          <td data-label="Employee"><div className="cell-val" style={{ fontWeight: 600 }}>{exp.full_name}</div></td>
                          <td data-label="Date"><div className="cell-val">{formatDate(exp.date)}</div></td>
                          <td data-label="Amount (₹)" className="amount-cell"><div className="cell-val">₹{exp.amount.toFixed(2)}</div></td>
                          <td data-label="Status"><div className="cell-val">{getStatusBadge(exp.status)}</div></td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: TEAM ENGINEERS LIST MODAL */}
      {teamModalFilter !== null && (
        <div className="list-modal-overlay" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) closeTeamEngineersModal(); }}>
          <div className="list-modal">
            <div className="list-modal-header">
              <h3 id="teamListModalTitle">
                <span>{teamModalFilter === 'All' ? "All Team Members" : `Team Members (${teamModalFilter})`}</span>
              </h3>
              <button className="panel-close" onClick={closeTeamEngineersModal}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="list-modal-body">
              <table id="teamListTable">
                <thead className="desktop-only">
                  <tr>
                    <th>Employee Name</th>
                    <th>E-Code</th>
                    <th>Expense Count</th>
                    <th>Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody id="teamListTableBody">
                  {Object.values(teamGroupedData).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: 600 }}>No team expenses found for this status.</td>
                    </tr>
                  ) : (
                    Object.values(teamGroupedData)
                      .sort((a, b) => b.totalAmount - a.totalAmount)
                      .map(emp => (
                        <tr key={emp.e_code} onClick={() => openTeamEmployeeExpenses(emp.e_code)}>
                          <td data-label="Employee Name"><div className="cell-val" style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{emp.name}</div></td>
                          <td data-label="E-Code"><div className="cell-val"><span className="user-id-tag">{emp.e_code}</span></div></td>
                          <td data-label="Expense Count"><div className="cell-val">{emp.count} Records</div></td>
                          <td data-label="Total Amount" className="amount-cell"><div className="cell-val" style={{ color: 'var(--primary)' }}>₹{emp.totalAmount.toLocaleString('en-IN')}</div></td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Panel Overlay for Side Panel */}
      {detailPanelOpen && <div className="panel-overlay active" onClick={closePanel}></div>}

      {/* Right Side Detail Panel */}
      <div className={`detail-panel ${detailPanelOpen ? 'open' : ''}`} id="detailPanel">
        <div className="panel-header">
          <div>
            <h3 id="panelExpId">{detailType === 'Limit' ? 'Limit Extension Request' : 'Expense Details'}</h3>
            <p id="panelSubtitle">
              {detailLoading ? 'Loading details...' : 
                detailType === 'Limit' && detailLimitReq ? `${detailLimitReq.full_name} · ${formatDate(detailLimitReq.created_at)}` : 
                detailExpense ? `${detailExpense.full_name} · ${formatDate(detailExpense.expense_date)}` : ''
              }
            </p>
          </div>
          <button className="panel-close" onClick={closePanel}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="panel-body" id="panelBody">
          {detailLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-3)', fontWeight: 600 }}>Loading...</div>
          ) : detailType === 'Limit' && detailLimitReq ? (
            <div>
              <div className="panel-section">
                <div className="panel-section-title">Employee Information</div>
                <div className="emp-info-box">
                  <div className="emp-info-grid">
                    <div className="info-item full"><label>Employee Name</label><p style={{ fontSize: '16px' }}>{detailLimitReq.full_name || '—'}</p></div>
                    <div className="info-item"><label>E-Code</label><p>{detailLimitReq.e_code || '—'}</p></div>
                    <div className="info-item"><label>Grade</label><p>{detailLimitReq.grade || '—'}</p></div>
                    <div className="info-item"><label>District</label><p>{detailLimitReq.district_name || '—'}</p></div>
                    {detailLimitReq.mobile_number && <div className="info-item"><label>Mobile</label><p>{detailLimitReq.mobile_number}</p></div>}
                    <div className="info-item full"><label>Request Type</label><p style={{ color: 'var(--warning)', fontWeight: 800, fontSize: '15px' }}>Monthly {detailLimitReq.request_type} Limit Extension</p></div>
                    <div className="info-item amount"><label>Extra Limit Requested</label><p style={{ color: 'var(--danger)' }}>{detailLimitReq.request_type === 'KM' ? `${detailLimitReq.requested_value} KM` : `₹${detailLimitReq.requested_value}`}</p></div>
                    <div className="info-item"><label>Status</label><div style={{ marginTop: '4px' }}>{getStatusBadge(detailLimitReq.status)}</div></div>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Approval Flow</div>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="tl-dot success">✓</div>
                    <div className="tl-content">
                      <strong>Requested by {detailLimitReq.full_name || 'Employee'}</strong>
                      <span className="date">{formatDateTime(detailLimitReq.created_at)}</span>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className={`tl-dot ${detailLimitReq.status === 'Pending' ? 'warning' : (detailLimitReq.status === 'Approved' ? 'success' : 'danger')}`}>
                      {detailLimitReq.status === 'Pending' ? '!' : (detailLimitReq.status === 'Approved' ? '✓' : '✕')}
                    </div>
                    <div className="tl-content">
                      <strong>L1 Manager Approval</strong>
                      <span className={`tl-status ${detailLimitReq.status === 'Pending' ? 'warning' : (detailLimitReq.status === 'Approved' ? 'success' : 'danger')}`}>{detailLimitReq.status}</span>
                      {detailLimitReq.status !== 'Pending' && <span className="date">{formatDateTime(detailLimitReq.updated_at)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : detailExpense ? (
            <div>
              {/* Employee info */}
              <div className="panel-section">
                <div className="panel-section-title">Employee Information</div>
                <div className="emp-info-box">
                  <div className="emp-info-grid">
                    <div className="info-item full"><label>Employee Name</label><p style={{ fontSize: '16px' }}>{detailExpense.full_name || '—'}</p></div>
                    <div className="info-item"><label>E-Code</label><p>{detailExpense.e_code || '—'}</p></div>
                    <div className="info-item"><label>Grade</label><p>{detailExpense.grade || '—'}</p></div>
                    <div className="info-item"><label>Designation</label><p>{detailExpense.designation || '—'}</p></div>
                    <div className="info-item"><label>District</label><p>{detailExpense.district_name || detailExpense.home_district || '—'}</p></div>
                    {detailExpense.mobile_number && <div className="info-item"><label>Mobile</label><p>{detailExpense.mobile_number}</p></div>}
                    <div className="info-item"><label>Expense Date</label><p>{formatDate(detailExpense.expense_date)}</p></div>
                    <div className="info-item amount"><label>Total Amount</label><p>₹{parseFloat(String(detailExpense.total_amount || 0)).toFixed(2)}</p></div>
                    <div className="info-item"><label>Status</label><div style={{ marginTop: '4px' }}>{getStatusBadge(detailExpense.status)}</div></div>
                  </div>
                </div>
              </div>

              {/* Approval timeline */}
              {(() => {
                const l1Name = detailExpense.l1_name || detailExpense.level_first_approver || 'L1 Approver';
                const l2Name = detailExpense.l2_name || detailExpense.level_second_approver || 'L2 Approver';
                const hasL2 = !!detailExpense.level_second_approver && detailExpense.level_second_approver !== 'None' && detailExpense.level_second_approver !== '';
                let l1State = 'Pending Action', l2State = 'Waiting for L1';
                let l1Dot = 'warning', l2Dot = 'waiting';
                const st = (detailExpense.status || '').toLowerCase();

                if (st === 'approved') {
                  l1State = 'Approved'; l1Dot = 'success';
                  if (hasL2) { l2State = 'Approved'; l2Dot = 'success'; }
                } else if (st === 'rejected') {
                  if (detailExpense.action_level === 'L2' || (detailExpense.approved_by === detailExpense.level_second_approver)) {
                    l1State = 'Approved'; l1Dot = 'success';
                    l2State = 'Rejected'; l2Dot = 'danger';
                  } else {
                    l1State = 'Rejected'; l1Dot = 'danger';
                  }
                } else {
                  if (st === 'pending l2' || detailExpense.action_level === 'L2') {
                    l1State = 'Approved'; l1Dot = 'success';
                    l2State = 'Pending Action'; l2Dot = 'warning';
                  } else {
                    l1State = 'Pending Action'; l1Dot = 'warning';
                    if (hasL2) { l2State = 'Waiting for L1'; l2Dot = 'waiting'; }
                  }
                }

                return (
                  <div className="panel-section">
                    <div className="panel-section-title">Approval Flow</div>
                    <div className="timeline">
                      <div className="timeline-item">
                        <div className="tl-dot success">✓</div>
                        <div className="tl-content">
                          <strong>Submitted by {detailExpense.full_name || 'Employee'}</strong>
                          <span className="date">{formatDateTime(detailExpense.submitted_at || detailExpense.created_at || detailExpense.expense_date)}</span>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className={`tl-dot ${l1Dot}`}>{l1Dot === 'success' ? '✓' : (l1Dot === 'danger' ? '✕' : '!')}</div>
                        <div className="tl-content">
                          <strong>L1: {l1Name}</strong>
                          <span className={`tl-status ${l1Dot}`}>{l1State}</span>
                          {detailExpense.l1_action_date && <span className="date">{formatDateTime(detailExpense.l1_action_date)}</span>}
                          {detailExpense.status === 'Rejected' && l1Dot === 'danger' && <div className="tl-reason">Reason: {detailExpense.reject_reason || 'No reason provided.'}</div>}
                        </div>
                      </div>
                      {hasL2 && (
                        <div className="timeline-item">
                          <div className={`tl-dot ${l2Dot}`}>{l2Dot === 'success' ? '✓' : (l2Dot === 'danger' ? '✕' : (l2Dot === 'warning' ? '!' : '•'))}</div>
                          <div className="tl-content">
                            <strong>L2: {l2Name}</strong>
                            <span className={`tl-status ${l2Dot}`}>{l2State}</span>
                            {detailExpense.l2_action_date && <span className="date">{formatDateTime(detailExpense.l2_action_date)}</span>}
                            {detailExpense.status === 'Rejected' && l2Dot === 'danger' && <div className="tl-reason">Reason: {detailExpense.reject_reason || 'No reason provided.'}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Expense Breakdown */}
              <div className="panel-section">
                <div className="panel-section-title">Expense Breakdown</div>
                <div className="summary-grid">
                  <div className="summary-tile"><label>DA</label><span>₹{parseFloat(String(detailExpense.da_amount || detailExpense.da || 0)).toFixed(2)}</span></div>
                  <div className="summary-tile"><label>Hotel</label><span>₹{parseFloat(String(detailExpense.hotel_amount || detailExpense.hotel || 0)).toFixed(2)}</span></div>
                  <div className="summary-tile"><label>Other</label><span>₹{parseFloat(String(detailExpense.other_expense_amount || detailExpense.oth_amount || 0)).toFixed(2)}</span></div>
                  <div className="summary-tile"><label>Total</label><span style={{ color: 'var(--success)' }}>₹{parseFloat(String(detailExpense.total_amount || 0)).toFixed(2)}</span></div>
                </div>
              </div>

              {/* Journey Details */}
              <div className="panel-section">
                <div className="panel-section-title">Journey Details ({detailItineraries.length} Leg{detailItineraries.length !== 1 ? 's' : ''})</div>
                {detailItineraries.length === 0 ? (
                  <p style={{ color: 'var(--text-3)', fontSize: '14px', fontWeight: 500 }}>No itinerary data found.</p>
                ) : (
                  detailItineraries.map((leg, idx) => {
                    const legTotal = (
                      parseFloat(String(leg.travel_amount || 0)) +
                      parseFloat(String(leg.sub_amount || 0)) +
                      parseFloat(String(leg.da_amount || 0)) +
                      parseFloat(String(leg.hotel_amount || 0)) +
                      parseFloat(String(leg.other_amount || 0))
                    ).toFixed(2);

                    return (
                      <div className="leg-card" key={idx}>
                        <div className="leg-card-header">
                          <div className="leg-num">{idx + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div className="leg-title">{leg.from_location || '—'} → {leg.to_location || '—'}</div>
                            <div className="leg-sub">{leg.travel_mode || '—'} · {leg.travel_type || ''} · {leg.to_district || ''}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)' }}>₹{legTotal}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Leg Total</div>
                          </div>
                        </div>
                        <div className="leg-detail-grid">
                          <div className="detail-item"><label>Travel Mode</label><p>{leg.travel_mode || '—'}</p></div>
                          <div className="detail-item"><label>Distance</label><p>{leg.distance_km || 0} km</p></div>
                          <div className="detail-item"><label>Travel Amount</label><p>₹{parseFloat(String(leg.travel_amount || 0)).toFixed(2)}</p></div>
                          <div className="detail-item"><label>Sub Amount</label><p>₹{parseFloat(String(leg.sub_amount || 0)).toFixed(2)}</p></div>
                        </div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '12px 0 8px', borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>Work Summary</div>
                        <div className="leg-detail-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                          <div className="detail-item"><label>Assigned</label><p>{leg.ws_assigned || 0}</p></div>
                          <div className="detail-item"><label>Closed</label><p>{leg.ws_closed || 0}</p></div>
                          <div className="detail-item"><label>PMS</label><p>{leg.ws_pms || 0}</p></div>
                          <div className="detail-item"><label>Asset</label><p>{leg.ws_asset || 0}</p></div>
                        </div>
                        {leg.visit_purpose && (
                          <div className="leg-detail-grid" style={{ marginTop: '8px' }}>
                            <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                              <label>Visit Purpose</label>
                              <p>{leg.visit_purpose}</p>
                            </div>
                          </div>
                        )}
                        {leg.attachments && leg.attachments.length > 0 ? (
                          <div className="bill-section" style={{ marginTop: '12px' }}>
                            <div className="bill-section-label">Attached Bills ({leg.attachments.length})</div>
                            <div className="bill-thumbs">
                              {leg.attachments.map((att, attIdx) => {
                                let checkUrl = att.url || '';
                                if (checkUrl.includes('?url=')) {
                                  try {
                                    const urlParams = new URLSearchParams(checkUrl.split('?')[1]);
                                    checkUrl = urlParams.get('url') || checkUrl;
                                  } catch (e) {}
                                }
                                const isImg = /\.(jpg|jpeg|png|gif|webp|bmp)(?:[?#].*)?$/i.test(checkUrl);
                                const label = (att.bill_type || 'Bill').replace(/_/g, ' ');

                                return isImg ? (
                                  <div className="bill-item" key={attIdx}>
                                    <img
                                      src={att.url}
                                      className="bill-thumb"
                                      loading="lazy"
                                      onClick={() => window.open(att.url, '_blank')}
                                      title={label}
                                      alt={label}
                                    />
                                    <span className="bill-type-label">{label}</span>
                                  </div>
                                ) : (
                                  <div className="bill-item" key={attIdx}>
                                    <a className="bill-link" href={att.url} target="_blank" rel="noopener noreferrer">
                                      {label}
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-3)', marginTop: '12px' }}>No attachments for this leg.</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--danger)', padding: '24px', fontWeight: 600 }}>Details not available.</p>
          )}
        </div>
      </div>

      <Loader show={isLoading} message={loaderMsg} />
    </div>
  );
}
