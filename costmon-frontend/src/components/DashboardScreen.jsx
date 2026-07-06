import { useState, useMemo, Fragment, useRef } from 'react';
import { LayoutDashboard, Briefcase, Building2, ArrowLeft, TrendingUp, FileText, ZoomIn, ZoomOut, RotateCcw, Wallet, Receipt, Eye, EyeOff, Calendar, X, Download, FileSpreadsheet, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function DashboardScreen({ projects = [], disbursements = [] }) {
  const [activeView, setActiveView] = useState('selection');

  // State para i-toggle ang Additional Works breakdown columns
  const [showAdditionalWorks, setShowAdditionalWorks] = useState(true);

  // Loading states para sa exports
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // BAGO: Loading states at Ref para sa Office Exports
  const [isExportingOfficePDF, setIsExportingOfficePDF] = useState(false);
  const [isExportingOfficeExcel, setIsExportingOfficeExcel] = useState(false);

  const projectTableRef = useRef(null);
  const officeTableRef = useRef(null); // Ref para sa Office Table

  // Date Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
      const XLSX = (await import('xlsx')).default;

      const wb = XLSX.utils.book_new();
      const excelRows = [];

      excelRows.push(["FBTMCC - PROJECT MASTER SPREADSHEET"]);
      excelRows.push([dateFilterLabel ? `Filter Period: ${dateFilterLabel}` : "Period: All-Time Records"]);
      excelRows.push([]);

      excelRows.push([
        "Code", "Store Name", "Contract Cost (CC)",
        "Additional Works Particulars", "Amount", "Total Additional (TAW)",
        "Total Contract (TCC)", "12% VAT of TCC", "CC without VAT",
        "Overhead 30%", "Overhead 20%", "Overhead 12%",
        "Target DLM @ 30%", "Target DLM @ 20%", "Target DLM @ 12%",
        "Actual ADLM", "Saving @ 30%", "Saving @ 20%", "Saving @ 12%", "Remarks"
      ]);

      projectData.forEach(p => {
        const adds = p.additionalExpensesList || [];

        if (adds.length === 0) {
          excelRows.push([
            p.project_code, p.project_name, p.CC,
            "-", 0, p.TAW, p.TCC, p.VAT_12, p.CC_WITHOUT_VAT,
            p.OH_30, p.OH_20, p.OH_12,
            p.TARGET_DLM_30, p.TARGET_DLM_20, p.TARGET_DLM_12,
            p.ADLM, p.SAVING_30, p.SAVING_20, p.SAVING_12, "No Record"
          ]);
        } else {
          adds.forEach((add, idx) => {
            if (idx === 0) {
              excelRows.push([
                p.project_code, p.project_name, p.CC,
                add.particulars, add.amount, p.TAW, p.TCC, p.VAT_12, p.CC_WITHOUT_VAT,
                p.OH_30, p.OH_20, p.OH_12,
                p.TARGET_DLM_30, p.TARGET_DLM_20, p.TARGET_DLM_12,
                p.ADLM, p.SAVING_30, p.SAVING_20, p.SAVING_12, "Active Works"
              ]);
            } else {
              excelRows.push([
                "", "", "",
                add.particulars, add.amount, "", "", "", "",
                "", "", "", "", "", "", "", "", "", "", ""
              ]);
            }
          });
          if (adds.length > 1) {
            excelRows.push([
              "", "", "",
              "Total Add'l Works Subtotal", p.TAW, "", "", "", "",
              "", "", "", "", "", "", "", "", "", "", ""
            ]);
          }
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(excelRows);
      XLSX.utils.book_append_sheet(wb, ws, "Projects Master Ledger");

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `PROJECT_MASTER_SPREADSHEET_${dateStr}.xlsx`);
    } catch (error) {
      console.error("Failed to export Excel file:", error);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // ==========================================
  // EXPORT TO PDF FUNCTION (PROJECTS)
  // ==========================================
  const downloadProjectPDF = async () => {
    if (!projectTableRef.current) return;

    try {
      setIsExportingPDF(true);
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = projectTableRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0a0a0a' : '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 2900
      });

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`PROJECT_MASTER_SPREADSHEET_${dateStr}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // ==========================================
  // EXPORT TO EXCEL FUNCTION (OFFICE)
  // ==========================================
  const downloadOfficeExcel = async () => {
    try {
      setIsExportingOfficeExcel(true);
      const XLSX = (await import('xlsx')).default;

      const wb = XLSX.utils.book_new();
      const excelRows = [];

      excelRows.push(["FBTMCC - OFFICE OPERATIONS MASTER LEDGER"]);
      excelRows.push([dateFilterLabel ? `Filter Period: ${dateFilterLabel}` : "Period: All-Time Records"]);
      excelRows.push([]);

      excelRows.push([
        "Date", "Code", "Total", "Net Profit", "Contract plus Add'l w/VAT", "Empty",
        "Contract w/o Vat", "Contract w/o Vat & Overhead & PM", "Equivalent 30% Overhead, Contingency & PM",
        "Equivalent 10% Retention base on Contract w/ Vat", "Effective Overhead", "Total EOC per Month",
        "Payroll", "Electrical Office/Payatas", "Water/office/Payatas", "Comunication/Telephone",
        "Retainer", "Office supplies/Outing", "Car Repair & Maintenance", "Car Registration", "Contribution"
      ]);

      officeData.forEach(o => {
        excelRows.push([
          o.project_start || '-', o.project_code, o.total_specific_expenses, o.NET_PROFIT, o.TCC, "-",
          o.CC_WITHOUT_VAT, o.CC_WO_VAT_OH_PM, o.OH_30, o.RETENTION_10, o.EFFECTIVE_OVERHEAD, "-",
          o.exp_payroll, o.exp_electrical, o.exp_water, o.exp_comms, o.exp_retainer,
          o.exp_supplies, o.exp_car_repair, o.exp_car_reg, o.exp_contribution
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(excelRows);
      XLSX.utils.book_append_sheet(wb, ws, "Office Master Ledger");

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `OFFICE_MASTER_LEDGER_${dateStr}.xlsx`);
    } catch (error) {
      console.error("Failed to export Excel file:", error);
    } finally {
      setIsExportingOfficeExcel(false);
    }
  };

  // ==========================================
  // EXPORT TO PDF FUNCTION (OFFICE)
  // ==========================================
  const downloadOfficePDF = async () => {
    if (!officeTableRef.current) return;

    try {
      setIsExportingOfficePDF(true);
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = officeTableRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0a0a0a' : '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 2900
      });

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`OFFICE_MASTER_LEDGER_${dateStr}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setIsExportingOfficePDF(false);
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
  const { officeData, projectData, officeTotalBudget, projectTotalBudget, totalCompanyExpenses } = useMemo(() => {
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

      const exp_payroll = getCategoryTotal('payroll') + getCategoryTotal('labor');
      const exp_electrical = getCategoryTotal('electrical');
      const exp_water = getCategoryTotal('water');
      const exp_comms = getCategoryTotal('comunication') + getCategoryTotal('telephone') + getCategoryTotal('internet');
      const exp_retainer = getCategoryTotal('retainer');
      const exp_supplies = getCategoryTotal('office supplies') + getCategoryTotal('outing');
      const exp_car_repair = getCategoryTotal('car repair') + getCategoryTotal('maintenance');
      const exp_car_reg = getCategoryTotal('car registration');
      const exp_contribution = getCategoryTotal('contribution');

      const total_specific_expenses = exp_payroll + exp_electrical + exp_water + exp_comms + exp_retainer + exp_supplies + exp_car_repair + exp_car_reg + exp_contribution;
      const NET_PROFIT = TCC - total_specific_expenses;

      const computedData = {
        ...p,
        CC, TAW, additionalExpensesList, TCC, VAT_12, CC_WITHOUT_VAT,
        OH_30, OH_20, OH_12,
        TARGET_DLM_30, TARGET_DLM_20, TARGET_DLM_12,
        ADLM, SAVING_30, SAVING_20, SAVING_12,

        NET_PROFIT, RETENTION_10, CC_WO_VAT_OH_PM, EFFECTIVE_OVERHEAD,
        total_specific_expenses, exp_payroll,
        exp_electrical, exp_water, exp_comms, exp_retainer,
        exp_supplies, exp_car_repair, exp_car_reg, exp_contribution
      };

      projs.push(computedData);
      pBudget += CC;
    });

    // 3. Filter and map office disbursements
    const officeDisbursements = filteredDisbursements.filter(d =>
      d.project_code && officeProjectCodes.has(d.project_code.toUpperCase())
    );

    officeDisbursements.forEach(d => {
      const getDisbCategoryTotal = (keywords) => {
        return (d.expenses || [])
          .filter(e => e.category && keywords.some(kw => e.category.toLowerCase().includes(kw.toLowerCase())))
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      };

      const exp_payroll = getDisbCategoryTotal(['payroll', 'labor']);
      const exp_electrical = getDisbCategoryTotal(['electrical', 'light', 'power']);
      const exp_water = getDisbCategoryTotal(['water']);
      const exp_comms = getDisbCategoryTotal(['comunication', 'telephone', 'internet', 'comms']);
      const exp_retainer = getDisbCategoryTotal(['retainer', 'sop']);
      const exp_supplies = getDisbCategoryTotal(['office supplies', 'outing', 'supplies']);
      const exp_car_repair = getDisbCategoryTotal(['car repair', 'maintenance', 'repair']);
      const exp_car_reg = getDisbCategoryTotal(['car registration', 'registration']);
      const exp_contribution = getDisbCategoryTotal(['contribution']);

      const total_specific_expenses = exp_payroll + exp_electrical + exp_water + exp_comms + exp_retainer + exp_supplies + exp_car_repair + exp_car_reg + exp_contribution;
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
        exp_payroll,
        exp_electrical,
        exp_water,
        exp_comms,
        exp_retainer,
        exp_supplies,
        exp_car_repair,
        exp_car_reg,
        exp_contribution
      });

      totalExp += total_specific_expenses;
    });

    return {
      officeData: office,
      projectData: projs,
      officeTotalBudget: oBudget,
      projectTotalBudget: pBudget,
      totalCompanyExpenses: totalExp
    };
  }, [projects, filteredDisbursements]);

  const summaryCards = [
    { title: "Active Projects", value: `${projectData.length} Sites`, icon: <Briefcase size={28} />, colorClass: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800" },
    { title: "Office Departments", value: `${officeData.length} Records`, icon: <Building2 size={28} />, colorClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" },
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
            month: new Date(month + '-01').toLocaleString('en-US', { month: 'short', year: '2-digit' }),
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

                  {/* BUTTON 1: EXCEL EXPORT */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={downloadProjectExcel}
                      disabled={isExportingExcel}
                      className="flex items-center justify-center p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 border border-white/20 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <FileSpreadsheet size={16} className={`${isExportingExcel ? 'animate-pulse' : ''}`} />
                    </button>
                    <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-slate-700">
                      {isExportingExcel ? 'Exporting Excel...' : 'Download as Excel (.xlsx)'}
                    </div>
                  </div>

                  {/* BUTTON 2: PDF EXPORT */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={downloadProjectPDF}
                      disabled={isExportingPDF}
                      className="flex items-center justify-center p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 border border-white/20 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <Download size={16} className={`${isExportingPDF ? 'animate-bounce' : ''}`} />
                    </button>
                    <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-slate-700">
                      {isExportingPDF ? 'Generating PDF...' : 'Download as PDF'}
                    </div>
                  </div>

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
            VIEW 3: OFFICE & ADMIN TABLE
        ============================================== */}
        {activeView === 'office' && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-6">
            <button onClick={() => setActiveView('selection')} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 transition-colors bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border dark:border-slate-800">
              <ArrowLeft size={16} /> Back to Selection
            </button>

            <section ref={officeTableRef} className="bg-white dark:bg-[#0a0a0a] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-colors duration-300">
              <div className="px-8 py-4 bg-amber-600 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <FileText size={24} />
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-widest leading-tight">Office Operations Master Ledger</h2>
                    {dateFilterLabel && (
                      <div className="hidden sm:flex items-center px-3 py-1 bg-white/10 rounded-full border border-white/20 shadow-sm gap-2">
                        <Calendar size={12} className="opacity-80" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{dateFilterLabel}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CONTROLS (OFFICE) */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">

                  {/* EXCEL EXPORT BUTTON (OFFICE) */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={downloadOfficeExcel}
                      disabled={isExportingOfficeExcel}
                      className="flex items-center justify-center p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 border border-white/20 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <FileSpreadsheet size={16} className={`${isExportingOfficeExcel ? 'animate-pulse' : ''}`} />
                    </button>
                    <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-slate-700">
                      {isExportingOfficeExcel ? 'Exporting Excel...' : 'Download as Excel (.xlsx)'}
                    </div>
                  </div>

                  {/* PDF EXPORT BUTTON (OFFICE) */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={downloadOfficePDF}
                      disabled={isExportingOfficePDF}
                      className="flex items-center justify-center p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 border border-white/20 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <Download size={16} className={`${isExportingOfficePDF ? 'animate-bounce' : ''}`} />
                    </button>
                    <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-slate-700">
                      {isExportingOfficePDF ? 'Generating PDF...' : 'Download as PDF'}
                    </div>
                  </div>

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
                <div className="sm:hidden px-8 py-2 bg-amber-700 text-white flex items-center gap-2 border-b border-amber-500/50">
                  <Calendar size={12} className="opacity-80" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{dateFilterLabel}</span>
                </div>
              )}

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[2800px]" style={{ zoom: zoomLevel }}>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter border-b border-slate-300 dark:border-slate-700">
                      <th className="p-4 sticky left-0 z-20 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 w-[120px]">Date</th>
                      <th className="p-4 sticky left-[120px] z-20 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 w-[150px]">Code</th>
                      <th className="p-4 text-center font-bold text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/10">Total</th>
                      <th className="p-4 text-center text-emerald-600">Net Profit</th>
                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Contract plus Add'l w/VAT</th>
                      <th className="p-4 text-center">Empty</th>
                      <th className="p-4 text-center">Contract w/o Vat</th>
                      <th className="p-4 text-center">Contract w/o Vat & Overhead & PM</th>
                      <th className="p-4 text-center bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400">Equivalent 30% Overhead, Contingency & PM</th>
                      <th className="p-4 text-center bg-rose-50 dark:bg-rose-900/10 text-rose-600">Equivalent 10% Retention base on Contract w/ Vat</th>
                      <th className="p-4 text-center font-bold border-r border-slate-300 dark:border-slate-700">Effective Overhead</th>
                      <th className="p-4 text-center">Total EOC per Month</th>

                      {/* SPECIFIC EXPENSES */}
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Payroll</th>
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Electrical Office/Payatas</th>
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Water/office/Payatas</th>
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Comunication/Telephone</th>
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Retainer</th>
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Office supplies/Outing</th>
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Car Repair & Maintenance</th>
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Car Registration</th>
                      <th className="p-4 text-center bg-slate-50 dark:bg-slate-800">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-[12px]">
                    {officeData.length === 0 ? (
                      <tr>
                        <td colSpan="21" className="p-8 text-center text-slate-400 dark:text-slate-500 italic">No records for this date range.</td>
                      </tr>
                    ) : officeData.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <td className="p-4 font-medium text-slate-500 dark:text-slate-400 sticky left-0 z-10 bg-white dark:bg-[#0a0a0a] border-r dark:border-slate-800">{o.project_start || '-'}</td>
                        <td className="p-4 font-black text-amber-600 dark:text-amber-500 sticky left-[120px] z-10 bg-white dark:bg-[#0a0a0a] border-r dark:border-slate-800">{o.project_code}</td>
                        <td className="p-4 text-right font-mono font-black text-amber-700 dark:text-amber-500 bg-amber-50/50 dark:bg-amber-900/10">{formatMoney(o.total_specific_expenses)}</td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(o.NET_PROFIT)}</td>
                        <td className="p-4 text-right font-mono bg-blue-50/30 dark:bg-blue-900/5">{formatMoney(o.TCC)}</td>
                        <td className="p-4 text-center text-slate-300">-</td>
                        <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-300">{formatMoney(o.CC_WITHOUT_VAT)}</td>
                        <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-300">{formatMoney(o.CC_WO_VAT_OH_PM)}</td>
                        <td className="p-4 text-right font-mono text-purple-600 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-900/5">{formatMoney(o.OH_30)}</td>
                        <td className="p-4 text-right font-mono text-rose-500 bg-rose-50/30 dark:bg-rose-900/5">{formatMoney(o.RETENTION_10)}</td>
                        <td className="p-4 text-right font-mono font-bold border-r dark:border-slate-800">{formatMoney(o.EFFECTIVE_OVERHEAD)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">-</td>

                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_payroll)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_electrical)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_water)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_comms)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_retainer)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_supplies)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_car_repair)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_car_reg)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(o.exp_contribution)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}