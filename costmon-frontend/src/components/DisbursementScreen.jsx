import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, FileText, ChevronDown, Filter, X, Lock, Save, Receipt, Edit2, ZoomIn, ZoomOut, RotateCcw, CheckCircle2, Paperclip, Camera, FileImage, FileType, Loader2, ExternalLink } from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';
import HealthCard from './HealthCard';
import PasswordConfirmModal from './PasswordConfirmModal';
import LoadingOverlay from './LoadingOverlay';
import UnsavedChangesModal from './UnsavedChangesModal';
import DraftFoundModal from './DraftFoundModal';
import { API_URL } from '../utils/Constants';

export default function DisbursementScreen({ projects, categories, categoryObjects, disbursements, refreshData, isLoading, userRole, initialSearchQuery, initialDisbursementId, onClearInitialDisbursement, onModalStateChange }) {
  const canEdit = userRole === 'encoder';

  // ==========================================
  // 1. STATES & REFS
  // ==========================================
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postSavePrompt, setPostSavePrompt] = useState(false);
  const [editingId, setEditingId] = useState(null);
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

  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });
  const [isAddingLine, setIsAddingLine] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(['All']);
  const [tempSelectedMonths, setTempSelectedMonths] = useState(['All']);
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

  const [constructionLines, setConstructionLines] = useState([{ id: 1, category: '', amount: '' }]);
  const [miscLines, setMiscLines] = useState([{ id: 2, category: '', amount: '' }]);

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

  const availableMonths = useMemo(() => {
    const months = disbursements.map(d => d.date && d.date.substring(0, 7)).filter(Boolean);
    return [...new Set(months)].sort((a, b) => b.localeCompare(a));
  }, [disbursements]);

  const filteredDisbursements = useMemo(() => {
    // HARD FILTER: Remove anything marked as 'additional' so they NEVER show up here
    let result = disbursements.filter(d => d.costing_type !== 'additional');

    if (!selectedMonths.includes('All')) {
      result = result.filter(d => selectedMonths.some(m => d.date && d.date.startsWith(m)));
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(d => d.cv_no && d.cv_no.toLowerCase().includes(query));
    }

    // Sort by project_code: Z-A for prefix, ascending for number
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
  }, [disbursements, selectedMonths, searchQuery]);

  const formatMonth = (monthString) => {
    if (monthString === 'All') return 'Lahat ng Buwan (All)';
    const [year, month] = monthString.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const activeMonthDisplay = selectedMonths.includes('All')
    ? 'FOR ALL MONTHS'
    : selectedMonths.map(formatMonth).join(', ');

  const handleToggleMonth = (month) => {
    if (month === 'All') {
      setTempSelectedMonths(['All']);
    } else {
      let updated = tempSelectedMonths.filter(m => m !== 'All');
      if (updated.includes(month)) {
        updated = updated.filter(m => m !== month);
      } else {
        updated.push(month);
      }
      if (updated.length === 0) updated = ['All'];
      setTempSelectedMonths(updated);
    }
  };

  const applyFilter = () => {
    setSelectedMonths(tempSelectedMonths);
    setIsFilterOpen(false);
  };

  const ledgerTotals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    let ewt = 0;
    let cib = 0;

    filteredDisbursements.forEach(d => {
      const inputTax = parseFloat(d.input_tax) || 0;
      const outputTax = parseFloat(d.output_tax) || 0;
      const acctsPay = parseFloat(d.accts_pay) || 0;

      const currentDr = (parseFloat(d.gross_amount) || 0) + inputTax;
      const currentCr = (parseFloat(d.net_amount) || 0) + (parseFloat(d.ewt_amount) || 0) + acctsPay + outputTax;

      dr += currentDr;
      cr += currentCr;
      ewt += (parseFloat(d.ewt_amount) || 0);
      cib += (parseFloat(d.net_amount) || 0);
    });

    return { dr, cr, diff: dr - cr, ewt, cib };
  }, [filteredDisbursements]);

  // ==========================================
  // 3. CATEGORY SPLITTING & COMPUTATIONS
  // ==========================================
  const { mainCategoriesList, miscCategoriesList } = useMemo(() => {
    const main = [];
    const misc = [];
    const foundMains = new Set();
    const DEFAULT_MAIN_VALS = [
      { raw: "PERMITS & CONSTRUCTION PLANS", clean: "PERMITS & CONSTRUCTION PLANS" },
      { raw: "DOWN PAYMENT", clean: "DOWN PAYMENT" },
      { raw: "CARPENTRY", clean: "CARPENTRY" },
      { raw: "PAINTING", clean: "PAINTING" },
      { raw: "ELECTRICAL", clean: "ELECTRICAL" },
      { raw: "PLUMBING", clean: "PLUMBING" },
      { raw: "TEMPERED GLASS", clean: "TEMPERED GLASS" },
      { raw: "SSS/PAG-IBIG / PHILHEALTH", clean: "SSS/PAG-IBIG / PHILHEALTH" },
      { raw: "LABOR/PAYROLL", clean: "LABOR/PAYROLL" },
      { raw: "ABB 1196 FORWARD", clean: "ABB 1196 FORWARD" },
      { raw: "ZAM-546", clean: "ZAM-546" }
    ];

    const selectedProject = projects.find(p => p.project_code === headerData.project_code);
    const pType = selectedProject ? selectedProject.project_type : 'Construction';

    (categoryObjects || []).forEach(catObj => {
      if (catObj.category_type && catObj.category_type !== 'Both' && catObj.category_type !== pType) {
        return;
      }

      const rawName = catObj.name;
      const upperName = rawName.toUpperCase();
      const cleanUpper = upperName.replace(/\(-+PHP\)/gi, '').trim();

      if (rawName.startsWith('[MAIN] ')) {
        main.push(rawName.replace('[MAIN] ', ''));
      } else if (rawName.startsWith('[MISC] ')) {
        misc.push(rawName.replace('[MISC] ', ''));
      } else {
        const matchedMain = DEFAULT_MAIN_VALS.find(m => cleanUpper === m.clean || upperName.includes(m.clean));
        if (matchedMain) {
          foundMains.add(matchedMain.raw);
          main.push(rawName);
        } else {
          misc.push(rawName);
        }
      }
    });

    if (pType === 'Construction' || !pType) {
      DEFAULT_MAIN_VALS.forEach(m => {
        if (!foundMains.has(m.raw) && !main.includes(m.raw)) {
          main.push(m.raw);
        }
      });
    }

    return {
      mainCategoriesList: [...new Set(main)].sort((a, b) => a.localeCompare(b)),
      miscCategoriesList: [...new Set(misc)].sort((a, b) => a.localeCompare(b))
    };
  }, [categoryObjects, headerData.project_code, projects]);

  const totals = useMemo(() => {
    let totalDebit = 0;
    let ewtPayable = 0;
    const allLines = [...constructionLines, ...miscLines];

    allLines.forEach(line => {
      const amt = parseFloat(String(line.amount).replace(/,/g, '')) || 0;
      totalDebit += amt;
      if (line.category === 'Labor /SUBCONTRACTOR') ewtPayable += (amt * 0.02);
    });

    const cib_coh = totalDebit - ewtPayable;
    return { totalDebit, ewtPayable, cib_coh };
  }, [constructionLines, miscLines]);

  const targetCib = parseFloat(String(headerData.target_cib).replace(/,/g, '')) || 0;
  const isVarianceZero = Math.abs(targetCib - totals.cib_coh) < 0.01;

  const isDuplicateCV = useMemo(() => {
    if (!headerData.cv_no) return false;
    return disbursements.some(
      (d) => d.id !== editingId && d.cv_no && d.cv_no.trim().toLowerCase() === headerData.cv_no.trim().toLowerCase()
    );
  }, [headerData.cv_no, disbursements, editingId]);

  // ==========================================
  // 4. HANDLERS
  // ==========================================
  const resetForm = () => {
    setHeaderData({ date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', bank: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'normal' });
    const now = Date.now();
    setConstructionLines([{ id: now, category: '', amount: '' }]);
    setMiscLines([{ id: now + 1, category: '', amount: '' }]);
    setShowTaxFields(false);
    setErrorMessage('');
    setLineErrors([]);
    setEditingId(null);
  };

  const closeAndResetModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const checkUnsavedChanges = () => {
    if (!initialFormState) return false;
    const currentLines = [...constructionLines, ...miscLines];
    return JSON.stringify(headerData) !== initialFormState.headerData ||
      JSON.stringify(currentLines) !== initialFormState.expenseLines;
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
    const initHeader = { date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', bank: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'normal' };
    const initC = [{ id: Date.now(), category: '', amount: '' }];
    const initM = [{ id: Date.now() + 1, category: '', amount: '' }];
    setInitialFormState({
      headerData: JSON.stringify(initHeader),
      expenseLines: JSON.stringify([...initC, ...initM])
    });
  };

  const handleCloseModalAfterSave = () => {
    setPostSavePrompt(false);
    closeAndResetModal();
  };

  const handleHeaderChange = (e) => setHeaderData({ ...headerData, [e.target.name]: e.target.value });

  const handleLineChange = (id, field, value, type = 'construction') => {
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
    const setter = type === 'construction' ? setConstructionLines : setMiscLines;
    setter(lines => lines.map(line => line.id === id ? { ...line, [field]: finalValue } : line));
    if (field === 'category' && finalValue.trim() !== '') {
      setLineErrors(errors => errors.filter(errId => errId !== id));
    }
  };

  const addLine = (type = 'construction') => {
    if (isAddingLine) return;
    setIsAddingLine(true);
    const setter = type === 'construction' ? setConstructionLines : setMiscLines;
    setter(prev => {
      const allLines = [...constructionLines, ...miscLines];
      const maxId = allLines.length > 0 ? Math.max(...allLines.map(line => typeof line.id === 'number' ? line.id : 0)) : 0;
      return [...prev, { id: maxId + 1, category: '', amount: '' }];
    });
    setTimeout(() => setIsAddingLine(false), 300);
  };

  const removeLine = (id, type = 'construction') => {
    const setter = type === 'construction' ? setConstructionLines : setMiscLines;
    if (type === 'construction' && constructionLines.length === 1 && miscLines.length === 0) return;
    setter(prev => prev.filter(line => line.id !== id));
  };

  const handleSaveDraft = () => {
    localStorage.setItem('disbursement_draft', JSON.stringify({
      headerData,
      constructionLines,
      miscLines,
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
      setConstructionLines(draft.constructionLines || []);
      setMiscLines(draft.miscLines || []);

      if (draft.headerData.accts_pay || draft.headerData.input_tax || draft.headerData.output_tax) {
        setShowTaxFields(true);
      } else {
        setShowTaxFields(false);
      }
      setEditingId(draft.editingId || null);
      setInitialFormState({
        headerData: JSON.stringify(draft.headerData),
        expenseLines: JSON.stringify([...(draft.constructionLines || []), ...(draft.miscLines || [])])
      });
      setShowDraftModal(false);
      setIsModalOpen(true);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('disbursement_draft');
    setShowDraftModal(false);
    resetForm();

    const initHeader = { date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', bank: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'normal' };
    const initC = [{ id: Date.now(), category: '', amount: '' }];
    const initM = [{ id: Date.now() + 1, category: '', amount: '' }];
    setHeaderData(initHeader);
    setConstructionLines(initC);
    setMiscLines(initM);
    setInitialFormState({
      headerData: JSON.stringify(initHeader),
      expenseLines: JSON.stringify([...initC, ...initM])
    });

    setIsModalOpen(true);
  };

  const handleNewDisbursement = () => {
    const hasDraft = localStorage.getItem('disbursement_draft') !== null;
    if (hasDraft) {
      setShowDraftModal(true);
    } else {
      resetForm();
      const initHeader = { date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', bank: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '', costing_type: 'normal' };
      const initC = [{ id: Date.now(), category: '', amount: '' }];
      const initM = [{ id: Date.now() + 1, category: '', amount: '' }];
      setHeaderData(initHeader);
      setConstructionLines(initC);
      setMiscLines(initM);
      setInitialFormState({
        headerData: JSON.stringify(initHeader),
        expenseLines: JSON.stringify([...initC, ...initM])
      });
      setIsModalOpen(true);
    }
  };

  const handleEditRow = (d) => {
    if (!canEdit) return;
    setEditingId(d.id);
    const newHeader = {
      date: d.date || '',
      project_code: d.project_code || '',
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
    const selectedProject = projects.find(p => p.project_code === d.project_code);
    const pType = selectedProject ? selectedProject.project_type : 'Construction';

    const DEFAULT_MAIN_KEYWORDS = [
      "PERMITS & CONSTRUCTION PLANS", "DOWN PAYMENT", "CARPENTRY", "PAINTING",
      "ELECTRICAL", "PLUMBING", "TEMPERED GLASS", "SSS/PAG-IBIG / PHILHEALTH",
      "LABOR/PAYROLL", "ABB 1196 FORWARD", "ZAM-546"
    ];

    // Build the correct main list for this project, same logic as the useMemo
    const inlineMain = new Set();
    (categoryObjects || []).forEach(catObj => {
      if (catObj.category_type && catObj.category_type !== 'Both' && catObj.category_type !== pType) return;
      const rawName = catObj.name;
      if (rawName.startsWith('[MAIN] ')) {
        inlineMain.add(rawName.replace('[MAIN] ', ''));
      }
    });
    if (pType === 'Construction' || !pType) {
      DEFAULT_MAIN_KEYWORDS.forEach(k => inlineMain.add(k));
    }

    const expensesWithCommas = loadedExpenses.map(e => ({ ...e, amount: e.amount ? String(e.amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '' }));
    expensesWithCommas.forEach(exp => {
      if (inlineMain.has(exp.category)) {
        cLines.push(exp);
      } else {
        mLines.push(exp);
      }
    });

    if (cLines.length === 0) cLines.push({ id: Date.now(), category: '', amount: '' });
    if (mLines.length === 0) mLines.push({ id: Date.now() + 1, category: '', amount: '' });

    setConstructionLines(cLines);
    setMiscLines(mLines);
    setModalAttachments(d.attachments || []);

    if (d.accts_pay || d.input_tax || d.output_tax) {
      setShowTaxFields(true);
    } else {
      setShowTaxFields(false);
    }

    setInitialFormState({
      headerData: JSON.stringify(newHeader),
      expenseLines: JSON.stringify(expensesWithCommas)
    });

    setErrorMessage('');
    setIsModalOpen(true);
  };

  const executeSave = async (disbursementData) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('fbtmcc_token');
      const url = editingId ? `${API_URL}/disbursements/${editingId}` : `${API_URL}/disbursements`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(disbursementData)
      });

      if (response.ok) {
        await refreshData();
        setPostSavePrompt(true);
      } else {
        const errData = await response.json();
        setErrorMessage("Server Error: " + (errData.error || "Hindi ma-save ang data."));
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Network Error: Hindi makonekta sa Local Server.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage('');

    if (!headerData.project_code || !canEdit || totals.totalDebit === 0) return;
    if (!headerData.cv_no) { setErrorMessage("Kailangan ilagay ang CV#."); return; }
    if (isDuplicateCV) { setErrorMessage("May kaparehas na CV#! Paki-palitan bago i-save."); return; }
    if (!isVarianceZero) { setErrorMessage("Hindi pwedeng i-save! Paki-check ang Variance. Kailangang pantay ang Target CIB sa Computed CIB."); return; }

    const combinedLines = [...constructionLines, ...miscLines].filter(
      line => (line.category && line.category.trim() !== '') || (line.amount && line.amount !== '')
    ).map(line => ({
      ...line,
      amount: line.amount ? String(line.amount).replace(/,/g, '') : '',
      id: line.id || Date.now() + Math.random()
    }));

    if (combinedLines.length === 0) {
      setErrorMessage("Kailangan maglagay ng kahit isang expense item.");
      return;
    }

    const invalidLines = combinedLines.filter(line => !line.category || line.category.trim() === '');
    if (invalidLines.length > 0) {
      const errorIds = invalidLines.map(line => line.id);
      setLineErrors(errorIds);
      setErrorMessage("Paki-pili ang kategorya para sa lahat ng nilagyan ng amount.");
      return;
    }

    const newDisbursement = {
      id: editingId || Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(),
      ...headerData,
      target_cib: String(headerData.target_cib).replace(/,/g, ''),
      expenses: combinedLines,
      attachments: modalAttachments,
      gross_amount: totals.totalDebit,
      ewt_amount: totals.ewtPayable,
      net_amount: totals.cib_coh,
      created_at: editingId ? disbursements.find(d => d.id === editingId).created_at : new Date().toISOString()
    };

    if (editingId) {
      setPasswordModal({ isOpen: true, action: 'update', payload: newDisbursement });
    } else {
      executeSave(newDisbursement);
    }
  };

  const handleDeleteClick = (id) => {
    if (!canEdit) return;
    setPasswordModal({ isOpen: true, action: 'delete', payload: id });
  };

  const executeDelete = async (id) => {
    try {
      const token = localStorage.getItem('fbtmcc_token');
      const response = await fetch(`${API_URL}/disbursements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        await refreshData();
      } else {
        alert("Failed to delete disbursement.");
      }
    } catch (error) {
      console.error(error);
      alert("Network Error");
    }
  };

  const handlePasswordConfirm = () => {
    if (passwordModal.action === 'update') {
      executeSave(passwordModal.payload);
    } else if (passwordModal.action === 'delete') {
      executeDelete(passwordModal.payload);
    }
    setPasswordModal({ isOpen: false, action: null, payload: null });
  };

  const getCategoryAmount = (disbursement, catName) => {
    if (!disbursement.expenses) return null;
    const exp = disbursement.expenses.find(e => e.category === catName);
    return exp && parseFloat(exp.amount) ? parseFloat(exp.amount) : null;
  };

  // ==========================================
  // 5. USE EFFECTS (Listeners & Auto-Opens)
  // ==========================================

  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(isModalOpen || showUnsavedModal || showDraftModal || passwordModal.isOpen || postSavePrompt);
    }
  }, [isModalOpen, showUnsavedModal, showDraftModal, passwordModal.isOpen, postSavePrompt, onModalStateChange]);

  useEffect(() => {
    if (initialDisbursementId && disbursements.length > 0) {
      const disbursement = disbursements.find(d => d.id === initialDisbursementId);
      if (disbursement) {
        const timer = setTimeout(() => {
          handleEditRow(disbursement);
          if (onClearInitialDisbursement) onClearInitialDisbursement();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDisbursementId, disbursements]);

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

        const isDup = disbursements.some((d) => d.id !== editingId && d.cv_no && d.cv_no.trim().toLowerCase() === headerData.cv_no.trim().toLowerCase());
        const tCib = parseFloat(headerData.target_cib) || 0;
        const isVarZero = Math.abs(tCib - totals.cib_coh) < 0.01;

        if (!isDup && isVarZero && tCib > 0 && !isSaving && canEdit && headerData.project_code && headerData.cv_no) {
          const fakeEvent = { preventDefault: () => { } };
          handleSubmit(fakeEvent);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, isFilterOpen, showUnsavedModal, showDraftModal, postSavePrompt, headerData, constructionLines, miscLines, initialFormState, isSaving, totals, disbursements, editingId, canEdit]);


  // ==========================================
  // RENDER UI
  // ==========================================
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
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">{activeMonthDisplay}</p>
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
            title="Current Variance"
            amount={ledgerTotals.diff}
            colorClass={ledgerTotals.diff === 0 ? "bg-emerald-500" : "bg-rose-500"}
            textClass={ledgerTotals.diff === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
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
                  placeholder="Search CV No..."
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-slate-800 dark:text-white transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => {
                    setTempSelectedMonths(selectedMonths);
                    setIsFilterOpen(!isFilterOpen);
                  }}
                  className="flex items-center gap-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-xl font-bold transition-all shadow-sm"
                >
                  <Filter size={18} className={selectedMonths.includes('All') ? 'text-slate-400 dark:text-slate-500' : 'text-blue-600 dark:text-blue-400'} />
                  <span>{selectedMonths.includes('All') ? 'All Months' : `${selectedMonths.length} Months`}</span>
                </button>

                {isFilterOpen && (
                  <div className="absolute left-0 mt-3 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                      <span className="font-black text-slate-700 dark:text-slate-300 text-sm tracking-tight uppercase">Select Months</span>
                      <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={18} /></button>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                      <label className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors group">
                        <input
                          type="checkbox"
                          checked={tempSelectedMonths.includes('All')}
                          onChange={() => handleToggleMonth('All')}
                          className="rounded-lg border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer bg-white dark:bg-slate-800"
                        />
                        <span className={`text-sm ${tempSelectedMonths.includes('All') ? 'font-black text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 font-bold'}`}>Show All Data</span>
                      </label>
                      {availableMonths.map(month => (
                        <label key={month} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors group">
                          <input
                            type="checkbox"
                            checked={tempSelectedMonths.includes(month)}
                            onChange={() => handleToggleMonth(month)}
                            className="rounded-lg border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer bg-white dark:bg-slate-800"
                          />
                          <span className={`text-sm ${tempSelectedMonths.includes(month) ? 'font-black text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 font-bold'}`}>{formatMonth(month)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <button
                        onClick={applyFilter}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black transition-all shadow-lg shadow-blue-100 dark:shadow-none"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-center">Project</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-right">Debit (Gross)</th>
                  <th className="px-6 py-5 text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-right bg-emerald-100/50 dark:bg-emerald-900/30">Credit (CIB)</th>
                  <th className="px-6 py-5 text-xs font-black text-rose-800 dark:text-rose-400 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-right bg-rose-50/50 dark:bg-rose-900/30">EWT</th>
                  {categories.map(cat => (
                    <th key={cat} className="px-4 py-5 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest border-b-2 border-r border-slate-400 dark:border-slate-600 text-right min-w-[120px] bg-slate-50 dark:bg-slate-800" title={cat}>
                      {cat}
                    </th>
                  ))}
                  <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-r border-slate-400 dark:border-slate-600 text-center">Particulars</th>
                  {canEdit && <th className="px-6 py-5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-slate-400 dark:border-slate-600 text-center sticky right-0 z-10 bg-slate-100 dark:bg-slate-700 shadow-[-3px_0_0_0_#94a3b8] dark:shadow-[-3px_0_0_0_#475569]">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400 dark:divide-slate-600">
                {filteredDisbursements.length === 0 ? (
                  <tr>
                    <td colSpan={8 + categories.length} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full text-slate-300 dark:text-slate-600">
                          <Receipt size={48} />
                        </div>
                        <p className="text-slate-400 dark:text-slate-500 font-bold text-lg italic">No disbursements found for the selected criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredDisbursements.map(d => (
                  <tr
                    key={d.id}
                    className={`even:bg-slate-50/80 dark:even:bg-slate-800/80 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors group ${canEdit ? 'cursor-pointer' : ''}`}
                    onDoubleClick={() => handleEditRow(d)}
                  >
                    <td className="px-6 py-4 font-black text-slate-600 dark:text-slate-300 sticky left-0 z-10 bg-white dark:bg-slate-900 group-even:bg-slate-50 dark:group-even:bg-slate-800 group-hover:bg-blue-100/50 dark:group-hover:bg-blue-900/30 border-r border-slate-400 dark:border-slate-600 shadow-[3px_0_0_0_#94a3b8] dark:shadow-[3px_0_0_0_#475569] transition-colors duration-300">{d.date}</td>
                    <td className="px-6 py-4 font-black text-slate-800 dark:text-slate-200 border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">{d.payee}</td>
                    <td className="px-6 py-4 font-black text-blue-700 dark:text-blue-400 text-center border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">#{d.cv_no}</td>
                    <td className="px-6 py-4 font-black text-slate-500 dark:text-slate-400 text-center border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">{d.project_code}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-slate-900 dark:text-white border-r border-slate-400 dark:border-slate-600 group-even:bg-slate-50/30 dark:group-even:bg-slate-800/30 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20">₱{(d.gross_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10 border-r border-slate-400 dark:border-slate-600 group-hover:bg-emerald-100/30 dark:group-hover:bg-emerald-900/30">₱{(d.net_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-900/10 border-r border-slate-400 dark:border-slate-600 group-hover:bg-rose-100/20 dark:group-hover:bg-rose-900/30">₱{(d.ewt_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {categories.map(cat => {
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
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(d.id); }} className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 border border-red-100 dark:border-red-800/50 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {filteredDisbursements.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-800 font-black text-slate-800 dark:text-slate-200 border-t-4 border-slate-400 dark:border-slate-600 transition-colors duration-300">
                  <tr>
                    <td colSpan="4" className="px-6 py-6 text-right text-xs tracking-widest text-slate-500 dark:text-slate-400 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 border-r border-slate-400 dark:border-slate-600 shadow-[3px_0_0_0_#94a3b8] dark:shadow-[3px_0_0_0_#475569] transition-colors duration-300">TOTAL SUMMARY:</td>
                    <td className="px-6 py-6 text-right font-mono text-blue-800 dark:text-blue-400 border-r border-slate-400 dark:border-slate-600 text-lg">₱{ledgerTotals.dr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-6 text-right font-mono text-emerald-800 dark:text-emerald-400 border-r border-slate-400 dark:border-slate-600 text-lg">₱{ledgerTotals.cib.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-6 text-right font-mono text-rose-800 dark:text-rose-400 border-r border-slate-400 dark:border-slate-600 text-lg">₱{ledgerTotals.ewt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td colSpan={categories.length + (canEdit ? 2 : 1)} className="px-6 py-6"></td>
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
                    {editingId ? 'Edit Disbursement Voucher' : 'Disbursement Voucher Entry'}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    {editingId ? 'Update the fund details and save.' : 'Complete all required fund details below.'}
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
                      <SearchableDropdown
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
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">CV # <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="cv_no"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Unique CV#"
                        className={`w-full p-2 rounded-md text-sm outline-none font-bold transition-all duration-200 ${isDuplicateCV
                          ? 'border-2 border-red-500 dark:border-red-400 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 focus:ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                          : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-amber-50 dark:bg-amber-900/10 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
                          }`}
                        value={headerData.cv_no}
                        onChange={(e) => {
                          const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                          handleHeaderChange({ target: { name: 'cv_no', value: onlyNums } });
                        }}
                        required
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
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">OR / INV #</label>
                      <input type="text" name="or_inv_no" placeholder="Receipt No." className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-slate-800 dark:text-white transition-colors"
                        value={headerData.or_inv_no} onChange={handleHeaderChange} />
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

                    <div className="space-y-1 bg-blue-50 dark:bg-blue-900/20 p-2 -mt-2 -mb-2 rounded-md border border-blue-100 dark:border-blue-800 flex flex-col justify-center shadow-inner transition-colors duration-300">
                      <label className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center justify-between">
                        <span>Target CIB/COH (₱) <span className="text-red-500">*</span></span>
                      </label>
                      <input type="text" name="target_cib" placeholder="0.00"
                        className="w-full p-1.5 border border-blue-200 dark:border-blue-700 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none font-black text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 transition-colors"
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

                    {/* 2. CONSTRUCTION COST BREAKDOWN */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden transition-colors duration-300">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">2. CONSTRUCTION COST BREAKDOWN <span className="text-red-500">*</span></h3>
                        <button type="button" onClick={() => addLine('construction')} disabled={targetCib <= 0 || isAddingLine} className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors disabled:opacity-50 min-w-[120px] justify-center">
                          {isAddingLine ? (
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"></span> Adding...</span>
                          ) : (
                            <><Plus size={14} /> Add Line Item</>
                          )}
                        </button>
                      </div>

                      <div className="max-h-[250px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {constructionLines.map((line, index) => (
                          <div key={line.id} className="flex gap-3 items-start animate-in slide-in-from-top-2">
                            <div className="w-8 h-9 mt-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 shrink-0 transition-colors">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <SearchableDropdown
                                options={mainCategoriesList}
                                value={line.category}
                                onChange={(val) => handleLineChange(line.id, 'category', val, 'construction')}
                                placeholder="-- Find Construction Category --"
                                hasError={lineErrors.includes(line.id)}
                              />
                            </div>
                            <div className="w-40 relative mt-1">
                              <span className="absolute left-3 top-2 text-slate-400 dark:text-slate-500 text-sm font-medium">₱</span>
                              <input type="text" placeholder="0.00"
                                className="w-full pl-7 p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-right text-slate-800 dark:text-white transition-colors"
                                value={line.amount} onChange={(e) => handleLineChange(line.id, 'amount', e.target.value, 'construction')} />
                            </div>
                            <button type="button" onClick={() => removeLine(line.id, 'construction')} disabled={constructionLines.length === 1 && miscLines.length === 0}
                              className="p-2 mt-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 italic">
                        * If "Labor /SUBCONTRACTOR" is chosen, it will calculate automatically by 2% for the EWT Payable.
                      </div>
                    </div>

                    {/* 3. MISCELLANEOUS COST */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden transition-colors duration-300">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">3. MISCELLANEOUS COST</h3>
                        <button type="button" onClick={() => addLine('misc')} disabled={targetCib <= 0 || isAddingLine} className="text-xs bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors disabled:opacity-50 min-w-[120px] justify-center border border-teal-100 dark:border-teal-800">
                          {isAddingLine ? (
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 dark:bg-teal-500 animate-bounce"></span> Adding...</span>
                          ) : (
                            <><Plus size={14} /> Add Misc Item</>
                          )}
                        </button>
                      </div>

                      <div className="max-h-[250px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {miscLines.length === 0 ? (
                          <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
                            <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">Walang miscellaneous cost na idinagdag. I-click ang button sa itaas para mag-add.</p>
                          </div>
                        ) : miscLines.map((line, index) => (
                          <div key={line.id} className="flex gap-3 items-start animate-in slide-in-from-top-2">
                            <div className="w-8 h-9 mt-1 bg-teal-50/50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 rounded flex items-center justify-center text-xs font-bold text-teal-600 dark:text-teal-400 shrink-0 transition-colors">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <SearchableDropdown
                                options={miscCategoriesList}
                                value={line.category}
                                onChange={(val) => handleLineChange(line.id, 'category', val, 'misc')}
                                placeholder="-- Find Miscellaneous Item --"
                                hasError={lineErrors.includes(line.id)}
                              />
                            </div>
                            <div className="w-40 relative mt-1">
                              <span className="absolute left-3 top-2 text-slate-400 dark:text-slate-500 text-sm font-medium">₱</span>
                              <input type="text" placeholder="0.00"
                                className="w-full pl-7 p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-right text-slate-800 dark:text-white transition-colors"
                                value={line.amount} onChange={(e) => handleLineChange(line.id, 'amount', e.target.value, 'misc')} />
                            </div>
                            <button type="button" onClick={() => removeLine(line.id, 'misc')}
                              className="p-2 mt-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

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
                                const token = localStorage.getItem('fbtmcc_token');
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
                                const token = localStorage.getItem('fbtmcc_token');
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
                                        const token = localStorage.getItem('fbtmcc_token');
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
                      <h3 className="text-sm font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 dark:border-slate-800">4. Accounting Summary</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-slate-300 dark:text-slate-400 text-sm">
                          <span>Total of Debit (Gross Exp.)</span>
                          <span className="font-mono text-white">₱ {totals.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-rose-300 dark:text-rose-400 text-sm">
                          <span>Less: EWT Payable</span>
                          <span className="font-mono">- ₱ {totals.ewtPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
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

                      <div className={`p-3 rounded-lg flex items-center justify-between mb-4 border transition-colors ${isVarianceZero ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-500/10 border-red-500/30 dark:bg-red-900/20 dark:border-red-800'}`}>
                        <span className={`text-xs font-bold uppercase ${isVarianceZero ? 'text-emerald-400 dark:text-emerald-500' : 'text-red-400 dark:text-red-500'}`}>
                          {isVarianceZero ? '✓ Balance' : '⚠️ Variance (Short/Over)'}
                        </span>
                        <span className={`font-mono font-bold ${isVarianceZero ? 'text-emerald-400 dark:text-emerald-500' : 'text-red-400 dark:text-red-500'}`}>
                          {(targetCib - totals.cib_coh) > 0 ? '+' : ''}{(targetCib - totals.cib_coh).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="submit"
                          onClick={handleSubmit}
                          disabled={isDuplicateCV || !isVarianceZero || targetCib === 0 || isSaving}
                          className={`w-full text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${(isDuplicateCV || !isVarianceZero || targetCib === 0 || isSaving)
                            ? 'bg-slate-500 dark:bg-slate-700 cursor-not-allowed opacity-50 shadow-none'
                            : 'bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 shadow-blue-900/20 dark:shadow-none'
                            }`}
                        >
                          <Save size={18} /> {isSaving ? 'Saving...' : (editingId ? 'Update Disbursement' : 'Post Disbursement')}
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

      {(isSaving || isLoading) && (
        <LoadingOverlay
          message={isSaving ? "Saving Entry" : "Refreshing Data"}
          subtext={isSaving ? "Please wait a moment..." : "Syncing your ledger..."}
        />
      )}
    </div>
  );
}