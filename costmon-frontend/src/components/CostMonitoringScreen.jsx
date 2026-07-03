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
  Filter,
  Plus,
  ChevronDown,
  CheckCircle2,
  Edit2
} from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';
import PasswordConfirmModal from './PasswordConfirmModal';
import LoadingOverlay from './LoadingOverlay';
import UnsavedChangesModal from './UnsavedChangesModal';
import DraftFoundModal from './DraftFoundModal';
import { API_URL } from '../utils/Constants';

export default function CostMonitoringScreen({ projects, disbursements, categories = [], refreshData, onUpdateProject, initialProjectId, userRole, onModalStateChange, onNavigateToDisbursement, onDirtyChange }) {
  const canEdit = userRole === 'encoder';
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });
  const [redirectionModal, setRedirectionModal] = useState({ isOpen: false, disbursementId: null, cvNo: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || projects[0]?.id || '');

  // Modals and Animation states
  const [pulsingCategory, setPulsingCategory] = useState(null);
  const [isAdditionalsModalOpen, setIsAdditionalsModalOpen] = useState(false);
  const [isAddAdditionalModalOpen, setIsAddAdditionalModalOpen] = useState(false);
  const [editingAdditionalId, setEditingAdditionalId] = useState(null);

  // State for Project Unsaved Changes
  const [showProjectUnsavedModal, setShowProjectUnsavedModal] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState(null);

  // Scroll to top
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainScrollRef = useRef(null);

  // --- ZOOM LOGIC ---
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('costmon_zoom');
    return saved ? parseFloat(saved) : 1;
  });

  const handleZoomIn = () => setZoomLevel(prev => { const next = Math.min(prev + 0.1, 1.5); localStorage.setItem('costmon_zoom', next.toString()); return next; });
  const handleZoomOut = () => setZoomLevel(prev => { const next = Math.max(prev - 0.1, 0.5); localStorage.setItem('costmon_zoom', next.toString()); return next; });
  const resetZoom = () => { setZoomLevel(1); localStorage.setItem('costmon_zoom', '1'); };

  // --- CATEGORY FILTER LOGIC ---
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(() => { const saved = localStorage.getItem('costmon_category_filter'); return saved ? JSON.parse(saved) : ['All']; });
  const [tempSelectedCategories, setTempSelectedCategories] = useState(() => { const saved = localStorage.getItem('costmon_category_filter'); return saved ? JSON.parse(saved) : ['All']; });
  const categoryFilterRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) { if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target)) setIsCategoryFilterOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleCategory = (cat) => {
    if (cat === 'All') { setTempSelectedCategories(['All']); } else {
      let updated = tempSelectedCategories.filter(c => c !== 'All');
      if (updated.includes(cat)) updated = updated.filter(c => c !== cat); else updated.push(cat);
      if (updated.length === 0) updated = ['All'];
      setTempSelectedCategories(updated);
    }
  };

  const applyCategoryFilter = () => {
    setSelectedCategories(tempSelectedCategories);
    localStorage.setItem('costmon_category_filter', JSON.stringify(tempSelectedCategories));
    setIsCategoryFilterOpen(false);
  };

  const [prevInitialId, setPrevInitialId] = useState(initialProjectId);
  if (initialProjectId !== prevInitialId) {
    setPrevInitialId(initialProjectId);
    if (initialProjectId) {
      setIsSwitching(true); setSelectedProjectId(initialProjectId); setTimeout(() => setIsSwitching(false), 1000);
    }
  }

  const project = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const [editingValues, setEditingValues] = useState(() => {
    const p = projects.find(item => item.id === (initialProjectId || projects[0]?.id || ''));
    if (p) return { 
      contract_cost: p.contract_cost !== undefined && p.contract_cost !== null ? p.contract_cost : '0', 
      profit_percentage: p.profit_percentage !== undefined && p.profit_percentage !== null ? p.profit_percentage : 0.15, 
      project_area: p.project_area !== null && p.project_area !== undefined ? String(p.project_area) : '', 
      project_start: p.project_start || '', 
      days_end: p.days_end || '' 
    };
    return { profit_percentage: 0.15 };
  });

  const [prevProject, setPrevProject] = useState(project);
  if (project?.id !== prevProject?.id) {
    setPrevProject(project);
    if (project) {
      setEditingValues({ 
        contract_cost: project.contract_cost !== undefined && project.contract_cost !== null ? project.contract_cost.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0', 
        profit_percentage: project.profit_percentage !== undefined && project.profit_percentage !== null ? project.profit_percentage : 0.15, 
        project_area: project.project_area !== null && project.project_area !== undefined ? String(project.project_area) : '', 
        project_start: project.project_start || '', 
        days_end: project.days_end || '' 
      });
      setPulsingCategory(null);
    }
  }

  // CHECKER KUNG MAY BAGO SA PROJECT DETAILS
  const isProjectDirty = useMemo(() => {
    if (!project) return false;
    
    const currentCost = parseFloat(String(editingValues.contract_cost || 0).replace(/,/g, ''));
    const projectCost = parseFloat(String(project.contract_cost || 0).replace(/,/g, ''));
    if (Math.abs(currentCost - projectCost) > 0.01) return true;

    const currentProfit = parseFloat(editingValues.profit_percentage !== undefined && editingValues.profit_percentage !== null ? editingValues.profit_percentage : 0.15);
    const projectProfit = parseFloat(project.profit_percentage !== undefined && project.profit_percentage !== null ? project.profit_percentage : 0.15);
    if (Math.abs(currentProfit - projectProfit) > 0.001) return true;

    const currentArea = String(editingValues.project_area !== null && editingValues.project_area !== undefined ? editingValues.project_area : '').trim();
    const projectArea = String(project.project_area !== null && project.project_area !== undefined ? project.project_area : '').trim();
    if (currentArea !== projectArea) return true;

    // Compare only YYYY-MM-DD for dates to avoid timezone/timestamp false mismatches
    const currentStart = String(editingValues.project_start || '').trim().substring(0, 10);
    const projectStart = String(project.project_start || '').trim().substring(0, 10);
    if (currentStart !== projectStart) return true;

    const currentDaysEnd = String(editingValues.days_end || '').trim().substring(0, 10);
    const projectDaysEnd = String(project.days_end || '').trim().substring(0, 10);
    if (currentDaysEnd !== projectDaysEnd) return true;

    return false;
  }, [editingValues, project]);

  // Sync dirty state to App.jsx
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isProjectDirty, editingValues, project?.id);
    }
  }, [isProjectDirty, editingValues, project?.id, onDirtyChange]);

  // Clean up dirty state when navigating away (e.g., via browser BACK button)
  useEffect(() => {
    return () => {
      if (onDirtyChange) {
        onDirtyChange(false, null, null);
      }
    };
  }, [onDirtyChange]);

  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(passwordModal.isOpen || isSaving || isSwitching || isAddAdditionalModalOpen || isAdditionalsModalOpen || showProjectUnsavedModal);
    }
  }, [passwordModal.isOpen, isSaving, isSwitching, isAddAdditionalModalOpen, isAdditionalsModalOpen, showProjectUnsavedModal, onModalStateChange]);

  // PREVENT CLOSING THE TAB IF THERE ARE UNSAVED PROJECT CHANGES
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isProjectDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProjectDirty]);

  const handleProjectDropdownChange = (val) => {
    const selected = projects.find(p => `${p.project_code} — ${p.project_name}` === val);
    if (selected) {
      if (isProjectDirty) {
        setPendingProjectId(selected.id);
        setShowProjectUnsavedModal(true);
      } else {
        setSelectedProjectId(selected.id);
      }
    }
  };

  const handleInputChange = (field, value) => setEditingValues(prev => ({ ...prev, [field]: value }));
  const handleSaveClick = () => {
    if (!canEdit) return;
    executeSaveProject(editingValues);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving && canEdit && !passwordModal.isOpen && !redirectionModal.isOpen && !isAdditionalsModalOpen && !isAddAdditionalModalOpen && !showProjectUnsavedModal) handleSaveClick();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, canEdit, passwordModal.isOpen, redirectionModal.isOpen, isAdditionalsModalOpen, isAddAdditionalModalOpen, showProjectUnsavedModal, editingValues]);

  const handleDeleteClick = (id) => {
    if (!canEdit) return;
    const disbursement = disbursements.find(d => d.id === id);
    if (disbursement?.costing_type === 'additional') {
      setPasswordModal({ isOpen: true, action: 'delete_additional', payload: id });
    } else {
      setRedirectionModal({ isOpen: true, disbursementId: id, cvNo: disbursement?.cv_no || '' });
    }
  };

  const handleEditAdditionalClick = (id) => {
    if (!canEdit) return;
    setEditingAdditionalId(id);
    setIsAddAdditionalModalOpen(true);
  };

  const handleOpenAddAdditional = () => {
    setEditingAdditionalId(null);
    setIsAddAdditionalModalOpen(true);
  };

  const handleConfirmRedirection = () => {
    const { disbursementId, cvNo } = redirectionModal;
    setRedirectionModal({ isOpen: false, disbursementId: null, cvNo: '' });
    if (onNavigateToDisbursement) onNavigateToDisbursement(cvNo, disbursementId);
  };

  const executeSaveProject = async (values) => {
    setIsSaving(true);
    if (onUpdateProject && project) {
      const cleanValues = {
        ...values,
        contract_cost: values.contract_cost ? String(values.contract_cost).replace(/,/g, '') : '0'
      };
      await onUpdateProject(project.id, cleanValues);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    }
    setIsSaving(false);
  };

  const handlePasswordConfirm = async () => {
    if (passwordModal.action === 'delete_additional') {
      setIsSaving(true);
      try {
        const token = localStorage.getItem('fbtmcc_token');
        const response = await fetch(`${API_URL}/disbursements/${passwordModal.payload}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) { if (refreshData) await refreshData(); }
      } catch (error) { console.error("Failed to delete additional cost:", error); } finally { setIsSaving(false); }
    }
    setPasswordModal({ isOpen: false, action: null, payload: null });
  };

  const financials = useMemo(() => {
    const contractCost = parseFloat(String(editingValues.contract_cost).replace(/,/g, '')) || 0;
    const profitPercent = parseFloat(editingValues.profit_percentage) || 0;

    const projectExpenses = (disbursements || []).filter(d => d.project_code && d.project_code.toUpperCase() === project?.project_code?.toUpperCase());

    const normalExpenses = projectExpenses.filter(d => d.costing_type === 'normal' || !d.costing_type);
    const additionalExpenses = projectExpenses.filter(d => d.costing_type === 'additional');

    const totalNormalExpenses = normalExpenses.reduce((sum, d) => sum + (d.expenses || []).reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0), 0);
    const totalAdditionalExpenses = additionalExpenses.reduce((sum, d) => sum + (d.expenses || []).reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0), 0);

    const vatNormal = contractCost * (1 - (1 / 1.12));
    const budgetCostNormal = contractCost - vatNormal;
    const profitAmountNormal = budgetCostNormal * (1 - (1 / (1 + profitPercent)));
    const budgetCostLimitNormal = budgetCostNormal - profitAmountNormal;
    const excessBudgetNormal = budgetCostLimitNormal - totalNormalExpenses;

    const vatAdditional = totalAdditionalExpenses * (1 - (1 / 1.12));
    const budgetCostAdditional = totalAdditionalExpenses - vatAdditional;
    const profitAmountAdditional = budgetCostAdditional * (1 - (1 / (1 + profitPercent)));
    const budgetCostLimitAdditional = budgetCostAdditional - profitAmountAdditional;
    const excessBudgetAdditional = budgetCostLimitAdditional;

    return {
      contractCost, vatAmount: vatNormal, budgetCost: budgetCostNormal, profitAmount: profitAmountNormal, profitPercent, budgetCostLimit: budgetCostLimitNormal, totalNormalExpenses, excessBudget: excessBudgetNormal,
      vatAdditional, budgetCostAdditional, profitAmountAdditional, budgetCostLimitAdditional, totalAdditionalExpenses, excessBudgetAdditional,
      contractOverall: contractCost + totalAdditionalExpenses, vatOverall: vatNormal + vatAdditional, budgetOverall: budgetCostNormal + budgetCostAdditional, profitOverall: profitAmountNormal + profitAmountAdditional, limitOverall: budgetCostLimitNormal + budgetCostLimitAdditional, progressOverall: totalNormalExpenses, excessOverall: excessBudgetNormal + excessBudgetAdditional,
      projectExpenses
    };
  }, [editingValues, disbursements, project]);

  const REQUIRED_CATEGORIES = useMemo(() => ["PERMITS & CONSTRUCTION PLANS", "DOWN PAYMENT", "CARPENTRY", "PAINTING", "ELECTRICAL", "PLUMBING", "TEMPERED GLASS", "SSS/PAG-IBIG / PHILHEALTH", "MISCELLANEOUS COST", "LABOR/PAYROLL", "ABB 1196 FORWARD", "ZAM-546"], []);

  const expensesByCategory = useMemo(() => {
    const grouped = {};
    REQUIRED_CATEGORIES.forEach(cat => { grouped[cat] = []; });
    financials.projectExpenses.forEach(d => {
      if (d.costing_type === 'normal' && d.expenses && d.expenses.length > 0) {
        d.expenses.forEach(exp => {
          const originalCat = exp.category || 'UNCATEGORIZED';
          const catUpper = originalCat.toUpperCase();
          const matchedCat = REQUIRED_CATEGORIES.find(c => c.toUpperCase() === catUpper);
          const targetCat = matchedCat ? matchedCat : "MISCELLANEOUS COST";
          if (!grouped[targetCat]) grouped[targetCat] = [];

          const amount = parseFloat(exp.amount) || 0;
          let itemDesc = exp.particulars || '';
          if (!matchedCat && targetCat === "MISCELLANEOUS COST") itemDesc = `[${originalCat}] ${itemDesc}`;

          grouped[targetCat].push({
            id: d.id, lineId: exp.id, date: d.date, cv_no: d.cv_no, or_inv_no: d.or_inv_no, payee: d.payee, particulars: itemDesc, amount: amount,
            laborLess: 0, laborEwt: 0, laborTotal: 0, matlQty: 0, matlUnitCost: 0, matlTotal: amount, totalMatlCost: amount, totalLaborCost: 0
          });
        });
      }
    });
    return grouped;
  }, [financials.projectExpenses, REQUIRED_CATEGORIES]);

  // FLAT LIST PARA SA ADDITIONAL COSTING (1 BIG LIST)
  const flatAdditionalExpenses = useMemo(() => {
    const list = [];
    financials.projectExpenses.forEach(d => {
      if (d.costing_type === 'additional' && d.expenses && d.expenses.length > 0) {
        d.expenses.forEach(exp => {
          const amount = parseFloat(exp.amount) || 0;
          list.push({
            id: d.id, lineId: exp.id, date: d.date, cv_no: d.cv_no, or_inv_no: d.or_inv_no, payee: d.payee, particulars: exp.particulars, itemName: exp.category || 'Uncategorized', amount: amount,
            laborLess: 0, laborEwt: 0, laborTotal: 0, matlQty: 0, matlUnitCost: 0, matlTotal: amount, totalMatlCost: amount, totalLaborCost: 0
          });
        });
      }
    });
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [financials.projectExpenses]);

  const displayedCategories = useMemo(() => REQUIRED_CATEGORIES.filter(category => expensesByCategory[category] && expensesByCategory[category].length > 0), [REQUIRED_CATEGORIES, expensesByCategory]);
  const filteredDisplayedCategories = useMemo(() => selectedCategories.includes('All') ? displayedCategories : displayedCategories.filter(cat => selectedCategories.includes(cat)), [displayedCategories, selectedCategories]);

  const categoryColorMap = useMemo(() => {
    const colorPalette = ['bg-blue-600', 'bg-red-600', 'bg-emerald-600', 'bg-amber-500', 'bg-purple-600', 'bg-teal-600', 'bg-indigo-600', 'bg-orange-600', 'bg-cyan-600', 'bg-pink-600', 'bg-rose-700', 'bg-sky-600', 'bg-fuchsia-600', 'bg-lime-600'];
    const map = {};
    REQUIRED_CATEGORIES.forEach((category, index) => { map[category] = colorPalette[index % colorPalette.length]; });
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
      setTimeout(() => setPulsingCategory(null), 1000);
    }
  };

  const handleMainScroll = () => {
    if (mainScrollRef.current) setShowScrollTop(mainScrollRef.current.scrollTop > 300);
  };
  const scrollToTop = () => { if (mainScrollRef.current) mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (!projects.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 transition-colors duration-300">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <p className="text-xl font-medium">Walang nahanap na Project</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 overflow-hidden relative transition-colors duration-300">

      {/* HEADER SECTION */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm z-10 transition-colors duration-300">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200 dark:shadow-none">
              <FileSpreadsheet size={28} />
            </div>
            COST MONITORING
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2">Project Progress Costing</p>
        </div>

        <div className="relative w-full md:w-96 z-50">
          <SearchableDropdown
            options={projects.map(p => `${p.project_code} — ${p.project_name}`)}
            value={project ? `${project.project_code} — ${project.project_name}` : ''}
            onChange={handleProjectDropdownChange}
            placeholder="-- Maghanap ng Project --"
          />
        </div>
      </header>

      <main ref={mainScrollRef} onScroll={handleMainScroll} className="flex-1 overflow-y-auto p-8 space-y-8 relative scroll-smooth custom-scrollbar">

        {/* ==============================================
            MODERNIZED PROJECT PROGRESS COSTING BOX
        ============================================== */}
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 rounded-[2rem] shadow-xl min-w-[1100px] overflow-hidden flex flex-col transition-colors duration-300">

            <div className="bg-slate-800 dark:bg-slate-900 text-center py-4 text-white uppercase tracking-[0.2em] text-sm font-black shadow-md flex items-center justify-center gap-3 relative z-10">
              <Calculator size={18} /> PROJECT PROGRESS COSTING
            </div>

            <div className="flex flex-row flex-1">

              {/* LEFT SIDE: BASIC INFO & BUDGET LIMIT */}
              <div className="w-[420px] shrink-0 border-r-2 border-slate-400 dark:border-slate-600 p-8 bg-slate-50/80 dark:bg-slate-800/80 flex flex-col gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors duration-300">
                <div className="grid grid-cols-[140px_1fr] items-center py-1">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">Project Code:</span>
                  <span className="font-black text-blue-600 dark:text-blue-400 text-sm">{project?.project_code || '---'}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-1">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">Project Name:</span>
                  <span className="font-black text-slate-800 dark:text-white">{project?.project_name || '---'}</span>
                </div>

                <div className="grid grid-cols-[140px_1fr] items-center mt-2">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">Project Area:</span>
                  <input type="text" className="w-full bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 dark:text-white"
                    value={editingValues.project_area} onChange={e => handleInputChange('project_area', e.target.value)} placeholder="e.g. 150 sqm" />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center mt-2">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">Project Start:</span>
                  <input type="date" className="w-full bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 dark:text-white"
                    value={editingValues.project_start} onChange={e => handleInputChange('project_start', e.target.value)} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center mt-2 mb-6">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">40 Days End:</span>
                  <input type="date" className="w-full bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 dark:text-white"
                    value={editingValues.days_end} onChange={e => handleInputChange('days_end', e.target.value)} />
                </div>

                <div className="w-full h-[2px] bg-slate-300 dark:bg-slate-600 my-2"></div>

                <div className="grid grid-cols-[140px_1fr] items-center mt-2">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">Contract Cost:</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-700 dark:text-amber-500">₱</span>
                    <input type="text" className="w-full bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-400 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none shadow-sm text-right font-black text-sm"
                      value={editingValues.contract_cost} onChange={e => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                        if (val) {
                          const p2 = val.split('.');
                          p2[0] = p2[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                          val = p2.join('.');
                        }
                        handleInputChange('contract_cost', val);
                      }} />
                  </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-2">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">Vat Amount:</span>
                  <span className="text-right font-mono text-sm pr-3 font-bold text-slate-700 dark:text-slate-300">{formatMoney(financials.vatAmount)}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-2">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">Budget Cost:</span>
                  <span className="text-right font-mono text-sm pr-3 font-bold text-slate-700 dark:text-slate-300">{formatMoney(financials.budgetCost)}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center mt-1">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Profit @ <input type="number" className="w-12 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 rounded-md px-1 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-center shadow-sm text-slate-800 dark:text-white"
                      value={(editingValues.profit_percentage * 100).toFixed(0)} onChange={e => handleInputChange('profit_percentage', parseFloat(e.target.value) / 100)} />%
                  </span>
                  <span className="text-right font-mono text-sm pr-3 text-emerald-700 dark:text-emerald-400 font-black">{formatMoney(financials.profitAmount)}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-3 mt-2 bg-blue-50/80 dark:bg-blue-900/20 rounded-xl px-4 -ml-4 -mr-4 border-2 border-blue-200 dark:border-blue-800">
                  <span className="uppercase tracking-widest text-blue-900 dark:text-blue-300 font-black">Budget Limit:</span>
                  <span className="text-right font-mono text-lg font-black text-blue-700 dark:text-blue-400">{formatMoney(financials.budgetCostLimit)}</span>
                </div>

                <div className="w-full h-[2px] bg-slate-300 dark:bg-slate-600 my-4"></div>

                <div className="uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-black">Contract Labor Cost</div>
                <div className="space-y-2 pl-4 border-l-2 border-slate-400 dark:border-slate-600 ml-2">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Labor / Payroll:</span><span className="font-mono font-bold">{formatMoney(expensesByCategory["LABOR/PAYROLL"]?.reduce((sum, item) => sum + item.amount, 0) || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>SSS/Pag-ibig/PhilHealth:</span><span className="font-mono font-bold">{formatMoney(expensesByCategory["SSS/PAG-IBIG / PHILHEALTH"]?.reduce((sum, item) => sum + item.amount, 0) || 0)}</span>
                  </div>
                </div>

                <div className="w-full h-[2px] bg-slate-300 dark:bg-slate-600 my-4"></div>

                <div className="grid grid-cols-[140px_1fr] items-center py-1">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">Total Contract:</span>
                  <div className="flex justify-end gap-2 items-end">
                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white">{formatMoney(financials.contractCost)}</span><span className="text-[10px] text-slate-500 pb-0.5">PHP</span>
                  </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center py-1 mb-4">
                  <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">Labor cost:</span>
                  <div className="flex justify-end gap-2 items-end">
                    <span className="font-mono text-sm text-slate-900 dark:text-white font-bold">{formatMoney(expensesByCategory["LABOR/PAYROLL"]?.reduce((sum, item) => sum + item.amount, 0) || 0)}</span><span className="text-[10px] text-slate-500 pb-0.5">PHP</span>
                  </div>
                </div>

                <div className="bg-slate-800 dark:bg-slate-900 text-white rounded-xl p-4 flex flex-col gap-1 shadow-lg mt-auto border-2 border-slate-900 dark:border-black">
                  <span className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Budget for Mat. & Misc.</span>
                  <div className="flex justify-between items-end"><span className="text-xl font-black text-emerald-400 font-mono">₱ {formatMoney(financials.budgetCostLimit)}</span></div>
                </div>
              </div>

              {/* RIGHT SIDE: BREAKDOWNS & SUMMARY TABLE */}
              <div className="flex flex-col flex-1 bg-white dark:bg-slate-800 transition-colors duration-300">
                <div className="flex flex-row flex-1">

                  {/* Progress-Based Column */}
                  <div className="flex-1 border-r-2 border-slate-400 dark:border-slate-600 flex flex-col">
                    <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-400 text-center font-black text-xs uppercase py-3 border-b-2 border-slate-400 dark:border-slate-600 tracking-wider">Progress-Based Costing</div>
                    <div className="p-6 space-y-3 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex-1 flex flex-col">
                      {["PERMITS & CONSTRUCTION PLANS", "DOWN PAYMENT", "CARPENTRY", "PAINTING", "ELECTRICAL", "PLUMBING", "TEMPERED GLASS", "MISCELLANEOUS COST", "LABOR/PAYROLL"].map(cat => {
                        const catTotal = expensesByCategory[cat]?.reduce((sum, item) => sum + item.amount, 0) || 0;
                        if (catTotal === 0) return null;
                        return (
                          <div key={cat} className="flex justify-between border-b border-slate-300 dark:border-slate-600 pb-2">
                            <span className="truncate pr-2">{cat === "PERMITS & CONSTRUCTION PLANS" ? "Permits & Const'n Plans" : cat.charAt(0) + cat.slice(1).toLowerCase()}:</span>
                            <span className="font-mono font-black">{formatMoney(catTotal)}</span>
                          </div>
                        );
                      })}

                      <div className="pt-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-2">
                        {["ABB 1196 FORWARD", "ZAM-546"].map(cat => {
                          const catTotal = expensesByCategory[cat]?.reduce((sum, item) => sum + item.amount, 0) || 0;
                          if (catTotal === 0) return null;
                          return (
                            <div key={cat} className="flex justify-between">
                              <span>{cat === "ABB 1196 FORWARD" ? "ABB Forward" : "ZAM 546"}</span><span className="font-mono">{formatMoney(catTotal)}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-auto pt-4 flex justify-between items-center border-t-2 border-slate-400 dark:border-slate-600">
                        <span className="font-black tracking-wider">DIRECT COST</span>
                        <span className="font-black font-mono text-sm text-slate-900 dark:text-white">{formatMoney(Object.values(expensesByCategory).flat().reduce((sum, item) => sum + item.amount, 0))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Additional-Based Column */}
                  <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-400 text-center font-black text-xs uppercase py-3 border-b-2 border-slate-400 dark:border-slate-600 tracking-wider">Additional-Based Costing</div>
                    <div className="p-6 space-y-3 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex-1 flex flex-col">

                      {/* SIMPLIFIED SIDEBAR AS REQUESTED IN IMAGE */}
                      <div className="flex justify-between border-b border-slate-300 dark:border-slate-600 pb-2 pl-4 text-slate-800 dark:text-white font-black mt-2">
                        <span>Total Additional</span><span className="font-mono text-red-600 dark:text-red-400">{formatMoney(financials.totalAdditionalExpenses)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-300 dark:border-slate-600 pb-2 pl-4 text-slate-500 dark:text-slate-400">
                        <span>Vat Amount</span><span className="font-mono">{formatMoney(financials.vatAdditional)}</span>
                      </div>

                      <div className="mt-auto pt-4 flex justify-between items-center border-t-2 border-slate-400 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                        <span className="font-black tracking-wider text-red-800 dark:text-red-400 uppercase">Add'l Cost Limit</span>
                        <span className="font-black font-mono text-sm text-red-700 dark:text-red-400">{formatMoney(financials.budgetCostAdditional)}</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-red-200/50 dark:border-red-900/30 flex gap-2">
                        <button
                          onClick={() => setIsAdditionalsModalOpen(true)}
                          disabled={flatAdditionalExpenses.length === 0}
                          className="flex-1 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-red-200 dark:border-red-800"
                        ><FileSpreadsheet size={14} /> View Ledger</button>
                        {canEdit && (
                          <button
                            onClick={handleOpenAddAdditional}
                            className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md shadow-red-200 dark:shadow-none"
                          ><Plus size={14} /> Add Costing</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Summary Table Spanning the Right Section */}
                <div className="p-6 border-t-2 border-slate-400 dark:border-slate-600 bg-slate-100/50 dark:bg-slate-800/80">
                  <div className="overflow-hidden rounded-xl border-2 border-slate-400 dark:border-slate-600 shadow-sm">
                    <table className="w-full text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 border-collapse bg-white dark:bg-slate-800">
                      <thead>
                        <tr className="bg-slate-200 dark:bg-slate-700 border-b-2 border-slate-400 dark:border-slate-600 text-[9px]">
                          <th className="py-2 px-4 text-left border-r-2 border-slate-400 dark:border-slate-600">Description</th>
                          <th className="py-2 px-4 text-center border-r-2 border-slate-400 dark:border-slate-600">Normal (Voucher)</th>
                          <th className="py-2 px-4 text-center border-r-2 border-slate-400 dark:border-slate-600 text-red-700 dark:text-red-400">Additionals</th>
                          <th className="py-2 px-4 text-center">Total Overall</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b-2 border-slate-400 dark:border-slate-600">
                          <td className="py-2.5 px-4 bg-orange-100/80 dark:bg-orange-900/20 text-orange-900 dark:text-orange-400 border-r-2 border-slate-400 dark:border-slate-600 w-[40%]">TOTAL CONTRACT COST</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono w-[20%]">{formatMoney(financials.contractCost)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono text-red-600 dark:text-red-400 w-[20%]">{formatMoney(financials.totalAdditionalExpenses)}</td>
                          <td className="py-2.5 px-4 text-center font-mono w-[20%] font-black">{formatMoney(financials.contractOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400 dark:border-slate-600">
                          <td className="py-2.5 px-4 bg-emerald-100/80 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-400 border-r-2 border-slate-400 dark:border-slate-600">TOTAL VAT AMOUNT</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono">{formatMoney(financials.vatAmount)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono text-red-600 dark:text-red-400">{formatMoney(financials.vatAdditional)}</td>
                          <td className="py-2.5 px-4 text-center font-mono bg-orange-50 dark:bg-orange-900/10 font-black">{formatMoney(financials.vatOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400 dark:border-slate-600">
                          <td className="py-2.5 px-4 bg-orange-100/80 dark:bg-orange-900/20 text-orange-900 dark:text-orange-400 border-r-2 border-slate-400 dark:border-slate-600">TOTAL BUDGET COST</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono">{formatMoney(financials.budgetCost)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono text-red-600 dark:text-red-400">{formatMoney(financials.budgetCostAdditional)}</td>
                          <td className="py-2.5 px-4 text-center font-mono bg-orange-50 dark:bg-orange-900/10 font-black">{formatMoney(financials.budgetOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400 dark:border-slate-600">
                          <td className="py-2.5 px-4 bg-orange-100/80 dark:bg-orange-900/20 text-orange-900 dark:text-orange-400 border-r-2 border-slate-400 dark:border-slate-600">TOTAL PROFIT</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono">{formatMoney(financials.profitAmount)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono text-red-600 dark:text-red-400">{formatMoney(financials.profitAmountAdditional)}</td>
                          <td className="py-2.5 px-4 text-center font-mono bg-orange-50 dark:bg-orange-900/10 font-black">{formatMoney(financials.profitOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400 dark:border-slate-600">
                          <td className="py-2.5 px-4 bg-blue-100/80 dark:bg-blue-900/20 text-blue-900 dark:text-blue-400 border-r-2 border-slate-400 dark:border-slate-600">TOTAL COST LIMIT (DLM)</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono">{formatMoney(financials.budgetCostLimit)}</td>
                          <td className="py-2.5 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono text-red-600 dark:text-red-400">{formatMoney(financials.budgetCostLimitAdditional)}</td>
                          <td className="py-2.5 px-4 text-center font-mono bg-blue-50/50 dark:bg-blue-900/10 font-black">{formatMoney(financials.limitOverall)}</td>
                        </tr>
                        <tr className="border-b-2 border-slate-400 dark:border-slate-600">
                          <td className="py-3 px-4 border-r-2 border-slate-400 dark:border-slate-600">TOTAL PROGRESS COSTING</td>
                          <td className="py-3 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono">{formatMoney(financials.totalNormalExpenses)}</td>
                          <td className="py-3 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono text-slate-400 dark:text-slate-500">0.00</td>
                          <td className="py-3 px-4 text-center font-mono font-black">{formatMoney(financials.progressOverall)}</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-slate-600 dark:text-slate-300">TOTAL EXCESS BUDGET</td>
                          <td className={`py-3 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono ${financials.excessBudget < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {formatMoney(financials.excessBudget)}
                          </td>
                          <td className="py-3 px-4 border-r-2 border-slate-400 dark:border-slate-600 text-center font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(financials.excessBudgetAdditional)}</td>
                          <td className={`py-3 px-4 text-center font-mono text-sm font-black ${financials.excessOverall < 0 ? 'bg-rose-200 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300' : 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white'}`}>
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

        {canEdit && (
          <div className="flex justify-end mt-2 animate-in fade-in items-center gap-4">
            <button onClick={handleSaveClick} disabled={isSaving || !isProjectDirty} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black shadow-xl shadow-blue-200/50 dark:shadow-none transition-all flex items-center gap-3 disabled:opacity-50">
              <Save size={20} /> {isSaving ? 'SAVING DATA...' : 'SAVE CHANGES'}
            </button>
          </div>
        )}

        {/* ==============================================
            PROJECT LEDGER (STATIC ROWS WITH FILTERED DISPLAY)
        ============================================== */}
        <section className="bg-[#f8fafc] dark:bg-slate-900 flex flex-col min-h-[500px] mt-8 relative transition-colors duration-300">
          <div className="flex flex-col mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 pl-1 h-10 flex-wrap">
                {filteredDisplayedCategories.length > 0 && (
                  <>
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Color Guide:</span>
                    <div className="flex flex-row gap-2.5 items-center flex-wrap">
                      {filteredDisplayedCategories.map((category) => {
                        const color = categoryColorMap[category];
                        return (
                          <div key={category} onClick={() => handleScrollToCategory(category)} className={`group h-7 min-w-[1.75rem] rounded-md border border-black/10 shadow-sm cursor-pointer flex items-center justify-center transition-all duration-700 ease-in-out ${color} hover:px-4`}>
                            <span className={`text-xs font-bold text-white whitespace-nowrap overflow-hidden transition-all duration-700 ease-in-out max-w-0 opacity-0 group-hover:max-w-[250px] group-hover:opacity-100`}>{category}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative" ref={categoryFilterRef}>
                  <button onClick={() => { setTempSelectedCategories(selectedCategories); setIsCategoryFilterOpen(!isCategoryFilterOpen); }} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                    <Filter size={16} className={selectedCategories.includes('All') ? 'text-slate-400' : 'text-blue-600'} />
                    <span>{selectedCategories.includes('All') ? 'All Categories' : `${selectedCategories.length} Selected`}</span>
                  </button>
                  {isCategoryFilterOpen && (
                    <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 flex justify-between items-center">
                        <span className="font-black text-slate-700 dark:text-slate-300 text-sm uppercase">Filter Tables</span>
                        <button onClick={() => setIsCategoryFilterOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={18} /></button>
                      </div>
                      <div className="p-3 max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                        <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer group">
                          <input type="checkbox" checked={tempSelectedCategories.includes('All')} onChange={() => handleToggleCategory('All')} className="rounded-lg text-blue-600 w-5 h-5 cursor-pointer bg-white" />
                          <span className={`text-sm ${tempSelectedCategories.includes('All') ? 'font-black text-slate-800 dark:text-white' : 'text-slate-500 font-bold'}`}>Show All Categories</span>
                        </label>
                        {displayedCategories.map(cat => (
                          <label key={cat} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer group">
                            <input type="checkbox" checked={tempSelectedCategories.includes(cat)} onChange={() => handleToggleCategory(cat)} className="rounded-lg text-blue-600 w-5 h-5 cursor-pointer bg-white" />
                            <span className={`text-sm ${tempSelectedCategories.includes(cat) ? 'font-black text-slate-800 dark:text-white' : 'text-slate-500 font-bold'}`}>{cat}</span>
                          </label>
                        ))}
                      </div>
                      <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50">
                        <button onClick={applyCategoryFilter} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black shadow-lg">Apply Filter</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-2 py-1 shadow-sm gap-1">
                  <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30" disabled={zoomLevel <= 0.6}><ZoomOut size={16} /></button>
                  <div className="text-[10px] font-black text-slate-500 w-10 text-center select-none">{Math.round(zoomLevel * 100)}%</div>
                  <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30" disabled={zoomLevel >= 1.5}><ZoomIn size={16} /></button>
                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                  <button onClick={resetZoom} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-600"><RotateCcw size={14} /></button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">Project Ledger<span className="ml-2 px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-300 text-xs font-bold border border-slate-300">{financials.projectExpenses.length} Entries</span></h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1 tracking-widest uppercase">Construction Cost Breakdown by Category</p>
              </div>
              <button className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm">Export to Excel</button>
            </div>
          </div>

          <div className="overflow-x-auto pb-8 custom-scrollbar">
            <div className="bg-slate-800 dark:bg-slate-900 text-center py-4 rounded-t-xl font-black text-white uppercase tracking-[0.2em] text-sm shadow-md min-w-[1400px] border-2 border-b-0 border-slate-800 dark:border-slate-700">CONSTRUCTION COST BREAKDOWN</div>
            {filteredDisplayedCategories.length === 0 ? (
              <div className="border-2 border-t-0 border-slate-800 dark:border-slate-700 rounded-b-xl bg-white dark:bg-slate-800 min-w-[1400px] p-20 flex flex-col items-center opacity-50 text-slate-500 shadow-sm"><Calendar size={48} className="mb-4" strokeWidth={1.5} /><p className="text-xl font-bold">Walang Resulta</p><p className="text-sm font-medium mt-1">Wala sa listahan ang napiling kategorya o walang nai-encode na data para dito.</p></div>
            ) : (
              <div className="flex flex-col gap-8 min-w-[1400px] bg-white dark:bg-slate-800 border-2 border-t-0 border-slate-800 dark:border-slate-700 rounded-b-xl p-6 shadow-sm relative">
                {filteredDisplayedCategories.map((category) => {
                  const items = expensesByCategory[category] || [];
                  const headerColor = categoryColorMap[category];
                  const isPulsing = pulsingCategory === category;
                  return (
                    <div key={category} id={`category-${category}`} className={`border-2 border-slate-800 dark:border-slate-600 rounded-xl overflow-hidden scroll-mt-24 transition-all duration-500 ease-out ${isPulsing ? 'scale-[1.02] shadow-[0_15px_40px_rgba(0,0,0,0.25)] ring-4 ring-slate-400 z-10 relative -translate-y-2' : 'shadow-sm'}`}>
                      <table className="w-full text-left border-collapse text-xs" style={{ zoom: zoomLevel }}>
                        <thead>
                          <tr className={`${headerColor} border-b-2 border-slate-800 dark:border-slate-600`}><th colSpan={canEdit ? 14 : 13} className="text-center py-3.5 font-black text-white uppercase tracking-[0.15em] text-sm">{category}</th></tr>
                          <tr className="bg-slate-200 dark:bg-slate-700 border-b-2 border-slate-800 dark:border-slate-600 text-[10px] font-black text-slate-800 dark:text-slate-200 text-center uppercase tracking-wider leading-tight">
                            <th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">Date</th><th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">C.V.#</th><th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">Invoice</th><th className="py-3 px-2 w-[15%] text-left border-r border-slate-800 dark:border-slate-600">Supplier / Particulars</th><th className="py-3 px-2 w-[15%] text-left border-r border-slate-800 dark:border-slate-600">Item Description</th><th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">Labor Less</th><th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">Labor Ewt</th><th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">Labor Total</th><th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">Mat'l QTY</th><th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">Mat'l Unit Cost</th><th className="py-3 px-2 w-[6%] border-r border-slate-800 dark:border-slate-600">Mat'l Total</th><th className="py-3 px-2 w-[8%] border-r border-slate-800 dark:border-slate-600">Total Mat'l Cost</th><th className="py-3 px-2 w-[8%] border-r border-slate-800 dark:border-slate-600 text-right pr-4">Total Labor Cost</th>{canEdit && <th className="py-3 px-2 w-[4%]">Act</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 dark:divide-slate-600 bg-white dark:bg-slate-800">
                          {items.map((item, i) => (
                            <tr key={`${item.id}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-[11px]">
                              <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-800">{item.date}</td>
                              <td className="p-3 text-center border-r border-slate-800"><span className="px-1.5 py-1 bg-white text-slate-800 rounded font-mono font-bold text-[10px] border border-slate-300">{item.cv_no || 'N/A'}</span></td>
                              <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300 border-r border-slate-800">{item.or_inv_no || '-'}</td>
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200 text-left border-r border-slate-800 truncate max-w-[150px]" title={item.payee}>{item.payee}</td>
                              <td className="p-3 font-medium text-slate-600 dark:text-slate-400 text-left border-r border-slate-800 truncate max-w-[150px]" title={item.particulars}>{item.particulars}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 dark:text-slate-400 border-r border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">{formatMoney(item.laborLess)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 dark:text-slate-400 border-r border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">{formatMoney(item.laborEwt)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 dark:text-slate-400 border-r border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">{formatMoney(item.laborTotal)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlQty)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlUnitCost)}</td>
                              <td className="p-3 text-center font-mono font-medium text-slate-600 border-r border-slate-800">{formatMoney(item.matlTotal)}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-800 bg-slate-100/50">{formatMoney(item.totalMatlCost)}</td>
                              <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 dark:text-white border-r border-slate-800 bg-slate-100/50">{formatMoney(item.totalLaborCost)}</td>
                              {canEdit && (
                                <td className="p-2 text-center bg-white dark:bg-slate-800">
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id); }} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 rounded-lg"><Trash2 size={14} /></button>
                                </td>
                              )}
                            </tr>
                          ))}
                          <tr className="bg-slate-100 dark:bg-slate-700/80 border-t-2 border-slate-800 dark:border-slate-600">
                            <td colSpan="11" className="p-3 text-right font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-200 border-r border-slate-800">TOTAL FOR {category}:</td>
                            <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-200 text-sm border-r border-slate-800 bg-slate-200/50">₱ {items.reduce((sum, i) => sum + i.totalMatlCost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-800 dark:text-slate-200 text-sm border-r border-slate-800 bg-slate-200/50">₱ {items.reduce((sum, i) => sum + i.totalLaborCost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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

      {showScrollTop && (
        <button onClick={scrollToTop} className="absolute bottom-8 right-8 w-12 h-12 bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center hover:-translate-y-1 transition-all duration-300 z-50"><ArrowUp size={24} strokeWidth={2.5} /></button>
      )}

      {/* FIXED Z-INDEX FOR PASSWORD MODAL */}
      <div style={{ position: 'relative', zIndex: 9999 }}>
        <PasswordConfirmModal
          isOpen={passwordModal.isOpen}
          actionType="delete"
          onClose={() => setPasswordModal({ isOpen: false, action: null, payload: null })}
          onConfirm={handlePasswordConfirm}
        />
      </div>

      {/* SUCCESS TOAST FOR PROJECT SAVE */}
      {showSaveSuccess && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 shadow-lg">
          <CheckCircle2 size={18} />
          Successfully saved changes.
        </div>
      )}

      {/* PROJECT UNSAVED CHANGES MODAL (KAPAG LUMIPAT NG PROJECT SA DROPDOWN) */}
      {showProjectUnsavedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-center">
            <div className="p-4 rounded-full mb-4 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mx-auto w-fit">
              <AlertCircle size={32} strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">Unsaved Project Changes</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">
              May mga binago ka sa project details na hindi pa nase-save. Gusto mo bang i-save bago lumipat ng project?
            </p>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  await executeSaveProject(editingValues);
                  setShowProjectUnsavedModal(false);
                  setSelectedProjectId(pendingProjectId);
                  setPendingProjectId(null);
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Save size={18} /> Save Changes & Switch
              </button>
              <button
                onClick={() => {
                  setShowProjectUnsavedModal(false);
                  setSelectedProjectId(pendingProjectId);
                  setPendingProjectId(null);
                }}
                className="w-full py-3.5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Discard & Switch
              </button>
              <button
                onClick={() => {
                  setShowProjectUnsavedModal(false);
                  setPendingProjectId(null);
                }}
                className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {redirectionModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col items-center text-center">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full text-amber-600 mb-5"><Receipt size={32} strokeWidth={2.5} /></div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Redirect to Disbursement</h3>
              <p className="text-slate-500 font-medium mb-6">Para i-update o idelete ang item na ito, kailangan nating lumipat sa <span className="font-bold underline">Disbursement Ledger</span>. Awtomatikong bubukas ang voucher <span className="font-mono font-bold text-blue-600">#{redirectionModal.cvNo}</span> para sa iyo.</p>
              <div className="flex w-full gap-3">
                <button onClick={() => setRedirectionModal({ isOpen: false, disbursementId: null, cvNo: '' })} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl">Cancel</button>
                <button onClick={handleConfirmRedirection} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-2">Confirm & Go <ArrowUp className="rotate-90" size={18} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isSaving || isSwitching) && (
        <LoadingOverlay message={isSwitching ? "Switching Project" : "Saving Changes"} subtext={isSwitching ? "Inihahanda ang data..." : "Paki-antay lamang..."} />
      )}

      {/* ADDITIONAL WORKS LEDGER MODAL (FLAT LIST WITH REMOVED EXTRA COLUMNS) */}
      <AdditionalsLedgerModal
        isOpen={isAdditionalsModalOpen}
        onClose={() => setIsAdditionalsModalOpen(false)}
        data={flatAdditionalExpenses}
        canEdit={canEdit}
        onDeleteClick={handleDeleteClick}
        onEditClick={handleEditAdditionalClick}
        zoomLevel={zoomLevel}
      />

      {/* ADD / EDIT ADDITIONAL COST MODAL WITH UNSAVED & DRAFT FUNCTIONALITY */}
      <AddAdditionalModal
        isOpen={isAddAdditionalModalOpen}
        onClose={() => setIsAddAdditionalModalOpen(false)}
        project={project}
        disbursements={disbursements}
        refreshData={refreshData}
        editingAdditionalId={editingAdditionalId}
      />
    </div>
  );
}

// ==============================================
// 1. MODAL COMPONENT para sa Additional Works Ledger 
// ==============================================
function AdditionalsLedgerModal({ isOpen, onClose, data, canEdit, onDeleteClick, onEditClick, zoomLevel }) {
  if (!isOpen) return null;

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const formatMoney = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    if (isNaN(val)) return '0.00';
    if (val === 0) return '-';
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 z-[40] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-[98vw] max-w-[1400px] h-[90vh] rounded-2xl shadow-2xl flex flex-col p-6 border-4 border-red-200 dark:border-red-900 transition-colors duration-300">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-black text-red-800 dark:text-red-400 tracking-tight flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-600 dark:text-red-400">
              <FileSpreadsheet size={22} />
            </div>
            Additional Works & Costs Ledger
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 dark:text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar mt-4 pb-4">
          <div className="flex flex-col gap-8 min-w-[900px]">
            {data.length === 0 ? (
              <div className="text-center py-20 text-slate-400 dark:text-slate-500">
                <p>No additional costs recorded.</p>
              </div>
            ) : (
              <div className="border-2 border-slate-800 dark:border-slate-600 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs" style={{ zoom: zoomLevel }}>
                  <thead>
                    <tr className="bg-slate-200 dark:bg-slate-800 border-b-2 border-slate-800 dark:border-slate-600 text-[10px] font-black text-slate-800 dark:text-slate-300 text-center uppercase tracking-wider leading-tight">
                      <th className="py-3 px-4 w-[10%] border-r border-slate-800 dark:border-slate-600">Date</th>
                      <th className="py-3 px-4 w-[10%] border-r border-slate-800 dark:border-slate-600">Invoice</th>
                      <th className="py-3 px-4 w-[25%] text-left border-r border-slate-800 dark:border-slate-600">Supplier / Particulars</th>
                      <th className="py-3 px-4 w-[25%] text-left border-r border-slate-800 dark:border-slate-600">Item Name</th>
                      <th className="py-3 px-4 w-[15%] text-right pr-6 border-r border-slate-800 dark:border-slate-600">Total Cost</th>
                      {canEdit && <th className="py-3 px-4 w-[10%]">Act</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 dark:divide-slate-700 bg-white dark:bg-slate-900">
                    {data.map((item, i) => (
                      <tr
                        key={`${item.id}-${i}`}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-[11px] ${canEdit ? 'cursor-pointer group' : ''}`}
                        onDoubleClick={() => canEdit && onEditClick(item.id)}
                      >
                        <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-800 dark:border-slate-700">{item.date}</td>
                        <td className="p-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300 border-r border-slate-800 dark:border-slate-700">{item.or_inv_no || '-'}</td>

                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 text-left border-r border-slate-800 dark:border-slate-700" title={`${item.payee} - ${item.particulars}`}>
                          <div className="flex flex-col gap-0.5">
                            <span className="truncate max-w-[250px]">{item.payee}</span>
                            {item.particulars && <span className="text-[9px] text-slate-500 font-medium truncate max-w-[250px]">{item.particulars}</span>}
                          </div>
                        </td>

                        <td className="p-4 font-black text-red-700 dark:text-red-400 text-left border-r border-slate-800 dark:border-slate-700 truncate max-w-[250px]" title={item.itemName}>{item.itemName}</td>

                        <td className="p-4 text-right pr-6 font-mono font-black text-slate-900 dark:text-white border-r border-slate-800 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/80 text-sm">
                          {formatMoney(item.amount)}
                        </td>

                        {canEdit && (
                          <td className="p-2 text-center bg-white dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditClick(item.id); }}
                                className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 rounded-lg transition-colors"
                                title="Edit Entry"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeleteClick(item.id); }}
                                className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 rounded-lg transition-colors"
                                title="Delete Entry"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}

                    <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-800 dark:border-slate-600">
                      <td colSpan="4" className="p-4 text-right font-black text-[12px] uppercase tracking-widest text-slate-800 dark:text-slate-300 border-r border-slate-800 dark:border-slate-600">
                        OVERALL TOTAL ADDITIONALS:
                      </td>
                      <td className="p-4 text-right pr-6 font-mono font-black text-red-700 dark:text-red-400 text-lg border-r border-slate-800 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-700/50">
                        ₱ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      {canEdit && <td></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end items-center mt-2 shrink-0">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold uppercase text-slate-500 dark:text-slate-400">Grand Total Additionals:</span>
            <span className="text-3xl font-black text-red-700 dark:text-red-400 font-mono">
              ₱ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================
// 2. MODAL COMPONENT para mag-Add/Edit ng Additional Works
// ==============================================
function AddAdditionalModal({ isOpen, onClose, project, disbursements, refreshData, editingAdditionalId }) {
  const [headerData, setHeaderData] = useState({
    date: new Date().toISOString().split('T')[0],
    project_code: project?.project_code || '',
    payee: '', particulars: '', tin: '', check_no: '', or_inv_no: '',
    accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'additional'
  });

  const [lines, setLines] = useState([{ id: Date.now(), category: '', amount: '' }]);
  const [showTaxFields, setShowTaxFields] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successPrompt, setSuccessPrompt] = useState(false);

  // DEDICATED MODALS FOR DRAFTS, UNSAVED, AND PASSWORD
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, payload: null });
  const [initialFormState, setInitialFormState] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const editingData = useMemo(() => disbursements.find(d => d.id === editingAdditionalId), [disbursements, editingAdditionalId]);

  const historicalSuggestions = useMemo(() => {
    const suggestions = new Set();
    disbursements.forEach(d => {
      if (d.costing_type === 'additional' && d.expenses) {
        d.expenses.forEach(exp => {
          if (exp.category && exp.category.trim() !== '') {
            suggestions.add(exp.category.trim());
          }
        });
      }
    });
    return Array.from(suggestions).sort();
  }, [disbursements]);

  useEffect(() => {
    if (isOpen) {
      if (editingData) {
        const newHeader = {
          date: editingData.date || new Date().toISOString().split('T')[0],
          project_code: editingData.project_code || project?.project_code || '',
          payee: editingData.payee || '',
          particulars: editingData.particulars || '',
          tin: editingData.tin || '',
          check_no: editingData.check_no || '',
          or_inv_no: editingData.or_inv_no || '',
          accts_pay: editingData.accts_pay || '',
          input_tax: editingData.input_tax || '',
          output_tax: editingData.output_tax || '',
          target_cib: (editingData.target_cib || '').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
          costing_type: 'additional'
        };
        const newLines = editingData.expenses?.length > 0 ? editingData.expenses.map(line => ({ ...line, amount: line.amount ? String(line.amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '' })) : [{ id: Date.now(), category: '', amount: '' }];

        setHeaderData(newHeader);
        setLines(newLines);
        setShowTaxFields(!!(editingData.accts_pay || editingData.input_tax || editingData.output_tax));

        setInitialFormState({
          headerData: JSON.stringify(newHeader),
          lines: JSON.stringify(newLines)
        });
      } else {
        const hasDraft = localStorage.getItem('additional_cost_draft');
        if (hasDraft) {
          setShowDraftModal(true);
        } else {
          const newHeader = {
            date: new Date().toISOString().split('T')[0],
            project_code: project?.project_code || '',
            payee: '', particulars: '', tin: '', check_no: '', or_inv_no: '',
            accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'additional'
          };
          const newLines = [{ id: Date.now(), category: '', amount: '' }];
          setHeaderData(newHeader);
          setLines(newLines);
          setShowTaxFields(false);
          setInitialFormState({ headerData: JSON.stringify(newHeader), lines: JSON.stringify(newLines) });
        }
      }
      setSuccessPrompt(false);
      setErrorMessage('');
    }
  }, [isOpen, editingData, project]);

  const checkUnsavedChanges = () => {
    if (!initialFormState) return false;
    return JSON.stringify(headerData) !== initialFormState.headerData ||
      JSON.stringify(lines) !== initialFormState.lines;
  };

  const handleCloseRequest = () => {
    if (checkUnsavedChanges() && !successPrompt) {
      setShowUnsavedModal(true);
    } else {
      handleClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !passwordModal.isOpen && !showUnsavedModal && !showDraftModal && !successPrompt) {
        handleCloseRequest();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, passwordModal.isOpen, showUnsavedModal, showDraftModal, successPrompt, headerData, lines, initialFormState]);

  const handleSaveDraft = () => {
    localStorage.setItem('additional_cost_draft', JSON.stringify({
      headerData, lines, editingAdditionalId
    }));
    setShowUnsavedModal(false);
    handleClose();
  };

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false);
    handleClose();
  };

  const handleRestoreDraft = () => {
    const draftStr = localStorage.getItem('additional_cost_draft');
    if (draftStr) {
      const draft = JSON.parse(draftStr);
      setHeaderData(draft.headerData);
      setLines(draft.lines || []);
      setShowTaxFields(!!(draft.headerData.accts_pay || draft.headerData.input_tax || draft.headerData.output_tax));
      setInitialFormState({
        headerData: JSON.stringify(draft.headerData),
        lines: JSON.stringify(draft.lines || [])
      });
      setShowDraftModal(false);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('additional_cost_draft');
    setShowDraftModal(false);
    const newHeader = {
      date: new Date().toISOString().split('T')[0],
      project_code: project?.project_code || '',
      payee: '', particulars: '', tin: '', check_no: '', or_inv_no: '',
      accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'additional'
    };
    const newLines = [{ id: Date.now(), category: '', amount: '' }];
    setHeaderData(newHeader);
    setLines(newLines);
    setShowTaxFields(false);
    setInitialFormState({ headerData: JSON.stringify(newHeader), lines: JSON.stringify(newLines) });
  };

  const handleClose = () => {
    setSuccessPrompt(false);
    setErrorMessage('');
    onClose();
  };

  const handleHeaderChange = (e) => setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  const handleLineChange = (id, field, value) => {
    let finalValue = value;
    if (field === 'amount') {
      let val = value.replace(/[^0-9.]/g, '');
      const parts = val.split('.');
      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
      if (val) {
        const p2 = val.split('.');
        p2[0] = p2[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        val = p2.join('.');
      }
      finalValue = val;
    }
    setLines(prev => prev.map(line => line.id === id ? { ...line, [field]: finalValue } : line));
  };
  const addLine = () => setLines(prev => [...prev, { id: Date.now() + Math.random(), category: '', amount: '' }]);
  const removeLine = (id) => { if (lines.length > 1) setLines(prev => prev.filter(line => line.id !== id)); };

  const totals = useMemo(() => {
    let totalDebit = 0; let ewtPayable = 0;
    lines.forEach(line => {
      const amt = parseFloat(String(line.amount).replace(/,/g, '')) || 0;
      totalDebit += amt;
      const cat = line.category ? line.category.toUpperCase().replace(/\s+/g, '') : '';
      if (cat === 'LABOR/SUBCONTRACTOR' || cat === 'LABOR/PAYROLL') {
        ewtPayable += (amt / 0.98) - amt;
      }
    });
    return { totalDebit, ewtPayable, cib_coh: totalDebit + ewtPayable };
  }, [lines]);

  const targetCib = parseFloat(String(headerData.target_cib).replace(/,/g, '')) || 0;
  const isVarianceZero = Math.abs(targetCib - totals.cib_coh) < 0.01;

  const executeSave = async (dataToSave) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('fbtmcc_token');
      const url = editingData ? `${API_URL}/disbursements/${editingData.id}` : `${API_URL}/disbursements`;
      const method = editingData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(dataToSave)
      });

      if (response.ok) {
        if (refreshData) await refreshData();
        setSuccessPrompt(true);
      } else {
        const errData = await response.json();
        setErrorMessage(errData.error || "Hindi ma-save ang data.");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Network Error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const validLines = lines.map(line => ({ ...line, amount: line.amount ? String(line.amount).replace(/,/g, '') : '' }));

    const isEditing = !!editingData;
    const newDisbursement = {
      id: isEditing ? editingData.id : Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(),
      ...headerData,
      target_cib: String(headerData.target_cib).replace(/,/g, ''),
      cv_no: isEditing ? (editingData.cv_no || '') : '',
      expenses: validLines,
      gross_amount: totals.cib_coh,
      ewt_amount: totals.ewtPayable,
      net_amount: totals.totalDebit,
      created_at: isEditing ? editingData.created_at : new Date().toISOString()
    };

    executeSave(newDisbursement);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[45] flex justify-center items-start pt-6 pb-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm px-4 overflow-hidden transition-colors duration-300">

      {/* FLOATING PASSWORD MODAL PARA SA EDIT/UPDATE NG ADDITIONAL */}
      <div style={{ position: 'relative', zIndex: 9999 }}>
        <PasswordConfirmModal
          isOpen={passwordModal.isOpen}
          actionType="update"
          onClose={() => setPasswordModal({ isOpen: false, payload: null })}
          onConfirm={() => {
            const payload = passwordModal.payload;
            setPasswordModal({ isOpen: false, payload: null });
            executeSave(payload);
          }}
        />
      </div>

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        onSaveDraft={handleSaveDraft}
        onDiscard={handleDiscardChanges}
      />

      <DraftFoundModal
        isOpen={showDraftModal}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
      />

      {successPrompt ? (
        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{editingAdditionalId ? 'Cost Updated!' : 'Cost Saved!'}</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
            The additional cost has been {editingAdditionalId ? 'updated in' : 'added to'} the ledger successfully.
          </p>
          <button onClick={handleClose} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-lg">
            Done
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-full border-2 border-red-300 dark:border-red-900">

          <div className="bg-white dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                {editingAdditionalId ? <Edit2 size={20} /> : <Plus size={20} />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                  {editingAdditionalId ? 'Edit Additional Costing' : 'Add Additional Costing'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs">Direct entry for additional works & costs.</p>
              </div>
            </div>
            <button onClick={handleCloseRequest} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 dark:text-slate-500 hover:text-red-500 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm font-medium animate-in fade-in">
                  {errorMessage}
                </div>
              )}

              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                  1. Entry Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Payee</label>
                    <input type="text" name="payee" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      value={headerData.payee} onChange={handleHeaderChange} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Project Code (Locked)</label>
                    <input type="text" className="w-full p-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-500 dark:text-slate-400 font-bold"
                      value={headerData.project_code} disabled />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Date</label>
                    <input type="date" name="date" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      value={headerData.date} onChange={handleHeaderChange} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">OR / INV #</label>
                    <input type="text" name="or_inv_no" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      value={headerData.or_inv_no} onChange={handleHeaderChange} />
                  </div>

                  <div className="space-y-1 md:col-span-3">
                    <label className="text-xs font-semibold text-slate-500">Particulars (Description)</label>
                    <input type="text" name="particulars" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      value={headerData.particulars} onChange={handleHeaderChange} />
                  </div>

                  <div className="space-y-1 bg-red-50 dark:bg-red-900/20 p-2 -mt-2 -mb-2 rounded-md border border-red-200 dark:border-red-800 flex flex-col justify-center">
                    <label className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">Target CIB/COH (₱)</label>
                    <input type="text" name="target_cib" className="w-full p-1.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded-md text-sm font-black text-red-900 dark:text-red-100 outline-none focus:ring-2 focus:ring-red-500"
                      value={headerData.target_cib} onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                        if (val) {
                          const p2 = val.split('.');
                          p2[0] = p2[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                          val = p2.join('.');
                        }
                        handleHeaderChange({ target: { name: 'target_cib', value: val } });
                      }} />
                  </div>

                  <div className="space-y-1 md:col-span-4 flex items-end">
                    <button type="button" onClick={() => setShowTaxFields(!showTaxFields)} className="text-slate-500 dark:text-slate-400 text-xs font-medium hover:underline flex items-center gap-1">
                      {showTaxFields ? 'Hide Tax Fields' : 'Show Tax Fields'} <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                {showTaxFields && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Accts Pay</label>
                      <input type="number" step="0.01" name="accts_pay" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-800 dark:text-white" value={headerData.accts_pay} onChange={handleHeaderChange} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Input Tax</label>
                      <input type="number" step="0.01" name="input_tax" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-800 dark:text-white" value={headerData.input_tax} onChange={handleHeaderChange} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Output Tax</label>
                      <input type="number" step="0.01" name="output_tax" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-800 dark:text-white" value={headerData.output_tax} onChange={handleHeaderChange} />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`lg:col-span-2 space-y-6 ${targetCib <= 0 ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">2. Cost Breakdown</h3>
                      <button type="button" onClick={addLine} className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md font-medium flex items-center gap-1">
                        <Plus size={14} /> Add Line Item
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {lines.map((line, index) => (
                        <div key={line.id} className="flex gap-3 items-start">
                          <div className="w-8 h-9 mt-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">{index + 1}</div>

                          <div className="flex-1 relative mt-1">
                            <input
                              type="text"
                              list="historical-additional-items"
                              placeholder="Type Item Name (e.g. Specialty Works)"
                              className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                              value={line.category}
                              onChange={(e) => handleLineChange(line.id, 'category', e.target.value)}
                            />
                            <datalist id="historical-additional-items">
                              {historicalSuggestions.map(suggestion => (
                                <option key={suggestion} value={suggestion} />
                              ))}
                            </datalist>
                          </div>

                          <div className="w-40 relative mt-1">
                            <span className="absolute left-3 top-2 text-slate-400">₱</span>
                            <input type="text" placeholder="0.00"
                              className="w-full pl-7 p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-right"
                              value={line.amount} onChange={(e) => handleLineChange(line.id, 'amount', e.target.value)} />
                          </div>
                          <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length === 1}
                            className="p-2 mt-1 text-slate-400 hover:text-red-500 rounded-md transition-colors disabled:opacity-30">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 dark:bg-slate-950 text-white p-6 rounded-xl shadow-md flex flex-col justify-between h-fit lg:sticky lg:top-0">
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700">Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span>Total (Net)</span>
                        <span className="font-mono">₱ {totals.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-400 text-sm">
                        <span>Add: EWT</span>
                        <span className="font-mono">+ ₱ {totals.ewtPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Target CIB</div>
                        <div className="text-lg font-bold">₱ {targetCib.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-blue-400 font-semibold uppercase mb-1">Computed CIB</div>
                        <div className="text-2xl font-black text-blue-400 tracking-tight">₱ {totals.cib_coh.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>

                    <div className={`p-3 rounded-lg flex items-center justify-between mb-4 border ${isVarianceZero ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                      <span className="text-xs font-bold uppercase">{isVarianceZero ? '✓ Balance' : '⚠️ Variance'}</span>
                      <span className="font-mono font-bold">{(targetCib - totals.cib_coh) > 0 ? '+' : ''}{(targetCib - totals.cib_coh).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <button type="submit" disabled={!isVarianceZero || targetCib === 0 || isSaving}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      <Save size={18} /> {isSaving ? 'Saving...' : (editingAdditionalId ? 'Update Additional' : 'Post Additional')}
                    </button>
                  </div>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}