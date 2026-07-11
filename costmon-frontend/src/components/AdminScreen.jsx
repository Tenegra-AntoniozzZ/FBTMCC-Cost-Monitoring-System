import { useState, useEffect } from 'react';
import {
  Users, Plus, Edit2, ShieldCheck, ShieldOff, Eye, EyeOff,
  AlertCircle, CheckCircle2, Loader2, X, RefreshCw, KeyRound,
  UserCheck, UserX, Crown, Lock, Save
} from 'lucide-react';
import { API_URL } from '../utils/Constants';
import PasswordConfirmModal from './PasswordConfirmModal';

// ─── Role badge styles — kept from original ───────────────────
const ROLE_STYLES = {
  ceo:      'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
  encoder:  'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50',
  engineer: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
};
const ROLE_ICONS = {
  ceo:      <Crown size={12} />,
  encoder:  <Edit2 size={12} />,
  engineer: <ShieldCheck size={12} />,
};

// ─── Add / Edit User Modal ─────────────────────────────────────
function UserFormModal({ isOpen, onClose, onSave, editUser = null }) {
  const [form, setForm] = useState({
    username: '', password: '', confirmPassword: '', role: 'encoder',
    security_question: '', security_answer: '', newPassword: ''
  });
  const [showPass, setShowPass]   = useState(false);
  const [errors, setErrors]       = useState({});
  const [isSaving, setIsSaving]   = useState(false);
  const [success, setSuccess]     = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrors({}); setSuccess(false); setShowPass(false);
      if (editUser) {
        setForm({ username: editUser.username, password: '', confirmPassword: '', role: editUser.role, security_question: editUser.security_question || '', security_answer: '', newPassword: '' });
      } else {
        setForm({ username: '', password: '', confirmPassword: '', role: 'encoder', security_question: '', security_answer: '', newPassword: '' });
      }
    }
  }, [isOpen, editUser]);

  if (!isOpen) return null;

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = 'Username is required.';
    if (!editUser && !form.password) e.password = 'Password is required.';
    if (!editUser && form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    if (editUser && form.newPassword && form.newPassword !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    if (!form.role) e.role = 'Role is required.';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setIsSaving(true);
    try {
      const token = sessionStorage.getItem('fbtmcc_token');
      let payload, url, method;
      if (editUser) {
        payload = { username: form.username, role: form.role, security_question: form.security_question };
        if (form.security_answer) payload.security_answer = form.security_answer;
        if (form.newPassword) payload.newPassword = form.newPassword;
        url = `${API_URL}/users/${editUser.id}`; method = 'PUT';
      } else {
        payload = { username: form.username, password: form.password, role: form.role, security_question: form.security_question, security_answer: form.security_answer };
        url = `${API_URL}/users`; method = 'POST';
      }
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setErrors({ general: data.error || 'Save failed.' }); return; }
      setSuccess(true);
      setTimeout(() => { onSave(); onClose(); }, 900);
    } catch {
      setErrors({ general: 'Server connection error.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Shared input class (mirrors ProjectsSetup inputs)
  const inputCls = (hasErr) =>
    `w-full px-4 py-3 rounded-xl border-2 font-bold focus:outline-none focus:ring-2 transition-all shadow-sm
     ${hasErr
       ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20 focus:ring-rose-500 text-rose-700 dark:text-rose-400'
       : 'border-slate-400 dark:border-slate-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 px-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 overflow-hidden transition-colors duration-300">

        {/* Modal header — indigo stripe, matches ProjectsSetup icon badge colour */}
        <div className="bg-indigo-600 dark:bg-indigo-700 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <Users size={22} />
            <h2 className="text-lg font-black tracking-tight">{editUser ? 'Edit User' : 'Add New User'}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-5">
          {errors.general && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-bold border border-rose-100 dark:border-rose-800/50">
              <AlertCircle size={16} /> {errors.general}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold border border-emerald-100 dark:border-emerald-800/50">
              <CheckCircle2 size={16} /> Saved successfully!
            </div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">Username</label>
            <input
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className={inputCls(!!errors.username)}
              placeholder="e.g. juan.delacruz"
            />
            {errors.username && <p className="text-rose-500 text-xs mt-1 ml-1">{errors.username}</p>}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-400 dark:border-slate-600 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm transition-colors duration-300"
            >
              <option value="encoder">Encoder</option>
              <option value="engineer">Engineer</option>
              <option value="ceo">CEO / Admin</option>
            </select>
          </div>

          {/* Password */}
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">
              {editUser ? <>New Password <span className="normal-case font-medium text-slate-400">(leave blank to keep)</span></> : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={editUser ? form.newPassword : form.password}
                onChange={e => setForm(f => ({ ...f, [editUser ? 'newPassword' : 'password']: e.target.value }))}
                className={inputCls(!editUser && !!errors.password)}
                placeholder={editUser ? 'Leave blank to keep current' : 'Minimum 6 characters'}
              />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!editUser && errors.password && <p className="text-rose-500 text-xs mt-1 ml-1">{errors.password}</p>}
          </div>

          {/* Confirm password */}
          {((!editUser && form.password) || (editUser && form.newPassword)) && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className={inputCls(!!errors.confirmPassword)}
                placeholder="Re-enter password"
              />
              {errors.confirmPassword && <p className="text-rose-500 text-xs mt-1 ml-1">{errors.confirmPassword}</p>}
            </div>
          )}

          {/* Security question */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">
              Security Question <span className="normal-case font-medium">(optional)</span>
            </label>
            <input
              value={form.security_question}
              onChange={e => setForm(f => ({ ...f, security_question: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm text-sm transition-colors duration-300"
              placeholder="e.g. Ano ang pangalan ng inyong alagang hayop?"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || success}
              className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main AdminScreen ──────────────────────────────────────────
export default function AdminScreen({ currentUser, isDark }) {
  const [users,              setUsers]              = useState([]);
  const [isLoading,          setIsLoading]          = useState(false);
  const [showAddModal,       setShowAddModal]       = useState(false);
  const [editUser,           setEditUser]           = useState(null);
  const [showPasswordConfirm,setShowPasswordConfirm]= useState(false);
  const [pendingToggle,      setPendingToggle]      = useState(null);
  const [toast,              setToast]              = useState(null);
  const [showChangePass,     setShowChangePass]     = useState(false);
  const [changePassForm,     setChangePassForm]     = useState({ current: '', newPass: '', confirm: '' });
  const [changePassError,    setChangePassError]    = useState('');
  const [changePassSuccess,  setChangePassSuccess]  = useState(false);
  const [isChangingPass,     setIsChangingPass]     = useState(false);

  const token = sessionStorage.getItem('fbtmcc_token');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res  = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch { }
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleActive = (user) => { setPendingToggle(user); setShowPasswordConfirm(true); };

  const doToggleActive = async () => {
    if (!pendingToggle) return;
    try {
      const res  = await fetch(`${API_URL}/users/${pendingToggle.id}/toggle-active`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        showToast(pendingToggle.is_active ? `${pendingToggle.username} deactivated.` : `${pendingToggle.username} activated.`);
        fetchUsers();
      } else {
        showToast(data.error || 'Failed.', 'error');
      }
    } catch { showToast('Server error.', 'error'); }
    setPendingToggle(null);
  };

  const handleChangeOwnPassword = async () => {
    setChangePassError('');
    if (!changePassForm.current)  { setChangePassError('Enter current password.'); return; }
    if (!changePassForm.newPass)  { setChangePassError('Enter new password.'); return; }
    if (changePassForm.newPass !== changePassForm.confirm) { setChangePassError('New passwords do not match.'); return; }
    if (changePassForm.newPass.length < 6) { setChangePassError('Password must be at least 6 characters.'); return; }
    setIsChangingPass(true);
    try {
      const me  = JSON.parse(atob(token.split('.')[1]));
      const res = await fetch(`${API_URL}/users/${me.id}/change-own-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: changePassForm.current, newPassword: changePassForm.newPass })
      });
      const data = await res.json();
      if (res.ok) {
        setChangePassSuccess(true);
        setChangePassForm({ current: '', newPass: '', confirm: '' });
        showToast('Password changed successfully!');
        setTimeout(() => setChangePassSuccess(false), 3000);
      } else {
        setChangePassError(data.error || 'Failed.');
      }
    } catch { setChangePassError('Server connection error.'); }
    finally   { setIsChangingPass(false); }
  };

  // ── shared input style ──────────────────────────────────────
  const inputCls = 'w-full px-4 py-3 rounded-xl border-2 border-slate-400 dark:border-slate-600 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm text-sm transition-colors duration-300';

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 overflow-hidden transition-colors duration-300">

      {/* ── TOAST ────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm animate-in slide-in-from-top-3 duration-300 ${toast.type === 'error' ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between shrink-0 shadow-sm transition-colors duration-300">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <div className="bg-indigo-600 dark:bg-indigo-700 p-2 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Users size={28} />
            </div>
            USER MANAGEMENT
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage system accounts, roles, and access control
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded-xl transition-colors shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
          >
            <Plus size={18} /> Add User
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

        {/* ── USERS TABLE CARD ─────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col transition-colors duration-300">

          {/* Card header */}
          <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Users className="text-indigo-600 dark:text-indigo-400" size={22} />
              System Users
            </h2>
            <span className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-xs font-black text-slate-500 dark:text-slate-300 tracking-widest transition-colors duration-300">
              {users.length} {users.length === 1 ? 'User' : 'Users'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={32} className="animate-spin text-indigo-500" />
                <p className="text-slate-400 font-medium text-sm">Loading users…</p>
              </div>
            </div>
          ) : (
            <div className="overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700 transition-colors duration-300">
                    {['User', 'Role', 'Status', 'Actions'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-6 py-4 text-[10px] font-black text-slate-600 dark:text-slate-300 tracking-widest border-b-2 border-slate-400 dark:border-slate-600 uppercase ${i < 3 ? 'border-r' : ''} ${i === 3 ? 'text-center' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">

                      {/* User */}
                      <td className="px-6 py-4 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${user.is_active ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {user.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-black text-sm ${user.is_active ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                              {user.username}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">ID #{user.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black ${ROLE_STYLES[user.role] || 'bg-slate-100 text-slate-600'}`}>
                          {ROLE_ICONS[user.role]} {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 border-r border-slate-200 dark:border-slate-700 text-center bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-black border border-emerald-200 dark:border-emerald-800/50">
                            <UserCheck size={12} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-black border border-rose-200 dark:border-rose-800/50">
                            <UserX size={12} /> Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors duration-300">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditUser(user)}
                            className="p-2 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-50 dark:border-indigo-900/30 rounded-lg transition-colors shadow-sm"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          {String(currentUser?.id) !== String(user.id) && (
                            <button
                              onClick={() => handleToggleActive(user)}
                              className={`p-2 rounded-lg transition-colors border shadow-sm ${
                                user.is_active
                                  ? 'text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border-rose-50 dark:border-rose-900/30'
                                  : 'text-emerald-500 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-emerald-50 dark:border-emerald-900/30'
                              }`}
                              title={user.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {user.is_active ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── CHANGE MY PASSWORD CARD ───────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">

          <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Lock className="text-indigo-600 dark:text-indigo-400" size={22} />
              Change My Password
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              Update your own CEO account password
            </p>
          </div>

          <div className="p-8 bg-indigo-50/30 dark:bg-indigo-900/10 transition-colors duration-300">
            <div className="max-w-sm space-y-4">
              {changePassError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-bold border border-rose-100 dark:border-rose-800/50 animate-in slide-in-from-top-2">
                  <AlertCircle size={15} /> {changePassError}
                </div>
              )}
              {changePassSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold border border-emerald-100 dark:border-emerald-800/50">
                  <CheckCircle2 size={15} /> Password changed successfully!
                </div>
              )}

              {[
                { label: 'Current Password', key: 'current', placeholder: '••••••••' },
                { label: 'New Password',     key: 'newPass', placeholder: 'Minimum 6 characters' },
                { label: 'Confirm New Password', key: 'confirm', placeholder: 'Re-enter new password' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-widest ml-1 uppercase">{label}</label>
                  <input
                    type="password"
                    value={changePassForm[key]}
                    onChange={e => setChangePassForm(f => ({ ...f, [key]: e.target.value }))}
                    className={inputCls}
                    placeholder={placeholder}
                  />
                </div>
              ))}

              <button
                onClick={handleChangeOwnPassword}
                disabled={isChangingPass}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              >
                {isChangingPass ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                Update Password
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* ── MODALS ───────────────────────────────────────────── */}
      <UserFormModal
        isOpen={showAddModal || !!editUser}
        onClose={() => { setShowAddModal(false); setEditUser(null); }}
        onSave={fetchUsers}
        editUser={editUser}
      />

      <PasswordConfirmModal
        isOpen={showPasswordConfirm}
        onClose={() => { setShowPasswordConfirm(false); setPendingToggle(null); }}
        onConfirm={() => { setShowPasswordConfirm(false); doToggleActive(); }}
        actionType={pendingToggle?.is_active ? 'delete' : 'update'}
      />
    </div>
  );
}
