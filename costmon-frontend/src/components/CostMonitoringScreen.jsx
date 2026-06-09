import { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Wallet,
  Calendar,
  Receipt,
  Save,
  Trash2
} from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';
import PasswordConfirmModal from './PasswordConfirmModal';
import LoadingOverlay from './LoadingOverlay';
import { API_URL } from '../utils/Constants';

export default function CostMonitoringScreen({ projects, disbursements, onUpdateProject, initialProjectId, userRole, refreshData }) {
  const canEdit = userRole === 'encoder';
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || projects[0]?.id || '');
  const [prevInitialProjectId, setPrevInitialProjectId] = useState(initialProjectId);

  useEffect(() => {
    if (initialProjectId !== prevInitialProjectId) {
      setPrevInitialProjectId(initialProjectId);
      if (initialProjectId) {
        setIsSwitching(true);
        setSelectedProjectId(initialProjectId);
        setTimeout(() => setIsSwitching(false), 1000);
      }
    }
  }, [initialProjectId, prevInitialProjectId]);

  const project = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
    [projects, selectedProjectId]
  );

  // Local state for editable fields to ensure snappy UI
  const [editingValues, setEditingValues] = useState(() => {
    const p = projects.find(item => item.id === (initialProjectId || projects[0]?.id || ''));
    if (p) {
      return {
        contract_cost: p.contract_cost || 0,
        profit_percentage: p.profit_percentage || 0.20,
        project_area: p.project_area || '',
        project_start: p.project_start || '',
        days_end: p.days_end || ''
      };
    }
    return {};
  });

  useEffect(() => {
    if (project) {
      setEditingValues({
        contract_cost: project.contract_cost || 0,
        profit_percentage: project.profit_percentage || 0.20,
        project_area: project.project_area || '',
        project_start: project.project_start || '',
        days_end: project.days_end || ''
      });
    }
  }, [project]);

  const handleInputChange = (field, value) => {
    setEditingValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveClick = () => {
    if (!canEdit) return;
    setPasswordModal({ isOpen: true, action: 'update_project', payload: editingValues });
  };

  const executeSaveProject = async (values) => {
    setIsSaving(true);
    if (onUpdateProject && project) {
      await onUpdateProject(project.id, values);
    }
    setIsSaving(false);
  };

  const handleDeleteClick = (id) => {
    if (!canEdit) return;
    setPasswordModal({ isOpen: true, action: 'delete_disbursement', payload: id });
  };

  const executeDeleteDisbursement = async (id) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/disbursements/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
        }
      });
      if (response.ok) {
        if (refreshData) await refreshData();
      } else {
        alert("Failed to delete disbursement.");
      }
    } catch (error) {
      console.error(error);
      alert("Network Error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordConfirm = () => {
    if (passwordModal.action === 'update_project') {
      executeSaveProject(passwordModal.payload);
    } else if (passwordModal.action === 'delete_disbursement') {
      executeDeleteDisbursement(passwordModal.payload);
    }
    setPasswordModal({ isOpen: false, action: null, payload: null });
  };

  const financials = useMemo(() => {
    if (!project) return { budgetCostLimit: 0, totalExpenses: 0, remainingBudget: 0, projectExpenses: [], profitPercent: 0 };
    
    const contractCost = parseFloat(editingValues.contract_cost) || 0;
    const budgetCost = contractCost / 1.12; 
    const vatAmount = contractCost - budgetCost;
    
    const profitPercent = parseFloat(editingValues.profit_percentage) || 0;
    const profitAmount = budgetCost * profitPercent;
    const budgetCostLimit = budgetCost - profitAmount;

    const projectExpenses = disbursements.filter(d => 
      d.project_code && d.project_code.toUpperCase() === project.project_code.toUpperCase()
    );
    
    const totalExpenses = projectExpenses.reduce((sum, item) => sum + (parseFloat(item.gross_amount) || 0), 0);
    const remainingBudget = budgetCostLimit - totalExpenses;

    return { 
      contractCost, budgetCost, vatAmount, profitAmount, profitPercent,
      budgetCostLimit, totalExpenses, remainingBudget, 
      projectExpenses 
    };
  }, [project, editingValues, disbursements]);

  const budgetPercentage = financials.budgetCostLimit > 0 ? (financials.totalExpenses / financials.budgetCostLimit) * 100 : 0;
  let progressColor = 'bg-emerald-500';
  if (budgetPercentage > 75) progressColor = 'bg-amber-500';
  if (budgetPercentage > 90) progressColor = 'bg-rose-500';

  if (!projects.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <p className="text-xl font-medium">Walang nahanap na Project</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
              <FileSpreadsheet size={28} />
            </div>
            COST MONITORING
          </h1>
          <p className="text-slate-500 mt-1 font-medium flex items-center gap-2">
            Control and track your project expenses in real-time
          </p>
        </div>

        <div className="relative w-full md:w-96 z-50">
          <SearchableDropdown
            options={projects.map(p => `${p.project_code} — ${p.project_name}`)}
            value={project ? `${project.project_code} — ${project.project_name}` : ''}
            onChange={(val) => {
              const selected = projects.find(p => `${p.project_code} — ${p.project_name}` === val);
              if (selected) setSelectedProjectId(selected.id);
            }}
            placeholder="-- Maghanap ng Project --"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        
        {/* EDITABLE PROJECT DETAILS GRID */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Project Name</label>
            <div className="text-lg font-bold text-slate-800 line-clamp-1" title={project?.project_name}>
              {project?.project_name}
            </div>
            <div className="text-blue-600 font-black mt-1 text-sm">{project?.project_code}</div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Contract Cost (₱)</label>
            <input 
              type="number"
              className="w-full text-2xl font-black text-slate-800 focus:outline-none focus:text-blue-600 bg-transparent"
              value={editingValues.contract_cost || ''}
              onChange={(e) => handleInputChange('contract_cost', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Profit Target (%)</label>
            <div className="flex items-center gap-2">
              <input 
                type="number"
                step="0.01"
                className="w-full text-2xl font-black text-slate-800 focus:outline-none focus:text-blue-600 bg-transparent"
                value={(editingValues.profit_percentage * 100).toFixed(0)}
                onChange={(e) => handleInputChange('profit_percentage', parseFloat(e.target.value) / 100)}
                placeholder="20"
              />
              <span className="text-2xl font-black text-slate-300">%</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Project Area</label>
            <input 
              type="text"
              className="w-full text-lg font-bold text-slate-800 focus:outline-none focus:text-blue-600 bg-transparent"
              value={editingValues.project_area || ''}
              onChange={(e) => handleInputChange('project_area', e.target.value)}
              placeholder="e.g. 150 sqm"
            />
          </div>
        </section>

        {canEdit && (
          <div className="flex justify-end -mt-4 animate-in fade-in">
            <button 
              onClick={handleSaveClick}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* FINANCIAL SUMMARY CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* BUDGET LIMIT */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2rem] shadow-xl text-white group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <Wallet size={120} />
            </div>
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold tracking-wider uppercase mb-6">
                <CheckCircle2 size={14} className="text-emerald-400" /> Budget Limit
              </span>
              <div className="text-4xl font-black mb-2">
                ₱{financials.budgetCostLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-slate-400 text-sm font-medium">After {financials.profitPercent * 100}% Profit & 12% VAT</p>
            </div>
          </div>

          {/* TOTAL EXPENSES */}
          <div className="relative overflow-hidden bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500 text-blue-600">
              <TrendingUp size={120} />
            </div>
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold tracking-wider uppercase mb-6">
                <Receipt size={14} /> Total Expenses
              </span>
              <div className="text-4xl font-black text-slate-800 mb-2">
                ₱{financials.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-slate-500 text-sm font-medium">Accumulated project costs</p>
            </div>
          </div>

          {/* REMAINING PONDO */}
          <div className={`relative overflow-hidden p-8 rounded-[2rem] shadow-sm group border ${
            financials.remainingBudget < 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
          }`}>
            <div className="relative z-10">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-6 ${
                financials.remainingBudget < 0 ? 'bg-rose-200 text-rose-700' : 'bg-emerald-200 text-emerald-700'
              }`}>
                <AlertCircle size={14} /> Remaining Pondo
              </span>
              <div className={`text-4xl font-black mb-2 ${
                financials.remainingBudget < 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                ₱{financials.remainingBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-slate-500 text-sm font-medium">Available project funds</p>
            </div>
          </div>
        </section>

        {/* BUDGET PROGRESS BAR */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Budget Utilization</span>
            <span className={`text-sm font-black ${progressColor.replace('bg-', 'text-')}`}>
              {budgetPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${progressColor}`} 
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            ></div>
          </div>
        </section>

        {/* DISBURSEMENT LIST SECTION */}
        <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                Project Ledger
                <span className="ml-2 px-2.5 py-0.5 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold">
                  {financials.projectExpenses.length} Entries
                </span>
              </h3>
              <p className="text-slate-500 text-xs font-medium mt-1 tracking-widest">Linked disbursements for {project?.project_code}</p>
            </div>
            <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              Export to Excel
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-400 rounded-xl shadow-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b-2 border-r border-slate-400 last:border-r-0">Date</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b-2 border-r border-slate-400 last:border-r-0">CV Number</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b-2 border-r border-slate-400 last:border-r-0">Payee</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b-2 border-r border-slate-400 last:border-r-0">Description</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b-2 border-r border-slate-400 last:border-r-0 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400">
                {financials.projectExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center opacity-30">
                        <Calendar size={48} className="mb-2" />
                        <p className="text-lg font-bold">Walang Disbursement na Nahanap</p>
                        <p className="text-sm">Siguraduhin na ang Project Code ay tugma sa disbursement entry.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  financials.projectExpenses.map((d) => (
                    <tr key={d.id} className="hover:bg-blue-100/50 transition-colors group">
                      <td className="px-8 py-5 border-r border-slate-400 last:border-r-0 bg-white group-hover:bg-blue-50/50">
                        <div className="text-sm font-bold text-slate-700">{d.date}</div>
                      </td>
                      <td className="px-6 py-5 border-r border-slate-400 last:border-r-0 bg-white group-hover:bg-blue-50/50">
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono text-xs font-bold border border-slate-400">
                          {d.cv_no || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-5 border-r border-slate-400 last:border-r-0 bg-white group-hover:bg-blue-50/50">
                        <div className="text-sm font-bold text-slate-800">{d.payee}</div>
                      </td>
                      <td className="px-6 py-5 border-r border-slate-400 last:border-r-0 bg-white group-hover:bg-blue-50/50">
                        <div className="text-sm text-slate-600 font-medium max-w-xs truncate" title={d.particulars}>
                          {d.particulars}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right border-r border-slate-400 last:border-r-0 bg-white group-hover:bg-blue-50/50">
                        <div className="text-base font-black text-slate-900">
                          ₱{parseFloat(d.gross_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="px-6 py-5 text-center bg-white group-hover:bg-blue-50/50 border-l border-slate-400">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(d.id); }} 
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg transition-colors" 
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <PasswordConfirmModal
        isOpen={passwordModal.isOpen}
        actionType={passwordModal.action === 'update_project' ? 'update' : 'delete'}
        onClose={() => setPasswordModal({ isOpen: false, action: null, payload: null })}
        onConfirm={handlePasswordConfirm}
      />

      {(isSaving || isSwitching) && (
        <LoadingOverlay 
          message={isSwitching ? "Switching Project" : "Saving Changes"} 
          subtext={isSwitching ? "Inihahanda ang data..." : "Paki-antay lamang..."} 
        />
      )}
    </div>
  );
}