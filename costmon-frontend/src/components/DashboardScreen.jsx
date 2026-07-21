import { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { LayoutDashboard, Briefcase, Building2, ArrowLeft, TrendingUp, FileText, ZoomIn, ZoomOut, RotateCcw, Wallet, Receipt, Eye, EyeOff, Calendar, X, Download, FileSpreadsheet, BarChart2, PieChart as PieChartIcon, Settings } from 'lucide-react';
import { API_URL } from '../utils/Constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function DashboardScreen({ projects = [], disbursements = [], categories = [] }) {
  const [activeView, setActiveView] = useState('selection');

  // --- DYNAMIC OPR CONFIGURATION STATES ---
  const [overheadProjects, setOverheadProjects] = useState(['OFFICE', 'PAYATAS', 'RESIDENCE']);
  const [customColumns, setCustomColumns] = useState([
    { id: 'col_payroll', title: 'Payroll', mappedCategories: ['[MAIN] Payroll', 'Labor /SUBCONTRACTOR', 'Salaries & Wages'] },
    { id: 'col_electrical', title: 'Electrical Office/Payatas', mappedCategories: ['[MAIN] Electrical Office/Payatas', 'Light & Power'] },
    { id: 'col_water', title: 'Water/office/Payatas', mappedCategories: ['[MAIN] Water/office/Payatas', 'Water'] },
    { id: 'col_comms', title: 'Comunication/Telephone', mappedCategories: ['[MAIN] Comunication/Telephone', 'Communication'] },
    { id: 'col_retainer', title: 'Retainer', mappedCategories: ['[MAIN] Retainer', 'SOP/Retainer Fee'] },
    { id: 'col_supplies', title: 'Office supplies/Outing', mappedCategories: ['[MISC] Office supplies/Outing', 'Office Supplies'] },
    { id: 'col_car_repair', title: 'Car Repair & Maintenance', mappedCategories: ['[MISC] Car Repair & Maintenance', 'Repair & Maint.'] },
    { id: 'col_car_reg', title: 'Car Registration', mappedCategories: ['[MISC] Car Registration'] },
    { id: 'col_contribution', title: 'Contribution', mappedCategories: ['[MISC] Contribution'] }
  ]);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);

  // Hidden Projects State
  const [hiddenProjects, setHiddenProjects] = useState([]);
  const [hiddenMonths, setHiddenMonths] = useState([]);

  // Fetch preferences on mount
  useEffect(() => {
    const fetchPrefs = async () => {
      const token = sessionStorage.getItem('fbtmcc_token');
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/users/preferences`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.dashboard_custom_columns) setCustomColumns(data.dashboard_custom_columns);
          if (data.dashboard_overhead_projects) setOverheadProjects(data.dashboard_overhead_projects);
          if (data.dashboard_hidden_projects) setHiddenProjects(data.dashboard_hidden_projects);
          if (data.dashboard_hidden_months) setHiddenMonths(data.dashboard_hidden_months);
        }
      } catch (err) {
        console.error("Failed to fetch preferences", err);
      }
    };
    fetchPrefs();
  }, []);

  const saveColumnConfig = async () => {
    if (!editingColumn) return;
    const updated = customColumns.map(col => col.id === editingColumn.id ? editingColumn : col);
    setCustomColumns(updated);
    setIsColumnModalOpen(false);

    const token = sessionStorage.getItem('fbtmcc_token');
    if (token) {
      fetch(`${API_URL}/users/preferences`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_custom_columns: updated })
      }).catch(console.error);
    }
  };

  const toggleProjectSelection = (code) => {
    const updated = overheadProjects.includes(code)
      ? overheadProjects.filter(p => p !== code)
      : [...overheadProjects, code];
    setOverheadProjects(updated);

    const token = sessionStorage.getItem('fbtmcc_token');
    if (token) {
      fetch(`${API_URL}/users/preferences`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_overhead_projects: updated })
      }).catch(console.error);
    }
  };

  const toggleProjectVisibility = (code) => {
    const updated = hiddenProjects.includes(code)
      ? hiddenProjects.filter(p => p !== code)
      : [...hiddenProjects, code];
    setHiddenProjects(updated);

    const token = sessionStorage.getItem('fbtmcc_token');
    if (token) {
      fetch(`${API_URL}/users/preferences`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_hidden_projects: updated })
      }).catch(console.error);
    }
  };

  const toggleMonthVisibility = (monthKey) => {
    const updated = hiddenMonths.includes(monthKey)
      ? hiddenMonths.filter(m => m !== monthKey)
      : [...hiddenMonths, monthKey];
    setHiddenMonths(updated);

    const token = sessionStorage.getItem('fbtmcc_token');
    if (token) {
      fetch(`${API_URL}/users/preferences`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_hidden_months: updated })
      }).catch(console.error);
    }
  };

  // State para i-toggle ang Additional Works breakdown columns
  const [showAdditionalWorks, setShowAdditionalWorks] = useState(true);

  // Loading states para sa exports
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // BAGO: Loading states at Ref para sa Office Exports
  const [isExportingOfficeExcel, setIsExportingOfficeExcel] = useState(false);

  const projectTableRef = useRef(null);
  const officeTableRef = useRef(null); // Ref para sa Office Table

  // Date Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Office Dashboard Isolated Year Filter State
  const [officeYear, setOfficeYear] = useState(() => new Date().getFullYear().toString());

  const availableYears = useMemo(() => {
    const years = new Set();
    projects.forEach(p => {
      if (p.project_start && String(p.project_start).trim()) {
        const d = new Date(p.project_start);
        if (!isNaN(d.getTime())) years.add(d.getFullYear().toString());
      }
    });
    disbursements.forEach(d => {
      if (d.date && String(d.date).trim()) {
        const dDate = new Date(d.date);
        if (!isNaN(dDate.getTime())) years.add(dDate.getFullYear().toString());
      }
    });
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [projects, disbursements]);

  // --- ZOOM LOGIC ---
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('dashboard_zoom');
    return saved ? parseFloat(saved) : 1;
  });

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const next = Math.min(prev + 0.1, 1.5);
      localStorage.setItem('dashboard_zoom', next.toString());
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.1, 0.5);
      localStorage.setItem('dashboard_zoom', next.toString());
      return next;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    localStorage.setItem('dashboard_zoom', '1');
  };

  const formatMoney = (val) => {
    if (val === 0 || val === null || val === undefined) return '-';
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ==========================================
  // EXPORT TO EXCEL FUNCTION (PROJECTS)
  // ==========================================
  const downloadProjectExcel = async () => {
    try {
      setIsExportingExcel(true);
      
      const payload = {
        projectData,
        dateFilterLabel
      };

      const token = sessionStorage.getItem('fbtmcc_token');
      const response = await fetch(`${API_URL}/project-ledger/export-styled`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errMsg = 'Export failed.';
        try { const d = await response.json(); errMsg = d.error || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }

      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `PROJECT_MASTER_SPREADSHEET_${Date.now()}.xlsx`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Failed to export Excel file:", error);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // ==========================================
  // EXPORT TO PDF FUNCTION (PROJECTS)
  // ==========================================


  // ==========================================
  // EXPORT TO EXCEL FUNCTION (OFFICE — UNIFIED)
  // ==========================================
  const downloadOfficeExcel = async () => {
    try {
      setIsExportingOfficeExcel(true);

      const params = new URLSearchParams({
        year: officeYear,
        overheadProjects: overheadProjects.join(','),
        customColumns: JSON.stringify(customColumns),
        hiddenProjects: JSON.stringify(hiddenProjects),
        hiddenMonths: JSON.stringify(hiddenMonths)
      });

      const token = sessionStorage.getItem('fbtmcc_token');
      const response = await fetch(`${API_URL}/office-ledger/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        let errMsg = 'Export failed.';
        try { const d = await response.json(); errMsg = d.error || errMsg; } catch (_) { }
        throw new Error(errMsg);
      }

      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `MONTHLY_MASTER_LEDGER_${Date.now()}.xlsx`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Failed to export Office Ledger Excel file:", error);
    } finally {
      setIsExportingOfficeExcel(false);
    }
  };



  // ==========================================
  // DATE LABEL FORMATTER (Tinanggal ang useMemo)
  // ==========================================
  let dateFilterLabel = null;
  if (startDate || endDate) {
    const formatOpts = { month: 'short', day: 'numeric', year: 'numeric' };
    const s = startDate ? new Date(startDate).toLocaleDateString('en-US', formatOpts) : 'Start';
    const e = endDate ? new Date(endDate).toLocaleDateString('en-US', formatOpts) : 'Present';
    dateFilterLabel = `${s} to ${e}`;
  }

  // ==========================================
  // PRE-FILTER DISBURSEMENTS BY DATE
  // ==========================================
  const filteredDisbursements = useMemo(() => {
    if (!startDate && !endDate) return disbursements;

    return disbursements.filter(d => {
      if (!d.date) return false;
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);

      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (dDate < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(0, 0, 0, 0);
        if (dDate > eDate) return false;
      }
      return true;
    });
  }, [disbursements, startDate, endDate]);

  // ==========================================
  // CALCULATIONS BASED ON YOUR TABLE IMAGES
  // ==========================================
  const { officeData, projectData, unifiedData, officeTotalBudget, projectTotalBudget, totalCompanyExpenses } = useMemo(() => {
    const office = [];
    const projs = [];
    let oBudget = 0;
    let pBudget = 0;
    let totalExp = 0;

    // 1. Identify project codes where project_type is 'Office'
    const officeProjectCodes = new Set(
      projects.filter(p => p.project_type === 'Office').map(p => p.project_code.toUpperCase())
    );

    // 2. Compute construction projects data
    projects.forEach(p => {
      if (p.project_type === 'Office') {
        return; // Office is handled by disbursements below
      }

      const projExpenses = filteredDisbursements.filter(d =>
        d.project_code && d.project_code.toUpperCase() === p.project_code.toUpperCase()
      );

      const getCategoryTotal = (keyword) => {
        return projExpenses.reduce((total, d) => {
          const lineTotal = (d.expenses || [])
            .filter(e => e.category && e.category.toLowerCase().includes(keyword.toLowerCase()))
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
          return total + lineTotal;
        }, 0);
      };

      const additionalExpensesList = [];
      let TAW = 0;

      projExpenses.filter(d => d.costing_type === 'additional').forEach(d => {
        (d.expenses || []).forEach(exp => {
          const amt = parseFloat(exp.amount) || 0;
          TAW += amt;
          additionalExpensesList.push({
            particulars: exp.particulars || exp.category || 'Additional Work',
            amount: amt
          });
        });
      });

      const ADLM = projExpenses
        .filter(d => d.costing_type === 'normal' || !d.costing_type)
        .reduce((sum, d) => sum + (d.expenses || []).reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0), 0);

      const totalExpense = TAW + ADLM;
      totalExp += totalExpense;

      const CC = parseFloat(p.contract_cost) || 0;
      const TCC = CC + TAW;
      const VAT_12 = TCC * (1 - (1 / 1.12));
      const CC_WITHOUT_VAT = TCC - VAT_12;

      const OH_30 = (TCC / 1.3) * 0.30;
      const OH_20 = (TCC / 1.2) * 0.20;
      const OH_12 = (TCC / 1.12) * 0.12;

      const TARGET_DLM_30 = CC_WITHOUT_VAT - OH_30;
      const TARGET_DLM_20 = CC_WITHOUT_VAT - OH_20;
      const TARGET_DLM_12 = CC_WITHOUT_VAT - OH_12;

      const SAVING_30 = TARGET_DLM_30 - ADLM;
      const SAVING_20 = TARGET_DLM_20 - ADLM;
      const SAVING_12 = TARGET_DLM_12 - ADLM;

      const RETENTION_10 = TCC * 0.10;
      const CC_WO_VAT_OH_PM = CC_WITHOUT_VAT - OH_30;
      const EFFECTIVE_OVERHEAD = OH_30;

      let total_specific_expenses = 0;
      const dynamicExpenses = {};

      // STRICT FILTERING: Only include records from 'OFFICE', 'PAYATAS', 'RESIDENCE' projects
      const overheadProjExpenses = projExpenses.filter(d =>
        d.project_code && overheadProjects.some(kw =>
          d.project_code.toUpperCase() === kw.toUpperCase()
        )
      );

      customColumns.forEach(col => {
        const sum = overheadProjExpenses.reduce((total, d) => {
          const lineTotal = (d.expenses || [])
            .filter(e => {
              if (!e.category) return false;
              return col.mappedCategories.some(kw => {
                const eClean = String(e.category).toLowerCase().replace(/[^a-z0-9]/g, '');
                const kClean = String(kw).toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!eClean || !kClean) return false;
                return eClean.includes(kClean) || kClean.includes(eClean);
              });
            })
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
          return total + lineTotal;
        }, 0);
        dynamicExpenses[col.id] = sum;
        total_specific_expenses += sum;
      });

      // -----------------------------------------------
      // NEW: D5-based formula columns for unified table
      // D5 = TCC (Contract + Additional Works + VAT)
      // -----------------------------------------------
      const CONTRACT_WO_VAT = TCC / 1.12;
      const CONTRACT_WO_VAT_OH_PM = CONTRACT_WO_VAT / 1.3;
      const EQ_30_OH = CONTRACT_WO_VAT_OH_PM * 0.3;
      const EQ_10_RETENTION = TCC * 0.1;
      const EFFECTIVE_OH = EQ_30_OH - EQ_10_RETENTION;

      // The project's contribution to Net Profit in the Unified Ledger is its Effective Overhead
      const NET_PROFIT = EFFECTIVE_OH;

      const computedData = {
        ...p,
        CC, TAW, additionalExpensesList, TCC, VAT_12, CC_WITHOUT_VAT,
        OH_30, OH_20, OH_12,
        TARGET_DLM_30, TARGET_DLM_20, TARGET_DLM_12,
        ADLM, SAVING_30, SAVING_20, SAVING_12,

        NET_PROFIT, RETENTION_10, CC_WO_VAT_OH_PM, EFFECTIVE_OVERHEAD,
        total_specific_expenses, ...dynamicExpenses,

        // Unified table D5-based formula columns
        CONTRACT_WO_VAT,
        CONTRACT_WO_VAT_OH_PM,
        EQ_30_OH,
        EQ_10_RETENTION,
        EFFECTIVE_OH
      };

      projs.push(computedData);
      pBudget += CC;
    });

    // 3. Filter and map office disbursements (for existing officeData — summary cards still use this)
    const officeDisbursements = filteredDisbursements.filter(d =>
      d.project_code && officeProjectCodes.has(d.project_code.toUpperCase())
    );

    officeDisbursements.forEach(d => {
      const getDisbCategoryTotal = (keywords) => {
        return (d.expenses || [])
          .filter(e => e.category && keywords.some(kw => e.category.toLowerCase().includes(kw.toLowerCase())))
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      };

      let total_specific_expenses = 0;
      const dynamicExpenses = {};
      customColumns.forEach(col => {
        const sum = (d.expenses || [])
          .filter(e => {
            if (!e.category) return false;
            return col.mappedCategories.some(kw => {
              const eClean = String(e.category).toLowerCase().replace(/[^a-z0-9]/g, '');
              const kClean = String(kw).toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!eClean || !kClean) return false;
              return eClean.includes(kClean) || kClean.includes(eClean);
            });
          })
          .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        dynamicExpenses[col.id] = sum;
        total_specific_expenses += sum;
      });
      const NET_PROFIT = 0 - total_specific_expenses;

      office.push({
        id: d.id,
        project_start: d.date,
        project_code: d.project_code,
        project_name: 'Office Expense',
        CC: 0,
        TAW: 0,
        additionalExpensesList: [],
        TCC: 0,
        VAT_12: 0,
        CC_WITHOUT_VAT: 0,
        OH_30: 0,
        OH_20: 0,
        OH_12: 0,
        TARGET_DLM_30: 0,
        TARGET_DLM_20: 0,
        TARGET_DLM_12: 0,
        ADLM: 0,
        SAVING_30: 0,
        SAVING_20: 0,
        SAVING_12: 0,
        NET_PROFIT,
        RETENTION_10: 0,
        CC_WO_VAT_OH_PM: 0,
        EFFECTIVE_OVERHEAD: 0,
        total_specific_expenses,
        ...dynamicExpenses
      });

      totalExp += total_specific_expenses;
    });

    // ============================================================
    // 4. BUILD UNIFIED DATA: All Disbursements (Expense rows) +
    //    All Construction Projects (Project rows), sorted by Date
    // ============================================================

    // Expense rows: ALL disbursements (regardless of project_type)
    const expenseRows = filteredDisbursements.map(d => {
      const getDisbCategoryTotal = (keywords) => {
        return (d.expenses || [])
          .filter(e => e.category && keywords.some(kw => e.category.toLowerCase().includes(kw.toLowerCase())))
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      };

      let total_specific_expenses = 0;
      const dynamicExpenses = {};
      customColumns.forEach(col => {
        const sum = (d.expenses || [])
          .filter(e => {
            if (!e.category) return false;
            return col.mappedCategories.some(kw => {
              const eClean = String(e.category).toLowerCase().replace(/[^a-z0-9]/g, '');
              const kClean = String(kw).toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!eClean || !kClean) return false;
              return eClean.includes(kClean) || kClean.includes(eClean);
            });
          })
          .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        dynamicExpenses[col.id] = sum;
        total_specific_expenses += sum;
      });
      const NET_PROFIT = 0 - total_specific_expenses;

      return {
        rowType: 'expense',
        id: `expense-${d.id}`,
        date: d.date || null,
        project_code: d.project_code,
        project_name: d.particulars || d.payee || 'Expense Record',
        total_specific_expenses,
        NET_PROFIT,
        ...dynamicExpenses,
        // Project formula columns are not applicable → null
        TCC: null,
        CONTRACT_WO_VAT: null,
        CONTRACT_WO_VAT_OH_PM: null,
        EQ_30_OH: null,
        EQ_10_RETENTION: null,
        EFFECTIVE_OH: null,
      };
    });

    // Project rows: ALL construction projects
    const projectRows = projs.map(p => ({
      rowType: 'project',
      id: `project-${p.id}`,
      date: (p.project_start && String(p.project_start).trim()) ? p.project_start : null,
      project_code: p.project_code,
      project_name: p.project_name,
      total_specific_expenses: p.total_specific_expenses,
      NET_PROFIT: p.NET_PROFIT,
      TCC: p.TCC,
      CONTRACT_WO_VAT: p.CONTRACT_WO_VAT,
      CONTRACT_WO_VAT_OH_PM: p.CONTRACT_WO_VAT_OH_PM,
      EQ_30_OH: p.EQ_30_OH,
      EQ_10_RETENTION: p.EQ_10_RETENTION,
      EFFECTIVE_OH: p.EFFECTIVE_OH,
      // Expense columns are not applicable → null
      exp_payroll: null,
      exp_electrical: null,
      exp_water: null,
      exp_comms: null,
      exp_retainer: null,
      exp_supplies: null,
      exp_car_repair: null,
      exp_car_reg: null,
      exp_contribution: null,
    }));

    const merged = [...projectRows, ...expenseRows];

    // Sort: rows WITH a date first (ascending), rows WITHOUT date pushed to the bottom
    merged.sort((a, b) => {
      const hasA = a.date && String(a.date).trim();
      const hasB = b.date && String(b.date).trim();
      if (!hasA && !hasB) return 0;
      if (!hasA) return 1;  // a has no date → push to bottom
      if (!hasB) return -1; // b has no date → push to bottom
      return new Date(a.date) - new Date(b.date); // ascending by date
    });

    return {
      officeData: office,
      projectData: projs,
      unifiedData: merged,
      officeTotalBudget: oBudget,
      projectTotalBudget: pBudget,
      totalCompanyExpenses: totalExp
    };
  }, [projects, filteredDisbursements, customColumns]);

  // ================================================================
  // MONTHLY TABLE ROWS
  // Groups construction projects by month.
  // Aggregates OFFICE/PAYATAS/RESIDENCE disbursements per month.
  // Produces: [project row, project row, ..., monthly_total row] per month.
  // ================================================================
  const monthlyTableRows = useMemo(() => {
    // ── 1. Filter & aggregate expenses by month using overheadProjects ──
    const oprDisb = filteredDisbursements.filter(d =>
      d.project_code && overheadProjects.some(kw =>
        d.project_code.toUpperCase() === kw.toUpperCase()
      )
    );

    const expsByMonth = {};
    oprDisb.forEach(d => {
      const mk = d.date && String(d.date).trim() ? String(d.date).slice(0, 7) : '__unscheduled__';
      if (!expsByMonth[mk]) {
        expsByMonth[mk] = {};
        // Initialize dynamic column totals
        customColumns.forEach(col => {
          expsByMonth[mk][col.id] = 0;
        });
      }

      (d.expenses || []).forEach(e => {
        if (!e.category) return;
        customColumns.forEach(col => {
          // More robust matching: ignore case, spaces, and punctuation. Allow two-way substring matching.
          if (col.mappedCategories.some(kw => {
            const eClean = String(e.category).toLowerCase().replace(/[^a-z0-9]/g, '');
            const kClean = String(kw).toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!eClean || !kClean) return false;
            return eClean.includes(kClean) || kClean.includes(eClean);
          })) {
            expsByMonth[mk][col.id] += (parseFloat(e.amount) || 0);
          }
        });
      });
    });

    // ── 2. Create dynamic months array based on actual data ──
    const monthKeysSet = new Set();

    // Gather all months from projects
    projectData.forEach(p => {
      const d = p.project_start;
      const mk = (d && String(d).trim()) ? String(d).slice(0, 7) : '__unscheduled__';
      monthKeysSet.add(mk);
    });

    // Gather all months from office expenses
    Object.keys(expsByMonth).forEach(mk => monthKeysSet.add(mk));

    // Filter months by officeYear if isolated year filter is active
    let monthKeysArray = Array.from(monthKeysSet);
    if (officeYear !== 'All') {
      monthKeysArray = monthKeysArray.filter(mk => mk.startsWith(officeYear) || mk === '__unscheduled__');
    }

    // Filter out hidden months
    monthKeysArray = monthKeysArray.filter(mk => !hiddenMonths.includes(mk));

    const monthsNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const allMonths = monthKeysArray.map(mk => {
      if (mk === '__unscheduled__') return { mk, label: 'NO MONTHS' };
      const [y, m] = mk.split('-');
      const mIdx = parseInt(m, 10) - 1;
      return { mk, label: `${monthsNames[mIdx] ? monthsNames[mIdx].toUpperCase() : 'UNK'}` };
    });

    // Sort chronologically (oldest to newest, unscheduled at the bottom)
    allMonths.sort((a, b) => {
      if (a.mk === '__unscheduled__') return 1;
      if (b.mk === '__unscheduled__') return -1;
      return a.mk.localeCompare(b.mk);
    });

    const rows = [];
    allMonths.forEach(({ mk, label }) => {
      const projs = projectData.filter(p => {
        const d = p.project_start;
        const projectMk = (d && String(d).trim()) ? String(d).slice(0, 7) : '__unscheduled__';
        return projectMk === mk && !hiddenProjects.includes(p.project_code);
      });

      const exps = expsByMonth[mk] || {};
      const monthLabel = label;

      // Hide empty months
      const dynamicExpensesSum = Object.values(exps).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      if (projs.length === 0 && dynamicExpensesSum === 0) {
        return;
      }

      rows.push({
        rowType: 'month_header',
        id: `header-${mk}`,
        monthKey: mk,
        monthLabel
      });

      projs.forEach(p => {
        rows.push({
          rowType: 'project',
          id: p.project_code,
          project_code: p.project_code,
          project_name: p.project_name,
          monthKey: mk,
          monthLabel: null,
          TCC: p.TCC || 0,
          CONTRACT_WO_VAT: p.CONTRACT_WO_VAT || 0,
          CONTRACT_WO_VAT_OH_PM: p.CONTRACT_WO_VAT_OH_PM || 0,
          EQ_30_OH: p.EQ_30_OH || 0,
          EQ_10_RETENTION: p.EQ_10_RETENTION || 0,
          EFFECTIVE_OH: p.EFFECTIVE_OH || 0,
          total_specific_expenses: p.total_specific_expenses || 0,
          NET_PROFIT: p.NET_PROFIT || 0,
        });
      });

      const zero = {
        TCC: 0, CONTRACT_WO_VAT: 0, CONTRACT_WO_VAT_OH_PM: 0,
        EQ_30_OH: 0, EQ_10_RETENTION: 0, EFFECTIVE_OH: 0,
        total_specific_expenses: 0, NET_PROFIT: 0
      };
      const projSums = projs.reduce((acc, p) => ({
        TCC: acc.TCC + (p.TCC || 0),
        CONTRACT_WO_VAT: acc.CONTRACT_WO_VAT + (p.CONTRACT_WO_VAT || 0),
        CONTRACT_WO_VAT_OH_PM: acc.CONTRACT_WO_VAT_OH_PM + (p.CONTRACT_WO_VAT_OH_PM || 0),
        EQ_30_OH: acc.EQ_30_OH + (p.EQ_30_OH || 0),
        EQ_10_RETENTION: acc.EQ_10_RETENTION + (p.EQ_10_RETENTION || 0),
        EFFECTIVE_OH: acc.EFFECTIVE_OH + (p.EFFECTIVE_OH || 0),
        total_specific_expenses: acc.total_specific_expenses + (p.total_specific_expenses || 0),
        NET_PROFIT: acc.NET_PROFIT + (p.NET_PROFIT || 0),
      }), zero);

      // Sum all dynamic expenses for the monthly total
      projSums.total_specific_expenses += dynamicExpensesSum;
      projSums.NET_PROFIT -= dynamicExpensesSum;

      rows.push({
        rowType: 'monthly_total',
        id: `total-${mk}`,
        monthKey: mk,
        monthLabel,
        ...projSums,
        ...exps,
      });
    });

    return rows;
  }, [projectData, filteredDisbursements, overheadProjects, customColumns, officeYear, hiddenProjects, hiddenMonths]);

  const grandTotals = useMemo(() => {
    const totals = {
      TCC: 0,
      CONTRACT_WO_VAT: 0,
      CONTRACT_WO_VAT_OH_PM: 0,
      EQ_30_OH: 0,
      EQ_10_RETENTION: 0,
      EFFECTIVE_OH: 0,
      NET_PROFIT: 0,
      total_specific_expenses: 0,
    };
    
    customColumns.forEach(col => {
      totals[col.id] = 0;
    });

    monthlyTableRows.forEach(row => {
      if (row.rowType === 'monthly_total') {
        totals.TCC += row.TCC || 0;
        totals.CONTRACT_WO_VAT += row.CONTRACT_WO_VAT || 0;
        totals.CONTRACT_WO_VAT_OH_PM += row.CONTRACT_WO_VAT_OH_PM || 0;
        totals.EQ_30_OH += row.EQ_30_OH || 0;
        totals.EQ_10_RETENTION += row.EQ_10_RETENTION || 0;
        totals.EFFECTIVE_OH += row.EFFECTIVE_OH || 0;
        totals.NET_PROFIT += row.NET_PROFIT || 0;
        totals.total_specific_expenses += row.total_specific_expenses || 0;
        
        customColumns.forEach(col => {
          totals[col.id] += row[col.id] || 0;
        });
      }
    });
    
    return totals;
  }, [monthlyTableRows, customColumns]);

  const summaryCards = [
    { title: "Active Projects", value: `${projectData.length} Sites`, icon: <Briefcase size={28} />, colorClass: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800" },
    { title: "Office Departments", value: `${monthlyTableRows.filter(r => r.rowType === 'project' && r.monthKey !== '__unscheduled__').length} Records`, icon: <Building2 size={28} />, colorClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" },
    { title: "Overall Allocated Budget", value: `₱ ${formatMoney(projectTotalBudget + officeTotalBudget)}`, icon: <Wallet size={28} />, colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800" },
    { title: "Total Expenses (Filtered)", value: `₱ ${formatMoney(totalCompanyExpenses)}`, icon: <Receipt size={28} />, colorClass: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800" }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-950 overflow-hidden transition-colors duration-300">

      {/* HEADER WITH DATE FILTER */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6 flex flex-col xl:flex-row xl:items-center justify-between shrink-0 shadow-sm z-10 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <div className="bg-indigo-600 dark:bg-indigo-700 p-2 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <LayoutDashboard size={28} />
            </div>
            FINANCIAL DASHBOARD
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Company Health & Projects Analytics</p>
        </div>

        {/* DATE FILTER */}
        {activeView !== 'office' && (
          <div className="flex items-center bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm gap-2 w-fit">
            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-800">
              <Calendar size={20} />
            </div>
            <div className="flex items-center gap-3 px-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Date From</span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer dark:[color-scheme:dark]"
                />
              </div>
              <span className="text-slate-300 dark:text-slate-600 font-black mt-2">-</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Date To</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer dark:[color-scheme:dark]"
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors ml-1"
                title="Clear Filter"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">

        {/* ==============================================
            VIEW 1: SELECTION MENU WITH SUMMARY CARDS
        ============================================== */}
        {activeView === 'selection' && (
          <div className="max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white">At a Glance</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Quick summary of FBTMCC's overall financial data
                  {startDate || endDate ? <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-1">(Filtered)</span> : ''}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
              {summaryCards.map((card, idx) => (
                <div key={idx} className="bg-white dark:bg-[#0a0a0a] p-6 rounded-[1.5rem] shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 transition-colors">
                  <div className={`p-4 rounded-2xl border shadow-inner ${card.colorClass}`}>
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{card.title}</p>
                    <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{card.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800/50 mb-12"></div>

            <div className="text-center mb-8">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Detailed Ledgers</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Choose your master spreadsheet.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto">
              <button onClick={() => setActiveView('projects')} className="group bg-white dark:bg-[#0a0a0a] p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-[#0f0f15] transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors"></div>
                <div className="bg-slate-100 dark:bg-slate-900 p-5 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner relative z-10"><Briefcase size={36} strokeWidth={2.5} /></div>
                <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100 relative z-10">Projects Analytics</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium text-sm relative z-10">Detailed cost monitoring, savings, and overhead breakdown for construction sites.</p>
              </button>

              <button onClick={() => setActiveView('office')} className="group bg-white dark:bg-[#0a0a0a] p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-[#141005] transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/10 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors"></div>
                <div className="bg-slate-100 dark:bg-slate-900 p-5 rounded-2xl text-amber-600 dark:text-amber-400 mb-6 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner relative z-10"><Building2 size={36} strokeWidth={2.5} /></div>
                <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100 relative z-10">Office & Admin</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium text-sm relative z-10">Internal operations, payroll, and maintenance tracking for the main office.</p>
              </button>

              <button onClick={() => setActiveView('charts')} className="group bg-white dark:bg-[#0a0a0a] p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500/50 hover:bg-violet-50/30 dark:hover:bg-[#0f0f1a] transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 dark:bg-violet-900/10 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors"></div>
                <div className="bg-slate-100 dark:bg-slate-900 p-5 rounded-2xl text-violet-600 dark:text-violet-400 mb-6 group-hover:bg-violet-600 group-hover:text-white transition-all shadow-inner relative z-10"><BarChart2 size={36} strokeWidth={2.5} /></div>
                <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100 relative z-10">Charts & Trends</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium text-sm relative z-10">Visual analytics: spending trends, category breakdown, and budget vs actual.</p>
              </button>
            </div>
          </div>
        )}

        {/* ==============================================
            VIEW: CHARTS & TRENDS
        ============================================== */}
        {activeView === 'charts' && (() => {
          // Monthly Spending Trend
          const monthlyMap = {};
          filteredDisbursements.forEach(d => {
            if (!d.date) return;
            const key = d.date.slice(0, 7);
            monthlyMap[key] = (monthlyMap[key] || 0) + (d.gross_amount || 0);
          });
          const monthlyData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, total]) => ({
            month: new Date(month + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' }),
            total: Math.round(total)
          }));

          // Category Distribution
          const catMap = {};
          filteredDisbursements.forEach(d => {
            const expenses = d.expenses || [];
            expenses.forEach(e => {
              if (e.amount > 0) catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
            });
          });
          const catData = Object.entries(catMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, value: Math.round(value) }));
          const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#f97316'];

          // Budget vs Actual
          const budgetData = projects.filter(p => p.project_type !== 'Office').map(p => {
            const actual = filteredDisbursements.filter(d => d.project_code === p.project_code).reduce((s, d) => s + (d.gross_amount || 0), 0);
            return { name: p.project_code, Budget: Math.round(p.contract_cost || 0), Actual: Math.round(actual) };
          }).filter(d => d.Budget > 0 || d.Actual > 0);

          const fmtPeso = (v) => v >= 1000000 ? '₱' + (v / 1000000).toFixed(1) + 'M' : '₱' + (v / 1000).toFixed(0) + 'K';
          const CustomTooltip = ({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3">
              <p className="font-black text-slate-800 dark:text-white text-sm mb-1">{label}</p>
              {payload.map((p, i) => <p key={i} style={{ color: p.color }} className="text-xs font-bold">{'₱' + Number(p.value).toLocaleString()}</p>)}
            </div>);
          };
          const PieTooltip = ({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return (<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3">
              <p className="font-black text-slate-800 dark:text-white text-xs">{payload[0].name}</p>
              <p className="text-xs font-bold text-violet-600 dark:text-violet-400">₱{Number(payload[0].value).toLocaleString()}</p>
              <p className="text-xs text-slate-400">{(payload[0].percent * 100).toFixed(1)}% of total</p>
            </div>);
          };

          return (
            <div className="animate-in slide-in-from-right-8 duration-500 space-y-6">
              <button onClick={() => setActiveView('selection')} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-violet-600 transition-colors bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border dark:border-slate-800">
                <ArrowLeft size={16} /> Back to Selection
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"><BarChart2 size={22} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">Charts & Trends</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{filteredDisbursements.length} disbursements in view {dateFilterLabel ? '· ' + dateFilterLabel : '(all-time)'}</p>
                </div>
              </div>

              {/* Chart 1: Monthly Spending Trend */}
              <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h3 className="font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-violet-500" /> Monthly Spending Trend</h3>
                {monthlyData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-600 italic text-sm">No spending data available for the selected period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis tickFormatter={fmtPeso} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} name="Total Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Charts 2+3 side by side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Chart 2: Category Pie */}
                <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                  <h3 className="font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2"><PieChartIcon size={18} className="text-violet-500" /> Expense Category Breakdown (Top 10)</h3>
                  {catData.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-600 italic text-sm">No category data available.</div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={catData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2} nameKey="name">
                            {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 w-full">
                        {catData.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                            <span className="text-slate-600 dark:text-slate-400 truncate font-medium" title={d.name}>{d.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chart 3: Budget vs Actual */}
                <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                  <h3 className="font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Wallet size={18} className="text-violet-500" /> Budget vs Actual per Project</h3>
                  {budgetData.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-600 italic text-sm">No project data available.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={budgetData} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <YAxis tickFormatter={fmtPeso} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                        <Bar dataKey="Budget" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Actual" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ==============================================
            VIEW 2: PROJECTS TABLE
        ============================================== */}
        {activeView === 'projects' && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-6">
            <button onClick={() => setActiveView('selection')} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border dark:border-slate-800">
              <ArrowLeft size={16} /> Back to Selection
            </button>

            <section ref={projectTableRef} className="bg-white dark:bg-[#0a0a0a] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-colors duration-300">
              <div className="px-8 py-4 bg-indigo-600 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <TrendingUp size={24} />
                  <h2 className="text-xl font-black uppercase tracking-widest leading-tight">Project Master Spreadsheet</h2>

                  {dateFilterLabel && (
                    <div className="hidden sm:flex items-center px-3 py-1 bg-white/10 rounded-full border border-white/20 shadow-sm gap-2">
                      <Calendar size={12} className="opacity-80" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{dateFilterLabel}</span>
                    </div>
                  )}
                </div>

                {/* CONTROLS AREA */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">

                  {/* EXCEL EXPORT (STYLED) */}
                  <button onClick={downloadProjectExcel} disabled={isExportingExcel}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors font-bold text-sm shadow-sm">
                    <Download size={16} className={isExportingExcel ? 'animate-pulse' : ''} />
                    {isExportingExcel ? 'Exporting...' : 'Export Excel'}
                  </button>

                  {/* ZOOM MODULE */}
                  <div className="flex items-center bg-black/20 rounded-xl px-2 py-1 gap-1 backdrop-blur-sm border border-white/10">
                    <button onClick={handleZoomOut} className="p-1 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30" disabled={zoomLevel <= 0.6}>
                      <ZoomOut size={16} />
                    </button>
                    <div className="text-[10px] font-black w-10 text-center select-none uppercase tracking-tighter">
                      {Math.round(zoomLevel * 100)}%
                    </div>
                    <button onClick={handleZoomIn} className="p-1 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30" disabled={zoomLevel >= 1.5}>
                      <ZoomIn size={16} />
                    </button>
                    <div className="w-px h-3 bg-white/20 mx-1"></div>
                    <button onClick={resetZoom} className="p-1 hover:bg-white/20 rounded-lg transition-colors" title="Reset Zoom">
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {dateFilterLabel && (
                <div className="sm:hidden px-8 py-2 bg-indigo-700 text-white flex items-center gap-2 border-b border-indigo-500/50">
                  <Calendar size={12} className="opacity-80" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{dateFilterLabel}</span>
                </div>
              )}

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[2800px]" style={{ zoom: zoomLevel }}>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter border-b border-slate-300 dark:border-slate-700">
                      <th className="p-4 sticky left-0 z-20 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">Code</th>
                      <th className="p-4 sticky left-[80px] z-20 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 w-[200px]">Store Name</th>
                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Contract cost (CC)</th>

                      {showAdditionalWorks && (
                        <>
                          <th className="p-4 text-center border-r border-slate-200 dark:border-slate-700 w-[200px] relative">
                            <div className="absolute top-2 right-2 flex items-center justify-center group z-30">
                              <button onClick={() => setShowAdditionalWorks(false)} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <EyeOff size={14} />
                              </button>
                              <div className="absolute bottom-full mb-2 right-0 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-slate-700">
                                Hide Add'l Works
                              </div>
                            </div>
                            Additional Works
                          </th>
                          <th className="p-4 text-center border-r border-slate-200 dark:border-slate-700 w-[120px]">Amount</th>
                        </>
                      )}

                      <th className="p-4 text-center bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400 relative">
                        {!showAdditionalWorks && (
                          <div className="absolute top-2 left-2 flex items-center justify-center group z-30">
                            <button onClick={() => setShowAdditionalWorks(true)} className="p-1.5 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/40 text-purple-400 hover:text-purple-600 transition-colors">
                              <Eye size={14} />
                            </button>
                            <div className="absolute bottom-full mb-2 left-0 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-slate-700">
                              Show Add'l Works
                            </div>
                          </div>
                        )}
                        Total Additional (TAW)
                      </th>

                      <th className="p-4 text-center bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400">Total Contract (TCC)</th>
                      <th className="p-4 text-center text-rose-600">12% VAT of TCC</th>
                      <th className="p-4 text-center font-bold border-r border-slate-200 dark:border-slate-700">CC without VAT</th>

                      <th className="p-4 text-center bg-slate-200/50 dark:bg-slate-800">Overhead 30%</th>
                      <th className="p-4 text-center bg-slate-200/50 dark:bg-slate-800">Overhead 20%</th>
                      <th className="p-4 text-center bg-slate-200/50 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700">Overhead 12%</th>

                      <th className="p-4 text-center bg-emerald-50 dark:bg-emerald-900/10">Target DLM @ 30%</th>
                      <th className="p-4 text-center bg-emerald-50 dark:bg-emerald-900/10">Target DLM @ 20%</th>
                      <th className="p-4 text-center bg-emerald-50 dark:bg-emerald-900/10 border-r border-slate-300 dark:border-slate-700">Target DLM @ 12%</th>

                      <th className="p-4 text-center bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-black">Actual ADLM</th>

                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Saving @ 30%</th>
                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Saving @ 20%</th>
                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Saving @ 12%</th>
                      <th className="p-4 text-center">Remarks</th>
                      <th className="p-4 text-center">Project Area</th>
                      <th className="p-4 text-center">Project Start</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-[12px]">
                    {projectData.map(p => {
                      const adds = p.additionalExpensesList || [];

                      const rowsToRender = showAdditionalWorks
                        ? (adds.length > 0 ? [...adds] : [null])
                        : [null];

                      if (showAdditionalWorks && adds.length > 1) {
                        rowsToRender.push({ isTotalRow: true, amount: p.TAW });
                      }

                      return (
                        <Fragment key={p.id}>
                          {rowsToRender.map((addObj, index) => {
                            const isFirst = index === 0;
                            const isTotal = addObj && addObj.isTotalRow;
                            const isLastRow = index === rowsToRender.length - 1;

                            return (
                              <tr key={`${p.id}-row-${index}`} className={`hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${!isLastRow ? 'border-b-0' : 'border-b dark:border-slate-800'}`}>
                                <td className="p-4 font-black text-indigo-600 dark:text-indigo-400 sticky left-0 z-10 bg-white dark:bg-[#0a0a0a] border-r dark:border-slate-800">
                                  {isFirst ? p.project_code : ''}
                                </td>
                                <td className="p-4 font-bold text-slate-800 dark:text-slate-200 sticky left-[80px] z-10 bg-white dark:bg-[#0a0a0a] border-r dark:border-slate-800">
                                  {isFirst ? p.project_name : ''}
                                </td>
                                <td className="p-4 text-right font-mono bg-blue-50/30 dark:bg-blue-900/5">
                                  {isFirst ? formatMoney(p.CC) : ''}
                                </td>

                                {showAdditionalWorks && (
                                  <>
                                    <td className={`p-4 pl-8 text-[10px] text-left border-r dark:border-slate-800 ${isTotal ? 'font-black text-[12px] text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 tracking-wide'}`}>
                                      {isTotal ? 'Total Add\'l Works' : (addObj ? addObj.particulars : '-')}
                                    </td>
                                    <td className={`p-4 text-[10px] text-right font-mono border-r dark:border-slate-800 ${isTotal ? 'font-black text-[12px] text-slate-800 dark:text-white border-t border-slate-300 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
                                      {isTotal ? formatMoney(addObj.amount) : (addObj ? formatMoney(addObj.amount) : '-')}
                                    </td>
                                  </>
                                )}

                                <td className="p-4 text-right font-mono text-purple-600 dark:text-purple-400">{isFirst ? formatMoney(p.TAW) : ''}</td>
                                <td className="p-4 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">{isFirst ? formatMoney(p.TCC) : ''}</td>
                                <td className="p-4 text-right font-mono text-rose-500">{isFirst ? formatMoney(p.VAT_12) : ''}</td>
                                <td className="p-4 text-right font-mono font-bold border-r dark:border-slate-800">{isFirst ? formatMoney(p.CC_WITHOUT_VAT) : ''}</td>

                                <td className="p-4 text-right font-mono text-slate-500">{isFirst ? formatMoney(p.OH_30) : ''}</td>
                                <td className="p-4 text-right font-mono text-slate-500">{isFirst ? formatMoney(p.OH_20) : ''}</td>
                                <td className="p-4 text-right font-mono text-slate-500 border-r border-slate-300 dark:border-slate-700">{isFirst ? formatMoney(p.OH_12) : ''}</td>

                                <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{isFirst ? formatMoney(p.TARGET_DLM_30) : ''}</td>
                                <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{isFirst ? formatMoney(p.TARGET_DLM_20) : ''}</td>
                                <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 border-r dark:border-slate-300 dark:border-slate-700">{isFirst ? formatMoney(p.TARGET_DLM_12) : ''}</td>

                                <td className="p-4 text-right font-mono font-black text-amber-600 bg-amber-50/50 dark:bg-amber-900/10">{isFirst ? formatMoney(p.ADLM) : ''}</td>

                                <td className={`p-4 text-right font-mono font-black ${p.SAVING_30 >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {isFirst ? formatMoney(p.SAVING_30) : ''}
                                </td>
                                <td className={`p-4 text-right font-mono font-black ${p.SAVING_20 >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {isFirst ? formatMoney(p.SAVING_20) : ''}
                                </td>
                                <td className={`p-4 text-right font-mono font-black ${p.SAVING_12 >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {isFirst ? formatMoney(p.SAVING_12) : ''}
                                </td>
                                <td className="p-4 italic text-slate-400 text-[10px] uppercase">{isFirst ? 'No Record' : ''}</td>
                                <td className="p-4 text-slate-600 dark:text-slate-300">
                                  {isFirst ? (p.project_area || '') : ''}
                                </td>
                                <td className="p-4 text-slate-600 dark:text-slate-300 text-center">
                                  {isFirst ? (p.project_start && !isNaN(new Date(p.project_start).getTime()) ? new Date(p.project_start).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : (p.project_start || '')) : ''}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ==============================================
            VIEW 3: MONTHLY UNIFIED MASTER TABLE
            Projects grouped by month.
            One Monthly Total row per month combines
            project sums + OFFICE/PAYATAS/RESIDENCE expenses.
        ============================================== */}
        {activeView === 'office' && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-6">
            <button onClick={() => setActiveView('selection')} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 transition-colors bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border dark:border-slate-800">
              <ArrowLeft size={16} /> Back to Selection
            </button>

            {/* Legend */}
            <div className="flex items-center gap-5 px-1 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm bg-indigo-400"></span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Project row — shows contract formula columns</span>
              </div>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm bg-amber-400"></span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Monthly Total row — project sums + OFFICE/PAYATAS/RESIDENCE expense breakdown</span>
              </div>
              <div className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
                {monthlyTableRows.filter(r => r.rowType === 'project').length} projects &bull; {monthlyTableRows.filter(r => r.rowType === 'monthly_total').length} months
              </div>
            </div>

            <section ref={officeTableRef} className="bg-white dark:bg-[#0a0a0a] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-8 py-4 bg-gradient-to-r from-amber-600 to-indigo-700 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <FileText size={24} />
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-widest leading-tight">Monthly Unified Master Ledger</h2>
                    <p className="text-[10px] text-white/70 font-medium mt-0.5">Projects by Month &amp; Office/Payatas/Residence Expenses</p>
                    {dateFilterLabel && (
                      <div className="hidden sm:flex items-center px-3 py-1 bg-white/10 rounded-full border border-white/20 gap-2 mt-1">
                        <Calendar size={12} className="opacity-80" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{dateFilterLabel}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  {/* HIDDEN ITEMS DROPDOWN */}
                  {(hiddenProjects.length > 0 || hiddenMonths.length > 0) && (
                    <div className="relative group/hidden">
                      <button className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-100 p-1.5 px-3 rounded-xl border border-rose-500/20 transition-colors">
                        <EyeOff size={14} />
                        <span className="text-xs font-bold">Hidden ({hiddenProjects.length + hiddenMonths.length})</span>
                      </button>
                      <div className="absolute right-0 top-[calc(100%+0.5rem)] w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover/hidden:opacity-100 group-hover/hidden:visible transition-all z-50 overflow-hidden flex flex-col">
                        
                        {/* Hidden Months Section */}
                        {hiddenMonths.length > 0 && (
                          <div className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Hidden Months</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-1">
                              {hiddenMonths.map(mk => {
                                const label = mk === '__unscheduled__' ? 'NO MONTHS' : (() => {
                                  const [y, m] = mk.split('-');
                                  const mIdx = parseInt(m, 10) - 1;
                                  const names = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                                  return names[mIdx] ? names[mIdx] : mk;
                                })();
                                return (
                                  <div key={mk} className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg group/item transition-colors">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                      <Calendar size={12} className="text-indigo-500" />
                                      {label}
                                    </span>
                                    <button 
                                      onClick={() => toggleMonthVisibility(mk)}
                                      className="text-slate-400 hover:text-emerald-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-600"
                                      title="Unhide Month"
                                    >
                                      <Eye size={12} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Hidden Projects Section */}
                        {hiddenProjects.length > 0 && (
                          <div className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Hidden Projects</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-1">
                              {hiddenProjects.map(code => (
                                <div key={code} className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg group/item transition-colors">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Briefcase size={12} className="text-indigo-400" />
                                    {code}
                                  </span>
                                  <button 
                                    onClick={() => toggleProjectVisibility(code)}
                                    className="text-slate-400 hover:text-emerald-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-600"
                                    title="Unhide Project"
                                  >
                                    <Eye size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ISOLATED OFFICE YEAR FILTER */}
                  <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/20">
                    <Calendar size={14} className="text-white/80 ml-1" />
                    <select
                      value={officeYear}
                      onChange={(e) => setOfficeYear(e.target.value)}
                      className="bg-slate-800 dark:bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none cursor-pointer border border-white/10"
                    >
                      <option value="All">All Years</option>
                      {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  {/* Excel Export */}
                  <button onClick={downloadOfficeExcel} disabled={isExportingOfficeExcel}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors font-bold text-sm shadow-sm">
                    <Download size={16} className={isExportingOfficeExcel ? 'animate-pulse' : ''} />
                    {isExportingOfficeExcel ? 'Exporting...' : 'Export Excel'}
                  </button>
                  {/* Zoom */}
                  <div className="flex items-center bg-black/20 rounded-xl px-2 py-1 gap-1 backdrop-blur-sm border border-white/10">
                    <button onClick={handleZoomOut} className="p-1 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30" disabled={zoomLevel <= 0.6}><ZoomOut size={16} /></button>
                    <div className="text-[10px] font-black w-10 text-center select-none uppercase tracking-tighter">{Math.round(zoomLevel * 100)}%</div>
                    <button onClick={handleZoomIn} className="p-1 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30" disabled={zoomLevel >= 1.5}><ZoomIn size={16} /></button>
                    <div className="w-px h-3 bg-white/20 mx-1"></div>
                    <button onClick={resetZoom} className="p-1 hover:bg-white/20 rounded-lg transition-colors" title="Reset Zoom"><RotateCcw size={14} /></button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-8 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col gap-1 w-full">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Overhead Projects</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Basic representation of multi-select. In a real app we might use a dedicated component, but for now we'll allow toggling from a fixed list and adding custom. */}
                    {['OFFICE', 'PAYATAS', 'RESIDENCE'].map(code => (
                      <button
                        key={code}
                        onClick={() => toggleProjectSelection(code)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-colors ${overheadProjects.includes(code)
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                      >
                        {code}
                      </button>
                    ))}
                    {/* Optional: Show others that might be selected if dynamically added */}
                    {overheadProjects.filter(p => !['OFFICE', 'PAYATAS', 'RESIDENCE'].includes(p)).map(code => (
                      <button
                        key={code}
                        onClick={() => toggleProjectSelection(code)}
                        className="px-3 py-1 text-[10px] font-bold rounded-lg border bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 transition-colors"
                      >
                        {code} <X size={10} className="inline ml-1" />
                      </button>
                    ))}
                  </div>
                </div>

                {dateFilterLabel && (
                  <div className="sm:hidden px-4 py-1.5 bg-amber-700 text-white rounded-lg flex items-center gap-2">
                    <Calendar size={12} className="opacity-80" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{dateFilterLabel}</span>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[3200px]" style={{ zoom: zoomLevel }}>
                  <thead>
                    {/* Column group row */}
                    <tr className="bg-slate-200 dark:bg-slate-800 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      <th colSpan={2} className="p-2 text-center sticky left-0 z-20 bg-slate-200 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700">Identity</th>
                      <th colSpan={7} className="p-2 text-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-r border-indigo-200 dark:border-indigo-800">
                        ◆ Contract Formula Columns
                      </th>
                      <th colSpan={customColumns.length} className="p-2 text-center bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-r border-amber-200 dark:border-amber-700">
                        ◆ Office / Payatas / Residence Expenses
                      </th>
                      <th colSpan={2} className="p-2 text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">Summary</th>
                    </tr>
                    {/* Actual headers */}
                    <tr className="bg-slate-100 dark:bg-slate-900 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter border-b border-slate-300 dark:border-slate-700">
                      <th className="p-3 sticky left-0 z-20 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 w-[90px]">Date</th>
                      <th className="p-3 sticky left-[90px] z-20 bg-slate-100 dark:bg-slate-900 border-r border-slate-300 dark:border-slate-700 w-[220px]">Code / Name</th>

                      {/* Contract formula cols — indigo group */}
                      <th className="p-3 text-center bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400 w-[160px] border-r border-indigo-100 dark:border-indigo-800/50">Contract plus Add&apos;l w/VAT</th>
                      <th className="p-3 text-center bg-indigo-50/70 dark:bg-indigo-900/5 text-indigo-600 dark:text-indigo-400 w-[155px] border-r border-indigo-100 dark:border-indigo-800/50">Contract w/o Vat</th>
                      <th className="p-3 text-center bg-indigo-50/70 dark:bg-indigo-900/5 text-indigo-600 dark:text-indigo-400 w-[195px] border-r border-indigo-100 dark:border-indigo-800/50">Contract w/o Vat &amp; Overhead &amp; PM</th>
                      <th className="p-3 text-center bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400 w-[205px] border-r border-indigo-100 dark:border-indigo-800/50">Equivalent 30% Overhead, Contingency &amp; PM</th>
                      <th className="p-3 text-center bg-rose-50 dark:bg-rose-900/10 text-rose-600 w-[195px] border-r border-indigo-100 dark:border-indigo-800/50">Equivalent 10% Retention</th>
                      <th className="p-3 text-center font-bold bg-indigo-50/50 dark:bg-indigo-900/5 w-[155px] border-r border-indigo-100 dark:border-indigo-800/50">Effective Overhead</th>
                      <th className="p-3 text-center bg-slate-50 dark:bg-slate-800 border-r border-indigo-200 dark:border-indigo-800 w-[135px]">Total EOC per Month</th>

                      {/* Dynamic Expense cols — amber group */}
                      {customColumns.map((col, idx) => (
                        <th
                          key={col.id}
                          onClick={() => {
                            setEditingColumn(col);
                            setIsColumnModalOpen(true);
                          }}
                          className={`p-3 text-center bg-amber-50 dark:bg-amber-900/5 hover:bg-amber-100 dark:hover:bg-amber-900/20 cursor-pointer transition-colors group border-r ${idx === customColumns.length - 1 ? 'border-amber-200 dark:border-amber-700' : 'border-amber-100 dark:border-amber-900/50'
                            }`}
                          title="Click to configure column mappings"
                        >
                          <div className="flex items-center justify-center gap-1">
                            {col.title}
                            <Settings size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-600" />
                          </div>
                        </th>
                      ))}

                      {/* Summary cols — emerald group */}
                      <th className="p-3 text-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border-r border-emerald-100 dark:border-emerald-800/50 w-[145px]">Total</th>
                      <th className="p-3 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-900/5 w-[145px]">Net Profit</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-[12px]">
                    {monthlyTableRows.length === 0 ? (
                      <tr>
                        <td colSpan={20} className="p-10 text-center text-slate-400 dark:text-slate-500 italic">
                          No records found for the selected date range.
                        </td>
                      </tr>
                    ) : monthlyTableRows.map(row => {
                      const isHeader = row.rowType === 'month_header';
                      const isTotal = row.rowType === 'monthly_total';
                      const dash = <span className="text-slate-300 dark:text-slate-600 select-none">&mdash;</span>;
                      const fmt = (v) => (v === null || v === undefined) ? dash : formatMoney(v);
                      const fmtExp = (v) => (!v || v === 0) ? dash : formatMoney(v);

                      if (isHeader) {
                        return (
                          <tr key={row.id} className="group bg-slate-200 dark:bg-slate-800 border-t-4 border-slate-300 dark:border-slate-900">
                            <td colSpan={2} className="p-4 sticky left-0 z-20 bg-slate-200 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700">
                              <span className="font-black text-[14px] uppercase tracking-widest text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Calendar size={16} className="text-indigo-500" />
                                {row.monthLabel}
                                <button 
                                  onClick={() => toggleMonthVisibility(row.monthKey)}
                                  className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded ml-1"
                                  title="Hide Month"
                                >
                                  <EyeOff size={14} />
                                </button>
                              </span>
                            </td>
                            <td colSpan={9 + customColumns.length} className="bg-slate-200 dark:bg-slate-800"></td>
                          </tr>
                        );
                      }

                      if (isTotal) {
                        // ══ MONTHLY TOTAL ROW ══
                        return (
                          <tr key={row.id} className="bg-amber-50 dark:bg-amber-900/10 border-t-2 border-amber-300 dark:border-amber-700">
                            {/* Date — empty on Monthly Total row since we have a header */}
                            <td className="p-3 sticky left-0 z-10 bg-amber-50 dark:bg-amber-900/10 border-r dark:border-amber-800/40"></td>
                            {/* Code — MONTHLY TOTAL label */}
                            <td className="p-3 sticky left-[90px] z-10 bg-amber-50 dark:bg-amber-900/10 border-r border-amber-200 dark:border-amber-700">
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200">
                                Monthly Total
                              </span>
                            </td>

                            {/* ── Project formula cols (summed) ── */}
                            <td className="p-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-900/10 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.TCC)}</td>
                            <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.CONTRACT_WO_VAT)}</td>
                            <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.CONTRACT_WO_VAT_OH_PM)}</td>
                            <td className="p-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50/20 dark:bg-purple-900/5 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.EQ_30_OH)}</td>
                            <td className="p-3 text-right font-mono font-bold text-rose-500 bg-rose-50/20 dark:bg-rose-900/5 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.EQ_10_RETENTION)}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-200 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.EFFECTIVE_OH)}</td>
                            <td className="p-3 text-center border-r border-indigo-200 dark:border-indigo-800">{dash}</td>

                            {/* ── Dynamic Expense cols (OFFICE/PAYATAS/RESIDENCE aggregated) ── */}
                            {customColumns.map((col, idx) => {
                              const val = row[col.id];
                              const isFirst = idx === 0;
                              const isLast = idx === customColumns.length - 1;
                              let cellClass = "p-3 text-right font-mono text-amber-600 dark:text-amber-500 border-r border-amber-100 dark:border-amber-800/40";
                              if (isFirst) cellClass = "p-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10 border-r border-amber-100 dark:border-amber-800/40";
                              if (isLast) cellClass = "p-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400 border-r border-amber-200 dark:border-amber-700";

                              return (
                                <td key={col.id} className={cellClass}>
                                  {fmtExp(val)}
                                </td>
                              );
                            })}

                            {/* ── Summary cols ── */}
                            <td className="p-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10 border-r border-emerald-100 dark:border-emerald-800/40">{fmt(row.total_specific_expenses)}</td>
                            <td className={`p-3 text-right font-mono font-black ${row.NET_PROFIT >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                              } bg-emerald-50/30 dark:bg-emerald-900/5`}>{fmt(row.NET_PROFIT)}</td>
                          </tr>
                        );
                      }

                      // ══ INDIVIDUAL PROJECT ROW ══
                      return (
                        <tr key={row.id}
                          className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/5 transition-colors border-l-2 border-l-indigo-300 dark:border-l-indigo-700"
                        >
                          {/* Date — blank for project rows */}
                          <td className="p-3 sticky left-0 z-10 bg-white dark:bg-[#0a0a0a] border-r dark:border-slate-800"></td>

                          {/* Code / Name */}
                          <td className="p-3 sticky left-[90px] z-10 bg-white dark:bg-[#0a0a0a] border-r border-slate-300 dark:border-slate-700">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-[13px] text-indigo-600 dark:text-indigo-400">
                                  {row.project_code}
                                </span>
                                <button 
                                  onClick={() => toggleProjectVisibility(row.project_code)}
                                  className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                                  title="Hide Project"
                                >
                                  <EyeOff size={14} />
                                </button>
                              </div>
                              {row.project_name && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{row.project_name}</span>
                              )}
                            </div>
                          </td>

                          {/* Contract formula cols */}
                          <td className="p-3 text-right font-mono text-indigo-700 dark:text-indigo-400 bg-indigo-50/10 dark:bg-indigo-900/5 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.TCC)}</td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.CONTRACT_WO_VAT)}</td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.CONTRACT_WO_VAT_OH_PM)}</td>
                          <td className="p-3 text-right font-mono text-purple-600 dark:text-purple-400 bg-purple-50/10 dark:bg-purple-900/5 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.EQ_30_OH)}</td>
                          <td className="p-3 text-right font-mono text-rose-500 bg-rose-50/10 dark:bg-rose-900/5 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.EQ_10_RETENTION)}</td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300 border-r border-indigo-100 dark:border-indigo-800/50">{fmt(row.EFFECTIVE_OH)}</td>
                          <td className="p-3 text-center border-r border-indigo-200 dark:border-indigo-800 text-slate-300 dark:text-slate-700">&mdash;</td>

                          {/* Dynamic Expense cols — blank for project rows */}
                          {customColumns.map((col, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === customColumns.length - 1;
                            let cellClass = "p-3 border-r border-amber-100 dark:border-amber-800/30";
                            if (isFirst) cellClass = "p-3 bg-amber-50/10 dark:bg-amber-900/5 border-r border-amber-100 dark:border-amber-800/30";
                            if (isLast) cellClass = "p-3 border-r border-amber-200 dark:border-amber-700 bg-amber-50/10 dark:bg-amber-900/5";
                            return <td key={`empty-${col.id}`} className={cellClass}></td>;
                          })}

                          {/* Summary */}
                          <td className="p-3 text-right font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-900/5 border-r border-emerald-100 dark:border-emerald-800/40">
                            {row.total_specific_expenses > 0 ? fmt(row.total_specific_expenses) : dash}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${row.NET_PROFIT >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                            } bg-emerald-50/10 dark:bg-emerald-900/5`}>
                            {fmt(row.NET_PROFIT)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.2)] dark:shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
                    <tr className="bg-slate-800 dark:bg-black text-[12px] border-t-4 border-slate-600 dark:border-slate-800">
                      <td colSpan={2} className="p-4 sticky left-0 z-20 bg-slate-800 dark:bg-black border-r border-slate-700 dark:border-slate-800">
                        <span className="font-black text-[14px] uppercase tracking-widest text-white flex items-center gap-2">
                          <Wallet size={16} className="text-emerald-400" />
                          TOTAL
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-white border-r border-slate-700 dark:border-slate-800/80 bg-indigo-900/20">{formatMoney(grandTotals.TCC)}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-300 border-r border-slate-700 dark:border-slate-800/80">{formatMoney(grandTotals.CONTRACT_WO_VAT)}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-300 border-r border-slate-700 dark:border-slate-800/80">{formatMoney(grandTotals.CONTRACT_WO_VAT_OH_PM)}</td>
                      <td className="p-4 text-right font-mono font-bold text-purple-300 border-r border-slate-700 dark:border-slate-800/80 bg-purple-900/20">{formatMoney(grandTotals.EQ_30_OH)}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400 border-r border-slate-700 dark:border-slate-800/80 bg-rose-900/20">{formatMoney(grandTotals.EQ_10_RETENTION)}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-300 border-r border-slate-700 dark:border-slate-800/80">{formatMoney(grandTotals.EFFECTIVE_OH)}</td>
                      <td className="p-4 text-center text-slate-500 border-r border-slate-700 dark:border-slate-800/80">&mdash;</td>
                      
                      {customColumns.map((col, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === customColumns.length - 1;
                        let cellClass = "p-4 text-right font-mono font-bold text-amber-100 border-r border-slate-700 dark:border-slate-800/80";
                        if (isFirst) cellClass += " bg-amber-900/20";
                        if (isLast) cellClass += " bg-amber-900/20";
                        return (
                          <td key={`gt-${col.id}`} className={cellClass}>
                            {grandTotals[col.id] > 0 ? formatMoney(grandTotals[col.id]) : <span className="text-slate-500 select-none">&mdash;</span>}
                          </td>
                        );
                      })}
                      
                      <td className="p-4 text-right font-mono font-bold text-emerald-100 border-r border-slate-700 dark:border-slate-800/80 bg-emerald-900/20">
                        {formatMoney(grandTotals.total_specific_expenses)}
                      </td>
                      <td className={`p-4 text-right font-mono font-black text-[14px] ${grandTotals.NET_PROFIT >= 0 ? 'text-emerald-400' : 'text-rose-400'} bg-slate-900/50`}>
                        {formatMoney(grandTotals.NET_PROFIT)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ==============================================
          COLUMN CONFIGURATION MODAL
      ============================================== */}
      {isColumnModalOpen && editingColumn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Settings size={20} className="text-amber-600" />
                Configure Column
              </h2>
              <button
                onClick={() => setIsColumnModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Column Title</label>
                <input
                  type="text"
                  value={editingColumn.title}
                  onChange={(e) => setEditingColumn({ ...editingColumn, title: e.target.value })}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Mapped Categories</label>
                <p className="text-[10px] text-slate-500 mb-2 leading-tight">Select which expenses will be aggregated into this column. This relies on exact matches or partial text matches to the project setup categories.</p>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 max-h-[300px] overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                  {categories.map((cat, i) => {
                    // For safety, fallback to string if categories array contains strings
                    const catName = typeof cat === 'string' ? cat : cat.name;
                    const isSelected = editingColumn.mappedCategories.includes(catName);

                    return (
                      <label key={i} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const newMapping = isSelected
                              ? editingColumn.mappedCategories.filter(c => c !== catName)
                              : [...editingColumn.mappedCategories, catName];
                            setEditingColumn({ ...editingColumn, mappedCategories: newMapping });
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{catName}</span>
                      </label>
                    );
                  })}

                  {/* Show all currently selected categories and keywords */}
                  <div className="p-2 border-t border-slate-200 dark:border-slate-700 mt-2 flex flex-col gap-2">
                    <span className="text-xs font-medium text-slate-500">Selected Categories / Keywords:</span>
                    <div className="flex flex-wrap gap-2">
                      {editingColumn.mappedCategories.length === 0 && (
                        <span className="text-[10px] text-slate-400 italic">No categories selected.</span>
                      )}
                      {editingColumn.mappedCategories.map(kw => (
                        <div key={kw} className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                          {kw}
                          <button onClick={() => setEditingColumn({ ...editingColumn, mappedCategories: editingColumn.mappedCategories.filter(c => c !== kw) })} className="hover:text-amber-900 dark:hover:text-amber-200">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button
                onClick={() => setIsColumnModalOpen(false)}
                className="px-5 py-2 font-bold text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveColumnConfig}
                className="px-6 py-2 font-bold text-sm text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
