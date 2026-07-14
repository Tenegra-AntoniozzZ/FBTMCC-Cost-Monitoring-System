import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, FileText, ChevronDown, Filter, X, Lock, Save, Receipt, Edit2, ZoomIn, ZoomOut, RotateCcw, CheckCircle2, Paperclip, Camera, FileImage, FileType, Loader2, ExternalLink, Download } from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';
import MultiSelectDropdown from './MultiSelectDropdown';
import HealthCard from './HealthCard';
import PasswordConfirmModal from './PasswordConfirmModal';
import LoadingOverlay from './LoadingOverlay';
import UnsavedChangesModal from './UnsavedChangesModal';
import DraftFoundModal from './DraftFoundModal';
import { API_URL } from '../utils/Constants';

const TargetProjectDropdown = ({ value, onChange, disabled, selectedProjects }) => {
  const currentValues = Array.isArray(value) ? value : (value ? [value] : ['all']);

  if (disabled) {
    return (
      <div className="text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70">
        🌐 For All Projects
      </div>
    );
  }

  const options = ['All Projects', ...selectedProjects];
  const mappedValue = currentValues.includes('all') ? ['All Projects'] : currentValues;

  const handleChange = (val) => {
    if (val.includes('All Projects') && !mappedValue.includes('All Projects')) {
      onChange(['all']);
    } else if (val.includes('All Projects') && val.length > 1) {
      const filtered = val.filter(v => v !== 'All Projects');
      onChange(filtered);
    } else {
      onChange(val.length > 0 ? val : ['all']);
    }
  };

  return (
    <div className="w-[280px]">
      <MultiSelectDropdown
        options={options}
        value={mappedValue}
        onChange={handleChange}
        placeholder="Select Project(s)..."
      />
    </div>
  );
};

