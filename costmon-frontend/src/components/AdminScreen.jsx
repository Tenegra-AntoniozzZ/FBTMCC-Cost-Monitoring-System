import { useState, useEffect } from 'react';
import {
  Users, Plus, Edit2, ShieldCheck, ShieldOff, Eye, EyeOff,
  AlertCircle, CheckCircle2, Loader2, X, RefreshCw, KeyRound,
  UserCheck, UserX, Crown, Lock
} from 'lucide-react';
import { API_URL } from '../utils/Constants';
import PasswordConfirmModal from './PasswordConfirmModal';

const ROLE_STYLES = {
  ceo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
  encoder: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50',
  engineer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
};
const ROLE_ICONS = { ceo: <Crown size={12} />, encoder: <Edit2 size={12} />, engineer: <ShieldCheck size={12} /> };

function UserFormModal({ isOpen, onClose, onSave, editUser = null }) {
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', role: 'encoder', security_question: '', security_answer: '', newPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

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
      const token = localStorage.getItem('fbtmcc_token');
      let payload, url, method;
      if (editUser) {
        payload = { username: form.username, role: form.role, security_question: form.security_question };
        if (form.security_answer) payload.security_answer = form.security_answer;
        if (form.newPassword) payload.newPassword = form.newPassword;
        url = `${API_URL}/users/${editUser.id}`;
        method = 'PUT';
      } else {
        payload = { username: form.username, password: form.password, role: form.role, security_question: form.security_question, security_answer: form.security_answer };
        url = `${API_URL}/users`;
        method = 'POST';
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setErrors({ general: data.error || 'Save failed.' }); return; }
      setSuccess(true);
      setTimeout(() => { onSave(); onClose(); }, 1000);
    } catch {
      setErrors({ general: 'Server connection error.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 px-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Users size={20} />
            <h2 className="text-lg font-black">{editUser ? 'Edit User' : 'Add New User'}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {errors.general && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold">
              <AlertCircle size={16} /> {errors.general}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold">
              <CheckCircle2 size={16} /> Saved successfully!
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Username</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border ${errors.username ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500`}
              placeholder="e.g. juan.delacruz" />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="encoder">Encoder</option>
              <option value="engineer">Engineer</option>
              <option value="ceo">CEO / Admin</option>
            </select>
          </div>

          {!editUser ? (
            <div className="relative">
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Password</label>
              <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className={`w-full px-4 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border ${errors.password ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500`}
                placeholder="Minimum 6 characters" />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">New Password <span className="normal-case font-medium text-slate-400">(leave blank to keep current)</span></label>
              <input type={showPass ? 'text' : 'password'} value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                className="w-full px-4 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Leave blank to keep current" />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}

          {((!editUser && form.password) || (editUser && form.newPassword)) && (
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Confirm Password</label>
              <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border ${errors.confirmPassword ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500`}
                placeholder="Re-enter password" />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Security Question <span className="normal-case font-medium">(optional)</span></label>
            <input value={form.security_question} onChange={e => setForm(f => ({ ...f, security_question: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="e.g. Ano ang pangalan ng inyong alagang hayop?" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={isSaving}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isSaving || success}
              className="flex-[2] py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {editUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminScreen({ currentUser, isDark }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(null);
  const [toast, setToast] = useState(null);

  // My Account: change own password
  const [showChangePass, setShowChangePass] = useState(false);
  const [changePassForm, setChangePassForm] = useState({ current: '', newPass: '', confirm: '' });
  const [changePassError, setChangePassError] = useState('');
  const [changePassSuccess, setChangePassSuccess] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  const token = localStorage.getItem('fbtmcc_token');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch { }
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleActive = (user) => {
    setPendingToggle(user);
    setShowPasswordConfirm(true);
  };

  const doToggleActive = async () => {
    if (!pendingToggle) return;
    try {
      const res = await fetch(`${API_URL}/users/${pendingToggle.id}/toggle-active`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(pendingToggle.is_active ? `${pendingToggle.username} deactivated.` : `${pendingToggle.username} activated.`);
        fetchUsers();
      } else {
        showToast(data.error || 'Failed.', 'error');
      }
    } catch {
      showToast('Server error.', 'error');
    }
    setPendingToggle(null);
  };

  const handleChangeOwnPassword = async () => {
    setChangePassError('');
    if (!changePassForm.current) { setChangePassError('Enter current password.'); return; }
    if (!changePassForm.newPass) { setChangePassError('Enter new password.'); return; }
    if (changePassForm.newPass !== changePassForm.confirm) { setChangePassError('New passwords do not match.'); return; }
    if (changePassForm.newPass.length < 6) { setChangePassError('Password must be at least 6 characters.'); return; }
    setIsChangingPass(true);
    try {
      const me = JSON.parse(atob(token.split('.')[1]));
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
    } catch {
      setChangePassError('Server connection error.');
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0a] transition-colors duration-300 overflow-hidden">
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm animate-in slide-in-from-top-3 duration-300 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white">User Management</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{users.length} user{users.length !== 1 ? 's' : ''} in the system</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors border border-slate-200 dark:border-slate-700">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-200 dark:shadow-none">
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-6 space-y-6">
        {/* USER TABLE */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Users size={18} className="text-violet-500" /> System Users
            </h2>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw size={28} className="animate-spin text-violet-500" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                  <th className="px-6 py-3 text-left">User</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${user.is_active ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
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
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black ${ROLE_STYLES[user.role] || 'bg-slate-100 text-slate-600'}`}>
                        {ROLE_ICONS[user.role]} {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black border border-emerald-200 dark:border-emerald-800/50">
                          <UserCheck size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-black border border-red-200 dark:border-red-800/50">
                          <UserX size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditUser(user)}
                          className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-800/50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        {String(currentUser?.id) !== String(user.id) && (
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`p-2 rounded-lg transition-colors border ${user.is_active
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-100 dark:border-red-800/50'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-emerald-100 dark:border-emerald-800/50'
                              }`}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {user.is_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* CHANGE MY PASSWORD */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Lock size={18} className="text-violet-500" /> Change My Password
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Update your own CEO account password</p>
          </div>
          <div className="p-6 space-y-4 max-w-sm">
            {changePassError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold">
                <AlertCircle size={15} /> {changePassError}
              </div>
            )}
            {changePassSuccess && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold">
                <CheckCircle2 size={15} /> Password changed successfully!
              </div>
            )}
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Current Password</label>
              <input type="password" value={changePassForm.current} onChange={e => setChangePassForm(f => ({ ...f, current: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">New Password</label>
              <input type="password" value={changePassForm.newPass} onChange={e => setChangePassForm(f => ({ ...f, newPass: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Minimum 6 characters" />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Confirm New Password</label>
              <input type="password" value={changePassForm.confirm} onChange={e => setChangePassForm(f => ({ ...f, confirm: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Re-enter new password" />
            </div>
            <button onClick={handleChangeOwnPassword} disabled={isChangingPass}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60">
              {isChangingPass ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Update Password
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
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
