import { useState, useEffect } from 'react';
import {
  ClipboardList, Search, ChevronLeft, ChevronRight,
  X, User, Clock, Database, RefreshCw, Download, Filter, Loader2
} from 'lucide-react';
import { API_URL } from '../utils/Constants';

// ─── Action badge colours (unchanged logic) ───────────────────
const ACTION_COLORS = {
  CREATE_DISBURSEMENT: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
  UPDATE_DISBURSEMENT: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50',
  DELETE_DISBURSEMENT: 'bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50',
  CREATE_PROJECT:      'bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50',
  UPDATE_PROJECT:      'bg-sky-50 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50',
  DELETE_PROJECT:      'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50',
  CREATE_USER:         'bg-violet-50 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50',
  UPDATE_USER:         'bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50',
  DEACTIVATE_USER:     'bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50',
  ACTIVATE_USER:       'bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300 border border-lime-200 dark:border-lime-800/50',
  UPLOAD_ATTACHMENT:   'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
  DELETE_ATTACHMENT:   'bg-pink-50 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50',
  LOGIN:               'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600',
  RESET_PASSWORD:      'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/50',
  CHANGE_PASSWORD:     'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/50',
  CREATE_CATEGORY:     'bg-cyan-50 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50',
  DELETE_CATEGORY:     'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50',
  EXPORT_DATABASE:     'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
  IMPORT_DATABASE:     'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50',
};

const ENTITY_ICONS = {
  disbursement: '🧾',
  project:      '🏗️',
  user:         '👤',
  category:     '🏷️',
  session:      '🔐',
  database:     '🗄️',
};

const ALL_ACTIONS = [
  'CREATE_DISBURSEMENT','UPDATE_DISBURSEMENT','DELETE_DISBURSEMENT',
  'CREATE_PROJECT','UPDATE_PROJECT','DELETE_PROJECT',
  'CREATE_USER','UPDATE_USER','ACTIVATE_USER','DEACTIVATE_USER',
  'UPLOAD_ATTACHMENT','DELETE_ATTACHMENT',
  'LOGIN','RESET_PASSWORD','CHANGE_PASSWORD',
  'CREATE_CATEGORY','DELETE_CATEGORY',
  'EXPORT_DATABASE','IMPORT_DATABASE',
];

