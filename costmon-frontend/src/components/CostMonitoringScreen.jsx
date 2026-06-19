import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  AlertCircle, 
  Save,
  Calendar,
  Trash2,
  Calculator,
  ArrowUp,
  Receipt,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter
} from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';
import PasswordConfirmModal from './PasswordConfirmModal';
import LoadingOverlay from './LoadingOverlay';

export default function CostMonitoringScreen({ projects, disbursements, onUpdateProject, initialProjectId, userRole,  onModalStateChange, onNavigateToDisbursement }) {
  const canEdit = userRole === 'encoder';
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });
  const [redirectionModal, setRedirectionModal] = useState({ isOpen: false, disbursementId: null, cvNo: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || projects[0]?.id || '');
  
  // State para sa "Popping/Tibok" animation
  const [pulsingCategory, setPulsingCategory] = useState(null);
  const [isAdditionalsModalOpen, setIsAdditionalsModalOpen] = useState(false);
  
  // State & Ref para sa Back to Top button
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainScrollRef = useRef(null);

  // --- ZOOM LOGIC ---
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('costmon_zoom');
    return saved ? parseFloat(saved) : 1;
  });

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const next = Math.min(prev + 0.1, 1.5);
      localStorage.setItem('costmon_zoom', next.toString());
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.1, 0.5);
      localStorage.setItem('costmon_zoom', next.toString());
      return next;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    localStorage.setItem('costmon_zoom', '1');
  };

  // --- CATEGORY FILTER LOGIC (WITH LOCAL STORAGE) ---
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  
  const [selectedCategories, setSelectedCategories] = useState(() => {
    const saved = localStorage.getItem('costmon_category_filter');
    return saved ? JSON.parse(saved) : ['All'];
  });
  
  const [tempSelectedCategories, setTempSelectedCategories] = useState(() => {
    const saved = localStorage.getItem('costmon_category_filter');
    return saved ? JSON.parse(saved) : ['All'];
  });
  
  const categoryFilterRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target)) {
        setIsCategoryFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleCategory = (cat) => {
    if (cat === 'All') {
      setTempSelectedCategories(['All']);
    } else {
      let updated = tempSelectedCategories.filter(c => c !== 'All');
      if (updated.includes(cat)) {
        updated = updated.filter(c => c !== cat);
      } else {
        updated.push(cat);
      }
      if (updated.length === 0) updated = ['All'];
      setTempSelectedCategories(updated);
    }
  };

  const applyCategoryFilter = () => {
    setSelectedCategories(tempSelectedCategories);
    localStorage.setItem('costmon_category_filter', JSON.stringify(tempSelectedCategories));
    setIsCategoryFilterOpen(false);
  };

  // Notify parent of modal state changes
  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(passwordModal.isOpen || isSaving || isSwitching);
    }
  }, [passwordModal.isOpen, isSaving, isSwitching, onModalStateChange]);

  const [prevInitialId, setPrevInitialId] = useState(initialProjectId);

  if (initialProjectId !== prevInitialId) {
    setPrevInitialId(initialProjectId);
    if (initialProjectId) {
      setIsSwitching(true);
      setSelectedProjectId(initialProjectId);
      setTimeout(() => setIsSwitching(false), 1000);
    }
  }

  const project = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
    [projects, selectedProjectId]
  );

  const [editingValues, setEditingValues] = useState(() => {
    const p = projects.find(item => item.id === (initialProjectId || projects[0]?.id || ''));
    if (p) {
      return {
        contract_cost: p.contract_cost || 0,
        profit_percentage: p.profit_percentage || 0.15,
        project_area: p.project_area || '',
        project_start: p.project_start || '',
        days_end: p.days_end || ''
      };
    }
    return { profit_percentage: 0.15 };
  });

  const [prevProject, setPrevProject] = useState(project);

  if (project?.id !== prevProject?.id) {
    setPrevProject(project);
    if (project) {
      setEditingValues({
        contract_cost: project.contract_cost || 0,
        profit_percentage: project.profit_percentage || 0.15,
        project_area: project.project_area || '',
        project_start: project.project_start || '',
        days_end: project.days_end || ''
      });
      setPulsingCategory(null);
      // NOTE: Hindi na natin ire-reset ang filter dito para mag-persist siya kahit mag-switch ng project!
    }
  }

  const handleInputChange = (field, value) => {
    setEditingValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveClick = () => {
    if (!canEdit) return;
    setPasswordModal({ isOpen: true, action: 'update_project', payload: editingValues });
  };

  // BAGONG LOGIC: Ctrl + S Shortcut para i-save ang changes
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); 
        if (!isSaving && canEdit && !passwordModal.isOpen && !redirectionModal.isOpen && !isAdditionalsModalOpen) {
          handleSaveClick();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, canEdit, passwordModal.isOpen, redirectionModal.isOpen, isAdditionalsModalOpen, editingValues]);


  const handleDeleteClick = (id) => {
    if (!canEdit) return;
    const disbursement = disbursements.find(d => d.id === id);
    setRedirectionModal({ 
      isOpen: true, 
      disbursementId: id, 
      cvNo: disbursement?.cv_no || '' 
    });
  };

  const handleConfirmRedirection = () => {
    const { disbursementId, cvNo } = redirectionModal;
    setRedirectionModal({ isOpen: false, disbursementId: null, cvNo: '' });
    if (onNavigateToDisbursement) {
      onNavigateToDisbursement(cvNo, disbursementId);
    }
  };

  const executeSaveProject = async (values) => {
    setIsSaving(true);
    if (onUpdateProject && project) {
      await onUpdateProject(project.id, values);
    }
    setIsSaving(false);
  };

  const handlePasswordConfirm = () => {
    if (passwordModal.action === 'update_project') {
      executeSaveProject(passwordModal.payload);
    }
    setPasswordModal({ isOpen: false, action: null, payload: null });
  };

  const financials = useMemo(() => {
    const contractCost = parseFloat(editingValues.contract_cost) || 0;
    const profitPercent = parseFloat(editingValues.profit_percentage) || 0;

    const projectExpenses = (disbursements || []).filter(d => 
      d.project_code && d.project_code.toUpperCase() === project?.project_code?.toUpperCase()
    );

    // SPLIT EXPENSES BY TYPE
    const normalExpenses = projectExpenses.filter(d => d.costing_type === 'normal' || !d.costing_type);
    const additionalExpenses = projectExpenses.filter(d => d.costing_type === 'additional');

    const totalNormalExpenses = normalExpenses.reduce((sum, d) => {
      return sum + (d.expenses || []).reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0);
    }, 0);

    const totalAdditionalExpenses = additionalExpenses.reduce((sum, d) => {
      return sum + (d.expenses || []).reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0);
    }, 0);

    // NORMAL COMPUTATIONS
    const vatNormal = contractCost * (1 - (1 / 1.12)); 
    const budgetCostNormal = contractCost - vatNormal;
    const profitAmountNormal = budgetCostNormal * (1 - (1 / (1 + profitPercent)));
    const budgetCostLimitNormal = budgetCostNormal - profitAmountNormal;
    const excessBudgetNormal = budgetCostLimitNormal - totalNormalExpenses;

    // ADDITIONAL COMPUTATIONS
    const vatAdditional = totalAdditionalExpenses * (1 - (1 / 1.12));
    const budgetCostAdditional = totalAdditionalExpenses - vatAdditional;
    const profitAmountAdditional = budgetCostAdditional * (1 - (1 / (1 + profitPercent)));
    const budgetCostLimitAdditional = budgetCostAdditional - profitAmountAdditional;
    const excessBudgetAdditional = budgetCostLimitAdditional; 

    // OVERALL TOTALS
    const contractOverall = contractCost + totalAdditionalExpenses;
    const vatOverall = vatNormal + vatAdditional;
    const budgetOverall = budgetCostNormal + budgetCostAdditional;
    const profitOverall = profitAmountNormal + profitAmountAdditional;
    const limitOverall = budgetCostLimitNormal + budgetCostLimitAdditional;
    const progressOverall = totalNormalExpenses; 
    const excessOverall = excessBudgetNormal + excessBudgetAdditional;

    return { 
      contractCost, 
      vatAmount: vatNormal,
      budgetCost: budgetCostNormal, 
      profitAmount: profitAmountNormal, 
      profitPercent,
      budgetCostLimit: budgetCostLimitNormal,
      totalNormalExpenses,
      excessBudget: excessBudgetNormal,

      vatAdditional,
      budgetCostAdditional,
      profitAmountAdditional,
      budgetCostLimitAdditional,
      totalAdditionalExpenses,
      excessBudgetAdditional,

      contractOverall,
      vatOverall,
      budgetOverall,
      profitOverall,
      limitOverall,
      progressOverall,
      excessOverall,

      projectExpenses
    };
  }, [editingValues, disbursements, project]);

  // Default Required Tables
  const REQUIRED_CATEGORIES = useMemo(() => [
    "PERMITS & CONSTRUCTION PLANS",
    "DOWN PAYMENT",
    "CARPENTRY",
    "PAINTING",
    "ELECTRICAL",
    "PLUMBING",
    "TEMPERED GLASS",
    "SSS/PAG-IBIG / PHILHEALTH",
    "MISCELLANEOUS COST",
    "LABOR/PAYROLL",
    "ABB 1196 FORWARD",
    "ZAM-546"
  ], []);

  const expensesByCategory = useMemo(() => {
    const grouped = {};
    
    REQUIRED_CATEGORIES.forEach(cat => {
      grouped[cat] = [];
    });

    financials.projectExpenses.forEach(d => {
      if (d.costing_type === 'normal' && d.expenses && d.expenses.length > 0) {
        d.expenses.forEach(exp => {
          const originalCat = exp.category || 'UNCATEGORIZED';
          const catUpper = originalCat.toUpperCase();
          
          const matchedCat = REQUIRED_CATEGORIES.find(c => c.toUpperCase() === catUpper);
          const targetCat = matchedCat ? matchedCat : "MISCELLANEOUS COST";
          
          if (!grouped[targetCat]) {
            grouped[targetCat] = [];
          }
          
          const amount = parseFloat(exp.amount) || 0;
          
          const laborLess = 0;
          const laborEwt = 0;
          const laborTotal = 0;
          const matlQty = 0;
          const matlUnitCost = 0;
          const matlTotal = amount; 
          const totalMatlCost = amount;
          const totalLaborCost = 0;

          let itemDesc = exp.particulars || '';
          if (!matchedCat && targetCat === "MISCELLANEOUS COST") {
            itemDesc = `[${originalCat}] ${itemDesc}`;
          }

          grouped[targetCat].push({
            id: d.id, 
            lineId: exp.id, 
            date: d.date,
            cv_no: d.cv_no,
            or_inv_no: d.or_inv_no,
            payee: d.payee,
            particulars: itemDesc,
            amount: amount,
            laborLess,
            laborEwt,
            laborTotal,
            matlQty,
            matlUnitCost,
            matlTotal,
            totalMatlCost,
            totalLaborCost
          });
        });
      }
    });
    return grouped;
  }, [financials.projectExpenses, REQUIRED_CATEGORIES]);

  const additionalExpensesByCategory = useMemo(() => {
    const grouped = {};

    financials.projectExpenses.forEach(d => {
      if (d.costing_type === 'additional' && d.expenses && d.expenses.length > 0) {
        d.expenses.forEach(exp => {
          const originalCat = exp.category || 'UNCATEGORIZED';
          const targetCat = originalCat.toUpperCase();
          
          if (!grouped[targetCat]) {
            grouped[targetCat] = [];
          }
          
          const amount = parseFloat(exp.amount) || 0;

          const laborLess = 0;
          const laborEwt = 0;
          const laborTotal = 0;
          const matlQty = 0;
          const matlUnitCost = 0;
          const matlTotal = amount; 
          const totalMatlCost = amount;
          const totalLaborCost = 0;
          
          grouped[targetCat].push({
            id: d.id, 
            lineId: exp.id, 
            date: d.date,
            cv_no: d.cv_no,
            or_inv_no: d.or_inv_no,
            payee: d.payee,
            particulars: exp.particulars || '',
            amount: amount,
            laborLess,
            laborEwt,
            laborTotal,
            matlQty,
            matlUnitCost,
            matlTotal,
            totalMatlCost,
            totalLaborCost
          });
        });
      }
    });
    return grouped;
  }, [financials.projectExpenses]);

  // Isala ang mga tables na HINDI WALANG LAMAN
  const displayedCategories = useMemo(() => {
    return REQUIRED_CATEGORIES.filter(category => expensesByCategory[category] && expensesByCategory[category].length > 0);
  }, [REQUIRED_CATEGORIES, expensesByCategory]);

  // CATEGORY FILTER APPLICATION
  const filteredDisplayedCategories = useMemo(() => {
    if (selectedCategories.includes('All')) {
      return displayedCategories;
    }
    return displayedCategories.filter(cat => selectedCategories.includes(cat));
  }, [displayedCategories, selectedCategories]);

  const categoryColorMap = useMemo(() => {
    const colorPalette = [
      'bg-blue-600', 'bg-red-600', 'bg-emerald-600', 'bg-amber-500',
      'bg-purple-600', 'bg-teal-600', 'bg-indigo-600', 'bg-orange-600',
      'bg-cyan-600', 'bg-pink-600', 'bg-rose-700', 'bg-sky-600', 'bg-fuchsia-600', 'bg-lime-600'
    ];
    
    const map = {};
    REQUIRED_CATEGORIES.forEach((category, index) => {
      map[category] = colorPalette[index % colorPalette.length]; 
    });
    return map;
  }, [REQUIRED_CATEGORIES]);

  const formatMoney = (val) => {
    if (val === null || val === undefined || val === '') return '-'; 
    if (isNaN(val)) return '0.00';
    if (val === 0) return '-'; 
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleScrollToCategory = (category) => {
    const element = document.getElementById(`category-${category}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPulsingCategory(category);
      setTimeout(() => {
        setPulsingCategory(null);
      }, 1000);
    }
  };

  const handleMainScroll = () => {
    if (mainScrollRef.current) {
      if (mainScrollRef.current.scrollTop > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    }
  };

  const scrollToTop = () => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!projects.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <p className="text-xl font-medium">Walang nahanap na Project</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden relative">
      
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-300 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm z-10">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
              <FileSpreadsheet size={28} />
            </div>
            COST MONITORING
          </h1>
          <p className="text-slate-500 mt-1 font-medium flex items-center gap-2">
            Project Progress Costing
          </p>
        </div>

        <div className="relative w-full md:w-96 z-50">
          <SearchableDropdown
            options={projects.map(p => `${p.project_code} — ${p.project_name}`)}
            value={project ? `${project.project_code} — ${project.project_name}` : ''}
            onChange={(val) => {
              const selected = projects.find(p => `${p.project_code} — ${p.project_name}` === val);
              if (selected) setSelectedProjectId(selected.id);
            }}
            placeholder="-- Maghanap ng Project --"
          />
        </div>
      </header>

      <main ref={mainScrollRef} onScroll={handleMainScroll} className="flex-1 overflow-y-auto p-8 space-y-8 relative scroll-smooth">
        
        {/* ==============================================
            MODERNIZED PROJECT PROGRESS COSTING BOX
        ============================================== */}
        <div className="w-full overflow-x-auto pb-4">
          <div className="bg-white border-2 border-slate-400 rounded-[2rem] shadow-xl min-w-[1100px] overflow-hidden flex flex-col">
            
            {/* DARK MAIN HEADER */}
            <div className="bg-slate-800 text-center py-4 text-white uppercase tracking-[0.2em] text-sm font-black shadow-md flex items-center justify-center gap-3 relative z-10">
              <Calculator size={18} /> PROJECT PROGRESS COSTING
            </div>
            
            <div className="flex flex-row flex-1">
              
              {/* ==============================================
                  LEFT SIDE: BASIC INFO & BUDGET LIMIT
              ============================================== */}
              <div className="w-[420px] shrink-0 border-r-2 border-slate-400 p-8 bg-slate-50/80 flex flex-col gap-2 text-xs font-bold text-slate-600">
                
                <div className="grid grid-cols-[140px_1fr] items-center py-1">
                  <span className="uppercase tracking-wider text-slate-500">Project Code:</span>
                  <span className="font-black text-blue-600 text-sm">{project?.project_code || '---'}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-1">
                  <span className="uppercase tracking-wider text-slate-500">Project Name:</span>
                  <span className="font-black text-slate-800">{project?.project_name || '---'}</span>
                </div>
                
                <div className="grid grid-cols-[140px_1fr] items-center mt-2">
                  <span className="uppercase tracking-wider text-slate-500">Project Area:</span>
                  <input type="text" 
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" 
                    value={editingValues.project_area} onChange={e => handleInputChange('project_area', e.target.value)} 
                    placeholder="e.g. 150 sqm" />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center mt-2">
                  <span className="uppercase tracking-wider text-slate-500">Project Start:</span>
                  <input type="date" 
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" 
                    value={editingValues.project_start} onChange={e => handleInputChange('project_start', e.target.value)} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center mt-2 mb-6">
                  <span className="uppercase tracking-wider text-slate-500">40 Days End:</span>
                  <input type="date" 
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" 
                    value={editingValues.days_end} onChange={e => handleInputChange('days_end', e.target.value)} />
                </div>

                <div className="w-full h-[2px] bg-slate-300 my-2"></div>

                <div className="grid grid-cols-[140px_1fr] items-center mt-2">
                  <span className="uppercase tracking-wider text-slate-500">Contract Cost:</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-700">₱</span>
                    <input type="number" 
                      className="w-full bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-sm text-right font-black text-sm" 
                      value={editingValues.contract_cost} onChange={e => handleInputChange('contract_cost', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-2">
                  <span className="uppercase tracking-wider text-slate-500">Vat Amount:</span>
                  <span className="text-right font-mono text-sm pr-3 font-bold text-slate-700">{formatMoney(financials.vatAmount)}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-2">
                  <span className="uppercase tracking-wider text-slate-500">Budget Cost:</span>
                  <span className="text-right font-mono text-sm pr-3 font-bold text-slate-700">{formatMoney(financials.budgetCost)}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center mt-1">
                  <span className="uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    Profit @ 
                    <input type="number" 
                      className="w-12 bg-white border-2 border-slate-300 rounded-md px-1 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-center shadow-sm" 
                      value={(editingValues.profit_percentage * 100).toFixed(0)} onChange={e => handleInputChange('profit_percentage', parseFloat(e.target.value) / 100)} />%
                  </span>
                  <span className="text-right font-mono text-sm pr-3 text-emerald-700 font-black">{formatMoney(financials.profitAmount)}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-3 mt-2 bg-blue-50/80 rounded-xl px-4 -ml-4 -mr-4 border-2 border-blue-200">
                  <span className="uppercase tracking-widest text-blue-900 font-black">Budget Limit:</span>
                  <span className="text-right font-mono text-lg font-black text-blue-700">{formatMoney(financials.budgetCostLimit)}</span>
                </div>

                <div className="w-full h-[2px] bg-slate-300 my-4"></div>

                <div className="uppercase tracking-wider text-slate-500 mb-2 font-black">Contract Labor Cost</div>
                <div className="space-y-2 pl-4 border-l-2 border-slate-400 ml-2">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Labor / Payroll:</span>
                    <span className="font-mono font-bold">
                      {formatMoney(expensesByCategory["LABOR/PAYROLL"]?.reduce((sum, item) => sum + item.amount, 0) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>SSS/Pag-ibig/PhilHealth:</span>
                    <span className="font-mono font-bold">
                      {formatMoney(expensesByCategory["SSS/PAG-IBIG / PHILHEALTH"]?.reduce((sum, item) => sum + item.amount, 0) || 0)}
                    </span>
                  </div>
                </div>

                <div className="w-full h-[2px] bg-slate-300 my-4"></div>

                <div className="grid grid-cols-[140px_1fr] items-center py-1">
                  <span className="uppercase tracking-wider text-slate-500 font-black">Total Contract:</span>
                  <div className="flex justify-end gap-2 items-end">
                    <span className="font-mono text-sm font-black text-slate-900">{formatMoney(financials.contractCost)}</span>
                    <span className="text-[10px] text-slate-500 pb-0.5">PHP</span>
                  </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-1 mb-4">
                  <span className="uppercase tracking-wider text-slate-500 font-black">Labor cost:</span>
                  <div className="flex justify-end gap-2 items-end">
                    <span className="font-mono text-sm text-slate-900 font-bold">
                      {formatMoney(expensesByCategory["LABOR/PAYROLL"]?.reduce((sum, item) => sum + item.amount, 0) || 0)}
                    </span>
                    <span className="text-[10px] text-slate-500 pb-0.5">PHP</span>
                  </div>
                </div>

                <div className="bg-slate-800 text-white rounded-xl p-4 flex flex-col gap-1 shadow-lg mt-auto border-2 border-slate-900">
                  <span className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Budget for Mat. & Misc.</span>
                  <div className="flex justify-between items-end">
                    <span className="text-xl font-black text-emerald-400 font-mono">₱ {formatMoney(financials.budgetCostLimit)}</span>
                  </div>
                </div>

              </div>

              {/* ==============================================
                  RIGHT SIDE: BREAKDOWNS & SUMMARY TABLE
              ============================================== */}
              <div className="flex flex-col flex-1 bg-white">
                
                {/* Top Split Columns */}
                <div className="flex flex-row flex-1">
                  
                  {/* Progress-Based Column */}
                  <div className="flex-1 border-r-2 border-slate-400 flex flex-col">
                    <div className="bg-orange-100 text-orange-900 text-center font-black text-xs uppercase py-3 border-b-2 border-slate-400 tracking-wider">
                      Progress-Based Costing
                    </div>
                    <div className="p-6 space-y-3 text-xs font-bold text-slate-700 uppercase flex-1 flex flex-col">
                      {[
                        "PERMITS & CONSTRUCTION PLANS",
                        "DOWN PAYMENT",
                        "CARPENTRY",
                        "PAINTING",
                        "ELECTRICAL",
                        "PLUMBING",
                        "TEMPERED GLASS",
                        "MISCELLANEOUS COST",
                        "LABOR/PAYROLL"
                      ].map(cat => {
                        const catTotal = expensesByCategory[cat]?.reduce((sum, item) => sum + item.amount, 0) || 0;
                        if (catTotal === 0) return null; // ALISIN KAPAG WALANG LAMAN
                        
                        return (
                          <div key={cat} className="flex justify-between border-b border-slate-300 pb-2">
                            <span className="truncate pr-2">{cat === "PERMITS & CONSTRUCTION PLANS" ? "Permits & Const'n Plans" : cat.charAt(0) + cat.slice(1).toLowerCase()}:</span>
                            <span className="font-mono font-black">{formatMoney(catTotal)}</span>
                          </div>
                        );
                      })}
                      
                      <div className="pt-2 text-[10px] text-slate-500 space-y-2">
                        {["ABB 1196 FORWARD", "ZAM-546"].map(cat => {
                          const catTotal = expensesByCategory[cat]?.reduce((sum, item) => sum + item.amount, 0) || 0;
                          if (catTotal === 0) return null; // ALISIN KAPAG WALANG LAMAN
                          
                          return (
                            <div key={cat} className="flex justify-between">
                              <span>{cat === "ABB 1196 FORWARD" ? "ABB Forward" : "ZAM 546"}</span>
                              <span className="font-mono">{formatMoney(catTotal)}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-auto pt-4 flex justify-between items-center border-t-2 border-slate-400">
                         <span className="font-black tracking-wider">DIRECT COST</span>
                         <span className="font-black font-mono text-sm text-slate-900">{formatMoney(Object.values(expensesByCategory).flat().reduce((sum, item) => sum + item.amount, 0))}</span>
                         </div>
                    </div>
                  </div>

                  {/* Additional-Based Column */}
                  <div className="flex-1 flex flex-col bg-slate-50/50">
                    <div className="bg-red-100 text-red-900 text-center font-black text-xs uppercase py-3 border-b-2 border-slate-400 tracking-wider">
                      Additional-Based Costing
                    </div>
                    <div className="p-6 space-y-3 text-xs font-bold text-slate-700 uppercase flex-1 flex flex-col">
                      <div className="flex justify-between border-b border-slate-300 pb-2"><span>Approved Quotations</span><span></span></div>
                      <div className="flex justify-between border-b border-slate-300 pb-2 pl-4 text-slate-500"><span>Permit Waiver</span><span></span></div>
                      
                      <div className="h-4"></div>
                      
                      <div className="flex justify-between border-b border-slate-300 pb-2"><span>Unapproved Quotations</span><span></span></div>
                      
                      <div className="h-4"></div>
                      
                      <div className="flex justify-between border-b border-slate-300 pb-2"><span>Additional Works:</span><span></span></div>
                      
                      {/* DYNAMIC ADDITIONAL CATEGORIES */}
                      {Object.keys(additionalExpensesByCategory).length === 0 ? (
                        <div className="text-center py-4 text-[10px] text-slate-400 italic">No additional costs recorded</div>
                      ) : (
                        Object.keys(additionalExpensesByCategory).map(cat => {
                          const catTotal = additionalExpensesByCategory[cat].reduce((sum, item) => sum + item.amount, 0);
                          return (
                            <div key={cat} className="flex justify-between border-b border-slate-300 pb-2 pl-4 text-slate-600">
                              <span className="truncate pr-2">{cat.length > 25 ? cat.substring(0, 25) + '...' : cat}:</span>
                              <span className="font-mono">{formatMoney(catTotal)}</span>
                            </div>
                          );
                        })
                      )}

                      <div className="flex justify-between border-b border-slate-300 pb-2 pl-4 text-slate-800 font-black mt-2">
                        <span>Total Additional</span>
                        <span className="font-mono text-red-600">
                          {formatMoney(financials.totalAdditionalExpenses)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-300 pb-2 pl-4 text-slate-500">
                        <span>Vat Amount</span>
                        <span className="font-mono">{formatMoney(financials.vatAdditional)}</span>
                      </div>

                      <div className="mt-auto pt-4 flex justify-between items-center border-t-2 border-slate-400 text-slate-600">
                         <span className="font-black tracking-wider text-red-800 uppercase">Add'l Cost Limit</span>
                         <span className="font-black font-mono text-sm text-red-700">
                           {formatMoney(financials.budgetCostAdditional)}
                         </span>
                      </div>
                      
                      {/* VIEW DETAILS BUTTON FOR ADDITIONALS */}
                      <div className="mt-2 pt-2 border-t border-red-200/50">
                        <button 
                          onClick={() => setIsAdditionalsModalOpen(true)}
                          disabled={Object.keys(additionalExpensesByCategory).length === 0}
                          className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-red-200"
                        >
                          <FileSpreadsheet size={14} /> View Full Ledger
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Bottom Summary Table Spanning the Right Section (DYNAMIC) */}
                <div className="p-6 border-t-2 border-slate-400 bg-slate-100/50">
                  <div className="overflow-hidden rounded-xl border-2 border-slate-400 shadow-sm">
                    <table className="w-full text-[11px] font-black uppercase text-slate-800 border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-200 border-b-2 border-slate-400 text-[9px]">
                          <th className="py-2 px-4 text-left border-r-2 border-slate-400">Description</th>
                          <th className="py-2 px-4 text-center border-r-2 border-slate-400">Normal (Voucher)</th>
                          <th className="py-2 px-4 text-center border-r-2 border-slate-400 text-red-700">Additionals</th>
                          <th className="py-2 px-4 text-center">Total Overall</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b-2 border-slate-400">
                          <td className="py-2.5 px-4 bg-orange-100/80 text-orange-900 border-r-2 border-slate-400 w-[40%]">TOTAL CONTRACT COST</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono w-[20%]">{formatMoney(financials.contractCost)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono text-red-600 w-[20%]">{formatMoney(financials.totalAdditionalExpenses)}</td>
                          <td className="py-2.5 px-4 text-center font-mono w-[20%] font-black">{formatMoney(financials.contractOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400">
                          <td className="py-2.5 px-4 bg-emerald-100/80 text-emerald-900 border-r-2 border-slate-400">TOTAL VAT AMOUNT</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono">{formatMoney(financials.vatAmount)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono text-red-600">{formatMoney(financials.vatAdditional)}</td>
                          <td className="py-2.5 px-4 text-center font-mono bg-orange-50 font-black">{formatMoney(financials.vatOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400">
                          <td className="py-2.5 px-4 bg-orange-100/80 text-orange-900 border-r-2 border-slate-400">TOTAL BUDGET COST</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono">{formatMoney(financials.budgetCost)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono text-red-600">{formatMoney(financials.budgetCostAdditional)}</td>
                          <td className="py-2.5 px-4 text-center font-mono bg-orange-50 font-black">{formatMoney(financials.budgetOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400">
                          <td className="py-2.5 px-4 bg-orange-100/80 text-orange-900 border-r-2 border-slate-400">TOTAL PROFIT</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono">{formatMoney(financials.profitAmount)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono text-red-600">{formatMoney(financials.profitAmountAdditional)}</td>
                          <td className="py-2.5 px-4 text-center font-mono bg-orange-50 font-black">{formatMoney(financials.profitOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400">
                          <td className="py-2.5 px-4 bg-blue-100/80 text-blue-900 border-r-2 border-slate-400">TOTAL COST LIMIT (DLM)</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono">{formatMoney(financials.budgetCostLimit)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 text-center font-mono text-red-600">{formatMoney(financials.budgetCostLimitAdditional)}</td>
                          <td className="py-2.5 px-4 text-center font-mono bg-blue-50/50 font-black">{formatMoney(financials.limitOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400">
                          <td className="py-3 px-4 border-r-2 border-slate-400">TOTAL PROGRESS COSTING</td>
                          <td className="py-3 px-4 border-r-2 border-slate-400 text-center font-mono">{formatMoney(financials.totalNormalExpenses)}</td>
                          <td className="py-3 px-4 border-r-2 border-slate-400 text-center font-mono text-slate-400">0.00</td>
                          <td className="py-3 px-4 text-center font-mono font-black">{formatMoney(financials.progressOverall)}</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 border-r-2 border-slate-400 text-slate-600">TOTAL EXCESS BUDGET</td>
                          <td className={`py-3 px-4 border-r-2 border-slate-400 text-center font-mono ${financials.excessBudget < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {formatMoney(financials.excessBudget)}
                          </td>
                          <td className="py-3 px-4 border-r-2 border-slate-400 text-center font-mono text-emerald-600">{formatMoney(financials.excessBudgetAdditional)}</td>
                          <td className={`py-3 px-4 text-center font-mono text-sm font-black ${financials.excessOverall < 0 ? 'bg-rose-200 text-rose-800' : 'bg-slate-300 text-slate-900'}`}>
                            {financials.excessOverall < 0 ? `(${formatMoney(Math.abs(financials.excessOverall))})` : formatMoney(financials.excessOverall)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        {canEdit && (
          <div className="flex justify-end mt-2 animate-in fade-in items-center gap-4">
            <span className="text-xs text-slate-400 font-bold tracking-widest hidden sm:inline-block">CTRL + S</span>
            <button onClick={handleSaveClick} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black shadow-xl shadow-blue-200/50 transition-all flex items-center gap-3 disabled:opacity-50">
              <Save size={20} /> {isSaving ? 'SAVING DATA...' : 'SAVE CHANGES'}
            </button>
          </div>
        )}

        {/* ==============================================
            PROJECT LEDGER (STATIC ROWS WITH FILTERED DISPLAY)
        ============================================== */}
        <section className="bg-[#f8fafc] flex flex-col min-h-[500px] mt-8 relative">
          
          <div className="flex flex-col mb-4">
            
            <div className="flex items-center justify-between mb-4">
              {/* DYNAMIC COLOR GUIDE (Filtered na din) */}
              <div className="flex items-center gap-3 pl-1 h-10 flex-wrap">
                {filteredDisplayedCategories.length > 0 && (
                  <>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Color Guide:</span>
                    <div className="flex flex-row gap-2.5 items-center flex-wrap">
                      {filteredDisplayedCategories.map((category) => {
                        const color = categoryColorMap[category];
                        return (
                          <div 
                            key={category} 
                            onClick={() => handleScrollToCategory(category)}
                            className={`group h-7 min-w-[1.75rem] rounded-md border border-black/10 shadow-sm cursor-pointer flex items-center justify-center transition-all duration-700 ease-in-out ${color} hover:px-4`} 
                          >
                            <span className={`text-xs font-bold text-white whitespace-nowrap overflow-hidden transition-all duration-700 ease-in-out max-w-0 opacity-0 group-hover:max-w-[250px] group-hover:opacity-100`}>
                              {category}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* ACTION BUTTONS (FILTER & ZOOM) */}
              <div className="flex items-center gap-3">
                
                {/* CATEGORY FILTER DROPDOWN */}
                <div className="relative" ref={categoryFilterRef}>
                  <button 
                    onClick={() => {
                      setTempSelectedCategories(selectedCategories);
                      setIsCategoryFilterOpen(!isCategoryFilterOpen);
                    }}
                    className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"
                  >
                    <Filter size={16} className={selectedCategories.includes('All') ? 'text-slate-400' : 'text-blue-600'} />
                    <span>{selectedCategories.includes('All') ? 'All Categories' : `${selectedCategories.length} Selected`}</span>
                  </button>

                  {isCategoryFilterOpen && (
                    <div className="absolute right-0 mt-3 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <span className="font-black text-slate-700 text-sm tracking-tight uppercase">Filter Tables</span>
                        <button onClick={() => setIsCategoryFilterOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={18} /></button>
                      </div>
                      <div className="p-3 max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                        <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group">
                          <input 
                            type="checkbox" 
                            checked={tempSelectedCategories.includes('All')}
                            onChange={() => handleToggleCategory('All')}
                            className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                          />
                          <span className={`text-sm ${tempSelectedCategories.includes('All') ? 'font-black text-slate-800' : 'text-slate-500 font-bold'}`}>Show All Categories</span>
                        </label>
                        {displayedCategories.map(cat => (
                          <label key={cat} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group">
                            <input 
                              type="checkbox" 
                              checked={tempSelectedCategories.includes(cat)}
                              onChange={() => handleToggleCategory(cat)}
                              className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                            />
                            <span className={`text-sm ${tempSelectedCategories.includes(cat) ? 'font-black text-slate-800' : 'text-slate-500 font-bold'}`}>{cat}</span>
                          </label>
                        ))}
                      </div>
                      <div className="p-4 border-t border-slate-100 bg-slate-50">
                        <button 
                          onClick={applyCategoryFilter}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black transition-all shadow-lg shadow-blue-100"
                        >
                          Apply Filter
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ZOOM CONTROLS FOR LEDGER */}
                <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2 py-1 shadow-sm gap-1">
                  <button 
                    onClick={handleZoomOut} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors disabled:opacity-30" 
                    title="Zoom Out"
                    disabled={zoomLevel <= 0.6}
                  >
                    <ZoomOut size={16} />
                  </button>
                  <div className="text-[10px] font-black text-slate-500 w-10 text-center select-none uppercase tracking-tighter">
                    {Math.round(zoomLevel * 100)}%
                  </div>
                  <button 
                    onClick={handleZoomIn} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors disabled:opacity-30" 
                    title="Zoom In"
                    disabled={zoomLevel >= 1.5}
                  >
                    <ZoomIn size={16} />
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <button 
                    onClick={resetZoom} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors" 
                    title="Reset Zoom"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* HEADER LABEL */}
            <div className="flex items-center justify-between mt-2">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  Project Ledger
                  <span className="ml-2 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300">
                    {financials.projectExpenses.length} Entries
                  </span>
                </h3>
                <p className="text-slate-500 text-xs font-medium mt-1 tracking-widest uppercase">Construction Cost Breakdown by Category</p>
              </div>
              <button className="px-5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                Export to Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pb-8">
            {/* MAIN TITLE */}
            <div className="bg-slate-800 text-center py-4 rounded-t-xl font-black text-white uppercase tracking-[0.2em] text-sm shadow-md min-w-[1400px] border-2 border-b-0 border-slate-800">
              CONSTRUCTION COST BREAKDOWN
            </div>

            {filteredDisplayedCategories.length === 0 ? (
              <div className="border-2 border-t-0 border-slate-800 rounded-b-xl bg-white min-w-[1400px] p-20 flex flex-col items-center opacity-50 text-slate-500 shadow-sm">
                <Calendar size={48} className="mb-4" strokeWidth={1.5} />
                <p className="text-xl font-bold">Walang Resulta</p>
                <p className="text-sm font-medium mt-1">Wala sa listahan ang napiling kategorya o walang nai-encode na data para dito.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8 min-w-[1400px] bg-white border-2 border-t-0 border-slate-800 rounded-b-xl p-6 shadow-sm relative">
                
                {/* LOOP: Ididisplay lang ang may laman AT NASA FILTER (filteredDisplayedCategories) */}
                {filteredDisplayedCategories.map((category) => {
                  
                  const items = expensesByCategory[category] || [];
                  const headerColor = categoryColorMap[category];
                  const isPulsing = pulsingCategory === category;

                  return (
                    <div 
                      key={category} 
                      id={`category-${category}`} 
                      className={`border-2 border-slate-800 rounded-xl overflow-hidden scroll-mt-24 transition-all duration-500 ease-out ${
                        isPulsing ? 'scale-[1.02] shadow-[0_15px_40px_rgba(0,0,0,0.25)] ring-4 ring-slate-400 z-10 relative -translate-y-2' : 'shadow-sm'
                      }`}
                    >
                      <table className="w-full text-left border-collapse text-xs" style={{ zoom: zoomLevel }}>
                        <thead>
                          {/* CATEGORY BANNER */}
                          <tr className={`${headerColor} border-b-2 border-slate-800`}>
                            <th colSpan={canEdit ? 14 : 13} className="text-center py-3.5 font-black text-white uppercase tracking-[0.15em] text-sm">
                              {category}
                            </th>
                          </tr>
                          
                          {/* COLUMN HEADERS */}
                          <tr className="bg-slate-200 border-b-2 border-slate-800 text-[10px] font-black text-slate-800 text-center uppercase tracking-wider leading-tight">
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">Date</th>
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">C.V.#</th>
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">Invoice</th>
                            <th className="py-3 px-2 w-[15%] text-left border-r border-slate-800">Supplier / Particulars</th>
                            <th className="py-3 px-2 w-[15%] text-left border-r border-slate-800">Item Description</th>
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">Labor Less</th>
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">Labor Ewt</th>
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">Labor Total</th>
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">Mat'l QTY</th>
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">Mat'l Unit Cost</th>
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800">Mat'l Total</th>
                            <th className="py-3 px-2 w-[8%] border-r border-slate-800">Total Mat'l Cost</th>
                            <th className="py-3 px-2 w-[8%] border-r border-slate-800 text-right pr-4">Total Labor Cost</th>
                            {canEdit && <th className="py-3 px-2 w-[4%]">Act</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-white">
                          
                          {/* DATA ROWS (READ ONLY) */}
                          {items.map((item, i) => (
                            <tr key={`${item.id}-${i}`} className="hover:bg-slate-50 transition-colors text-[11px]">
                              <td className="p-3 text-center font-bold text-slate-700 border-r border-slate-800">{item.date}</td>
                              <td className="p-3 text-center border-r border-slate-800">
                                <span className="px-1.5 py-1 bg-white text-slate-800 rounded font-mono font-bold text-[10px] border border-slate-300">{item.cv_no || 'N/A'}</span>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-700 border-r border-slate-800">{item.or_inv_no || '-'}</td>
                              <td className="p-3 font-bold text-slate-800 text-left border-r border-slate-800 truncate max-w-[150px]" title={item.payee}>{item.payee}</td>
                              <td className="p-3 font-medium text-slate-600 text-left border-r border-slate-800 truncate max-w-[150px]" title={item.particulars}>{item.particulars}</td>
                              
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800 bg-slate-50/50">{formatMoney(item.laborLess)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800 bg-slate-50/50">{formatMoney(item.laborEwt)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800 bg-slate-50/50">{formatMoney(item.laborTotal)}</td>
                              
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlQty)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlUnitCost)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlTotal)}</td>
                              
                              <td className="p-3 text-right font-mono font-bold text-slate-800 border-r border-slate-800 bg-slate-100/50">{formatMoney(item.totalMatlCost)}</td>
                              <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 border-r border-slate-800 bg-slate-100/50">{formatMoney(item.totalLaborCost)}</td>

                              {canEdit && (
                                <td className="p-2 text-center bg-white">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id); }} 
                                    className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors" 
                                    title="Update/Delete in Disbursement"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}

                          {/* SUBTOTAL ROW (READ ONLY) */}
                          <tr className="bg-slate-100 border-t-2 border-slate-800">
                            <td colSpan="11" className="p-3 text-right font-black text-[11px] uppercase tracking-widest text-slate-800 border-r border-slate-800">
                              TOTAL FOR {category}:
                            </td>
                            <td className="p-3 text-right font-mono font-black text-slate-800 text-sm border-r border-slate-800 bg-slate-200/50">
                              ₱ {items.reduce((sum, i) => sum + i.totalMatlCost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-800 text-sm border-r border-slate-800 bg-slate-200/50">
                              ₱ {items.reduce((sum, i) => sum + i.totalLaborCost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            {canEdit && <td></td>}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* ==============================================
          FLOATING BACK TO TOP BUTTON
      ============================================== */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          title="Bumalik sa itaas"
          className="absolute bottom-8 right-8 w-12 h-12 bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-700 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.3)] transition-all duration-300 z-50 animate-in fade-in zoom-in"
        >
          <ArrowUp size={24} strokeWidth={2.5} />
        </button>
      )}

      <PasswordConfirmModal
        isOpen={passwordModal.isOpen}
        actionType={passwordModal.action === 'update_project' ? 'update' : 'delete'}
        onClose={() => setPasswordModal({ isOpen: false, action: null, payload: null })}
        onConfirm={handlePasswordConfirm}
      />

      {/* REDIRECTION WARNING MODAL */}
      {redirectionModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-5">
                <Receipt size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Redirect to Disbursement</h3>
              <p className="text-slate-500 font-medium mb-6">
                Para i-update o idelete ang item na ito, kailangan nating lumipat sa <span className="font-bold text-slate-800 underline">Disbursement Ledger</span>. Awtomatikong bubukas ang voucher <span className="font-mono font-bold text-blue-600">#{redirectionModal.cvNo}</span> para sa iyo.
              </p>
              
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => setRedirectionModal({ isOpen: false, disbursementId: null, cvNo: '' })}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmRedirection}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  Confirm & Go <ArrowUp className="rotate-90" size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isSaving || isSwitching) && (
        <LoadingOverlay 
          message={isSwitching ? "Switching Project" : "Saving Changes"} 
          subtext={isSwitching ? "Inihahanda ang data..." : "Paki-antay lamang..."} 
        />
      )}

      {/* ADDITIONAL WORKS MODAL */}
      <AdditionalsLedgerModal 
        isOpen={isAdditionalsModalOpen} 
        onClose={() => setIsAdditionalsModalOpen(false)} 
        data={additionalExpensesByCategory} 
        canEdit={canEdit}
        onDeleteClick={handleDeleteClick}
        zoomLevel={zoomLevel} // Ipinasa ang zoom level
      />
    </div>
  );
}

// MODAL COMPONENT para sa Additional Works (na may zoom)
function AdditionalsLedgerModal({ isOpen, onClose, data, canEdit, onDeleteClick, zoomLevel }) {
  if (!isOpen) return null;

  const totalAmount = Object.values(data).flat().reduce((sum, item) => sum + item.amount, 0);

  const formatMoney = (val) => {
    if (val === null || val === undefined || val === '') return '-'; 
    if (isNaN(val)) return '0.00';
    if (val === 0) return '-'; 
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-[98vw] max-w-[1600px] h-[90vh] rounded-2xl shadow-2xl flex flex-col p-6 border-4 border-red-200 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
          <h2 className="text-xl font-black text-red-800 tracking-tight flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg text-red-600">
              <FileSpreadsheet size={22} />
            </div>
            Additional Works & Costs Ledger
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar mt-4 pb-4">
          <div className="flex flex-col gap-8 min-w-[1400px]">
            {Object.keys(data).length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <p>No additional costs recorded.</p>
              </div>
            ) : (
              Object.entries(data).map(([category, items]) => (
                <div key={category} className="border-2 border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs" style={{ zoom: zoomLevel }}>
                    <thead>
                      <tr className="bg-slate-800 border-b-2 border-slate-800">
                        <th colSpan={canEdit ? 14 : 13} className="text-center py-3.5 font-black text-white uppercase tracking-[0.15em] text-sm">
                          {category}
                        </th>
                      </tr>
                      
                      {/* COLUMN HEADERS - Matched with Main Ledger */}
                      <tr className="bg-slate-200 border-b-2 border-slate-800 text-[10px] font-black text-slate-800 text-center uppercase tracking-wider leading-tight">
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">Date</th>
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">C.V.#</th>
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">Invoice</th>
                        <th className="py-3 px-2 w-[15%] text-left border-r border-slate-800">Supplier / Particulars</th>
                        <th className="py-3 px-2 w-[15%] text-left border-r border-slate-800">Item Description</th>
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">Labor Less</th>
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">Labor Ewt</th>
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">Labor Total</th>
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">Mat'l QTY</th>
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">Mat'l Unit Cost</th>
                        <th className="py-3 px-2 w-[6%] border-r border-slate-800">Mat'l Total</th>
                        <th className="py-3 px-2 w-[8%] border-r border-slate-800">Total Mat'l Cost</th>
                        <th className="py-3 px-2 w-[8%] border-r border-slate-800 text-right pr-4">Total Labor Cost</th>
                        {canEdit && <th className="py-3 px-2 w-[4%]">Act</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-white">
                      {/* DATA ROWS */}
                      {items.map((item, i) => (
                        <tr key={`${item.id}-${i}`} className="hover:bg-slate-50 transition-colors text-[11px]">
                          <td className="p-3 text-center font-bold text-slate-700 border-r border-slate-800">{item.date}</td>
                          <td className="p-3 text-center border-r border-slate-800">
                            <span className="px-1.5 py-1 bg-white text-slate-800 rounded font-mono font-bold text-[10px] border border-slate-300">{item.cv_no || 'N/A'}</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-700 border-r border-slate-800">{item.or_inv_no || '-'}</td>
                          <td className="p-3 font-bold text-slate-800 text-left border-r border-slate-800 truncate max-w-[150px]" title={item.payee}>{item.payee}</td>
                          <td className="p-3 font-medium text-slate-600 text-left border-r border-slate-800 truncate max-w-[150px]" title={item.particulars}>{item.particulars}</td>
                          
                          <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800 bg-slate-50/50">{formatMoney(item.laborLess)}</td>
                          <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800 bg-slate-50/50">{formatMoney(item.laborEwt)}</td>
                          <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800 bg-slate-50/50">{formatMoney(item.laborTotal)}</td>
                          
                          <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlQty)}</td>
                          <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlUnitCost)}</td>
                          <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlTotal)}</td>
                          
                          <td className="p-3 text-right font-mono font-bold text-slate-800 border-r border-slate-800 bg-slate-100/50">{formatMoney(item.totalMatlCost)}</td>
                          <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 border-r border-slate-800 bg-slate-100/50">{formatMoney(item.totalLaborCost)}</td>

                          {canEdit && (
                            <td className="p-2 text-center bg-white">
                              <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteClick(item.id); }} 
                                className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors" 
                                title="Update/Delete in Disbursement"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}

                      {/* SUBTOTAL ROW */}
                      <tr className="bg-slate-100 border-t-2 border-slate-800">
                        <td colSpan="11" className="p-3 text-right font-black text-[11px] uppercase tracking-widest text-slate-800 border-r border-slate-800">
                          TOTAL FOR {category}:
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-800 text-sm border-r border-slate-800 bg-slate-200/50">
                          ₱ {items.reduce((sum, i) => sum + i.totalMatlCost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right pr-4 font-mono font-black text-slate-800 text-sm border-r border-slate-800 bg-slate-200/50">
                          ₱ {items.reduce((sum, i) => sum + i.totalLaborCost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        {canEdit && <td></td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end items-center mt-2 shrink-0">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold uppercase text-slate-500">Grand Total Additionals:</span>
            <span className="text-2xl font-black text-red-700 font-mono">
              ₱ {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}