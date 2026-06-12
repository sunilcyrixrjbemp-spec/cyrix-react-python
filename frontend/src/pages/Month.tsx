import React, { useState, useEffect } from 'react';
import '../css/style.css';

interface EngineerSummary {
  user_id: string;
  full_name: string;
  e_code: string;
  designation: string;
  grade: string;
  district_name: string;
  mobile_number: string;
  mobile?: string;
  expense_count: number;
  da_amount: number;
  hotel_amount: number;
  local_purchase_amount: number;
  other_expense_amount: number;
  travel_amount: number;
  total_km: number;
  total_amount: number;
  l1_name?: string;
  l2_name?: string;
  project?: string;
  zone_name?: string;
  manager_id?: string;
}

interface Itinerary {
  itinerary_id: number;
  leg_number: number;
  from_location: string;
  to_location: string;
  from_district: string;
  to_district: string;
  travel_mode: string;
  sub_mode: string;
  sub_km: number;
  distance_km: number;
  travel_amount: number;
  sub_amount: number;
  visit_purpose: string;
  working_district: string;
  da_amount: number;
  hotel_amount: number;
  other_desc: string;
  other_amount: number;
  calls_assigned: number;
  calls_completed: number;
  pms_count: number;
  asset_tagging: string;
  ws_pms?: number;
  service_report?: string;
  remarks?: string;
  attachments: {
    attachment_id: number;
    url: string;
    bill_type: string;
  }[];
}

interface ExpenseDetail {
  expense_id: string;
  user_id: string;
  full_name: string;
  e_code: string;
  grade: string;
  designation: string;
  district_name: string;
  mobile_number: string;
  mobile?: string;
  l1_name: string;
  l2_name: string;
  expense_date: string;
  da_amount: number;
  hotel_amount: number;
  local_purchase_desc: string;
  local_purchase_amount: number;
  other_expense_desc: string;
  other_expense_amount: number;
  visit_purpose: string;
  calls_assigned: number;
  calls_completed: number;
  pms_count: number;
  asset_tagging: string;
  total_amount: number;
  status: string;
  level_first_approver: string;
  level_second_approver: string;
  itineraries: Itinerary[];
  expense_attachments: {
    attachment_id: number;
    url: string;
    bill_type: string;
  }[];
  level_first_approver_time?: string;
  level_second_approver_time?: string;
  reject_reason?: string;
}

