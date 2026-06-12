import React, { useState, useEffect, useRef } from 'react';
import '../css/style.css';
import '../css/dashboard.css';


interface UserFilter {
  user_id: string;
  full_name: string;
  role: string;
  zone_name: string;
  district_name: string;
  level_first_approver?: string;
}

interface FacilityFilter {
  facility_name: string;
  facility_incharge: string;
  district_name: string;
  zone_name: string;
  dm_name: string;
  coordinator_name: string;
}

interface ExpenseRecord {
  exp_id: string;
  user_id: string;
  expense_date: string;
  total_amount: number;
  status: string;
  level_first_approver: string;
  level_second_approver: string;
  full_name: string;
  zone_name: string;
  user_district: string;
  total_km: number;
}

interface ExpenseSummary {
  district: string;
  total_complaints: number;
  resolved: number;
  pending: number;
}

interface PenaltyRecord {
  id: number;
  complaint_id: string;
  hospital_name: string;
  equipment_name: string;
  complaint_raise_date: string;
  complaint_close_date: string;
  complaint_status: string;
  attend_date: string;
  attend_penalty: number;
  penalty: number;
  total_penalty: number;
  attend_engineer_id: string;
  close_engineer_id: string;
  open_month: string;
  close_month: string;
  facility_district?: string;
  district_name?: string;
  bar_code?: string;
}

interface PenaltySummary {
  district: string;
  total_complaints: number;
  resolved: number;
  pending: number;
  attend_penalty: number;
  close_penalty: number;
  total_penalty: number;
}

interface Toast {
  id: number;
  msg: string;
  type: string;
}

const ZONE_DISTRICT_MAP: Record<string, string[]> = {
  'Ajmer': ['Ajmer', 'Bhilwara', 'Nagaur', 'Tonk'],
  'Bikaner': ['Bikaner', 'Churu', 'Ganganagar', 'Hanumangarh'],
  'Jodhpur': ['Barmer', 'Jaisalmer', 'Jalore', 'Jodhpur', 'Pali', 'Phalodi', 'Sirohi'],
  'Udaipur': ['Banswara', 'Chittorgarh', 'Dungarpur', 'Pratapgarh', 'Rajsamand', 'Udaipur']
};

