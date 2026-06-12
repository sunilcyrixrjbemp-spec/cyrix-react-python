import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Import all sub-pages for state-based routing
import Home from '../pages/Home';
import Admin from '../pages/Admin';
import Approval from '../pages/Approval';
import Expense from '../pages/Expense';
import Month from '../pages/Month';
import Dashboard from '../pages/Dashboard';
import Upload from '../pages/Upload';
import Profile from '../pages/Profile';
import HelpCenter from '../pages/HelpCenter';

const ICONS = {
  dashboard: 'fas fa-tachometer-alt',
  admin: 'fas fa-user-shield',
  approval: 'fas fa-check-circle',
  expense: 'fas fa-receipt',
  report: 'fas fa-chart-line',
  upload: 'fas fa-cloud-upload-alt',
  month: 'fas fa-calendar-alt',
  profile: 'fas fa-user',
  logout: 'fas fa-sign-out-alt'
};

const ALL_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, colorCls: 'text-primary', roles: ['Admin', 'Superadmin', 'Manager', 'Engineer', 'Coordinator', 'Accounts', 'Divisional Manager', 'District Incharge'] },
  { id: 'admin', label: 'Admin Panel', icon: ICONS.admin, colorCls: 'text-danger', roles: ['Admin', 'Superadmin'] },
  { id: 'approval', label: 'Approval Center', icon: ICONS.approval, colorCls: 'text-success', roles: ['Admin', 'Superadmin', 'Manager', 'Coordinator', 'Divisional Manager'] },
  { id: 'expense', label: 'Submit Claim', icon: ICONS.expense, colorCls: 'text-info', roles: ['Admin', 'Superadmin', 'Engineer'] },
  { id: 'report', label: 'Analytics', icon: ICONS.report, colorCls: 'text-primary', roles: ['Admin', 'Superadmin', 'Engineer', 'Manager', 'Coordinator', 'Divisional Manager', 'District Incharge'] },
  { id: 'upload', label: 'Data Sync', icon: ICONS.upload, colorCls: 'text-warning', roles: ['Admin', 'Superadmin'] },
  { id: 'month', label: 'Month Summary', icon: ICONS.month, colorCls: 'text-info', roles: ['Admin', 'Superadmin', 'Manager', 'Coordinator', 'Accounts', 'Divisional Manager'] },
  { id: 'help', label: 'Help Center', icon: 'fas fa-question-circle', colorCls: 'text-warning', roles: ['Admin', 'Superadmin', 'Manager', 'Engineer', 'Coordinator', 'Accounts', 'Divisional Manager', 'District Incharge'] }
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState<string>(() => {
    return sessionStorage.getItem('activeTab') || 'dashboard';
  });
  
  const [displayName, setDisplayName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [activeTab, isMobile]);

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    const name = localStorage.getItem('display_name');
    const uId = localStorage.getItem('logged_in_user_id') || localStorage.getItem('user_id');
    const menus = localStorage.getItem('allowed_menus') || 'dashboard,expense,profile';

    if (!role || !uId) {
      navigate('/');
      return;
    }

    setUserRole(role);
    setDisplayName(name || 'User');
    setUserId(uId.replace(/['"]/g, '').trim());
    setAllowedMenus(menus.split(',').map(m => m.trim().toLowerCase()));
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    const syncPermissions = async () => {
      try {
        const res = await fetch(`/api/profile?user_id=${userId}`);
        const data = await res.json();
        if (data.success && data.profile) {
          const freshMenus = data.profile.allowed_menus || 'dashboard,expense,profile';
          localStorage.setItem('allowed_menus', freshMenus);
          setAllowedMenus(freshMenus.split(',').map((m: string) => m.trim().toLowerCase()));
          
          if (data.profile.full_name) {
            localStorage.setItem('display_name', data.profile.full_name);
            setDisplayName(data.profile.full_name);
          }
          if (data.profile.role) {
            localStorage.setItem('user_role', data.profile.role);
            setUserRole(data.profile.role);
          }
        }
      } catch (err) {
        console.error('Error syncing dynamic page permissions:', err);
      }
    };
    syncPermissions();
  }, [userId]);

  const loadNotifications = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/notifications?user_id=${userId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [userId]);

  const clearNotifications = async () => {
    try {
      const res = await fetch('/api/notifications/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    navigate('/');
  };

  const changeTab = (tabId: string) => {
    setActiveTab(tabId);
    sessionStorage.setItem('activeTab', tabId);
  };

  const activeItems = ALL_MENU_ITEMS.filter(item => {
    if (!item.roles.includes(userRole)) return false;
    if (userRole === 'Admin' || userRole === 'Superadmin') return true;
    if (item.id === 'dashboard' || item.id === 'expense' || item.id === 'help') return true;
    return allowedMenus.includes(item.id.toLowerCase());
  });

  const currentItem = ALL_MENU_ITEMS.find(item => item.id === activeTab);
  const pageTitle = currentItem ? currentItem.label : (activeTab === 'profile' ? 'My Profile' : 'Cyrix');

  // Render active page component directly for URL obscurity
  const renderPageContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Home setActiveTab={changeTab} />;
      case 'admin':
        return <Admin />;
      case 'approval':
        return <Approval />;
      case 'expense':
        return <Expense />;
      case 'month':
        return <Month />;
      case 'report':
        return <Dashboard />;
      case 'upload':
        return <Upload />;
      case 'profile':
        return <Profile />;
      case 'allowed_menus': // fallback
      case 'help':
        return <HelpCenter />;
      default:
        return <Home setActiveTab={changeTab} />;
    }
  };

  return (
    <div className={`wrapper ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapse'}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* NAVBAR */}
      <nav className="main-header navbar navbar-expand navbar-white navbar-light border-bottom" style={{ 
        marginLeft: (isMobile || !sidebarOpen) ? '0px' : '250px', 
        transition: 'margin-left .3s ease-in-out', 
        zIndex: 1030 
      }}>
        {/* Left navbar links */}
        <ul className="navbar-nav">
          {!isMobile && (
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                <i className="fas fa-bars"></i>
              </button>
            </li>
          )}
          <li className="nav-item">
            <span className="nav-link font-weight-bold text-dark">{pageTitle}</span>
          </li>
        </ul>

        {/* Right navbar links */}
        <ul className="navbar-nav ml-auto align-items-center">
          <li className="nav-item mr-3">
            <button className="nav-link btn btn-link p-0 position-relative" onClick={() => setShowNotificationsModal(true)} style={{ border: 'none', background: 'none', outline: 'none' }}>
              <i className="fas fa-bell text-secondary" style={{ fontSize: '18px' }}></i>
              {notifications.length > 0 && (
                <span className="position-absolute badge rounded-pill bg-danger" style={{ top: '-8px', right: '-8px', fontSize: '9px', padding: '3px 6px' }}>
                  {notifications.length}
                </span>
              )}
            </button>
          </li>
          <li className="nav-item mr-2 mr-md-3">
            <span className="font-weight-bold text-secondary" style={{ fontSize: '13px' }}>
              <i className="fas fa-user-circle mr-1"></i>
              <span className="d-none d-sm-inline">{displayName} </span>
              <span className="badge badge-secondary">{userRole}</span>
            </span>
          </li>
          <li className="nav-item">
            <button className="btn btn-outline-danger btn-sm" onClick={handleLogout} style={{ padding: isMobile ? '4px 8px' : '4px 12px' }}>
              <i className="fas fa-sign-out-alt"></i>
              <span className="d-none d-md-inline ml-1">Logout</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* MAIN SIDEBAR CONTAINER */}
      <aside className="main-sidebar sidebar-dark-primary elevation-4" style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        width: '250px',
        zIndex: 1040,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-250px)',
        transition: 'transform .3s ease-in-out'
      }}>
        {/* Brand Logo Wrapper (centered, clean white pill, non-clipped) */}
        <div className="brand-link d-flex justify-content-center align-items-center" style={{ borderBottom: '1px solid #4f5962', padding: '15px 10px' }}>
          <img src="/logo.png" alt="Cyrix Logo" style={{ maxHeight: '38px', width: 'auto', backgroundColor: '#ffffff', padding: '4px 12px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>

        {/* Sidebar */}
        <div className="sidebar" style={{ height: 'calc(100vh - 65px)', overflowY: 'auto' }}>
          {/* User panel */}
          <div className="user-panel mt-3 pb-3 mb-3 d-flex align-items-center" style={{ borderBottom: '1px solid #4f5962' }}>
            <div className="image text-white" style={{ fontSize: '24px', paddingLeft: '15px' }}>
              <i className="fas fa-user-cog"></i>
            </div>
            <div className="info pl-3">
              <span className="d-block text-white font-weight-bold" style={{ fontSize: '14px' }}>{displayName}</span>
              <span className="text-muted" style={{ fontSize: '11px' }}>{userRole}</span>
            </div>
          </div>

          {/* Sidebar Menu */}
          <nav className="mt-2">
            <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="false">
              {activeItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <li className="nav-item" key={item.id} style={{ width: '100%' }}>
                    <button 
                      onClick={() => changeTab(item.id)} 
                      className={`nav-link btn btn-link text-left ${isActive ? 'active' : ''}`} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        margin: '2px 0', 
                        border: 'none', 
                        background: 'none', 
                        width: '100%', 
                        color: isActive ? '#fff' : '#c2c7d0',
                        boxShadow: 'none',
                        textAlign: 'left'
                      }}
                    >
                      <i className={`nav-icon ${item.icon}`} style={{ width: '24px', textAlign: 'center' }}></i>
                      <p style={{ margin: '0 0 0 10px' }}>{item.label}</p>
                    </button>
                  </li>
                );
              })}
              <li className="nav-item mt-4" style={{ width: '100%' }}>
                <button 
                  onClick={() => changeTab('profile')} 
                  className={`nav-link btn btn-link text-left ${activeTab === 'profile' ? 'active' : ''}`} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    border: 'none', 
                    background: 'none', 
                    width: '100%', 
                    color: activeTab === 'profile' ? '#fff' : '#c2c7d0',
                    boxShadow: 'none',
                    textAlign: 'left'
                  }}
                >
                  <i className="nav-icon fas fa-user-circle" style={{ width: '24px', textAlign: 'center' }}></i>
                  <p style={{ margin: '0 0 0 10px' }}>My Profile</p>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* CONTENT WRAPPER */}
      <div className="content-wrapper" style={{
        marginLeft: (isMobile || !sidebarOpen) ? '0px' : '250px',
        transition: 'margin-left .3s ease-in-out',
        padding: isMobile ? '10px' : '20px',
        flex: 1,
        backgroundColor: '#f4f6f9',
        paddingBottom: '80px' // spacing for mobile bottom-nav
      }}>
        <div className="container-fluid">
          {renderPageContent()}
        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="mobile-bottom-nav d-md-none border-top bg-white" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '65px',
        zIndex: 1030,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
      }}>
        {activeItems.slice(0, 4).map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => changeTab(item.id)} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : '#6c757d',
              fontSize: '11px',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              padding: 0
            }}>
              <i className={item.icon} style={{ fontSize: '18px', marginBottom: '4px' }}></i>
              <span>{item.id === 'dashboard' ? 'Home' : item.label.split(' ')[0]}</span>
            </button>
          );
        })}
        <button onClick={() => changeTab('profile')} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textDecoration: 'none',
          color: activeTab === 'profile' ? 'var(--primary)' : '#6c757d',
          fontSize: '11px',
          fontWeight: 600,
          border: 'none',
          background: 'none',
          padding: 0
        }}>
          <i className="fas fa-user-circle" style={{ fontSize: '18px', marginBottom: '4px' }}></i>
          <span>Profile</span>
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay active d-md-none" onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 1025
        }}></div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1060 }} tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title font-weight-bold">
                    <i className="fas fa-exclamation-triangle mr-2"></i> Log Out
                  </h5>
                  <button type="button" className="close text-white" onClick={() => setShowLogoutModal(false)} aria-label="Close" style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <div className="modal-body text-center p-4">
                  <i className="fas fa-sign-out-alt text-danger mb-3" style={{ fontSize: '48px' }}></i>
                  <h5 className="font-weight-bold">Are you sure you want to log out?</h5>
                  <p className="text-muted">You will need to enter your credentials again to login.</p>
                </div>
                <div className="modal-footer justify-content-center">
                  <button className="btn btn-secondary px-4 mr-2" onClick={() => setShowLogoutModal(false)}>Cancel</button>
                  <button className="btn btn-danger px-4" onClick={confirmLogout}>Logout</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1060 }} tabIndex={-1} role="dialog" onClick={() => setShowNotificationsModal(false)}>
            <div className="modal-dialog modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow" style={{ borderRadius: '12px' }}>
                <div className="modal-header bg-dark text-white border-bottom-0">
                  <h5 className="modal-title font-weight-bold text-white">
                    <i className="fas fa-bell mr-2 text-warning"></i> Notifications
                  </h5>
                  <button type="button" className="close text-white" onClick={() => setShowNotificationsModal(false)} style={{ border: 'none', background: 'none', outline: 'none' }}>
                    <span aria-hidden="true" style={{ fontSize: '24px' }}>&times;</span>
                  </button>
                </div>
                <div className="modal-body p-3" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div className="text-center p-4 text-muted">
                      <i className="fas fa-bell-slash fa-2x mb-2"></i>
                      <p className="font-weight-bold mb-0">No new notifications.</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {notifications.map((n, idx) => (
                        <div key={idx} className="list-group-item px-0 py-3 border-bottom border-light">
                          <p className="mb-1 text-dark" style={{ fontSize: '13px', lineHeight: '1.4' }}>{n.message}</p>
                          <small className="text-muted" style={{ fontSize: '10px' }}>
                            {new Date(n.created_at).toLocaleString('en-IN')}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="modal-footer justify-content-between bg-light border-top-0 p-3">
                  {notifications.length > 0 ? (
                    <button className="btn btn-outline-danger btn-sm font-weight-bold" onClick={clearNotifications}>
                      <i className="fas fa-trash-alt mr-1"></i> Clear All
                    </button>
                  ) : <div />}
                  <button className="btn btn-secondary btn-sm px-4" onClick={() => setShowNotificationsModal(false)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
