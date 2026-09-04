import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Braces, Check, KeyRound, ListChecks, Pencil, Plus, Shield, Trash2, Users, X } from 'lucide-react';
import { Button, Chip, Modal, Switch } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from '../../lib/toast';
import { fieldClass } from '../talent/shared';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Field, dateShort, type AdminUser } from './shared';

/**
 * AdminRoles — custom staff roles and what they may do. Permissions are a
 * flat map of flags; edit them as a checklist (add a key, flip it) or, for
 * power users, as raw JSON. Roles are assigned to people on the Users page.
 */
type Role = { id: string; name: string; permissions?: Record<string, boolean> | null; created_at?: string };
type Perm = { key: string; on: boolean };

const toPerms = (p?: Record<string, unknown> | null): Perm[] => Object.entries(p || {}).map(([key, v]) => ({ key, on: !!v }));
const fromPerms = (list: Perm[]): Record<string, boolean> => Object.fromEntries(list.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.on]));

const PermissionEditor: React.FC<{ value: Perm[]; onChange: (v: Perm[]) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [raw, setRaw] = useState(false);
  const [json, setJson] = useState('');
  const [draft, setDraft] = useState('');

  const openRaw = () => { setJson(JSON.stringify(fromPerms(value), null, 2)); setRaw(true); };
  const applyRaw = () => {
    try {
      const parsed = JSON.parse(json || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
      onChange(toPerms(parsed));
      setRaw(false);
    } catch {
      toast.error(t('adm.roles.jsonInvalid'));
    }
  };
  const add = () => {
    const key = draft.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key) return;
    if (value.some((p) => p.key === key)) return toast.error(t('adm.roles.dupKey', { key }));
    onChange([...value, { key, on: true }]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="v-caption v-ink font-medium" style={{ fontSize: 12 }}>{t('adm.roles.permissions')}</span>
        {raw ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onPress={() => setRaw(false)}><X size={11} /> {t('common.cancel')}</Button>
            <Button variant="tertiary" size="sm" onPress={applyRaw}><Check size={11} /> {t('adm.roles.applyJson')}</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onPress={openRaw}><Braces size={11} /> {t('adm.roles.editJson')}</Button>
        )}
      </div>
      {raw ? (
        <textarea rows={8} value={json} onChange={(e) => setJson(e.target.value)} className={`${fieldClass} font-mono`} aria-label={t('adm.roles.permissions')} />
      ) : (
        <div className="space-y-2">
          {value.length === 0 && <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('adm.roles.noPerms')}</p>}
          {value.map((p, i) => (
            <div key={p.key} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-cool-gray)' }}>
              <code className="v-ink flex-1 truncate" style={{ fontSize: 12.5 }}>{p.key}</code>
              <Switch isSelected={p.on} onChange={(on) => onChange(value.map((x, j) => (j === i ? { ...x, on } : x)))} aria-label={p.key}>
                <Switch.Control><Switch.Thumb /></Switch.Control>
              </Switch>
              <Button variant="ghost" size="sm" isIconOnly aria-label={t('adm.roles.removeKey', { key: p.key })} onPress={() => onChange(value.filter((_, j) => j !== i))}>
                <X size={12} />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className={fieldClass} placeholder={t('adm.roles.keyPh')} aria-label={t('adm.roles.addKey')} />
            <Button variant="tertiary" size="sm" onPress={add} isDisabled={!draft.trim()}><Plus size={12} /> {t('adm.roles.addKey')}</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminRoles: React.FC = () => {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<Perm[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);

  const load = useCallback(() => {
    setError(false);
    Promise.all([api.get('/roles/global'), api.get('/admin/users').catch(() => ({ data: [] }))])
      .then(([r, u]) => {
        setRoles(Array.isArray(r.data) ? r.data : []);
        setUsers(Array.isArray(u.data) ? u.data : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const usersByRole = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of users) {
      const r = String(u.role || '').toLowerCase();
      m[r] = (m[r] || 0) + 1;
    }
    return m;
  }, [users]);
  const onCustom = roles.reduce((s, r) => s + (usersByRole[String(r.name).toLowerCase()] || 0), 0);
  const keyCount = roles.reduce((s, r) => s + Object.keys(r.permissions || {}).length, 0);

  const startCreate = () => { setEditing('new'); setName(''); setPerms([]); };
  const startEdit = (r: Role) => { setEditing(r); setName(r.name); setPerms(toPerms(r.permissions)); };

  const save = async () => {
    if (editing === 'new' && !name.trim()) return toast.error(t('adm.roles.nameRequired'));
    setBusy(true);
    try {
      if (editing === 'new') {
        await api.post('/roles/global', { name: name.trim(), permissions: fromPerms(perms) });
        toast.success(t('adm.roles.created', { name: name.trim() }));
      } else if (editing) {
        await api.patch(`/roles/${editing.id}`, { permissions: fromPerms(perms) });
        toast.success(t('adm.roles.saved', { name: editing.name }));
      }
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('adm.roles.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.delete(`/roles/${confirmDelete.id}`);
      toast.success(t('adm.roles.deleted', { name: confirmDelete.name }));
      setConfirmDelete(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('adm.roles.deleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  const stats = (
    <div className="grid grid-cols-3 gap-3">
      <MetricCard label={t('adm.roles.kpiRoles')} value={roles.length} hint={t('adm.roles.kpiRolesHint')} icon={Shield} />
      <MetricCard label={t('adm.roles.kpiPeople')} value={onCustom} hint={t('adm.roles.kpiPeopleHint')} icon={Users} iconStatus={onCustom ? 'success' : undefined} />
      <MetricCard label={t('adm.roles.kpiKeys')} value={keyCount} hint={t('adm.roles.kpiKeysHint')} icon={KeyRound} />
    </div>
  );

  return (
    <PageShell
      hero
      title={t('adm.roles.title')}
      titleAccent={t('adm.roles.titleAccent')}
      description={t('adm.roles.desc')}
      icon={<Shield size={18} />}
      actions={<Button variant="primary" size="md" onPress={startCreate}><Plus size={14} /> {t('adm.roles.create')}</Button>}
      stats={stats}
    >
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="v-talent-card p-5"><div className="v-skel h-5 w-1/2 mb-3" /><div className="v-skel h-3 w-full mb-1.5" /><div className="v-skel h-3 w-2/3" /></div>)}
        </div>
      ) : error ? (
        <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('adm.errTitle')} description={t('adm.errDesc')} actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
      ) : roles.length === 0 ? (
        <EmptyPanel icon={<Shield size={22} />} title={t('adm.roles.emptyTitle')} description={t('adm.roles.emptyDesc')} actions={<Button variant="primary" onPress={startCreate}><Plus size={13} /> {t('adm.roles.create')}</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((r) => {
            const list = toPerms(r.permissions);
            const people = usersByRole[String(r.name).toLowerCase()] || 0;
            return (
              <article key={r.id} className="v-talent-card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="v-hero-icon shrink-0" style={{ width: 36, height: 36, borderRadius: 11 }}><Shield size={16} /></span>
                    <div className="min-w-0">
                      <h3 className="v-ink font-medium truncate" style={{ fontSize: 15.5, letterSpacing: '-0.012em' }}>{r.name}</h3>
                      <div className="v-caption v-quiet" style={{ fontSize: 11.5 }}>
                        {t('adm.roles.people', { n: people })}{r.created_at ? ` · ${dateShort(r.created_at)}` : ''}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" isIconOnly aria-label={t('adm.roles.deleteAria', { name: r.name })} className="!text-danger" onPress={() => setConfirmDelete(r)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-1.5 flex-wrap flex-1 content-start">
                  {list.length === 0 && <span className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('adm.roles.noPerms')}</span>}
                  {list.slice(0, 8).map((p) => (
                    <Chip key={p.key} color={p.on ? 'success' : 'default'} variant="soft" size="sm">
                      {p.on ? <Check size={10} /> : <X size={10} />}
                      <Chip.Label><code style={{ fontSize: 11 }}>{p.key}</code></Chip.Label>
                    </Chip>
                  ))}
                  {list.length > 8 && <span className="v-caption v-quiet" style={{ fontSize: 11.5 }}>+{list.length - 8}</span>}
                </div>
                <Button variant="tertiary" size="sm" className="mt-4" fullWidth onPress={() => startEdit(r)}>
                  <Pencil size={12} /> {t('adm.roles.edit')}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!editing} onOpenChange={(o) => !o && !busy && setEditing(null)}>
        <Modal.Backdrop isDismissable={!busy}>
          <Modal.Container>
            <Modal.Dialog className="!max-w-lg">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="inline-flex items-center gap-2">
                  <ListChecks size={16} style={{ color: 'var(--color-campaign-purple)' }} />
                  {editing === 'new' ? t('adm.roles.createTitle') : t('adm.roles.editTitle', { name: (editing as Role)?.name })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-4">
                  {editing === 'new' ? (
                    <Field label={t('adm.roles.name')} hint={t('adm.roles.nameHint')}>
                      <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} placeholder={t('adm.roles.namePh')} autoFocus />
                    </Field>
                  ) : (
                    <p className="v-caption v-quiet" style={{ fontSize: 12.5 }}>{t('adm.roles.editIntro')}</p>
                  )}
                  <PermissionEditor value={perms} onChange={setPerms} />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setEditing(null)} isDisabled={busy}>{t('common.cancel')}</Button>
                <Button variant="primary" onPress={save} isPending={busy}>
                  {editing === 'new' ? t('adm.roles.create') : t('adm.roles.save')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        tone="danger"
        pending={busy}
        title={t('adm.roles.deleteTitle', { name: confirmDelete?.name })}
        body={t('adm.roles.deleteBody', { n: confirmDelete ? usersByRole[String(confirmDelete.name).toLowerCase()] || 0 : 0 })}
        confirmLabel={t('adm.roles.deleteConfirm')}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
      />
    </PageShell>
  );
};

export default AdminRoles;
