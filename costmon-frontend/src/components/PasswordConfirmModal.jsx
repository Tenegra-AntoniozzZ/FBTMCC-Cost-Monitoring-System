import { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { API_URL } from '../utils/Constants';

export default function PasswordConfirmModal({ isOpen, onClose, onConfirm, actionType = 'update' }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isVerifying) {
        setPassword('');
        setError('');
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isVerifying, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    const username = sessionStorage.getItem('fbtmcc_username');
    const token = sessionStorage.getItem('fbtmcc_token'); 

    try {
      const res = await fetch(`${API_URL}/verify-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onConfirm(); 
        setPassword('');
        setShowPassword(false);
      } else {
        setError(data.error || 'Incorrect password.');
      }
    } catch {
      setError('Server connection error. Please check if the backend is running.');
    } finally {
      setIsVerifying(false);
    }
  };

  const isDelete = actionType === 'delete';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl shadow-2xl p-8 w-full max-w-sm border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`p-4 rounded-full mb-4 ${isDelete ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 animate-pulse' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
            {isDelete ? <AlertCircle size={32} strokeWidth={2.5} /> : <KeyRound size={32} strokeWidth={2} />}
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            {isDelete ? 'Confirm Deletion' : 'Security Check'}
          </h3>
          
          {isDelete ? (
            <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 rounded-xl">
              <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <AlertCircle size={14} /> Warning
              </p>
              <p className="text-xs font-bold text-rose-500 dark:text-rose-400 leading-relaxed">
                Are you sure? This data will be <span className="underline decoration-2">PERMANENTLY DELETED</span> and cannot be recovered.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
              Please enter your password to confirm this {isDelete ? 'deletion' : 'update'}.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'}
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:bg-white dark:focus:bg-black focus:ring-2 outline-none font-bold text-slate-700 dark:text-slate-200 transition-all text-center tracking-widest ${isDelete ? 'focus:ring-red-500 dark:focus:ring-red-500' : 'focus:ring-blue-500 dark:focus:ring-blue-500'}`} 
              placeholder="••••••••" 
              autoFocus
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex w-full gap-3 pt-2">
            <button 
              type="button"
              disabled={isVerifying}
              onClick={() => {
                setPassword('');
                setError('');
                onClose();
              }}
              className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isVerifying || !password}
              className={`flex-1 py-3.5 text-white font-bold rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 ${isDelete ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none'}`}
            >
              {isVerifying ? <Loader2 size={18} className="animate-spin" /> : 'Confirm'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}