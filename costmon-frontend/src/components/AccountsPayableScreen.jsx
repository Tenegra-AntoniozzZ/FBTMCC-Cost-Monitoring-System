import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Filter, FileSpreadsheet, ChevronDown, ChevronRight,
  Square, CheckSquare, Minus, Loader2, X, ClipboardList, Receipt
} from 'lucide-react';
import { API_URL } from '../utils/Constants';

const MONTH_OPTIONS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' }, { value: '04', label: 'April' },
  { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const formatMoney = (n) =>
  `\u20b1${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const formatDate = (dateStr) => {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function AccountsPayableScreen({ disbursements, projects, userRole }) {
  // ─── Source data: only monitoring-only records ────────────────────────────
  const monitoringRecords = useMemo(() =>
    (disbursements || []).filter(d => d.is_monitoring_only === 1 || d.is_monitoring_only === true),
    [disbursements]
  );

  // ─── Filter & search states ───────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [tempMonths, setTempMonths] = useState([]);
  const [tempYears, setTempYears] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  // ─── Selection states ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ─── UI states ────────────────────────────────────────────────────────────
  const [expandedPayees, setExpandedPayees] = useState(new Set());
  const [activeId, setActiveId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // ─── Available years for filter ───────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = monitoringRecords.map(d => d.date && d.date.substring(0, 4)).filter(Boolean);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [monitoringRecords]);

  // ─── Filtered records ─────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let result = [...monitoringRecords];

    if (selectedMonths.length > 0 || selectedYears.length > 0) {
      result = result.filter(d => {
        if (!d.date) return false;
        const yr = d.date.substring(0, 4);
        const mo = d.date.substring(5, 7);
        const yOk = selectedYears.length === 0 || selectedYears.includes(yr);
        const mOk = selectedMonths.length === 0 || selectedMonths.includes(mo);
        return yOk && mOk;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d =>
        (d.payee && d.payee.toLowerCase().includes(q)) ||
        (d.cv_no && d.cv_no.toLowerCase().includes(q)) ||
        (d.po_no && String(d.po_no).toLowerCase().includes(q)) ||
        (d.project_code && d.project_code.toLowerCase().includes(q)) ||
        (d.or_inv_no && String(d.or_inv_no).toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) =>
      (a.payee || '').localeCompare(b.payee || '') ||
      (a.date || '').localeCompare(b.date || '')
    );
  }, [monitoringRecords, selectedMonths, selectedYears, searchQuery]);

  // ─── Group by payee ───────────────────────────────────────────────────────
  const payeeGroups = useMemo(() => {
    const groups = new Map();
    filteredRecords.forEach(d => {
      const key = d.payee || 'Unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    });
    return groups;
  }, [filteredRecords]);

  // Auto-expand all payees when data changes
  useEffect(() => {
    setExpandedPayees(new Set(payeeGroups.keys()));
  }, [payeeGroups]);

  // ─── Totals ───────────────────────────────────────────────────────────────
  const totalAmount = useMemo(() =>
    filteredRecords.reduce((s, d) => s + (parseFloat(d.gross_amount) || 0), 0),
    [filteredRecords]
  );

  const selectedTotal = useMemo(() =>
    filteredRecords
      .filter(d => selectedIds.has(d.id))
      .reduce((s, d) => s + (parseFloat(d.gross_amount) || 0), 0),
    [filteredRecords, selectedIds]
  );

  // ─── Selection helpers ────────────────────────────────────────────────────
  const allFilteredIds = useMemo(() => filteredRecords.map(d => d.id), [filteredRecords]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = !allSelected && allFilteredIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) allFilteredIds.forEach(id => next.delete(id));
      else allFilteredIds.forEach(id => next.add(id));
      return next;
    });
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePayeeGroup = (payee, records, e) => {
    e.stopPropagation();
    const payeeIds = records.map(d => d.id);
    const allPayeeSelected = payeeIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPayeeSelected) payeeIds.forEach(id => next.delete(id));
      else payeeIds.forEach(id => next.add(id));
      return next;
    });
  };

  const toggleExpandPayee = (payee) => {
    setExpandedPayees(prev => {
      const next = new Set(prev);
      if (next.has(payee)) next.delete(payee);
      else next.add(payee);
      return next;
    });
  };

  // ─── Active (detail view) record ─────────────────────────────────────────
  const activeRecord = useMemo(() =>
    activeId ? (filteredRecords.find(d => d.id === activeId) || null) : null,
    [activeId, filteredRecords]
  );

  // ─── Close filter on outside click ───────────────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Export handler ───────────────────────────────────────────────────────
  const handleExport = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      const token = sessionStorage.getItem('fbtmcc_token');
      const response = await fetch(`${API_URL}/disbursements/export-accounts-payable`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Export failed');
      }
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `accounts_payable_${Date.now()}.xlsx`;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('AP Export error:', err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 overflow-hidden relative transition-colors duration-300">

      {/* HEADER SECTION */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm z-10 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200 dark:shadow-none">
                <ClipboardList size={28} />
              </div>
              ACCOUNTS PAYABLE MONITOR
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2">
              Monitoring only disbursements — track, select &amp; export
            </p>
          </div>
        </div>
        {/* Stats chips */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 dark:bg-slate-700/50 rounded-2xl px-4 py-2 text-center min-w-[80px]">
            <p className="text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-widest font-black">Records</p>
            <p className="text-slate-800 dark:text-slate-200 text-xl font-black leading-tight">{filteredRecords.length}</p>
          </div>
          <div className="bg-slate-100 dark:bg-slate-700/50 rounded-2xl px-4 py-2 text-center">
            <p className="text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-widest font-black">Total Payable</p>
            <p className="text-slate-800 dark:text-slate-200 text-base font-black leading-tight font-mono">
              {'\u20b1'}{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </p>
          </div>
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl px-4 py-2 text-center border border-blue-200 dark:border-blue-800">
              <p className="text-blue-600 dark:text-blue-400 text-[9px] uppercase tracking-widest font-black">
                Selected ({selectedIds.size})
              </p>
              <p className="text-blue-700 dark:text-blue-300 text-base font-black leading-tight font-mono">
                {'\u20b1'}{selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* TOOLBAR */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center gap-3 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search payee, PO#, project, invoice..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 dark:text-slate-200 placeholder:text-slate-400 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => { setTempMonths(selectedMonths); setTempYears(selectedYears); setIsFilterOpen(v => !v); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
              selectedMonths.length > 0 || selectedYears.length > 0
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            <Filter size={14} />
            Filter
            {(selectedMonths.length > 0 || selectedYears.length > 0) && (
              <span className="bg-white/30 rounded-full text-[10px] px-1.5 font-black leading-tight py-0.5">
                {selectedMonths.length + selectedYears.length}
              </span>
            )}
          </button>

          {isFilterOpen && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 w-72">
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Month</p>
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                {MONTH_OPTIONS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setTempMonths(prev =>
                      prev.includes(m.value) ? prev.filter(x => x !== m.value) : [...prev, m.value]
                    )}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      tempMonths.includes(m.value)
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >{m.label.slice(0, 3)}</button>
                ))}
              </div>
              {availableYears.length > 0 && (
                <>
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Year</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {availableYears.map(y => (
                      <button
                        key={y}
                        onClick={() => setTempYears(prev =>
                          prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]
                        )}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          tempYears.includes(y)
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                      >{y}</button>
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedMonths(tempMonths); setSelectedYears(tempYears); setIsFilterOpen(false); }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
                >Apply</button>
                <button
                  onClick={() => {
                    setSelectedMonths([]); setSelectedYears([]);
                    setTempMonths([]); setTempYears([]); setIsFilterOpen(false);
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >Clear</button>
              </div>
            </div>
          )}
        </div>

        {/* Select All */}
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
        >
          {allSelected
            ? <CheckSquare size={15} className="text-blue-600" />
            : someSelected
              ? <Minus size={15} className="text-blue-500" />
              : <Square size={15} className="text-slate-400" />
          }
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>

        <div className="flex-1" />

        {/* Export Excel */}
        <button
          onClick={handleExport}
          disabled={selectedIds.size === 0 || isExporting}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all shadow-md ${
            selectedIds.size > 0 && !isExporting
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200/50 dark:shadow-none hover:scale-[1.02] active:scale-100'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
          }`}
        >
          {isExporting
            ? <Loader2 size={15} className="animate-spin" />
            : <FileSpreadsheet size={15} />
          }
          {isExporting
            ? 'Exporting...'
            : selectedIds.size > 0
              ? `Export Excel (${selectedIds.size})`
              : 'Export Excel'
          }
        </button>
      </div>

      {/* MAIN CONTENT: Split panel */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* LEFT PANEL: Grouped list */}
        <div
          className={`${activeRecord ? 'w-[45%]' : 'w-full'} overflow-y-auto border-r border-slate-200 dark:border-slate-800 transition-all duration-300`}
          style={{ scrollbarWidth: 'thin' }}
        >
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-full mb-5">
                <ClipboardList size={48} className="text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-lg font-black text-slate-500 dark:text-slate-400">No Monitoring Records Found</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5 font-medium max-w-xs">
                {monitoringRecords.length === 0
                  ? 'No disbursements have been flagged as "Monitoring Only" yet. Create one in Disbursements.'
                  : 'No records match your current search or filter. Try adjusting them.'}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {[...payeeGroups.entries()].map(([payee, records]) => {
                const payeeIds = records.map(d => d.id);
                const allPayeeSelected = payeeIds.every(id => selectedIds.has(id));
                const somePayeeSelected = !allPayeeSelected && payeeIds.some(id => selectedIds.has(id));
                const isExpanded = expandedPayees.has(payee);
                const payeeTotal = records.reduce((s, d) => s + (parseFloat(d.gross_amount) || 0), 0);

                return (
                  <div
                    key={payee}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                  >
                    {/* Payee group header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
                      onClick={() => toggleExpandPayee(payee)}
                    >
                      <button
                        onClick={(e) => togglePayeeGroup(payee, records, e)}
                        className="shrink-0 text-blue-600 dark:text-blue-400 hover:scale-110 transition-transform"
                        title={allPayeeSelected ? 'Deselect group' : 'Select group'}
                      >
                        {allPayeeSelected
                          ? <CheckSquare size={18} className="text-blue-600" />
                          : somePayeeSelected
                            ? <Minus size={18} className="text-blue-500" />
                            : <Square size={18} className="text-slate-400" />
                        }
                      </button>
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wide truncate">
                          {payee}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {records.length} record{records.length !== 1 ? 's' : ''}
                          <span className="mx-1.5 text-slate-300 dark:text-slate-600">&bull;</span>
                          <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                            {formatMoney(payeeTotal)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Expanded: individual rows */}
                    {isExpanded && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {records.map(d => {
                          const isActive = activeId === d.id;
                          const isChecked = selectedIds.has(d.id);
                          return (
                            <div
                              key={d.id}
                              onClick={() => setActiveId(prev => prev === d.id ? null : d.id)}
                              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                isActive
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-[3px] border-l-blue-600'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-[3px] border-l-transparent'
                              }`}
                            >
                              <button
                                onClick={(e) => toggleSelect(d.id, e)}
                                className="shrink-0 mt-0.5 text-blue-600 hover:scale-110 transition-transform"
                                title={isChecked ? 'Deselect' : 'Select'}
                              >
                                {isChecked
                                  ? <CheckSquare size={15} className="text-blue-600" />
                                  : <Square size={15} className="text-slate-400 dark:text-slate-600" />
                                }
                              </button>
                              <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-1">
                                <div>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">Date</p>
                                  <p className="text-[12px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">{formatDate(d.date)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">Project</p>
                                  <p className="text-[12px] font-black text-blue-600 dark:text-blue-400 truncate mt-0.5">{d.project_code || '\u2014'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">PO #</p>
                                  <p className="text-[12px] font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">{d.po_no || '\u2014'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">Invoice #</p>
                                  <p className="text-[12px] font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{d.or_inv_no || '\u2014'}</p>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="font-mono font-black text-slate-800 dark:text-slate-200 text-[13px]">
                                  {formatMoney(d.gross_amount)}
                                </p>
                                {isActive && (
                                  <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black tracking-wider mt-1 uppercase">
                                    Viewing &#9654;
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Detail view */}
        {activeRecord && (
          <div className="w-[55%] overflow-y-auto bg-[#f8fafc] dark:bg-slate-900 flex flex-col min-w-0">
            {/* Detail header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 px-6 py-4 flex items-start justify-between shadow-sm transition-colors duration-300">
              <div className="min-w-0 flex-1">
                <span className="inline-block text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-2">
                  Monitoring Only
                </span>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide truncate">
                  {activeRecord.payee || 'Unknown Payee'}
                </h2>
              </div>
              <button
                onClick={() => setActiveId(null)}
                className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Close detail"
              >
                <X size={18} />
              </button>
            </div>

            {/* Detail body */}
            <div className="p-6 space-y-5 flex-1">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Date', value: formatDate(activeRecord.date), mono: false },
                  { label: 'CV #', value: activeRecord.cv_no ? `#${activeRecord.cv_no}` : '\u2014', mono: true },
                  { label: 'PO #', value: activeRecord.po_no || '\u2014', mono: true },
                  { label: 'Invoice / OR #', value: activeRecord.or_inv_no || '\u2014', mono: true },
                  { label: 'Project Code', value: activeRecord.project_code || '\u2014', mono: false, span: 2 },
                  ...(activeRecord.particulars ? [{ label: 'Particulars', value: activeRecord.particulars, mono: false, span: 2 }] : [])
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm ${item.span === 2 ? 'col-span-2' : ''}`}
                  >
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mb-1.5">{item.label}</p>
                    <p className={`font-bold text-slate-800 dark:text-slate-200 text-sm break-words ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Expense line items */}
              <div>
                <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Receipt size={13} /> Expense Breakdown
                </h3>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  {activeRecord.expenses && activeRecord.expenses.length > 0 ? (
                    <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-2/5">Category</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Particulars</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {activeRecord.expenses.map((exp, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-2.5 align-top">
                                <span className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold leading-tight inline-block">
                                  {exp.category || '\u2014'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs italic align-top">{exp.particulars || '\u2014'}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 text-sm align-top">
                                {formatMoney(exp.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700/80 flex justify-between items-center">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Total Amount</span>
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-base">
                          {formatMoney(activeRecord.gross_amount)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-10 text-center text-slate-400 dark:text-slate-500">
                      <Receipt size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-bold">No expense line items recorded.</p>
                      <p className="text-xs mt-1 font-medium opacity-70">
                        Total amount: {formatMoney(parseFloat(activeRecord.gross_amount) || 0)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
