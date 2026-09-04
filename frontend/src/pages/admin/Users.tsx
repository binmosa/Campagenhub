import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Lock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users as UsersIcon,
} from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from '../../lib/toast';
import { weekSeries, withinDays } from '../../lib/series';
import { fieldClass } from '../talent/shared';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { DirectoryToolbar } from '../../components/common/filters';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { ALL_ROLES, Field, RoleChip, RowSkeletons, STAFF_ROLES, dateShort, userIdentity, type AdminUser } from './shared';

/**
 * AdminUsers — everyone on the platform in one directory: filter by role
 * and account state, change roles inline, ban, require KYC, edit custom
 * permissions, or remove an account. Every destructive step confirms in a
 * modal and reports back with a toast.
 */
type StatusFilter = 'all' | 'active' | 'pending' | 'banned' | 'staff';
type RoleFilter = 'all' | (typeof ALL_ROLES)[number] | 'custom';
const PAGE = 30;

const AdminUsers: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [role, setRole] = useState<RoleFilter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'creator' });
  const [permUser, setPermUser] = useState<AdminUser | null>(null);
  const [permJson, setPermJson] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'kyc' | 'ban'; user: AdminUser } | null>(null);

  const load = useCallback(() => {
    setError(false);
    Promise.all([api.get('/admin/users'), api.get('/roles/global').catch(() => ({ data: [] }))])
      .then(([u, r]) => {
        setUsers(Array.isArray(u.data) ? u.data : []);
        setCustomRoles(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const customNames = useMemo(() => new Set(customRoles.map((r) => String(r.name).toLowerCase())), [customRoles]);
  const isStaff = (u: AdminUser) => (STAFF_ROLES as readonly string[]).includes(String(u.role).toLowerCase());

  const counts = useMemo(() => {
    const byRole: Record<string, number> = {};
    for (const u of users) {
      const r = String(u.role || '').toLowerCase();
      byRole[r] = (byRole[r] || 0) + 1;
    }
    return {
      byRole,
      custom: users.filter((u) => customNames.has(String(u.role).toLowerCase())).length,
      active: users.filter((u) => u.account_status === 'active' && !u.is_banned).length,
      pending: users.filter((u) => u.account_status === 'pending_verification').length,
      banned: users.filter((u) => u.is_banned).length,
      staff: users.filter(isStaff).length,
      new7: withinDays(users, 7),
    };
  }, [users, customNames]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const r = String(u.role || '').toLowerCase();
      if (role === 'custom' ? !customNames.has(r) : role !== 'all' && r !== role) return false;
      if (status === 'active' && !(u.account_status === 'active' && !u.is_banned)) return false;
      if (status === 'pending' && u.account_status !== 'pending_verification') return false;
      if (status === 'banned' && !u.is_banned) return false;
      if (status === 'staff' && !isStaff(u)) return false;
      if (!q) return true;
      const who = userIdentity(u);
      return [u.email, who.name, who.handle, r].some((s) => (s || '').toLowerCase().includes(q));
    });
  }, [users, search, status, role, customNames]);
  const shown = filtered.slice(0, limit);

  const run = async (id: string, fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || fail);
    } finally {
      setBusy(null);
    }
  };

  const changeRole = (u: AdminUser, next: string) =>
    run(u.id, () => api.patch(`/admin/users/${u.id}`, { role: next }), t('adm.users.roleChanged', { email: u.email, role: t(`adm.roles.${next}`, { defaultValue: next }) }), t('adm.users.updateFailed'));

  const onConfirm = async () => {
    if (!confirm) return;
    const u = confirm.user;
    if (confirm.kind === 'delete') await run(u.id, () => api.delete(`/admin/users/${u.id}`), t('adm.users.deleted', { email: u.email }), t('adm.users.deleteFailed'));
    if (confirm.kind === 'ban') await run(u.id, () => api.patch(`/admin/users/${u.id}/ban`), u.is_banned ? t('adm.users.unbanned', { email: u.email }) : t('adm.users.banned', { email: u.email }), t('adm.users.updateFailed'));
    if (confirm.kind === 'kyc') await run(u.id, () => api.patch(`/admin/users/${u.id}/require-kyc`, { required: !u.kyc_required }), u.kyc_required ? t('adm.users.kycCleared', { email: u.email }) : t('adm.users.kycRequired', { email: u.email }), t('adm.users.updateFailed'));
    setConfirm(null);
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('create');
    try {
      await api.post('/admin/users', newUser);
      toast.success(t('adm.users.created', { email: newUser.email }));
      setShowCreate(false);
      setNewUser({ email: '', password: '', role: 'creator' });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('adm.users.createFailed'));
    } finally {
      setBusy(null);
    }
  };

  const savePerms = async () => {
    if (!permUser) return;
    let perms: any = null;
    try {
      perms = permJson.trim() ? JSON.parse(permJson) : null;
    } catch {
      return toast.error(t('adm.users.permsInvalid'));
    }
    await run(permUser.id, () => api.patch(`/admin/users/${permUser.id}/permissions`, { permissions: perms }), t('adm.users.permsSaved', { email: permUser.email }), t('adm.users.updateFailed'));
    setPermUser(null);
  };

  const roleOptions = [...ALL_ROLES, ...customRoles.map((r) => String(r.name))];

  const stats = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('adm.users.kpiAll')} value={users.length} hint={t('adm.dash.kpiUsersHint', { n: counts.new7 })} series={weekSeries(users)} icon={UsersIcon} iconStatus={counts.new7 ? 'success' : undefined} />
      <MetricCard label={t('adm.users.kpiPending')} value={counts.pending} hint={t('adm.users.kpiPendingHint')} icon={ShieldAlert} iconStatus={counts.pending ? 'warning' : undefined} />
      <MetricCard label={t('adm.users.kpiBanned')} value={counts.banned} hint={t('adm.users.kpiBannedHint')} icon={Ban} iconStatus={counts.banned ? 'danger' : undefined} />
      <MetricCard label={t('adm.users.kpiStaff')} value={counts.staff} hint={t('adm.users.kpiStaffHint')} icon={ShieldCheck} />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('adm.users.title')}
      titleAccent={t('adm.users.titleAccent')}
      description={t('adm.users.desc')}
      icon={<UsersIcon size={18} />}
      actions={
        <Button variant="primary" size="md" onPress={() => setShowCreate(true)}>
          <UserPlus size={14} /> {t('adm.users.create')}
        </Button>
      }
      stats={stats}
    >
      <div>
        <DirectoryToolbar
          search={{ value: search, onChange: setSearch, placeholder: t('adm.users.searchPh'), widthClass: 'w-full sm:w-[300px]' }}
          count={t('adm.users.count', { shown: shown.length, total: filtered.length })}
        >
          <Segment size="sm" selectedKey={status} onSelectionChange={(k) => { setStatus(k as StatusFilter); setLimit(PAGE); }} aria-label={t('adm.users.statusFilter')}>
            <Segment.Item id="all">{t('dash.all')}</Segment.Item>
            <Segment.Item id="active">{t('adm.users.sActive')} · {counts.active}</Segment.Item>
            <Segment.Item id="pending">{t('adm.users.sPending')} · {counts.pending}</Segment.Item>
            <Segment.Item id="banned">{t('adm.users.sBanned')} · {counts.banned}</Segment.Item>
            <Segment.Item id="staff">{t('adm.users.sStaff')} · {counts.staff}</Segment.Item>
          </Segment>
        </DirectoryToolbar>

        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          <button type="button" className="v-niche-chip" data-active={role === 'all' || undefined} aria-pressed={role === 'all'} onClick={() => { setRole('all'); setLimit(PAGE); }}>
            {t('adm.users.allRoles')}
          </button>
          {ALL_ROLES.map((r) => (
            <button key={r} type="button" className="v-niche-chip" data-active={role === r || undefined} aria-pressed={role === r} onClick={() => { setRole(role === r ? 'all' : r); setLimit(PAGE); }}>
              {t(`adm.roles.${r}`)} <span className="opacity-70 tabular-nums">{counts.byRole[r] || 0}</span>
            </button>
          ))}
          {customRoles.length > 0 && (
            <button type="button" className="v-niche-chip" data-active={role === 'custom' || undefined} aria-pressed={role === 'custom'} onClick={() => { setRole(role === 'custom' ? 'all' : 'custom'); setLimit(PAGE); }}>
              {t('adm.users.customRoles')} <span className="opacity-70 tabular-nums">{counts.custom}</span>
            </button>
          )}
        </div>

        {loading ? (
          <RowSkeletons n={5} />
        ) : error ? (
          <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('adm.errTitle')} description={t('adm.errDesc')} actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyPanel
            icon={<UsersIcon size={22} />}
            title={users.length === 0 ? t('adm.users.emptyTitle') : t('common.noMatches')}
            description={users.length === 0 ? t('adm.users.emptyDesc') : t('adm.users.emptyFiltered')}
            actions={users.length > 0 ? <Button variant="tertiary" onPress={() => { setSearch(''); setStatus('all'); setRole('all'); }}>{t('board.resetFilters')}</Button> : undefined}
          />
        ) : (
          <>
            <ul className="space-y-3">
              {shown.map((u) => {
                const who = userIdentity(u);
                const r = String(u.role || '').toLowerCase();
                const pending = u.account_status === 'pending_verification';
                const rowBusy = busy === u.id;
                return (
                  <li key={u.id} className="v-talent-card p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StoryAvatar src={who.avatar} name={who.name || u.email} seed={u.id} size={44} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="v-ink font-medium truncate" style={{ fontSize: 14.5 }}>{who.name || u.email.split('@')[0]}</span>
                          <RoleChip role={r} />
                          {u.is_banned && (
                            <Chip color="danger" variant="soft" size="sm"><Ban size={11} /><Chip.Label>{t('adm.users.sBanned')}</Chip.Label></Chip>
                          )}
                          {!u.is_banned && pending && (
                            <Chip color="warning" variant="soft" size="sm"><ShieldAlert size={11} /><Chip.Label>{t('adm.users.chipPending')}</Chip.Label></Chip>
                          )}
                          {!u.is_banned && !pending && u.account_status === 'active' && (
                            <Chip color="success" variant="soft" size="sm"><CheckCircle2 size={11} /><Chip.Label>{t('adm.users.sActive')}</Chip.Label></Chip>
                          )}
                          {u.kyc_required && (
                            <Chip color="warning" variant="soft" size="sm"><ShieldCheck size={11} /><Chip.Label>{t('adm.users.chipKyc')}</Chip.Label></Chip>
                          )}
                          {u.permissions && Object.keys(u.permissions).length > 0 && (
                            <Chip color="default" variant="soft" size="sm"><Lock size={11} /><Chip.Label>{t('adm.users.chipPerms')}</Chip.Label></Chip>
                          )}
                        </div>
                        <div className="v-caption v-quiet truncate mt-0.5" style={{ fontSize: 12 }}>
                          {u.email}
                          {who.handle ? ` · ${who.handle}` : ''}
                          {who.sub ? ` · ${who.sub}` : ''}
                          {u.created_at ? ` · ${t('adm.users.joined', { when: dateShort(u.created_at) })}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0">
                      <select
                        aria-label={t('adm.users.roleFor', { email: u.email })}
                        value={r}
                        disabled={rowBusy}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className={`${fieldClass} !w-auto !py-1.5 !px-2.5 capitalize`}
                      >
                        {roleOptions.map((opt) => (
                          <option key={opt} value={opt}>{t(`adm.roles.${opt}`, { defaultValue: opt })}</option>
                        ))}
                      </select>
                      <Button variant="tertiary" size="sm" isPending={rowBusy && confirm?.kind === 'ban'} onPress={() => setConfirm({ kind: 'ban', user: u })}>
                        {u.is_banned ? t('adm.users.unban') : t('adm.users.ban')}
                      </Button>
                      <Button variant="tertiary" size="sm" onPress={() => setConfirm({ kind: 'kyc', user: u })}>
                        <ShieldCheck size={12} /> {u.kyc_required ? t('adm.users.clearKyc') : t('adm.users.requireKyc')}
                      </Button>
                      <Button variant="tertiary" size="sm" onPress={() => { setPermUser(u); setPermJson(u.permissions ? JSON.stringify(u.permissions, null, 2) : ''); }}>
                        <Lock size={12} /> {t('adm.users.perms')}
                      </Button>
                      <Button variant="ghost" size="sm" isIconOnly aria-label={t('adm.users.deleteAria', { email: u.email })} className="!text-danger" onPress={() => setConfirm({ kind: 'delete', user: u })}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {filtered.length > shown.length && (
              <div className="flex justify-center mt-6">
                <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="v-facet-btn !px-4 !py-2.5">
                  {t('common.loadMore', { n: filtered.length - shown.length })}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create user */}
      <Modal isOpen={showCreate} onOpenChange={(o) => !o && setShowCreate(false)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-md">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="inline-flex items-center gap-2"><UserPlus size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('adm.users.createTitle')}</Modal.Heading>
              </Modal.Header>
              <form id="create-user-form" onSubmit={createUser}>
                <Modal.Body>
                  <div className="space-y-4">
                    <p className="v-caption v-quiet" style={{ fontSize: 12.5 }}>{t('adm.users.createIntro')}</p>
                    <Field label={t('adm.users.fEmail')}>
                      <input type="email" required autoComplete="off" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className={fieldClass} placeholder="name@company.com" />
                    </Field>
                    <Field label={t('adm.users.fPassword')} hint={t('adm.users.fPasswordHint')}>
                      <input type="password" required minLength={8} autoComplete="new-password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className={fieldClass} />
                    </Field>
                    <Field label={t('adm.users.fRole')}>
                      <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className={`${fieldClass} capitalize`}>
                        {roleOptions.map((opt) => (
                          <option key={opt} value={opt}>{t(`adm.roles.${opt}`, { defaultValue: opt })}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </Modal.Body>
              </form>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setShowCreate(false)}>{t('common.cancel')}</Button>
                <Button type="submit" form="create-user-form" variant="primary" isPending={busy === 'create'}>
                  <Plus size={13} /> {t('adm.users.create')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Permissions */}
      <Modal isOpen={!!permUser} onOpenChange={(o) => !o && setPermUser(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-lg">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="inline-flex items-center gap-2"><Lock size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('adm.users.permsTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="v-caption v-quiet mb-3" style={{ fontSize: 12.5 }}>{t('adm.users.permsIntro', { email: permUser?.email })}</p>
                <Field label={t('adm.users.permsJson')} hint={t('adm.users.permsJsonHint')}>
                  <textarea rows={8} value={permJson} onChange={(e) => setPermJson(e.target.value)} className={`${fieldClass} font-mono`} placeholder='{"can_view_ai_reports": true}' />
                </Field>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setPermUser(null)}>{t('common.cancel')}</Button>
                <Button variant="primary" onPress={savePerms} isPending={busy === permUser?.id}>{t('adm.users.permsSave')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        tone={confirm?.kind === 'delete' || (confirm?.kind === 'ban' && !confirm.user.is_banned) ? 'danger' : 'primary'}
        pending={!!confirm && busy === confirm.user.id}
        title={
          confirm?.kind === 'delete'
            ? t('adm.users.deleteTitle')
            : confirm?.kind === 'ban'
              ? confirm.user.is_banned ? t('adm.users.unbanTitle') : t('adm.users.banTitle')
              : confirm?.user.kyc_required ? t('adm.users.clearKycTitle') : t('adm.users.requireKycTitle')
        }
        body={
          confirm?.kind === 'delete'
            ? t('adm.users.deleteBody', { email: confirm.user.email })
            : confirm?.kind === 'ban'
              ? confirm.user.is_banned ? t('adm.users.unbanBody', { email: confirm.user.email }) : t('adm.users.banBody', { email: confirm.user.email })
              : confirm?.user.kyc_required ? t('adm.users.clearKycBody', { email: confirm.user.email }) : t('adm.users.requireKycBody', { email: confirm?.user.email })
        }
        confirmLabel={
          confirm?.kind === 'delete'
            ? t('adm.users.deleteConfirm')
            : confirm?.kind === 'ban'
              ? confirm.user.is_banned ? t('adm.users.unban') : t('adm.users.ban')
              : confirm?.user.kyc_required ? t('adm.users.clearKyc') : t('adm.users.requireKyc')
        }
        onConfirm={onConfirm}
        onClose={() => setConfirm(null)}
      />
    </PageShell>
  );
};

export default AdminUsers;
