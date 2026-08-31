import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Trash2, Shield, Settings2, Edit } from 'lucide-react';
import api from '../lib/api';

const TeamManager: React.FC = () => {
  const [team, setTeam] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleCreate, setShowRoleCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'brand', custom_role_id: '', permissions: {} });
  const [newRole, setNewRole] = useState({ name: '', permissions: '' });

  const fetchTeam = () => {
    setLoading(true);
    Promise.all([
      api.get('/brands/team'),
      api.get('/roles/brand').catch(() => ({ data: [] }))
    ]).then(([resTeam, resRoles]) => {
      setTeam(resTeam.data);
      setRoles(resRoles.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/brands/team', newUser);
      setShowInvite(false);
      setNewUser({ email: '', password: '', role: 'brand', custom_role_id: '', permissions: {} });
      fetchTeam();
    } catch { alert('Failed to invite team member'); }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const perms = newRole.permissions.trim() ? JSON.parse(newRole.permissions) : {};
      await api.post('/roles/brand', { name: newRole.name, permissions: perms });
      setShowRoleCreate(false);
      setNewRole({ name: '', permissions: '' });
      fetchTeam();
    } catch { alert('Creation failed. Ensure JSON is valid.'); }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('Remove this team member?')) return;
    try {
      await api.delete(`/brands/team/${id}`);
      fetchTeam();
    } catch { alert('Failed to remove'); }
  };

  return (
    <div className="card p-6 md:p-8 mt-12 bg-white">
      <div className="flex justify-between items-center mb-6 border-b border-surface-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-surface-900 flex items-center gap-2">
            <Users className="text-brand-500"/> Team Management
          </h2>
          <p className="text-sm text-surface-500 mt-1">Manage sub-users and colleagues within your brand account.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRoleCreate(true)} className="bg-surface-100 hover:bg-surface-200 text-surface-700 border border-surface-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
            <Shield size={16} /> Manage Roles
          </button>
          <button onClick={() => setShowInvite(true)} className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
            <UserPlus size={16} /> Invite Member
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 rounded-full border-4 border-surface-200 border-t-brand-500 animate-spin"></div></div>
      ) : team.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-surface-200 rounded-xl bg-surface-50">
          <Users size={32} className="mx-auto text-surface-300 mb-2"/>
          <p className="text-surface-600 font-bold">No team members yet.</p>
          <p className="text-surface-400 text-sm">Add a member to collaborate on campaigns.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {team.map(member => (
            <div key={member.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-surface-200 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center text-surface-700 font-extrabold text-sm shadow-sm border border-surface-300 shrink-0">
                  {member.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-surface-900">{member.email}</div>
                  <div className="text-xs text-surface-500 flex items-center gap-1"><Shield size={12}/> Role: {member.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <button
                  onClick={() => alert('Editing permissions UI goes here.')}
                  className="w-full sm:w-auto px-4 py-2 bg-white border border-surface-200 rounded-lg text-xs font-bold text-surface-600 hover:text-surface-900 shadow-sm flex justify-center items-center gap-1"
                >
                  <Settings2 size={14}/> Perms
                </button>
                <button
                  onClick={() => handleRemove(member.id)}
                  className="w-full sm:w-auto px-4 py-2 bg-white border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 shadow-sm flex justify-center items-center gap-1"
                >
                  <Trash2 size={14}/> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white border border-surface-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-surface-900 mb-4">Invite Team Member</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div><label className="text-sm font-bold text-surface-700 mb-1 block">Email</label><input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2" /></div>
              <div><label className="text-sm font-bold text-surface-700 mb-1 block">Temporary Password</label><input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2" /></div>
              <div>
                <label className="text-sm font-bold text-surface-700 mb-1 block">Role (Optional)</label>
                <select value={newUser.custom_role_id} onChange={e => setNewUser({...newUser, custom_role_id: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2">
                  <option value="">Default Brand (Full Access)</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-surface-100">
                <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 text-surface-600 font-bold hover:bg-surface-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600">Invite Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoleCreate && (
        <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white border border-surface-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-surface-900 mb-4">Create Local Role</h2>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div><label className="text-sm font-bold text-surface-700 mb-1 block">Role Name</label><input type="text" required value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} placeholder="e.g. Campaign Assistant" className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2" /></div>
              <div><label className="text-sm font-bold text-surface-700 mb-1 block">Permissions (JSON)</label><textarea rows={4} value={newRole.permissions} onChange={e => setNewRole({...newRole, permissions: e.target.value})} placeholder='{"can_post": true, "can_pay": false}' className="w-full bg-slate-900 text-green-400 font-mono text-xs border border-surface-200 rounded-xl px-4 py-2 resize-none" /></div>
              <div className="pt-4 flex justify-end gap-3 border-t border-surface-100">
                <button type="button" onClick={() => setShowRoleCreate(false)} className="px-4 py-2 text-surface-600 font-bold hover:bg-surface-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600">Create Role</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManager;
