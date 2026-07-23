import { useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, BarChart3, Lock, User, AlertCircle, ArrowLeft, Sun, Moon } from 'lucide-react';
import { API_URL } from '../utils/Constants';
import FBTlogo from '../assets/FBTlogo.png';

export default function LoginScreen({ onLogin, isDarkMode, toggleTheme }) {
  const [view, setView] = useState('role-select'); // 'role-select', 'login'
  const [selectedRole, setSelectedRole] = useState(null);

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const closeForm = () => {
    setView('role-select');
    setSelectedRole(null);
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && view !== 'role-select' && !isLoading) {
        closeForm();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [view, isLoading]);

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setView('login');
    setError('');
    setUsername('');
    setPassword('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.role !== selectedRole) {
          setError(`This account does not belong to the ${selectedRole.toUpperCase()} portal.`);
          setIsLoading(false);
          return;
        }
        onLogin(data.role, data.username, data.token);
      } else {
        setError(data.error || 'Failed to login');
      }
    } catch {
      setError('Unable to connect to the server. Please check your network connection.');
    } finally {
      setIsLoading(false);
    }
  };



  // Dynamic Theming Mapping with Dark Mode classes
  const themeColors = {
    indigo: {
      bg: 'bg-indigo-600 dark:bg-indigo-700',
      bgHover: 'hover:bg-indigo-700 dark:hover:bg-indigo-600',
      text: 'text-indigo-600 dark:text-indigo-400',
      textHover: 'hover:text-indigo-600 dark:hover:text-indigo-400',
      shadow: 'shadow-indigo-200 dark:shadow-none',
      lightBg: 'bg-indigo-50 dark:bg-indigo-900/30',
      ring: 'focus:ring-indigo-500 dark:focus:ring-indigo-400'
    },
    emerald: {
      bg: 'bg-emerald-600 dark:bg-emerald-700',
      bgHover: 'hover:bg-emerald-700 dark:hover:bg-emerald-600',
      text: 'text-emerald-600 dark:text-emerald-400',
      textHover: 'hover:text-emerald-600 dark:hover:text-emerald-400',
      shadow: 'shadow-emerald-200 dark:shadow-none',
      lightBg: 'bg-emerald-50 dark:bg-emerald-900/30',
      ring: 'focus:ring-emerald-500 dark:focus:ring-emerald-400'
    },
    amber: {
      bg: 'bg-amber-600 dark:bg-amber-700',
      bgHover: 'hover:bg-amber-700 dark:hover:bg-amber-600',
      text: 'text-amber-600 dark:text-amber-400',
      textHover: 'hover:text-amber-600 dark:hover:text-amber-400',
      shadow: 'shadow-amber-200 dark:shadow-none',
      lightBg: 'bg-amber-50 dark:bg-amber-900/30',
      ring: 'focus:ring-amber-500 dark:focus:ring-amber-400'
    }
  };

  const getThemeColor = () => {
    if (selectedRole === 'encoder') return 'indigo';
    if (selectedRole === 'engineer') return 'emerald';
    if (selectedRole === 'ceo') return 'amber';
    return 'indigo';
  };

  const t = themeColors[getThemeColor()];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden transition-colors duration-300">

      {/* THEME TOGGLE */}
      {toggleTheme && (
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-all hover:scale-110 z-50 border border-slate-100 dark:border-slate-700 group"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun size={24} className="group-hover:rotate-90 transition-transform duration-500" /> : <Moon size={24} className="group-hover:-rotate-12 transition-transform duration-500" />}
        </button>
      )}

      {/* BRANDING SECTION */}
      <div className={`flex flex-col items-center text-center transition-all duration-500 mb-12`}>
        <div className={`mb-4 transform transition-all duration-500 hover:scale-110`}>
          <img src={FBTlogo} alt="FBTMCC Logo" className="w-40 h-auto object-contain drop-shadow-2xl" />
        </div>
        <h1 className={`font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none uppercase text-5xl`}>
          FBTMCC <span className={`text-indigo-600 dark:text-indigo-400 block mt-1 text-4xl mt-2`}>COST MONITORING</span>
        </h1>
        <div className="h-1.5 w-24 bg-indigo-600 dark:bg-indigo-500 rounded-full mt-6 shadow-sm shadow-indigo-100 dark:shadow-none"></div>
        <p className="text-slate-400 dark:text-slate-500 mt-6 font-bold uppercase tracking-[0.2em] text-sm">Select Your Access Role</p>
      </div>

      {/* VIEW: ROLE SELECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl px-4 z-10">
        <div onClick={() => handleRoleClick('encoder')} className="group bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-slate-800/80 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors"></div>
          <div className="bg-slate-100 dark:bg-slate-700 p-5 rounded-2xl text-slate-600 dark:text-slate-300 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-inner"><Receipt size={32} strokeWidth={2.5} /></div>
          <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100">ENCODER</h3>
          <p className="text-slate-400 dark:text-slate-500 mt-3 font-medium text-sm leading-relaxed">Daily encoding of financial <br /> disbursements & vouchers</p>
          <div className="mt-8 px-6 py-2 bg-slate-50 dark:bg-slate-900 rounded-full text-[10px] font-black text-slate-400 dark:text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase tracking-widest">Write Access</div>
        </div>

        <div onClick={() => handleRoleClick('engineer')} className="group bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-slate-800/80 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-colors"></div>
          <div className="bg-slate-100 dark:bg-slate-700 p-5 rounded-2xl text-slate-600 dark:text-slate-300 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-inner"><BarChart3 size={32} strokeWidth={2.5} /></div>
          <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100">OFFICE & ENG</h3>
          <p className="text-slate-400 dark:text-slate-500 mt-3 font-medium text-sm leading-relaxed">Office staff, admin, & engineers <br /> read-only financial tracking</p>
          <div className="mt-8 px-6 py-2 bg-slate-50 dark:bg-slate-900 rounded-full text-[10px] font-black text-slate-400 dark:text-slate-500 group-hover:bg-emerald-600 group-hover:text-white transition-all uppercase tracking-widest">Read Only</div>
        </div>

        <div onClick={() => handleRoleClick('ceo')} className="group bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50/30 dark:hover:bg-slate-800/80 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/20 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 transition-colors"></div>
          <div className="bg-slate-100 dark:bg-slate-700 p-5 rounded-2xl text-slate-600 dark:text-slate-300 mb-6 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300 shadow-inner"><LayoutDashboard size={32} strokeWidth={2.5} /></div>
          <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100">PRESIDENT / ADMIN</h3>
          <p className="text-slate-400 dark:text-slate-500 mt-3 font-medium text-sm leading-relaxed">Full system configuration <br /> & financial health view</p>
          <div className="mt-8 px-6 py-2 bg-slate-50 dark:bg-slate-900 rounded-full text-[10px] font-black text-slate-400 dark:text-slate-500 group-hover:bg-amber-600 group-hover:text-white transition-all uppercase tracking-widest">Full Access</div>
        </div>
      </div>

      <footer className="text-slate-400 dark:text-slate-600 text-[15px] font-black tracking-widest uppercase relative z-10 transition-all duration-500 mt-16">
        FBT Marketing and Construction Corp. © 2026
      </footer>

      {/* VIEW: MODAL OVERLAY */}
      {view !== 'role-select' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-300">

            {error && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} /> {error}
              </div>
            )}


            {view === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div className="text-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Selected Portal</span>
                  <h2 className={`text-xl font-black ${t.text} uppercase mt-1`}>{selectedRole === 'ceo' ? 'PRESIDENT' : selectedRole}</h2>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input type="text" required autoFocus value={username} onChange={e => setUsername(e.target.value)}
                      className={`w-full pl-10 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 ${t.ring} outline-none font-bold text-slate-700 dark:text-slate-200 transition-all`}
                      placeholder="Enter username" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      className={`w-full pl-10 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 ${t.ring} outline-none font-bold text-slate-700 dark:text-slate-200 transition-all`}
                      placeholder="••••••••" />
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className={`w-full py-4 ${t.bg} ${t.bgHover} text-white rounded-xl font-black tracking-wide shadow-lg ${t.shadow} transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-2`}>
                  {isLoading ? 'VERIFYING...' : 'LOGIN TO SYSTEM'}
                </button>

                <div className="flex items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button type="button" onClick={closeForm} className={`text-sm font-bold text-slate-500 dark:text-slate-400 ${t.textHover} transition-colors flex items-center gap-1`}>
                    <ArrowLeft size={14} /> Back to Roles
                  </button>
                </div>
              </form>
            )}


          </div>
        </div>
      )}

    </div>
  );
}