interface Toast {
  id: number;
  msg: string;
  type: string;
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ACCOUNTANT_NAME = 'Amit Rawat';
const PER_PAGE = 20;

const MODE_MAP: Record<string, string> = { Train: 'T', Bus: 'B', Bike: 'Bi', Car: 'C', Metro: 'M', Auto: 'A', Flight: 'FL' };

export default function Month() {
  const [allData, setAllData] = useState<EngineerSummary[]>([]);
  const [filteredData, setFilteredData] = useState<EngineerSummary[]>([]);
  const [selectedEngineers, setSelectedEngineers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    return String(new Date().getMonth() + 1);
  });
  const [filterYear, setFilterYear] = useState<string>(() => {
    return String(new Date().getFullYear());
  });
  const [filterZone, setFilterZone] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterManager, setFilterManager] = useState('All');
  const [filterEngineer, setFilterEngineer] = useState('All');
  const [rawUsers, setRawUsers] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState('Loading Month Summary...');

  // Panel State
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelEng, setPanelEng] = useState<EngineerSummary | null>(null);
  const [panelExpenses, setPanelExpenses] = useState<ExpenseDetail[]>([]);

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Print state
  const [printContent, setPrintContent] = useState<string>('');

  const currentUserId = localStorage.getItem('logged_in_user_id') || localStorage.getItem('user_id') || '';

  const showToast = (msg: string, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadData = async () => {
    setIsLoading(true);
    setLoaderText('Loading approved expenses...');
    setSelectedEngineers(new Set());

    try {
      const params = new URLSearchParams({ user_id: currentUserId, status: 'Approved' });
      if (filterMonth) params.append('month', filterMonth);
      if (filterYear) params.append('year', filterYear);

      const res = await fetch(`/api/month/summary?${params}`);
      const data = await res.json();

      if (!res.ok || data.success === false) {
        showToast(data.message || 'Failed to load data.', 'error');
        setAllData([]);
      } else {
        const list: EngineerSummary[] = data.engineers || [];
        setAllData(list);
      }
    } catch (e) {
      console.error('[loadData]', e);
      showToast('Connection error. Check network or backend.', 'error');
      setAllData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserId) {
      loadData();
    }
  }, [currentUserId]);

  // Load raw users for name resolution in dropdown filters
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/dashboard/filters');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setRawUsers(data.users || []);
          }
        }
      } catch (e) {
        console.error('Error fetching filter users:', e);
      }
    };
    fetchUsers();
  }, []);

  // Apply local filtering
  useEffect(() => {
    const searchQ = searchInput.toLowerCase().trim();

    const filtered = allData.filter((eng) => {
      const matchZone = filterZone === 'All' || eng.zone_name === filterZone;
      const matchDist = filterDistrict === 'All' || eng.district_name === filterDistrict;
      const matchMgr  = filterManager === 'All' || eng.manager_id === filterManager;
      const matchEng  = filterEngineer === 'All' || eng.user_id === filterEngineer;
      
      const matchSrch = !searchQ || 
        (eng.full_name || '').toLowerCase().includes(searchQ) || 
        (eng.e_code || '').toLowerCase().includes(searchQ) || 
        (eng.district_name || '').toLowerCase().includes(searchQ);
        
      return matchZone && matchDist && matchMgr && matchEng && matchSrch;
    });

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [allData, filterZone, filterDistrict, filterManager, filterEngineer, searchInput]);

  const handleZoneChange = (z: string) => {
    setFilterZone(z);
    setFilterDistrict('All');
    setFilterManager('All');
    setFilterEngineer('All');
  };

  const handleDistrictChange = (d: string) => {
    setFilterDistrict(d);
    setFilterManager('All');
    setFilterEngineer('All');
  };

  const handleManagerChange = (m: string) => {
    setFilterManager(m);
    setFilterEngineer('All');
  };

  const clearFilters = () => {
    setFilterZone('All');
    setFilterDistrict('All');
    setFilterManager('All');
    setFilterEngineer('All');
    setSearchInput('');
    loadData();
  };

  // Stats calculation
  const totalEngineers = filteredData.length;
  const totalApprovedClaims = filteredData.reduce((s, e) => s + (e.expense_count || 0), 0);
  const totalAmount = filteredData.reduce((s, e) => s + (e.total_amount || 0), 0);
  const totalKm = filteredData.reduce((s, e) => s + (e.total_km || 0), 0);

  // Pagination helper
  const totalPages = Math.ceil(filteredData.length / PER_PAGE) || 1;
  const pageData = filteredData.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const toggleRow = (uid: string) => {
    setSelectedEngineers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const masterToggle = () => {
    const visibleUids = pageData.map((e) => e.user_id);
    const allSelected = visibleUids.every((uid) => selectedEngineers.has(uid));

    setSelectedEngineers((prev) => {
      const next = new Set(prev);
      visibleUids.forEach((uid) => {
        if (allSelected) {
          next.delete(uid);
        } else {
          next.add(uid);
        }
      });
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEngineers.size === filteredData.length) {
      setSelectedEngineers(new Set());
    } else {
      setSelectedEngineers(new Set(filteredData.map((e) => e.user_id)));
    }
  };

  const openPanel = async (uid: string) => {
    const eng = allData.find((e) => e.user_id === uid);
    if (!eng) return;
    setPanelEng(eng);
    setPanelExpenses([]);
    setPanelOpen(true);
    setPanelLoading(true);

    try {
      const params = new URLSearchParams({ user_id: currentUserId, engineer_id: uid, status: 'Approved' });
      if (filterMonth) params.append('month', filterMonth);
      if (filterYear) params.append('year', filterYear);

      const res = await fetch(`/api/month/detail?${params}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setPanelExpenses(data.expenses || []);
      } else {
        showToast(data.message || 'Failed to load details.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error loading details.', 'error');
    } finally {
      setPanelLoading(false);
    }
  };

  // Helper date formatting
  const formatDate = (str: string) => {
    if (!str) return '—';
    try {
      return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return str;
    }
  };

  const getPrintDate = () => {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  };

  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const inWords = (n: number): string => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
    };
    return inWords(num);
  };

  // Build the print structure
  const buildFormHTML = (eng: EngineerSummary, expenses: ExpenseDetail[]) => {
    const monthLabel = filterMonth ? MONTHS[parseInt(filterMonth)] : '';
    const monthYear = `${monthLabel}-${filterYear}`;
    const printDate = getPrintDate();

    const firstExp = expenses[0] || {};
    const l1Name = firstExp.l1_name || eng.l1_name || 'L1 Manager';
    const l2Name = firstExp.l2_name || eng.l2_name || 'L2 Manager';

    let allLegs: (Itinerary & { expense_date: string; exp_district: string })[] = [];
    let totalTA = 0;
    let totalAuto = 0;
    let totalDA = 0;
    let totalHotel = 0;
    let totalOther = 0;
    let totalLegKm = 0;
    let grandTotal = 0;

    expenses.forEach((exp) => {
      (exp.itineraries || []).forEach((leg) => {
        allLegs.push({ ...leg, expense_date: exp.expense_date, exp_district: exp.district_name });
        totalTA += parseFloat(String(leg.travel_amount || 0));
        totalAuto += parseFloat(String(leg.sub_amount || 0));
        totalLegKm += parseFloat(String(leg.distance_km || 0));
      });
      totalDA += parseFloat(String(exp.da_amount || 0));
      totalHotel += parseFloat(String(exp.hotel_amount || 0));
      totalOther += parseFloat(String(exp.other_expense_amount || 0));
      grandTotal += parseFloat(String(exp.total_amount || 0));
    });

    let rowsHTML = '';
    allLegs.forEach((leg) => {
      const ta = parseFloat(String(leg.travel_amount || 0));
      const sub = parseFloat(String(leg.sub_amount || 0));
      const km = parseFloat(String(leg.distance_km || 0));
      const da = parseFloat(String(leg.da_amount || 0));
      const hotel = parseFloat(String(leg.hotel_amount || 0));
      const other = parseFloat(String(leg.other_amount || 0));
      const mode = leg.travel_mode || '';
      const modeAbbr = MODE_MAP[mode] || mode;
      const rowTotal = ta + sub + da + hotel + other;
      const isBikeOrCar = mode === 'Bike' || mode === 'Car';

      rowsHTML += `<tr class="data-row">
        <td class="tc">${formatDate(leg.expense_date)}</td>
        <td class="tl">${leg.from_location || '—'}</td>
        <td class="tl">${leg.to_location || '—'}</td>
        <td class="tc">${leg.from_district || leg.exp_district || '—'}</td>
        <td class="tc fw9">${modeAbbr}</td>
        <td class="tc">${km > 0 ? km.toFixed(1) : ''}</td>
        <td class="tr">${(!isBikeOrCar && ta > 0) ? '₹' + ta.toFixed(0) : ''}</td>
        <td class="tr">${sub > 0 ? '₹' + sub.toFixed(0) : ''}</td>
        <td class="tr">${da > 0 ? '₹' + da.toFixed(0) : ''}</td>
        <td class="tc">${leg.ws_pms || ''}</td>
        <td class="tr">${hotel > 0 ? '₹' + hotel.toFixed(0) : ''}</td>
        <td class="tl">${leg.other_desc || ''}</td>
        <td class="tr">${other > 0 ? '₹' + other.toFixed(0) : ''}</td>
        <td class="tr fw9">₹${rowTotal.toFixed(0)}</td>
        <td class="tl">${leg.visit_purpose || ''}</td>
        <td class="tc">${leg.asset_tagging || ''}</td>
        <td class="tc">${leg.service_report || ''}</td>
        <td class="tl" style="font-size:7pt;">${leg.remarks || ''}</td>
      </tr>`;
    });

    // Totals row
    rowsHTML += `<tr class="total-row">
      <td class="fw9 tc" colspan="5">TOTAL EXPENSE CLAIMED</td>
      <td class="tc fw9">${totalLegKm.toFixed(1)}</td>
      <td class="tr fw9">₹${totalTA.toFixed(0)}</td>
      <td class="tr fw9">₹${totalAuto.toFixed(0)}</td>
      <td class="tr fw9">₹${totalDA.toFixed(0)}</td>
      <td></td>
      <td class="tr fw9">₹${totalHotel.toFixed(0)}</td>
      <td>Other</td>
      <td class="tr fw9">₹${totalOther.toFixed(0)}</td>
      <td class="tr fw9 grand">₹${grandTotal.toFixed(2)}</td>
      <td colspan="4"></td>
    </tr>`;

    rowsHTML += `<tr class="awords-row"><td colspan="5" class="fw8">Advances:</td><td colspan="9" class="tr">—</td><td colspan="4"></td></tr>`;
    rowsHTML += `<tr class="net-row"><td colspan="5" class="fw9">NET PAYABLE</td><td colspan="8"></td><td class="tr fw9 grand">₹${grandTotal.toFixed(2)}</td><td colspan="4"></td></tr>`;
    rowsHTML += `<tr class="awords-row"><td colspan="3" class="fw8">Amount in words:</td><td colspan="15" style="font-style:italic;">Rupees ${numberToWords(Math.round(grandTotal))} Only</td></tr>`;

    return `<div class="cyrix-form">
      <table style="margin-bottom:0;">
        <tr><td colspan="18" class="hdr-main">CYRIX HEALTHCARE — EXPENSES REIMBURSEMENT FORM</td></tr>
        <tr>
          <td colspan="10" class="hdr-sub">MONTHLY EXPENSE STATEMENT</td>
          <td colspan="4" class="hdr-info">Month-Year:</td>
          <td colspan="4" class="hdr-info-val">${monthYear}</td>
        </tr>
        <tr>
          <td colspan="18" style="border:1.5px solid #1a1a2e;padding:3px 8px;font-size:7.5pt;font-weight:700;color:#333;">Generated: ${printDate}</td>
        </tr>
        <tr>
          <td colspan="1" class="hdr-info">NAME:</td>
          <td colspan="3" class="hdr-info-val">${eng.full_name || ''}</td>
          <td colspan="1" class="hdr-info">EE-CODE:</td>
          <td colspan="2" class="hdr-info-val">${eng.e_code || ''}</td>
          <td colspan="1" class="hdr-info">PROJECT:</td>
          <td colspan="2" class="hdr-info-val">${eng.project || 'RJBEMP'}</td>
          <td colspan="2" class="hdr-info">BASE LOCATION:</td>
          <td colspan="2" class="hdr-info-val">${eng.district_name || ''}</td>
          <td colspan="1" class="hdr-info">GRADE:</td>
          <td colspan="1" class="hdr-info-val">${eng.grade || ''}</td>
          <td colspan="1" class="hdr-info">MOBILE:</td>
          <td colspan="1" class="hdr-info-val">${eng.mobile_number || eng.mobile || ''}</td>
        </tr>
      </table>
      <table style="margin-top:-1px;">
        <colgroup>
          <col style="width:6.5%"/>
          <col style="width:8.5%"/>
          <col style="width:8.5%"/>
          <col style="width:6%"/>
          <col style="width:3.5%"/>
          <col style="width:4%"/>
          <col style="width:4.5%"/>
          <col style="width:4%"/>
          <col style="width:3.8%"/>
          <col style="width:3.8%"/>
          <col style="width:4.2%"/>
          <col style="width:5.5%"/>
          <col style="width:4.5%"/>
          <col style="width:5%"/>
          <col style="width:8%"/>
          <col style="width:5.5%"/>
          <col style="width:4.5%"/>
          <col style="width:10%"/>
        </colgroup>
        <thead>
          <tr>
            <th class="col-hdr" rowspan="2">Date</th>
            <th class="col-hdr" colspan="2">Locations</th>
            <th class="col-hdr" rowspan="2">Worked<br/>District</th>
            <th class="col-hdr" rowspan="2">Mode</th>
            <th class="col-hdr" rowspan="2">Dist.<br/>(KM)</th>
            <th class="col-hdr" rowspan="2">TA Amt</th>
            <th class="col-hdr" rowspan="2">Auto<br/>Fare</th>
            <th class="col-hdr" rowspan="2">D.A.</th>
            <th class="col-hdr" rowspan="2">LSP<br/>Rate</th>
            <th class="col-hdr" rowspan="2">Hotel</th>
            <th class="col-hdr" colspan="2">Other Expenses</th>
            <th class="col-hdr" rowspan="2">Total</th>
            <th class="col-hdr" rowspan="2">Purpose of Visit</th>
            <th class="col-hdr" rowspan="2">Barcode /<br/>Asset No.</th>
            <th class="col-hdr" rowspan="2">Svc Rpt<br/>No.</th>
            <th class="col-hdr" rowspan="2">Remarks</th>
          </tr>
          <tr>
            <th class="col-hdr">From</th>
            <th class="col-hdr">To</th>
            <th class="col-hdr">Description</th>
            <th class="col-hdr">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
      <table style="margin-top:-1px;">
        <tr class="approved-strip"><td colspan="18">✅ REMARKS: APPROVED &nbsp;|&nbsp; Verified &amp; Cleared for Payment &nbsp;|&nbsp; Date: ${printDate}</td></tr>
      </table>
      <table style="margin-top:-1px;">
        <thead>
          <tr class="sig-hdr">
            <td colspan="18" class="tc" style="font-size:9pt;letter-spacing:0.3px;">AUTHORIZATION &amp; SIGNATURES</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="4" class="sig-cell" style="width:25%;">
              <div class="sig-title">Claimed By:</div>
              <div style="height:40px;"></div>
              <div class="sig-line"></div>
              <div class="sig-name">${eng.full_name || ''}</div>
              <div class="sig-date">Date: ${printDate}</div>
            </td>
            <td colspan="5" class="sig-cell" style="width:30%;">
              <div class="sig-title">Approved By:</div>
              <div style="height:40px;"></div>
              <div class="sig-line"></div>
              <div class="sig-name">${l1Name}</div>
              <div class="sig-date">Date: ${printDate}</div>
            </td>
            <td colspan="5" class="sig-cell" style="width:30%;">
              <div class="sig-title">Checked By:</div>
              <div style="height:40px;"></div>
              <div class="sig-line"></div>
              <div class="sig-name">${l2Name}</div>
              <div class="sig-date">Date: ${printDate}</div>
            </td>
            <td colspan="4" class="sig-cell" style="width:15%;">
              <div class="sig-title">Accounted By:</div>
              <div style="height:40px;"></div>
              <div class="sig-line"></div>
              <div class="sig-name">${ACCOUNTANT_NAME}</div>
              <div class="sig-date">Date: ${printDate}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;
  };

  const buildAttachmentPages = (expenses: ExpenseDetail[]) => {
    let attachmentHTML = '';
    let attCount = 0;

    expenses.forEach((exp) => {
      (exp.itineraries || []).forEach((leg) => {
        (leg.attachments || []).forEach((att) => {
          attCount++;
          const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url || '');
          const billType = (att.bill_type || 'Bill').replace(/_/g, ' ');

          attachmentHTML += `
          <div class="attachment-page">
            <div class="attachment-header">📎 BILL / RECEIPT #${attCount} · ${billType}</div>
            <div class="attachment-container">
              ${isImg ? `<img src="${att.url}" class="attachment-image" alt="${billType}" style="max-width:95vw; max-height:90vh; object-fit:contain; width:auto; height:auto;" />`
                      : `<div style="text-align:center;color:#999;padding:20px;"><div style="font-size:48px;margin-bottom:10px;">📄</div><div style="font-size:11pt;font-weight:600;">${billType}</div><div style="font-size:9pt;color:#ccc;margin-top:5px;">Document Attachment</div></div>`}
            </div>
          </div>`;
        });
      });
    });

    return attachmentHTML;
  };

  const downloadEngineerPDF = async (uid: string) => {
    const eng = allData.find((e) => e.user_id === uid);
    if (!eng) return showToast('Engineer not found', 'error');

    setIsLoading(true);
    setLoaderText(`Generating PDF for ${eng.full_name}...`);

    try {
      const params = new URLSearchParams({ user_id: currentUserId, engineer_id: uid, status: 'Approved' });
      if (filterMonth) params.append('month', filterMonth);
      if (filterYear) params.append('year', filterYear);

      let expenses: ExpenseDetail[] = [];
      try {
        const res = await fetch(`/api/month/detail?${params}`);
        const data = await res.json();
        if (data.success) expenses = data.expenses || [];
      } catch (e) {
        console.warn('detail fetch failed', e);
      }

      const formHTML = buildFormHTML(eng, expenses);
      const attachmentHTML = buildAttachmentPages(expenses);

      setPrintContent(formHTML + attachmentHTML);

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setPrintContent('');
        }, 1200);
      }, 350);

    } catch (e) {
      showToast('Error generating PDF', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const bulkDownloadPDFIndividual = async () => {
    if (selectedEngineers.size === 0) return showToast('Please select engineers first', 'warning');
    
    setIsLoading(true);
    setLoaderText(`Preparing ${selectedEngineers.size} PDFs for download...`);

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      const uids = Array.from(selectedEngineers);
      for (let index = 0; index < uids.length; index++) {
        const uid = uids[index];
        const eng = allData.find((e) => e.user_id === uid);
        if (!eng) continue;

        let expenses: ExpenseDetail[] = [];
        try {
          const params = new URLSearchParams({ user_id: currentUserId, engineer_id: uid, status: 'Approved' });
          if (filterMonth) params.append('month', filterMonth);
          if (filterYear) params.append('year', filterYear);

          const res = await fetch(`/api/month/detail?${params}`);
          const data = await res.json();
          if (data.success) expenses = data.expenses || [];
        } catch (e) {
          console.warn(e);
        }

        const formHTML = buildFormHTML(eng, expenses);
        const attachmentHTML = buildAttachmentPages(expenses);

        setPrintContent(formHTML + attachmentHTML);

        await delay(250);
        window.print();
        await delay(800);
        setPrintContent('');

        // Wait another 1 second before the next print dialog triggers
        if (index < uids.length - 1) {
          await delay(1000);
        }
      }
      showToast(`${selectedEngineers.size} PDFs generated.`, 'success');
    } catch (e) {
      showToast('Error preparing bulk PDFs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAllPDF = async () => {
    if (filteredData.length === 0) return showToast('No data to download', 'warning');
    const allUids = new Set(filteredData.map((e) => e.user_id));
    setSelectedEngineers(allUids);
    
    // Trigger bulk download directly
    showLoaderTextAndTrigger(allUids);
  };

  const showLoaderTextAndTrigger = async (uids: Set<string>) => {
    setIsLoading(true);
    setLoaderText(`Preparing ${uids.size} PDFs for download...`);
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      const uidsArray = Array.from(uids);
      for (let index = 0; index < uidsArray.length; index++) {
        const uid = uidsArray[index];
        const eng = allData.find((e) => e.user_id === uid);
        if (!eng) continue;

        let expenses: ExpenseDetail[] = [];
        try {
          const params = new URLSearchParams({ user_id: currentUserId, engineer_id: uid, status: 'Approved' });
          if (filterMonth) params.append('month', filterMonth);
          if (filterYear) params.append('year', filterYear);

          const res = await fetch(`/api/month/detail?${params}`);
          const data = await res.json();
          if (data.success) expenses = data.expenses || [];
        } catch (e) {
          console.warn(e);
        }

        const formHTML = buildFormHTML(eng, expenses);
        const attachmentHTML = buildAttachmentPages(expenses);

        setPrintContent(formHTML + attachmentHTML);

        await delay(250);
        window.print();
        await delay(800);
        setPrintContent('');

        if (index < uidsArray.length - 1) {
          await delay(1000);
        }
      }
      showToast(`${uids.size} PDFs generated.`, 'success');
    } catch (e) {
      showToast('Error preparing bulk PDFs', 'error');
    } finally {
      setIsLoading(false);
      setSelectedEngineers(new Set());
    }
  };

  const getManagerName = (managerId: string) => {
    if (!managerId) return '—';
    const u = rawUsers.find((x) => String(x.user_id) === String(managerId));
    return u ? u.full_name : managerId;
  };

  const availableZones = Array.from(new Set(allData.map((e) => e.zone_name).filter((x): x is string => !!x))).sort();

  const availableDistricts = Array.from(
    new Set(
      allData
        .filter((e) => filterZone === 'All' || e.zone_name === filterZone)
        .map((e) => e.district_name)
        .filter((x): x is string => !!x)
    )
  ).sort();

  const availableManagers = Array.from(
    new Set(
      allData
        .filter((e) => {
          const matchZone = filterZone === 'All' || e.zone_name === filterZone;
          const matchDist = filterDistrict === 'All' || e.district_name === filterDistrict;
          return matchZone && matchDist;
        })
        .map((e) => e.manager_id)
        .filter((x): x is string => !!x)
    )
  ).sort();

  const managerOptions = availableManagers.map((mid) => {
    return { manager_id: mid, name: getManagerName(mid) };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const availableEngineers = Array.from(
    new Set(
      allData
        .filter((e) => {
          const matchZone = filterZone === 'All' || e.zone_name === filterZone;
          const matchDist = filterDistrict === 'All' || e.district_name === filterDistrict;
          const matchMgr  = filterManager === 'All' || e.manager_id === filterManager;
          return matchZone && matchDist && matchMgr;
        })
        .map((e) => e.user_id)
        .filter((x): x is string => !!x)
    )
  );

  const engineerOptions = availableEngineers.map((uid) => {
    const eng = allData.find((e) => e.user_id === uid);
    return { user_id: uid, name: eng ? `${eng.full_name} (${eng.e_code})` : uid };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {/* Dynamic Embedded Styles to preserve Landscape A4 Print styles */}
      <style>{`
        #printArea { display: none; }
        .cyrix-form {
          font-family: 'Arial', sans-serif;
          color: #000;
          width: 100%;
          background: #fff;
          font-size: 9pt;
          line-height: 1.35;
        }
        .cyrix-form * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box;
        }
        .cyrix-form table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .cyrix-form td, .cyrix-form th {
          border: 1.5px solid #1a1a2e;
          padding: 5px;
          vertical-align: middle;
          font-size: 8pt;
          font-weight: 500;
          color: #000;
          word-wrap: break-word;
          overflow-wrap: break-word;
          word-break: break-word;
        }
        .hdr-main {
          background: #002b5e !important;
          color: #fff !important;
          text-align: center;
          font-size: 13pt !important;
          font-weight: 900 !important;
          padding: 10px 8px !important;
          letter-spacing: 1px;
          border: 2px solid #001a3e !important;
        }
        .hdr-sub {
          background: #1e40af !important;
          color: #fff !important;
          text-align: center;
          font-size: 9pt !important;
          font-weight: 800 !important;
          padding: 5px 8px !important;
          border: 1.5px solid #1630a0 !important;
        }
        .hdr-info {
          background: #f0f4ff !important;
          font-size: 8.5pt !important;
          font-weight: 700 !important;
          padding: 6px 8px !important;
          color: #001840 !important;
          border: 1.5px solid #1a1a2e !important;
        }
        .hdr-info-val {
          background: #f0f4ff !important;
          font-size: 9pt !important;
          font-weight: 800 !important;
          color: #002b5e !important;
          padding: 6px 8px !important;
          border: 1.5px solid #1a1a2e !important;
        }
        .col-hdr {
          background: #1e3a8a !important;
          color: #fff !important;
          font-weight: 800 !important;
          font-size: 7.5pt !important;
          text-align: center !important;
          padding: 6px 3px !important;
          border: 1.5px solid #162d70 !important;
          line-height: 1.3;
        }
        .data-row td {
          font-size: 8pt !important;
          font-weight: 600 !important;
          color: #0a0a1a !important;
          padding: 5px !important;
          border: 1.2px solid #444 !important;
        }
        .data-row:nth-child(even) td { background: #f7f9ff !important; }
        .data-row:nth-child(odd) td { background: #fff !important; }
        
        .total-row td {
          background: #fef3c7 !important;
          font-weight: 900 !important;
          font-size: 8.5pt !important;
          color: #78350f !important;
          border: 1.5px solid #d97706 !important;
          padding: 6px 5px !important;
        }
        .total-row .grand { background: #d1fae5 !important; color: #065f46 !important; font-size: 9.5pt !important; }
        
        .awords-row td {
          background: #eff6ff !important;
          font-size: 8pt !important;
          font-weight: 700 !important;
          font-style: italic;
          color: #1e3a8a !important;
          border: 1.2px solid #93c5fd !important;
          padding: 5px 8px !important;
        }
        .net-row td {
          background: #dcfce7 !important;
          font-size: 9.5pt !important;
          font-weight: 900 !important;
          color: #14532d !important;
          border: 2px solid #16a34a !important;
          padding: 6px 8px !important;
        }
        .approved-strip td {
          background: #002b5e !important;
          color: #fff !important;
          font-weight: 900 !important;
          text-align: center;
          font-size: 9pt !important;
          letter-spacing: 0.5px;
          padding: 7px 8px !important;
          border: 2px solid #001a3e !important;
        }
        .sig-section table { border: 2px solid #1a1a2e !important; }
        .sig-hdr td {
          background: #1e3a8a !important;
          color: #fff !important;
          font-weight: 800 !important;
          font-size: 8pt !important;
          text-align: center;
          padding: 5px 8px !important;
          border: 1.5px solid #162d70 !important;
        }
        .sig-cell {
          text-align: center;
          vertical-align: top;
          padding: 8px !important;
          background: linear-gradient(to bottom, #fafafa 0%, #f5f5f5 100%) !important;
          border: 1.5px solid #333 !important;
          position: relative;
        }
        .sig-cell:nth-child(1)::before {
          content: '✎';
          position: absolute;
          top: 12px;
          right: 8px;
          font-size: 28pt;
          color: #059669;
          font-weight: bold;
        }
        .sig-cell:nth-child(2)::before {
          content: '✓';
          position: absolute;
          top: 12px;
          right: 8px;
          font-size: 28pt;
          color: #059669;
          font-weight: bold;
        }
        .sig-cell:nth-child(3)::before {
          content: '✔';
          position: absolute;
          top: 12px;
          right: 8px;
          font-size: 28pt;
          color: #059669;
          font-weight: bold;
        }
        .sig-cell:nth-child(4)::before {
          content: '📋';
          position: absolute;
          top: 12px;
          right: 8px;
          font-size: 26pt;
        }
        .sig-cell .sig-title {
          font-size: 7.5pt;
          font-weight: 900;
          color: #059669;
          margin-bottom: 32px;
          margin-top: 10px;
          letter-spacing: 0.4px;
          padding-right: 28px;
        }
        .sig-cell .sig-line { border-top: 1.5px solid #333; margin: 0 6px; }
        .sig-cell .sig-name {
          font-size: 7.5pt;
          font-weight: 800;
          color: #000;
          margin-top: 3px;
          line-height: 1.2;
        }
        .sig-cell .sig-date {
          font-size: 6.5pt;
          color: #555;
          margin-top: 2px;
          font-weight: 600;
        }
        .attachment-page {
          page-break-before: always;
          break-before: page;
          width: 100%;
          background: white;
          padding: 15px;
          text-align: center;
        }
        .attachment-header {
          font-size: 10pt;
          font-weight: 800;
          color: #002b5e;
          margin-bottom: 12px;
          border-bottom: 2px solid #1e40af;
          padding-bottom: 8px;
        }
        .attachment-container {
          width: 100%;
          max-height: 95vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 10px;
        }
        .attachment-image {
          max-width: 100%;
          max-height: 95vh;
          object-fit: contain;
          border: 1px solid #ccc;
          border-radius: 2px;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .tc { text-align: center !important; }
        .tr { text-align: right !important; }
        .tl { text-align: left !important; }
        .fw9 { font-weight: 900 !important; }
        .fw8 { font-weight: 800 !important; }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body, html { margin: 0; padding: 0; background: white; }
          .app-page, .sidebar, .bottom-nav, .mobile-topbar, .page-header, .filter-card,
          .stats-row, .controls-row, .table-card, .toast-container,
          #loadingOverlay, .panel-overlay, .detail-panel,
          #logoutOverlay, #logoutPopup, .main-content { display: none !important; }
          #printArea { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          @page {
            size: A4 landscape;
            margin: 7mm 8mm;
          }
          @page :first { margin-top: 7mm; }
          .cyrix-form { font-size: 8pt !important; }
        }
      `}</style>

      {/* LOADER */}
      {isLoading && (
        <div id="loadingOverlay" style={{ display: 'flex', opacity: 1 }}>
          <div className="loader-wrapper"><div className="loader"></div></div>
          <div id="loaderText">{loaderText}</div>
        </div>
      )}

      {/* PRINT AREA */}
      {printContent && (
        <div id="printArea" dangerouslySetInnerHTML={{ __html: printContent }}></div>
      )}

      {/* MAIN CONTENT AREA */}
      <div style={{ padding: '0 32px 40px' }} className="content-area">
        <header className="page-header" style={{ padding: '32px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <p className="page-breadcrumb">Cyrix Healthcare / Reports</p>
            <h1 className="page-title">Month Summary</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-3)', marginTop: '4px' }}>Approved expense reports — engineer-wise PDF generation</p>
          </div>
          <div className="page-header-right">
            <button className="btn btn-outline" onClick={loadData}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }}>
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </button>
          </div>
        </header>

        {/* FILTERS */}
        <div className="filter-card">
          <div className="filter-row">
            <div className="filter-group">
              <label>Month</label>
              <select id="filterMonth" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                <option value="">All Months</option>
                {MONTHS.map((m, idx) => idx > 0 && <option key={idx} value={String(idx)}>{m}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Year</label>
              <select id="filterYear" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                <option value="">All Years</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Zone</label>
              <select id="filterZone" value={filterZone} onChange={(e) => handleZoneChange(e.target.value)}>
                <option value="All">All Zones</option>
                {availableZones.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>District</label>
              <select id="filterDistrict" value={filterDistrict} onChange={(e) => handleDistrictChange(e.target.value)}>
                <option value="All">All Districts</option>
                {availableDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Manager</label>
              <select id="filterManager" value={filterManager} onChange={(e) => handleManagerChange(e.target.value)}>
                <option value="All">All Managers</option>
                {managerOptions.map((m) => <option key={m.manager_id} value={m.manager_id}>{m.name}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Engineer</label>
              <select id="filterEngineer" value={filterEngineer} onChange={(e) => setFilterEngineer(e.target.value)}>
                <option value="All">All Engineers</option>
                {engineerOptions.map((eng) => <option key={eng.user_id} value={eng.user_id}>{eng.name}</option>)}
              </select>
            </div>
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={loadData}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Apply Filters
            </button>
            <button className="btn btn-outline" onClick={clearFilters}>Clear</button>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon blue">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="stat-info">
              <p>Engineers</p>
              <h3>{totalEngineers}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="stat-info">
              <p>Approved Claims</p>
              <h3>{totalApprovedClaims}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="M6 12h.01M18 12h.01" />
              </svg>
            </div>
            <div className="stat-info">
              <p>Total Amount</p>
              <h3>₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className="stat-info">
              <p>Total KM</p>
              <h3>{Math.round(totalKm).toLocaleString('en-IN')}</h3>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="controls-row">
          <div className="search-box">
            <svg className="input-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" id="searchInput" placeholder="Search engineer, e-code, district..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <div className="bulk-actions">
            <button className="btn btn-outline" id="selectAllBtn" onClick={toggleSelectAll}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <polyline points="9 11 12 14 22 6" />
              </svg>
              {selectedEngineers.size === filteredData.length && filteredData.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            {selectedEngineers.size > 0 && (
              <button className="btn btn-success" id="bulkPdfBtn" onClick={bulkDownloadPDFIndividual}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Bulk PDF ({selectedEngineers.size})
              </button>
            )}
            {filteredData.length > 0 && (
              <button className="btn btn-warning" id="bulkAllBtn" onClick={downloadAllPDF}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                All PDFs
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div className="table-card d-none d-md-block">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      id="masterCheck"
                      checked={pageData.length > 0 && pageData.every((e) => selectedEngineers.has(e.user_id))}
                      onChange={masterToggle}
                    />
                  </th>
                  <th>Employee</th>
                  <th>E-Code</th>
                  <th>Grade</th>
                  <th>District</th>
                  <th>Month</th>
                  <th>Claims</th>
                  <th>Total KM</th>
                  <th>Total Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="tableBody">
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">
                        <div className="empty-icon">📭</div>
                        <div className="empty-text">No approved expenses found</div>
                        <div className="empty-sub">Try changing month/year filters and click Apply Filters</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageData.map((eng) => {
                    const sel = selectedEngineers.has(eng.user_id);
                    const monthLabel = filterMonth ? MONTHS[parseInt(filterMonth)] : 'All';
                    return (
                      <tr key={eng.user_id} className={sel ? 'selected' : ''} data-uid={eng.user_id}>
                        <td>
                          <input
                            type="checkbox"
                            className="table-checkbox"
                            checked={sel}
                            onChange={() => toggleRow(eng.user_id)}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{eng.full_name || '—'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{eng.designation || ''}</div>
                        </td>
                        <td><span className="tag tag-code">{eng.e_code || '—'}</span></td>
                        <td><span className="tag tag-blue">{eng.grade || '—'}</span></td>
                        <td style={{ fontSize: '13px', color: 'var(--text-2)' }}>{eng.district_name || '—'}</td>
                        <td style={{ fontSize: '13px', fontWeight: 600 }}>{monthLabel} {filterYear}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                            {eng.expense_count || 0} claims
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>{parseFloat(String(eng.total_km || 0)).toFixed(1)} km</td>
                        <td className="amount-val">₹{parseFloat(String(eng.total_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-sm btn-sm-view" onClick={() => openPanel(eng.user_id)}>
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', marginRight: '4px', strokeWidth: '2.5px' }}>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg> View
                            </button>
                            <button className="btn-sm btn-sm-pdf" onClick={() => downloadEngineerPDF(eng.user_id)}>
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', marginRight: '4px', strokeWidth: '2.5px' }}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg> PDF
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

        {/* MOBILE VIEW CARD LIST */}
        <div className="d-md-none" style={{ marginTop: '16px' }}>
          {pageData.length === 0 ? (
            <div className="empty-state" style={{ background: 'white', padding: '30px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div className="empty-icon" style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
              <div className="empty-text" style={{ fontWeight: 700, color: 'var(--text-2)' }}>No approved expenses found</div>
              <div className="empty-sub" style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Try changing month/year filters and click Apply Filters</div>
            </div>
          ) : (
            pageData.map((eng) => {
              const sel = selectedEngineers.has(eng.user_id);
              const monthLabel = filterMonth ? MONTHS[parseInt(filterMonth)] : 'All';
              return (
                <div
                  key={eng.user_id}
                  className={`mobile-card ${sel ? 'selected' : ''}`}
                  style={{
                    background: 'white',
                    border: sel ? '2px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '12px',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        className="table-checkbox"
                        checked={sel}
                        onChange={() => toggleRow(eng.user_id)}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '15px' }}>{eng.full_name || '—'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{eng.designation || ''} · <span className="tag tag-code" style={{ padding: '2px 6px', fontSize: '10px' }}>{eng.e_code || ''}</span></div>
                      </div>
                    </div>
                    <span className="tag tag-blue" style={{ fontSize: '11px' }}>{eng.grade || '—'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '12px 0', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>District</span>
                      <strong style={{ color: 'var(--text-1)' }}>{eng.district_name || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Claims</span>
                      <strong style={{ color: 'var(--success)' }}>{eng.expense_count || 0} claims</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Total KM</span>
                      <strong style={{ color: 'var(--text-1)' }}>{parseFloat(String(eng.total_km || 0)).toFixed(1)} km</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Total Amount</span>
                      <strong style={{ color: 'var(--primary)', fontSize: '14px' }}>₹{parseFloat(String(eng.total_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <button className="btn btn-outline" style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }} onClick={() => openPanel(eng.user_id)}>
                      View Details
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }} onClick={() => downloadEngineerPDF(eng.user_id)}>
                      Download PDF
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div id="pagination" style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              style={{ background: 'white', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                style={{
                  background: p === currentPage ? 'var(--primary)' : 'white',
                  color: p === currentPage ? 'white' : 'var(--text)',
                  border: `1px solid ${p === currentPage ? 'var(--primary)' : 'var(--border)'}`,
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              style={{ background: 'white', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* DETAIL SIDE PANEL */}
      {panelOpen && panelEng && (
        <>
          <div className="panel-overlay active" onClick={() => setPanelOpen(false)}></div>
          <div className="detail-panel open" id="detailPanel">
            <div className="panel-header">
              <div>
                <h3 id="panelTitle">{panelEng.full_name || 'Employee'}</h3>
                <p id="panelSub">{panelEng.e_code || ''} · {panelEng.district_name || ''} · {panelExpenses.length} approved claims</p>
              </div>
              <button className="panel-close" onClick={() => setPanelOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="panel-body" id="panelBody">
              {panelLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-3)', fontWeight: 600 }}>
                  Loading details...
                </div>
              ) : (
                <>
                  <div className="sec-heading">EMPLOYEE INFORMATION</div>
                  <div className="info-card">
                    <div className="info-row"><div className="info-label">NAME</div><div className="info-val">{panelEng.full_name || '—'}</div></div>
                    <div className="info-row"><div className="info-label">E-CODE</div><div className="info-val">{panelEng.e_code || '—'}</div></div>
                    <div className="info-row"><div className="info-label">GRADE</div><div className="info-val">{panelEng.grade || '—'}</div></div>
                    <div className="info-row"><div className="info-label">DESIGNATION</div><div className="info-val">{panelEng.designation || '—'}</div></div>
                    <div className="info-row"><div className="info-label">DISTRICT</div><div className="info-val">{panelEng.district_name || '—'}</div></div>
                    <div className="info-row"><div className="info-label">PERIOD</div><div className="info-val">{filterMonth ? MONTHS[parseInt(filterMonth)] : 'All'} {filterYear || ''}</div></div>
                    <div className="info-row"><div className="info-label">TOTAL AMOUNT</div><div className="info-val-lg">₹{(panelEng.total_amount || 0).toFixed(2)}</div></div>
                  </div>

                  <div className="sec-heading">MONTHLY TOTALS</div>
                  <div className="bk-grid">
                    <div className="bk-card"><div className="bk-label">Total Claims</div><div className="bk-val">{panelEng.expense_count || 0}</div></div>
                    <div className="bk-card"><div className="bk-label">Total KM</div><div className="bk-val">{parseFloat(String(panelEng.total_km || 0)).toFixed(1)}</div></div>
                    <div className="bk-card"><div className="bk-label">DA Amount</div><div className="bk-val">₹{parseFloat(String(panelEng.da_amount || 0)).toFixed(0)}</div></div>
                    <div className="bk-card"><div className="bk-label">Travel Amount</div><div className="bk-val">₹{parseFloat(String(panelEng.travel_amount || 0)).toFixed(0)}</div></div>
                    <div className="bk-card"><div className="bk-label">Hotel Amount</div><div className="bk-val">₹{parseFloat(String(panelEng.hotel_amount || 0)).toFixed(0)}</div></div>
                    <div className="bk-card"><div className="bk-label">Other Amount</div><div className="bk-val">₹{parseFloat(String(panelEng.other_expense_amount || 0)).toFixed(0)}</div></div>
                    <div className="bk-card" style={{ gridColumn: '1/-1' }}><div className="bk-label">TOTAL AMOUNT</div><div className="bk-val total">₹{parseFloat(String(panelEng.total_amount || 0)).toFixed(2)}</div></div>
                  </div>

                  <div className="sec-heading">APPROVED CLAIMS ({panelExpenses.length})</div>
                  {panelExpenses.length === 0 ? (
                    <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No detailed claim data available.</p>
                  ) : (
                    panelExpenses.map((exp, idx) => {
                      const legs = exp.itineraries || [];
                      return (
                        <div key={exp.expense_id} style={{ border: '1px solid var(--border)', borderLeft: '3px solid var(--success)', borderRadius: '10px', padding: '14px', marginBottom: '14px', background: 'white' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '2px' }}>Claim #{idx + 1}</div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-dark)' }}>{formatDate(exp.expense_date)}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>{exp.district_name || ''}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)' }}>₹{parseFloat(String(exp.total_amount || 0)).toFixed(2)}</div>
                              <span style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>APPROVED</span>
                            </div>
                          </div>
                          
                          <div className="bk-grid" style={{ gap: '8px', marginBottom: '12px' }}>
                            <div className="bk-card" style={{ padding: '10px' }}><div className="bk-label">DA</div><div className="bk-val" style={{ fontSize: '13px' }}>₹{parseFloat(String(exp.da_amount || 0)).toFixed(0)}</div></div>
                            <div className="bk-card" style={{ padding: '10px' }}><div className="bk-label">Hotel</div><div className="bk-val" style={{ fontSize: '13px' }}>₹{parseFloat(String(exp.hotel_amount || 0)).toFixed(0)}</div></div>
                            <div className="bk-card" style={{ padding: '10px' }}><div className="bk-label">Other</div><div className="bk-val" style={{ fontSize: '13px' }}>₹{parseFloat(String(exp.other_expense_amount || 0)).toFixed(0)}</div></div>
                            <div className="bk-card" style={{ padding: '10px' }}><div className="bk-label">Travel</div><div className="bk-val" style={{ fontSize: '13px' }}>₹{legs.reduce((sum, leg) => sum + parseFloat(String(leg.travel_amount || 0)) + parseFloat(String(leg.sub_amount || 0)), 0).toFixed(0)}</div></div>
                          </div>

                          {/* Main Expense Attachments */}
                          {exp.expense_attachments && exp.expense_attachments.length > 0 && (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '6px' }}>Expense Bills</div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {exp.expense_attachments.map((att: any) => {
                                  const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url || '');
                                  return (
                                    <div key={att.attachment_id} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}>
                                      {isImg ? (
                                        <a href={att.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                                          <img src={att.url} alt={att.bill_type} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                        </a>
                                      ) : (
                                        <a href={att.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', fontSize: '20px', padding: '8px' }}>
                                          📄
                                        </a>
                                      )}
                                      <span style={{ fontSize: '9px', color: '#64748b', marginTop: '2px', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(att.bill_type || 'Bill').replace(/_/g, ' ')}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {legs.length > 0 && (
                            <>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '10px 0 6px' }}>{legs.length} Leg{legs.length > 1 ? 's' : ''}</div>
                              {legs.map((leg) => (
                                <div key={leg.itinerary_id} style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '10px', marginBottom: '8px', fontSize: '12px', border: '1px solid var(--border)' }}>
                                  <strong>{leg.from_location || leg.from_district || '—'} → {leg.to_location || leg.to_district || '—'}</strong>
                                  <div style={{ color: 'var(--text-3)', marginTop: '2px' }}>{leg.travel_mode || ''} · {leg.distance_km || 0} km · ₹{parseFloat(String(leg.travel_amount || 0)).toFixed(0)}</div>
                                  
                                  {leg.attachments && leg.attachments.length > 0 && (
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      {leg.attachments.map((att: any) => {
                                        const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url || '');
                                        return (
                                          <div key={att.attachment_id} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}>
                                            {isImg ? (
                                              <a href={att.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                                                <img src={att.url} alt={att.bill_type} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                              </a>
                                            ) : (
                                              <a href={att.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', fontSize: '16px', padding: '4px 8px' }}>
                                                📄
                                              </a>
                                            )}
                                            <span style={{ fontSize: '8px', color: '#64748b', marginTop: '2px', maxWidth: '55px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(att.bill_type || 'Bill').replace(/_/g, ' ')}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </>
                          )}

                          {/* ACTION TIMELINE */}
                          <div style={{ marginTop: '12px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '8px' }}>Action Timeline</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <div style={{ color: 'var(--success)', marginTop: '2px' }}>●</div>
                                <div>
                                  <strong>Submitted</strong>
                                  <div style={{ fontSize: '10px', color: '#64748b' }}>{formatDate(exp.expense_date)}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <div style={{ color: exp.level_first_approver_time ? 'var(--success)' : '#94a3b8', marginTop: '2px' }}>●</div>
                                <div>
                                  <strong>L1 Approval ({exp.l1_name || 'L1 Manager'})</strong>
                                  {exp.level_first_approver_time ? (
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>Approved on {formatDate(exp.level_first_approver_time)}</div>
                                  ) : (
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>Pending / Not Approved</div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <div style={{ color: exp.level_second_approver_time ? 'var(--success)' : '#94a3b8', marginTop: '2px' }}>●</div>
                                <div>
                                  <strong>L2 Approval ({exp.l2_name || 'L2 Manager'})</strong>
                                  {exp.level_second_approver_time ? (
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>Approved on {formatDate(exp.level_second_approver_time)}</div>
                                  ) : (
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>Pending / Not Approved</div>
                                  )}
                                </div>
                              </div>
                              {exp.status === 'Rejected' && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                  <div style={{ color: 'var(--danger)', marginTop: '2px' }}>●</div>
                                  <div>
                                    <strong style={{ color: 'var(--danger)' }}>Rejected</strong>
                                    {exp.reject_reason && (
                                      <div style={{ fontSize: '11px', color: 'var(--danger)', fontStyle: 'italic', marginTop: '2px' }}>
                                        Reason: {exp.reject_reason}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>

            <div className="panel-footer" id="panelFooter">
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setPanelOpen(false)}>Close</button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => downloadEngineerPDF(panelEng.user_id)}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </>
      )}

      {/* TOAST SYSTEM */}
      <div className="toast-container">
        {toasts.map((toast) => {
          const colors: Record<string, string> = { success: 'var(--success)', danger: 'var(--danger)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' };
          return (
            <div
              key={toast.id}
              style={{
                background: 'white',
                color: colors[toast.type] || colors.info,
                padding: '14px 20px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: 'var(--shadow-md)',
                borderLeft: `4px solid ${colors[toast.type] || colors.info}`,
                pointerEvents: 'auto'
              }}
            >
              {toast.msg}
            </div>
          );
        })}
      </div>
    </>
  );
}
