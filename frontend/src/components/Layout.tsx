import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';

const ICONS = {
  dashboard: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  admin: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11" r="3" />
      <path d="M12 8v1M12 13v1M9 11h1M14 11h1" />
    </svg>
  ),
  approval: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" strokeDasharray="2 2" />
      <path d="M9 12l2 2 4-4" strokeWidth="2" />
    </svg>
  ),
  expense: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  report: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18.7 8l-5.1 5.2-2.8-2.7-4.8 4.8" />
      <path d="M14 8h5v5" />
    </svg>
  ),
  upload: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.2 15c.5-1 .8-2.2.8-3.5 0-4.4-3.6-8-8-8C10 3.5 6.7 6.2 6 9.8 4 10.3 2.5 12 2.5 14c0 2.5 2 4.5 4.5 4.5h11.5" />
      <path d="M16 12l-4-4-4 4M12 8v9" />
    </svg>
  ),
  month: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8" cy="14" r="1" />
      <circle cx="12" cy="14" r="1" />
      <circle cx="16" cy="14" r="1" />
      <circle cx="8" cy="18" r="1" />
      <circle cx="12" cy="18" r="1" />
      <circle cx="16" cy="18" r="1" />
    </svg>
  ),
  profile: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  ),
  logout: (
    <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
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

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
    // Clear cookie
    document.cookie = "user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    navigate('/');
  };

  const activeItems = ALL_MENU_ITEMS.filter(item => {
    if (!item.roles.includes(userRole)) return false;
    if (userRole === 'Admin' || userRole === 'Superadmin') return true;
    if (item.id === 'dashboard' || item.id === 'expense') return true;
    return allowedMenus.includes(item.id.toLowerCase());
  });


  // Determine current active page title for mobile topbar
  const currentItem = ALL_MENU_ITEMS.find(item => item.path === location.pathname);
  const mobileTitle = currentItem ? currentItem.label : (location.pathname === '/profile' ? 'My Profile' : 'Cyrix');

  return (
    <div className="app-page">
      {/* DESKTOP SIDEBAR */}
      <div className="sidebar" id="desktopSidebar">
        <div>
          <div className="sidebar-logo">
            <img src="/logo.png" alt="Cyrix" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="logo-text">
              <h2>Cyrix Healthcare</h2>
              <span>Field Analytics</span>
            </div>
          </div>
          <div className="nav-section">
            <div className="nav-section-label">Main Menu</div>
            <ul className="nav-list" id="sidebarNav">
              {activeItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.id}>
                    <Link to={item.path} className={`nav-link-item ${isActive ? 'active' : ''}`}>
                      <div className="nav-icon-wrap">{item.icon}</div> {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="sidebar-bottom">
          <ul className="nav-list" id="desktopSidebarBottom">
            <li>
              <Link to="/profile" className={`nav-link-item ${location.pathname === '/profile' ? 'active' : ''}`}>
                <div className="nav-icon-wrap">{ICONS.profile}</div> My Profile
              </Link>
            </li>
            <li>
              <a href="#" className="nav-link-item nav-logout" onClick={handleLogout}>
                <div className="nav-icon-wrap">{ICONS.logout}</div> Logout
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* MAIN CONTENT OUTLET */}
      <div className="main-content" id="mainContainer">
        {/* Mobile Topbar */}
        <div className="mobile-topbar hide-desktop">
          <div className="mobile-topbar-left">
            <h1>{mobileTitle}</h1>
          </div>
          <img src="/logo.png" alt="Cyrix Logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>

        <Outlet />
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav" id="bottom-nav">
        {activeItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`bn-item ${isActive ? 'active' : ''}`}
            >
              <div className="bn-icon-wrap">{item.icon}</div>
              <span className="bn-label">{item.label}</span>
            </Link>
          );
        })}
        <Link to="/profile" className={`bn-item ${location.pathname === '/profile' ? 'active' : ''}`}>
          <div className="bn-icon-wrap">{ICONS.profile}</div>
          <span className="bn-label">Profile</span>
        </Link>
        <a href="#" className="bn-item" onClick={handleLogout}>
          <div className="bn-icon-wrap">{ICONS.logout}</div>
          <span className="bn-label">Logout</span>
        </a>
      </nav>

      {/* Logout Modal */}
      {showLogoutModal && (
        <>
          <div className="popup-overlay" style={{ display: 'block' }} onClick={() => setShowLogoutModal(false)}></div>
          <div className="custom-popup" style={{ display: 'block' }}>
            <div className="icon-wrapper error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <h3 style={{ color: 'var(--primary-dark)', fontSize: '18px', marginBottom: '8px', fontWeight: 800 }}>Log Out</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '24px', fontWeight: 500 }}>Are you sure you want to securely log out?</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn-ghost" onClick={() => setShowLogoutModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={confirmLogout} style={{ margin: 0, background: 'var(--danger)', flex: 1, justifyContent: 'center' }}>Logout</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
