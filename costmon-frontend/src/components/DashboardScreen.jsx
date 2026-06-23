import { useState, useMemo } from 'react';
import { LayoutDashboard, Briefcase, Building2, ArrowLeft, TrendingUp, FileText, ZoomIn, ZoomOut, RotateCcw, Wallet, Receipt } from 'lucide-react';

export default function DashboardScreen({ projects = [], disbursements = [] }) {
  const [activeView, setActiveView] = useState('selection');

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
    if (val === 0) return '-';
    if (!val) return '0.00';
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ==========================================
  // CALCULATIONS BASED ON YOUR TABLE IMAGES
  // ==========================================
  const { officeData, projectData, officeTotalBudget, projectTotalBudget, totalCompanyExpenses } = useMemo(() => {
    const office = [];
    const projs = [];
    let oBudget = 0;
    let pBudget = 0;
    let totalExp = 0;

    projects.forEach(p => {
      // 1. Get All Project Expenses
      const projExpenses = disbursements.filter(d => 
        d.project_code && d.project_code.toUpperCase() === p.project_code.toUpperCase()
      );

      // Helper para kunin ang total ng isang specific category
      const getCategoryTotal = (keyword) => {
        return projExpenses.reduce((total, d) => {
          const lineTotal = (d.expenses || [])
            .filter(e => e.category && e.category.toLowerCase().includes(keyword.toLowerCase()))
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
          return total + lineTotal;
        }, 0);
      };

      // 2. Calculate Total Additional Works (TAW) & ADLM
      const TAW = projExpenses
        .filter(d => d.costing_type === 'additional')
        .reduce((sum, d) => sum + (d.expenses || []).reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0), 0);

      const ADLM = projExpenses
        .filter(d => d.costing_type === 'normal' || !d.costing_type)
        .reduce((sum, d) => sum + (d.expenses || []).reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0), 0);

      const totalExpense = TAW + ADLM;
      totalExp += totalExpense; // Idagdag sa overall company expenses

      // --- FORMULAS FOR PROJECTS TABLE ---
      const CC = parseFloat(p.contract_cost) || 0;
      const TCC = CC + TAW;
      const VAT_12 = TCC * (1 - (1 / 1.12)); 
      const CC_WITHOUT_VAT = TCC - VAT_12;

      const OH_30 = TCC * 0.30;
      const OH_20 = TCC * 0.20;
      const OH_12 = TCC * 0.12;

      const TARGET_DLM_30 = CC_WITHOUT_VAT - OH_30;
      const TARGET_DLM_20 = CC_WITHOUT_VAT - OH_20;
      const TARGET_DLM_12 = CC_WITHOUT_VAT - OH_12;

      const SAVING_30 = TARGET_DLM_30 - ADLM;
      const SAVING_20 = TARGET_DLM_20 - ADLM;
      const SAVING_12 = TARGET_DLM_12 - ADLM;

      // --- FORMULAS FOR OFFICE TABLE ---
      const RETENTION_10 = TCC * 0.10;
      const CC_WO_VAT_OH_PM = CC_WITHOUT_VAT - OH_30; // Equivalent to CC without VAT & Overhead & PM
      const EFFECTIVE_OVERHEAD = OH_30; // Based on standard assumption

      // SPECIFIC OFFICE EXPENSES
      const exp_payroll = getCategoryTotal('payroll') + getCategoryTotal('labor');
      const exp_electrical = getCategoryTotal('electrical');
      const exp_water = getCategoryTotal('water');
      const exp_comms = getCategoryTotal('comunication') + getCategoryTotal('telephone') + getCategoryTotal('internet');
      const exp_retainer = getCategoryTotal('retainer');
      const exp_supplies = getCategoryTotal('office supplies') + getCategoryTotal('outing');
      const exp_car_repair = getCategoryTotal('car repair') + getCategoryTotal('maintenance');
      const exp_car_reg = getCategoryTotal('car registration');
      const exp_contribution = getCategoryTotal('contribution');

      // Total Specific Expenses for Office
      const total_specific_expenses = exp_payroll + exp_electrical + exp_water + exp_comms + exp_retainer + exp_supplies + exp_car_repair + exp_car_reg + exp_contribution;
      const NET_PROFIT = TCC - total_specific_expenses; 

      const computedData = {
        ...p,
        CC, TAW, TCC, VAT_12, CC_WITHOUT_VAT,
        OH_30, OH_20, OH_12,
        TARGET_DLM_30, TARGET_DLM_20, TARGET_DLM_12,
        ADLM, SAVING_30, SAVING_20, SAVING_12,
        
        // Office Specific Data
        NET_PROFIT, RETENTION_10, CC_WO_VAT_OH_PM, EFFECTIVE_OVERHEAD,
        total_specific_expenses, exp_payroll,
        exp_electrical, exp_water, exp_comms, exp_retainer, 
        exp_supplies, exp_car_repair, exp_car_reg, exp_contribution
      };

      const code = p.project_code.toUpperCase();
      // If code implies office/admin, put it in Office Data
      if (code.includes('ADMIN') || code.includes('OFFICE') || code.includes('SHOP')) {
        office.push(computedData);
        oBudget += CC;
      } else {
        projs.push(computedData);
        pBudget += CC;
      }
    });

    return { 
      officeData: office, 
      projectData: projs, 
      officeTotalBudget: oBudget, 
      projectTotalBudget: pBudget,
      totalCompanyExpenses: totalExp
    };
  }, [projects, disbursements]);

  // Data mapping for top summary cards
  const summaryCards = [
    { title: "Active Projects", value: `${projectData.length} Sites`, icon: <Briefcase size={28} />, colorClass: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800" },
    { title: "Office Departments", value: `${officeData.length} Records`, icon: <Building2 size={28} />, colorClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" },
    { title: "Overall Allocated Budget", value: `₱ ${formatMoney(projectTotalBudget + officeTotalBudget)}`, icon: <Wallet size={28} />, colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800" },
    { title: "Total Company Expenses", value: `₱ ${formatMoney(totalCompanyExpenses)}`, icon: <Receipt size={28} />, colorClass: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800" }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      
      {/* HEADER */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <div className="bg-indigo-600 dark:bg-indigo-700 p-2 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <LayoutDashboard size={28} />
            </div>
            FINANCIAL DASHBOARD
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Company Health & Projects Analytics</p>
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
                <p className="text-sm text-slate-500 dark:text-slate-400">Quick summary of FBTMCC's overall financial data.</p>
              </div>
            </div>

            {/* SUMMARY CARDS (Para hindi masyadong bakante ang itaas) */}
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
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Detailed Ledgers</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Pumili sa ibaba kung anong master spreadsheet ang gusto mong silipin.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mx-auto">
              <button onClick={() => setActiveView('projects')} className="group bg-white dark:bg-[#0a0a0a] p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500/50 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors"></div>
                <div className="bg-slate-100 dark:bg-slate-900 p-5 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner relative z-10"><Briefcase size={36} strokeWidth={2.5} /></div>
                <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100 relative z-10">Projects Analytics</h3>
                <p className="text-slate-500 mt-3 font-medium text-sm relative z-10">Detailed cost monitoring, savings, and overhead breakdown for construction sites.</p>
              </button>

              <button onClick={() => setActiveView('office')} className="group bg-white dark:bg-[#0a0a0a] p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500/50 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/10 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors"></div>
                <div className="bg-slate-100 dark:bg-slate-900 p-5 rounded-2xl text-amber-600 dark:text-amber-400 mb-6 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner relative z-10"><Building2 size={36} strokeWidth={2.5} /></div>
                <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100 relative z-10">Office & Admin</h3>
                <p className="text-slate-500 mt-3 font-medium text-sm relative z-10">Master ledger for office operations, utilities, overheads, and miscellaneous maintenance.</p>
              </button>
            </div>
          </div>
        )}

        {/* ==============================================
            VIEW 2: PROJECTS TABLE
        ============================================== */}
        {activeView === 'projects' && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-6">
            <button onClick={() => setActiveView('selection')} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border dark:border-slate-800">
              <ArrowLeft size={16} /> Back to Selection
            </button>

            <section className="bg-white dark:bg-[#0a0a0a] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-colors duration-300">
              <div className="px-8 py-4 bg-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp size={24} />
                  <h2 className="text-xl font-black uppercase tracking-widest">Project Master Spreadsheet</h2>
                </div>
                
                {/* ZOOM CONTROLS (PROJECTS) */}
                <div className="flex flex-col items-end gap-2">
                  <div className="text-[10px] font-bold opacity-80 uppercase tracking-[0.2em] hidden sm:block">Confidential Financial Data</div>
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
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[2800px]" style={{ zoom: zoomLevel }}>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter border-b border-slate-300 dark:border-slate-700">
                      <th className="p-4 sticky left-0 z-20 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">Code</th>
                      <th className="p-4 sticky left-[80px] z-20 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 w-[200px]">Store Name</th>
                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Contract cost (CC)</th>
                      <th className="p-4 text-center">Empty</th>
                      <th className="p-4 text-center">Empty</th>
                      <th className="p-4 text-center bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400">Total Additional (TAW)</th>
                      <th className="p-4 text-center bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400">Total Contract (TCC)</th>
                      <th className="p-4 text-center text-rose-600">12% VAT of TCC</th>
                      <th className="p-4 text-center font-bold">CC without VAT</th>
                      
                      {/* OVERHEADS */}
                      <th className="p-4 text-center bg-slate-200/50 dark:bg-slate-800">Overhead 30%</th>
                      <th className="p-4 text-center bg-slate-200/50 dark:bg-slate-800">Overhead 20%</th>
                      <th className="p-4 text-center bg-slate-200/50 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700">Overhead 12%</th>
                      
                      {/* TARGET DLMs */}
                      <th className="p-4 text-center bg-emerald-50 dark:bg-emerald-900/10">Target DLM @ 30%</th>
                      <th className="p-4 text-center bg-emerald-50 dark:bg-emerald-900/10">Target DLM @ 20%</th>
                      <th className="p-4 text-center bg-emerald-50 dark:bg-emerald-900/10 border-r border-slate-300 dark:border-slate-700">Target DLM @ 12%</th>
                      
                      <th className="p-4 text-center bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-black">Actual ADLM</th>
                      
                      {/* SAVINGS */}
                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Saving @ 30%</th>
                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Saving @ 20%</th>
                      <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/10">Saving @ 12%</th>
                      <th className="p-4 text-center">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-[12px]">
                    {projectData.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <td className="p-4 font-black text-indigo-600 dark:text-indigo-400 sticky left-0 z-10 bg-white dark:bg-[#0a0a0a] border-r dark:border-slate-800">{p.project_code}</td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 sticky left-[80px] z-10 bg-white dark:bg-[#0a0a0a] border-r dark:border-slate-800">{p.project_name}</td>
                        <td className="p-4 text-right font-mono bg-blue-50/30 dark:bg-blue-900/5">{formatMoney(p.CC)}</td>
                        <td className="p-4 text-center text-slate-300">-</td>
                        <td className="p-4 text-center text-slate-300">-</td>
                        <td className="p-4 text-right font-mono text-purple-600 dark:text-purple-400">{formatMoney(p.TAW)}</td>
                        <td className="p-4 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">{formatMoney(p.TCC)}</td>
                        <td className="p-4 text-right font-mono text-rose-500">{formatMoney(p.VAT_12)}</td>
                        <td className="p-4 text-right font-mono font-bold">{formatMoney(p.CC_WITHOUT_VAT)}</td>
                        
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(p.OH_30)}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{formatMoney(p.OH_20)}</td>
                        <td className="p-4 text-right font-mono text-slate-500 border-r dark:border-slate-800">{formatMoney(p.OH_12)}</td>
                        
                        <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(p.TARGET_DLM_30)}</td>
                        <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(p.TARGET_DLM_20)}</td>
                        <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 border-r dark:border-slate-800">{formatMoney(p.TARGET_DLM_12)}</td>
                        
                        <td className="p-4 text-right font-mono font-black text-amber-600 bg-amber-50/50 dark:bg-amber-900/10">{formatMoney(p.ADLM)}</td>
                        
                        <td className={`p-4 text-right font-mono font-black ${p.SAVING_30 >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatMoney(p.SAVING_30)}
                        </td>
                        <td className={`p-4 text-right font-mono font-black ${p.SAVING_20 >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatMoney(p.SAVING_20)}
                        </td>
                        <td className={`p-4 text-right font-mono font-black ${p.SAVING_12 >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatMoney(p.SAVING_12)}
                        </td>
                        <td className="p-4 italic text-slate-400 text-[10px] uppercase">No Record</td>
                      </tr>
                    ))}
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

            <section className="bg-white dark:bg-[#0a0a0a] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-colors duration-300">
              <div className="px-8 py-4 bg-amber-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={24} />
                  <h2 className="text-xl font-black uppercase tracking-widest">Office Operations Master Ledger</h2>
                </div>
                
                {/* ZOOM CONTROLS (OFFICE) */}
                <div className="flex flex-col items-end gap-2">
                  <div className="text-[10px] font-bold opacity-80 uppercase tracking-[0.2em] hidden sm:block">Administrative Data</div>
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
                        <td colSpan="21" className="p-8 text-center text-slate-400 dark:text-slate-500 italic">Walang naka-record na admin/office department.</td>
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
                        <td className="p-4 text-right font-mono text-slate-500">-</td> {/* Total EOC per Month */}
                        
                        {/* EXPENSES BREAKDOWN */}
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