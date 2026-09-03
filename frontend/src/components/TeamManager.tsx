import React, { useEffect, useState } from 'react';
import { AlertTriangle, Settings2, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { AlertDialog, Button, Chip, Label, Modal, Switch } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { toast } from '../lib/toast';
import { fieldClass, accentFor } from '../pages/talent/shared';
import { EmptyPanel } from './common/EmptyPanel';
import { Notice } from './common/Notice';

/**
 * TeamManager — sub-users of the brand account (colleagues who sign in
 * under the same brand). Invite, edit permissions, remove, and define
 * custom roles — all via HeroUI modals and dialogs.
 */
type Member = { id: string; email: string; role?: string; permissions?: Record<string, boolean>; custom_role_id?: string };
type Role = { id: string; name: string; permissions?: Record<string, boolean> };

const PERMISSIONS = ['can_add_campaigns', 'can_view_analytics', 'can_manage_applications'] as const;

const TeamManager: React.FC = () => {
  const { t } = useTranslation();
  const [team, setTeam] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: '', password: '', custom_role_id: '' });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [showRole, setShowRole] = useState(false);
  const [role, setRole] = useState<{ name: string; perms: Record<string, boolean> }>({ name: '', perms: {} });
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState('');

  const [permsFor, setPermsFor] = useState<Member | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [permsBusy, setPermsBusy] = useState(false);

  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchTeam = () => {
    Promise.all([api.get('/brands/team'), api.get('/roles/brand').catch(() => ({ data: [] }))])
      .then(([resTeam, resRoles]) => {
        setTeam(Array.isArray(resTeam.data) ? resTeam.data : []);
        setRoles(Array.isArray(resRoles.data) ? resRoles.data : []);
      })
      .catch(() => toast.error(t('teamMgr.loadFailed')))
      .finally(() => setLoading(false));
  };
  useEffect(fetchTeam, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invite.password.length < 8) return setInviteError(t('account.pwShort'));
    setInviteBusy(true);
    setInviteError('');
    try {
      await api.post('/brands/team', { email: invite.email.trim(), password: invite.password, role: 'brand', custom_role_id: invite.custom_role_id || undefined, permissions: {} });
      setShowInvite(false);
      setInvite({ email: '', password: '', custom_role_id: '' });
      toast.success(t('teamMgr.invited', { email: invite.email.trim() }));
      fetchTeam();
    } catch (err: any) {
      setInviteError(err?.response?.data?.message || t('teamMgr.inviteFailed'));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.name.trim()) return setRoleError(t('teamMgr.roleNameRequired'));
    setRoleBusy(true);
    setRoleError('');
    try {
      await api.post('/roles/brand', { name: role.name.trim(), permissions: role.perms });
      setShowRole(false);
      setRole({ name: '', perms: {} });
      toast.success(t('teamMgr.roleCreated'));
      fetchTeam();
    } catch (err: any) {
      setRoleError(err?.response?.data?.message || t('teamMgr.roleFailed'));
    } finally {
      setRoleBusy(false);
    }
  };

  const openPerms = (m: Member) => {
    setPermsFor(m);
    setPerms({ ...(m.permissions || {}) });
  };
  const savePerms = async () => {
    if (!permsFor) return;
    setPermsBusy(true);
    try {
      await api.patch(`/brands/team/${permsFor.id}`, { permissions: perms });
      toast.success(t('teamMgr.permsSaved'));
      setPermsFor(null);
      fetchTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('teamMgr.permsFailed'));
    } finally {
      setPermsBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await api.delete(`/brands/team/${pendingRemove.id}`);
      toast.success(t('teamMgr.removed', { email: pendingRemove.email }));
      setPendingRemove(null);
      fetchTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('teamMgr.removeFailed'));
    } finally {
      setRemoving(false);
    }
  };

  const roleName = (m: Member) => roles.find((r) => r.id === m.custom_role_id)?.name || t('teamMgr.defaultRole');

  return (
    <section className="v-talent-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-start gap-3">
          <span className="v-hero-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
            <Users size={14} />
          </span>
          <div>
            <h3 className="v-ink font-medium" style={{ fontSize: 15, letterSpacing: '-0.012em' }}>{t('teamMgr.title')}</h3>
            <p className="v-caption v-quiet mt-0.5" style={{ fontSize: 12 }}>{t('teamMgr.desc')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="tertiary" size="sm" onPress={() => setShowRole(true)}>
            <Shield size={12} /> {t('teamMgr.roles')}
          </Button>
          <Button variant="primary" size="sm" onPress={() => setShowInvite(true)}>
            <UserPlus size={12} /> {t('teamMgr.invite')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-hidden>
          <div className="v-skel h-12 w-full" />
          <div className="v-skel h-12 w-full" />
        </div>
      ) : team.length === 0 ? (
        <EmptyPanel
          size="sm"
          icon={<Users size={18} />}
          title={t('teamMgr.empty')}
          description={t('teamMgr.emptyDesc')}
          actions={
            <Button variant="primary" size="sm" onPress={() => setShowInvite(true)}>
              <UserPlus size={12} /> {t('teamMgr.invite')}
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {team.map((m) => {
            const accent = accentFor(m.email);
            return (
              <li key={m.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="v-story-ring" style={{ padding: 2 }}>
                  <span className="inline-flex h-8 w-8 items-center justify-center text-xs font-medium text-white" style={{ background: accent.from }}>
                    {m.email[0]?.toUpperCase()}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="v-ink font-medium truncate" style={{ fontSize: 13 }}>{m.email}</div>
                  <div className="v-caption v-quiet" style={{ fontSize: 11 }}>{roleName(m)}</div>
                </div>
                <div className="hidden sm:flex items-center gap-1 flex-wrap justify-end max-w-[40%]">
                  {PERMISSIONS.filter((k) => m.permissions?.[k]).map((k) => (
                    <Chip key={k} size="sm" variant="soft" color="accent">
                      <Chip.Label>{t(`team.perm.${k}`)}</Chip.Label>
                    </Chip>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onPress={() => openPerms(m)}>
                  <Settings2 size={12} /> {t('teamMgr.perms')}
                </Button>
                <Button variant="ghost" size="sm" className="!text-danger" onPress={() => setPendingRemove(m)}>
                  <Trash2 size={12} /> {t('teamMgr.remove')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Invite */}
      <Modal isOpen={showInvite} onOpenChange={(open) => !open && !inviteBusy && setShowInvite(false)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2">
                  <UserPlus size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('teamMgr.inviteTitle')}
                </Modal.Heading>
              </Modal.Header>
              <form id="team-invite-form" onSubmit={handleInvite}>
                <Modal.Body>
                  <div className="space-y-4">
                    <p className="v-body v-muted" style={{ fontSize: 13 }}>{t('teamMgr.inviteDesc')}</p>
                    {inviteError && <Notice tone="error" onDismiss={() => setInviteError('')}>{inviteError}</Notice>}
                    <label className="block">
                      <span className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 12 }}>{t('teamMgr.email')}</span>
                      <input type="email" className={fieldClass} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} required autoFocus />
                    </label>
                    <label className="block">
                      <span className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 12 }}>{t('teamMgr.tempPassword')}</span>
                      <input type="password" autoComplete="new-password" className={fieldClass} value={invite.password} onChange={(e) => setInvite({ ...invite, password: e.target.value })} required minLength={8} />
                    </label>
                    <label className="block">
                      <span className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 12 }}>{t('teamMgr.roleLbl')}</span>
                      <select className={fieldClass} value={invite.custom_role_id} onChange={(e) => setInvite({ ...invite, custom_role_id: e.target.value })}>
                        <option value="">{t('teamMgr.defaultRole')}</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => setShowInvite(false)} isDisabled={inviteBusy}>{t('common.cancel')}</Button>
                  <Button type="submit" variant="primary" isPending={inviteBusy}>
                    <UserPlus size={13} /> {t('teamMgr.inviteBtn')}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Create role */}
      <Modal isOpen={showRole} onOpenChange={(open) => !open && !roleBusy && setShowRole(false)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2">
                  <Shield size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('teamMgr.rolesTitle')}
                </Modal.Heading>
              </Modal.Header>
              <form id="team-role-form" onSubmit={handleCreateRole}>
                <Modal.Body>
                  <div className="space-y-4">
                    <p className="v-body v-muted" style={{ fontSize: 13 }}>{t('teamMgr.rolesDesc')}</p>
                    {roles.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {roles.map((r) => (
                          <Chip key={r.id} size="sm" variant="soft" color="default">
                            <Chip.Label>{r.name}</Chip.Label>
                          </Chip>
                        ))}
                      </div>
                    )}
                    {roleError && <Notice tone="error" onDismiss={() => setRoleError('')}>{roleError}</Notice>}
                    <label className="block">
                      <span className="v-caption v-ink font-medium block mb-1" style={{ fontSize: 12 }}>{t('teamMgr.roleName')}</span>
                      <input className={fieldClass} value={role.name} onChange={(e) => setRole({ ...role, name: e.target.value })} placeholder={t('teamMgr.roleNamePh')} required autoFocus />
                    </label>
                    <div>
                      <span className="v-caption v-ink font-medium block mb-2" style={{ fontSize: 12 }}>{t('teamMgr.rolePerms')}</span>
                      <div className="flex flex-col gap-1.5">
                        {PERMISSIONS.map((k) => (
                          <Switch key={k} isSelected={!!role.perms[k]} onChange={(v) => setRole({ ...role, perms: { ...role.perms, [k]: v } })}>
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                            <Switch.Content>
                              <Label className="text-sm">{t(`team.perm.${k}`)}</Label>
                            </Switch.Content>
                          </Switch>
                        ))}
                      </div>
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => setShowRole(false)} isDisabled={roleBusy}>{t('common.cancel')}</Button>
                  <Button type="submit" variant="primary" isPending={roleBusy}>
                    <Shield size={13} /> {t('teamMgr.createRole')}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Permissions */}
      <Modal isOpen={!!permsFor} onOpenChange={(open) => !open && !permsBusy && setPermsFor(null)}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2">
                  <Settings2 size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('teamMgr.permsTitle', { email: permsFor?.email || '' })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-col gap-2">
                  {PERMISSIONS.map((k) => (
                    <Switch key={k} isSelected={!!perms[k]} onChange={(v) => setPerms({ ...perms, [k]: v })}>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>
                        <Label className="text-sm">{t(`team.perm.${k}`)}</Label>
                      </Switch.Content>
                    </Switch>
                  ))}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setPermsFor(null)} isDisabled={permsBusy}>{t('common.cancel')}</Button>
                <Button variant="primary" onPress={savePerms} isPending={permsBusy}>{t('team.savePerms')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Remove */}
      <AlertDialog isOpen={!!pendingRemove} onOpenChange={(open) => !open && !removing && setPendingRemove(null)}>
        <AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger">
                  <AlertTriangle size={18} />
                </AlertDialog.Icon>
                <AlertDialog.Heading>{t('teamMgr.removeTitle')}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>{t('teamMgr.removeBody', { email: pendingRemove?.email || '' })}</AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" isDisabled={removing} onPress={() => setPendingRemove(null)}>{t('common.cancel')}</Button>
                <Button variant="danger" isPending={removing} onPress={confirmRemove}>
                  <Trash2 size={13} /> {t('teamMgr.remove')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  );
};

export default TeamManager;