const PAL = {
  blue: '#2563eb', cyan: '#06b6d4', green: '#059669',
  orange: '#ea580c', red: '#dc2626', purple: '#7c3aed',
  yellow: '#ca8a04', pink: '#db2777',
  grid: 'rgba(15,23,42,0.06)', text: '#475569',
  primaryDark: '#002b5e'
};
const MULTI = ['#2563eb', '#059669', '#dc2626', '#ea580c', '#7c3aed', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'expense' | 'penalty'>('expense');

  // Filters State
  const [quickPeriod, setQuickPeriod] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('All');
  const [filterMonth, setFilterMonth] = useState<string>(() => String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState<string>(() => String(new Date().getFullYear()));

  const [zone, setZone] = useState('All');
  const [district, setDistrict] = useState('All');
  const [hospital, setHospital] = useState('All');
  const [manager, setManager] = useState('All');
  const [engineer, setEngineer] = useState('All');

  // live data lists
  const [rawUsers, setRawUsers] = useState<UserFilter[]>([]);
  const [rawFacilities, setRawFacilities] = useState<FacilityFilter[]>([]);
  const [upkaranMap, setUpkaranMap] = useState<Map<string, string>>(new Map());

  // Current User Context
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [userZone, setUserZone] = useState('All');
  const [userDistrict, setUserDistrict] = useState('All');

  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [isDM, setIsDM] = useState(false);
  const [isDI, setIsDI] = useState(false);
  const [isManager, setIsManager] = useState(false);

  // live stats datasets
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [expSummary, setExpSummary] = useState<ExpenseSummary[]>([]);
  const [penSummary, setPenSummary] = useState<PenaltySummary[]>([]);

  // Filtered results
  const [filteredExp, setFilteredExp] = useState<ExpenseRecord[]>([]);
  const [filteredPen, setFilteredPen] = useState<PenaltyRecord[]>([]);
  const [teamFilteredExp, setTeamFilteredExp] = useState<ExpenseRecord[]>([]);

  // Page limit search inputs
  const [expLimit, setExpLimit] = useState('50');
  const [expSearch, setExpSearch] = useState('');
  const [penLimit, setPenLimit] = useState('50');
  const [penSearch, setPenSearch] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState('Data Loading...');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modals state
  const [selectedPen, setSelectedPen] = useState<PenaltyRecord | null>(null);
  const [selectedExp, setSelectedExp] = useState<ExpenseRecord | null>(null);
  const [teamBreakdownStatus, setTeamBreakdownStatus] = useState<string | null>(null);

  // Charts Refs
  const expTrendRef = useRef<HTMLCanvasElement | null>(null);
  const expDonutRef = useRef<HTMLCanvasElement | null>(null);
  const expEngBarRef = useRef<HTMLCanvasElement | null>(null);
  const expDistRef = useRef<HTMLCanvasElement | null>(null);

  const penTrendRef = useRef<HTMLCanvasElement | null>(null);
  const penStatusRef = useRef<HTMLCanvasElement | null>(null);
  const penEqpRef = useRef<HTMLCanvasElement | null>(null);
  const penHospRef = useRef<HTMLCanvasElement | null>(null);
  const penEngBarRef = useRef<HTMLCanvasElement | null>(null);
  const penDistRef = useRef<HTMLCanvasElement | null>(null);

  // Instantiated charts storage
  const chartsInstance = useRef<Record<string, any>>({});

  const showToast = (msg: string, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // 1. Initial auth read
  useEffect(() => {
    const uId = localStorage.getItem('logged_in_user_id') || localStorage.getItem('user_id') || '';
    const name = localStorage.getItem('display_name') || 'User';
    const role = (localStorage.getItem('user_role') || '').trim();

    if (!uId || !role) {
      window.location.href = 'index.html';
      return;
    }

    setUserId(uId);
    setUserName(name);
    setUserRole(role);

    const admin = role === 'Admin' || role === 'Superadmin';
    const coord = role === 'Coordinator';
    const dm = role === 'Divisional Manager' || role === 'DM';
    const di = role === 'District Incharge' || role === 'DI';
    const mgr = role === 'Manager' || admin || coord || dm || di;

    setIsAdmin(admin);
    setIsCoordinator(coord);
    setIsDM(dm);
    setIsDI(di);
    setIsManager(mgr);
  }, []);

  // 2. Fetch User & Facility Metadata
  const fetchFilterUsers = async () => {
    try {
      const res = await fetch('/api/dashboard/filters');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      setRawUsers(data.users || []);
      setRawFacilities(data.facilities || []);

      const newMap = new Map<string, string>();
      (data.users || []).forEach((u: any) => {
        if (u.e_upkaran_id) {
          newMap.set(String(u.e_upkaran_id).trim(), u.full_name || '');
        }
      });
      setUpkaranMap(newMap);

      const current = (data.users || []).find((u: any) => String(u.user_id) === String(userId));
      if (current) {
        setUserZone(current.zone_name || 'All');
        setUserDistrict(current.district_name || 'All');
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchFilterUsers();
    }
  }, [userId]);

  // Adjust initial filters based on Role when User metadata is resolved
  useEffect(() => {
    if (!isAdmin && userZone !== 'All') {
      if (isCoordinator || isDM || isDI) {
        setZone(userZone);
      }
      if (isDI && userDistrict !== 'All') {
        setDistrict(userDistrict);
      }
    }
  }, [isAdmin, isCoordinator, isDM, isDI, userZone, userDistrict]);

  // Helper date calculation
  const getDates = (period: string) => {
    if (period === '0' || period === 'all') return { start: null, end: null };
    if (period === 'custom') {
      return { start: startDate, end: endDate };
    }
    if (period === 'month') {
      const yNum = parseInt(filterYear, 10);
      const mNum = parseInt(filterMonth, 10);
      if (!isNaN(yNum) && !isNaN(mNum) && mNum >= 1 && mNum <= 12) {
        const startStr = `${yNum}-${String(mNum).padStart(2, '0')}-01`;
        let nextY = yNum;
        let nextM = mNum + 1;
        if (nextM > 12) {
          nextM = 1;
          nextY += 1;
        }
        const endStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        return { start: startStr, end: endStr };
      }
    }
    const start = new Date();
    const end = new Date();
    if (period === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (period === 'today') {
      // Keep today
    } else {
      start.setDate(start.getDate() - parseInt(period));
    }
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  };

  // 3. Main Live Data Sync
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setLoaderText('Data Loading...');
    try {
      const { start, end } = getDates(quickPeriod);
      const p = new URLSearchParams({
        user_id: userId,
        zone,
        district,
        manager,
        engineer,
        facility: hospital
      });

      if (start && end) {
        p.set('start_date', start);
        p.set('end_date', end);
      }

      const [expRes, penRes] = await Promise.all([
        fetch(`/api/dashboard/expenses?${p}`),
        fetch(`/api/dashboard/penalties?${p}`)
      ]);

      if (expRes.ok) {
        const data = await expRes.json();
        setExpenses(data.success ? data.expenses || [] : []);
        setExpSummary(data.success ? data.summary || [] : []);
      }
      if (penRes.ok) {
        const data = await penRes.json();
        setPenalties(data.success ? data.penalties || [] : []);
        setPenSummary(data.success ? data.summary || [] : []);
      }
    } catch (e) {
      showToast('Failed to fetch live data. Syncing error.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchDashboardData();
    }
  }, [userId, quickPeriod, startDate, endDate, zone, district, hospital, manager, engineer, filterMonth, filterYear]);

  // 4. Processing Filters locally
  const MON_MAP: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  
  const parsePenDate = (str: string) => {
    if (!str) return null;
    const m = str.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (!m) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    return new Date(parseInt(m[3]), MON_MAP[m[2]] ?? 0, parseInt(m[1]));
  };

  useEffect(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yestStart = todayStart - 86400000;
    const customStart = quickPeriod === 'custom' && startDate ? new Date(startDate).getTime() : null;
    const customEnd = quickPeriod === 'custom' && endDate ? new Date(endDate).getTime() + 86400000 : null;
    const monthStart = quickPeriod === 'month' ? new Date(parseInt(filterYear), parseInt(filterMonth) - 1, 1).getTime() : null;
    const monthEnd = quickPeriod === 'month' ? new Date(parseInt(filterYear) + (parseInt(filterMonth) === 12 ? 1 : 0), (parseInt(filterMonth) % 12), 1).getTime() : null;

    // Filter expenses
    const fExp = expenses.filter((e) => {
      if (status !== 'All') {
        const st = (e.status || '').toLowerCase();
        if (status === 'Pending' && !st.includes('pending')) return false;
        if (status === 'Approved' && e.status !== 'Approved') return false;
        if (status === 'Rejected' && e.status !== 'Rejected') return false;
      }
      const t = new Date(e.expense_date).getTime();
      if (quickPeriod === 'today' && t < todayStart) return false;
      if (quickPeriod === 'yesterday' && (t < yestStart || t >= todayStart)) return false;
      if (quickPeriod === 'custom' && customStart && customEnd && (t < customStart || t >= customEnd)) return false;
      if (quickPeriod === 'month' && monthStart && monthEnd && (t < monthStart || t >= monthEnd)) return false;
      return true;
    });
    setFilteredExp(fExp);

    // Filter penalties
    const fPen = penalties.filter((p) => {
      const pD = parsePenDate(p.complaint_raise_date);
      const t = pD ? pD.getTime() : 0;
      if (quickPeriod === 'today' && t < todayStart) return false;
      if (quickPeriod === 'yesterday' && (t < yestStart || t >= todayStart)) return false;
      if (quickPeriod === 'custom' && customStart && customEnd && (t < customStart || t >= customEnd)) return false;
      if (quickPeriod === 'month' && monthStart && monthEnd && (t < monthStart || t >= monthEnd)) return false;
      return true;
    });
    setFilteredPen(fPen);

    // Team claims calculation
    let strictTeam = fExp.filter((e) => {
      if (String(e.user_id) === String(userId) || e.full_name === userName) return false;
      if (userRole === 'Manager') {
        return (e.level_first_approver === userName) || (e.level_first_approver || '').includes(userName);
      } else if (userRole === 'Coordinator') {
        return (e.level_second_approver === userName) || (e.level_second_approver || '').includes(userName);
      }
      return true; // Admin/DM/DI sees all non-own
    });

    if (strictTeam.length === 0 && fExp.filter((e) => String(e.user_id) !== String(userId)).length > 0) {
      strictTeam = fExp.filter((e) => String(e.user_id) !== String(userId) && e.full_name !== userName);
    }
    setTeamFilteredExp(strictTeam);

  }, [expenses, penalties, status, quickPeriod, startDate, endDate, userId, userName, userRole]);

  // 5. Chart renders
  const destroyChart = (id: string) => {
    if (chartsInstance.current[id]) {
      chartsInstance.current[id].destroy();
      delete chartsInstance.current[id];
    }
  };

  const getChartDefaults = (color: string) => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        shadow3D: { enabled: true },
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => ` ₹${Number(ctx.raw).toLocaleString('en-IN')}`
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: {
            color: PAL.text,
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 0,
            maxTicksLimit: 8
          }
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: PAL.grid },
          ticks: {
            color: PAL.text,
            font: { size: 11 },
            callback: (v: any) => '₹' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
          }
        }
      }
    };
  };

  const getBarHorizDefaults = () => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        shadow3D: { enabled: true },
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => ` ₹${Number(ctx.raw).toLocaleString('en-IN')}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: PAL.grid },
          ticks: {
            color: PAL.text,
            font: { size: 11 },
            callback: (v: any) => '₹' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: PAL.text, font: { size: 11 } }
        }
      }
    };
  };

  const getDonutDefaults = () => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        shadow3D: { enabled: true },
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', padding: 12, cornerRadius: 8 }
      }
    };
  };

  const groupSum = (arr: any[], keyFn: (x: any) => string | null, valKey: string) => {
    return arr.reduce((acc: Record<string, number>, x) => {
      const k = keyFn(x);
      if (!k) return acc;
      acc[k] = (acc[k] || 0) + (parseFloat(String(x[valKey])) || 0);
      return acc;
    }, {});
  };

  const getEngName = (id: string) => {
    if (!id || id === '—') return '—';
    const name = upkaranMap.get(String(id).trim());
    return name ? `${name} (${id})` : String(id);
  };

  // Expenses Tab Charts draw
  useEffect(() => {
    if (activeTab !== 'expense' || typeof (window as any).Chart === 'undefined') return;

    try {
      // 1. Trend Line
      const byDate = groupSum(filteredExp, (e) => (e.expense_date || '').slice(0, 10), 'total_amount');
      const allLabels = Object.keys(byDate).filter(Boolean).sort();
      const labels = allLabels.slice(-7);
      const vals = labels.map((d) => byDate[d]);

      if (expTrendRef.current) {
        destroyChart('expTrendChart');
        chartsInstance.current['expTrendChart'] = new (window as any).Chart(expTrendRef.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [{ data: vals, backgroundColor: PAL.blue, borderRadius: 20, borderSkipped: false }]
          },
          options: getChartDefaults(PAL.blue)
        });
      }

      // 2. Status Donut
      const appC = filteredExp.filter((e) => e.status === 'Approved').length;
      const rejC = filteredExp.filter((e) => e.status === 'Rejected').length;
      const penC = filteredExp.filter((e) => (e.status || '').toLowerCase().includes('pending')).length;

      if (expDonutRef.current) {
        destroyChart('expDonutChart');
        chartsInstance.current['expDonutChart'] = new (window as any).Chart(expDonutRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Approved', 'Rejected', 'Pending'],
            datasets: [{ data: [appC, rejC, penC], backgroundColor: [PAL.green, PAL.red, PAL.yellow], borderWidth: 0, hoverOffset: 10 }]
          },
          options: getDonutDefaults()
        });
      }

      // 3. Top Engineers
      if (isManager) {
        const engData = groupSum(filteredExp, (e) => e.full_name || 'Unknown', 'total_amount');
        const engTop = Object.entries(engData).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const engLabels = engTop.map((x) => x[0].split(' (')[0]);
        const engVals = engTop.map((x) => x[1]);

        if (expEngBarRef.current) {
          destroyChart('expEngBarChart');
          chartsInstance.current['expEngBarChart'] = new (window as any).Chart(expEngBarRef.current, {
            type: 'bar',
            data: {
              labels: engLabels,
              datasets: [{ data: engVals, backgroundColor: PAL.blue, borderRadius: 20, borderSkipped: false }]
            },
            options: getChartDefaults(PAL.blue)
          });
        }

        // 4. District Breakdown
        const distData = groupSum(filteredExp, (e) => e.user_district || 'Unknown', 'total_amount');
        const distTop = Object.entries(distData).sort((a, b) => b[1] - a[1]).slice(0, 7);

        if (expDistRef.current) {
          destroyChart('expDistChart');
          chartsInstance.current['expDistChart'] = new (window as any).Chart(expDistRef.current, {
            type: 'bar',
            data: {
              labels: distTop.map((x) => x[0]),
              datasets: [{ data: distTop.map((x) => x[1]), backgroundColor: PAL.cyan, borderRadius: 20 }]
            },
            options: getBarHorizDefaults()
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeTab, filteredExp, isManager]);

  // Penalties Tab Charts draw
  useEffect(() => {
    if (activeTab !== 'penalty' || typeof (window as any).Chart === 'undefined') return;

    try {
      // 1. Deductions Trend
      const byDate = groupSum(filteredPen, (p) => {
        const d = parsePenDate(p.complaint_raise_date);
        return d ? d.toISOString().slice(0, 10) : null;
      }, 'total_penalty');
      const allLabels = Object.keys(byDate).filter(Boolean).sort();
      const labels = allLabels.slice(-7);
      const vals = labels.map((d) => byDate[d]);

      if (penTrendRef.current) {
        destroyChart('penTrendChart');
        chartsInstance.current['penTrendChart'] = new (window as any).Chart(penTrendRef.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [{ data: vals, backgroundColor: PAL.red, borderRadius: 20, borderSkipped: false }]
          },
          options: getChartDefaults(PAL.red)
        });
      }

      // 2. Complaint status breakdown
      const resolved = filteredPen.filter((p) => ['resolve', 'close', 'closed'].some((x) => (p.complaint_status || '').toLowerCase().includes(x))).length;
      const pending = filteredPen.length - resolved;

      if (penStatusRef.current) {
        destroyChart('penStatusChart');
        chartsInstance.current['penStatusChart'] = new (window as any).Chart(penStatusRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Resolved', 'Pending'],
            datasets: [{ data: [resolved, pending], backgroundColor: [PAL.green, PAL.yellow], borderWidth: 0, hoverOffset: 10 }]
          },
          options: getDonutDefaults()
        });
      }

      // 3. Equipment Deductions
      const eqpData = groupSum(filteredPen, (p) => p.equipment_name || 'Unknown', 'total_penalty');
      const eqpTop = Object.entries(eqpData).sort((a, b) => b[1] - a[1]).slice(0, 6);

      if (penEqpRef.current) {
        destroyChart('penEqpChart');
        chartsInstance.current['penEqpChart'] = new (window as any).Chart(penEqpRef.current, {
          type: 'doughnut',
          data: {
            labels: eqpTop.map((x) => x[0]),
            datasets: [{ data: eqpTop.map((x) => x[1]), backgroundColor: MULTI, borderWidth: 0, hoverOffset: 10 }]
          },
          options: getDonutDefaults()
        });
      }

      // 4. Hospital Facilities top deductions
      const hospData = groupSum(filteredPen, (p) => p.hospital_name || 'Unknown', 'total_penalty');
      const hospTop = Object.entries(hospData).sort((a, b) => b[1] - a[1]).slice(0, 7);

      if (penHospRef.current) {
        destroyChart('penHospChart');
        chartsInstance.current['penHospChart'] = new (window as any).Chart(penHospRef.current, {
          type: 'bar',
          data: {
            labels: hospTop.map((x) => x[0]),
            datasets: [{ data: hospTop.map((x) => x[1]), backgroundColor: PAL.red, borderRadius: 20 }]
          },
          options: getBarHorizDefaults()
        });
      }

      // Manager/Admin graphs
      if (isManager) {
        const engData = groupSum(filteredPen, (p) => getEngName(p.attend_engineer_id || p.close_engineer_id), 'total_penalty');
        const engTop = Object.entries(engData).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const engLabels = engTop.map((x) => x[0].split(' (')[0]);
        const engVals = engTop.map((x) => x[1]);

        if (penEngBarRef.current) {
          destroyChart('penEngBarChart');
          chartsInstance.current['penEngBarChart'] = new (window as any).Chart(penEngBarRef.current, {
            type: 'bar',
            data: {
              labels: engLabels,
              datasets: [{ data: engVals, backgroundColor: PAL.orange, borderRadius: 20, borderSkipped: false }]
            },
            options: getChartDefaults(PAL.orange)
          });
        }

        const distData = groupSum(filteredPen, (p) => p.district_name || 'Unknown', 'total_penalty');
        const distTop = Object.entries(distData).sort((a, b) => b[1] - a[1]).slice(0, 7);

        if (penDistRef.current) {
          destroyChart('penDistChart');
          chartsInstance.current['penDistChart'] = new (window as any).Chart(penDistRef.current, {
            type: 'bar',
            data: {
              labels: distTop.map((x) => x[0]),
              datasets: [{ data: distTop.map((x) => x[1]), backgroundColor: PAL.purple, borderRadius: 20 }]
            },
            options: getBarHorizDefaults()
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeTab, filteredPen, isManager]);

  // Clean charts on unmount
  useEffect(() => {
    return () => {
      Object.keys(chartsInstance.current).forEach((key) => {
        chartsInstance.current[key].destroy();
      });
    };
  }, []);

  // 6. CSV Exporter
  const exportCSV = () => {
    if (activeTab === 'expense') {
      const headers = ['Exp ID', 'Engineer', 'Date', 'District', 'Amount', 'Status'];
      const rows = filteredExp.map((e) => [
        e.exp_id || '',
        e.full_name || '',
        e.expense_date || '',
        e.user_district || '',
        String(e.total_amount || 0),
        e.status || ''
      ]);
      downloadCSV([headers, ...rows], 'expense_report.csv');
    } else {
      const headers = ['Call ID', 'Hospital', 'Equipment', 'Raise Date', 'Close Date', 'Attend Penalty', 'Close Penalty', 'Total Penalty'];
      const rows = filteredPen.map((p) => [
        p.complaint_id || '',
        p.hospital_name || '',
        p.equipment_name || '',
        p.complaint_raise_date || '',
        p.complaint_close_date || '',
        String(p.attend_penalty || 0),
        String(p.penalty || 0),
        String(p.total_penalty || 0)
      ]);
      downloadCSV([headers, ...rows], 'penalty_report.csv');
    }
  };

  const downloadCSV = (rows: string[][], filename: string) => {
    const csvContent = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    showToast('File exported successfully!', 'success');
  };

  // Dropdown filter changes
  const handleZoneChange = (val: string) => {
    setZone(val);
    setDistrict('All');
    setHospital('All');
    setManager('All');
    setEngineer('All');
  };

  const handleDistrictChange = (val: string) => {
    setDistrict(val);
    setHospital('All');
    setManager('All');
    setEngineer('All');
  };

  const handleHospitalChange = (val: string) => {
    setHospital(val);
    setEngineer('All');
  };

  const handleManagerChange = (val: string) => {
    setManager(val);
    setEngineer('All');
  };

  const handleQuickPeriodChange = (val: string) => {
    setQuickPeriod(val);
  };

  // Calculation utilities
  const getFmtINR = (n: number) => {
    return (parseFloat(String(n)) || 0).toLocaleString('en-IN');
  };

  const getFmtDate = (d: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  // Filter lists according to pagination and search input
  const getSearchedExpenses = () => {
    const q = expSearch.toLowerCase().trim();
    let res = filteredExp.filter((e) =>
      (e.exp_id || '').toLowerCase().includes(q) ||
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.user_district || '').toLowerCase().includes(q)
    );
    if (expLimit !== 'All') {
      res = res.slice(0, parseInt(expLimit));
    }
    return res;
  };

  const getSearchedPenalties = () => {
    const q = penSearch.toLowerCase().trim();
    let res = filteredPen.filter((p) =>
      (p.complaint_id || '').toLowerCase().includes(q) ||
      (p.hospital_name || '').toLowerCase().includes(q) ||
      (p.equipment_name || '').toLowerCase().includes(q) ||
      (p.district_name || p.facility_district || '').toLowerCase().includes(q)
    );
    if (penLimit !== 'All') {
      res = res.slice(0, parseInt(penLimit));
    }
    return res;
  };

  // Modal breakdown calculations
  const getTeamBreakdownData = () => {
    if (!teamBreakdownStatus) return [];
    let list = teamFilteredExp;
    if (teamBreakdownStatus === 'Pending') {
      list = teamFilteredExp.filter((e) => (e.status || '').toLowerCase().includes('pending'));
    } else if (teamBreakdownStatus === 'Approved') {
      list = teamFilteredExp.filter((e) => e.status === 'Approved');
    } else if (teamBreakdownStatus === 'Rejected') {
      list = teamFilteredExp.filter((e) => e.status === 'Rejected');
    }

    const grouped: Record<string, { count: number; amount: number }> = {};
    list.forEach((e) => {
      const name = e.full_name || 'Unknown Engineer';
      if (!grouped[name]) grouped[name] = { count: 0, amount: 0 };
      grouped[name].count += 1;
      grouped[name].amount += parseFloat(String(e.total_amount || 0));
    });

    return Object.entries(grouped).sort((a, b) => b[1].amount - a[1].amount);
  };

  // Filter dropdowns helper lists
  let currentZoneFilter = zone;
  if (!isAdmin && (isCoordinator || isDM || isDI)) {
    currentZoneFilter = userZone;
  }

  const validFacilities = rawFacilities.filter((f) => {
    if (currentZoneFilter !== 'All' && f.zone_name !== currentZoneFilter) return false;
    if (district !== 'All' && f.district_name !== district) return false;
    return true;
  });

  const validUsers = rawUsers.filter((u) => {
    if (currentZoneFilter !== 'All' && u.zone_name !== currentZoneFilter) return false;
    if (district !== 'All' && u.district_name !== district) return false;
    return true;
  });

  const distsArray = isAdmin
    ? (currentZoneFilter !== 'All' && ZONE_DISTRICT_MAP[currentZoneFilter] ? ZONE_DISTRICT_MAP[currentZoneFilter] : Object.values(ZONE_DISTRICT_MAP).flat())
    : (isCoordinator || isDM ? ZONE_DISTRICT_MAP[userZone] || [] : (isDI ? [userDistrict] : []));

  const hospSet = Array.from(new Set(validFacilities.map((f) => f.facility_name).filter(Boolean))).sort();
  const mgrOptions = validUsers
    .filter((u) => (u.role === 'Manager' || u.role === 'Admin' || u.role === 'Superadmin') && u.full_name)
    .map((u) => ({ user_id: u.user_id, name: u.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const engMap = new Map<string, string>();
  validUsers.forEach((u) => {
    if (u.role === 'Engineer' && u.full_name) {
      if (manager !== 'All' && String(u.level_first_approver) !== String(manager)) {
        return;
      }
      engMap.set(String(u.user_id), u.full_name);
    }
  });

  // Expense stats sums
  const totalClaimedAmount = filteredExp.reduce((s, e) => s + (e.total_amount || 0), 0);
  const approvedAmount = filteredExp.filter((e) => e.status === 'Approved').reduce((s, e) => s + (e.total_amount || 0), 0);
  const pendingAmount = filteredExp.filter((e) => (e.status || '').toLowerCase().includes('pending')).reduce((s, e) => s + (e.total_amount || 0), 0);
  const rejectedAmount = filteredExp.filter((e) => e.status === 'Rejected').reduce((s, e) => s + (e.total_amount || 0), 0);

  // Team stats sums
  const teamTotalAmount = teamFilteredExp.reduce((s, e) => s + (e.total_amount || 0), 0);
  const teamApprovedAmount = teamFilteredExp.filter((e) => e.status === 'Approved').reduce((s, e) => s + (e.total_amount || 0), 0);
  const teamPendingAmount = teamFilteredExp.filter((e) => (e.status || '').toLowerCase().includes('pending')).reduce((s, e) => s + (e.total_amount || 0), 0);
  const teamRejectedAmount = teamFilteredExp.filter((e) => e.status === 'Rejected').reduce((s, e) => s + (e.total_amount || 0), 0);

  // Penalty stats sums
  const totalComplaintsCount = filteredPen.length;
  const resolvedComplaintsCount = filteredPen.filter((p) => ['resolve', 'close', 'closed'].some((x) => (p.complaint_status || '').toLowerCase().includes(x))).length;
  const activePendingComplaintsCount = totalComplaintsCount - resolvedComplaintsCount;
  const uptimePercentage = totalComplaintsCount ? ((resolvedComplaintsCount / totalComplaintsCount) * 100).toFixed(2) : '100.00';
  const totalPenaltyAmount = filteredPen.reduce((s, p) => s + (p.total_penalty || 0), 0);

  const searchedExpenses = getSearchedExpenses();
  const searchedPenalties = getSearchedPenalties();

  return (
    <>
      {isLoading && (
        <div id="loadingOverlay" style={{ display: 'flex', opacity: 1 }}>
          <div className="loader-wrapper"><div className="loader"></div></div>
          <div id="loaderText">{loaderText}</div>
        </div>
      )}

      {/* Main Container */}
      <div className="content-area">
        <header className="page-header desktop-only" style={{ padding: '0 0 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Dashboard</h1>
          </div>
          <div className="page-header-right">
            <button className="btn btn-outline" onClick={fetchDashboardData}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '6px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh Data
            </button>
            <button className="btn btn-success" onClick={exportCSV}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '6px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
          </div>
        </header>

        {/* Tab Buttons */}
        <div className="dash-tabs">
          <button className={`tab-btn ${activeTab === 'expense' ? 'active' : ''}`} onClick={() => setActiveTab('expense')}>
            <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', verticalAlign: '-2px', marginRight: '4px' }}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>
            Expense Report
          </button>
          <button className={`tab-btn ${activeTab === 'penalty' ? 'active' : ''}`} onClick={() => setActiveTab('penalty')}>
            <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', verticalAlign: '-2px', marginRight: '4px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            Penalty & Calls
          </button>
        </div>

        {/* Filters Panel */}
        <div className="filter-panel">
          <div className="filter-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            Filters & Range
          </div>
          <div className="filter-grid">
            <div className="filter-group">
              <label className="filter-label">Quick Period</label>
              <select className="filter-select" value={quickPeriod} onChange={(e) => handleQuickPeriodChange(e.target.value)}>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="month">Specific Month</option>
                <option value="0">All Time</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {quickPeriod === 'month' && (
              <>
                <div className="filter-group">
                  <label className="filter-label">Month</label>
                  <select className="filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Year</label>
                  <select className="filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>
              </>
            )}

            {quickPeriod === 'custom' && (
              <div className="filter-group" style={{ display: 'flex', flex: 2, minWidth: '300px' }}>
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <div style={{ flex: 1 }}><label className="filter-label">From Date</label><input type="date" className="filter-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div style={{ flex: 1 }}><label className="filter-label">To Date</label><input type="date" className="filter-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
              </div>
            )}

            {activeTab === 'expense' && (
              <div className="filter-group">
                <label className="filter-label">Approval Status</label>
                <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="All">All Status</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            )}
          </div>

          {isManager && (
            <div id="roleFiltersWrap">
              <div className="filter-divider"></div>
              <div className="role-filter-grid">
                {isAdmin && (
                  <div className="filter-group">
                    <label className="filter-label">Zone</label>
                    <select className="filter-select" value={zone} onChange={(e) => handleZoneChange(e.target.value)}>
                      <option value="All">All Zones</option>
                      {Object.keys(ZONE_DISTRICT_MAP).map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                )}
                {(isAdmin || isCoordinator || isDM) && (
                  <div className="filter-group">
                    <label className="filter-label">District</label>
                    <select className="filter-select" value={district} onChange={(e) => handleDistrictChange(e.target.value)}>
                      <option value="All">All Districts</option>
                      {distsArray.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
                <div className="filter-group">
                  <label className="filter-label">Facility</label>
                  <select className="filter-select" value={hospital} onChange={(e) => handleHospitalChange(e.target.value)}>
                    <option value="All">All Facilities</option>
                    {hospSet.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                {(isAdmin || isCoordinator || isDM || isDI) && (
                  <div className="filter-group">
                    <label className="filter-label">Manager</label>
                    <select className="filter-select" value={manager} onChange={(e) => handleManagerChange(e.target.value)}>
                      <option value="All">All Managers</option>
                      {mgrOptions.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="filter-group">
                  <label className="filter-label">Engineer</label>
                  <select className="filter-select" value={engineer} onChange={(e) => setEngineer(e.target.value)}>
                    <option value="All">All Engineers</option>
                    {Array.from(engMap.entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Expense Tab Render */}
        {activeTab === 'expense' && (
          <div className="tab-section active">
            {/* normal KPIs */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-header"><div className="kpi-icon blue"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div></div>
                <div className="kpi-info">
                  <div className="kpi-label">Total Claimed Amount</div>
                  <div className="kpi-value">₹{getFmtINR(totalClaimedAmount)}</div>
                  <div className="kpi-subtitle">{filteredExp.length} total claims logged</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><div className="kpi-icon green"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></div></div>
                <div className="kpi-info">
                  <div className="kpi-label">Approved Amount</div>
                  <div className="kpi-value">₹{getFmtINR(approvedAmount)}</div>
                  <div className="kpi-subtitle">{filteredExp.filter((e) => e.status === 'Approved').length} claims verified</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><div className="kpi-icon orange"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></div></div>
                <div className="kpi-info">
                  <div className="kpi-label">Pending Verification</div>
                  <div className="kpi-value">₹{getFmtINR(pendingAmount)}</div>
                  <div className="kpi-subtitle">{filteredExp.filter((e) => (e.status || '').toLowerCase().includes('pending')).length} awaiting action</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><div className="kpi-icon red"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg></div></div>
                <div className="kpi-info">
                  <div className="kpi-label">Rejected Claims</div>
                  <div className="kpi-value">₹{getFmtINR(rejectedAmount)}</div>
                  <div className="kpi-subtitle">{filteredExp.filter((e) => e.status === 'Rejected').length} declined</div>
                </div>
              </div>
            </div>

            {/* Team Expense Summary section */}
            {isManager && (
              <div style={{ marginTop: '32px', marginBottom: '32px' }}>
                <div className="filter-title" style={{ marginBottom: '16px' }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  Team Expense Summary
                </div>
                <div className="kpi-grid">
                  <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setTeamBreakdownStatus('Total')}>
                    <div className="kpi-header"><div className="kpi-icon blue"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div></div>
                    <div className="kpi-info">
                      <div className="kpi-label">Team Total Claimed</div>
                      <div className="kpi-value">₹{getFmtINR(teamTotalAmount)}</div>
                      <div className="kpi-subtitle" style={{ display: 'flex', alignItems: 'center' }}>
                        {teamFilteredExp.length} total team claims <span style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: '6px', fontSize: '12px' }}>• View Team</span>
                      </div>
                    </div>
                  </div>
                  <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setTeamBreakdownStatus('Approved')}>
                    <div className="kpi-header"><div className="kpi-icon green"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></div></div>
                    <div className="kpi-info">
                      <div className="kpi-label">Team Approved</div>
                      <div className="kpi-value">₹{getFmtINR(teamApprovedAmount)}</div>
                      <div className="kpi-subtitle" style={{ display: 'flex', alignItems: 'center' }}>
                        {teamFilteredExp.filter((e) => e.status === 'Approved').length} team claims verified <span style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: '6px', fontSize: '12px' }}>• View Team</span>
                      </div>
                    </div>
                  </div>
                  <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setTeamBreakdownStatus('Pending')}>
                    <div className="kpi-header"><div className="kpi-icon orange"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></div></div>
                    <div className="kpi-info">
                      <div className="kpi-label">Team Pending</div>
                      <div className="kpi-value">₹{getFmtINR(teamPendingAmount)}</div>
                      <div className="kpi-subtitle" style={{ display: 'flex', alignItems: 'center' }}>
                        {teamFilteredExp.filter((e) => (e.status || '').toLowerCase().includes('pending')).length} team claims awaiting <span style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: '6px', fontSize: '12px' }}>• View Team</span>
                      </div>
                    </div>
                  </div>
                  <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setTeamBreakdownStatus('Rejected')}>
                    <div className="kpi-header"><div className="kpi-icon red"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg></div></div>
                    <div className="kpi-info">
                      <div className="kpi-label">Team Rejected</div>
                      <div className="kpi-value">₹{getFmtINR(teamRejectedAmount)}</div>
                      <div className="kpi-subtitle" style={{ display: 'flex', alignItems: 'center' }}>
                        {teamFilteredExp.filter((e) => e.status === 'Rejected').length} team claims declined <span style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: '6px', fontSize: '12px' }}>• View Team</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Section */}
            <div className="charts-grid-main">
              <div className="chart-card">
                <div className="chart-header">
                  <div><div className="chart-title">Expense Trend Analysis</div><div className="chart-subtitle">Last 7 Days submission</div></div>
                  <span className="chart-badge">Total: ₹{getFmtINR(totalClaimedAmount)}</span>
                </div>
                <div className="chart-wrap"><canvas ref={expTrendRef}></canvas></div>
              </div>
              <div className="chart-card">
                <div className="chart-header"><div><div className="chart-title">Status Breakdown</div><div className="chart-subtitle">Approval distribution</div></div></div>
                <div className="chart-wrap" style={{ minHeight: '200px' }}><canvas ref={expDonutRef}></canvas></div>
                <div className="legend-list">
                  <div className="legend-item"><div className="legend-dot" style={{ background: PAL.green }}></div><span>Approved ({filteredExp.filter((e) => e.status === 'Approved').length})</span></div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: PAL.red }}></div><span>Rejected ({filteredExp.filter((e) => e.status === 'Rejected').length})</span></div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: PAL.yellow }}></div><span>Pending ({filteredExp.filter((e) => (e.status || '').toLowerCase().includes('pending')).length})</span></div>
                </div>
              </div>
            </div>

            {isManager && (
              <div className="charts-grid-2">
                <div className="chart-card">
                  <div className="chart-header"><div><div className="chart-title">Top Engineers by Claim</div><div className="chart-subtitle">Highest expense contributors</div></div></div>
                  <div className="chart-wrap"><canvas ref={expEngBarRef}></canvas></div>
                </div>
                <div className="chart-card">
                  <div className="chart-header"><div><div className="chart-title">District-wise Distribution</div><div className="chart-subtitle">Regional expense breakdown</div></div></div>
                  <div className="chart-wrap"><canvas ref={expDistRef}></canvas></div>
                </div>
              </div>
            )}

            {/* Summary Grid */}
            <div className="table-card" style={{ marginTop: '24px' }}>
              <div className="table-header"><div><div className="table-title">District Expense Summary</div></div></div>
              <div className="table-container">
                <table className="data-table summary-table">
                  <thead>
                    <tr><th>#</th><th>District</th><th>Total Claims</th><th>Approved</th><th>Pending</th><th>Approval %</th></tr>
                  </thead>
                  <tbody>
                    {expSummary.length === 0 ? (
                      <tr><td colSpan={6} className="empty-state"><div className="empty-text">No expense summary data available.</div></td></tr>
                    ) : (
                      expSummary.map((d, idx) => {
                        const pct = d.total_complaints > 0 ? ((d.resolved / d.total_complaints) * 100).toFixed(1) : '100.0';
                        return (
                          <tr key={idx}>
                            <td><div className="cell-val">{idx + 1}</div></td>
                            <td><div className="cell-val"><strong>{d.district}</strong></div></td>
                            <td><div className="cell-val">{d.total_complaints}</div></td>
                            <td><div className="cell-val">{d.resolved}</div></td>
                            <td><div className="cell-val">{d.pending}</div></td>
                            <td><div className="cell-val"><strong>{pct}%</strong></div></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Log Table */}
            <div className="table-card">
              <div className="table-header">
                <div><div className="table-title">Expense Log Records</div><div className="data-count">Showing {searchedExpenses.length} of {filteredExp.length} records</div></div>
                <div className="table-controls">
                  <select value={expLimit} onChange={(e) => setExpLimit(e.target.value)}>
                    <option value="25">25 Entries</option>
                    <option value="50">50 Entries</option>
                    <option value="100">100 Entries</option>
                    <option value="300">300 Entries</option>
                    <option value="1000">1000 Entries</option>
                    <option value="All">All Entries</option>
                  </select>
                  <div className="table-search">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input type="text" placeholder="Search by ID, Engineer, District..." value={expSearch} onChange={(e) => setExpSearch(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Exp ID</th><th>Engineer Name</th><th>Submit Date</th><th className="hide-mobile">District</th><th>Claim Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {searchedExpenses.length === 0 ? (
                      <tr><td colSpan={6} className="empty-state"><div className="empty-text">No expense records found</div></td></tr>
                    ) : (
                      searchedExpenses.map((e) => {
                        const s = e.status || '';
                        const cls = s === 'Approved' ? 'resolved' : s === 'Rejected' ? 'critical' : 'pending';
                        const lbl = s === 'Approved' ? 'Approved' : s === 'Rejected' ? 'Rejected' : 'Pending';
                        return (
                          <tr key={e.exp_id} onClick={() => setSelectedExp(e)}>
                            <td data-label="Exp ID"><div className="cell-val"><span className="id-tag">{e.exp_id || '—'}</span></div></td>
                            <td data-label="Engineer"><div className="cell-val"><strong>{e.full_name}</strong></div></td>
                            <td data-label="Date"><div className="cell-val">{getFmtDate(e.expense_date)}</div></td>
                            <td data-label="District" className="hide-mobile"><div className="cell-val">{e.user_district || '—'}</div></td>
                            <td data-label="Amount"><div className="cell-val amt-green">₹{getFmtINR(e.total_amount)}</div></td>
                            <td data-label="Status"><div className="cell-val"><span className={`status-badge ${cls}`}>{lbl}</span></div></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Penalty Tab Render */}
        {activeTab === 'penalty' && (
          <div className="tab-section active">
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-header"><div className="kpi-icon blue"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg></div></div>
                <div className="kpi-info">
                  <div className="kpi-label">Total Complaints</div>
                  <div className="kpi-value">{totalComplaintsCount}</div>
                  <div className="kpi-subtitle">Logged during period</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><div className="kpi-icon green"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></div></div>
                <div className="kpi-info">
                  <div className="kpi-label">Uptime / Resolution</div>
                  <div className="kpi-value">{uptimePercentage}%</div>
                  <div className="kpi-subtitle">System availability</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><div className="kpi-icon orange"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></div></div>
                <div className="kpi-info">
                  <div className="kpi-label">Active Pending</div>
                  <div className="kpi-value">{activePendingComplaintsCount}</div>
                  <div className="kpi-subtitle">Awaiting resolution</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><div className="kpi-icon red"><svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div></div>
                <div className="kpi-info">
                  <div className="kpi-label">Total Deductions</div>
                  <div className="kpi-value">₹{getFmtINR(totalPenaltyAmount)}</div>
                  <div className="kpi-subtitle">Cumulative financial impact</div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-grid-main">
              <div className="chart-card">
                <div className="chart-header">
                  <div><div className="chart-title">Penalty Deduction Trend</div><div className="chart-subtitle">Last 7 Days financial deductions</div></div>
                  <span className="chart-badge">Total: ₹{getFmtINR(totalPenaltyAmount)}</span>
                </div>
                <div className="chart-wrap"><canvas ref={penTrendRef}></canvas></div>
              </div>
              <div className="chart-card">
                <div className="chart-header"><div><div className="chart-title">Call Resolution Status</div><div className="chart-subtitle">Overview of closed vs pending calls</div></div></div>
                <div className="chart-wrap" style={{ minHeight: '200px' }}><canvas ref={penStatusRef}></canvas></div>
                <div className="legend-list">
                  <div className="legend-item"><div className="legend-dot" style={{ background: PAL.green }}></div><span>Resolved ({resolvedComplaintsCount})</span></div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: PAL.yellow }}></div><span>Pending ({activePendingComplaintsCount})</span></div>
                </div>
              </div>
            </div>

            <div className="charts-grid-2">
              <div className="chart-card">
                <div className="chart-header"><div><div className="chart-title">Equipment Penalties</div><div className="chart-subtitle">Top penalized machine types</div></div></div>
                <div className="chart-wrap" style={{ minHeight: '200px' }}><canvas ref={penEqpRef}></canvas></div>
              </div>
              <div className="chart-card">
                <div className="chart-header"><div><div className="chart-title">Hospital Facilities</div><div className="chart-subtitle">Top facilities by deductions</div></div></div>
                <div className="chart-wrap"><canvas ref={penHospRef}></canvas></div>
              </div>
            </div>

            {isManager && (
              <div className="charts-grid-2">
                <div className="chart-card">
                  <div className="chart-header"><div><div className="chart-title">Penalty by Engineer</div><div className="chart-subtitle">Highest deduction contributors</div></div></div>
                  <div className="chart-wrap"><canvas ref={penEngBarRef}></canvas></div>
                </div>
                <div className="chart-card">
                  <div className="chart-header"><div><div className="chart-title">District-wise Penalties</div><div className="chart-subtitle">Regional impact analysis</div></div></div>
                  <div className="chart-wrap"><canvas ref={penDistRef}></canvas></div>
                </div>
              </div>
            )}

            {/* Summaries */}
            <div className="table-card" style={{ marginTop: '24px' }}>
              <div className="table-header"><div><div className="table-title">District Complaint Summary</div></div></div>
              <div className="table-container">
                <table className="data-table summary-table">
                  <thead>
                    <tr><th>#</th><th>District</th><th>Total Complaints</th><th>Resolved</th><th>Pending</th><th>Resolution %</th></tr>
                  </thead>
                  <tbody>
                    {penSummary.length === 0 ? (
                      <tr><td colSpan={6} className="empty-state"><div className="empty-text">No complaint summary data available.</div></td></tr>
                    ) : (
                      penSummary.map((d, idx) => {
                        const pct = d.total_complaints > 0 ? ((d.resolved / d.total_complaints) * 100).toFixed(1) : '100.0';
                        return (
                          <tr key={idx}>
                            <td><div className="cell-val">{idx + 1}</div></td>
                            <td><div className="cell-val"><strong>{d.district}</strong></div></td>
                            <td><div className="cell-val">{d.total_complaints}</div></td>
                            <td><div className="cell-val">{d.resolved}</div></td>
                            <td><div className="cell-val">{d.pending}</div></td>
                            <td><div className="cell-val"><strong>{pct}%</strong></div></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="table-card">
              <div className="table-header"><div><div className="table-title">District Penalty Summary</div></div></div>
              <div className="table-container">
                <table className="data-table summary-table">
                  <thead>
                    <tr><th>#</th><th>District</th><th>Attend Penalty</th><th>Close Penalty</th><th>Total Deduction</th></tr>
                  </thead>
                  <tbody>
                    {penSummary.length === 0 ? (
                      <tr><td colSpan={5} className="empty-state"><div className="empty-text">No penalty summary data available.</div></td></tr>
                    ) : (
                      penSummary.map((d, idx) => (
                        <tr key={idx}>
                          <td><div className="cell-val">{idx + 1}</div></td>
                          <td><div className="cell-val"><strong>{d.district}</strong></div></td>
                          <td><div className="cell-val amt-yellow">₹{getFmtINR(d.attend_penalty)}</div></td>
                          <td><div className="cell-val amt-yellow">₹{getFmtINR(d.close_penalty)}</div></td>
                          <td><div className="cell-val amt-red">₹{getFmtINR(d.total_penalty)}</div></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Complaint Records Table */}
            <div className="table-card">
              <div className="table-header">
                <div><div className="table-title">Complaint & Penalty Records</div><div className="data-count">Showing {searchedPenalties.length} of {filteredPen.length} records</div></div>
                <div className="table-controls">
                  <select value={penLimit} onChange={(e) => setPenLimit(e.target.value)}>
                    <option value="25">25 Entries</option>
                    <option value="50">50 Entries</option>
                    <option value="100">100 Entries</option>
                    <option value="300">300 Entries</option>
                    <option value="1000">1000 Entries</option>
                    <option value="All">All Entries</option>
                  </select>
                  <div className="table-search">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input type="text" placeholder="Search ID, Facility, Equipment..." value={penSearch} onChange={(e) => setPenSearch(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Call ID</th><th className="hide-mobile">Facility Name</th><th className="hide-mobile">Equipment</th><th className="hide-mobile">Raise Date</th><th>Att. Pen.</th><th>Close Pen.</th><th>Total Deduction</th></tr>
                  </thead>
                  <tbody>
                    {searchedPenalties.length === 0 ? (
                      <tr><td colSpan={7} className="empty-state"><div className="empty-text">No complaint records found</div></td></tr>
                    ) : (
                      searchedPenalties.map((p) => (
                        <tr key={p.id} onClick={() => setSelectedPen(p)}>
                          <td data-label="Call ID"><div className="cell-val"><span className="id-tag">{p.complaint_id || '—'}</span></div></td>
                          <td data-label="Facility" className="hide-mobile"><div className="cell-val" style={{ textAlign: 'right' }}><strong>{p.hospital_name}</strong><br /><span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{p.district_name || p.facility_district || ''}</span></div></td>
                          <td data-label="Equipment" className="hide-mobile"><div className="cell-val">{p.equipment_name || '—'}</div></td>
                          <td data-label="Raise Date" className="hide-mobile"><div className="cell-val">{p.complaint_raise_date}</div></td>
                          <td data-label="Att. Pen."><div className="cell-val amt-yellow">₹{getFmtINR(p.attend_penalty)}</div></td>
                          <td data-label="Close Pen."><div className="cell-val amt-yellow">₹{getFmtINR(p.penalty)}</div></td>
                          <td data-label="Total Deduction"><div className="cell-val amt-red">₹{getFmtINR(p.total_penalty)}</div></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL OVERLAYS */}
      {/* 1. Penalty Details Modal */}
      {selectedPen && (
        <div className="modal-overlay-custom active" onClick={() => setSelectedPen(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">📋 Comprehensive Call Details</div>
              <button className="modal-close" onClick={() => setSelectedPen(null)}>✕</button>
            </div>
            <div className="modal-grid">
              <div className="modal-field full"><label>Complaint ID</label><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-dark)' }}>{selectedPen.complaint_id || '—'}</p></div>
              <div className="modal-field"><label>District Location</label><p>{selectedPen.district_name || selectedPen.facility_district || '—'}</p></div>
              <div className="modal-field"><label>Resolution Status</label><p>{selectedPen.complaint_status || '—'}</p></div>
              <div className="modal-field full"><label>Hospital / Healthcare Facility</label><p>{selectedPen.hospital_name || '—'}</p></div>
              <div className="modal-field full"><label>Impacted Equipment</label><p>{selectedPen.equipment_name || '—'} {selectedPen.bar_code ? <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>({selectedPen.bar_code})</span> : ''}</p></div>
              <div className="modal-field"><label>Raised On</label><p>{selectedPen.complaint_raise_date || '—'}</p></div>
              <div className="modal-field"><label>Attended On</label><p>{selectedPen.attend_date || '—'}</p></div>
              <div className="modal-field full"><label>Attending Engineer</label><p>{getEngName(selectedPen.attend_engineer_id)}</p></div>
              <div className="modal-field"><label>Attendance Deduction</label><p style={{ color: 'var(--warning)' }}>₹{getFmtINR(selectedPen.attend_penalty)}</p></div>
              <div className="modal-field"><label>Closed On</label><p>{selectedPen.complaint_close_date || '⏳ Action Pending'}</p></div>
              <div className="modal-field full"><label>Closing Engineer</label><p>{getEngName(selectedPen.close_engineer_id)}</p></div>
              <div className="modal-field"><label>Closure Deduction</label><p style={{ color: 'var(--warning)' }}>₹{getFmtINR(selectedPen.penalty)}</p></div>
              <div className="modal-field full"><label>Cumulative Portal Penalty</label><p className="total-penalty-val">₹{getFmtINR(selectedPen.total_penalty)}</p></div>
            </div>
            <button className="modal-btn" onClick={() => setSelectedPen(null)}>Acknowledge & Close</button>
          </div>
        </div>
      )}

      {/* 2. Expense Details Modal */}
      {selectedExp && (
        <div className="modal-overlay-custom active" onClick={() => setSelectedExp(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">💸 Expense Claim Details</div>
              <button className="modal-close" onClick={() => setSelectedExp(null)}>✕</button>
            </div>
            <div className="modal-grid">
              <div className="modal-field full"><label>System Expense ID</label><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-dark)' }}>{selectedExp.exp_id || '—'}</p></div>
              <div className="modal-field"><label>Claim Date</label><p>{getFmtDate(selectedExp.expense_date)}</p></div>
              <div className="modal-field"><label>Approval Status</label><p>{selectedExp.status || '—'}</p></div>
              <div className="modal-field full"><label>Submitting Engineer</label><p>{selectedExp.full_name || userName}</p></div>
              <div className="modal-field"><label>Operations Zone</label><p>{selectedExp.zone_name || '—'}</p></div>
              <div className="modal-field"><label>Operating District</label><p>{selectedExp.user_district || '—'}</p></div>
              <div className="modal-field"><label>Distance Traveled</label><p>{selectedExp.total_km || 0} km</p></div>
              <div className="modal-field"><label>Primary Approver</label><p>{selectedExp.level_first_approver || '—'}</p></div>
              <div className="modal-field full"><label>Total Claim Value</label><p className="total-penalty-val" style={{ color: 'var(--success)', background: 'var(--success-light)', borderColor: 'rgba(16,185,129,.2)' }}>₹{getFmtINR(selectedExp.total_amount)}</p></div>
            </div>
            <button className="modal-btn" onClick={() => setSelectedExp(null)}>Acknowledge & Close</button>
          </div>
        </div>
      )}

      {/* 3. Team Breakdown Modal */}
      {teamBreakdownStatus && (
        <div className="modal-overlay-custom active" onClick={() => setTeamBreakdownStatus(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">👥 Team Breakdown - {teamBreakdownStatus} Claims</div>
              <button className="modal-close" onClick={() => setTeamBreakdownStatus(null)}>✕</button>
            </div>
            <div className="table-container">
              <table className="data-table summary-table" style={{ minWidth: '100%' }}>
                <thead>
                  <tr><th>#</th><th style={{ textAlign: 'left' }}>Engineer Name</th><th>Total Claims</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {getTeamBreakdownData().length === 0 ? (
                    <tr><td colSpan={4} className="empty-state"><div className="empty-text">No team data found for this status.</div></td></tr>
                  ) : (
                    getTeamBreakdownData().map(([name, stats]: any, i) => (
                      <tr key={name}>
                        <td>{i + 1}</td>
                        <td style={{ textAlign: 'left' }}><strong>{name}</strong></td>
                        <td>{stats.count}</td>
                        <td style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{getFmtINR(stats.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <button className="modal-btn" style={{ marginTop: '24px' }} onClick={() => setTeamBreakdownStatus(null)}>Close Breakdown</button>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM */}
      <div className="toast-container">
        {toasts.map((t) => {
          const colors: Record<string, string> = { success: 'var(--success)', danger: 'var(--danger)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' };
          return (
            <div
              key={t.id}
              style={{
                background: 'white',
                color: colors[t.type] || colors.info,
                padding: '14px 20px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: 'var(--shadow-md)',
                borderLeft: `4px solid ${colors[t.type] || colors.info}`,
                pointerEvents: 'auto'
              }}
            >
              {t.msg}
            </div>
          );
        })}
      </div>
    </>
  );
}
