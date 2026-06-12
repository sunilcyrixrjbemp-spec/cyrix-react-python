import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../css/expense.css';
import SuccessPopup from '../components/SuccessPopup';

interface UserInfo {
  full_name: string;
  e_code: string;
  grade: string;
  home_district: string;
  level_first_approver?: string;
  level_second_approver?: string;
}

interface AllowanceRules {
  daily_in_district: number;
  daily_out_district: number;
  daily_hotel: number;
  daily_out_state: number;
  hotel_in_state_s: number;
  hotel_in_state_d?: number;
  hotel_out_state_s?: number;
  hotel_out_state_d?: number;
  max_km_per_month: number;
  rate_per_km?: number;
  rate_bike?: number;
  rate_car?: number;
  vehicle_type: string;
  current_month_km: number;
  current_month_auto: number;
  max_auto_per_month: number;
}

interface FacilityData {
  [district: string]: string[];
}

interface ItineraryLeg {
  id: number;
  leg: number;
  travel_type: 'In-District' | 'Outdoor';
  district_from: string;
  district: string; // to district
  from: string;
  to: string;
  mode: string;
  km: number;
  amount: number;
  sub_mode: string;
  sub_amount: number;
  da: number;
  hotel: number;
  oth_desc: string;
  oth_amount: number;
  ws_assigned: number;
  ws_closed: number;
  ws_pms: number;
  ws_asset: number;
  visit_purpose: string;
  showSubLeg: boolean;

  // File objects for uploads
  main_bill: File | null;
  sub_bill: File | null;
  oth_bill: File | null;
  comm_mail: File | null;
  hotel_bill: File | null;

  // Object URL Previews
  prev_main_bill: string;
  prev_sub_bill: string;
  prev_oth_bill: string;
  prev_comm_mail: string;
  prev_hotel_bill: string;
}

interface Toast {
  msg: string;
  type: 'success' | 'danger' | 'info' | 'warning';
}

