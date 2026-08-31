import React, { useEffect, useState } from 'react';
import { Shield, Plus, Trash2, Save, X, Edit, Lock } from 'lucide-react';
import api from '../../lib/api';

const AdminRoles: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePerms, setNewRolePerms] = useState('');

  const fetchRoles = () => {
    setLoading(true);
    api.get('/roles/global')
      .then(res => { setRoles(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const perms = newRolePerms.trim() ? JSON.parse(newRolePerms) : {};
      await api.post('/roles/global', { name: newRoleName, permissions: perms });
      setShowCreate(false);
      setNewRoleName('');
      setNewRolePerms('');
      fetchRoles();
    } catch { alert('Failed to create role. Check JSON format.'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete role ${name}? Users with this role may lose access.`)) return;
    try {
      await api.delete(`/roles/${id}`);
      fetchRoles();
    } catch { alert('Failed to delete role'); }
  };

  const handleSavePerms = async () => {
    try {
      const perms = newRolePerms.trim() ? JSON.parse(newRolePerms) : {};
      await api.patch(`/roles/${editingRole.id}`, { permissions: perms });
      setShowEdit(false);
      fetchRoles();
    } catch { alert('Failed to save. Check JSON.'); }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 md:py-8 px-0 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-surface-200 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-900 tracking-tight">Role Studio</h1>
          <p className="text-surface-500 font-medium text-sm mt-1">Create and manage global custom roles and permission payloads.</p>
        </div>
        <button onClick={() => { setNewRoleName(''); setNewRolePerms(''); setShowCreate(true); }} className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
          <Plus size={16} /> Create Role
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-surface-200 border-t-brand-600 rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map(r => (
            <div key={r.id} className="card p-6 border-t-4 border-t-brand-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Shield size={20} className="text-brand-500" />
                  <h3 className="font-bold text-surface-900 text-lg">{r.name}</h3>
                </div>
                <button onClick={() => handleDelete(r.id, r.name)} className="text-surface-400 hover:text-red-500 p-1 bg-surface-50 rounded transition-colors"><Trash2 size={16}/></button>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 overflow-auto max-h-32 mb-4">
                <pre className="text-xs text-green-400 font-mono m-0">{JSON.stringify(r.permissions, null, 2)}</pre>
              </div>
              <button 
                onClick={() => { setEditingRole(r); setNewRolePerms(JSON.stringify(r.permissions || {}, null, 2)); setShowEdit(true); }}
                className="w-full py-2 bg-surface-50 hover:bg-surface-100 text-surface-700 rounded-xl font-bold text-sm border border-surface-200 transition-all flex items-center justify-center gap-2"
              >
                <Edit size={14} /> Edit Permissions
              </button>
            </div>
          ))}
          {roles.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-surface-200 rounded-2xl">
              <Shield size={48} className="mx-auto text-surface-300 mb-3" />
              <p className="text-surface-600 font-bold text-lg">No Custom Admin Roles</p>
              <p className="text-surface-400 text-sm max-w-sm mx-auto mt-1">Create custom roles here, then assign them to users in the User Management tab.</p>
            </div>
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-surface-900 mb-4">Create New Role</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="text-sm font-bold text-surface-700 mb-1 block">Role Name</label><input type="text" required placeholder="e.g. Content Moderator" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2" /></div>
              <div>
                <label className="text-sm font-bold text-surface-700 mb-1 flex items-center gap-1 block"><Lock size={14}/> JSON Permissions</label>
                <textarea rows={5} value={newRolePerms} onChange={e => setNewRolePerms(e.target.value)} placeholder='{"can_moderate": true}' className="w-full bg-slate-900 text-green-400 font-mono text-xs border border-surface-200 rounded-xl px-4 py-3 resize-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-surface-100">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-surface-600 font-bold hover:bg-surface-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600">Create Role</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEdit && editingRole && (
        <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-surface-900 mb-1">Edit {editingRole.name}</h2>
            <p className="text-xs text-surface-500 mb-4">Editing global permissions payload.</p>
            <div className="space-y-4">
              <div>
                <textarea rows={6} value={newRolePerms} onChange={e => setNewRolePerms(e.target.value)} className="w-full bg-slate-900 text-green-400 font-mono text-xs border border-surface-200 rounded-xl px-4 py-3 resize-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-surface-100">
                <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 text-surface-600 font-bold hover:bg-surface-100 rounded-xl">Cancel</button>
                <button type="button" onClick={handleSavePerms} className="px-4 py-2 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600">Save Payload</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminRoles;