export default function DisbursementScreen({ projects, categories, categoryObjects, disbursements, refreshData, isLoading, userRole, initialSearchQuery, initialDisbursementId, initialStockAllocation, onClearInitialDisbursement, onModalStateChange }) {
  const canEdit = userRole === 'encoder';

  // ==========================================
  // 1. STATES & REFS
  // ==========================================
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postSavePrompt, setPostSavePrompt] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingUnderlyingRecords, setEditingUnderlyingRecords] = useState([]);
  const [showTaxFields, setShowTaxFields] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lineErrors, setLineErrors] = useState([]);

  const [initialFormState, setInitialFormState] = useState(null);
  const [modalAttachments, setModalAttachments] = useState([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showStockWarning, setShowStockWarning] = useState(false);

  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [isStockAllocationMode, setIsStockAllocationMode] = useState(false);
  const [stockAllocationSource, setStockAllocationSource] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [tempSelectedMonths, setTempSelectedMonths] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [tempSelectedYears, setTempSelectedYears] = useState([]);
  const [selectedTransactionFilter, setSelectedTransactionFilter] = useState('All');
  const [tempSelectedTransactionFilter, setTempSelectedTransactionFilter] = useState('All');
  const filterRef = useRef(null);

  // Zoom
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('disbursement_zoom');
    return saved ? parseFloat(saved) : 1;
  });

  // Voucher Form State
  const [headerData, setHeaderData] = useState({
    date: new Date().toISOString().split('T')[0],
    project_code: '',
    payee: '',
    particulars: '',
    tin: '',
    cv_no: '',
    bank: '',
    check_no: '',
    or_inv_no: '',
    accts_pay: '',
    input_tax: '',
    output_tax: '',
    target_cib: '',
    costing_type: 'normal'
  });

  const makeDefaultGroup = (baseId) => ({
    id: baseId,
    targetProject: ['all'],
    constructionLines: [{ id: baseId + 1, category: '', amount: '' }],
    miscLines: [{ id: baseId + 2, category: '', amount: '' }]
  });

  const [costingGroups, setCostingGroups] = useState([makeDefaultGroup(1)]);
  const [isAddStocksChecked, setIsAddStocksChecked] = useState(false);
  const [stocksAmount, setStocksAmount] = useState('');
  const [stockDescription, setStockDescription] = useState('');

  // ==========================================
  // 2. SEARCH, FILTER & ZOOM LOGIC
  // ==========================================
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const next = Math.min(prev + 0.1, 1.5);
      localStorage.setItem('disbursement_zoom', next.toString());
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.1, 0.5);
      localStorage.setItem('disbursement_zoom', next.toString());
      return next;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    localStorage.setItem('disbursement_zoom', '1');
  };

  const availableYears = useMemo(() => {
    const years = (disbursements || []).map(d => d.date && d.date.substring(0, 4)).filter(Boolean);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [disbursements]);

  const monthOptions = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const filteredDisbursements = useMemo(() => {
    let result = (disbursements || []).filter(d => {
      if (d.costing_type === 'additional') return false;
      // Filter out Pure Stock entries (purchases placed into inventory without a project)
      const isPureStock = !d.project_code && parseFloat(d.stocks_amount || 0) > 0;
      if (isPureStock) return false;
      return true;
    });

    if (selectedMonths.length > 0 || selectedYears.length > 0) {
      result = result.filter(d => {
        if (!d.date) return false;
        const year = d.date.substring(0, 4);
        const month = d.date.substring(5, 7);
        const yearMatches = selectedYears.length === 0 || selectedYears.includes(year);
        const monthMatches = selectedMonths.length === 0 || selectedMonths.includes(month);
        return yearMatches && monthMatches;
      });
    }

    if (selectedTransactionFilter === 'EWT') {
      result = result.filter(d => parseFloat(d.ewt_amount) > 0).map(d => {
        let laborNet = 0;
        let laborEwt = 0;
        let laborGross = 0;

        if (d.expenses) {
          d.expenses.forEach(exp => {
            if (exp.category && exp.category.toUpperCase().includes('LABOR')) {
              const amt = parseFloat(exp.amount) || 0;
              laborNet += amt;
              laborEwt += (amt / 0.98) - amt;
              laborGross += (amt / 0.98);
            }
          });
        }

        return {
          ...d,
          net_amount: laborNet,
          ewt_amount: laborEwt,
          gross_amount: laborGross,
          target_cib: laborGross,
          accts_pay: 0,
          input_tax: 0,
          output_tax: 0,
          stocks_amount: 0,
          expenses: d.expenses ? d.expenses.filter(exp => exp.category && exp.category.toUpperCase().includes('LABOR')) : []
        };
      });
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(d =>
        (d.cv_no && d.cv_no.toLowerCase().includes(query)) ||
        (d.or_inv_no && d.or_inv_no.toLowerCase().includes(query))
      );
    }

    result.sort((a, b) => {
      const codeA = (a.project_code || '').toUpperCase();
      const codeB = (b.project_code || '').toUpperCase();

      if (!codeA && !codeB) return 0;
      if (!codeA) return 1;
      if (!codeB) return -1;

      const matchA = codeA.match(/^([A-Z]+)-?(\d+)?/);
      const matchB = codeB.match(/^([A-Z]+)-?(\d+)?/);

      const prefixA = matchA ? matchA[1] : codeA;
      const prefixB = matchB ? matchB[1] : codeB;

      if (prefixA !== prefixB) {
        return prefixB.localeCompare(prefixA);
      }
      const numA = matchA && matchA[2] ? parseInt(matchA[2], 10) : 0;
      const numB = matchB && matchB[2] ? parseInt(matchB[2], 10) : 0;

      return numA - numB;
    });

    return result;
  }, [disbursements, selectedMonths, selectedYears, selectedTransactionFilter, searchQuery]);

  const groupedDisbursements = useMemo(() => {
    const groups = {};

    const getKey = (d) => {
      if (d.cv_no && d.cv_no.trim() !== '') return `cv_${d.cv_no.toLowerCase().trim()}`;
      if (d.or_inv_no && d.or_inv_no.trim() !== '') return `or_${d.or_inv_no.toLowerCase().trim()}`;
      return `solo_${d.id}`;
    };

    filteredDisbursements.forEach(d => {
      const key = getKey(d);
      if (!groups[key]) {
        groups[key] = {
          ...d,
          project_code: [d.project_code],
          underlying_records: [d],
          gross_amount: parseFloat(d.gross_amount) || 0,
          net_amount: parseFloat(d.net_amount) || 0,
          ewt_amount: parseFloat(d.ewt_amount) || 0,
          accts_pay: parseFloat(d.accts_pay) || 0,
          target_cib: parseFloat(d.target_cib) || 0,
          input_tax: parseFloat(d.input_tax) || 0,
          output_tax: parseFloat(d.output_tax) || 0,
          stocks_amount: parseFloat(d.stocks_amount) || 0,
          stock_description: d.stock_description || '',
          expenses: d.expenses ? d.expenses.map(e => ({ ...e, amount: parseFloat(e.amount) || 0 })) : []
        };
      } else {
        const group = groups[key];
        group.underlying_records.push(d);
        if (d.project_code && !group.project_code.includes(d.project_code)) {
          group.project_code.push(d.project_code);
        }
        group.gross_amount += parseFloat(d.gross_amount) || 0;
        group.net_amount += parseFloat(d.net_amount) || 0;
        group.ewt_amount += parseFloat(d.ewt_amount) || 0;
        group.accts_pay += parseFloat(d.accts_pay) || 0;
        group.target_cib += parseFloat(d.target_cib) || 0;
        group.input_tax += parseFloat(d.input_tax) || 0;
        group.output_tax += parseFloat(d.output_tax) || 0;
        group.stocks_amount += parseFloat(d.stocks_amount) || 0;

        if (d.expenses) {
          d.expenses.forEach(exp => {
            const existingExp = group.expenses.find(e => e.category === exp.category);
            if (existingExp) {
              existingExp.amount = (parseFloat(existingExp.amount) || 0) + (parseFloat(exp.amount) || 0);
            } else {
              group.expenses.push({ ...exp, amount: parseFloat(exp.amount) || 0 });
            }
          });
        }
      }
    });

    const result = [];
    const seen = new Set();
    filteredDisbursements.forEach(d => {
      const key = getKey(d);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(groups[key]);
      }
    });
    return result;
  }, [filteredDisbursements]);


  const handleToggleMonth = (val) => {
    setTempSelectedMonths(prev => prev.includes(val) ? prev.filter(m => m !== val) : [...prev, val]);
  };

  const handleToggleYear = (val) => {
    setTempSelectedYears(prev => prev.includes(val) ? prev.filter(y => y !== val) : [...prev, val]);
  };

  const applyFilter = () => {
    setSelectedMonths(tempSelectedMonths);
    setSelectedYears(tempSelectedYears);
    setSelectedTransactionFilter(tempSelectedTransactionFilter);
    setIsFilterOpen(false);
  };

  const clearFilter = () => {
    setSelectedMonths([]);
    setSelectedYears([]);
    setTempSelectedMonths([]);
    setTempSelectedYears([]);
    setSelectedTransactionFilter('All');
    setTempSelectedTransactionFilter('All');
    setIsFilterOpen(false);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedMonths.length > 0) params.append('months', selectedMonths.join(','));
      if (selectedYears.length > 0) params.append('years', selectedYears.join(','));
      if (selectedTransactionFilter !== 'All') params.append('transactionFilter', selectedTransactionFilter);

      const token = sessionStorage.getItem('fbtmcc_token');
      const response = await fetch(`${API_URL}/disbursements/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        let errMsg = 'Export failed.';
        try { const d = await response.json(); errMsg = d.error || errMsg; } catch (_) { }
        throw new Error(errMsg);
      }

      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `disbursement_ledger_${Date.now()}.xlsx`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const isAcctsPayVisible = useMemo(() => {
    return (filteredDisbursements || []).some(d => {
      const ap = (parseFloat(d.accts_pay) || 0) + ((Array.isArray(d.project_code) ? d.project_code.some(pc => pc?.toLowerCase() === 'credit card') : d.project_code?.toLowerCase() === 'credit card') ? (parseFloat(d.net_amount) || 0) : 0);
      return ap > 0;
    });
  }, [filteredDisbursements]);

  const isEwtVisible = useMemo(() => {
    return (filteredDisbursements || []).some(d => (parseFloat(d.ewt_amount) || 0) > 0);
  }, [filteredDisbursements]);

  const visibleCategories = useMemo(() => {
    return (categories || []).filter(cat => {
      return (filteredDisbursements || []).some(d => {
        const amt = getCategoryAmount(d, cat);
        return amt && amt > 0;
      });
    });
  }, [categories, filteredDisbursements]);

  const totalVisibleColumns = useMemo(() => {
    return 8 + (isAcctsPayVisible ? 1 : 0) + (isEwtVisible ? 1 : 0) + visibleCategories.length + (canEdit ? 1 : 0);
  }, [isAcctsPayVisible, isEwtVisible, visibleCategories, canEdit]);

  const ledgerTotals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    let ewt = 0;
    let cib = 0;
    let accts_pay = 0;

    filteredDisbursements.forEach(d => {
      const inputTax = parseFloat(d.input_tax) || 0;
      const outputTax = parseFloat(d.output_tax) || 0;

      let netAmount = parseFloat(d.net_amount) || 0;
      let acctsPay = parseFloat(d.accts_pay) || 0;

      // Overwrite: If project is Credit Card, move CIB to Accts Pay
      if (Array.isArray(d.project_code) ? d.project_code.some(pc => pc?.toLowerCase() === 'credit card') : d.project_code?.toLowerCase() === 'credit card') {
        acctsPay += netAmount;
        netAmount = 0;
      }

      const currentDr = (parseFloat(d.gross_amount) || 0) + inputTax;
      const currentCr = netAmount + (parseFloat(d.ewt_amount) || 0) + acctsPay + outputTax;

      dr += currentDr;
      cr += currentCr;
      ewt += (parseFloat(d.ewt_amount) || 0);
      cib += netAmount;
      accts_pay += acctsPay;
    });

    return { dr, cr, diff: dr - cr, ewt, cib, accts_pay };
  }, [filteredDisbursements]);

  // ==========================================
  // 3. CATEGORY SPLITTING & COMPUTATIONS
  // ==========================================
  const { mainCategoriesList, miscCategoriesList } = useMemo(() => {
    const main = [];
    const misc = [];
    (categoryObjects || []).forEach(catObj => {
      const rawName = catObj.name;

      if (rawName.startsWith('[MAIN] ')) {
        main.push(rawName.replace('[MAIN] ', ''));
      } else if (rawName.startsWith('[MISC] ')) {
        misc.push(rawName.replace('[MISC] ', ''));
      } else {
        misc.push(rawName);
      }
    });

    return {
      mainCategoriesList: [...new Set(main)].sort((a, b) => a.localeCompare(b)),
      miscCategoriesList: [...new Set(misc)].sort((a, b) => a.localeCompare(b))
    };
  }, [categoryObjects]);

  const totals = useMemo(() => {
    let totalDebit = 0;
    let ewtPayable = 0;

    costingGroups.forEach(group => {
      [...group.constructionLines, ...group.miscLines].forEach(line => {
        const amt = parseFloat(String(line.amount).replace(/,/g, '')) || 0;
        totalDebit += amt;
        const cat = line.category ? line.category.toUpperCase() : '';
        if (cat === 'LABOR /SUBCONTRACTOR' || cat === 'LABOR/PAYROLL') {
          // Assume inputted amount is NET. Calculate the added EWT to reach Gross.
          ewtPayable += (amt / 0.98) - amt;
        }
      });
    });

    const parsedStocksAmount = isAddStocksChecked ? (parseFloat(String(stocksAmount).replace(/,/g, '')) || 0) : 0;
    const cib_coh = totalDebit + ewtPayable + parsedStocksAmount;
    return { totalDebit, ewtPayable, cib_coh, stocksAmountVal: parsedStocksAmount };
  }, [costingGroups, isAddStocksChecked, stocksAmount]);

  const targetCib = parseFloat(String(headerData.target_cib).replace(/,/g, '')) || 0;
  const isVarianceZero = Math.abs(targetCib - totals.cib_coh) < 0.01;

  const isDuplicateCV = useMemo(() => {
    if (!headerData.cv_no) return false;

    // Bypass if in Stock Allocation Mode and value matches the source stock's CV#
    if (isStockAllocationMode && stockAllocationSource &&
      headerData.cv_no.trim().toLowerCase() === String(stockAllocationSource.cv_no || '').trim().toLowerCase()) {
      return false;
    }

    // Bypass validation if in edit mode and the CV hasn't changed from its original value
    if (editingId) {
      const originalRecord = disbursements.find(d => d.id === editingId);
      if (originalRecord && originalRecord.cv_no && originalRecord.cv_no.trim().toLowerCase() === headerData.cv_no.trim().toLowerCase()) {
        return false;
      }
    }

    return disbursements.some(
      (d) => d.id !== editingId && d.cv_no && d.cv_no.trim().toLowerCase() === headerData.cv_no.trim().toLowerCase()
    );
  }, [headerData.cv_no, disbursements, editingId, isStockAllocationMode, stockAllocationSource]);

  const isDuplicateOR = useMemo(() => {
    if (!headerData.or_inv_no) return false;

    // Bypass if in Stock Allocation Mode and value matches the source stock's OR/INV#
    if (isStockAllocationMode && stockAllocationSource &&
      headerData.or_inv_no.trim().toLowerCase() === String(stockAllocationSource.or_inv_no || '').trim().toLowerCase()) {
      return false;
    }

    // Bypass validation if in edit mode and the OR/INV hasn't changed from its original value
    if (editingId) {
      const originalRecord = disbursements.find(d => d.id === editingId);
      if (originalRecord && originalRecord.or_inv_no && originalRecord.or_inv_no.trim().toLowerCase() === headerData.or_inv_no.trim().toLowerCase()) {
        return false;
      }
    }

    return disbursements.some(
      (d) => d.id !== editingId && d.or_inv_no && d.or_inv_no.trim().toLowerCase() === headerData.or_inv_no.trim().toLowerCase()
    );
  }, [headerData.or_inv_no, disbursements, editingId, isStockAllocationMode, stockAllocationSource]);

  // ==========================================
  // 4. HANDLERS
  // ==========================================
  const resetForm = () => {
    setHeaderData({ date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', bank: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'normal' });
    const now = Date.now();
    setCostingGroups([makeDefaultGroup(now)]);
    setShowTaxFields(false);
    setErrorMessage('');
    setLineErrors([]);
    setEditingId(null);
    setEditingUnderlyingRecords([]);
    setIsAddStocksChecked(false);
    setStocksAmount('');
    setStockDescription('');
    setIsStockAllocationMode(false);
    setStockAllocationSource(null);
  };

  const closeAndResetModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const checkUnsavedChanges = () => {
    if (!initialFormState) return false;
    return JSON.stringify(headerData) !== initialFormState.headerData ||
      JSON.stringify(costingGroups) !== initialFormState.costingGroups ||
      isAddStocksChecked !== initialFormState.isAddStocksChecked ||
      stocksAmount !== initialFormState.stocksAmount;
  };

  const handleCloseRequest = () => {
    if (checkUnsavedChanges()) {
      setShowUnsavedModal(true);
    } else {
      closeAndResetModal();
    }
  };

  const handleStayInModal = () => {
    setPostSavePrompt(false);
    resetForm();
    const now = Date.now();
    const initHeader = { date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', bank: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'normal' };
    const initGroups = [makeDefaultGroup(now)];
    setInitialFormState({
      headerData: JSON.stringify(initHeader),
      costingGroups: JSON.stringify(initGroups),
      isAddStocksChecked: false,
      stocksAmount: '',
      stockDescription: ''
    });
  };

  const handleCloseModalAfterSave = () => {
    setPostSavePrompt(false);
    closeAndResetModal();
  };

  const handleHeaderChange = (e) => setHeaderData({ ...headerData, [e.target.name]: e.target.value });

  const handleLineChange = (groupId, lineId, field, value, type = 'construction') => {
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
    setCostingGroups(groups => groups.map(g => {
      if (g.id !== groupId) return g;
      const key = type === 'construction' ? 'constructionLines' : 'miscLines';
      return { ...g, [key]: g[key].map(line => line.id === lineId ? { ...line, [field]: finalValue } : line) };
    }));
    if (field === 'category' && finalValue.trim() !== '') {
      setLineErrors(errors => errors.filter(errId => errId !== lineId));
    }
  };

  const addLine = (groupId, type = 'construction') => {
    if (isAddingLine) return;
    setIsAddingLine(true);
    setCostingGroups(groups => groups.map(g => {
      if (g.id !== groupId) return g;
      const allLines = [...g.constructionLines, ...g.miscLines];
      const maxId = allLines.length > 0 ? Math.max(...allLines.map(line => typeof line.id === 'number' ? line.id : 0)) : 0;
      const key = type === 'construction' ? 'constructionLines' : 'miscLines';
      return { ...g, [key]: [...g[key], { id: maxId + 1, category: '', amount: '' }] };
    }));
    setTimeout(() => setIsAddingLine(false), 300);
  };

  const removeLine = (groupId, lineId, type = 'construction') => {
    setCostingGroups(groups => groups.map(g => {
      if (g.id !== groupId) return g;
      const key = type === 'construction' ? 'constructionLines' : 'miscLines';
      if (g.constructionLines.length + g.miscLines.length <= 1) return g;
      return { ...g, [key]: g[key].filter(line => line.id !== lineId) };
    }));
  };

  const addCostingGroup = () => {
    const now = Date.now();
    setCostingGroups(prev => [...prev, makeDefaultGroup(now)]);
  };

  const removeCostingGroup = (groupId) => {
    if (costingGroups.length <= 1) return;
    setCostingGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const updateGroupTarget = (groupId, targetProject) => {
    setCostingGroups(groups => groups.map(g => g.id === groupId ? { ...g, targetProject } : g));
  };

  const handleSaveDraft = () => {
    localStorage.setItem('disbursement_draft', JSON.stringify({
      headerData,
      costingGroups,
      editingId
    }));
    setShowUnsavedModal(false);
    closeAndResetModal();
  };

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false);
    closeAndResetModal();
  };

  const handleRestoreDraft = () => {
    const draftStr = localStorage.getItem('disbursement_draft');
    if (draftStr) {
      const draft = JSON.parse(draftStr);
      setHeaderData(draft.headerData);

      // Support both new costingGroups format and old constructionLines/miscLines format
      if (draft.costingGroups) {
        setCostingGroups(draft.costingGroups);
      } else {
        const now = Date.now();
        setCostingGroups([{
          id: now,
          targetProject: 'all',
          constructionLines: draft.constructionLines || [{ id: now + 1, category: '', amount: '' }],
          miscLines: draft.miscLines || [{ id: now + 2, category: '', amount: '' }]
        }]);
      }

      if (draft.headerData.accts_pay || draft.headerData.input_tax || draft.headerData.output_tax) {
        setShowTaxFields(true);
      } else {
        setShowTaxFields(false);
      }
      setEditingId(draft.editingId || null);
      setInitialFormState({
        headerData: JSON.stringify(draft.headerData),
        costingGroups: JSON.stringify(draft.costingGroups || [])
      });
      setShowDraftModal(false);
      setIsModalOpen(true);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('disbursement_draft');
    setShowDraftModal(false);
    resetForm();

    const now = Date.now();
    const initHeader = { date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', bank: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'normal' };
    const initGroups = [makeDefaultGroup(now)];
    setHeaderData(initHeader);
    setCostingGroups(initGroups);
    setInitialFormState({
      headerData: JSON.stringify(initHeader),
      costingGroups: JSON.stringify(initGroups),
      isAddStocksChecked: false,
      stocksAmount: ''
    });

    setIsModalOpen(true);
  };

  const handleNewDisbursement = () => {
    const hasDraft = localStorage.getItem('disbursement_draft') !== null;
    if (hasDraft) {
      setShowDraftModal(true);
    } else {
      resetForm();
      const now = Date.now();
      const initHeader = { date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', bank: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'normal' };
      const initGroups = [makeDefaultGroup(now)];
      setHeaderData(initHeader);
      setCostingGroups(initGroups);
      setInitialFormState({
        headerData: JSON.stringify(initHeader),
        costingGroups: JSON.stringify(initGroups),
        isAddStocksChecked: false,
        stocksAmount: '',
        stockDescription: ''
      });
      setIsModalOpen(true);
    }
  };

  const handleEditRow = (d) => {
    if (!canEdit) return;
    setEditingId(d.id);
    setEditingUnderlyingRecords(d.underlying_records || [d]);

    // Normalize project_code to an array to prevent crashes when older string data or grouped array data is passed
    const projCodes = Array.isArray(d.project_code)
      ? d.project_code
      : (d.project_code ? String(d.project_code).split(',').map(c => c.trim()).filter(Boolean) : []);

    const newHeader = {
      date: d.date || '',
      project_code: projCodes,
      payee: d.payee || '',
      particulars: d.particulars || '',
      tin: d.tin || '',
      cv_no: d.cv_no || '',
      bank: d.bank || '',
      check_no: d.check_no || '',
      or_inv_no: d.or_inv_no || '',
      accts_pay: d.accts_pay || '',
      input_tax: d.input_tax || '',
      output_tax: d.output_tax || '',
      target_cib: (d.target_cib || d.net_amount || '').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      costing_type: d.costing_type || 'normal'
    };
    setHeaderData(newHeader);

    const loadedExpenses = d.expenses && d.expenses.length > 0 ? d.expenses : [];
    const cLines = [];
    const mLines = [];

    // Compute classification inline — can't use mainCategoriesList useMemo here since
    // setHeaderData(newHeader) is async and the memo hasn't recomputed yet.
    const selectedProject = projects.find(p => projCodes.includes(p.project_code));
    const pType = selectedProject ? selectedProject.project_type : 'Construction';

    const inlineMain = new Set();
    (categoryObjects || []).forEach(catObj => {
      const rawName = catObj.name;
      if (rawName.startsWith('[MAIN] ')) {
        inlineMain.add(rawName.replace('[MAIN] ', ''));
      }
    });

    const groupsMap = {};
    const underlying = d.underlying_records || [d];

    underlying.forEach(record => {
      const recordExpenses = record.expenses && record.expenses.length > 0 ? record.expenses : [];
      recordExpenses.forEach(exp => {
        const gid = exp.groupId || 'old_default_group';
        if (!groupsMap[gid]) {
          groupsMap[gid] = {
            id: gid === 'old_default_group' ? Date.now() + 100 : gid,
            targetProject: exp.targetProject || 'all',
            constructionLines: [],
            miscLines: [],
            _seenLinesMap: {}
          };
        }

        const group = groupsMap[gid];
        const lineId = exp.id || (Date.now() + Math.random());
        let rawAmt = parseFloat(exp.amount) || 0;

        if (!group._seenLinesMap[lineId]) {
          group._seenLinesMap[lineId] = { ...exp, amountNum: rawAmt };
        } else {
          // Unconditionally sum identical line items across grouped records
          group._seenLinesMap[lineId].amountNum += rawAmt;
        }
      });
    });

    const parsedGroups = Object.values(groupsMap).map(group => {
      Object.values(group._seenLinesMap).forEach(expData => {
        const roundedAmt = Math.round(expData.amountNum * 100) / 100;
        const displayStr = roundedAmt % 1 === 0 ? String(roundedAmt) : roundedAmt.toFixed(2);

        const expWithCommas = {
          ...expData,
          amount: roundedAmt ? displayStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
        };

        if (inlineMain.has(expWithCommas.category)) {
          group.constructionLines.push(expWithCommas);
        } else {
          group.miscLines.push(expWithCommas);
        }
      });
      delete group._seenLinesMap;
      if (group.constructionLines.length === 0) group.constructionLines.push({ id: Date.now() + Math.random(), category: '', amount: '' });
      if (group.miscLines.length === 0) group.miscLines.push({ id: Date.now() + Math.random(), category: '', amount: '' });
      return group;
    }).sort((a, b) => a.id - b.id);

    if (parsedGroups.length === 0) {
      const now = Date.now();
      parsedGroups.push({
        id: now + 100,
        targetProject: 'all',
        constructionLines: [{ id: now + 1, category: '', amount: '' }],
        miscLines: [{ id: now + 2, category: '', amount: '' }]
      });
    }

    setCostingGroups(parsedGroups);
    setModalAttachments(d.attachments || []);

    if (d.stocks_amount && d.stocks_amount > 0) {
      setIsAddStocksChecked(true);
      setStocksAmount(String(d.stocks_amount).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
      setStockDescription(d.stock_description || '');
    } else {
      setIsAddStocksChecked(false);
      setStocksAmount('');
      setStockDescription('');
    }

    setInitialFormState({
      headerData: JSON.stringify(newHeader),
      costingGroups: JSON.stringify(parsedGroups),
      isAddStocksChecked: d.stocks_amount > 0,
      stocksAmount: d.stocks_amount > 0 ? String(d.stocks_amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '',
      stockDescription: d.stock_description || ''
    });

    setErrorMessage('');
    setIsModalOpen(true);
  };

  const executeSave = async (disbursementData) => {
    setIsSaving(true);
    try {
      const token = sessionStorage.getItem('fbtmcc_token');
      const payloads = Array.isArray(disbursementData) ? disbursementData : [disbursementData];

      const newPayloads = payloads.filter(data => !(typeof data.id === 'number' || (typeof data.id === 'string' && !data.id.startsWith('new_'))));
      const existingPayloads = payloads.filter(data => (typeof data.id === 'number' || (typeof data.id === 'string' && !data.id.startsWith('new_'))));

      const promises = existingPayloads.map(data => {
        return fetch(`${API_URL}/disbursements/${data.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(data)
        }).then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Hindi ma-save ang data.");
          }
          return res;
        });
      });

      if (newPayloads.length > 0) {
        promises.push(
          fetch(`${API_URL}/disbursements`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newPayloads)
          }).then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || "Hindi ma-save ang data.");
            }
            return res;
          })
        );
      }

      if (editingId && editingUnderlyingRecords) {
        const payloadIds = payloads.map(p => p.id);
        const recordsToDelete = editingUnderlyingRecords.filter(r => !payloadIds.includes(r.id));
        recordsToDelete.forEach(record => {
          promises.push(
            fetch(`${API_URL}/disbursements/${record.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
        });
      }

      await Promise.all(promises);

      await refreshData();
      setPostSavePrompt(true);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Network Error: Hindi makonekta sa Local Server.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage('');

    const parsedStocksAmt = isAddStocksChecked ? (parseFloat(String(stocksAmount).replace(/,/g, '')) || 0) : 0;
    const isPureStock = totals.totalDebit === 0 && parsedStocksAmt > 0;

    if (!canEdit || (totals.totalDebit === 0 && !isPureStock)) return;

    if (isPureStock) {
      setShowStockWarning(true);
      return;
    }

    proceedWithSubmission(false);
  };

  const proceedWithSubmission = (isPureStock) => {
    let finalHeaderData = { ...headerData };

    if (isPureStock) {
      finalHeaderData = {
        ...finalHeaderData,
        payee: null,
        project_code: null,
        particulars: null,
        bank: null,
        check_no: null,
        tin: null
      };
    } else {
      if (!headerData.project_code) return;
    }

    ['or_inv_no', 'bank', 'check_no', 'tin', 'particulars', 'payee'].forEach(key => {
      if (typeof finalHeaderData[key] === 'string' && finalHeaderData[key].trim() === "") {
        finalHeaderData[key] = null;
      }
    });

    if (!finalHeaderData.cv_no && !finalHeaderData.or_inv_no) { setErrorMessage("Kailangan ilagay ang CV# o OR/INV#."); return; }
    if (isDuplicateCV) { setErrorMessage("May kaparehas na CV#! Paki-palitan bago i-save."); return; }
    if (isDuplicateOR) { setErrorMessage("May kaparehas na OR/INV#! Paki-palitan bago i-save."); return; }
    const stockAllocationValid = isStockAllocationMode && totals.cib_coh > 0 && totals.cib_coh <= targetCib;
    if (!isVarianceZero && !stockAllocationValid) { setErrorMessage("Hindi pwedeng i-save! Paki-check ang Variance. Kailangang pantay ang Target CIB sa Computed CIB."); return; }

    const projectCodes = Array.isArray(finalHeaderData.project_code)
      ? finalHeaderData.project_code
      : (typeof finalHeaderData.project_code === 'string' ? finalHeaderData.project_code.split(',').filter(Boolean) : []);

    if (!isPureStock && projectCodes.length === 0) {
      setErrorMessage("Kailangan pumili ng Project Code.");
      return;
    }

    const finalProjectCodes = (isPureStock && projectCodes.length === 0) ? [''] : projectCodes;

    if (isAddStocksChecked && (!stockDescription || stockDescription.trim() === '')) {
      setErrorMessage("Kailangan maglagay ng Stock Description kapag nag-add ng stocks.");
      return;
    }

    const numProjects = finalProjectCodes.length;
    const payloads = finalProjectCodes.map((projCode, index) => {
      let projectTotalDebit = 0;
      let projectEwt = 0;
      const projectExpenses = [];

      costingGroups.forEach(group => {
        const groupLines = [...group.constructionLines, ...group.miscLines].filter(
          line => {
            const cat = line.category ? line.category.trim() : '';
            return cat !== '' && !cat.toLowerCase().includes('select');
          }
        );

        groupLines.forEach(line => {
          const rawAmt = parseFloat(String(line.amount).replace(/,/g, '')) || 0;
          let amt;

          const targetProjects = Array.isArray(group.targetProject) ? group.targetProject : [group.targetProject];

          if (targetProjects.includes('all')) {
            const base = Math.floor((rawAmt / numProjects) * 100) / 100;
            const remainder = Math.round((rawAmt - (base * numProjects)) * 100) / 100;
            amt = (index === 0) ? Number((base + remainder).toFixed(2)) : base;
          } else if (targetProjects.includes(projCode)) {
            const numTargets = targetProjects.length;
            const targetIndex = targetProjects.indexOf(projCode);
            const base = Math.floor((rawAmt / numTargets) * 100) / 100;
            const remainder = Math.round((rawAmt - (base * numTargets)) * 100) / 100;
            amt = (targetIndex === 0) ? Number((base + remainder).toFixed(2)) : base;
          } else {
            return; // skip — this group targets a different project
          }

          projectExpenses.push({
            ...line,
            amount: amt,
            groupId: group.id,
            targetProject: group.targetProject
          });
          projectTotalDebit += amt;

          const cat = (line.category || '').toUpperCase();
          if (cat === 'LABOR /SUBCONTRACTOR' || cat === 'LABOR/PAYROLL') {
            projectEwt += (amt / 0.98) - amt;
          }
        });
      });

      const projNet = Number(projectTotalDebit.toFixed(2));
      const projEwt = Number(projectEwt.toFixed(2));
      const getSplitVal = (val) => {
        const num = parseFloat(String(val).replace(/,/g, ''));
        if (isNaN(num) || !num) return 0;
        const base = Math.floor((num / numProjects) * 100) / 100;
        const remainder = Math.round((num - (base * numProjects)) * 100) / 100;
        return (index === 0) ? Number((base + remainder).toFixed(2)) : base;
      };

      const projStocksAmount = isAddStocksChecked
        ? getSplitVal(stocksAmount)
        : 0;
      const projGross = Number((projNet + projEwt + projStocksAmount).toFixed(2));

      const isAllocation = isStockAllocationMode && stockAllocationSource;

      return {
        id: editingId ? (editingUnderlyingRecords[index]?.id || `new_${index}`) : `new_${index}`,
        ...finalHeaderData,
        project_code: projCode || null,
        payee: finalHeaderData.payee || null,
        target_cib: getSplitVal(finalHeaderData.target_cib),
        input_tax: getSplitVal(finalHeaderData.input_tax),
        output_tax: getSplitVal(finalHeaderData.output_tax),
        accts_pay: getSplitVal(finalHeaderData.accts_pay),
        expenses: projectExpenses.map(exp => ({ ...exp, category: exp.category || null })),
        attachments: modalAttachments,
        gross_amount: projGross,
        ewt_amount: projEwt,
        net_amount: projNet,
        // Stock allocation entries are saved as plain expenses — stocks_amount = 0
        stocks_amount: isAllocation ? 0 : projStocksAmount,
        stock_description: (!isAllocation && isAddStocksChecked) ? stockDescription.trim() : '',
        created_at: editingId ? (editingUnderlyingRecords[0]?.created_at || new Date().toISOString()) : new Date().toISOString(),
        // Stock Allocation Mode flags
        ...(isAllocation ? {
          is_stock_allocation: true,
          source_cv_no: stockAllocationSource.cv_no,
          allocated_amount: projNet  // actual expense total being drawn from the stock (e.g. 400, not 500)
        } : {})
      };
    });

    if (editingId) {
      setPasswordModal({
        isOpen: true,
        action: 'update_group',
        payload: payloads,
        oldIds: editingUnderlyingRecords.map(r => r.id)
      });
    } else {
      executeSave(payloads);
    }
  };

  const handleDeleteClick = (d) => {
    if (!canEdit) return;
    const idsToDelete = (d.underlying_records || [d]).map(r => r.id);
    setPasswordModal({ isOpen: true, action: 'delete_group', payload: idsToDelete });
  };

  const executeDeleteGroup = async (ids) => {
    try {
      const token = sessionStorage.getItem('fbtmcc_token');
      const deletePromises = ids.map(id =>
        fetch(`${API_URL}/disbursements/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      await Promise.all(deletePromises);
      await refreshData();
    } catch (error) {
      console.error(error);
      alert("Network Error during delete.");
    }
  };

  const handlePasswordConfirm = async () => {
    if (passwordModal.action === 'update' || passwordModal.action === 'update_group') {
      executeSave(passwordModal.payload);
    } else if (passwordModal.action === 'delete_group') {
      executeDeleteGroup(passwordModal.payload);
    }
    setPasswordModal({ isOpen: false, action: null, payload: null });
  };

  function getCategoryAmount(disbursement, catName) {
    if (!disbursement.expenses) return null;
    const exp = disbursement.expenses.find(e => e.category === catName);
    return exp && parseFloat(exp.amount) ? parseFloat(exp.amount) : null;
  }

  // ==========================================
  // 5. USE EFFECTS (Listeners & Auto-Opens)
  // ==========================================

  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(isModalOpen || showUnsavedModal || showDraftModal || passwordModal.isOpen || postSavePrompt);
    }
  }, [isModalOpen, showUnsavedModal, showDraftModal, passwordModal.isOpen, postSavePrompt, onModalStateChange]);


  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (postSavePrompt) {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleStayInModal();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          handleCloseModalAfterSave();
        }
        return;
      }

      if (event.key === 'Escape') {
        if (isModalOpen && !showUnsavedModal && !showDraftModal) handleCloseRequest();
        if (isFilterOpen) setIsFilterOpen(false);
      }

      if (isModalOpen && !postSavePrompt && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();

        const originalRecord = editingId ? disbursements.find(d => d.id === editingId) : null;
        const isSameAsOriginalCV = originalRecord && originalRecord.cv_no && originalRecord.cv_no.trim().toLowerCase() === headerData.cv_no.trim().toLowerCase();
        const isDupCV = !isSameAsOriginalCV && headerData.cv_no && disbursements.some((d) => d.id !== editingId && d.cv_no && d.cv_no.trim().toLowerCase() === headerData.cv_no.trim().toLowerCase());

        const isSameAsOriginalOR = originalRecord && originalRecord.or_inv_no && originalRecord.or_inv_no.trim().toLowerCase() === headerData.or_inv_no.trim().toLowerCase();
        const isDupOR = !isSameAsOriginalOR && headerData.or_inv_no && disbursements.some((d) => d.id !== editingId && d.or_inv_no && d.or_inv_no.trim().toLowerCase() === headerData.or_inv_no.trim().toLowerCase());

        const tCib = parseFloat(headerData.target_cib) || 0;
        const isVarZero = Math.abs(tCib - totals.cib_coh) < 0.01;

        if (!isDupCV && !isDupOR && isVarZero && tCib > 0 && !isSaving && canEdit && headerData.project_code && (headerData.cv_no || headerData.or_inv_no)) {
          const fakeEvent = { preventDefault: () => { } };
          handleSubmit(fakeEvent);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, isFilterOpen, showUnsavedModal, showDraftModal, postSavePrompt, headerData, costingGroups, initialFormState, isSaving, totals, disbursements, editingId, canEdit]);



  useEffect(() => {
    if (initialDisbursementId && disbursements.length > 0) {
      // Find the grouped record that contains this underlying ID
      const groupedRecord = groupedDisbursements.find(g =>
        (g.underlying_records || [g]).some(r => String(r.id) === String(initialDisbursementId))
      );

      if (groupedRecord) {
        const timer = setTimeout(() => {
          handleEditRow(groupedRecord);
          if (onClearInitialDisbursement) onClearInitialDisbursement();
        }, 100);
        return () => clearTimeout(timer);
      } else {
        // Fallback to raw record just in case it got filtered out
        const rawRecord = disbursements.find(d => String(d.id) === String(initialDisbursementId));
        if (rawRecord) {
          const timer = setTimeout(() => {
            handleEditRow(rawRecord);
            if (onClearInitialDisbursement) onClearInitialDisbursement();
          }, 100);
          return () => clearTimeout(timer);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDisbursementId, groupedDisbursements, disbursements]);

  // ==========================================
  // STOCK ALLOCATION MODE — auto-open and pre-fill
  // ==========================================
  useEffect(() => {
    if (initialStockAllocation && !editingId) {
      const { cv_no, or_inv_no, stock_description, stocks_amount } = initialStockAllocation;
      const formattedAmount = stocks_amount
        ? stocks_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })
        : '0.00';
      setIsStockAllocationMode(true);
      setStockAllocationSource(initialStockAllocation);
      setHeaderData(prev => ({
        ...prev,
        target_cib: formattedAmount,
        particulars: `Stock Allocation from CV# ${cv_no} — ${stock_description || 'N/A'}`,
        cv_no: cv_no || '',
        or_inv_no: or_inv_no || ''
      }));
      setIsModalOpen(true);
      if (onClearInitialDisbursement) onClearInitialDisbursement();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStockAllocation]);
  const usedMainCategories = costingGroups.flatMap(g => g.constructionLines.map(l => l.category)).filter(Boolean);
  const usedMiscCategories = costingGroups.flatMap(g => g.miscLines.map(l => l.category)).filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 overflow-hidden transition-colors duration-300">
      {/* HEADER */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between shrink-0 shadow-sm transition-colors duration-300">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200 dark:shadow-none">
              <Receipt size={28} />
            </div>
            DISBURSEMENT LEDGER
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2.5 font-medium italic text-sm">
            {selectedMonths.length > 0 || selectedYears.length > 0 || selectedTransactionFilter !== 'All'
              ? `${selectedMonths.length > 0 ? selectedMonths.map(m => monthOptions.find(opt => opt.value === m)?.label.substring(0, 3)).join(', ') : 'ALL MONTHS'} | ${selectedYears.length > 0 ? selectedYears.join(', ') : 'ALL YEARS'}`.toUpperCase() + (selectedTransactionFilter !== 'All' ? ` | ${selectedTransactionFilter === 'EWT' ? 'EWT ONLY' : selectedTransactionFilter.toUpperCase()}` : '')
              : 'FOR ALL DATES'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {!canEdit && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-colors duration-300">
              <Lock size={16} />
              READ-ONLY MODE
            </div>
          )}
          {isLoading && (
            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl text-xs font-black animate-pulse border border-blue-100 dark:border-blue-800 transition-colors duration-300">
              UPDATING...
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col p-8 space-y-8">

        {/* STATS CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
          <HealthCard
            title="Total of Debit (Gross)"
            amount={ledgerTotals.dr}
            colorClass="bg-blue-600 dark:bg-blue-500"
            textClass="text-blue-600 dark:text-blue-400"
          />
          <HealthCard
            title="Total of Credit (Net+Tax)"
            amount={ledgerTotals.cr}
            colorClass="bg-emerald-600 dark:bg-emerald-500"
            textClass="text-emerald-600 dark:text-emerald-400"
          />
          <HealthCard
            title="TOTAL EWT"
            amount={ledgerTotals.ewt}
            colorClass="bg-indigo-600 dark:bg-indigo-500"
            textClass="text-indigo-600 dark:text-indigo-400"
          />
        </section>

        {/* LEDGER TABLE SECTION */}
        <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 transition-colors duration-300">

          {/* ACTION BAR */}
          <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 shrink-0 transition-colors duration-300">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search CV or Invoice No..."
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-slate-800 dark:text-white transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => {
                    setTempSelectedMonths(selectedMonths);
                    setTempSelectedYears(selectedYears);
                    setTempSelectedTransactionFilter(selectedTransactionFilter);
                    setIsFilterOpen(!isFilterOpen);
                  }}
                  className="flex items-center gap-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-xl font-bold transition-all shadow-sm"
                >
                  <Filter size={18} className={selectedMonths.length === 0 && selectedYears.length === 0 && selectedTransactionFilter === 'All' ? 'text-slate-400 dark:text-slate-500' : 'text-blue-600 dark:text-blue-400'} />
                  <span>{selectedMonths.length > 0 || selectedYears.length > 0 || selectedTransactionFilter !== 'All' ? `${selectedMonths.length > 0 ? selectedMonths.length + ' Months' : 'All Months'} | ${selectedYears.length > 0 ? selectedYears.length + ' Years' : 'All Years'}` + (selectedTransactionFilter !== 'All' ? ` | ${selectedTransactionFilter}` : '') : 'All Dates'}</span>
                </button>

                {isFilterOpen && (
                  <div className="absolute left-0 mt-3 w-[500px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                      <span className="font-black text-slate-700 dark:text-slate-300 text-sm tracking-tight uppercase">Filter by Date</span>
                      <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={18} /></button>
                    </div>
                    <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                      <div className="flex flex-col sm:flex-row gap-6">
                        {/* LEFT COLUMN: MONTHS */}
                        <div className="flex-[1.2] space-y-3">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
                            <span>Months</span>
                            <button onClick={() => setTempSelectedMonths([])} className="text-[10px] text-blue-500 hover:text-blue-600 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">Clear</button>
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {monthOptions.map(m => (
                              <button
                                key={m.value}
                                onClick={() => handleToggleMonth(m.value)}
                                className={`px-2 py-2 text-[11px] rounded-lg border font-bold transition-all ${tempSelectedMonths.includes(m.value) ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-none' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                              >
                                {m.label.substring(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* RIGHT COLUMN: YEARS & TRANSACTION TYPE */}
                        <div className="flex-1 flex flex-col gap-6">
                          <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
                              <span>Years</span>
                              <button onClick={() => setTempSelectedYears([])} className="text-[10px] text-blue-500 hover:text-blue-600 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">Clear</button>
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {availableYears.map(year => (
                                <button
                                  key={year}
                                  onClick={() => handleToggleYear(year)}
                                  className={`px-2 py-2 text-[11px] rounded-lg border font-bold transition-all ${tempSelectedYears.includes(year) ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-none' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                >
                                  {year}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
                              <span>Transaction Type</span>
                            </label>
                            <select
                              value={tempSelectedTransactionFilter}
                              onChange={(e) => setTempSelectedTransactionFilter(e.target.value)}
                              className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors cursor-pointer"
                            >
                              <option value="All">All Transactions</option>
                              <option value="EWT">With EWT Payable</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex gap-2">
                      <button
                        onClick={clearFilter}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-bold transition-all text-sm"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={applyFilter}
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-black transition-all shadow-lg shadow-blue-100 dark:shadow-none text-sm"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-4 py-3 rounded-xl font-bold transition-all shadow-sm ml-2 disabled:opacity-50"
                title="Export Filtered Data to Excel"
              >
                {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                <span className="hidden sm:inline">Export Excel</span>
              </button>

              {/* ZOOM CONTROLS */}
              <div className="flex items-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-1 shadow-sm gap-1 ml-2 transition-colors duration-300">
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-30"
                  title="Zoom Out"
                  disabled={zoomLevel <= 0.6}
                >
                  <ZoomOut size={16} />
                </button>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 w-12 text-center select-none uppercase tracking-tighter">
                  {Math.round(zoomLevel * 100)}%
                </div>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-30"
                  title="Zoom In"
                  disabled={zoomLevel >= 1.5}
                >
                  <ZoomIn size={16} />
                </button>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                <button
                  onClick={resetZoom}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Reset Zoom"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            {canEdit && (
              <button
                onClick={handleNewDisbursement}
                className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black transition-all shadow-lg shadow-blue-200 dark:shadow-none"
              >
                <Plus size={20} />
                New Disbursement
              </button>
            )}
          </div>

          {/* TABLE */}
          <div className="overflow-auto custom-scrollbar flex-1 border border-slate-400 dark:border-slate-600 rounded-2xl shadow-xl bg-white dark:bg-slate-800 transition-colors duration-300">
            <table className="w-full text-left border-collapse min-w-[1500px]" style={{ zoom: zoomLevel }}>
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-700 transition-colors duration-300">
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 sticky left-0 z-10 bg-slate-100 dark:bg-slate-700 shadow-[3px_0_0_0_#94a3b8] dark:shadow-[3px_0_0_0_#475569]">Date</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600">Payee</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-center">CV No.</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-center">OR / INV NO.</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-center">Project</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-right">Debit (Gross)</th>
                  <th className="px-6 py-5 text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-right bg-emerald-100/50 dark:bg-emerald-900/30">Credit (CIB)</th>
                  {isAcctsPayVisible && (
                    <th className="px-6 py-5 text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-right bg-amber-50/50 dark:bg-amber-900/30">Accts Pay (Credit Card)</th>
                  )}
                  {isEwtVisible && (
                    <th className="px-6 py-5 text-xs font-black text-rose-800 dark:text-rose-400 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-right bg-rose-50/50 dark:bg-rose-900/30">EWT</th>
                  )}
                  {visibleCategories.map(cat => (
                    <th key={cat} className="px-4 py-5 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest border-b-2 border-r border-slate-400 dark:border-slate-600 text-right min-w-[120px] bg-slate-50 dark:bg-slate-800" title={cat}>
                      {cat}
                    </th>
                  ))}
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-center">Particulars</th>
                  {canEdit && <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-slate-400 dark:border-slate-600 text-center sticky right-0 z-10 bg-slate-100 dark:bg-slate-700 shadow-[-3px_0_0_0_#94a3b8] dark:shadow-[-3px_0_0_0_#475569]">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400 dark:divide-slate-600">
                {groupedDisbursements.length === 0 ? (
                  <tr>
                    <td colSpan={totalVisibleColumns} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full text-slate-300 dark:text-slate-600">
                          <Receipt size={48} />
                        </div>
                        <p className="text-slate-400 dark:text-slate-500 font-bold text-lg italic">No disbursements found for the selected criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : groupedDisbursements.map(d => (
                  <tr
                    key={d.id}
                    className={`even:bg-slate-50/80 dark:even:bg-slate-800/80 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors group ${canEdit ? 'cursor-pointer' : ''}`}
                    onDoubleClick={() => handleEditRow(d)}
                  >
                    <td className="px-6 py-4 font-black text-slate-600 dark:text-slate-300 sticky left-0 z-10 bg-white dark:bg-slate-900 group-even:bg-slate-50 dark:group-even:bg-slate-800 group-hover:bg-blue-100/50 dark:group-hover:bg-blue-900/30 border-r border-slate-400 dark:border-slate-600 shadow-[3px_0_0_0_#94a3b8] dark:shadow-[3px_0_0_0_#475569] transition-colors duration-300">{d.date}</td>
                    <td className="px-6 py-4 font-black text-slate-800 dark:text-slate-200 border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">{d.payee}</td>
                    <td className="px-6 py-4 font-black text-blue-700 dark:text-blue-400 text-center border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">{d.cv_no ? `#${d.cv_no}` : '-'}</td>
                    <td className="px-6 py-4 font-black text-indigo-700 dark:text-indigo-400 text-center border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">{d.or_inv_no ? `#${d.or_inv_no}` : '-'}</td>
                    <td className="px-6 py-4 text-center border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">
                      <div className="flex flex-col items-center gap-1">
                        {(Array.isArray(d.project_code) ? d.project_code : [d.project_code]).map((pc, i) => (
                          <span key={i} className="text-[10px] leading-tight font-black bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/50 uppercase tracking-widest">{pc}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-black text-slate-900 dark:text-white border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">₱{(d.gross_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10 border-r border-slate-400 dark:border-slate-600 group-hover:bg-emerald-100/30 dark:group-hover:bg-emerald-900/30">₱{((Array.isArray(d.project_code) ? d.project_code.some(pc => pc?.toLowerCase() === 'credit card') : d.project_code?.toLowerCase() === 'credit card') ? 0 : (d.net_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {isAcctsPayVisible && (
                      <td className="px-6 py-4 text-right font-mono font-black text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10 border-r border-slate-400 dark:border-slate-600 group-hover:bg-amber-100/30 dark:group-hover:bg-amber-900/30">₱{((parseFloat(d.accts_pay) || 0) + ((Array.isArray(d.project_code) ? d.project_code.some(pc => pc?.toLowerCase() === 'credit card') : d.project_code?.toLowerCase() === 'credit card') ? (parseFloat(d.net_amount) || 0) : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    )}
                    {isEwtVisible && (
                      <td className="px-6 py-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-900/10 border-r border-slate-400 dark:border-slate-600 group-hover:bg-rose-100/20 dark:group-hover:bg-rose-900/30">₱{(d.ewt_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    )}
                    {visibleCategories.map(cat => {
                      const amt = getCategoryAmount(d, cat);
                      return (
                        <td key={cat} className={`px-4 py-4 text-right font-mono text-sm border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 ${amt ? 'font-black text-slate-800 dark:text-slate-200 bg-slate-100/40 dark:bg-slate-700/40' : 'text-slate-300 dark:text-slate-600'}`}>
                          {amt ? `₱${amt.toLocaleString()}` : '—'}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs italic max-w-[200px] truncate border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20" title={d.particulars}>{d.particulars}</td>
                    {canEdit && (
                      <td className="px-6 py-4 text-center sticky right-0 z-10 bg-white dark:bg-slate-900 group-even:bg-slate-50 dark:group-even:bg-slate-800 group-hover:bg-blue-100/50 dark:group-hover:bg-blue-900/30 shadow-[-3px_0_0_0_#94a3b8] dark:shadow-[-3px_0_0_0_#475569] transition-colors duration-300">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleEditRow(d); }} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 border border-blue-100 dark:border-blue-800/50 rounded-lg transition-colors" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(d); }} className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 border border-red-100 dark:border-red-800/50 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {groupedDisbursements.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-800 font-black text-slate-800 dark:text-slate-200 border-t-4 border-slate-400 dark:border-slate-600 transition-colors duration-300">
                  <tr>
                    <td colSpan="5" className="px-6 py-6 text-right text-xs tracking-widest text-slate-500 dark:text-slate-400 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 border-r border-slate-400 dark:border-slate-600 shadow-[3px_0_0_0_#94a3b8] dark:shadow-[3px_0_0_0_#475569] transition-colors duration-300">TOTAL SUMMARY:</td>
                    <td className="px-6 py-6 text-right font-mono text-blue-800 dark:text-blue-400 border-r border-slate-400 dark:border-slate-600 text-lg">₱{ledgerTotals.dr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-6 text-right font-mono text-emerald-800 dark:text-emerald-400 border-r border-slate-400 dark:border-slate-600 text-lg">₱{ledgerTotals.cib.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {isAcctsPayVisible && (
                      <td className="px-6 py-6 text-right font-mono text-amber-800 dark:text-amber-400 border-r border-slate-400 dark:border-slate-600 text-lg">₱{ledgerTotals.accts_pay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    )}
                    {isEwtVisible && (
                      <td className="px-6 py-6 text-right font-mono text-rose-800 dark:text-rose-400 border-r border-slate-400 dark:border-slate-600 text-lg">₱{ledgerTotals.ewt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    )}
                    <td colSpan={visibleCategories.length + (canEdit ? 2 : 1)} className="px-6 py-6"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </main>

      {/* POST SAVE PROMPT MODAL (Stay or Close) */}
      {postSavePrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 px-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Voucher Saved!</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                The disbursement voucher has been successfully recorded in the ledger. Would you like to add a new one?
              </p>

              <div className="flex flex-col sm:flex-row w-full gap-3">
                <button
                  onClick={handleCloseModalAfterSave}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-black rounded-xl transition-all"
                >
                  <span className="flex items-center justify-center gap-2">
                    <X size={16} /> Close
                  </span>
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-widest">(ESC)</div>
                </button>
                <button
                  onClick={handleStayInModal}
                  className="flex-[1.5] py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Plus size={16} /> Stay & Add New
                  </span>
                  <div className="text-[10px] font-medium text-blue-300 mt-0.5 uppercase tracking-widest">(ENTER)</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && canEdit && !postSavePrompt && (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-6 pb-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm px-4 overflow-hidden transition-colors duration-300">
          <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-full border border-slate-200 dark:border-slate-800">

            <div className="bg-white dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 transition-colors duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                    {isStockAllocationMode ? 'Stock Allocation Entry' : editingId ? 'Edit Disbursement Voucher' : 'Disbursement Voucher Entry'}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    {isStockAllocationMode
                      ? `Allocating stock from CV# ${stockAllocationSource?.cv_no} — categorize where this stock will be used.`
                      : editingId ? 'Update the fund details and save.' : 'Complete all required fund details below.'}
                  </p>
                </div>
              </div>
              <button onClick={handleCloseRequest} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 text-slate-400 dark:text-slate-500 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <form onSubmit={handleSubmit} className="space-y-6">

                {errorMessage && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm font-medium animate-in fade-in flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500 animate-pulse"></span>
                    {errorMessage}
                  </div>
                )}

                {isStockAllocationMode && stockAllocationSource && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4 flex items-start gap-3 animate-in fade-in">
                    <span className="text-2xl">📦</span>
                    <div>
                      <p className="text-sm font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Stock Allocation Mode Active</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                        You are allocating <span className="font-black">₱{stockAllocationSource.stocks_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> of stock from <span className="font-black">CV# {stockAllocationSource.cv_no}</span> ({stockAllocationSource.stock_description || 'N/A'}).
                        The Target CIB is locked to the available stock amount.
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex justify-between">
                    <span>1. Voucher Details</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Payee <span className="text-red-500">*</span></label>
                      <input type="text" name="payee" placeholder="Name of Payee" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none font-medium text-slate-800 dark:text-white transition-colors"
                        value={headerData.payee} onChange={handleHeaderChange} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Project Code (#) <span className="text-red-500">*</span></label>
                      <MultiSelectDropdown
                        options={projects.map(p => p.project_code)}
                        value={headerData.project_code}
                        onChange={(val) => handleHeaderChange({ target: { name: 'project_code', value: val } })}
                        placeholder="-- Search for Project Code --"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Date <span className="text-red-500">*</span></label>
                      <input type="date" name="date" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                        value={headerData.date} onChange={handleHeaderChange} required />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs font-semibold flex items-center justify-between ${isStockAllocationMode ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                        <span>CV # <span className="text-blue-500 font-bold">* (At least one)</span></span>
                      </label>
                      <input
                        type="text"
                        name="cv_no"
                        inputMode="text"
                        pattern="[0-9\-]*"
                        placeholder="Unique CV#"
                        className={`w-full p-2 rounded-md text-sm outline-none font-bold transition-all duration-200 ${isDuplicateCV
                          ? 'border-2 border-red-500 dark:border-red-400 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 focus:ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                          : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-amber-50 dark:bg-amber-900/10 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
                          }`}
                        value={headerData.cv_no}
                        onChange={(e) => {
                          const onlyNums = e.target.value.replace(/[^0-9-]/g, '');
                          handleHeaderChange({ target: { name: 'cv_no', value: onlyNums } });
                        }}
                      />
                      {isDuplicateCV && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1 animate-in slide-in-from-top-1">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> This CV# is already in use!
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Particulars (Description) <span className="text-red-500">*</span></label>
                      <input type="text" name="particulars" placeholder="Details..." className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                        value={headerData.particulars} onChange={handleHeaderChange} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">TIN</label>
                      <input type="text" name="tin" placeholder="000-000-000-000" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                        value={headerData.tin} onChange={handleHeaderChange} />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs font-semibold flex items-center justify-between ${isStockAllocationMode ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                        <span>OR / INV # <span className="text-blue-500 font-bold">* (At least one)</span></span>
                      </label>
                      <input type="text" name="or_inv_no" placeholder="Receipt No."
                        className={`w-full p-2 rounded-md text-sm outline-none font-bold transition-all duration-200 ${isDuplicateOR
                          ? 'border-2 border-red-500 dark:border-red-400 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 focus:ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                          : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
                          }`}
                        value={headerData.or_inv_no}
                        onChange={handleHeaderChange}
                      />
                      {isDuplicateOR && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1 animate-in slide-in-from-top-1">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> This OR/INV# is already in use!
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bank</label>
                      <input type="text" name="bank" placeholder="Optional" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                        value={headerData.bank} onChange={handleHeaderChange} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Check No.</label>
                      <input type="text" name="check_no" placeholder="Optional" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                        value={headerData.check_no} onChange={handleHeaderChange} />
                    </div>

                    <div className={`space-y-1 p-2 -mt-2 -mb-2 rounded-md border flex flex-col justify-center shadow-inner transition-colors duration-300 ${isStockAllocationMode
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
                      }`}>
                      <label className={`text-xs font-bold uppercase flex items-center justify-between ${isStockAllocationMode ? 'text-emerald-800 dark:text-emerald-300' : 'text-blue-800 dark:text-blue-300'
                        }`}>
                        <span>Target CIB/COH (₱) <span className="text-red-500">*</span></span>
                        {isStockAllocationMode && (
                          <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">LOCKED</span>
                        )}
                      </label>
                      <input type="text" name="target_cib" placeholder="0.00"
                        readOnly={isStockAllocationMode}
                        className={`w-full p-1.5 border rounded-md text-sm focus:ring-2 outline-none font-black transition-colors ${isStockAllocationMode
                          ? 'border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 bg-emerald-50 dark:bg-emerald-950/50 focus:ring-emerald-400 cursor-not-allowed'
                          : 'border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 focus:ring-blue-500'
                          }`}
                        value={headerData.target_cib} onChange={(e) => {
                          if (isStockAllocationMode) return;
                          let val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                          if (val) {
                            const p2 = val.split('.');
                            p2[0] = p2[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                            val = p2.join('.');
                          }
                          handleHeaderChange({ target: { name: 'target_cib', value: val } });
                        }} required />
                    </div>

                    <div className="space-y-1 md:col-span-1 flex items-end pb-1">
                      <button type="button" onClick={() => setShowTaxFields(!showTaxFields)} className="text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline flex items-center gap-1 whitespace-nowrap">
                        {showTaxFields ? 'Hide Tax/Payables Fields' : 'Show Advanced Fields (Accts Pay, BIR-VAT, etc.)'} <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {showTaxFields && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg transition-colors duration-300">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Accts Pay</label>
                        <input type="number" step="0.01" name="accts_pay" placeholder="0.00" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                          value={headerData.accts_pay} onChange={handleHeaderChange} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Input Tax (Vat Input)</label>
                        <input type="number" step="0.01" name="input_tax" placeholder="0.00" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                          value={headerData.input_tax} onChange={handleHeaderChange} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Output Tax</label>
                        <input type="number" step="0.01" name="output_tax" placeholder="0.00" className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                          value={headerData.output_tax} onChange={handleHeaderChange} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className={`lg:col-span-2 space-y-6 transition-all duration-300 ${targetCib <= 0 ? 'opacity-40 pointer-events-none grayscale-[50%]' : ''}`}>

                    {/* 2. COST BREAKDOWN */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                      <div className="flex items-start justify-between pb-2 border-b border-slate-100 dark:border-slate-700 mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            2. Cost Breakdown <span className="text-red-500">*</span>
                          </h3>
                          {Array.isArray(headerData.project_code) && headerData.project_code.filter(Boolean).length > 1 && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                              You can now create multiple costing groups — each can assign to all/specific projects only.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {costingGroups.map((group, groupIndex) => {
                          const selectedProjects = Array.isArray(headerData.project_code)
                            ? headerData.project_code.filter(Boolean)
                            : (typeof headerData.project_code === 'string' ? headerData.project_code.split(',').filter(Boolean) : []);

                          // Scoped per-group: only disable categories already selected within THIS group
                          const usedMainCategories = group.constructionLines.map(item => item.category).filter(Boolean);
                          const usedMiscCategories = group.miscLines.map(item => item.category).filter(Boolean);

                          return (
                            <div key={group.id} className="border-2 border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-2">
                              {/* Group Header with Target Selector */}
                              <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700/60 dark:to-slate-700/30 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-600">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-md">
                                    Group {groupIndex + 1}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">→ Apply costs to:</span>
                                    <TargetProjectDropdown
                                      value={group.targetProject}
                                      onChange={(val) => updateGroupTarget(group.id, val)}
                                      disabled={selectedProjects.length <= 1}
                                      selectedProjects={selectedProjects}
                                    />
                                  </div>
                                  {group.targetProject !== 'all' && (
                                    <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      Specific Project
                                    </span>
                                  )}
                                </div>
                                {costingGroups.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeCostingGroup(group.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors shrink-0"
                                    title="Remove this costing group"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>

                              <div className="p-4 space-y-4 bg-white dark:bg-slate-800/50">
                                {/* Cost Monitoring Breakdown */}
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                      Main Categories Breakdown {groupIndex === 0 && <span className="text-red-500">*</span>}
                                    </h3>
                                    <button type="button" onClick={() => addLine(group.id, 'construction')} disabled={targetCib <= 0 || isAddingLine}
                                      className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors disabled:opacity-50 min-w-[100px] justify-center">
                                      {isAddingLine ? <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></span> Adding...</span> : <><Plus size={13} /> Add Line Item</>}
                                    </button>
                                  </div>
                                  <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                    {group.constructionLines.map((line, index) => (
                                      <div key={line.id} className="flex gap-2 items-start animate-in slide-in-from-top-2">
                                        <div className="w-7 h-8 mt-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 shrink-0">
                                          {index + 1}
                                        </div>
                                        <div className="flex-1">
                                          <SearchableDropdown
                                            options={mainCategoriesList}
                                            value={line.category}
                                            onChange={(val) => handleLineChange(group.id, line.id, 'category', val, 'construction')}
                                            placeholder="-- Find Construction Category --"
                                            hasError={lineErrors.includes(line.id)}
                                            disabledOptions={usedMainCategories}
                                          />
                                        </div>
                                        <div className="w-36 relative mt-1">
                                          <span className="absolute left-2.5 top-2 text-slate-400 dark:text-slate-500 text-sm font-medium">₱</span>
                                          <input type="text" placeholder="0.00"
                                            className="w-full pl-7 p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-right text-slate-800 dark:text-white transition-colors"
                                            value={line.amount} onChange={(e) => handleLineChange(group.id, line.id, 'amount', e.target.value, 'construction')} />
                                        </div>
                                        <button type="button" onClick={() => removeLine(group.id, line.id, 'construction')}
                                          disabled={group.constructionLines.length + group.miscLines.length <= 1}
                                          className="p-2 mt-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 pt-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 italic">
                                    * If "Labor /SUBCONTRACTOR" or "LABOR/PAYROLL" is chosen, it will calculate automatically by 2% for the EWT Payable.
                                  </div>
                                </div>

                                {/* Miscellaneous Cost */}
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Miscellaneous Cost</h3>
                                    <button type="button" onClick={() => addLine(group.id, 'misc')} disabled={targetCib <= 0 || isAddingLine}
                                      className="text-xs bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors disabled:opacity-50 min-w-[100px] justify-center border border-teal-100 dark:border-teal-800">
                                      <Plus size={13} /> Add Misc Item
                                    </button>
                                  </div>
                                  <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                    {group.miscLines.length === 0 ? (
                                      <div className="py-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
                                        <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">No miscellaneous cost added.</p>
                                      </div>
                                    ) : group.miscLines.map((line, index) => (
                                      <div key={line.id} className="flex gap-2 items-start animate-in slide-in-from-top-2">
                                        <div className="w-7 h-8 mt-1 bg-teal-50/50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 rounded flex items-center justify-center text-xs font-bold text-teal-600 dark:text-teal-400 shrink-0">
                                          {index + 1}
                                        </div>
                                        <div className="flex-1">
                                          <SearchableDropdown
                                            options={miscCategoriesList}
                                            value={line.category}
                                            onChange={(val) => handleLineChange(group.id, line.id, 'category', val, 'misc')}
                                            placeholder="-- Find Miscellaneous Item --"
                                            hasError={lineErrors.includes(line.id)}
                                            disabledOptions={usedMiscCategories}
                                          />
                                        </div>
                                        <div className="w-36 relative mt-1">
                                          <span className="absolute left-2.5 top-2 text-slate-400 dark:text-slate-500 text-sm font-medium">₱</span>
                                          <input type="text" placeholder="0.00"
                                            className="w-full pl-7 p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-right text-slate-800 dark:text-white transition-colors"
                                            value={line.amount} onChange={(e) => handleLineChange(group.id, line.id, 'amount', e.target.value, 'misc')} />
                                        </div>
                                        <button type="button" onClick={() => removeLine(group.id, line.id, 'misc')}
                                          className="p-2 mt-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add Another Costing Button */}
                        <button
                          type="button"
                          onClick={addCostingGroup}
                          disabled={targetCib <= 0}
                          className="w-full py-3 border-2 border-dashed border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 text-blue-500 dark:text-blue-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus size={15} /> Add Another Costing
                        </button>
                      </div>
                    </div>

                    {!isStockAllocationMode && (
                      <>
                        {/* STOCKS OPT-IN CHECKBOX */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors duration-300">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="add-stocks-checkbox"
                              className="w-4.5 h-4.5 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer"
                              checked={isAddStocksChecked}
                              onChange={(e) => {
                                setIsAddStocksChecked(e.target.checked);
                                if (!e.target.checked) setStocksAmount('');
                              }}
                            />
                            <label htmlFor="add-stocks-checkbox" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                              Add Stocks
                            </label>
                          </div>
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                            Inventory Link
                          </span>
                        </div>

                        {/* 4. INPUT STOCKS */}
                        {isAddStocksChecked && (
                          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden transition-colors duration-300 animate-in slide-in-from-top-3">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">4. INPUT STOCKS <span className="text-red-500">*</span></h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Stock Amount (₱) <span className="text-red-500">*</span></label>
                                <div className="relative w-full">
                                  <span className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 text-sm font-medium">₱</span>
                                  <input
                                    type="text"
                                    placeholder="0.00"
                                    className="w-full pl-7 p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                                    value={stocksAmount}
                                    onChange={(e) => {
                                      let val = e.target.value.replace(/[^0-9.]/g, '');
                                      const parts = val.split('.');
                                      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                                      if (val) {
                                        const p2 = val.split('.');
                                        p2[0] = p2[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                                        val = p2.join('.');
                                      }
                                      setStocksAmount(val);
                                    }}
                                    required
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Stock Description / Item Name <span className="text-red-500">*</span></label>
                                <input
                                  type="text"
                                  placeholder="e.g., Cement, Rebars..."
                                  className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors uppercase"
                                  value={stockDescription}
                                  onChange={(e) => setStockDescription(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ==========================================
                        ATTACHMENTS SECTION
                    ========================================== */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                        <Paperclip size={16} className="text-blue-500" /> Attachments <span className="text-slate-400 font-medium normal-case tracking-normal text-xs">(OR, Invoice, Photos)</span>
                      </h3>

                      {uploadError && (
                        <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold flex items-center gap-2">
                          <X size={13} /> {uploadError}
                        </div>
                      )}

                      {/* Upload Buttons */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        {/* Hidden inputs */}
                        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setUploadError('');
                            if (file.size > 20 * 1024 * 1024) { setUploadError('File too large. Max 20MB.'); return; }
                            if (!editingId) {
                              // For new records, we queue the file locally and upload after save
                              const objectUrl = URL.createObjectURL(file);
                              setModalAttachments(prev => [...prev, { filename: objectUrl, originalname: file.name, mimetype: file.type, size: file.size, uploadedAt: new Date().toISOString(), pendingFile: file }]);
                            } else {
                              setIsUploadingFile(true);
                              try {
                                const formData = new FormData();
                                formData.append('receipt', file);
                                const token = sessionStorage.getItem('fbtmcc_token');
                                const res = await fetch(`${API_URL}/disbursements/${editingId}/upload`, {
                                  method: 'POST',
                                  headers: { Authorization: `Bearer ${token}` },
                                  body: formData
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setModalAttachments(prev => [...prev, data.file]);
                                } else {
                                  setUploadError(data.error || 'Upload failed.');
                                }
                              } catch { setUploadError('Upload failed. Check server connection.'); }
                              finally { setIsUploadingFile(false); }
                            }
                            e.target.value = '';
                          }}
                        />
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setUploadError('');
                            if (!editingId) {
                              const objectUrl = URL.createObjectURL(file);
                              setModalAttachments(prev => [...prev, { filename: objectUrl, originalname: file.name, mimetype: file.type, size: file.size, uploadedAt: new Date().toISOString(), pendingFile: file }]);
                            } else {
                              setIsUploadingFile(true);
                              try {
                                const formData = new FormData();
                                formData.append('receipt', file);
                                const token = sessionStorage.getItem('fbtmcc_token');
                                const res = await fetch(`${API_URL}/disbursements/${editingId}/upload`, {
                                  method: 'POST',
                                  headers: { Authorization: `Bearer ${token}` },
                                  body: formData
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setModalAttachments(prev => [...prev, data.file]);
                                } else {
                                  setUploadError(data.error || 'Upload failed.');
                                }
                              } catch { setUploadError('Upload failed.'); }
                              finally { setIsUploadingFile(false); }
                            }
                            e.target.value = '';
                          }}
                        />

                        <button type="button" onClick={() => cameraInputRef.current?.click()}
                          disabled={isUploadingFile}
                          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-bold text-sm transition-colors disabled:opacity-50">
                          <Camera size={16} /> Take Photo
                        </button>
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingFile}
                          className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 rounded-xl font-bold text-sm transition-colors disabled:opacity-50">
                          {isUploadingFile ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                          {isUploadingFile ? 'Uploading...' : 'Upload File'}
                        </button>
                      </div>

                      {/* Attachment List */}
                      {modalAttachments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-300 dark:text-slate-600 gap-2">
                          <Paperclip size={28} />
                          <p className="text-xs font-bold text-slate-400 dark:text-slate-500">No attachments yet. Use the buttons above.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {modalAttachments.map((att, idx) => {
                            const isImage = att.mimetype && att.mimetype.startsWith('image/');
                            const isPending = !!att.pendingFile;
                            const fileUrl = isPending ? att.filename : `${API_URL.replace('/api', '')}/uploads/${att.filename}`;
                            return (
                              <div key={idx} className="relative group bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden shadow-sm">
                                {isImage ? (
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                                    <img src={fileUrl} alt={att.originalname} className="w-full h-24 object-cover" />
                                  </a>
                                ) : (
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-24 text-slate-400 dark:text-slate-300 hover:text-blue-500 transition-colors">
                                    <FileType size={32} className="mb-1" />
                                    <span className="text-[10px] font-bold">PDF</span>
                                  </a>
                                )}
                                <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate flex-1" title={att.originalname}>{att.originalname}</p>
                                  <button type="button"
                                    onClick={async () => {
                                      if (isPending) {
                                        setModalAttachments(prev => prev.filter((_, i) => i !== idx));
                                        return;
                                      }
                                      if (!editingId) { setModalAttachments(prev => prev.filter((_, i) => i !== idx)); return; }
                                      try {
                                        const token = sessionStorage.getItem('fbtmcc_token');
                                        await fetch(`${API_URL}/disbursements/${editingId}/attachments/${att.filename}`, {
                                          method: 'DELETE',
                                          headers: { Authorization: `Bearer ${token}` }
                                        });
                                        setModalAttachments(prev => prev.filter(a => a.filename !== att.filename));
                                      } catch { setUploadError('Failed to delete attachment.'); }
                                    }}
                                    className="p-0.5 text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0">
                                    <X size={13} />
                                  </button>
                                </div>
                                {isPending && <div className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">PENDING</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-800 dark:bg-slate-950 text-white p-6 rounded-xl shadow-md flex flex-col justify-between h-fit lg:sticky lg:top-0 transition-colors duration-300 border border-transparent dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 dark:border-slate-800">5. Accounting Summary</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-slate-300 dark:text-slate-400 text-sm">
                          <span>Total of Debit (Net Exp.)</span>
                          <span className="font-mono text-white">₱ {totals.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-400 dark:text-emerald-500 text-sm">
                          <span>Add: EWT</span>
                          <span className="font-mono">+ ₱ {totals.ewtPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        {isAddStocksChecked && (
                          <div className="flex justify-between items-center text-blue-300 dark:text-blue-400 text-sm">
                            <span>Add: Stocks Amount</span>
                            <span className="font-mono text-white">+ ₱ {parseFloat(String(stocksAmount).replace(/,/g, '')) ? parseFloat(String(stocksAmount).replace(/,/g, '')).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</span>
                          </div>
                        )}
                        {headerData.input_tax && (
                          <div className="flex justify-between items-center text-slate-400 dark:text-slate-500 text-xs">
                            <span>Input Tax</span>
                            <span className="font-mono text-slate-300">₱ {parseFloat(headerData.input_tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-700 dark:border-slate-800">
                      <div className="flex justify-between items-end mb-3">
                        <div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-1">Target CIB (From Receipt)</div>
                          <div className="text-lg font-bold text-slate-300 dark:text-white">₱ {targetCib.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-blue-300 dark:text-blue-400 font-semibold uppercase tracking-wider mb-1">Computed CIB/COH</div>
                          <div className="text-2xl font-black text-blue-400 dark:text-blue-500 tracking-tight">
                            ₱ {totals.cib_coh.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const remaining = targetCib - totals.cib_coh;
                        const isPartialAllocation = isStockAllocationMode && totals.cib_coh > 0 && remaining >= 0 && !isVarianceZero;
                        const blockColor = isVarianceZero
                          ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-900/20 dark:border-emerald-800'
                          : isPartialAllocation
                            ? 'bg-blue-500/10 border-blue-500/30 dark:bg-blue-900/20 dark:border-blue-800'
                            : 'bg-red-500/10 border-red-500/30 dark:bg-red-900/20 dark:border-red-800';
                        const textColor = isVarianceZero
                          ? 'text-emerald-400 dark:text-emerald-500'
                          : isPartialAllocation
                            ? 'text-blue-400 dark:text-blue-400'
                            : 'text-red-400 dark:text-red-500';
                        const label = isVarianceZero ? '✓ Balance' : isPartialAllocation ? '📦 Remaining Stock' : '⚠️ Variance (Short/Over)';
                        return (
                          <div className={`p-3 rounded-lg flex items-center justify-between mb-4 border transition-colors ${blockColor}`}>
                            <span className={`text-xs font-bold uppercase ${textColor}`}>{label}</span>
                            <span className={`font-mono font-bold ${textColor}`}>
                              {remaining > 0 ? '+' : ''}{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })()}

                      <div className="flex flex-col gap-2">
                        <button
                          type="submit"
                          onClick={handleSubmit}
                          disabled={isDuplicateCV || (isStockAllocationMode ? (totals.cib_coh <= 0 || totals.cib_coh > targetCib) : !isVarianceZero) || targetCib === 0 || isSaving || selectedTransactionFilter === 'EWT'}
                          className={`w-full text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${(isDuplicateCV || (isStockAllocationMode ? (totals.cib_coh <= 0 || totals.cib_coh > targetCib) : !isVarianceZero) || targetCib === 0 || isSaving || selectedTransactionFilter === 'EWT')
                            ? 'bg-slate-500 dark:bg-slate-700 cursor-not-allowed opacity-50 shadow-none'
                            : 'bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 shadow-blue-900/20 dark:shadow-none'
                            }`}
                        >
                          <Save size={18} /> {selectedTransactionFilter === 'EWT' ? 'View Only (Filtered)' : (isSaving ? 'Saving...' : (editingId ? 'Update Disbursement' : 'Post Disbursement'))}
                        </button>
                        <span className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest hidden md:block">
                          You can also use <kbd className="px-1.5 py-0.5 bg-slate-700 dark:bg-slate-800 rounded text-slate-300 dark:text-slate-400 border border-slate-600 dark:border-slate-700">CTRL + Enter</kbd>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <PasswordConfirmModal
        isOpen={passwordModal.isOpen}
        actionType={passwordModal.action}
        onClose={() => setPasswordModal({ isOpen: false, action: null, payload: null })}
        onConfirm={handlePasswordConfirm}
      />

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

      {showStockWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 zoom-in-95 animate-in flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full text-amber-600 dark:text-amber-400 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white">Pure Stock Entry Warning</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Submitting a pure stock entry will invalidate and clear the Project Code, Payee, Particulars, and other voucher details. Only the CV # / OR / INV # and Stock Details will be saved.
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setShowStockWarning(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowStockWarning(false);
                  proceedWithSubmission(true);
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200 dark:shadow-none transition-all"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {(isSaving || isLoading) && (
        <LoadingOverlay
          message={isSaving ? "Saving Entry" : "Refreshing Data"}
          subtext={isSaving ? "Please wait a moment..." : "Syncing your ledger..."}
        />
      )}
    </div>
  );
}