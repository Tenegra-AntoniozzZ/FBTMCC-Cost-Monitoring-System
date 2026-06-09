import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, FileText, ChevronDown, Filter, X, Lock, Save, Receipt, Edit2 } from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';
import HealthCard from './HealthCard';
import PasswordConfirmModal from './PasswordConfirmModal';
import LoadingOverlay from './LoadingOverlay';
import { API_URL } from '../utils/Constants';

export default function DisbursementScreen({ projects, disbursements, refreshData, isLoading, userRole, categories }) {
  const canEdit = userRole === 'encoder';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showTaxFields, setShowTaxFields] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lineErrors, setLineErrors] = useState([]);
  
  // PASSWORD VERIFICATION STATE
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });

  // --- SEARCH BAR STATE ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- MONTH FILTER LOGIC ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(['All']);
  const [tempSelectedMonths, setTempSelectedMonths] = useState(['All']);
  const filterRef = useRef(null);

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
      if (event.key === 'Escape') {
        if (isModalOpen) closeAndResetModal();
        if (isFilterOpen) setIsFilterOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isFilterOpen]);

  const availableMonths = useMemo(() => {
    const months = disbursements.map(d => d.date && d.date.substring(0, 7)).filter(Boolean); 
    return [...new Set(months)].sort((a, b) => b.localeCompare(a)); 
  }, [disbursements]);

  const filteredDisbursements = useMemo(() => {
    let result = disbursements;
    
    if (!selectedMonths.includes('All')) {
      result = result.filter(d => selectedMonths.some(m => d.date && d.date.startsWith(m)));
    }
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(d => d.cv_no && d.cv_no.toLowerCase().includes(query));
    }
    
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

  // VOUCHER STATE
  const [headerData, setHeaderData] = useState({
    date: new Date().toISOString().split('T')[0],
    project_code: '',
    payee: '',
    particulars: '',
    tin: '',
    cv_no: '',
    check_no: '',
    or_inv_no: '',
    accts_pay: '',
    input_tax: '',
    output_tax: '',
    target_cib: ''
  });

  const [expenseLines, setExpenseLines] = useState([{ id: 1, category: '', amount: '' }]);

  const handleHeaderChange = (e) => setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  
  const handleLineChange = (id, field, value) => {
    setExpenseLines(lines => lines.map(line => line.id === id ? { ...line, [field]: value } : line));
    
    // Kapag nakapili na siya ng category, tatanggalin natin ang pula
    if (field === 'category' && value.trim() !== '') {
      setLineErrors(errors => errors.filter(errId => errId !== id));
    }
  };

  const addLine = () => {
    setExpenseLines(prev => {
      const maxId = prev.length > 0 ? Math.max(...prev.map(line => line.id)) : 0;
      return [...prev, { id: maxId + 1, category: '', amount: '' }];
    });
  };
  
  const removeLine = (id) => {
    if (expenseLines.length > 1) setExpenseLines(lines => lines.filter(line => line.id !== id));
  };

  const totals = useMemo(() => {
    let totalDebit = 0;
    let ewtPayable = 0;

    expenseLines.forEach(line => {
      const amt = parseFloat(line.amount) || 0;
      totalDebit += amt;
      if (line.category === 'Labor /SUBCONTRACTOR') ewtPayable += (amt * 0.02); 
    });

    const cib_coh = totalDebit - ewtPayable;
    return { totalDebit, ewtPayable, cib_coh };
  }, [expenseLines]);

  const resetForm = () => {
    setHeaderData({ date: new Date().toISOString().split('T')[0], project_code: '', payee: '', particulars: '', tin: '', cv_no: '', check_no: '', or_inv_no: '', accts_pay: '', input_tax: '', output_tax: '', target_cib: '' });
    setExpenseLines([{ id: Date.now(), category: '', amount: '' }]);
    setShowTaxFields(false);
    setErrorMessage('');
    setLineErrors([]); 
    setEditingId(null);
  };

  const closeAndResetModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleEditRow = (d) => {
    if (!canEdit) return;
    setEditingId(d.id);
    setHeaderData({
      date: d.date || '',
      project_code: d.project_code || '',
      payee: d.payee || '',
      particulars: d.particulars || '',
      tin: d.tin || '',
      cv_no: d.cv_no || '',
      check_no: d.check_no || '',
      or_inv_no: d.or_inv_no || '',
      accts_pay: d.accts_pay || '',
      input_tax: d.input_tax || '',
      output_tax: d.output_tax || '',
      target_cib: d.target_cib || d.net_amount || '' 
    });
    
    if (d.expenses && d.expenses.length > 0) {
      setExpenseLines(d.expenses);
    } else {
      setExpenseLines([{ id: 1, category: '', amount: '' }]);
    }

    if (d.accts_pay || d.input_tax || d.output_tax) {
      setShowTaxFields(true);
    } else {
      setShowTaxFields(false);
    }
    
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const isDuplicateCV = useMemo(() => {
    if (!headerData.cv_no) return false;
    return disbursements.some(
      (d) => d.id !== editingId && d.cv_no && d.cv_no.trim().toLowerCase() === headerData.cv_no.trim().toLowerCase()
    );
  }, [headerData.cv_no, disbursements, editingId]);

  const targetCib = parseFloat(headerData.target_cib) || 0;
  const isVarianceZero = Math.abs(targetCib - totals.cib_coh) < 0.01; 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(''); 

    if (!headerData.project_code || !canEdit || totals.totalDebit === 0) return;
    if (!headerData.cv_no) { setErrorMessage("Kailangan ilagay ang CV#."); return; }
    if (isDuplicateCV) { setErrorMessage("May kaparehas na CV#! Paki-palitan bago i-save."); return; }
    if (!isVarianceZero) { setErrorMessage("Hindi pwedeng i-save! Paki-check ang Variance. Kailangang pantay ang Target CIB sa Computed CIB."); return; }

    const emptyCategoryLines = expenseLines.filter(line => !line.category || line.category.trim() === '');
    if (emptyCategoryLines.length > 0) {
      const errorIds = emptyCategoryLines.map(line => line.id);
      setLineErrors(errorIds); 
      return; 
    }

    const newDisbursement = {
      // eslint-disable-next-line react-hooks/purity
      id: editingId || Date.now().toString(36) + Math.floor(Math.random()*1000).toString(), 
      ...headerData,
      expenses: expenseLines,
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

  // --- DITO NAIDAGDAG ANG TOKEN (executeSave) ---
  const executeSave = async (disbursementData) => {
    setIsSaving(true);
    try {
      const url = editingId ? `${API_URL}/disbursements/${editingId}` : `${API_URL}/disbursements`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
        },
        body: JSON.stringify(disbursementData)
      });

      if (response.ok) {
        await refreshData(); 
        closeAndResetModal(); 
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

  const handleDeleteClick = (id) => {
    if (!canEdit) return;
    setPasswordModal({ isOpen: true, action: 'delete', payload: id });
  };

  // --- DITO NAIDAGDAG ANG TOKEN (executeDelete) ---
  const executeDelete = async (id) => {
    try {
      const response = await fetch(`${API_URL}/disbursements/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
        }
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

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
              <Receipt size={28} />
            </div>
            DISBURSEMENT LEDGER
          </h1>
          <p className="text-slate-500 mt-1 font-medium italic">{activeMonthDisplay}</p>
        </div>

        <div className="flex items-center gap-4">
          {!canEdit && (
            <div className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold">
              <Lock size={16} />
              READ-ONLY MODE
            </div>
          )}
          {isLoading && (
            <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black animate-pulse border border-blue-100">
              UPDATING...
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        
        {/* STATS CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <HealthCard 
            title="Total of Debit (Gross)" 
            amount={ledgerTotals.dr} 
            colorClass="bg-blue-600" 
            textClass="text-blue-600" 
          />
          <HealthCard 
            title="Total of Credit (Net+Tax)" 
            amount={ledgerTotals.cr} 
            colorClass="bg-emerald-600" 
            textClass="text-emerald-600" 
          />
          <HealthCard 
            title="Current Variance" 
            amount={ledgerTotals.diff} 
            colorClass={ledgerTotals.diff === 0 ? "bg-emerald-500" : "bg-rose-500"} 
            textClass={ledgerTotals.diff === 0 ? "text-emerald-600" : "text-rose-600"} 
          />
        </section>

        {/* LEDGER TABLE SECTION */}
        <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
          
          {/* ACTION BAR */}
          <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search CV No..."
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                  className="flex items-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-xl font-bold transition-all shadow-sm"
                >
                  <Filter size={18} className={selectedMonths.includes('All') ? 'text-slate-400' : 'text-blue-600'} />
                  <span>{selectedMonths.includes('All') ? 'All Months' : `${selectedMonths.length} Months`}</span>
                </button>

                {isFilterOpen && (
                  <div className="absolute left-0 mt-3 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <span className="font-black text-slate-700 text-sm tracking-tight uppercase">Select Months</span>
                      <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={18} /></button>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                      <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group">
                        <input 
                          type="checkbox" 
                          checked={tempSelectedMonths.includes('All')}
                          onChange={() => handleToggleMonth('All')}
                          className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                        />
                        <span className={`text-sm ${tempSelectedMonths.includes('All') ? 'font-black text-slate-800' : 'text-slate-500 font-bold'}`}>Show All Data</span>
                      </label>
                      {availableMonths.map(month => (
                        <label key={month} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group">
                          <input 
                            type="checkbox" 
                            checked={tempSelectedMonths.includes(month)}
                            onChange={() => handleToggleMonth(month)}
                            className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                          />
                          <span className={`text-sm ${tempSelectedMonths.includes(month) ? 'font-black text-slate-800' : 'text-slate-500 font-bold'}`}>{formatMonth(month)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50">
                      <button 
                        onClick={applyFilter}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black transition-all shadow-lg shadow-blue-100"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {canEdit && (
              <button 
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black transition-all shadow-lg shadow-blue-200"
              >
                <Plus size={20} />
                New Disbursement
              </button>
            )}
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto custom-scrollbar flex-1 border border-slate-400 rounded-2xl shadow-xl bg-white">
            <table className="w-full text-left border-collapse min-w-[1500px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-6 py-5 text-xs font-black text-slate-800 uppercase tracking-wider border-b-2 border-r border-slate-400 sticky left-0 z-10 bg-slate-100 shadow-[3px_0_0_0_#94a3b8]">Date</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 uppercase tracking-wider border-b-2 border-r border-slate-400">Payee</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 uppercase tracking-wider border-b-2 border-r border-slate-400 text-center">CV No.</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 uppercase tracking-wider border-b-2 border-r border-slate-400 text-center">Project</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-800 uppercase tracking-wider border-b-2 border-r border-slate-400 text-right">Debit (Gross)</th>
                  <th className="px-6 py-5 text-xs font-black text-emerald-800 uppercase tracking-wider border-b-2 border-r border-slate-400 text-right bg-emerald-100/50">Credit (CIB)</th>
                  <th className="px-6 py-5 text-xs font-black text-rose-800 uppercase tracking-wider border-b-2 border-r border-slate-400 text-right bg-rose-50/50">EWT</th>
                  {categories.map(cat => (
                    <th key={cat} className="px-4 py-5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b-2 border-r border-slate-400 text-right min-w-[120px] bg-slate-50" title={cat}>
                      {cat}
                    </th>
                  ))}
                  <th className="px-6 py-5 text-xs font-black text-slate-800 uppercase tracking-wider border-b-2 border-r border-slate-400 text-center">Particulars</th>
                  {canEdit && <th className="px-6 py-5 text-xs font-black text-slate-800 uppercase tracking-wider border-b-2 border-slate-400 text-center sticky right-0 z-10 bg-slate-100 shadow-[-3px_0_0_0_#94a3b8]">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400">
                {filteredDisbursements.length === 0 ? (
                  <tr>
                    <td colSpan={8 + categories.length} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-slate-100 p-6 rounded-full text-slate-300">
                          <Receipt size={48} />
                        </div>
                        <p className="text-slate-400 font-bold text-lg italic">No disbursements found for the selected criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredDisbursements.map(d => (
                  <tr 
                    key={d.id} 
                    className={`even:bg-slate-50/80 hover:bg-blue-100/50 transition-colors group ${canEdit ? 'cursor-pointer' : ''}`}
                    onDoubleClick={() => handleEditRow(d)}
                  >
                    <td className="px-6 py-4 font-black text-slate-600 sticky left-0 z-10 bg-white group-even:bg-slate-50 group-hover:bg-blue-100/50 border-r border-slate-400 shadow-[3px_0_0_0_#94a3b8]">{d.date}</td>
                    <td className="px-6 py-4 font-black text-slate-800 border-r border-slate-400 group-even:bg-slate-50/30 group-hover:bg-blue-50/50">{d.payee}</td>
                    <td className="px-6 py-4 font-black text-blue-700 text-center border-r border-slate-400 group-even:bg-slate-50/30 group-hover:bg-blue-50/50">#{d.cv_no}</td>
                    <td className="px-6 py-4 font-black text-slate-500 text-center border-r border-slate-400 group-even:bg-slate-50/30 group-hover:bg-blue-50/50">{d.project_code}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-slate-900 border-r border-slate-400 group-even:bg-slate-50/30 group-hover:bg-blue-50/50">₱{(d.gross_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/30 border-r border-slate-400 group-hover:bg-emerald-100/30">₱{(d.net_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-rose-600 bg-rose-50/20 border-r border-slate-400 group-hover:bg-rose-100/20">₱{(d.ewt_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    {categories.map(cat => {
                      const amt = getCategoryAmount(d, cat);
                      return (
                        <td key={cat} className={`px-4 py-4 text-right font-mono text-sm border-r border-slate-400 group-even:bg-slate-50/30 group-hover:bg-blue-50/30 ${amt ? 'font-black text-slate-800 bg-slate-100/40' : 'text-slate-300'}`}>
                          {amt ? `₱${amt.toLocaleString()}` : '—'}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-slate-500 text-xs italic max-w-[200px] truncate border-r border-slate-400 group-even:bg-slate-50/30 group-hover:bg-blue-50/50" title={d.particulars}>{d.particulars}</td>
                    {canEdit && (
                      <td className="px-6 py-4 text-center sticky right-0 z-10 bg-white group-even:bg-slate-50 group-hover:bg-blue-100/50 shadow-[-3px_0_0_0_#94a3b8]">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleEditRow(d); }} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-200 border border-blue-100 rounded-lg transition-colors" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(d.id); }} className="p-2 bg-red-50 text-red-600 hover:bg-red-200 border border-red-100 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {filteredDisbursements.length > 0 && (
                <tfoot className="bg-slate-100 font-black text-slate-800 border-t-4 border-slate-400">
                  <tr>
                    <td colSpan="4" className="px-6 py-6 text-right text-xs tracking-widest text-slate-500 sticky left-0 z-10 bg-slate-100 border-r border-slate-400 shadow-[3px_0_0_0_#94a3b8]">TOTAL SUMMARY:</td>
                    <td className="px-6 py-6 text-right font-mono text-blue-800 border-r border-slate-400 text-lg">₱{ledgerTotals.dr.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-6 text-right font-mono text-emerald-800 border-r border-slate-400 text-lg">₱{ledgerTotals.cib.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-6 text-right font-mono text-rose-800 border-r border-slate-400 text-lg">₱{ledgerTotals.ewt.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td colSpan={categories.length + (canEdit ? 2 : 1)} className="px-6 py-6"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </main>

      {isModalOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-10 pb-10 overflow-y-auto bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-slate-50 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg"><FileText className="text-blue-600" size={20} /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 leading-tight">
                    {editingId ? 'Edit Disbursement Voucher' : 'Disbursement Voucher Entry'}
                  </h2>
                  <p className="text-slate-500 text-xs">
                    {editingId ? 'I-update ang detalye ng pondo at i-save.' : 'Kumpletuhin ang mga detalye ng pondo.'}
                  </p>
                </div>
              </div>
              <button onClick={closeAndResetModal} className="p-2 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">

                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium animate-in fade-in flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                    {errorMessage}
                  </div>
                )}

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex justify-between">
                    <span>1. Voucher Details</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Payee <span className="text-red-500">*</span></label>
                      <input type="text" name="payee" placeholder="Name of Payee" className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        value={headerData.payee} onChange={handleHeaderChange} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Project Code (#) <span className="text-red-500">*</span></label>
                      <SearchableDropdown
                        options={projects.map(p => p.project_code)}
                        value={headerData.project_code}
                        onChange={(val) => handleHeaderChange({ target: { name: 'project_code', value: val } })}
                        placeholder="-- Search for Project Code --"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Date <span className="text-red-500">*</span></label>
                      <input type="date" name="date" className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={headerData.date} onChange={handleHeaderChange} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">CV # <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        name="cv_no" 
                        placeholder="Unique CV#" 
                        className={`w-full p-2 rounded-md text-sm outline-none font-bold transition-all duration-200 ${
                          isDuplicateCV 
                            ? 'border-2 border-red-500 text-red-700 bg-red-50 focus:ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                            : 'border border-slate-300 text-slate-700 bg-amber-50 focus:ring-2 focus:ring-blue-500'
                        }`}
                        value={headerData.cv_no} 
                        onChange={handleHeaderChange} 
                        required 
                      />
                      {isDuplicateCV && (
                        <p className="text-[10px] text-red-600 font-bold flex items-center gap-1 animate-in slide-in-from-top-1">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> Gamit na ang CV# na ito!
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500">Particulars (Description) <span className="text-red-500">*</span></label>
                      <input type="text" name="particulars" placeholder="Details..." className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={headerData.particulars} onChange={handleHeaderChange} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">TIN</label>
                      <input type="text" name="tin" placeholder="000-000-000-000" className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={headerData.tin} onChange={handleHeaderChange} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">OR / INV #</label>
                      <input type="text" name="or_inv_no" placeholder="Receipt No." className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={headerData.or_inv_no} onChange={handleHeaderChange} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Check No.</label>
                      <input type="text" name="check_no" placeholder="Optional" className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={headerData.check_no} onChange={handleHeaderChange} />
                    </div>

                    <div className="space-y-1 bg-blue-50 p-2 -mt-2 -mb-2 rounded-md border border-blue-100 flex flex-col justify-center shadow-inner">
                      <label className="text-xs font-bold text-blue-800 uppercase flex items-center justify-between">
                        <span>Target CIB/COH (₱) <span className="text-red-500">*</span></span>
                      </label>
                      <input type="number" step="0.01" name="target_cib" placeholder="0.00" 
                        className="w-full p-1.5 border border-blue-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none font-black text-blue-900 bg-white"
                        value={headerData.target_cib} onChange={handleHeaderChange} required />
                    </div>

                    <div className="space-y-1 md:col-span-2 flex items-end pb-1">
                      <button type="button" onClick={() => setShowTaxFields(!showTaxFields)} className="text-blue-600 text-xs font-medium hover:underline flex items-center gap-1">
                        {showTaxFields ? 'Hide Tax/Payables Fields' : 'Show Advanced Fields (Accts Pay, BIR-VAT, etc.)'} <ChevronDown size={14}/>
                      </button>
                    </div>
                  </div>

                  {showTaxFields && (
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 bg-slate-50 p-4 rounded-lg">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500">Accts Pay</label>
                          <input type="number" step="0.01" name="accts_pay" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={headerData.accts_pay} onChange={handleHeaderChange} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500">Input Tax (Vat Input)</label>
                          <input type="number" step="0.01" name="input_tax" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={headerData.input_tax} onChange={handleHeaderChange} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500">Output Tax</label>
                          <input type="number" step="0.01" name="output_tax" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={headerData.output_tax} onChange={handleHeaderChange} />
                        </div>
                     </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className={`lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden transition-all duration-300 ${targetCib <= 0 ? 'opacity-40 pointer-events-none bg-slate-50 grayscale-[50%]' : ''}`}>
                    
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">2. Expense Category Breakdown <span className="text-red-500">*</span></h3>
                      <button type="button" onClick={addLine} disabled={targetCib <= 0} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors disabled:opacity-50">
                        <Plus size={14} /> Add Line Item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {expenseLines.map((line, index) => (
                        <div key={line.id} className="flex gap-3 items-start animate-in slide-in-from-top-2">
                          <div className="w-8 h-9 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                                <SearchableDropdown 
                                options={categories}
                                value={line.category}
                                onChange={(val) => handleLineChange(line.id, 'category', val)}
                                placeholder="-- Find Category --"
                                hasError={lineErrors.includes(line.id)}
                                />
                            </div>
                          <div className="w-40 relative">
                            <span className="absolute left-3 top-2 text-slate-400 text-sm font-medium">₱</span>
                            <input type="number" step="0.01" placeholder="0.00" 
                              className="w-full pl-7 p-2 border border-slate-300 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-right"
                              value={line.amount} onChange={(e) => handleLineChange(line.id, 'amount', e.target.value)} required />
                          </div>
                          <button type="button" onClick={() => removeLine(line.id)} disabled={expenseLines.length === 1}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 text-xs text-slate-500 border-t border-slate-100 italic">
                      * If "Labor /SUBCONTRACTOR" is chosen, it will calculate automatically by 2% for the EWT Payable.
                    </div>
                  </div>

                  <div className="bg-slate-800 text-white p-6 rounded-xl shadow-md flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700">3. Accounting Summary</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-slate-300 text-sm">
                          <span>Total of Debit (Gross Exp.)</span>
                          <span className="font-mono">₱ {totals.totalDebit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center text-rose-300 text-sm">
                          <span>Less: EWT Payable</span>
                          <span className="font-mono">- ₱ {totals.ewtPayable.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        {headerData.input_tax && (
                          <div className="flex justify-between items-center text-slate-400 text-xs">
                            <span>Input Tax</span>
                            <span className="font-mono">₱ {parseFloat(headerData.input_tax).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-700">
                      <div className="flex justify-between items-end mb-3">
                        <div>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Target CIB (Mula Resibo)</div>
                          <div className="text-lg font-bold text-slate-300">₱ {targetCib.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-blue-300 font-semibold uppercase tracking-wider mb-1">Computed CIB/COH</div>
                          <div className="text-2xl font-black text-blue-400 tracking-tight">
                            ₱ {totals.cib_coh.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </div>
                        </div>
                      </div>

                      <div className={`p-3 rounded-lg flex items-center justify-between mb-4 border transition-colors ${isVarianceZero ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                         <span className={`text-xs font-bold uppercase ${isVarianceZero ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isVarianceZero ? '✓ Balanse' : '⚠️ Variance (Kulang/Sobra)'}
                         </span>
                         <span className={`font-mono font-bold ${isVarianceZero ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(targetCib - totals.cib_coh) > 0 ? '+' : ''}{(targetCib - totals.cib_coh).toLocaleString(undefined, {minimumFractionDigits: 2})}
                         </span>
                      </div>
                      
                      <button 
                        type="submit" 
                        disabled={isDuplicateCV || !isVarianceZero || targetCib === 0 || isSaving}
                        className={`w-full text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                          (isDuplicateCV || !isVarianceZero || targetCib === 0 || isSaving) 
                            ? 'bg-slate-500 cursor-not-allowed opacity-50 shadow-none' 
                            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                        }`}
                      >
                        <Save size={18} /> {isSaving ? 'Nagsa-save...' : (editingId ? 'Update Disbursement' : 'Post Disbursement')}
                      </button>
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

      {(isSaving || isLoading) && (
        <LoadingOverlay 
          message={isSaving ? "Saving Entry" : "Refreshing Data"} 
          subtext={isSaving ? "Paki-antay lamang..." : "Sina-sync ang inyong ledger..."} 
        />
      )}
    </div>
  );
}