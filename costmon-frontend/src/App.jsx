import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, BarChart3, Settings, Wallet, UserCircle2, LogOut, PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import NavItem from './components/NavItem';
import DisbursementScreen from './components/DisbursementScreen';
import CostMonitoringScreen from './components/CostMonitoringScreen';
import ProjectsSetupScreen from './components/ProjectsSetupScreen';
import GlobalSearchModal from './components/GlobalSearchModal';
import { API_URL } from './utils/Constants';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [userRole, setUserRole] = useState(() => localStorage.getItem('fbtmcc_role'));
  const [activeUsername, setActiveUsername] = useState(() => localStorage.getItem('fbtmcc_username') || '');
  const [initialCostMonitoringProjectId, setInitialCostMonitoringProjectId] = useState(null);
  const [initialDisbursementSearch, setInitialDisbursementSearch] = useState('');
  const [initialDisbursementId, setInitialDisbursementId] = useState(null);

  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

  // ==========================================
  // DARK MODE LOGIC (CINEMATIC RIPPLE ANIMATION)
  // ==========================================
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('fbtmcc_theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }
    }
    return false; 
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('fbtmcc_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('fbtmcc_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = (e) => {
    if (!document.startViewTransition) {
      setIsDarkMode((prevMode) => !prevMode);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const isDark = isDarkMode;

    const transition = document.startViewTransition(() => {
      setIsDarkMode((prevMode) => !prevMode);
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];
      
      document.documentElement.animate(
        {
          clipPath: isDark ? [...clipPath].reverse() : clipPath
        },
        {
          duration: 1200, // PINABAGAL: Ginawang 1.2 seconds para kitang-kita ang bagsak ng kulay!
          easing: 'ease-in-out',
          pseudoElement: isDark 
            ? '::view-transition-old(root)' 
            : '::view-transition-new(root)' 
        }
      );
    });
  };
  // ==========================================

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    const token = localStorage.getItem('fbtmcc_token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    try {
      const [disbRes, projRes, catRes] = await Promise.all([
        fetch(`${API_URL}/disbursements`, { headers }),
        fetch(`${API_URL}/projects`, { headers }),
        fetch(`${API_URL}/categories`, { headers })
      ]);
      if (disbRes.ok) setDisbursements(await disbRes.json());
      if (projRes.ok) setProjects(await projRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (error) { 
      console.error("Error fetching data:", error); 
    } finally { 
      setIsLoading(false); 
    }
  }, []);

  useEffect(() => {
    if (userRole) {
      const timer = setTimeout(() => {
        fetchAllData().catch(console.error);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [userRole, fetchAllData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showLogoutModal) {
        setShowLogoutModal(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (!isAnyModalOpen && !showLogoutModal) {
          e.preventDefault();
          setIsSearchOpen(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutModal, isAnyModalOpen]);

  useEffect(() => {
    if (showLogoutModal || isSearchOpen || isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showLogoutModal, isSearchOpen, isAnyModalOpen]);

  const handleUpdateProject = (projectId, updatedValues) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updatedValues } : p));
    fetch(`${API_URL}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
      },
      body: JSON.stringify(updatedValues)
    });
  };

  const handleLogin = (role, username, token) => {
    localStorage.setItem('fbtmcc_token', token);
    localStorage.setItem('fbtmcc_role', role);
    localStorage.setItem('fbtmcc_username', username);
    setUserRole(role);
    setActiveUsername(username);
    navigate(role === 'encoder' ? '/disbursements' : '/cost-monitoring');
  };

  const handleLogout = () => {
    localStorage.removeItem('fbtmcc_token');
    localStorage.removeItem('fbtmcc_role');
    localStorage.removeItem('fbtmcc_username');
    
    setInitialDisbursementSearch('');
    setInitialCostMonitoringProjectId(null);
    setIsAnyModalOpen(false);
    
    setUserRole(null);
    setActiveUsername('');
    setShowLogoutModal(false);
    navigate('/');
  };

  const navigateToCostMonitoring = (projectId) => {
    setInitialCostMonitoringProjectId(projectId);
    navigate('/cost-monitoring');
  };

  const navigateToDisbursement = (cvNo, disbursementId = null) => {
    setInitialDisbursementSearch(cvNo || '');
    setInitialDisbursementId(disbursementId);
    navigate('/disbursements');
  };

  if (!userRole) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-300 transition-colors duration-300">
      
      {/* SIDEBAR */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-[80px]'} bg-slate-900 dark:bg-[#050505] text-slate-300 flex flex-col z-20 shadow-xl transition-all duration-300 shrink-0 border-r border-transparent dark:border-slate-800/50`}>
        <div className={`p-4 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col gap-4 pt-6'} min-h-[80px]`}>
          {isSidebarOpen ? (
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Wallet className="text-blue-500 shrink-0" /> CostMon.
              </h1>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Financial System</p>
            </div>
          ) : (
            <Wallet className="text-blue-500 shrink-0" size={28} />
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 dark:hover:bg-slate-900 rounded-md">
            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          <NavItem isSidebarOpen={isSidebarOpen} active={location.pathname === '/dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => navigate('/dashboard')} />
          <NavItem isSidebarOpen={isSidebarOpen} active={location.pathname === '/disbursements'} icon={<Receipt size={20} />} label="Disbursements" onClick={() => navigate('/disbursements')} />
          <NavItem isSidebarOpen={isSidebarOpen} active={location.pathname === '/cost-monitoring'} icon={<BarChart3 size={20} />} label="Cost Monitoring" onClick={() => navigate('/cost-monitoring')} />
          
          {userRole === 'ceo' && (
            <NavItem isSidebarOpen={isSidebarOpen} active={location.pathname === '/projects'} icon={<Settings size={20} />} label="Projects Setup" onClick={() => navigate('/projects')} />
          )}
        </nav>

        <div className={`p-4 border-t border-slate-800 dark:border-slate-800/80 flex flex-col gap-3 ${isSidebarOpen ? '' : 'items-center pb-6'}`}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <UserCircle2 size={16} className="shrink-0 text-blue-500" />
              <span className="truncate flex flex-col">
                <strong className="text-white tracking-wider">{activeUsername}</strong>
                <span className="text-[10px] uppercase">{userRole === 'ceo' ? 'President' : userRole}</span>
              </span>
            </div>
          ) : (
            <UserCircle2 size={24} className="text-blue-500 shrink-0" title={`User: ${activeUsername} (${userRole === 'ceo' ? 'President' : userRole})`} />
          )}

          <div className={`flex ${isSidebarOpen ? 'gap-2' : 'flex-col gap-2'}`}>
            <button 
              onClick={(e) => toggleTheme(e)} 
              className={`flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-colors bg-slate-800/50 rounded-md ${isSidebarOpen ? 'p-2' : 'p-3'}`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={isSidebarOpen ? 16 : 18} /> : <Moon size={isSidebarOpen ? 16 : 18} />}
            </button>

            <button 
              onClick={() => setShowLogoutModal(true)} 
              className={`flex-[3] flex items-center text-red-400 hover:text-red-300 hover:bg-red-500/10 dark:bg-red-950/20 dark:hover:bg-red-900/40 transition-colors bg-slate-800/50 rounded-md justify-center ${isSidebarOpen ? 'gap-2 p-2' : 'p-3'}`}
              title="Log out"
            >
              <LogOut size={isSidebarOpen ? 14 : 18} />
              {isSidebarOpen && <span className="text-xs font-bold">Log out</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden relative w-full bg-[#f8fafc] dark:bg-slate-950 flex flex-col transition-colors duration-300">
        <Routes>
          <Route path="/" element={<Navigate to="/disbursements" />} />
          <Route 
            path="/disbursements" 
            element={
              <DisbursementScreen 
                projects={projects} 
                categories={categories.map(c => c.name)} 
                disbursements={disbursements} 
                refreshData={fetchAllData} 
                isLoading={isLoading} 
                userRole={userRole} 
                initialSearchQuery={initialDisbursementSearch} 
                initialDisbursementId={initialDisbursementId}
                onClearInitialDisbursement={() => {
                  setInitialDisbursementSearch('');
                  setInitialDisbursementId(null);
                }}
                onModalStateChange={setIsAnyModalOpen} 
              />
            } 
          />
          <Route 
            path="/cost-monitoring" 
            element={
              <CostMonitoringScreen 
                projects={projects} 
                disbursements={disbursements} 
                onUpdateProject={handleUpdateProject} 
                initialProjectId={initialCostMonitoringProjectId} 
                userRole={userRole} 
                refreshData={fetchAllData} 
                onNavigateToDisbursement={navigateToDisbursement}
                onModalStateChange={setIsAnyModalOpen} 
              />
            } 
          />
          <Route 
            path="/projects" 
            element={
              userRole === 'ceo' ? (
                <ProjectsSetupScreen projects={projects} categories={categories} refreshData={fetchAllData} onNavigateToCostMonitoring={navigateToCostMonitoring} onModalStateChange={setIsAnyModalOpen} />
              ) : (
                <Navigate to="/cost-monitoring" replace />
              )
            } 
          />
        </Routes>
      </main>

      {/* GLOBAL SEARCH MODAL */}
      <GlobalSearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        disbursements={disbursements} 
        projects={projects}
        onNavigateToDisbursement={navigateToDisbursement}
        onNavigateToProject={navigateToCostMonitoring}
      />

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 dark:bg-red-950/50 p-3 rounded-full text-red-600 dark:text-red-400 mb-4">
                <LogOut size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Confirm Logout</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">
                Are you sure you want to log out of your current session? You will need to sign in again to access the system.
              </p>
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-200 dark:shadow-none"
                >
                  Yes, Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}