import { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Receipt, ArrowRight } from 'lucide-react';

export default function GlobalSearchModal({ isOpen, onClose, disbursements, projects, onNavigateToDisbursement, onNavigateToProject }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setQuery('');
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filteredDisbursements = disbursements.filter(d => 
    d.cv_no?.toLowerCase().includes(query.toLowerCase()) ||
    d.payee?.toLowerCase().includes(query.toLowerCase()) ||
    d.particulars?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  const filteredProjects = projects.filter(p => 
    p.project_name?.toLowerCase().includes(query.toLowerCase()) ||
    p.project_code?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <Search className="text-blue-500" size={24} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search CV No, Payee, Project Name..."
            className="flex-1 text-xl font-bold outline-none placeholder:text-slate-300"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-400 bg-slate-50 border border-slate-200 rounded-md">
            ESC
          </kbd>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
          {query.trim() === '' ? (
            <div className="p-10 text-center text-slate-400">
              <Search size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-medium">Type something to search across the system...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Disbursements Section */}
              {filteredDisbursements.length > 0 && (
                <div>
                  <h3 className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Receipt size={12} /> Disbursements
                  </h3>
                  <div className="space-y-1">
                    {filteredDisbursements.map(d => (
                      <button
                        key={d.id}
                        onClick={() => { onNavigateToDisbursement(d.cv_no); onClose(); }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-2xl transition-all group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-mono text-xs font-black">
                            CV
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{d.cv_no}</div>
                            <div className="text-xs text-slate-500 font-medium truncate max-w-[300px]">{d.payee} — {d.particulars}</div>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects Section */}
              {filteredProjects.length > 0 && (
                <div>
                  <h3 className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={12} /> Projects
                  </h3>
                  <div className="space-y-1">
                    {filteredProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { onNavigateToProject(p.id); onClose(); }}
                        className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-2xl transition-all group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-mono text-xs font-black">
                            PROJ
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{p.project_name}</div>
                            <div className="text-xs text-slate-500 font-medium tracking-wider">{p.project_code}</div>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredDisbursements.length === 0 && filteredProjects.length === 0 && (
                <div className="p-10 text-center text-slate-400">
                  <p className="font-medium">No results found for "{query}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">Enter</kbd> Select</span>
          </div>
          <span>FBTMCC COST MONITORING SYSTEM</span>
        </div>
      </div>
    </div>
  );
}
