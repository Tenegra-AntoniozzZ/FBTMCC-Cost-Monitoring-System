import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, BarChart3, Settings, Wallet, UserCircle2, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import NavItem from './components/NavItem';
import DisbursementScreen from './components/DisbursementScreen';
import CostMonitoringScreen from './components/CostMonitoringScreen';
import ProjectsSetupScreen from './components/ProjectsSetupScreen';
import { API_URL } from './utils/Constants';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [userRole, setUserRole] = useState(() => localStorage.getItem('fbtmcc_role'));
  const [activeUsername, setActiveUsername] = useState(() => localStorage.getItem('fbtmcc_username') || '');
  const [initialCostMonitoringProjectId, setInitialCostMonitoringProjectId] = useState(null);
  
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutModal]);

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
    localStorage.clear();
    setUserRole(null);
    setActiveUsername('');
    setShowLogoutModal(false);
    navigate('/');
  };

  const navigateToCostMonitoring = (projectId) => {
    setInitialCostMonitoringProjectId(projectId);
    navigate('/cost-monitoring');
  };

  if (!userRole) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-[80px]'} bg-slate-900 text-slate-300 flex flex-col z-20 shadow-xl transition-all duration-300 shrink-0`}>
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
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-md">
            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          <NavItem isSidebarOpen={isSidebarOpen} active={location.pathname === '/dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => navigate('/dashboard')} />
          <NavItem isSidebarOpen={isSidebarOpen} active={location.pathname === '/disbursements'} icon={<Receipt size={20} />} label="Disbursements" onClick={() => navigate('/disbursements')} />
          <NavItem isSidebarOpen={isSidebarOpen} active={location.pathname === '/cost-monitoring'} icon={<BarChart3 size={20} />} label="Cost Monitoring" onClick={() => navigate('/cost-monitoring')} />
          {userRole !== 'engineer' && (
            <NavItem isSidebarOpen={isSidebarOpen} active={location.pathname === '/projects'} icon={<Settings size={20} />} label="Projects Setup" onClick={() => navigate('/projects')} />
          )}
        </nav>
        
        <div className={`p-4 border-t border-slate-800 flex flex-col gap-3 ${isSidebarOpen ? '' : 'items-center pb-6'}`}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <UserCircle2 size={16} className="shrink-0 text-blue-500" />
              <span className="truncate flex flex-col">
                <strong className="text-white tracking-wider">{activeUsername}</strong>
                <span className="text-[10px] uppercase">{userRole}</span>
              </span>
            </div>
          ) : (
            <UserCircle2 size={24} className="text-blue-500 shrink-0" title={`User: ${activeUsername} (${userRole})`} />
          )}

          <button onClick={() => setShowLogoutModal(true)} className={`flex items-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors bg-slate-800/50 rounded-md justify-center ${isSidebarOpen ? 'gap-2 p-2' : 'p-3'}`}>
            <LogOut size={isSidebarOpen ? 14 : 18} />
            {isSidebarOpen && <span className="text-xs font-bold">Log out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden relative w-full bg-[#f8fafc] flex flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/disbursements" />} />
          <Route path="/disbursements" element={<DisbursementScreen projects={projects} categories={categories.map(c => c.name)} disbursements={disbursements} refreshData={fetchAllData} isLoading={isLoading} userRole={userRole} />} />
          <Route path="/cost-monitoring" element={<CostMonitoringScreen projects={projects} disbursements={disbursements} onUpdateProject={handleUpdateProject} initialProjectId={initialCostMonitoringProjectId} userRole={userRole} refreshData={fetchAllData} />} />
          <Route path="/projects" element={<ProjectsSetupScreen projects={projects} categories={categories} refreshData={fetchAllData} onNavigateToCostMonitoring={navigateToCostMonitoring} />} />
        </Routes>
      </main>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 p-3 rounded-full text-red-600 mb-4">
                <LogOut size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Confirm Logout</h3>
              <p className="text-sm text-slate-500 font-medium mb-6">
                Are you sure you want to log out of your current session? You will need to sign in again to access the system.
              </p>
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-200"
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