function formatTimestamp(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

export default function AuditLogScreen({ isDark }) {
  const [logs,          setLogs]          = useState([]);
  const [total,         setTotal]         = useState(0);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isExporting,   setIsExporting]   = useState(false);
  const [page,          setPage]          = useState(1);
  const limit = 50;

  const [filterUsername, setFilterUsername] = useState('');
  const [filterAction,   setFilterAction]   = useState('');
  const [filterEntity,   setFilterEntity]   = useState('');
  const [filterStart,    setFilterStart]    = useState('');
  const [filterEnd,      setFilterEnd]      = useState('');

  const token = sessionStorage.getItem('fbtmcc_token');

  const fetchLogs = async (pg = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit });
      if (filterUsername) params.append('username',    filterUsername);
      if (filterAction)   params.append('action',      filterAction);
      if (filterEntity)   params.append('entity_type', filterEntity);
      if (filterStart)    params.append('startDate',   filterStart);
      if (filterEnd)      params.append('endDate',     filterEnd);

      const res  = await fetch(`${API_URL}/audit-logs?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { setLogs(data.logs || []); setTotal(data.total || 0); setPage(pg); }
    } catch (e) { console.error(e); }
    finally     { setIsLoading(false); }
  };

  useEffect(() => { fetchLogs(1); }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const hasFilters = filterUsername || filterAction || filterEntity || filterStart || filterEnd;

  const clearFilters = () => {
    setFilterUsername(''); setFilterAction(''); setFilterEntity('');
    setFilterStart('');    setFilterEnd('');
    setTimeout(() => fetchLogs(1), 0);
  };

  // Export ALL filtered logs as a styled .xlsx from the backend
  const handleExportXLSX = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (filterUsername) params.append('username',    filterUsername);
      if (filterAction)   params.append('action',      filterAction);
      if (filterEntity)   params.append('entity_type', filterEntity);
      if (filterStart)    params.append('startDate',   filterStart);
      if (filterEnd)      params.append('endDate',     filterEnd);

      const response = await fetch(`${API_URL}/audit-logs/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        let errMsg = 'Export failed.';
        try { const d = await response.json(); errMsg = d.error || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }

      // Derive filename from Content-Disposition or fall back to a default
      const disposition = response.headers.get('content-disposition') || '';
      const match       = disposition.match(/filename="?([^"]+)"?/);
      const filename    = match ? match[1] : `audit_log_${Date.now()}.xlsx`;

      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err.message);
      // Surface the error briefly in the browser console — toast can be added if desired
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Shared filter input style ────────────────────────────
  const filterInputCls = 'px-4 py-2.5 text-sm rounded-xl border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-300';

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 overflow-hidden transition-colors duration-300">

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between shrink-0 shadow-sm transition-colors duration-300">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <div className="bg-indigo-600 dark:bg-indigo-700 p-2 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <ClipboardList size={28} />
            </div>
            AUDIT TRAIL
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {total.toLocaleString()} total log {total === 1 ? 'entry' : 'entries'} recorded
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLogs(page)}
            className="p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded-xl transition-colors shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportXLSX}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white font-black rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
            title="Export all matching logs as a styled Excel file"
          >
            {isExporting
              ? <><Loader2 size={18} className="animate-spin" /> Generating…</>
              : <><Download size={18} /> Export Excel</>
            }
          </button>
        </div>
      </header>

      {/* ── FILTER BAR ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-widest uppercase">
            <Filter size={12} /> Filters
          </span>

          {/* Username */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="User…"
              value={filterUsername}
              onChange={e => setFilterUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs(1)}
              className={`${filterInputCls} pl-9 w-36`}
            />
          </div>

          {/* Action */}
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className={`${filterInputCls}`}
          >
            <option value="">All Actions</option>
            {ALL_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Entity */}
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className={filterInputCls}
          >
            <option value="">All Entities</option>
            <option value="disbursement">Disbursement</option>
            <option value="project">Project</option>
            <option value="user">User</option>
            <option value="category">Category</option>
            <option value="session">Session</option>
            <option value="database">Database</option>
          </select>

          {/* Date range */}
          <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className={filterInputCls} />
          <span className="text-slate-400 text-sm font-bold">to</span>
          <input type="date" value={filterEnd}   onChange={e => setFilterEnd(e.target.value)}   className={filterInputCls} />

          <button
            onClick={() => fetchLogs(1)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            Apply
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 text-sm font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-600"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── TABLE AREA ───────────────────────────────────────── */}
      <main className="flex-1 overflow-auto custom-scrollbar p-8">
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col transition-colors duration-300 h-full">

          {/* Card header */}
          <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Database className="text-indigo-600 dark:text-indigo-400" size={22} />
              Log Entries
            </h2>
            <span className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-xs font-black text-slate-500 dark:text-slate-300 tracking-widest transition-colors duration-300">
              {total.toLocaleString()} total
            </span>
          </div>

          {/* Table / loading / empty */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <RefreshCw size={32} className="animate-spin text-indigo-500" />
                <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">Loading audit logs…</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="p-6 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-300 dark:text-slate-500">
                  <ClipboardList size={48} />
                </div>
                <p className="text-slate-400 dark:text-slate-500 font-bold text-lg">No log entries found.</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700 transition-colors duration-300">
                    {[
                      { label: 'Timestamp',  icon: <Clock size={11} />,    w: 'w-[175px]' },
                      { label: 'User',       icon: <User size={11} />,     w: 'w-[130px]' },
                      { label: 'Action',     icon: null,                   w: 'w-[200px]' },
                      { label: 'Entity',     icon: <Database size={11} />, w: 'w-[120px]' },
                      { label: 'Entity ID',  icon: null,                   w: 'w-[110px]' },
                      { label: 'Details',    icon: null,                   w: '' },
                    ].map((col, i) => (
                      <th
                        key={col.label}
                        className={`px-6 py-4 text-[10px] font-black text-slate-600 dark:text-slate-300 tracking-widest border-b-2 border-slate-400 dark:border-slate-600 uppercase ${i < 5 ? 'border-r' : ''} ${col.w}`}
                      >
                        <span className="flex items-center gap-1">
                          {col.icon} {col.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">

                      {/* Timestamp */}
                      <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </td>

                      {/* User */}
                      <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300">
                        <span className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50 px-2.5 py-1 rounded-lg text-xs font-black">
                          <User size={10} /> {log.username || '—'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black whitespace-nowrap ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                          {ENTITY_ICONS[log.entity_type] || '📄'} {log.entity_type || '—'}
                        </span>
                      </td>

                      {/* Entity ID */}
                      <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300 max-w-[110px]" title={log.entity_id}>
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500 truncate block">
                          {log.entity_id || '—'}
                        </span>
                      </td>

                      {/* Details */}
                      <td className="px-6 py-3 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300 max-w-xs" title={log.details}>
                        <span className="text-sm text-slate-600 dark:text-slate-300 truncate block">{log.details || '—'}</span>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* ── PAGINATION ───────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-8 py-4 flex items-center justify-between shrink-0 transition-colors duration-300">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Showing{' '}
          <strong className="text-slate-700 dark:text-slate-200">{logs.length > 0 ? (page - 1) * limit + 1 : 0}</strong>
          {' – '}
          <strong className="text-slate-700 dark:text-slate-200">{Math.min(page * limit, total)}</strong>
          {' of '}
          <strong className="text-slate-700 dark:text-slate-200">{total.toLocaleString()}</strong>
          {' entries'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1 || isLoading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="px-3 py-2 text-sm font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </footer>

    </div>
  );
}
