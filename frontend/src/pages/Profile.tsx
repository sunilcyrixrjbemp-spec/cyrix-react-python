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

  useEffect(() => {
    const loggedInId = localStorage.getItem('logged_in_user_id') || localStorage.getItem('user_id') || '';
    const role = localStorage.getItem('user_role') || '';
    setUserRole(role);

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
      // Fetch profile info
      const pRes = await fetch(`/api/profile?user_id=${currentObj.id}`);
      const pData = await pRes.json();

      if (pRes.ok && pData.success) {
        setCurrentProfile(pData.profile);
        
        // Update name in history if it was "My Profile" to show actual name
        if (currentObj.name === 'My Profile' && pData.profile.full_name) {
          setProfileHistory(prev => {
            const copy = [...prev];
            copy[copy.length - 1].name = pData.profile.full_name;
            return copy;
          });
        }

        // Fetch team list
        const tRes = await fetch(`/api/team?manager_id=${currentObj.id}`);
        const tData = await tRes.json();
        if (tRes.ok && tData.success && tData.team) {
          setTeamMembers(tData.team);
        } else {
          setTeamMembers([]);
        }
      } else {
        alert('Could not load profile: ' + (pData.message || 'Unknown error'));
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

  const getBreadcrumbs = () => {
    if (profileHistory.length <= 1) {
      return <div className="bc-item bc-current">My Profile</div>;
    }

    return (
      <>
        <button className="back-btn" onClick={() => goBack(profileHistory.length - 2)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back
        </button>
        {profileHistory.map((item, index) => {
          const isLast = index === profileHistory.length - 1;
          const label = index === 0 ? 'My Profile' : item.name.split(' ')[0];
          if (isLast) {
            return (
              <React.Fragment key={index}>
                <span className="bc-separator">/</span>{' '}
                <span className="bc-item bc-current">{label}</span>
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={index}>
              {index > 0 && <span className="bc-separator">/</span>}{' '}
              <span className="bc-item" onClick={() => goBack(index)}>{label}</span>
            </React.Fragment>
          );
        })}
      </>
    );
  };

  const renderTeamSection = () => {
    if (!teamMembers || teamMembers.length === 0) return null;

    const rolesWithReportees = ['Manager', 'Coordinator', 'Divisional Manager', 'Project Head'];
    const distinctManagers = Array.from(new Set(teamMembers.map(emp => emp.manager_name || 'No Manager Assigned')));
    const isAdmin = ['Admin', 'HR', 'Superadmin'].includes(userRole);

    const buildCard = (emp: TeamMember) => {
      const hasReportees = rolesWithReportees.includes(emp.role);
      return (
        <div key={emp.user_id} className="team-member-circle" onClick={() => drillDown(emp.user_id, emp.full_name)}>
          <div className="tmc-avatar">
            <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
              <path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1.5h16V17c0-2.66-5.33-4-8-4z" />
            </svg>
            {hasReportees && <div className="reportee-indicator">+</div>}
          </div>
          <div className="tmc-name">{emp.full_name || 'Unknown'}</div>
          <div className="tmc-ecode">({emp.e_code || 'N/A'})</div>
        </div>
      );
    };

    if (distinctManagers.length > 1 || isAdmin) {
      // Grouping by manager
      const groups: { [key: string]: TeamMember[] } = {};
      teamMembers.forEach(emp => {
        const mgr = emp.manager_name || 'No Manager Assigned';
        if (!groups[mgr]) groups[mgr] = [];
        groups[mgr].push(emp);
      });

      return (
        <div className="team-container" id="teamSectionContainer" style={{ display: 'block' }}>
          {Object.entries(groups).map(([mName, emps]) => (
            <div className="org-group" key={mName}>
              <div className="org-group-title">Reporting to: {mName} ({emps.length})</div>
              <div className="team-avatar-grid">
                {emps.map(emp => buildCard(emp))}
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      // Standard List
      return (
        <div className="team-container" id="teamSectionContainer" style={{ display: 'block' }}>
          <div className="org-group">
            <div className="org-group-title">My Team ({teamMembers.length})</div>
            <div className="team-avatar-grid">
              {teamMembers.map(emp => buildCard(emp))}
            </div>
          </div>
        </div>
      );
    }
  };

  const getLocations = (p: ProfileData) => {
    const locs = [];
    if (p.district_name) locs.push(p.district_name);
    if (p.zone_name) locs.push(p.zone_name);
    return locs.join(', ') || 'N/A';
  };

  return (
    <div className="profile-container">
      <div className="breadcrumb-nav" id="breadcrumbContainer">
        {getBreadcrumbs()}
      </div>

      {currentProfile && (
        <div className="contact-card">
          <div className="cc-banner"></div>
          <div className="cc-header">
            <div className="cc-avatar-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="cc-header-info cc-title">
              <h2 id="dispFullName">{currentProfile.full_name || 'N/A'}</h2>
              <p id="dispDesignation">{currentProfile.designation || 'N/A'}</p>
              <span id="dispRole" className="cc-role-badge">{currentProfile.role || 'N/A'}</span>
            </div>
          </div>
          <div className="cc-body">
            <div className="cc-grid">
              <div className="cc-item">
                <label>Employee Code</label>
                <p id="dispEcode" className="mono">{currentProfile.e_code || 'N/A'}</p>
              </div>
              <div className="cc-item">
                <label>Mobile Number</label>
                <p id="dispMobile">{currentProfile.mobile_number || 'N/A'}</p>
              </div>
              <div className="cc-item">
                <label>Email Address</label>
                <p id="dispMail">{currentProfile.mail_id || 'N/A'}</p>
              </div>
              <div className="cc-item">
                <label>Zone & District</label>
                <p id="dispLocation">{getLocations(currentProfile)}</p>
              </div>
              <div className="cc-item" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                <label>Reporting Managers</label>
                <div className="approvers-block">
                  <span>L1: <strong id="dispL1Approver">{currentProfile.level_first_approver || 'None'}</strong></span>
                  <span>L2: <strong id="dispL2Approver">{currentProfile.level_second_approver || 'None'}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentProfile && currentProfile.reportees && currentProfile.reportees.length > 0 && (
        <div className="contact-card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '20px' }}>👥</span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary-dark)', margin: 0 }}>My Team / Direct Reportees</h3>
          </div>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 8px' }}>User ID</th>
                  <th style={{ padding: '12px 8px' }}>Name</th>
                  <th style={{ padding: '12px 8px' }}>Role</th>
                  <th style={{ padding: '12px 8px' }}>Designation</th>
                  <th style={{ padding: '12px 8px' }}>Contact Details</th>
                  <th style={{ padding: '12px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {currentProfile.reportees.map((rep: any) => (
                  <tr key={rep.user_id} style={{ cursor: 'pointer' }} onClick={() => drillDown(rep.user_id, rep.full_name)}>
                    <td style={{ padding: '12px 8px' }}><span className="user-id-tag">{rep.user_id}</span></td>
                    <td style={{ padding: '12px 8px' }}><strong>{rep.full_name}</strong></td>
                    <td style={{ padding: '12px 8px' }}>{rep.role}</td>
                    <td style={{ padding: '12px 8px' }}>{rep.designation}</td>
                    <td style={{ padding: '12px 8px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <a href={`tel:${rep.mobile_number}`} style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                          📞 {rep.mobile_number}
                        </a>
                        <a href={`mailto:${rep.mail_id}`} style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                          ✉️ {rep.mail_id}
                        </a>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`status-badge ${String(rep.account_status).toLowerCase() === 'active' ? 'status-approved' : 'status-rejected'}`} style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
                        {rep.account_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {renderTeamSection()}

      <Loader show={isLoading} message={loaderMessage} />
    </div>
  );
}
