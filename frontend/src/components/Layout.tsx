import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';

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
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, colorCls: 'text-primary', path: '/home', roles: ['Admin', 'Superadmin', 'Manager', 'Engineer', 'Coordinator', 'Accounts', 'Divisional Manager', 'District Incharge'] },
  { id: 'admin', label: 'Admin Panel', icon: ICONS.admin, colorCls: 'text-danger', path: '/admin', roles: ['Admin', 'Superadmin'] },
  { id: 'approval', label: 'Approval Center', icon: ICONS.approval, colorCls: 'text-success', path: '/approval', roles: ['Admin', 'Superadmin', 'Manager', 'Coordinator', 'Divisional Manager'] },
  { id: 'expense', label: 'Submit Claim', icon: ICONS.expense, colorCls: 'text-info', path: '/expense', roles: ['Admin', 'Superadmin', 'Engineer'] },
  { id: 'report', label: 'Analytics', icon: ICONS.report, colorCls: 'text-primary', path: '/dashboard', roles: ['Admin', 'Superadmin', 'Engineer', 'Manager', 'Coordinator', 'Divisional Manager', 'District Incharge'] },
  { id: 'upload', label: 'Data Sync', icon: ICONS.upload, colorCls: 'text-warning', path: '/upload', roles: ['Admin', 'Superadmin'] },
  { id: 'month', label: 'Month Summary', icon: ICONS.month, colorCls: 'text-info', path: '/month', roles: ['Admin', 'Superadmin', 'Manager', 'Coordinator', 'Accounts', 'Divisional Manager'] }
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
  }, [location.pathname, isMobile]);

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
    if (!userRole || !userId || allowedMenus.length === 0) return;

    const path = location.pathname;

    // Home (dashboard), Expense, and Profile are always allowed
    if (path === '/home' || path === '/profile' || path === '/expense') {
      return;
    }

    const item = ALL_MENU_ITEMS.find(m => m.path === path);
    if (!item) return;

    const isRoleAllowed = item.roles.includes(userRole);
    const isMenuAllowed = userRole === 'Admin' || userRole === 'Superadmin' || allowedMenus.includes(item.id.toLowerCase());

    if (!isRoleAllowed || !isMenuAllowed) {
      navigate('/home');
    }
  }, [location.pathname, userRole, userId, allowedMenus, navigate]);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.clear();
    document.cookie = "user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    navigate('/');
  };

  const activeItems = ALL_MENU_ITEMS.filter(item => {
    if (!item.roles.includes(userRole)) return false;
    if (userRole === 'Admin' || userRole === 'Superadmin') return true;
    if (item.id === 'dashboard' || item.id === 'expense') return true;
    return allowedMenus.includes(item.id.toLowerCase());
  });

  const currentItem = ALL_MENU_ITEMS.find(item => item.path === location.pathname);
  const mobileTitle = currentItem ? currentItem.label : (location.pathname === '/profile' ? 'My Profile' : 'Cyrix');

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
          <li className="nav-item">
            <button className="nav-link btn btn-link" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ border: 'none', background: 'none', outline: 'none' }}>
              <i className="fas fa-bars"></i>
            </button>
          </li>
          <li className="nav-item d-none d-sm-inline-block">
            <span className="nav-link font-weight-bold text-dark">{mobileTitle}</span>
          </li>
        </ul>

        {/* Right navbar links */}
        <ul className="navbar-nav ml-auto align-items-center">
          <li className="nav-item mr-3">
            <span className="font-weight-bold text-secondary" style={{ fontSize: '14px' }}>
              <i className="fas fa-user-circle mr-1"></i> {displayName} ({userRole})
            </span>
          </li>
          <li className="nav-item">
            <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i> Logout
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
        {/* Brand Logo */}
        <div className="brand-link d-flex align-items-center" style={{ borderBottom: '1px solid #4f5962', padding: '15px' }}>
          <img src="/logo.png" alt="Cyrix Logo" className="brand-image img-circle elevation-3" style={{ opacity: '.8', maxHeight: '33px', float: 'none' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <span className="brand-text font-weight-bold text-white pl-2" style={{ fontSize: '18px' }}>Cyrix Healthcare</span>
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
                const isActive = location.pathname === item.path;
                return (
                  <li className="nav-item" key={item.id} style={{ width: '100%' }}>
                    <Link to={item.path} className={`nav-link ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', margin: '2px 0' }}>
                      <i className={`nav-icon ${item.icon}`} style={{ width: '24px', textAlign: 'center' }}></i>
                      <p style={{ margin: '0 0 0 10px' }}>{item.label}</p>
                    </Link>
                  </li>
                );
              })}
              <li className="nav-item mt-4" style={{ width: '100%' }}>
                <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center' }}>
                  <i className="nav-icon fas fa-user-circle" style={{ width: '24px', textAlign: 'center' }}></i>
                  <p style={{ margin: '0 0 0 10px' }}>My Profile</p>
                </Link>
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
          <Outlet />
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
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.id} to={item.path} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : '#6c757d',
              fontSize: '11px',
              fontWeight: 600
            }}>
              <i className={item.icon} style={{ fontSize: '18px', marginBottom: '4px' }}></i>
              <span>{item.id === 'dashboard' ? 'Home' : item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
        <Link to="/profile" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textDecoration: 'none',
          color: location.pathname === '/profile' ? 'var(--primary)' : '#6c757d',
          fontSize: '11px',
          fontWeight: 600
        }}>
          <i className="fas fa-user-circle" style={{ fontSize: '18px', marginBottom: '4px' }}></i>
          <span>Profile</span>
        </Link>
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
    </div>
  );
}
