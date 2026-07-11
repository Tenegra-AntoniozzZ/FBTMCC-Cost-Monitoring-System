import { useState, useEffect, useRef } from 'react';
import {
  HardDrive, Download, Upload, ShieldAlert, Eye, EyeOff,
  AlertTriangle, CheckCircle2, Loader2, X, FolderOpen,
  FileWarning, Info, KeyRound, Save, Database
} from 'lucide-react';
import { API_URL } from '../utils/Constants';

// ─── Action Modal ──────────────────────────────────────────────
function DbActionModal({ isOpen, mode, onClose, onExportConfirm, onImportConfirm }) {
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [selectedFile,  setSelectedFile]  = useState(null);
  const [error,         setError]         = useState('');
  const [isLoading,     setIsLoading]     = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPassword(''); setShowPassword(false);
      setSelectedFile(null); setError(''); setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen && !isLoading) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const isExport = mode === 'export';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password.trim()) { setError('Password is required.'); return; }
    if (!isExport && !selectedFile) { setError('Please select a .db file to import.'); return; }
    setIsLoading(true);
    try {
      isExport ? await onExportConfirm(password) : await onImportConfirm(password, selectedFile);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.db')) { setError('Invalid file type. Only .db files are accepted.'); setSelectedFile(null); return; }
    setError(''); setSelectedFile(file);
  };

  // Input class — matches ProjectsSetup
  const inputCls = 'w-full px-4 py-3 rounded-xl border-2 border-slate-400 dark:border-slate-600 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm transition-colors duration-300 text-center tracking-widest';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 overflow-hidden transition-colors duration-300">

        {/* Modal stripe header */}
        <div className={`px-8 py-5 flex items-center justify-between ${isExport ? 'bg-indigo-600 dark:bg-indigo-700' : 'bg-rose-600 dark:bg-rose-700'}`}>
          <div className="flex items-center gap-3 text-white">
            {isExport ? <Download size={22} /> : <Upload size={22} />}
            <div>
              <h2 className="text-lg font-black tracking-tight">{isExport ? 'Export Database' : 'Import Database'}</h2>
              <p className="text-xs text-white/70 font-medium mt-0.5">Enter your login password to confirm</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isLoading} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 disabled:opacity-40">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-5">
          {/* Export info notice */}
          {isExport && (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/15 border border-indigo-200 dark:border-indigo-800/50 rounded-xl transition-colors duration-300">
              <div className="flex items-center gap-2 mb-1.5">
                <Info size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">What will be exported</span>
              </div>
              <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
                Exporting a full backup of <strong>Projects</strong>, <strong>Disbursements</strong>, <strong>Expense Categories</strong>, <strong>Users</strong>, and <strong>Audit Logs</strong>.
                The file will download as a timestamped <code className="bg-indigo-100 dark:bg-indigo-900/40 px-1 py-0.5 rounded text-xs font-mono">.db</code> file.
              </p>
            </div>
          )}

          {/* Import danger notice */}
          {!isExport && (
            <div className="p-4 bg-rose-50/50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800/50 rounded-xl transition-colors duration-300">
              <div className="flex items-center gap-2 mb-1.5">
                <FileWarning size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest animate-pulse">⚠ Severe Warning</span>
              </div>
              <p className="text-sm text-rose-700 dark:text-rose-300 font-semibold leading-relaxed">
                Importing will{' '}
                <span className="underline decoration-2 decoration-rose-500 font-black">PERMANENTLY REPLACE ALL EXISTING SYSTEM DATA</span>{' '}
                — Projects, Disbursements, Users, and Audit Logs. This action <strong>cannot be undone</strong>.
              </p>
            </div>
          )}

          {/* File picker (import only) */}
          {!isExport && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">Database File (.db)</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-dashed border-slate-400 dark:border-slate-600 rounded-xl hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-all group"
              >
                <FolderOpen size={20} className="text-slate-400 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shrink-0" />
                <span className={`text-sm font-bold truncate ${selectedFile ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {selectedFile ? selectedFile.name : 'Click to browse for a .db file…'}
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept=".db" onChange={handleFileChange} className="hidden" />
              {selectedFile && (
                <p className="text-xs text-slate-400 dark:text-slate-500 ml-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              )}
            </div>
          )}

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase flex items-center gap-1.5">
              <KeyRound size={11} /> Your Login Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus={isExport}
                required
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-bold border border-rose-100 dark:border-rose-800/50 animate-in slide-in-from-top-2">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !password}
              className={`flex-[2] py-3 text-white font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${isExport ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100 dark:shadow-none'}`}
            >
              {isLoading
                ? <><Loader2 size={18} className="animate-spin" /> {isExport ? 'Exporting…' : 'Importing…'}</>
                : <>{isExport ? <Download size={18} /> : <Upload size={18} />} {isExport ? 'Export Now' : 'Replace Database'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Initial Confirmation Modal ──────────────────────────────────
// Sits BEFORE the password modal. DbActionModal is not changed at all.
function ConfirmModal({ isOpen, mode, onCancel, onProceed }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isExport = mode === 'export';

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 overflow-hidden transition-colors duration-300">

        {/* Stripe header */}
        <div className={`px-8 py-5 flex items-center gap-3 ${
          isExport ? 'bg-indigo-600 dark:bg-indigo-700' : 'bg-rose-600 dark:bg-rose-700'
        }`}>
          <div className="p-2 bg-white/20 rounded-xl text-white">
            {isExport ? <Download size={20} /> : <Upload size={20} />}
          </div>
          <div className="text-white">
            <h2 className="text-lg font-black tracking-tight">Confirm {isExport ? 'Export' : 'Import'}</h2>
            <p className="text-xs text-white/70 font-medium mt-0.5">Please review before continuing</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed mb-2">
            Are you sure you want to continue with the database
            {' '}<span className={`font-black ${isExport ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isExport ? 'export' : 'import'}
            </span>?
          </p>

          {/* Contextual reminder */}
          {isExport ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6">
              This will download a full copy of <strong>costmon_local.db</strong> including all Projects, Disbursements, Users, and Audit Logs.
            </p>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-xl mb-6 transition-colors duration-300">
              <ShieldAlert size={14} className="text-rose-500 dark:text-rose-400 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 leading-snug">
                This will <span className="underline">permanently overwrite</span> all existing system data. Make sure you have a backup before proceeding.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              className={`flex-[2] py-3 text-white font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                isExport
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100 dark:shadow-none'
              }`}
            >
              {isExport ? <Download size={16} /> : <Upload size={16} />}
              Yes, {isExport ? 'Export' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Success Toast ─────────────────────────────────────────────
function SuccessToast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-[80] flex items-center gap-3 px-5 py-4 bg-emerald-500 text-white rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <CheckCircle2 size={20} className="shrink-0" />
      <span className="font-bold text-sm">{message}</span>
      <button onClick={onDismiss} className="ml-2 hover:opacity-70 transition-opacity"><X size={16} /></button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function DatabaseManagement() {
  // ── Step 1: initial confirmation ────────────────────────────
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction,    setPendingAction]    = useState(null); // null | 'export' | 'import'

  // ── Step 2: password modal (DbActionModal — unchanged) ──────
  const [modalMode, setModalMode] = useState(null);   // null | 'export' | 'import'
  const [toast,     setToast]     = useState(null);

  // Open confirmation modal first
  const handleInitialClick = (actionType) => {
    setPendingAction(actionType);
    setShowConfirmModal(true);
  };

  // User clicked "Yes" in the confirmation modal
  const handleProceedConfirm = () => {
    setShowConfirmModal(false);
    setModalMode(pendingAction); // hand off to the existing password modal
  };

  // User clicked "Cancel" in the confirmation modal
  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setPendingAction(null);
  };

  const getAuthHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('fbtmcc_token')}` });

  // ── Export ──────────────────────────────────────────────────
  const handleExportConfirm = async (password) => {
    const response = await fetch(`${API_URL}/db/export`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      let errMsg = 'Export failed.';
      try { const d = await response.json(); errMsg = d.error || errMsg; } catch (_) {}
      throw new Error(errMsg);
    }
    const disposition = response.headers.get('content-disposition') || '';
    const match       = disposition.match(/filename="?([^"]+)"?/);
    const filename    = match ? match[1] : `costmon_backup_${Date.now()}.db`;
    const blob = await response.blob();
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
    setModalMode(null);
    setToast(`Database exported as "${filename}" successfully.`);
  };

  // ── Import ──────────────────────────────────────────────────
  const handleImportConfirm = async (password, file) => {
    const formData = new FormData();
    formData.append('password', password);
    formData.append('dbFile', file);
    const response = await fetch(`${API_URL}/db/import`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Import failed.');
    setModalMode(null);
    setToast('Database imported successfully! A server restart is recommended.');
  };

  // ─── card definitions ─────────────────────────────────────
  const cards = [
    {
      mode:        'export',
      icon:        <Download size={24} />,
      title:       'Export Database',
      badge:       'Backup',
      badgeCls:    'text-indigo-600 dark:text-indigo-400',
      description: 'Download a complete snapshot of costmon_local.db — including all Projects, Disbursements, Users, and Audit Logs — as a portable timestamped backup file.',
      tags:        ['Projects', 'Disbursements', 'Categories', 'Users', 'Audit Logs'],
      tagCls:      'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50',
      iconBg:      'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
      hoverGlow:   'hover:shadow-indigo-900/10 dark:hover:shadow-indigo-900/20',
      blob:        'bg-indigo-100 dark:bg-indigo-900/20',
      btn:         'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none',
      notice:      null,
    },
    {
      mode:        'import',
      icon:        <Upload size={24} />,
      title:       'Import Database',
      badge:       'Restore',
      badgeCls:    'text-rose-500 dark:text-rose-400',
      description: 'Upload a previously exported .db file to fully restore the system. This will permanently overwrite all current data.',
      tags:        null,
      iconBg:      'bg-rose-100 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400',
      hoverGlow:   'hover:shadow-rose-900/10 dark:hover:shadow-rose-900/20',
      blob:        'bg-rose-100 dark:bg-rose-900/20',
      btn:         'bg-rose-600 hover:bg-rose-700 shadow-rose-100 dark:shadow-none',
      notice: (
        <div className="flex items-start gap-2 mb-5 p-3 bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800/50 rounded-xl transition-colors duration-300">
          <ShieldAlert size={14} className="text-rose-500 dark:text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400 leading-snug">
            This will <span className="underline">permanently erase</span> all current data and cannot be undone.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 overflow-hidden transition-colors duration-300">

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between shrink-0 shadow-sm transition-colors duration-300">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <div className="bg-indigo-600 dark:bg-indigo-700 p-2 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <HardDrive size={28} />
            </div>
            DATABASE MANAGEMENT
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Backup or restore the system's SQLite database · Login password required
          </p>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          {cards.map(card => (
            <div
              key={card.mode}
              className={`group relative bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl ${card.hoverGlow} transition-all duration-300 overflow-hidden`}
            >
              {/* Decorative blob */}
              <div className={`absolute -top-10 -right-10 w-40 h-40 ${card.blob} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

              {/* Card header bar */}
              <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between relative z-10">
                <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${card.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                    {card.icon}
                  </div>
                  {card.title}
                </h2>
                <span className={`px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-xs font-black tracking-widest transition-colors duration-300 ${card.badgeCls}`}>
                  {card.badge}
                </span>
              </div>

              {/* Card body */}
              <div className="p-8 relative z-10">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-5">
                  {card.description}
                </p>

                {/* Tags */}
                {card.tags && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {card.tags.map(tag => (
                      <span key={tag} className={`px-2.5 py-1 text-xs font-black rounded-full ${card.tagCls}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Inline notice (import only) */}
                {card.notice}

                <button
                  id={`btn-${card.mode}-database`}
                  onClick={() => handleInitialClick(card.mode)}
                  className={`w-full flex items-center justify-center gap-2.5 py-3.5 text-white font-black rounded-xl shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${card.btn}`}
                >
                  {card.icon} {card.title}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Security notice — matches ProjectsSetup's message bar style */}
        <div className="mt-8 max-w-4xl flex items-start gap-3 px-6 py-4 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 rounded-2xl transition-colors duration-300">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
            Both operations are verified using your <strong>login password</strong> and require an active CEO session.
            After a successful import, a <strong>server restart</strong> is recommended to refresh all database connections.
          </p>
        </div>

      </main>

      {/* ── STEP 1: CONFIRM MODAL (new, inserted before password modal) ── */}
      <ConfirmModal
        isOpen={showConfirmModal}
        mode={pendingAction}
        onCancel={handleCancelConfirm}
        onProceed={handleProceedConfirm}
      />

      {/* ── STEP 2: PASSWORD MODAL (DbActionModal — logic untouched) ────── */}
      <DbActionModal
        isOpen={modalMode !== null}
        mode={modalMode}
        onClose={() => setModalMode(null)}
        onExportConfirm={handleExportConfirm}
        onImportConfirm={handleImportConfirm}
      />

      {/* ── TOAST ────────────────────────────────────────────── */}
      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
