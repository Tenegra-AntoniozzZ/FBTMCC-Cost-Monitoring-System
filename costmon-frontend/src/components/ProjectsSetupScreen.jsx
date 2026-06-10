import { useState, useEffect } from 'react';
import { 
  Tags, 
  Trash2, 
  Plus, 
  Settings2, 
  AlertCircle,
  Save,
  X,
  FileCode,
  CheckCircle2,
  BarChart3
} from 'lucide-react';
import PasswordConfirmModal from './PasswordConfirmModal';
import LoadingOverlay from './LoadingOverlay';
import { API_URL } from '../utils/constants';

export default function ProjectsSetupScreen({ projects, categories, refreshData, onNavigateToCostMonitoring }) {
  const [newProject, setNewProject] = useState({ project_code: '', project_name: '', contract_cost: '', profit_percentage: '20' });
  const [newCategory, setNewCategory] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [projectCodeError, setProjectCodeError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCategorySuccessModal, setShowCategorySuccessModal] = useState(false);
  const [recentlyAddedProject, setRecentlyAddedProject] = useState(null);
  
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showSuccessModal) setShowSuccessModal(false);
        if (showCategorySuccessModal) setShowCategorySuccessModal(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSuccessModal, showCategorySuccessModal]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleAddProject = async (e) => {
    if (e) e.preventDefault();
    if (!newProject.project_code || !newProject.project_name) return;

    // Project Code Uniqueness Validation
    const isExisting = projects.some(p => p.project_code.toLowerCase() === newProject.project_code.toLowerCase());
    if (isExisting) {
      setProjectCodeError(`Code "${newProject.project_code}" already exists!`);
      return;
    }
    
    setProjectCodeError('');
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
        },
        body: JSON.stringify({
          ...newProject,
          profit_percentage: parseFloat(newProject.profit_percentage || 20) / 100
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentlyAddedProject({ id: data.id, code: newProject.project_code });
        setShowSuccessModal(true);
        setNewProject({ project_code: '', project_name: '', contract_cost: '', profit_percentage: '20' });
        refreshData();
      }
    } catch {
      showMessage('Failed to add project.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const executeUpdateProject = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
        },
        body: JSON.stringify({
          ...editingProject,
          profit_percentage: parseFloat(editingProject.profit_percentage) / 100
        })
      });
      
      if (response.ok) {
        showMessage('Project updated successfully!');
        setEditingProject(null);
        refreshData();
      }
    } catch {
      showMessage('Failed to update project.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteProject = async (project) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/projects/${project.id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
        }
      });
      if (response.ok) {
        showMessage('Project deleted.');
        refreshData();
      }
    } catch {
      showMessage('Failed to delete project.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = async (e) => {
    if (e) e.preventDefault();
    if (!newCategory.trim()) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
        },
        body: JSON.stringify({ name: newCategory.trim() })
      });
      
      if (response.ok) {
        setShowCategorySuccessModal(true);
        setNewCategory('');
        refreshData();
      } else {
        showMessage('Category already exists.', 'error');
      }
    } catch {
      showMessage('Failed to add category.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteCategory = async (category) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/categories/${category.id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('fbtmcc_token')}`
        }
      });
      if (response.ok) {
        showMessage('Category removed.');
        refreshData();
      }
    } catch {
      showMessage('Failed to remove category.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordConfirm = () => {
    if (passwordModal.action === 'update_project') {
      executeUpdateProject();
    } else if (passwordModal.action === 'delete_project') {
      executeDeleteProject(passwordModal.payload);
    } else if (passwordModal.action === 'delete_category') {
      executeDeleteCategory(passwordModal.payload);
    }
    setPasswordModal({ isOpen: false, action: null, payload: null });
  };

  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
              <Settings2 size={28} />
            </div>
            SYSTEM SETUP
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage project codes and expense categories</p>
        </div>

        {message.text && (
          <div className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 ${
            message.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }`}>
            {message.type === 'error' ? <AlertCircle size={18} /> : <Save size={18} />}
            {message.text}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* PROJECTS MANAGEMENT (8 COLS) */}
        <section className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <FileCode className="text-indigo-600" size={24} />
                Project Codes
              </h2>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-black text-slate-500 tracking-widest">
                {projects.length} Registered
              </span>
            </div>

            {/* ADD / EDIT FORM */}
            <div className="p-8 border-b border-slate-100 bg-indigo-50/30">
              <form onSubmit={(e) => { e.preventDefault(); if (editingProject) { setPasswordModal({ isOpen: true, action: 'update_project', payload: null }); } else { handleAddProject(e); } }} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1 space-y-1.5 relative">
                  <label className="text-[10px] font-black text-slate-600 tracking-widest ml-1 uppercase">Code</label>
                  <input 
                    className={`w-full px-4 py-3 rounded-xl border-2 font-bold focus:outline-none focus:ring-2 transition-all shadow-sm ${
                      projectCodeError 
                        ? 'border-rose-500 bg-rose-50/50 focus:ring-rose-500 text-rose-700' 
                        : 'border-slate-400 focus:ring-indigo-500 bg-white'
                    }`}
                    placeholder="RF-000"
                    value={editingProject ? editingProject.project_code : newProject.project_code}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (editingProject) {
                        setEditingProject({...editingProject, project_code: val});
                      } else {
                        setNewProject({...newProject, project_code: val});
                        // Clear error while typing if the code is now unique
                        if (projects.some(p => p.project_code.toLowerCase() === val.toLowerCase())) {
                           setProjectCodeError(`Code "${val}" na-gamit na!`);
                        } else {
                           setProjectCodeError('');
                        }
                      }
                    }}
                    required
                  />
                  {projectCodeError && !editingProject && (
                    <p className="absolute -bottom-5 left-1 text-[10px] text-rose-500 font-bold whitespace-nowrap animate-in slide-in-from-top-1">
                      {projectCodeError}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 tracking-widest ml-1 uppercase">Project Name</label>
                  <input 
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                    placeholder="Enter site name..."
                    value={editingProject ? editingProject.project_name : newProject.project_name}
                    onChange={(e) => editingProject ? setEditingProject({...editingProject, project_name: e.target.value}) : setNewProject({...newProject, project_name: e.target.value})}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    disabled={isSaving || (!!projectCodeError && !editingProject)}
                    className={`flex-1 text-white font-black py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      (!!projectCodeError && !editingProject)
                        ? 'bg-slate-400 shadow-slate-100' 
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                  >
                    {editingProject ? <Save size={18} /> : <Plus size={18} />}
                    {editingProject ? 'Update' : 'Add'}
                  </button>
                  {editingProject && (
                    <button 
                      type="button" 
                      onClick={() => setEditingProject(null)}
                      className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 rounded-xl"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="overflow-auto border border-slate-400 rounded-xl shadow-md bg-white custom-scrollbar max-h-[600px]">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-600 tracking-widest border-b-2 border-r border-slate-400 uppercase w-[160px]">Code</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-600 tracking-widest border-b-2 border-r border-slate-400 uppercase">Project Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-600 tracking-widest border-b-2 border-r border-slate-400 uppercase text-right sticky right-[140px] z-10 bg-slate-100 shadow-[-3px_0_0_0_#94a3b8] w-[180px]">Contract Cost</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-600 tracking-widest border-b-2 border-slate-400 uppercase text-center sticky right-0 z-10 bg-slate-100 w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 border-r border-slate-400 bg-white group-hover:bg-slate-50 w-[160px]">
                        <span className="font-black text-indigo-700 bg-indigo-50/50 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm group-hover:bg-white transition-colors block text-center truncate">{p.project_code}</span>
                      </td>
                      <td className="px-6 py-4 border-r border-slate-400 bg-white group-hover:bg-slate-50">
                        <div className="font-bold text-slate-800">{p.project_name}</div>
                      </td>
                      <td className="px-6 py-4 text-right bg-white group-hover:bg-slate-50 sticky right-[140px] z-10 shadow-[-3px_0_0_0_#94a3b8] w-[180px]">
                        <div className="font-mono font-black text-slate-700 text-sm">₱{(p.contract_cost || 0).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 bg-white group-hover:bg-slate-50 sticky right-0 z-10 w-[140px]">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setEditingProject({
                              ...p, 
                              profit_percentage: (p.profit_percentage * 100).toFixed(0)
                            })}
                            className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 border border-indigo-50 rounded-lg transition-colors shadow-sm"
                          >
                            <Settings2 size={18} />
                          </button>
                          <button 
                            onClick={() => setPasswordModal({ isOpen: true, action: 'delete_project', payload: p })}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-100 border border-rose-50 rounded-lg transition-colors shadow-sm"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CATEGORIES MANAGEMENT (4 COLS) */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-400 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-400 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Tags className="text-amber-500" size={24} />
                Categories
              </h2>
              <span className="px-3 py-1 bg-white border border-slate-400 rounded-full text-xs font-black text-slate-500 tracking-widest">
                {categories.length}
              </span>
            </div>

            <div className="p-6 border-b border-slate-400 bg-amber-50/20">
              <form onSubmit={handleAddCategory} className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 tracking-widest ml-1 uppercase">New Category</label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white shadow-sm"
                    placeholder="Enter category name..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    required
                  />
                  <button 
                    type="submit" 
                    className="p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-100 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[600px] p-6 custom-scrollbar">
              <div className="space-y-2">
                {sortedCategories.map((cat) => (
                  <div key={cat.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-300 hover:border-amber-200 hover:bg-amber-50/30 transition-all">
                    <span className="text-sm font-bold text-slate-600">{cat.name}</span>
                    <button 
                      onClick={() => setPasswordModal({ isOpen: true, action: 'delete_category', payload: cat })}
                      className="p-1.5 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-800">Project Added Successfully!</h3>
                <p className="text-slate-500 font-medium mt-2 text-lg">
                  Successfully created project code <strong className="text-indigo-600">{recentlyAddedProject?.code}</strong>.
                </p>
              </div>
              
              <div className="flex flex-row w-full gap-5 mt-4">
                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    onNavigateToCostMonitoring(recentlyAddedProject?.id);
                  }}
                  className="flex-[1.2] py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 text-lg"
                >
                  <BarChart3 size={24} strokeWidth={2.5} />
                  Go to Monitoring
                </button>
                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="flex-1 py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all text-lg"
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY SUCCESS MODAL */}
      {showCategorySuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <Plus size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800">Category Added!</h3>
                <p className="text-slate-500 font-medium mt-2">
                  Bagong kategorya ay matagumpay na naidagdag sa system.
                </p>
              </div>
              <button 
                onClick={() => setShowCategorySuccessModal(false)}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-lg shadow-amber-100 transition-all text-lg"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      <PasswordConfirmModal
        isOpen={passwordModal.isOpen}
        actionType={passwordModal.action === 'update_project' ? 'update' : 'delete'}
        onClose={() => setPasswordModal({ isOpen: false, action: null, payload: null })}
        onConfirm={handlePasswordConfirm}
      />

      {isSaving && (
        <LoadingOverlay 
          message="Updating System" 
          subtext="Paki-antay habang sine-save ang changes..." 
        />
      )}
    </div>
  );
}