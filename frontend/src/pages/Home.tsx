import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  dashboard: 'fas fa-tachometer-alt',
  admin: 'fas fa-user-shield',
  approval: 'fas fa-check-circle',
  expense: 'fas fa-receipt',
  report: 'fas fa-chart-line',
  upload: 'fas fa-cloud-upload-alt',
  month: 'fas fa-calendar-alt',
  profile: 'fas fa-user-circle'
};

const ALL_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, colorCls: 'text-primary', path: '/home', roles: ['Admin', 'Superadmin', 'Manager', 'Engineer', 'Coordinator', 'Accounts', 'Divisional Manager', 'District Incharge'] },
  { id: 'admin', label: 'Admin Panel', icon: ICONS.admin, colorCls: 'text-danger', path: '/admin', roles: ['Admin', 'Superadmin'] },
  { id: 'approval', label: 'Approval Center', icon: ICONS.approval, colorCls: 'text-success', path: '/approval', roles: ['Admin', 'Superadmin', 'Manager', 'Coordinator', 'Divisional Manager'] },
  { id: 'expense', label: 'Submit Claim', icon: ICONS.expense, colorCls: 'text-info', path: '/expense', roles: ['Admin', 'Superadmin', 'Engineer'] },
  { id: 'report', label: 'Analytics', icon: ICONS.report, colorCls: 'text-primary', path: '/dashboard', roles: ['Admin', 'Superadmin', 'Engineer', 'Manager', 'Coordinator', 'Divisional Manager', 'District Incharge'] },
  { id: 'upload', label: 'Data Sync', icon: ICONS.upload, colorCls: 'text-warning', path: '/upload', roles: ['Admin', 'Superadmin'] },
  { id: 'month', label: 'Month Summary', icon: ICONS.month, colorCls: 'text-info', path: '/month', roles: ['Admin', 'Superadmin', 'Manager', 'Coordinator', 'Accounts', 'Divisional Manager'] },
  { id: 'profile', label: 'My Profile', icon: ICONS.profile, colorCls: 'text-secondary', path: '/profile', roles: ['Admin', 'Superadmin', 'Manager', 'Engineer', 'Coordinator', 'Accounts', 'Divisional Manager', 'District Incharge'] }
];

interface HomeProps {
  setActiveTab?: (tabId: string) => void;
}

