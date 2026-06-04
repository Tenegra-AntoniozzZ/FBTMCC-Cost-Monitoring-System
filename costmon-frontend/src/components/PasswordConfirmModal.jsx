import { useState } from 'react';
import { KeyRound, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { API_URL } from '../utils/Constants';

export default function PasswordConfirmModal({ isOpen, onClose, onConfirm, actionType = 'update' }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    const username = localStorage.getItem('fbtmcc_username');

    try {
      const res = await fetch(`${API_URL}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onConfirm(); // Success! Trigger the requested action
        setPassword('');
        setShowPassword(false);
      } else {
        setError(data.error || 'Mali ang password.');
      }
    } catch (err) {
      console.error('Password Verification Error:', err);
      setError('Server connection error. Please check if the backend is running.');
    } finally {
      setIsVerifying(false);
    }
  };

  const isDelete = actionType === 'delete';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm border border-slate-100 animate-in zoom-in-95 duration-200">
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`p-4 rounded-full mb-4 ${isDelete ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            <KeyRound size={32} strokeWidth={2} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">
            Security Check
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-2">
            Please enter your password to confirm this {isDelete ? 'deletion' : 'update'}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'}
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 outline-none font-bold text-slate-700 transition-all text-center tracking-widest ${isDelete ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} 
              placeholder="••••••••" 
              autoFocus
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isVerifying || !password}
              className={`flex-1 py-3.5 text-white font-bold rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 ${isDelete ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
            >
              {isVerifying ? <Loader2 size={18} className="animate-spin" /> : 'Confirm'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
