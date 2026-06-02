import { useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, BarChart3, Settings, Wallet, UserCircle2, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

// Pag-import ng mga hiniwalay nating components
import LoginScreen from './components/LoginScreen';
import NavItem from './components/NavItem';
import DisbursementScreen from './components/DisbursementScreen';
import CostMonitoringScreen from './components/CostMonitoringScreen';
import ProjectsSetupScreen from './components/ProjectsSetupScreen';

// Pag-import ng data mula sa utils
import { API_URL } from './utils/constants';

export default function App() {
  const [userRole, setUserRole] = useState(null);
  const [activeTab, setActiveTab] = useState('disbursements');
  const [initialCostMonitoringProjectId, setInitialCostMonitoringProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [disbursements, setDisbursements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Parallel fetching for efficiency
      const [disbRes, projRes, catRes] = await Promise.all([
        fetch(`${API_URL}/disbursements`),
        fetch(`${API_URL}/projects`),
        fetch(`${API_URL}/categories`)
      ]);

      if (disbRes.ok) setDisbursements(await disbRes.json());
      if (projRes.ok) setProjects(await projRes.json());
      if (catRes.ok) setCategories(await catRes.json());

    } catch (error) {
      console.error("Hindi makakonekta sa Local Server.", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userRole) {
      fetchAllData();
    }
  }, [userRole]);

  const handleUpdateProject = (projectId, updatedValues) => {
    // Optimistic UI update
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, ...updatedValues } : p
    ));
    
    // Sync with backend
    fetch(`${API_URL}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedValues)
    });
  };

  const handleLogin = (role) => {
    setUserRole(role);
    setActiveTab(role === 'encoder' ? 'disbursements' : 'cost-monitoring');
  };

  const navigateToCostMonitoring = (projectId) => {
    setInitialCostMonitoringProjectId(projectId);
    setActiveTab('cost-monitoring');
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
          <NavItem isSidebarOpen={isSidebarOpen} active={activeTab === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
          <NavItem isSidebarOpen={isSidebarOpen} active={activeTab === 'disbursements'} icon={<Receipt size={20} />} label="Disbursements" onClick={() => setActiveTab('disbursements')} />
          <NavItem isSidebarOpen={isSidebarOpen} active={activeTab === 'cost-monitoring'} icon={<BarChart3 size={20} />} label="Cost Monitoring" onClick={() => setActiveTab('cost-monitoring')} />
          <NavItem isSidebarOpen={isSidebarOpen} active={activeTab === 'projects'} icon={<Settings size={20} />} label="Projects Setup" onClick={() => setActiveTab('projects')} />
        </nav>
        
        <div className={`p-4 border-t border-slate-800 flex flex-col gap-3 ${isSidebarOpen ? '' : 'items-center pb-6'}`}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <UserCircle2 size={16} className="shrink-0" />
              <span className="truncate">Logged in: <strong className="text-white uppercase tracking-wider">{userRole}</strong></span>
            </div>
          ) : (
            <UserCircle2 size={24} className="text-slate-400 shrink-0" title={`Naka-login bilang: ${userRole}`} />
          )}

          <button onClick={() => setUserRole(null)} className={`flex items-center text-red-400 hover:text-red-300 transition-colors bg-slate-800/50 rounded-md justify-center ${isSidebarOpen ? 'gap-2 p-2' : 'p-3'}`}>
            <LogOut size={isSidebarOpen ? 14 : 18} />
            {isSidebarOpen && <span className="text-xs">Mag-logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative w-full">
        {activeTab === 'disbursements' && (
          <DisbursementScreen 
            projects={projects} 
            categories={categories.map(c => c.name)} 
            disbursements={disbursements} 
            refreshData={fetchAllData} 
            isLoading={isLoading} 
            userRole={userRole} 
          />
        )}
        {activeTab === 'cost-monitoring' && (
          <CostMonitoringScreen 
            projects={projects} 
            disbursements={disbursements} 
            onUpdateProject={handleUpdateProject} 
            initialProjectId={initialCostMonitoringProjectId}
          />
        )}
        {activeTab === 'projects' && (
          <ProjectsSetupScreen 
            projects={projects} 
            categories={categories} 
            refreshData={fetchAllData} 
            onNavigateToCostMonitoring={navigateToCostMonitoring}
          />
        )}
      </main>
    </div>
  );
}