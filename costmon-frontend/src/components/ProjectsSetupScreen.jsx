import { useState, useEffect } from 'react';
import { 
  FolderPlus, 
  Tags, 
  Trash2, 
  Plus, 
  Settings2, 
  AlertCircle,
  Save,
  X,
  FileCode,
  Layers
} from 'lucide-react';
import { API_URL } from '../utils/constants';

export default function ProjectsSetupScreen({ projects, categories, refreshData }) {
  const [newProject, setNewProject] = useState({ project_code: '', project_name: '', contract_cost: '', profit_percentage: '20' });
  const [newCategory, setNewCategory] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!newProject.project_code || !newProject.project_name) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProject,
          profit_percentage: parseFloat(newProject.profit_percentage || 20) / 100
        })
      });
      
      if (response.ok) {
        showMessage('Project added successfully!');
        setNewProject({ project_code: '', project_name: '', contract_cost: '', profit_percentage: '20' });
        refreshData();
      }
    } catch (error) {
      showMessage('Failed to add project.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (error) {
      showMessage('Failed to update project.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Sigurado ka bang gusto mong burahin ang project na ito?')) return;
    
    try {
      const response = await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' });
      if (response.ok) {
        showMessage('Project deleted.');
        refreshData();
      }
    } catch (error) {
      showMessage('Failed to delete project.', 'error');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory.trim() })
      });
      
      if (response.ok) {
        showMessage('Category added!');
        setNewCategory('');
        refreshData();
      } else {
        showMessage('Category already exists.', 'error');
      }
    } catch (error) {
      showMessage('Failed to add category.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Burahin ang kategoryang ito?')) return;
    
    try {
      const response = await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
      if (response.ok) {
        showMessage('Category removed.');
        refreshData();
      }
    } catch (error) {
      showMessage('Failed to remove category.', 'error');
    }
  };

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
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-black text-slate-500 uppercase tracking-widest">
                {projects.length} Registered
              </span>
            </div>

            {/* ADD / EDIT FORM */}
            <div className="p-8 border-b border-slate-100 bg-indigo-50/30">
              <form onSubmit={editingProject ? handleUpdateProject : handleAddProject} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Code</label>
                  <input 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    placeholder="RF-000"
                    value={editingProject ? editingProject.project_code : newProject.project_code}
                    onChange={(e) => editingProject ? setEditingProject({...editingProject, project_code: e.target.value}) : setNewProject({...newProject, project_code: e.target.value})}
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Name</label>
                  <input 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter site name..."
                    value={editingProject ? editingProject.project_name : newProject.project_name}
                    onChange={(e) => editingProject ? setEditingProject({...editingProject, project_name: e.target.value}) : setNewProject({...newProject, project_name: e.target.value})}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Code</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Project Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Contract Cost</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4">
                        <span className="font-black text-indigo-600">{p.project_code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-700">{p.project_name}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-mono font-bold text-slate-500 text-sm">₱{(p.contract_cost || 0).toLocaleString()}</div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingProject({
                              ...p, 
                              profit_percentage: (p.profit_percentage * 100).toFixed(0)
                            })}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          >
                            <Settings2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProject(p.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
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
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Tags className="text-amber-500" size={24} />
                Categories
              </h2>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-black text-slate-500 uppercase tracking-widest">
                {categories.length}
              </span>
            </div>

            <div className="p-6 border-b border-slate-100">
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input 
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="New Category..."
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
              </form>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[600px] p-6">
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all">
                    <span className="text-sm font-bold text-slate-600">{cat.name}</span>
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
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
    </div>
  );
}