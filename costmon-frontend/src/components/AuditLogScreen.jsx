import { useState, useEffect, useRef } from 'react';
import {
  ClipboardList, Search, Filter, ChevronLeft, ChevronRight,
  X, User, Clock, Database, RefreshCw, Download
} from 'lucide-react';
import { API_URL } from '../utils/Constants';

const ACTION_COLORS = {
  CREATE_DISBURSEMENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  UPDATE_DISBURSEMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DELETE_DISBURSEMENT: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  CREATE_PROJECT: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  UPDATE_PROJECT: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  DELETE_PROJECT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  CREATE_USER: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  UPDATE_USER: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  DEACTIVATE_USER: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  ACTIVATE_USER: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
  UPLOAD_ATTACHMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  DELETE_ATTACHMENT: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  LOGIN: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  RESET_PASSWORD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  CHANGE_PASSWORD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  CREATE_CATEGORY: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  DELETE_CATEGORY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ENTITY_ICONS = {
  disbursement: '🧾',
  project: '🏗️',
  user: '👤',
  category: '🏷️',
  session: '🔐',
};

const ALL_ACTIONS = [
  'CREATE_DISBURSEMENT', 'UPDATE_DISBURSEMENT', 'DELETE_DISBURSEMENT',
  'CREATE_PROJECT', 'UPDATE_PROJECT', 'DELETE_PROJECT',
  'CREATE_USER', 'UPDATE_USER', 'ACTIVATE_USER', 'DEACTIVATE_USER',
  'UPLOAD_ATTACHMENT', 'DELETE_ATTACHMENT',
  'LOGIN', 'RESET_PASSWORD', 'CHANGE_PASSWORD',
  'CREATE_CATEGORY', 'DELETE_CATEGORY'
];

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

export default function AuditLogScreen({ isDark }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [filterUsername, setFilterUsername] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const token = localStorage.getItem('fbtmcc_token');

  const fetchLogs = async (pg = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit });
      if (filterUsername) params.append('username', filterUsername);
      if (filterAction) params.append('action', filterAction);
      if (filterEntity) params.append('entity_type', filterEntity);
      if (filterStart) params.append('startDate', filterStart);
      if (filterEnd) params.append('endDate', filterEnd);

      const res = await fetch(`${API_URL}/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setPage(pg);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleExportCSV = () => {
    const header = 'Timestamp,Username,Action,Entity Type,Entity ID,Details';
    const rows = logs.map(l =>
      [formatTimestamp(l.timestamp), l.username, l.action, l.entity_type, l.entity_id, '"' + (l.details || '').replace(/"/g, '""') + '"'].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_page${page}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0a] transition-colors duration-300 overflow-hidden">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white">Audit Trail</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              {total.toLocaleString()} total log {total === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(page)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-violet-200 dark:shadow-none"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-3 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Username search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by user..."
              value={filterUsername}
              onChange={e => setFilterUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs(1)}
              className="pl-8 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 w-40 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Action filter */}
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Actions</option>
            {ALL_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Entity filter */}
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Entities</option>
            <option value="disbursement">Disbursement</option>
            <option value="project">Project</option>
            <option value="user">User</option>
            <option value="category">Category</option>
            <option value="session">Session</option>
          </select>

          {/* Date range */}
          <input
            type="date"
            value={filterStart}
            onChange={e => setFilterStart(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={filterEnd}
            onChange={e => setFilterEnd(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          <button
            onClick={() => fetchLogs(1)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Apply
          </button>
          {(filterUsername || filterAction || filterEntity || filterStart || filterEnd) && (
            <button
              onClick={() => {
                setFilterUsername(''); setFilterAction(''); setFilterEntity('');
                setFilterStart(''); setFilterEnd('');
                setTimeout(() => fetchLogs(1), 0);
              }}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={32} className="animate-spin text-violet-500" />
              <p className="text-slate-400 font-medium text-sm">Loading audit logs...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-300 dark:text-slate-600">
                <ClipboardList size={48} />
              </div>
              <p className="text-slate-400 dark:text-slate-500 font-bold text-lg">Walang nahanap na log entries.</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b-2 border-slate-300 dark:border-slate-600 transition-colors duration-300">
                <th className="px-4 py-4 w-[160px]">
                  <span className="flex items-center gap-1"><Clock size={11} /> Timestamp</span>
                </th>
                <th className="px-4 py-4 w-[120px]">
                  <span className="flex items-center gap-1"><User size={11} /> User</span>
                </th>
                <th className="px-4 py-4 w-[200px]">Action</th>
                <th className="px-4 py-4 w-[120px]">
                  <span className="flex items-center gap-1"><Database size={11} /> Entity</span>
                </th>
                <th className="px-4 py-4 w-[100px]">Entity ID</th>
                <th className="px-4 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                  <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-lg text-xs font-bold">
                      <User size={10} /> {log.username || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                    {ENTITY_ICONS[log.entity_type] || '📄'} {log.entity_type || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-400 dark:text-slate-500 truncate max-w-[100px]" title={log.entity_id}>
                    {log.entity_id || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.details}>
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINATION */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between shrink-0 transition-colors duration-300">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Showing {logs.length > 0 ? ((page - 1) * limit + 1) : 0}–{Math.min(page * limit, total)} of <strong>{total.toLocaleString()}</strong> entries
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1 || isLoading}
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="text-sm font-black text-slate-700 dark:text-slate-300 px-2">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
