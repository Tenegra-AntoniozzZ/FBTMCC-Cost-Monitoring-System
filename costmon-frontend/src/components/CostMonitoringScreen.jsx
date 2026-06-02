import { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Wallet,
  Calendar,
  Layers,
  Receipt
} from 'lucide-react';

export default function CostMonitoringScreen({ projects, disbursements, onUpdateProject }) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  
  // Local state for editable fields to ensure snappy UI
  const [editingValues, setEditingValues] = useState({});

  const project = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
    [projects, selectedProjectId]
  );

  // Initialize editing values when project changes
  useEffect(() => {
    if (project) {
      setEditingValues({
        contract_cost: project.contract_cost || 0,
        profit_percentage: project.profit_percentage || 0.20, // Default 20%
        project_area: project.project_area || '',
        project_start: project.project_start || '',
        days_end: project.days_end || ''
      });
    }
  }, [project]);

  const handleInputChange = (field, value) => {
    const updatedValues = { ...editingValues, [field]: value };
    setEditingValues(updatedValues);
    
    // Optional: Notify parent of changes (if onUpdateProject is provided)
    if (onUpdateProject && project) {
      onUpdateProject(project.id, updatedValues);
    }
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

        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          <select 
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 appearance-none focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer shadow-sm"
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_code} — {p.project_name}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <Layers size={18} />
          </div>
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
              <p className="text-slate-500 text-xs font-medium mt-1 uppercase tracking-widest">Linked disbursements for {project?.project_code}</p>
            </div>
            <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              Export to Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Date</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">CV Number</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Payee</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Description</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
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
                  financials.projectExpenses.map((d, index) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="text-sm font-bold text-slate-700">{d.date}</div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 font-mono text-xs font-bold">
                          {d.cv_no || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-bold text-slate-800">{d.payee}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-slate-500 font-medium max-w-xs truncate" title={d.particulars}>
                          {d.particulars}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="text-base font-black text-slate-800">
                          ₱{parseFloat(d.gross_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}