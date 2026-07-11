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
  BarChart3,
  Layers
} from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';
import PasswordConfirmModal from './PasswordConfirmModal';
import LoadingOverlay from './LoadingOverlay';
import { API_URL } from '../utils/Constants';

export default function ProjectsSetupScreen({ projects, categories, refreshData, onNavigateToCostMonitoring, onModalStateChange }) {
  const [newProject, setNewProject] = useState({
    project_code: '',
    project_name: '',
    contract_cost: '',
    profit_percentage: '20'
  });
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');


  const [editingProject, setEditingProject] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [projectCodeError, setProjectCodeError] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCategorySuccessModal, setShowCategorySuccessModal] = useState(false);
  const [showSubCategorySuccessModal, setShowSubCategorySuccessModal] = useState(false);

  const [recentlyAddedProject, setRecentlyAddedProject] = useState(null);
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });



  // ==============================================================
  // CATEGORY FILTERING & INJECTION LOGIC
  // ==============================================================
  const mainCategories = [];
  const subCategories = [];

  categories.forEach(c => {
    const rawName = c.name;
    if (rawName.startsWith('[MAIN] ')) {
      mainCategories.push({ ...c, displayName: rawName.replace('[MAIN] ', '') });
    } else if (rawName.startsWith('[MISC] ')) {
      subCategories.push({ ...c, displayName: rawName.replace('[MISC] ', '') });
    } else {
      subCategories.push({ ...c, displayName: rawName });
    }
  });

  mainCategories.sort((a, b) => a.displayName.localeCompare(b.displayName));
  subCategories.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // ==============================================================

  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(showSuccessModal || showCategorySuccessModal || showSubCategorySuccessModal || passwordModal.isOpen || isSaving);
    }
  }, [showSuccessModal, showCategorySuccessModal, showSubCategorySuccessModal, passwordModal.isOpen, isSaving, onModalStateChange]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showSuccessModal) setShowSuccessModal(false);
        if (showCategorySuccessModal) setShowCategorySuccessModal(false);
        if (showSubCategorySuccessModal) setShowSubCategorySuccessModal(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSuccessModal, showCategorySuccessModal, showSubCategorySuccessModal]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleAddProject = async (e) => {
    if (e) e.preventDefault();
    if (!newProject.project_code || !newProject.project_name) return;

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
          'Authorization': `Bearer ${sessionStorage.getItem('fbtmcc_token')}`
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
          'Authorization': `Bearer ${sessionStorage.getItem('fbtmcc_token')}`
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
      } else {
        const errorData = await response.json().catch(() => ({}));
        showMessage(errorData.error || 'Failed to update project.', 'error');
      }
    } catch (err) {
      console.error(err);
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
          'Authorization': `Bearer ${sessionStorage.getItem('fbtmcc_token')}`
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

  const handleAddCategory = async (e, isMisc = false) => {
    if (e) e.preventDefault();

    const valueToAdd = isMisc ? newSubCategory.trim() : newCategory.trim();
    if (!valueToAdd) {
      showMessage('Please enter a category name.', 'error');
      return;
    }

    const exists = isMisc
      ? subCategories.some(c => c.displayName.toLowerCase() === valueToAdd.toLowerCase())
      : mainCategories.some(c => c.displayName.toLowerCase() === valueToAdd.toLowerCase());

    if (exists) {
      showMessage(`Category "${valueToAdd}" already exists!`, 'error');
      return;
    }

    const finalName = isMisc ? `[MISC] ${valueToAdd}` : `[MAIN] ${valueToAdd}`;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('fbtmcc_token')}`
        },
        body: JSON.stringify({ name: finalName })
      });

      if (response.ok) {
        if (isMisc) {
          setShowSubCategorySuccessModal(true);
          setNewSubCategory('');
        } else {
          setShowCategorySuccessModal(true);
          setNewCategory('');
        }
        refreshData();
      } else {
        showMessage('Item already exists.', 'error');
      }
    } catch {
      showMessage('Failed to add item.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteCategory = async (category) => {
    if (category.isHardcoded) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/categories/${category.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('fbtmcc_token')}`
        }
      });
      if (response.ok) {
        showMessage('Item removed.');
        refreshData();
      }
    } catch {
      showMessage('Failed to remove item.', 'error');
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

  const isMainCategoryDuplicate = !!newCategory.trim() && mainCategories.some(c => c.displayName.toLowerCase() === newCategory.trim().toLowerCase());
  const isSubCategoryDuplicate = !!newSubCategory.trim() && subCategories.some(c => c.displayName.toLowerCase() === newSubCategory.trim().toLowerCase());

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 overflow-hidden transition-colors duration-300">
      {/* HEADER */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between shrink-0 shadow-sm transition-colors duration-300">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <div className="bg-indigo-600 dark:bg-indigo-700 p-2 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Settings2 size={28} />
            </div>
            SYSTEM SETUP
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage project codes and expense categories</p>
        </div>

        {message.text && (
          <div className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 ${message.type === 'error' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
            }`}>
            {message.type === 'error' ? <AlertCircle size={18} /> : <Save size={18} />}
            {message.text}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 custom-scrollbar">

        {/* PROJECTS MANAGEMENT (7 COLS) */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col transition-colors duration-300">
            <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <FileCode className="text-indigo-600 dark:text-indigo-400" size={24} />
                Project Codes
              </h2>
              <span className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-xs font-black text-slate-500 dark:text-slate-300 tracking-widest transition-colors duration-300">
                {projects.length} Registered
              </span>
            </div>

            {/* ADD / EDIT FORM */}
            <div className="p-8 pb-12 border-b border-slate-100 dark:border-slate-700 bg-indigo-50/30 dark:bg-indigo-900/10 transition-colors duration-300">
              <form onSubmit={(e) => { e.preventDefault(); if (editingProject) { setPasswordModal({ isOpen: true, action: 'update_project', payload: null }); } else { handleAddProject(e); } }} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-1 space-y-1.5 relative">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">Code</label>
                  <input
                    className={`w-full px-4 py-3 rounded-xl border-2 font-bold focus:outline-none focus:ring-2 transition-all shadow-sm ${projectCodeError
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-900/20 focus:ring-rose-500 text-rose-700 dark:text-rose-400'
                        : 'border-slate-400 dark:border-slate-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white'
                      }`}
                    placeholder="RF-000"
                    value={editingProject ? editingProject.project_code : newProject.project_code}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (editingProject) {
                        setEditingProject({ ...editingProject, project_code: val });
                      } else {
                        setNewProject({ ...newProject, project_code: val });
                        if (projects.some(p => p.project_code.toLowerCase() === val.toLowerCase())) {
                          setProjectCodeError(`Code "${val}" already exists!`);
                        } else {
                          setProjectCodeError('');
                        }
                      }
                    }}
                    required
                  />
                  {projectCodeError && !editingProject && (
                    <p className="absolute -bottom-[22px] left-1 text-[11px] text-rose-500 font-bold whitespace-nowrap animate-in slide-in-from-top-1">
                      {projectCodeError}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">Project Name</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-400 dark:border-slate-600 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm transition-colors duration-300"
                    placeholder="Enter site name..."
                    value={editingProject ? editingProject.project_name : newProject.project_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (editingProject) {
                        setEditingProject({ ...editingProject, project_name: val });
                      } else {
                        setNewProject({ ...newProject, project_name: val });
                      }
                    }}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving || (!!projectCodeError && !editingProject)}
                    className={`flex-1 text-white font-black py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${(!!projectCodeError && !editingProject)
                        ? 'bg-slate-400 dark:bg-slate-600 shadow-slate-100 dark:shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'
                      }`}
                  >
                    {editingProject ? <Save size={18} /> : <Plus size={18} />}
                    {editingProject ? 'Update' : 'Add'}
                  </button>
                  {editingProject && (
                    <button
                      type="button"
                      onClick={() => setEditingProject(null)}
                      className="p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors duration-300"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="overflow-auto border border-slate-400 dark:border-slate-600 rounded-xl shadow-md bg-white dark:bg-slate-800 custom-scrollbar max-h-[600px] m-4 transition-colors duration-300">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700 transition-colors duration-300">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-600 dark:text-slate-300 tracking-widest border-b-2 border-r border-slate-400 dark:border-slate-600 uppercase w-[140px]">Code</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-600 dark:text-slate-300 tracking-widest border-b-2 border-r border-slate-400 dark:border-slate-600 uppercase">Project Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-600 dark:text-slate-300 tracking-widest border-b-2 border-slate-400 dark:border-slate-600 uppercase text-center sticky right-0 z-10 bg-slate-100 dark:bg-slate-700 w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400 dark:divide-slate-600">
                  {projects.map((p) => {
                    const isSelected = editingProject && editingProject.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors group ${isSelected
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-y-2 border-indigo-500 dark:border-indigo-500'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                          }`}
                      >
                        <td className={`px-6 py-4 border-r w-[140px] transition-colors duration-300 ${isSelected
                            ? 'border-indigo-500 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                            : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50'
                          }`}>
                          <span className="font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800 shadow-sm group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors block text-center truncate">{p.project_code}</span>
                        </td>
                        <td className={`px-6 py-4 border-r transition-colors duration-300 ${isSelected
                            ? 'border-indigo-500 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                            : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50'
                          }`}>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{p.project_name}</div>
                        </td>
                        <td className={`px-6 py-4 sticky right-0 z-10 w-[140px] transition-colors duration-300 ${isSelected
                            ? 'bg-indigo-50/30 dark:bg-indigo-950/20'
                            : 'bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50'
                          }`}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingProject({
                                ...p,
                                profit_percentage: (p.profit_percentage * 100).toFixed(0)
                              })}
                              className="p-2 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-50 dark:border-indigo-900/30 rounded-lg transition-colors shadow-sm"
                            >
                              <Settings2 size={18} />
                            </button>
                            <button
                              onClick={() => setPasswordModal({ isOpen: true, action: 'delete_project', payload: p })}
                              className="p-2 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-50 dark:border-rose-900/30 rounded-lg transition-colors shadow-sm"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ==============================================
            CATEGORIES MANAGEMENT (5 COLS) 
        ============================================== */}
        <section className="lg:col-span-5 space-y-6 flex flex-col h-[calc(100vh-140px)]">

          {/* 1. MAIN CATEGORIES BOX */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-400 dark:border-slate-600 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[300px] transition-colors duration-300">
            <div className="px-8 py-5 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-400 dark:border-slate-600 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Tags className="text-amber-500 dark:text-amber-400" size={20} />
                Main Categories
              </h2>
              <span className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-400 dark:border-slate-600 rounded-full text-[10px] font-black text-slate-500 dark:text-slate-300 tracking-widest transition-colors duration-300">
                {mainCategories.length}
              </span>
            </div>

            <div className="p-5 pb-8 border-b border-slate-400 dark:border-slate-600 bg-amber-50/20 dark:bg-amber-900/10 transition-colors duration-300">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase block mb-1.5">Add Main Category</label>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5 relative">
                  <input
                    className={`w-full px-4 py-3 rounded-xl border-2 font-bold focus:outline-none focus:ring-2 shadow-sm text-sm transition-colors duration-300 uppercase ${isMainCategoryDuplicate
                        ? 'border-rose-500 focus:ring-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10'
                        : 'border-slate-400 dark:border-slate-600 focus:ring-amber-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white'
                      }`}
                    placeholder="Enter category name..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(null, false); }}
                  />
                  {isMainCategoryDuplicate && (
                    <span className="absolute -bottom-[22px] left-1 text-[11px] font-bold text-rose-500 dark:text-rose-400">
                      Category "{newCategory}" already exists!
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isMainCategoryDuplicate}
                  onClick={() => handleAddCategory(null, false)}
                  className={`flex items-center justify-center gap-2 px-5 py-3 font-black rounded-xl shadow-lg transition-all text-sm whitespace-nowrap ${isMainCategoryDuplicate
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500 shadow-none'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 dark:shadow-none'
                    }`}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="space-y-2">
                {mainCategories.map((cat) => (
                  <div key={cat.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-300 dark:border-slate-600 hover:border-amber-200 dark:hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-amber-900/20 transition-all duration-300">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{cat.displayName}</span>
                    {!cat.isHardcoded && (
                      <button
                        onClick={() => setPasswordModal({ isOpen: true, action: 'delete_category', payload: cat })}
                        className="p-1.5 text-slate-300 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete Category"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. MISCELLANEOUS SUB-CATEGORIES BOX */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-400 dark:border-slate-600 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[300px] transition-colors duration-300">
            <div className="px-8 py-5 bg-teal-50/50 dark:bg-teal-900/10 border-b border-slate-400 dark:border-slate-600 flex items-center justify-between transition-colors duration-300">
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Layers className="text-teal-600 dark:text-teal-400" size={20} />
                Misc. Sub-Categories
              </h2>
              <span className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-400 dark:border-slate-600 rounded-full text-[10px] font-black text-slate-500 dark:text-slate-300 tracking-widest transition-colors duration-300">
                {subCategories.length}
              </span>
            </div>

            <div className="p-5 pb-8 border-b border-slate-400 dark:border-slate-600 bg-teal-50/30 dark:bg-teal-900/10 transition-colors duration-300">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase block mb-1.5">Add Misc Sub-Category</label>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5 relative">
                  <input
                    className={`w-full px-4 py-3 rounded-xl border-2 font-bold focus:outline-none focus:ring-2 shadow-sm text-sm transition-colors duration-300 uppercase ${isSubCategoryDuplicate
                        ? 'border-rose-500 focus:ring-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10'
                        : 'border-slate-400 dark:border-slate-600 focus:ring-teal-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white'
                      }`}
                    placeholder="e.g. EXTRA LABOR..."
                    value={newSubCategory}
                    onChange={(e) => setNewSubCategory(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(null, true); }}
                  />
                  {isSubCategoryDuplicate && (
                    <span className="absolute -bottom-[22px] left-1 text-[11px] font-bold text-rose-500 dark:text-rose-400">
                      Category "{newSubCategory}" already exists!
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isSubCategoryDuplicate}
                  onClick={() => handleAddCategory(null, true)}
                  className={`flex items-center justify-center gap-2 px-5 py-3 font-black rounded-xl shadow-lg transition-all text-sm whitespace-nowrap ${isSubCategoryDuplicate
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500 shadow-none'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 dark:shadow-none'
                    }`}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="space-y-2">
                {subCategories.map((cat) => (
                  <div key={cat.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-300 dark:border-slate-600 hover:border-teal-200 dark:hover:border-teal-500/50 hover:bg-teal-50/30 dark:hover:bg-teal-900/20 transition-all duration-300">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{cat.displayName}</span>
                    <button
                      onClick={() => setPasswordModal({ isOpen: true, action: 'delete_category', payload: cat })}
                      className="p-1.5 text-slate-300 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
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

      {/* SUCCESS MODAL: MAIN CATEGORY */}
      {showCategorySuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">Main Category Added!</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
                  New main category has been successfully added.
                </p>
              </div>
              <button onClick={() => setShowCategorySuccessModal(false)} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-lg shadow-amber-100 dark:shadow-none transition-all text-lg">
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL: SUB-CATEGORY */}
      {showSubCategorySuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">Sub-Category Added!</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
                  It will appear under the Miscellaneous Cost table.
                </p>
              </div>
              <button onClick={() => setShowSubCategorySuccessModal(false)} className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow-lg shadow-teal-200 dark:shadow-none transition-all text-lg">
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL: PROJECT */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl animate-in zoom-in-95 border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white">Project Added Successfully!</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 text-lg">
                  Successfully created project code <strong className="text-indigo-600 dark:text-indigo-400">{recentlyAddedProject?.code}</strong>.
                </p>
              </div>

              <div className="flex flex-row w-full gap-5 mt-4">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    onNavigateToCostMonitoring(recentlyAddedProject?.id);
                  }}
                  className="flex-[1.2] py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-3 text-lg"
                >
                  <BarChart3 size={24} strokeWidth={2.5} />
                  Go to Monitoring
                </button>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="flex-1 py-5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-all text-lg"
                >
                  Stay Here
                </button>
              </div>
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
          subtext="Please wait while changes are being saved..."
        />
      )}
    </div>
  );
}