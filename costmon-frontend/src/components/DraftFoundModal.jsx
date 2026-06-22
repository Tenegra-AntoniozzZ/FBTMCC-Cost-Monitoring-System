import { FileClock, RefreshCw, Trash2 } from 'lucide-react';

export default function DraftFoundModal({ isOpen, onRestore, onDiscard }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-4 rounded-full mb-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <FileClock size={32} strokeWidth={2} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            Draft Found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
            You have an unsaved draft from a previous session. Would you like to restore it and continue working?
          </p>
        </div>

        <div className="space-y-3">
          <button 
            onClick={onRestore}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} /> Restore Draft
          </button>
          
          <button 
            onClick={onDiscard}
            className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={18} /> Start New (Discard Draft)
          </button>
        </div>

      </div>
    </div>
  );
}