export default function Home({ setActiveTab }: HomeProps) {
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

  const [myStats, setMyStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 });
  const [teamStats, setTeamStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 });

  const [listModalFilter, setListModalFilter] = useState<'All' | 'Approved' | 'Pending' | 'Rejected' | null>(null);
  const [listModalData, setListModalData] = useState<ExpenseItem[]>([]);
  const [listModalTitle, setListModalTitle] = useState('');
  
  const [teamModalFilter, setTeamModalFilter] = useState<'All' | 'Approved' | 'Pending' | 'Rejected' | null>(null);
  const [teamGroupedData, setTeamGroupedData] = useState<{ [key: string]: TeamMemberSummary }>({});

  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [detailExpId, setDetailExpId] = useState('');
  const [detailType, setDetailType] = useState<'Expense' | 'Limit'>('Expense');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailExpense, setDetailExpense] = useState<ExpenseDetail | null>(null);
  const [detailItineraries, setDetailItineraries] = useState<LegDetail[]>([]);
  const [detailLimitReq, setDetailLimitReq] = useState<any | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard');

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

    let ownExpensesList: ExpenseItem[] = [];
    try {
      const ownRes = await fetch(`/api/home/list?user_id=${userId}&month=${selectedMonth}`);
      if (!ownRes.ok && !['Admin', 'Superadmin'].includes(userRole)) {
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

    calculateStats(ownExpensesList, teamExpensesList);
    setIsLoading(false);
  };

  const calculateStats = (ownList: ExpenseItem[], tList: ExpenseItem[]) => {
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

  const openListModal = (filterType: 'All' | 'Approved' | 'Pending' | 'Rejected', dataset = myExpenses, customTitle: string | null = null) => {
    setTeamModalFilter(null);
    
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
  
  const menuItems = ALL_MENU_ITEMS.filter(m => {
    if (!m.roles.includes(userRole)) return false;
    if (m.id === 'dashboard') return true;
    if (userRole === 'Admin' || userRole === 'Superadmin') return true;
    return allowedMenus.includes(m.id.toLowerCase());
  });

  const handleMenuClick = (menuId: string) => {
    setActiveMenuItem(menuId);
    setSidebarOpen(false);
    if (setActiveTab) {
      setActiveTab(menuId);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      
      {/* SIDEBAR - DESKTOP ONLY */}
      <div className="d-none d-lg-block" style={{
        width: '280px',
        backgroundColor: '#3a3f47',
        color: '#fff',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto',
        left: 0,
        top: 0,
        zIndex: 1000,
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
      }}>
        {/* Logo Section */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #4a4f57',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>
            <i className="fas fa-hospital mr-2" style={{ color: '#00acee' }}></i> Cyrix
          </div>
          <p style={{ fontSize: '12px', color: '#a0a7b0', margin: 0 }}>HEALTHCARE</p>
        </div>

        {/* Role Header */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #4a4f57'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <i className="fas fa-user-cog" style={{
              fontSize: '24px',
              marginRight: '12px',
              color: '#fff'
            }}></i>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff'
              }}>
                {userRole}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#a0a7b0'
              }}>
                System Administration
              </div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav style={{ padding: '15px 0' }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              style={{
                width: '100%',
                padding: '15px 20px',
                border: 'none',
                background: activeMenuItem === item.id ? '#0078d4' : 'transparent',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                fontSize: '14px',
                fontWeight: activeMenuItem === item.id ? '600' : '500',
                borderLeft: activeMenuItem === item.id ? '4px solid #00acee' : '4px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (activeMenuItem !== item.id) {
                  e.currentTarget.style.backgroundColor = '#454b53';
                }
              }}
              onMouseLeave={(e) => {
                if (activeMenuItem !== item.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <i className={`${item.icon} mr-3`} style={{ width: '20px', textAlign: 'center' }}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '15px 20px',
          borderTop: '1px solid #4a4f57',
          marginTop: 'auto',
          fontSize: '11px',
          color: '#a0a7b0',
          position: 'absolute',
          bottom: 0,
          width: '100%'
        }}>
          <p style={{ margin: '5px 0' }}>Welcome back!</p>
          <p style={{ margin: '0', fontWeight: '600', color: '#fff' }}>{displayName}</p>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{
        flex: 1,
        width: '100%',
        marginLeft: window.innerWidth > 991 ? '280px' : '0'
      }} className="d-lg-block">

        {/* MOBILE HEADER */}
        <div className="d-lg-none d-flex align-items-center justify-content-between p-3" style={{
          backgroundColor: '#3a3f47',
          color: '#fff',
          borderBottom: '1px solid #4a4f57'
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            <i className="fas fa-bars"></i>
          </button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Cyrix Healthcare</div>
            <div style={{ fontSize: '11px', color: '#a0a7b0' }}>{userRole}</div>
          </div>
          <div style={{ width: '30px' }}></div>
        </div>

        {/* MOBILE SIDEBAR OVERLAY */}
        {sidebarOpen && (
          <>
            <div
              className="d-lg-none"
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 999
              }}
            ></div>
            <div className="d-lg-none" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '75%',
              height: '100vh',
              backgroundColor: '#3a3f47',
              color: '#fff',
              overflowY: 'auto',
              zIndex: 1001,
              boxShadow: '2px 0 10px rgba(0,0,0,0.3)'
            }}>
              {/* Logo Section */}
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #4a4f57',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>
                  <i className="fas fa-hospital mr-2" style={{ color: '#00acee' }}></i> Cyrix
                </div>
                <p style={{ fontSize: '11px', color: '#a0a7b0', margin: 0 }}>HEALTHCARE</p>
              </div>

              {/* Role Header */}
              <div style={{
                padding: '15px 20px',
                borderBottom: '1px solid #4a4f57'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <i className="fas fa-user-cog" style={{
                    fontSize: '20px',
                    marginRight: '12px',
                    color: '#fff'
                  }}></i>
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#fff'
                    }}>
                      {userRole}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#a0a7b0'
                    }}>
                      System Administration
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <nav style={{ padding: '15px 0' }}>
                {menuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleMenuClick(item.id)}
                    style={{
                      width: '100%',
                      padding: '15px 20px',
                      border: 'none',
                      background: activeMenuItem === item.id ? '#0078d4' : 'transparent',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.3s ease',
                      fontSize: '13px',
                      fontWeight: activeMenuItem === item.id ? '600' : '500',
                      borderLeft: activeMenuItem === item.id ? '4px solid #00acee' : '4px solid transparent'
                    }}
                  >
                    <i className={`${item.icon} mr-3`} style={{ width: '18px', textAlign: 'center' }}></i>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </>
        )}

        {/* DESKTOP VIEWPORT DESIGN */}
        <div className="d-none d-lg-block" style={{ padding: '30px' }}>
          <div className="content-header p-0 mb-4">
            <div className="row align-items-center">
              <div className="col-sm-8">
                <h1 className="m-0 font-weight-bold text-dark" style={{ fontFamily: "'Source Sans Pro', sans-serif", fontSize: '28px' }}>
                  Welcome back, {displayName}!
                </h1>
                <p className="text-muted mb-0 mt-2" style={{ fontSize: '14px' }}>
                  Role: <span className="badge badge-secondary">{userRole}</span>
                </p>
              </div>
              <div className="col-sm-4 text-sm-right mt-2 mt-sm-0">
                <div className="d-inline-flex align-items-center bg-white p-2 rounded shadow-sm border">
                  <label className="text-muted font-weight-bold text-uppercase mb-0 mr-2" style={{ fontSize: '11px' }}>Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => syncMonthFilter(e.target.value)}
                    style={{ border: 'none', fontWeight: 'bold', outline: 'none', color: 'var(--primary)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* My Expenses Title */}
          <h5 className="font-weight-bold mb-3 text-secondary">
            <i className="fas fa-wallet mr-2"></i> My Personal Expenses Summary
          </h5>
          
          {/* User Small Boxes */}
          <div className="row">
            <div className="col-lg-3 col-6">
              <div className="small-box bg-info shadow-sm" style={{ cursor: 'pointer' }} onClick={() => openListModal('All')}>
                <div className="inner">
                  <h3>₹{myStats.total.toLocaleString('en-IN')}</h3>
                  <p>Total Claimed</p>
                </div>
                <div className="icon">
                  <i className="fas fa-wallet"></i>
                </div>
                <span className="small-box-footer">View List <i className="fas fa-arrow-circle-right"></i></span>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box bg-success shadow-sm" style={{ cursor: 'pointer' }} onClick={() => openListModal('Approved')}>
                <div className="inner">
                  <h3>₹{myStats.approved.toLocaleString('en-IN')}</h3>
                  <p>Approved Claims</p>
                </div>
                <div className="icon">
                  <i className="fas fa-check-circle"></i>
                </div>
                <span className="small-box-footer">View List <i className="fas fa-arrow-circle-right"></i></span>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box bg-warning text-white shadow-sm" style={{ cursor: 'pointer' }} onClick={() => openListModal('Pending')}>
                <div className="inner">
                  <h3 className="text-white">₹{myStats.pending.toLocaleString('en-IN')}</h3>
                  <p className="text-white">Pending Approval</p>
                </div>
                <div className="icon text-white" style={{ opacity: 0.3 }}>
                  <i className="fas fa-clock text-white"></i>
                </div>
                <span className="small-box-footer text-white">View List <i className="fas fa-arrow-circle-right text-white"></i></span>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box bg-danger shadow-sm" style={{ cursor: 'pointer' }} onClick={() => openListModal('Rejected')}>
                <div className="inner">
                  <h3>₹{myStats.rejected.toLocaleString('en-IN')}</h3>
                  <p>Rejected Claims</p>
                </div>
                <div className="icon">
                  <i className="fas fa-times-circle"></i>
                </div>
                <span className="small-box-footer">View List <i className="fas fa-arrow-circle-right"></i></span>
              </div>
            </div>
          </div>

          {/* Team Expenses Section */}
          {showTeamSection && (
            <div className="mt-4">
              <h5 className="font-weight-bold mb-3 text-secondary">
                <i className="fas fa-users mr-2"></i> Team Expenses Directory
              </h5>
              <div className="row">
                <div className="col-lg-3 col-6">
                  <div className="small-box bg-indigo text-white shadow-sm" style={{ cursor: 'pointer', backgroundColor: '#6610f2' }} onClick={() => openTeamEngineersModal('All')}>
                    <div className="inner">
                      <h3 className="text-white">₹{teamStats.total.toLocaleString('en-IN')}</h3>
                      <p className="text-white">Team Total Claimed</p>
                    </div>
                    <div className="icon text-white" style={{ opacity: 0.3 }}>
                      <i className="fas fa-users"></i>
                    </div>
                    <span className="small-box-footer text-white">View Team <i className="fas fa-arrow-circle-right text-white"></i></span>
                  </div>
                </div>
                <div className="col-lg-3 col-6">
                  <div className="small-box bg-success shadow-sm" style={{ cursor: 'pointer' }} onClick={() => openTeamEngineersModal('Approved')}>
                    <div className="inner">
                      <h3>₹{teamStats.approved.toLocaleString('en-IN')}</h3>
                      <p>Team Approved</p>
                    </div>
                    <div className="icon">
                      <i className="fas fa-check-double"></i>
                    </div>
                    <span className="small-box-footer">View Team <i className="fas fa-arrow-circle-right"></i></span>
                  </div>
                </div>
                <div className="col-lg-3 col-6">
                  <div className="small-box bg-warning text-white shadow-sm" style={{ cursor: 'pointer' }} onClick={() => openTeamEngineersModal('Pending')}>
                    <div className="inner">
                      <h3 className="text-white">₹{teamStats.pending.toLocaleString('en-IN')}</h3>
                      <p className="text-white">Team Pending</p>
                    </div>
                    <div className="icon text-white" style={{ opacity: 0.3 }}>
                      <i className="fas fa-hourglass-half text-white"></i>
                    </div>
                    <span className="small-box-footer text-white">View Team <i className="fas fa-arrow-circle-right text-white"></i></span>
                  </div>
                </div>
                <div className="col-lg-3 col-6">
                  <div className="small-box bg-danger shadow-sm" style={{ cursor: 'pointer' }} onClick={() => openTeamEngineersModal('Rejected')}>
                    <div className="inner">
                      <h3>₹{teamStats.rejected.toLocaleString('en-IN')}</h3>
                      <p>Team Rejected</p>
                    </div>
                    <div className="icon">
                      <i className="fas fa-ban"></i>
                    </div>
                    <span className="small-box-footer">View Team <i className="fas fa-arrow-circle-right"></i></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE VIEWPORT DESIGN */}
        <div className="d-lg-none" style={{ padding: '15px' }}>
          
          {/* Mobile Header Card */}
          <div className="card card-primary card-outline shadow-sm mb-4" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <div className="d-flex align-items-center mb-3">
                <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center mr-3" style={{ width: '45px', height: '45px', fontSize: '20px' }}>
                  <i className="fas fa-user"></i>
                </div>
                <div>
                  <h5 className="font-weight-bold mb-0 text-dark">{displayName}</h5>
                  <span className="badge badge-primary">{userRole}</span>
                </div>
              </div>
              
              {/* Mobile Month Dropdown */}
              <div className="d-flex align-items-center justify-content-between bg-light p-2 rounded border">
                <span className="text-muted font-weight-bold" style={{ fontSize: '11px' }}>SELECT FILTER MONTH</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => syncMonthFilter(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontWeight: 'bold', outline: 'none', color: 'var(--primary)', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Mobile stats list (Personal) */}
          <h6 className="font-weight-bold mb-2 text-muted px-2">MY SUMMARY</h6>
          <div className="card shadow-sm mb-4" style={{ borderRadius: '12px' }}>
            <div className="list-group list-group-flush">
              <div className="list-group-item d-flex align-items-center justify-content-between p-3" onClick={() => openListModal('All')}>
                <span className="font-weight-bold"><i className="fas fa-wallet mr-2 text-primary"></i> Total Claimed</span>
                <span className="font-weight-bold text-dark">₹{myStats.total.toLocaleString('en-IN')} <i className="fas fa-chevron-right ml-2 text-muted"></i></span>
              </div>
              <div className="list-group-item d-flex align-items-center justify-content-between p-3" onClick={() => openListModal('Approved')}>
                <span className="font-weight-bold"><i className="fas fa-check-circle mr-2 text-success"></i> Approved</span>
                <span className="font-weight-bold text-success">₹{myStats.approved.toLocaleString('en-IN')} <i className="fas fa-chevron-right ml-2 text-muted"></i></span>
              </div>
              <div className="list-group-item d-flex align-items-center justify-content-between p-3" onClick={() => openListModal('Pending')}>
                <span className="font-weight-bold"><i className="fas fa-clock mr-2 text-warning"></i> Pending</span>
                <span className="font-weight-bold text-warning">₹{myStats.pending.toLocaleString('en-IN')} <i className="fas fa-chevron-right ml-2 text-muted"></i></span>
              </div>
              <div className="list-group-item d-flex align-items-center justify-content-between p-3" onClick={() => openListModal('Rejected')}>
                <span className="font-weight-bold"><i className="fas fa-times-circle mr-2 text-danger"></i> Rejected</span>
                <span className="font-weight-bold text-danger">₹{myStats.rejected.toLocaleString('en-IN')} <i className="fas fa-chevron-right ml-2 text-muted"></i></span>
              </div>
            </div>
          </div>

          {/* Mobile Team Stats List */}
          {showTeamSection && (
            <>
              <h6 className="font-weight-bold mb-2 text-muted px-2">TEAM SUMMARY</h6>
              <div className="card shadow-sm mb-4" style={{ borderRadius: '12px' }}>
                <div className="list-group list-group-flush">
                  <div className="list-group-item d-flex align-items-center justify-content-between p-3" onClick={() => openTeamEngineersModal('All')}>
                    <span className="font-weight-bold"><i className="fas fa-users mr-2 text-info"></i> Team Claimed</span>
                    <span className="font-weight-bold text-dark">₹{teamStats.total.toLocaleString('en-IN')} <i className="fas fa-chevron-right ml-2 text-muted"></i></span>
                  </div>
                  <div className="list-group-item d-flex align-items-center justify-content-between p-3" onClick={() => openTeamEngineersModal('Approved')}>
                    <span className="font-weight-bold"><i className="fas fa-check-double mr-2 text-success"></i> Team Approved</span>
                    <span className="font-weight-bold text-success">₹{teamStats.approved.toLocaleString('en-IN')} <i className="fas fa-chevron-right ml-2 text-muted"></i></span>
                  </div>
                  <div className="list-group-item d-flex align-items-center justify-content-between p-3" onClick={() => openTeamEngineersModal('Pending')}>
                    <span className="font-weight-bold"><i className="fas fa-hourglass-half mr-2 text-warning"></i> Team Pending</span>
                    <span className="font-weight-bold text-warning">₹{teamStats.pending.toLocaleString('en-IN')} <i className="fas fa-chevron-right ml-2 text-muted"></i></span>
                  </div>
                  <div className="list-group-item d-flex align-items-center justify-content-between p-3" onClick={() => openTeamEngineersModal('Rejected')}>
                    <span className="font-weight-bold"><i className="fas fa-ban mr-2 text-danger"></i> Team Rejected</span>
                    <span className="font-weight-bold text-danger">₹{teamStats.rejected.toLocaleString('en-IN')} <i className="fas fa-chevron-right ml-2 text-muted"></i></span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODALS - All modals remain the same */}

      {/* POPUP 1: STANDARD LIST MODAL (Expenses) */}
      {listModalFilter !== null && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex={-1} onClick={closeListModal}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content" style={{ borderRadius: '12px', border: 'none' }}>
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title font-weight-bold">
                    <i className="fas fa-receipt mr-2"></i> {listModalTitle}
                  </h5>
                  <button type="button" className="close text-white" onClick={closeListModal} style={{ background: 'none', border: 'none', outline: 'none' }}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="table-responsive">
                    <table className="table table-striped table-hover table-bordered mb-0">
                      <thead className="bg-light">
                        <tr>
                          <th>Expense ID</th>
                          <th>Employee</th>
                          <th>Date</th>
                          <th>Amount (₹)</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listModalData.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center p-5 text-muted">No records found.</td>
                          </tr>
                        ) : (
                          [...listModalData]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(exp => (
                              <tr key={exp.id} style={{ cursor: 'pointer' }} onClick={() => openPanel(exp.id, 'Expense')}>
                                <td className="font-weight-bold text-monospace" style={{ fontSize: '13px' }}>{exp.id}</td>
                                <td>{exp.full_name}</td>
                                <td>{formatDate(exp.date)}</td>
                                <td className="font-weight-bold">₹{parseFloat(String(exp.amount || 0)).toFixed(2)}</td>
                                <td>{getStatusBadge(exp.status)}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button className="btn btn-secondary px-4 btn-sm" onClick={closeListModal}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* POPUP 2: TEAM MEMBERS EXPENSES MODAL */}
      {teamModalFilter !== null && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex={-1} onClick={closeTeamEngineersModal}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content" style={{ borderRadius: '12px', border: 'none' }}>
                <div className="modal-header bg-indigo text-white" style={{ backgroundColor: '#6610f2' }}>
                  <h5 className="modal-title font-weight-bold text-white">
                    <i className="fas fa-users mr-2 text-white"></i> Team Expenses ({teamModalFilter})
                  </h5>
                  <button type="button" className="close text-white" onClick={closeTeamEngineersModal} style={{ background: 'none', border: 'none', outline: 'none' }}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="table-responsive">
                    <table className="table table-striped table-hover table-bordered mb-0">
                      <thead className="bg-light">
                        <tr>
                          <th>Employee Name</th>
                          <th>E-Code</th>
                          <th>Record Count</th>
                          <th>Total Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(teamGroupedData).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center p-5 text-muted">No team members found for this status.</td>
                          </tr>
                        ) : (
                          Object.values(teamGroupedData)
                            .sort((a, b) => b.totalAmount - a.totalAmount)
                            .map(emp => (
                              <tr key={emp.e_code} style={{ cursor: 'pointer' }} onClick={() => openTeamEmployeeExpenses(emp.e_code)}>
                                <td className="font-weight-bold text-primary">{emp.name}</td>
                                <td><span className="badge badge-secondary">{emp.e_code}</span></td>
                                <td>{emp.count} Records</td>
                                <td className="font-weight-bold text-success">₹{emp.totalAmount.toLocaleString('en-IN')}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button className="btn btn-secondary px-4 btn-sm" onClick={closeTeamEngineersModal}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* DETAILED EXPENSE PANEL OVERLAY MODAL */}
      {detailPanelOpen && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex={-1} onClick={closePanel}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content" style={{ borderRadius: '12px', border: 'none' }}>
                <div className="modal-header bg-dark text-white">
                  <h5 className="modal-title font-weight-bold text-white">
                    <i className="fas fa-search-plus mr-2 text-white"></i> {detailType === 'Limit' ? 'Limit Extension Details' : 'Detailed Claim View'}
                  </h5>
                  <button type="button" className="close text-white" onClick={closePanel} style={{ background: 'none', border: 'none', outline: 'none' }}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                  
                  {detailLoading ? (
                    <div className="text-center p-5">
                      <i className="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
                      <p className="font-weight-bold">Fetching details from server...</p>
                    </div>
                  ) : detailType === 'Limit' && detailLimitReq ? (
                    <div>
                      {/* Limit req content */}
                      <div className="card card-warning card-outline mb-3">
                        <div className="card-header"><h3 className="card-title font-weight-bold">Requested Limits</h3></div>
                        <div className="card-body p-3">
                          <div className="row">
                            <div className="col-6 mb-2"><strong>Name:</strong> {detailLimitReq.full_name}</div>
                            <div className="col-6 mb-2"><strong>E-Code:</strong> {detailLimitReq.e_code}</div>
                            <div className="col-6 mb-2"><strong>Requested value:</strong> {detailLimitReq.requested_value}</div>
                            <div className="col-6 mb-2"><strong>Type:</strong> {detailLimitReq.request_type}</div>
                            <div className="col-6 mb-2"><strong>Status:</strong> {getStatusBadge(detailLimitReq.status)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : detailExpense ? (
                    <div>
                      {/* Employee details card */}
                      <div className="card card-info card-outline mb-4">
                        <div className="card-header"><h5 className="card-title font-weight-bold mb-0"><i className="fas fa-id-card mr-2 text-info"></i> Employee & Submission Info</h5></div>
                        <div className="card-body">
                          <div className="row" style={{ fontSize: '14px' }}>
                            <div className="col-sm-6 mb-2"><strong>Employee Name:</strong> {detailExpense.full_name}</div>
                            <div className="col-sm-6 mb-2"><strong>Employee Code:</strong> {detailExpense.e_code}</div>
                            <div className="col-sm-6 mb-2"><strong>Designation:</strong> {detailExpense.designation} ({detailExpense.grade})</div>
                            <div className="col-sm-6 mb-2"><strong>Working District:</strong> {detailExpense.district_name || detailExpense.home_district || '—'}</div>
                            <div className="col-sm-6 mb-2"><strong>Expense Date:</strong> {formatDate(detailExpense.expense_date)}</div>
                            <div className="col-sm-6 mb-2"><strong>Total Claim Value:</strong> <span className="text-success font-weight-bold">₹{parseFloat(String(detailExpense.total_amount || 0)).toFixed(2)}</span></div>
                            <div className="col-12 mt-2"><strong>Approvers Mapped:</strong> L1: {detailExpense.l1_name || detailExpense.level_first_approver} | L2: {detailExpense.l2_name || detailExpense.level_second_approver || 'None'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Expense Summary Grid card */}
                      <div className="card card-success card-outline mb-4">
                        <div className="card-header"><h5 className="card-title font-weight-bold mb-0"><i className="fas fa-file-invoice-dollar mr-2 text-success"></i> Expense Itemized Breakdown</h5></div>
                        <div className="card-body p-0">
                          <div className="table-responsive">
                            <table className="table table-bordered mb-0">
                              <thead className="bg-light">
                                <tr className="text-center">
                                  <th>DA Amount (₹)</th>
                                  <th>Hotel Amount (₹)</th>
                                  <th>Other Amount (₹)</th>
                                  <th>Total Claimed (₹)</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="text-center font-weight-bold">
                                  <td>₹{parseFloat(String(detailExpense.da_amount || detailExpense.da || 0)).toFixed(2)}</td>
                                  <td>₹{parseFloat(String(detailExpense.hotel_amount || detailExpense.hotel || 0)).toFixed(2)}</td>
                                  <td>₹{parseFloat(String(detailExpense.other_expense_amount || detailExpense.oth_amount || 0)).toFixed(2)}</td>
                                  <td className="text-success" style={{ fontSize: '16px' }}>₹{parseFloat(String(detailExpense.total_amount || 0)).toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Journey Details list */}
                      <h5 className="font-weight-bold mb-3"><i className="fas fa-map-marked-alt mr-2 text-primary"></i> Journey Itinerary Details ({detailItineraries.length} legs)</h5>
                      {detailItineraries.map((leg, idx) => {
                        const legTotal = (
                          parseFloat(String(leg.travel_amount || 0)) +
                          parseFloat(String(leg.sub_amount || 0)) +
                          parseFloat(String(leg.da_amount || 0)) +
                          parseFloat(String(leg.hotel_amount || 0)) +
                          parseFloat(String(leg.other_amount || 0))
                        ).toFixed(2);

                        return (
                          <div className="card mb-3" key={idx} style={{ borderLeft: '4px solid var(--primary)' }}>
                            <div className="card-body p-3">
                              <div className="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
                                <div>
                                  <h6 className="font-weight-bold mb-1 text-primary">Leg {idx + 1}: {leg.from_location} &rarr; {leg.to_location}</h6>
                                  <span className="text-muted" style={{ fontSize: '12px' }}><i className="fas fa-bus mr-1"></i> {leg.travel_mode} · {leg.travel_type}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-success font-weight-bold" style={{ fontSize: '15px' }}>₹{legTotal}</span>
                                </div>
                              </div>
                              <div className="row" style={{ fontSize: '13px' }}>
                                <div className="col-4"><strong>Distance:</strong> {leg.distance_km} km</div>
                                <div className="col-4"><strong>Travel Amt:</strong> ₹{parseFloat(String(leg.travel_amount || 0)).toFixed(2)}</div>
                                <div className="col-4"><strong>DA:</strong> ₹{parseFloat(String(leg.da_amount || 0)).toFixed(2)}</div>
                                <div className="col-4 mt-2"><strong>Hotel:</strong> ₹{parseFloat(String(leg.hotel_amount || 0)).toFixed(2)}</div>
                                <div className="col-8 mt-2"><strong>Purpose:</strong> {leg.visit_purpose || '—'}</div>
                              </div>

                              {/* Attachments */}
                              {leg.attachments && leg.attachments.length > 0 && (
                                <div className="mt-3 border-top pt-2">
                                  <div className="font-weight-bold text-muted mb-2" style={{ fontSize: '11px' }}>ATTACHED BILLS</div>
                                  <div className="d-flex flex-wrap gap-2">
                                    {leg.attachments.map((att, attIdx) => (
                                      <a key={attIdx} href={att.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary btn-xs mr-2 mb-2">
                                        <i className="fas fa-file-image mr-1"></i> View {att.bill_type.replace(/_/g, ' ')}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="modal-footer bg-light">
                  <button className="btn btn-secondary px-4 btn-sm" onClick={closePanel}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <Loader show={isLoading} message={loaderMsg} />
    </div>
  );
}