export default function Expense() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expIdToEdit = searchParams.get('exp_id');

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  // Loaded from API
  const [user, setUser] = useState<UserInfo>({ full_name: '—', e_code: '—', grade: '—', home_district: '' });
  const [rules, setRules] = useState<AllowanceRules>({
    daily_in_district: 250,
    daily_out_district: 400,
    daily_hotel: 350,
    daily_out_state: 600,
    hotel_in_state_s: 1500,
    max_km_per_month: 2000,
    vehicle_type: 'Bike',
    current_month_km: 0,
    current_month_auto: 0,
    max_auto_per_month: 1000
  });
  const [facilities, setFacilities] = useState<FacilityData>({});
  const [submittedDates, setSubmittedDates] = useState<string[]>([]);
  const [nextExpId, setNextExpId] = useState('RJ-MM/YY-PENDING');

  const [approvedKmFromDB, setApprovedKmFromDB] = useState(0);
  const [approvedAutoFromDB, setApprovedAutoFromDB] = useState(0);
  const [existingKmReq, setExistingKmReq] = useState<any>(null);
  const [existingAutoReq, setExistingAutoReq] = useState<any>(null);

  // Input states
  const [expDate, setExpDate] = useState('');
  const [loadedMonth, setLoadedMonth] = useState('');

  // Itinerary items list
  const [itineraries, setItineraries] = useState<ItineraryLeg[]>([]);

  // Totals calculations
  const [totalKm, setTotalKm] = useState(0);
  const [totalAmt, setTotalAmt] = useState(0);
  const [autoAmt, setAutoAmt] = useState(0);

  // Exceed limits flags
  const [hasLimitExceeded, setHasLimitExceeded] = useState(false);
  const [exceededType, setExceededType] = useState<'KM' | 'AUTO' | null>(null);
  const [missingAmount, setMissingAmount] = useState(0);
  const [wasExceededFlag, setWasExceededFlag] = useState(false);

  // Modals state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reqAdditional, setReqAdditional] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successPopupData, setSuccessPopupData] = useState({
    title: '',
    message: '',
    amount: 0,
    date: '',
    claimId: ''
  });

  const currentUserId = (localStorage.getItem('logged_in_user_id') || '').replace(/['"]/g, '').trim();

  const showToast = (msg: string, type: Toast['type'] = 'info') => {
    setToasts(prev => [...prev, { msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 4000);
  };

  // Setup initial date limits matching Cloudflare Worker rules
  useEffect(() => {
    if (!currentUserId) {
      navigate('/');
      return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setExpDate(todayStr);

    let minDate = new Date();
    if (today.getDate() > 2) {
      minDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      minDate.setDate(today.getDate() - 15);
    }
    const minDateStr = minDate.toISOString().split('T')[0];

    const dateInput = document.getElementById('exp_date') as HTMLInputElement;
    if (dateInput) {
      dateInput.max = todayStr;
      dateInput.min = minDateStr;
    }

    const currentMonthStr = todayStr.slice(0, 7);
    setLoadedMonth(currentMonthStr);
    fetchMonthLimits(currentMonthStr, true);
  }, []);

  // Fetch initial or month-changed variables
  const fetchMonthLimits = async (month: string, isInitial = false) => {
    setIsLoading(true);
    try {
      if (expIdToEdit) {
        setIsEditMode(true);
        // Loading expense details to EDIT
        const editRes = await fetch(`/api/expense/edit?exp_id=${encodeURIComponent(expIdToEdit)}`);
        const editData = await editRes.json();
        if (editData.success) {
          const exp = editData.expense;
          setExpDate(exp.expense_date);
          const activeMonth = exp.expense_date.slice(0, 7);
          setLoadedMonth(activeMonth);

          // Get limit specs for that active month
          const res = await fetch(`/api/expense/init?user_id=${currentUserId}&month=${activeMonth}`);
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
            setRules(data.allowance);
            setFacilities(data.facilities || {});
            setSubmittedDates(data.submitted_dates || []);
            setNextExpId(exp.exp_id);

            setApprovedKmFromDB(data.approved_km || 0);
            setApprovedAutoFromDB(data.approved_auto || 0);
            setExistingKmReq(data.existing_km_req);
            setExistingAutoReq(data.existing_auto_req);

            // Set Itineraries
            const mappedLegs = editData.itineraries.map((leg: any) => ({
              id: leg.leg,
              leg: leg.leg,
              travel_type: leg.travel_type || 'In-District',
              district_from: leg.district_from || data.user.home_district,
              district: leg.district || data.user.home_district,
              from: leg.from || '',
              to: leg.to || '',
              mode: leg.mode || '',
              km: leg.km || 0,
              amount: leg.amount || 0,
              sub_mode: leg.sub_mode || '',
              sub_amount: leg.sub_amount || 0,
              da: leg.da || 0,
              hotel: leg.hotel || 0,
              oth_desc: leg.oth_desc || '',
              oth_amount: leg.oth_amount || 0,
              ws_assigned: leg.ws_assigned || 0,
              ws_closed: leg.ws_closed || 0,
              ws_pms: leg.ws_pms || 0,
              ws_asset: leg.ws_asset || 0,
              visit_purpose: leg.visit_purpose || '',
              showSubLeg: !!leg.sub_mode,
              main_bill: null,
              sub_bill: null,
              oth_bill: null,
              comm_mail: null,
              hotel_bill: null,
              prev_main_bill: (leg.attachments || []).find((a: any) => a.bill_type === leg.mode)?.url || '',
              prev_sub_bill: (leg.attachments || []).find((a: any) => a.bill_type === leg.sub_mode)?.url || '',
              prev_oth_bill: (leg.attachments || []).find((a: any) => a.bill_type === 'Other_Expense')?.url || '',
              prev_comm_mail: (leg.attachments || []).find((a: any) => a.bill_type === 'Communication_Mail')?.url || '',
              prev_hotel_bill: (leg.attachments || []).find((a: any) => a.bill_type === 'Hotel')?.url || ''
            }));

            setItineraries(mappedLegs);
          }
        } else {
          showToast(editData.message || 'Failed to load expense for edit.', 'danger');
        }
      } else {
        // Normal add mode
        const res = await fetch(`/api/expense/init?user_id=${currentUserId}&month=${month}`);
        const data = await res.json();
        if (data.success) {
          setLoadedMonth(month);
          setUser(data.user);
          setRules(data.allowance);
          setFacilities(data.facilities || {});
          setSubmittedDates(data.submitted_dates || []);
          setNextExpId(data.next_exp_id);

          setApprovedKmFromDB(data.approved_km || 0);
          setApprovedAutoFromDB(data.approved_auto || 0);
          setExistingKmReq(data.existing_km_req);
          setExistingAutoReq(data.existing_auto_req);

          if (isInitial) {
            // Add initial empty leg
            setItineraries([createEmptyLeg(1, data.user.home_district)]);
          }
        } else {
          showToast(data.message || 'Failed to fetch allowances.', 'danger');
        }
      }
    } catch (err) {
      showToast('Network error loading limits.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const createEmptyLeg = (num: number, homeDistrict: string): ItineraryLeg => {
    return {
      id: num,
      leg: num,
      travel_type: 'In-District',
      district_from: homeDistrict,
      district: homeDistrict,
      from: '',
      to: '',
      mode: '',
      km: 0,
      amount: 0,
      sub_mode: '',
      sub_amount: 0,
      da: 0,
      hotel: 0,
      oth_desc: '',
      oth_amount: 0,
      ws_assigned: 0,
      ws_closed: 0,
      ws_pms: 0,
      ws_asset: 0,
      visit_purpose: '',
      showSubLeg: false,
      main_bill: null,
      sub_bill: null,
      oth_bill: null,
      comm_mail: null,
      hotel_bill: null,
      prev_main_bill: '',
      prev_sub_bill: '',
      prev_oth_bill: '',
      prev_comm_mail: '',
      prev_hotel_bill: ''
    };
  };

  // Re-calculate totals when itineraries change
  useEffect(() => {
    if (itineraries.length === 0) return;

    let totalKmSum = 0;
    let totalAmtSum = 0;
    let autoAmtSum = 0;

    itineraries.forEach((leg, idx) => {
      const mode = leg.mode;
      const km = parseFloat(leg.km as any) || 0;
      const amt = parseFloat(leg.amount as any) || 0;

      if (mode === 'Bike' || mode === 'Car') {
        totalKmSum += km;
      }
      if (mode === 'Auto') {
        autoAmtSum += amt;
      }
      totalAmtSum += amt;

      const subMode = leg.sub_mode;
      const subAmt = parseFloat(leg.sub_amount as any) || 0;
      if (subMode === 'Auto') {
        autoAmtSum += subAmt;
      }
      totalAmtSum += subAmt;

      // Leg 1 handles Daily Allowance & Hotel Amounts
      if (idx === 0) {
        totalAmtSum += parseFloat(leg.da as any) || 0;
        totalAmtSum += parseFloat(leg.hotel as any) || 0;
      }

      totalAmtSum += parseFloat(leg.oth_amount as any) || 0;
    });

    setTotalKm(totalKmSum);
    setTotalAmt(totalAmtSum);
    setAutoAmt(autoAmtSum);

    // Limit calculations
    const maxKmAllowed = rules.max_km_per_month + approvedKmFromDB;
    const maxAutoAllowed = rules.max_auto_per_month + approvedAutoFromDB;

    let isExceeded = false;
    let type: 'KM' | 'AUTO' | null = null;
    let diff = 0;

    if ((rules.current_month_km + totalKmSum) > maxKmAllowed) {
      diff = (rules.current_month_km + totalKmSum) - maxKmAllowed;
      type = 'KM';
      isExceeded = true;
    } else if ((rules.current_month_auto + autoAmtSum) > maxAutoAllowed) {
      diff = (rules.current_month_auto + autoAmtSum) - maxAutoAllowed;
      type = 'AUTO';
      isExceeded = true;
    }

    setHasLimitExceeded(isExceeded);
    setExceededType(type);
    setMissingAmount(diff);

    if (isExceeded) {
      const existingReq = type === 'KM' ? existingKmReq : existingAutoReq;
      setReqAdditional(diff.toFixed(2));

      // Trigger approval modal automatically once
      if (!wasExceededFlag) {
        setWasExceededFlag(true);
        setShowApprovalModal(true);
      }
    } else {
      setWasExceededFlag(false);
    }
  }, [itineraries, rules, approvedKmFromDB, approvedAutoFromDB]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;

    if (submittedDates.includes(val) && !isEditMode) {
      showToast('An expense for this date has already been submitted!', 'danger');
      setExpDate('');
      return;
    }

    setExpDate(val);
    const month = val.slice(0, 7);
    if (month !== loadedMonth) {
      fetchMonthLimits(month, false);
    }
  };

  const addItineraryLeg = () => {
    if (itineraries.length >= 6) return;
    const nextNum = itineraries.length + 1;
    setItineraries(prev => [...prev, createEmptyLeg(nextNum, user.home_district)]);
  };

  const removeItineraryLeg = (num: number) => {
    const list = itineraries.filter(leg => leg.leg !== num).map((leg, idx) => ({
      ...leg,
      leg: idx + 1,
      id: idx + 1
    }));
    setItineraries(list);
  };

  const updateLegField = (legNum: number, field: keyof ItineraryLeg, value: any) => {
    setItineraries(prev =>
      prev.map(leg => {
        if (leg.leg === legNum) {
          return { ...leg, [field]: value };
        }
        return leg;
      })
    );
  };

  // Image compressor helper
  const compressImage = (file: File, targetSizeKB = 30): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > 1024 || height > 1024) {
            const ratio = Math.min(1024 / width, 1024 / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          const targetBytes = targetSizeKB * 1024;

          const attemptCompress = () => {
            canvas.toBlob((blob: any) => {
              if (blob.size <= targetBytes || quality <= 0.1) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                quality -= 0.05;
                attemptCompress();
              }
            }, 'image/jpeg', quality);
          };
          attemptCompress();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (legNum: number, field: string, file: File | null) => {
    if (!file) {
      updateLegField(legNum, field as any, null);
      updateLegField(legNum, `prev_${field}` as any, '');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Only image files are allowed!', 'danger');
      return;
    }

    showToast(`Compiling image attachments... (${(file.size / 1024).toFixed(1)} KB)`, 'info');

    try {
      const compressed = await compressImage(file, 30);
      updateLegField(legNum, field as any, compressed);
      updateLegField(legNum, `prev_${field}` as any, URL.createObjectURL(compressed));
      showToast(`✓ Image processed successfully: ${(compressed.size / 1024).toFixed(1)} KB`, 'success');
    } catch (err) {
      showToast('Image processing failed.', 'danger');
    }
  };

  const removeAttachedImage = (legNum: number, field: string) => {
    updateLegField(legNum, field as any, null);
    updateLegField(legNum, `prev_${field}` as any, '');
  };

  const toggleTravelType = (legNum: number, val: 'In-District' | 'Outdoor') => {
    setItineraries(prev =>
      prev.map(leg => {
        if (leg.leg === legNum) {
          const updatedLeg = { ...leg, travel_type: val };
          if (val === 'Outdoor') {
            updatedLeg.district_from = leg.district_from || user.home_district;
            // Clear vehicle settings on Outdoor legs
            if (['Bike', 'Car'].includes(leg.mode)) {
              updatedLeg.mode = '';
              updatedLeg.km = 0;
              updatedLeg.amount = 0;
            }
          } else {
            updatedLeg.district_from = user.home_district;
            updatedLeg.district = user.home_district;
            updatedLeg.comm_mail = null;
            updatedLeg.prev_comm_mail = '';
          }
          return updatedLeg;
        }
        return leg;
      })
    );
  };

  const handleDistrictToChange = (legNum: number, dist: string) => {
    updateLegField(legNum, 'district', dist);
    if (legNum === 1) {
      // Recalculate DA based on home vs outdoor district
      const isOutdoor = dist !== user.home_district;
      const hotelVal = parseFloat(itineraries[0]?.hotel as any) || 0;
      let calculatedDa = 0;

      if (isOutdoor) {
        calculatedDa = hotelVal > 0 ? rules.daily_out_state : rules.daily_out_district;
      } else {
        calculatedDa = hotelVal > 0 ? rules.daily_hotel : rules.daily_in_district;
      }
      updateLegField(1, 'da', calculatedDa);
    }
  };

  const handleHotelChange = (val: string) => {
    const hotelAmt = parseFloat(val) || 0;
    const maxHotel = rules.hotel_in_state_s;

    let finalHotel = hotelAmt;
    if (hotelAmt > maxHotel) {
      showToast(`Maximum hotel limit is ₹${maxHotel}`, 'warning');
      finalHotel = maxHotel;
    }

    const distTo = itineraries[0]?.district || user.home_district;
    const isOutdoor = distTo !== user.home_district;
    let calculatedDa = 0;

    if (isOutdoor) {
      calculatedDa = finalHotel > 0 ? rules.daily_out_state : rules.daily_out_district;
    } else {
      calculatedDa = finalHotel > 0 ? rules.daily_hotel : rules.daily_in_district;
    }

    setItineraries(prev =>
      prev.map(leg => {
        if (leg.leg === 1) {
          return {
            ...leg,
            hotel: finalHotel,
            da: calculatedDa
          };
        }
        return leg;
      })
    );
  };

  const handleModeChange = (legNum: number, mode: string) => {
    setItineraries(prev =>
      prev.map(leg => {
        if (leg.leg === legNum) {
          const updatedLeg = { ...leg, mode, km: 0, amount: 0 };
          if (mode !== 'Bus' && mode !== 'Train') {
            updatedLeg.showSubLeg = false;
            updatedLeg.sub_mode = '';
            updatedLeg.sub_amount = 0;
            updatedLeg.sub_bill = null;
            updatedLeg.prev_sub_bill = '';
          }
          return updatedLeg;
        }
        return leg;
      })
    );
  };

  const handleKmChange = (legNum: number, kmVal: number, mode: string) => {
    const rate = mode === 'Bike' ? 4.5 : 9.0;
    const calculatedAmt = (kmVal * rate);
    setItineraries(prev =>
      prev.map(leg => {
        if (leg.leg === legNum) {
          return {
            ...leg,
            km: kmVal,
            amount: parseFloat(calculatedAmt.toFixed(2))
          };
        }
        return leg;
      })
    );
  };

  const sendLimitRequest = async () => {
    if (!reqAdditional) {
      showToast('Please specify the extension amount.', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/expense/limit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          type: exceededType,
          amount: parseFloat(reqAdditional),
          month: loadedMonth
        })
      });

      const data = await response.json();
      if (data.success) {
        showToast(data.message || 'Request successfully sent to manager.', 'success');
        setShowApprovalModal(false);
        // Refresh limits
        fetchMonthLimits(loadedMonth, false);
      } else {
        showToast(data.message || 'Limit request failed.', 'danger');
      }
    } catch (err) {
      showToast('Connection failed.', 'danger');
    }
  };

  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();

    if (hasLimitExceeded) {
      setShowApprovalModal(true);
      return;
    }

    setShowConfirmModal(true);
  };

  const doSubmit = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('user_id', currentUserId);
      formData.append('exp_date', expDate);
      formData.append('total_amount', totalAmt.toFixed(2));

      if (isEditMode && expIdToEdit) {
        formData.append('exp_id', expIdToEdit);
      }

      const postLegs = itineraries.map(leg => ({
        leg: leg.leg,
        travel_type: leg.travel_type,
        district_from: leg.district_from,
        district: leg.district,
        from: leg.from,
        to: leg.to,
        mode: leg.mode,
        km: leg.km,
        amount: leg.amount,
        sub_mode: leg.sub_mode,
        sub_amount: leg.sub_amount,
        da: leg.leg === 1 ? leg.da : 0,
        hotel: leg.leg === 1 ? leg.hotel : 0,
        oth_desc: leg.oth_desc,
        oth_amount: leg.oth_amount,
        ws_assigned: leg.ws_assigned,
        ws_closed: leg.ws_closed,
        ws_pms: leg.ws_pms,
        ws_asset: leg.ws_asset,
        visit_purpose: leg.visit_purpose
      }));

      formData.append('itineraries', JSON.stringify(postLegs));

      // Append files
      itineraries.forEach(leg => {
        if (leg.main_bill) {
          formData.append(`main_bill_${leg.leg}`, leg.main_bill);
        }
        if (leg.sub_bill) {
          formData.append(`sub_bill_${leg.leg}`, leg.sub_bill);
        }
        if (leg.oth_bill) {
          formData.append(`oth_bill_${leg.leg}`, leg.oth_bill);
        }
        if (leg.comm_mail) {
          formData.append(`comm_mail_${leg.leg}`, leg.comm_mail);
        }
        if (leg.leg === 1 && leg.hotel_bill) {
          formData.append('hotel_bill_1', leg.hotel_bill);
        }
      });

      const url = isEditMode ? '/api/expense/edit' : '/api/expense';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        body: formData
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setShowConfirmModal(false);
        setSuccessPopupData({
          title: isEditMode ? 'Claim Updated Successfully!' : 'Claim Submitted Successfully!',
          message: isEditMode 
            ? 'Your modifications have been successfully updated.' 
            : 'We have received your claim and a notification has been sent for approval.',
          amount: totalAmt,
          date: expDate,
          claimId: data.exp_id || nextExpId
        });
        setShowSuccessPopup(true);
      } else {
        setShowConfirmModal(false);
        showToast(data.message || 'Submission failed.', 'danger');
      }
    } catch (err) {
      showToast('Network error submitting claim.', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const getDistrictOptions = () => {
    return (
      <>
        <option value="">Select District</option>
        {Object.keys(facilities).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </>
    );
  };

  const getFacilityListOptions = (dist: string) => {
    if (!dist) return null;
    const basicOpts = [
      `Railway Station ${dist}`,
      `Bus Station ${dist}`,
      'Hotel'
    ];
    if (dist === 'Jodhpur') {
      basicOpts.push('Jodhpur Office');
    }
    const mapped = facilities[dist] || [];
    return [...basicOpts, ...mapped];
  };

  return (
    <>
      {isLoading && (
        <div id="loadingOverlay" style={{ display: 'flex', opacity: 1 }}>
          <div className="loader-wrapper">
            <div className="loader"></div>
          </div>
          <div id="loaderText">Setting up expense rules...</div>
        </div>
      )}

      <div className="sticky-header-container">
        <div className="mobile-topbar hide-desktop">
          <div className="mobile-topbar-left">
            <h1>{isEditMode ? 'Edit Claim' : 'Submit Expense'}</h1>
            <span className="exp-id-badge" style={{ fontSize: '10px', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '99px', color: 'white', fontWeight: 600 }}>
              {nextExpId}
            </span>
          </div>
          <img src="/logo.png" alt="Cyrix" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>

        <header className="page-header desktop-only" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="page-breadcrumb" style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: 500, marginBottom: '4px' }}>Cyrix Healthcare / Expenses</p>
            <h1 className="page-title" style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 800, color: 'var(--primary-dark)', margin: 0, letterSpacing: '-0.5px' }}>
              {isEditMode ? '⚙️ Edit Expense Claim' : 'Submit Expense'}
            </h1>
          </div>
          <span className="exp-id-badge d-none-mobile" style={{ background: 'var(--primary-50)', color: 'var(--primary)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {nextExpId}
          </span>
        </header>

        <div className="employee-strip" style={{ background: 'var(--surface)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 0 }}>
          <div className="emp-field">
            <label style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Employee Name</label>
            <strong style={{ fontSize: '14px', display: 'block', marginTop: '2px' }}>{user.full_name}</strong>
          </div>
          <div className="emp-divider" style={{ width: '1px', height: '30px', background: 'var(--border)', margin: '0 20px' }}></div>
          <div className="emp-field">
            <label style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>E-Code</label>
            <strong style={{ fontSize: '14px', display: 'block', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{user.e_code}</strong>
          </div>
          <div className="emp-divider" style={{ width: '1px', height: '30px', background: 'var(--border)', margin: '0 20px' }}></div>
          <div className="emp-field">
            <label style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Grade</label>
            <strong style={{ fontSize: '14px', display: 'block', marginTop: '2px' }}>{user.grade}</strong>
          </div>
          <div className="emp-divider" style={{ width: '1px', height: '30px', background: 'var(--border)', margin: '0 20px' }}></div>
          <div className="emp-field">
            <label style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Vehicle Allowance</label>
            <strong style={{ fontSize: '14px', display: 'block', marginTop: '2px' }}>{rules.vehicle_type}</strong>
          </div>
          <div className="emp-divider" style={{ width: '1px', height: '30px', background: 'var(--border)', margin: '0 20px' }}></div>
          <div className="emp-field">
            <label style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{rules.vehicle_type} Limit</label>
            <strong style={{ fontSize: '14px', display: 'block', marginTop: '2px' }}>
              {rules.current_month_km} / {rules.max_km_per_month + approvedKmFromDB} KM
            </strong>
          </div>
          <div className="emp-divider" style={{ width: '1px', height: '30px', background: 'var(--border)', margin: '0 20px' }}></div>
          <div className="emp-field">
            <label style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Auto Limit</label>
            <strong style={{ fontSize: '14px', display: 'block', marginTop: '2px', color: 'var(--warning)' }}>
              ₹{rules.current_month_auto} / ₹{rules.max_auto_per_month + approvedAutoFromDB}
            </strong>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmitClick} className="expense-form">
        <div className="section-card">
          <div className="section-badge">Step 1</div>
          <div className="section-header">
            <div className="section-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h2 className="section-title">Date of Expense</h2>
          </div>
          <div style={{ maxWidth: '320px', width: '100%' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)' }}>Select Date <span className="req">*</span></label>
              <input
                type="date"
                id="exp_date"
                required
                disabled={isEditMode}
                value={expDate}
                onChange={handleDateChange}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font)' }}
              />
            </div>
          </div>
        </div>

        {itineraries.map((leg, idx) => {
          const isFirst = leg.leg === 1;
          const allowedModes = ['Auto', 'Bus', 'Train'];
          if (leg.travel_type === 'In-District') {
            if (rules.vehicle_type === 'Bike') allowedModes.push('Bike');
            if (rules.vehicle_type === 'Car') allowedModes.push('Car');
          }

          const fromDList = getFacilityListOptions(leg.district_from);
          const toDList = getFacilityListOptions(leg.district);

          return (
            <div key={leg.id} className="section-card itinerary-block" style={{ borderLeft: '4px solid var(--primary-light)' }}>
              <div className="iti-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', background: 'var(--primary)', color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: '16px', justifyContent: 'center' }}>
                    {leg.leg}
                  </div>
                  <div>
                    <div className="section-badge">Location Visit {leg.leg}</div>
                    <h2 className="section-title" style={{ margin: '2px 0 0' }}>Journey Details</h2>
                  </div>
                </div>
                {!isFirst && (
                  <button
                    type="button"
                    style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    onClick={() => removeItineraryLeg(leg.leg)}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Remove
                  </button>
                )}
              </div>

              <div className="travel-type-toggle">
                <label className="toggle-option">
                  <input
                    type="radio"
                    name={`travel_type_${leg.leg}`}
                    value="In-District"
                    checked={leg.travel_type === 'In-District'}
                    onChange={() => toggleTravelType(leg.leg, 'In-District')}
                    style={{ display: 'none' }}
                  />
                  <span className={`toggle-label ${leg.travel_type === 'In-District' ? 'active-toggle' : ''}`} style={{
                    borderColor: leg.travel_type === 'In-District' ? 'var(--primary-light)' : 'var(--border)',
                    background: leg.travel_type === 'In-District' ? 'var(--primary-50)' : 'var(--surface-2)',
                    color: leg.travel_type === 'In-District' ? 'var(--primary)' : 'inherit'
                  }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <circle cx="12" cy="11" r="3" />
                    </svg>
                    In-District
                  </span>
                </label>
                <label className="toggle-option">
                  <input
                    type="radio"
                    name={`travel_type_${leg.leg}`}
                    value="Outdoor"
                    checked={leg.travel_type === 'Outdoor'}
                    onChange={() => toggleTravelType(leg.leg, 'Outdoor')}
                    style={{ display: 'none' }}
                  />
                  <span className={`toggle-label ${leg.travel_type === 'Outdoor' ? 'active-toggle' : ''}`} style={{
                    borderColor: leg.travel_type === 'Outdoor' ? 'var(--primary-light)' : 'var(--border)',
                    background: leg.travel_type === 'Outdoor' ? 'var(--primary-50)' : 'var(--surface-2)',
                    color: leg.travel_type === 'Outdoor' ? 'var(--primary)' : 'inherit'
                  }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                    Outdoor / Out-District
                  </span>
                </label>
              </div>

              <div className="form-grid-2">
                {leg.travel_type === 'Outdoor' && (
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>From District <span className="req">*</span></label>
                    <select
                      value={leg.district_from}
                      onChange={(e) => updateLegField(leg.leg, 'district_from', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                    >
                      {getDistrictOptions()}
                    </select>
                  </div>
                )}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>To District <span className="req">*</span></label>
                  <select
                    required
                    disabled={leg.travel_type === 'In-District'}
                    value={leg.district}
                    onChange={(e) => handleDistrictToChange(leg.leg, e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                  >
                    {getDistrictOptions()}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>From Location <span className="req">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Type location..."
                    list={`list_from_${leg.leg}`}
                    value={leg.from}
                    onChange={(e) => updateLegField(leg.leg, 'from', e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                  />
                  <datalist id={`list_from_${leg.leg}`}>
                    {fromDList?.map(f => <option key={f} value={f} />)}
                  </datalist>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>To Location <span className="req">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Type location..."
                    list={`list_to_${leg.leg}`}
                    value={leg.to}
                    onChange={(e) => {
                      updateLegField(leg.leg, 'to', e.target.value);
                      // Toggle work summary if transit
                      const toVal = e.target.value;
                      const isTransit = toVal.includes('Home') || toVal.includes('Railway Station') || toVal.includes('Bus Station') || toVal.includes('Hotel');
                      // Custom side effect logic:
                      if (isTransit) {
                        updateLegField(leg.leg, 'ws_assigned', 0);
                        updateLegField(leg.leg, 'ws_closed', 0);
                        updateLegField(leg.leg, 'ws_pms', 0);
                        updateLegField(leg.leg, 'ws_asset', 0);
                      }
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                  />
                  <datalist id={`list_to_${leg.leg}`}>
                    {toDList?.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>

              {leg.travel_type === 'Outdoor' && (
                <div className="upload-alert-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Outdoor Communication Mail <span className="req">*</span></div>
                  <div style={{ border: '1.5px dashed var(--border)', borderRadius: '8px', background: 'var(--surface-2)', padding: '16px', textAlign: 'center', position: 'relative', cursor: 'pointer', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <input
                      type="file"
                      accept="image/*"
                      required={!isEditMode && !leg.prev_comm_mail}
                      onChange={(e) => handleFileChange(leg.leg, 'comm_mail', e.target.files?.[0] || null)}
                      style={{ width: '100%', boxSizing: 'border-box', position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                    {!leg.prev_comm_mail ? (
                      <div>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', display: 'block', marginTop: '6px' }}>Upload Required</span>
                      </div>
                    ) : (
                      <div className="preview-wrapper">
                        <img className="preview-img" src={leg.prev_comm_mail} alt="Comm Preview" />
                        <button type="button" className="remove-img-btn" onClick={() => removeAttachedImage(leg.leg, 'comm_mail')}>×</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '24px 0 16px', borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>Travel Information</div>

              <div className="form-grid-4">
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Travel Mode <span className="req">*</span></label>
                  <select
                    required
                    value={leg.mode}
                    onChange={(e) => handleModeChange(leg.leg, e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                  >
                    <option value="">Select Mode</option>
                    {allowedModes.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Distance (KM) <span className="req">*</span></label>
                  <input
                    type="number"
                    min="0"
                    required
                    readOnly={!['Bike', 'Car'].includes(leg.mode)}
                    value={leg.km}
                    onChange={(e) => handleKmChange(leg.leg, parseFloat(e.target.value) || 0, leg.mode)}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px',
                      background: ['Bike', 'Car'].includes(leg.mode) ? 'transparent' : 'var(--surface-2)'
                    }}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Amount (₹) <span className="req">*</span></label>
                  <input
                    type="number"
                    min="0"
                    required
                    readOnly={['Bike', 'Car'].includes(leg.mode)}
                    value={leg.amount}
                    onChange={(e) => updateLegField(leg.leg, 'amount', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px',
                      background: ['Bike', 'Car'].includes(leg.mode) ? 'var(--surface-2)' : 'transparent'
                    }}
                  />
                </div>
                {!['Bike', 'Car'].includes(leg.mode) && leg.mode !== '' && (
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>
                      {leg.mode} Bill Image <span className={leg.mode === 'Train' || leg.amount >= 300 ? 'req' : ''}>{leg.mode === 'Train' || leg.amount >= 300 ? '*' : ''}</span>
                    </label>
                    <div style={{ border: '1.5px dashed var(--border)', borderRadius: '8px', background: 'var(--surface-2)', padding: '10px', textAlign: 'center', position: 'relative', cursor: 'pointer', minHeight: '46px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <input
                        type="file"
                        accept="image/*"
                        required={!isEditMode && !leg.prev_main_bill && (leg.mode === 'Train' || leg.amount >= 300)}
                        onChange={(e) => handleFileChange(leg.leg, 'main_bill', e.target.files?.[0] || null)}
                        style={{ width: '100%', boxSizing: 'border-box', position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                      />
                      {!leg.prev_main_bill ? (
                        <div>
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-3)', display: 'block', marginTop: '2px' }}>
                            {leg.mode === 'Train' || leg.amount >= 300 ? 'Required' : 'Optional'}
                          </span>
                        </div>
                      ) : (
                        <div className="preview-wrapper">
                          <img className="preview-img" src={leg.prev_main_bill} alt="Bill Preview" />
                          <button type="button" className="remove-img-btn" onClick={() => removeAttachedImage(leg.leg, 'main_bill')}>×</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Extra Connection block for Bus/Train */}
              {(leg.mode === 'Bus' || leg.mode === 'Train') && !leg.showSubLeg && (
                <button
                  type="button"
                  onClick={() => updateLegField(leg.leg, 'showSubLeg', true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1.5px solid var(--primary-light)', color: 'var(--primary)', width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', margin: '20px 0', justifyContent: 'center' }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Extra Connection (Auto / Bus / Train)
                </button>
              )}

              {leg.showSubLeg && (
                <div style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)', borderRadius: '12px', padding: '20px', margin: '20px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary-dark)' }}>Extra Travel Connection</span>
                    <button
                      type="button"
                      style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => {
                        updateLegField(leg.leg, 'showSubLeg', false);
                        updateLegField(leg.leg, 'sub_mode', '');
                        updateLegField(leg.leg, 'sub_amount', 0);
                        updateLegField(leg.leg, 'sub_bill', null);
                        updateLegField(leg.leg, 'prev_sub_bill', '');
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="form-grid-4">
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Mode <span className="req">*</span></label>
                      <select
                        value={leg.sub_mode}
                        onChange={(e) => updateLegField(leg.leg, 'sub_mode', e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                      >
                        <option value="">Select</option>
                        <option value="Auto">Auto</option>
                        <option value="Bus">Bus</option>
                        <option value="Train">Train</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>KM</label>
                      <input
                        type="number"
                        readOnly
                        value={0}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--surface-2)' }}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Amount (₹) <span className="req">*</span></label>
                      <input
                        type="number"
                        min="0"
                        value={leg.sub_amount}
                        onChange={(e) => updateLegField(leg.leg, 'sub_amount', parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                      />
                    </div>
                    {leg.sub_mode !== '' && (
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>
                          {leg.sub_mode} Bill Image <span className={leg.sub_mode === 'Train' || leg.sub_amount >= 300 ? 'req' : ''}>{leg.sub_mode === 'Train' || leg.sub_amount >= 300 ? '*' : ''}</span>
                        </label>
                        <div style={{ border: '1.5px dashed var(--border)', borderRadius: '8px', background: 'var(--surface)', padding: '10px', textAlign: 'center', position: 'relative', cursor: 'pointer', minHeight: '46px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                          <input
                            type="file"
                            accept="image/*"
                            required={!isEditMode && !leg.prev_sub_bill && (leg.sub_mode === 'Train' || leg.sub_amount >= 300)}
                            onChange={(e) => handleFileChange(leg.leg, 'sub_bill', e.target.files?.[0] || null)}
                            style={{ width: '100%', boxSizing: 'border-box', position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                          />
                          {!leg.prev_sub_bill ? (
                            <div>
                              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-3)', display: 'block', marginTop: '2px' }}>
                                {leg.sub_mode === 'Train' || leg.sub_amount >= 300 ? 'Required' : 'Optional'}
                              </span>
                            </div>
                          ) : (
                            <div className="preview-wrapper">
                              <img className="preview-img" src={leg.prev_sub_bill} alt="Sub Bill Preview" />
                              <button type="button" className="remove-img-btn" onClick={() => removeAttachedImage(leg.leg, 'sub_bill')}>×</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Leg 1 DA and Hotel info */}
              {isFirst && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '24px 0 16px', borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>DA &amp; Hotel Information</div>
                  <div className="form-grid-3">
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Daily Allowance (₹)</label>
                      <input
                        type="number"
                        readOnly
                        value={leg.da}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--surface-2)' }}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Hotel Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={leg.hotel}
                        onChange={(e) => handleHotelChange(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>
                        Hotel Bill Image <span className={leg.hotel > 0 ? 'req' : ''}>{leg.hotel > 0 ? '*' : ''}</span>
                      </label>
                      <div style={{ border: '1.5px dashed var(--border)', borderRadius: '8px', background: 'var(--surface-2)', padding: '10px', textAlign: 'center', position: 'relative', cursor: 'pointer', minHeight: '46px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <input
                          type="file"
                          accept="image/*"
                          required={!isEditMode && !leg.prev_hotel_bill && leg.hotel > 0}
                          onChange={(e) => handleFileChange(leg.leg, 'hotel_bill', e.target.files?.[0] || null)}
                          style={{ width: '100%', boxSizing: 'border-box', position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        />
                        {!leg.prev_hotel_bill ? (
                          <div>
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-3)', display: 'block', marginTop: '2px' }}>
                              {leg.hotel > 0 ? 'Required' : 'Optional'}
                            </span>
                          </div>
                        ) : (
                          <div className="preview-wrapper">
                            <img className="preview-img" src={leg.prev_hotel_bill} alt="Hotel Bill Preview" />
                            <button type="button" className="remove-img-btn" onClick={() => removeAttachedImage(leg.leg, 'hotel_bill')}>×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Work summary and other expense details */}
              {!((leg.to || '').includes('Home') || (leg.to || '').includes('Railway Station') || (leg.to || '').includes('Bus Station') || (leg.to || '').includes('Hotel')) && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '24px 0 16px', borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>Other Expenses</div>
                  <div className="form-grid-3">
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Other Expense Description</label>
                      <input
                        type="text"
                        placeholder="Describe..."
                        value={leg.oth_desc}
                        onChange={(e) => updateLegField(leg.leg, 'oth_desc', e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Other Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        disabled={!leg.oth_desc.trim()}
                        value={leg.oth_amount}
                        onChange={(e) => updateLegField(leg.leg, 'oth_amount', parseFloat(e.target.value) || 0)}
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px',
                          background: leg.oth_desc.trim() ? 'transparent' : 'var(--surface-2)'
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>
                        Other Bill Image <span className={leg.oth_amount >= 300 ? 'req' : ''}>{leg.oth_amount >= 300 ? '*' : ''}</span>
                      </label>
                      <div style={{ border: '1.5px dashed var(--border)', borderRadius: '8px', background: 'var(--surface-2)', padding: '10px', textAlign: 'center', position: 'relative', cursor: 'pointer', minHeight: '46px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <input
                          type="file"
                          accept="image/*"
                          required={!isEditMode && !leg.prev_oth_bill && leg.oth_amount >= 300}
                          onChange={(e) => handleFileChange(leg.leg, 'oth_bill', e.target.files?.[0] || null)}
                          style={{ width: '100%', boxSizing: 'border-box', position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        />
                        {!leg.prev_oth_bill ? (
                          <div>
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-3)', display: 'block', marginTop: '2px' }}>
                              {leg.oth_amount >= 300 ? 'Required' : 'Optional'}
                            </span>
                          </div>
                        ) : (
                          <div className="preview-wrapper">
                            <img className="preview-img" src={leg.prev_oth_bill} alt="Other Bill Preview" />
                            <button type="button" className="remove-img-btn" onClick={() => removeAttachedImage(leg.leg, 'oth_bill')}>×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '24px 0 16px', borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>Work Summary</div>
                  <div className="form-grid-4">
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Assigned Calls</label>
                      <input
                        type="number"
                        min="0"
                        value={leg.ws_assigned}
                        onChange={(e) => updateLegField(leg.leg, 'ws_assigned', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Closed Calls</label>
                      <input
                        type="number"
                        min="0"
                        value={leg.ws_closed}
                        onChange={(e) => updateLegField(leg.leg, 'ws_closed', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>PMS Completed</label>
                      <input
                        type="number"
                        min="0"
                        value={leg.ws_pms}
                        onChange={(e) => updateLegField(leg.leg, 'ws_pms', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>Asset Tagging</label>
                      <input
                        type="number"
                        min="0"
                        value={leg.ws_asset}
                        onChange={(e) => updateLegField(leg.leg, 'ws_asset', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ margin: '24px 0 0', borderTop: '1px dashed var(--border)', paddingTop: '20px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ verticalAlign: '-2px', marginRight: '4px' }}>
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                      <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
                    </svg>
                    Purpose of Visit <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Describe the purpose..."
                    value={leg.visit_purpose}
                    onChange={(e) => updateLegField(leg.leg, 'visit_purpose', e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px' }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {itineraries.length < 6 && (
          <button
            type="button"
            className="btn-add-location"
            onClick={addItineraryLeg}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', boxSizing: 'border-box', padding: '14px', background: 'transparent', border: '1.5px dashed var(--primary-light)', borderRadius: '12px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', marginBottom: '24px', transition: 'all 0.2s' }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Another Location <span className="add-hint" style={{ color: 'var(--text-3)', fontWeight: 500 }}>(Max 6)</span>
          </button>
        )}

        <div className="totals-bar" style={{ position: 'fixed', bottom: 0, left: 'var(--sidebar-w)', right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, boxShadow: '0 -4px 24px rgba(15,23,42,0.05)' }}>
          <div className="totals-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="total-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '99px', padding: '8px 16px', fontSize: '14px', fontWeight: 600 }}>
              <svg width="16" height="16" fill="none" stroke="var(--primary)" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Total KM: <strong>{totalKm.toFixed(1)} km</strong>
            </div>
          </div>
          <div className="totals-center">
            <p className="total-label">Total Claim Amount</p>
            <p className="total-amount">₹{totalAmt.toFixed(2)}</p>
          </div>
          <div className="totals-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/home')}>Cancel</button>
            <button type="button" className="btn btn-outline" onClick={() => setItineraries([createEmptyLeg(1, user.home_district)])}>Clear Form</button>
            <button type="submit" className={`btn btn-primary ${hasLimitExceeded ? 'btn-locked' : ''}`} id="btnSubmit">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{hasLimitExceeded ? 'Submission Locked' : 'Submit Expense'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Limit Approval request Modal */}
      {showApprovalModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={() => setShowApprovalModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ width: '56px', height: '56px', background: 'var(--warning-light)', color: 'var(--warning)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 style={{ textAlign: 'center', marginBottom: '8px', fontWeight: 800, fontSize: '20px', color: 'var(--primary-dark)' }}>Request Limit Extension</h3>

            <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.5 }}>
              {exceededType === 'KM' && existingKmReq ? (
                existingKmReq.status.toLowerCase() === 'rejected' ? 'Your manager has Rejected your limit extension request. You cannot claim expenses exceeding your limit for this month.' :
                existingKmReq.status.toLowerCase() === 'approved' ? 'You have already used your one-time limit extension for this month. You cannot exceed the limit further.' :
                `You have already submitted a KM limit request this month. Status: ${existingKmReq.status.toUpperCase()}`
              ) : exceededType === 'AUTO' && existingAutoReq ? (
                existingAutoReq.status.toLowerCase() === 'rejected' ? 'Your manager has Rejected your limit extension request. You cannot claim expenses exceeding your limit for this month.' :
                existingAutoReq.status.toLowerCase() === 'approved' ? 'You have already used your one-time limit extension for this month. You cannot exceed the limit further.' :
                `You have already submitted an AUTO limit request this month. Status: ${existingAutoReq.status.toUpperCase()}`
              ) : (
                `You have exceeded your monthly ${exceededType} limit. You must request a temporary extension of at least ${exceededType === 'AUTO' ? '₹' : ''}${missingAmount.toFixed(2)} ${exceededType === 'KM' ? 'km' : ''} to submit this expense.`
              )}
            </p>

            <div style={{ marginTop: '16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase' }}>Required Extension Amount</label>
              <input
                type="number"
                value={reqAdditional}
                onChange={(e) => setReqAdditional(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text)', background: 'var(--surface)' }}
              />
              <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-3)', fontSize: '12px' }}>This request will be sent to your Level 1 Manager for approval.</small>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowApprovalModal(false)}>Cancel</button>
              {!(exceededType === 'KM' ? existingKmReq : existingAutoReq) && (
                <button type="button" className="btn btn-primary" onClick={sendLimitRequest} style={{ background: 'var(--warning)', color: 'white', border: 'none', fontWeight: 600 }}>
                  Send Request to Manager
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Submission Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ width: '56px', height: '56px', background: 'var(--success-light)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ textAlign: 'center', marginBottom: '8px', fontWeight: 800, fontSize: '20px', color: 'var(--primary-dark)' }}>Confirm Submission</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '14px' }}>You are about to submit this expense claim.</p>
            <div style={{ marginTop: '20px', background: 'var(--surface-2)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Expense Date</span>
                <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{expDate}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Total Claim Amount</span>
                <strong style={{ fontSize: '20px', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>₹{totalAmt.toFixed(2)}</strong>
              </div>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowConfirmModal(false)}>Go Back</button>
              <button type="button" className="btn btn-primary" onClick={doSubmit} disabled={isSaving}>
                {isSaving ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div id="toastContainer" style={{ position: 'fixed', bottom: '80px', right: '24px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 }}>
        {toasts.map((toast, idx) => {
          let bg = 'var(--text)';
          if (toast.type === 'success') bg = 'var(--success)';
          if (toast.type === 'danger') bg = 'var(--danger)';
          if (toast.type === 'warning') bg = 'var(--warning)';

          return (
            <div
              key={idx}
              style={{
                background: 'white',
                color: bg,
                padding: '14px 20px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: 'var(--shadow-md)',
                borderLeft: `4px solid ${bg}`,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                pointerEvents: 'auto'
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
        onClose={() => navigate('/home')}
        actionLabel="Back to Dashboard"
      />
    </>
  );
}
