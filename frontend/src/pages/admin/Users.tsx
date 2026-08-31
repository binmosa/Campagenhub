import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle,
  Edit,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react';
import { Avatar, Button, Chip, Modal, SearchField } from '@heroui/react';
import { DataGrid } from '@heroui-pro/react';
import type { DataGridColumn } from '@heroui-pro/react';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';

type User = {
  id: string;
  email: string;
  role: string;
  is_banned?: boolean;
  kyc_required?: boolean;
  permissions?: any;
};

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'creator',
  });
  const [editPermissions, setEditPermissions] = useState('');

  const fetchUsers = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/admin/users'),
      api.get('/roles/global').catch(() => ({ data: [] })),
    ])
      .then(([resUsers, resRoles]) => {
        setUsers(resUsers.data || []);
        setRoles(resRoles.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', newUser);
      setShowCreate(false);
      setNewUser({ email: '', password: '', role: 'creator' });
      fetchUsers();
    } catch {
      alert('Failed to create user');
    }
  };

  const handleUpdateRole = async (id: string, role: string) => {
    try {
      await api.patch(`/admin/users/${id}`, { role });
      fetchUsers();
    } catch {
      alert('Update failed');
    }
  };

  const handleToggleBan = async (id: string) => {
    try {
      await api.patch(`/admin/users/${id}/ban`);
      fetchUsers();
    } catch {
      alert('Ban toggle failed');
    }
  };

  const handleRequireKyc = async (id: string, required: boolean) => {
    const verb = required ? 'require' : 'clear';
    if (!window.confirm(`${required ? 'Require KYC for' : 'Clear KYC requirement on'} this user?`)) return;
    try {
      await api.patch(`/admin/users/${id}/require-kyc`, { required });
      fetchUsers();
    } catch {
      alert(`Failed to ${verb} KYC`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchUsers();
    } catch {
      alert('Delete failed');
    }
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    try {
      let perms = null;
      if (editPermissions.trim() !== '') {
        perms = JSON.parse(editPermissions);
      }
      await api.patch(`/admin/users/${editingUser.id}/permissions`, {
        permissions: perms,
      });
      setEditingUser(null);
      fetchUsers();
    } catch {
      alert('Invalid Permissions JSON');
    }
  };

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.role.toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
  );

  const columns: DataGridColumn<User>[] = [
    {
      accessorKey: 'email',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar size="sm">
            <Avatar.Fallback>
              {item.email[0]?.toUpperCase() || 'U'}
            </Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-foreground text-sm font-medium truncate">
              {item.email}
            </span>
            <span className="text-muted text-xs font-mono truncate">
              {item.id}
            </span>
          </div>
        </div>
      ),
      header: 'User',
      id: 'email',
      isRowHeader: true,
      minWidth: 280,
    },
    {
      accessorKey: 'role',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <select
          value={item.role}
          onChange={(e) => handleUpdateRole(item.id, e.target.value)}
          className="rounded-lg bg-surface border border-border px-2 py-1 text-xs font-medium capitalize cursor-pointer focus:outline-none focus:border-field-border-focus"
        >
          {[
            'creator',
            'brand',
            'manager',
            'support',
            'finance',
            'admin',
            ...roles.map((r) => r.name),
          ].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      ),
      header: 'Role',
      id: 'role',
      minWidth: 140,
    },
    {
      allowsResizing: true,
      cell: (item) => (
        <div className="flex items-center gap-2 flex-wrap">
          {item.is_banned ? (
            <Chip color="danger" size="sm" variant="soft">
              <Ban className="size-3" />
              <Chip.Label>Banned</Chip.Label>
            </Chip>
          ) : (
            <Chip color="success" size="sm" variant="soft">
              <CheckCircle className="size-3" />
              <Chip.Label>Active</Chip.Label>
            </Chip>
          )}
          {item.permissions && (
            <Chip color="default" size="sm" variant="soft">
              <Lock className="size-3" />
              <Chip.Label>Custom perms</Chip.Label>
            </Chip>
          )}
        </div>
      ),
      header: 'Status',
      id: 'status',
      minWidth: 200,
    },
    {
      align: 'end',
      allowsResizing: false,
      cell: (item) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant={item.is_banned ? 'tertiary' : 'tertiary'}
            size="sm"
            onPress={() => handleToggleBan(item.id)}
          >
            {item.is_banned ? 'Unban' : 'Ban'}
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => {
              setEditingUser(item);
              setEditPermissions(
                item.permissions
                  ? JSON.stringify(item.permissions, null, 2)
                  : ''
              );
            }}
          >
            <Edit className="size-3" /> Perms
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => handleRequireKyc(item.id, !item.kyc_required)}
          >
            <ShieldCheck className="size-3" />
            {item.kyc_required ? 'Clear KYC' : 'Require KYC'}
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            isIconOnly
            aria-label="Delete user"
            onPress={() => handleDelete(item.id)}
          >
            <Trash2 className="size-3.5 text-danger" />
          </Button>
        </div>
      ),
      header: '',
      id: 'actions',
      minWidth: 320,
      pinned: 'end',
    },
  ];

  return (
    <PageShell
      title="User Management"
      description="Manage platform users, roles, bans, and permissions."
      icon={<UsersIcon size={18} />}
      actions={
        <Button variant="primary" size="md" onPress={() => setShowCreate(true)}>
          <Plus className="size-3.5" /> Create user
        </Button>
      }
    >
      <div className="flex justify-end">
        <SearchField
          aria-label="Search users"
          value={search}
          onChange={setSearch}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              className="w-full sm:w-[260px]"
              placeholder="Search by email or role…"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <DataGrid
          allowsColumnResize
          aria-label="Users"
          columns={columns}
          contentClassName="min-w-[1100px]"
          data={filtered}
          defaultSortDescriptor={{ column: 'email', direction: 'ascending' }}
          getRowId={(item) => item.id}
          renderEmptyState={() => 'No users found.'}
          selectionMode="none"
          variant="primary"
        />
      )}

      {/* Create user modal */}
      <Modal isOpen={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Create new user</Modal.Heading>
            </Modal.Header>
            <form id="create-user-form" onSubmit={handleCreateUser}>
              <Modal.Body>
                <div className="space-y-4">
                  <div>
                    <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Temporary password
                    </label>
                    <input
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Role
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({ ...newUser, role: e.target.value })
                      }
                      className={fieldClass}
                    >
                      <option value="creator">Creator</option>
                      <option value="brand">Brand</option>
                      <option value="manager">Social Manager</option>
                      <option value="support">Support Agent</option>
                      <option value="finance">Finance Officer</option>
                      <option value="admin">Admin</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Modal.Body>
            </form>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-user-form"
                variant="primary"
              >
                Create
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Edit permissions modal */}
      <Modal
        isOpen={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Edit permissions</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-muted text-sm mb-4">
                Setting custom permissions for{' '}
                <span className="text-foreground font-medium">
                  {editingUser?.email}
                </span>
              </p>
              <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                <Lock size={11} /> JSON permissions payload
              </label>
              <textarea
                rows={6}
                value={editPermissions}
                onChange={(e) => setEditPermissions(e.target.value)}
                className={`${fieldClass} font-mono`}
                placeholder='{"can_view_ai_reports": true}'
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button variant="primary" onPress={handleSavePermissions}>
                Save JSON
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </PageShell>
  );
};

export default AdminUsers;
