import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Calendar,
  Camera,
  Check,
  DollarSign,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  SearchX,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AlertDialog, Button, Chip, Label, Switch } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { formatBudget } from '../lib/campaignFormat';
import { CURRENCIES, PAYMENT_FREQUENCIES, hasPaymentDay, monthlyEquivalent } from '../lib/catalog';
import { formatCompact, socialEntries } from '../lib/socialLinks';
import { MetricCard, PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { Notice } from '../components/common/Notice';
import { DirectoryToolbar } from '../components/common/filters';
import PlatformIcon from './landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY, accentFor, fieldClass } from './talent/shared';

/**
 * MyTeam — the brand's roster (accepted applicants + accepted invitations):
 * who they are (profile, socials), what they are paid, what they may do.
 * Same story-ring identity as the directory, one shared currency/frequency
 * catalog (the old page silently downgraded `quarterly` to `monthly`).
 */
type Member = {
  id: string;
  member?: {
    id?: string;
    email?: string;
    creatorProfile?: any;
    managerProfile?: any;
  };
  member_type?: 'creator' | 'manager' | string;
  permissions?: Record<string, boolean>;
  payment_amount?: number | string | null;
  payment_frequency?: string;
  currency?: string;
  payment_day?: number;
  joined_at?: string;
};

const PERMISSIONS = ['can_add_campaigns', 'can_view_analytics', 'can_manage_applications'] as const;

const profileOf = (m: Member) => m.member?.creatorProfile || m.member?.managerProfile || {};
const nameOf = (m: Member) => {
  const p = profileOf(m);
  return p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || m.member?.email?.split('@')[0] || '—';
};

/* Hoisted so React keeps the switch mounted between renders. */
const PermissionSwitch: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <Switch isSelected={checked} onChange={onChange}>
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    <Switch.Content>
      <Label className="text-sm">{label}</Label>
    </Switch.Content>
  </Switch>
);

const MemberCard: React.FC<{
  member: Member;
  index: number;
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
  onRemove: (m: Member) => void;
}> = ({ member, index, onChanged, onError, onRemove }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [perms, setPerms] = useState<Record<string, boolean>>(member.permissions || {});
  const [amount, setAmount] = useState(member.payment_amount != null ? String(Number(member.payment_amount)) : '');
  const [freq, setFreq] = useState(member.payment_frequency || 'monthly');
  const [curr, setCurr] = useState(member.currency || 'USD');
  const [day, setDay] = useState(String(member.payment_day || 1));
  const [saving, setSaving] = useState<'perms' | 'pay' | null>(null);

  const isManager = member.member_type === 'manager';
  const name = nameOf(member);
  const profile = profileOf(member);
  const accent = accentFor(String(member.member?.id || name));
  const links = socialEntries(profile.social_links).slice(0, 4);
  const permsDirty = PERMISSIONS.some((k) => !!perms[k] !== !!(member.permissions || {})[k]);

  const savePerms = async () => {
    setSaving('perms');
    try {
      await api.patch(`/invitations/team/${member.id}/permissions`, { permissions: perms });
      onChanged(t('team.permsSaved', { name }));
    } catch (e: any) {
      onError(e?.response?.data?.message || t('team.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  const savePayment = async () => {
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) {
      onError(t('apps.errAmount'));
      return;
    }
    setSaving('pay');
    try {
      await api.patch(`/invitations/team/${member.id}/payment-terms`, {
        payment_amount: n,
        payment_frequency: freq,
        currency: curr,
        payment_day: hasPaymentDay(freq) ? Number(day) : 1,
      });
      setEditing(false);
      onChanged(t('team.paySaved', { name }));
    } catch (e: any) {
      onError(e?.response?.data?.message || t('team.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <article className="v-talent-card v-card-in p-4 flex flex-col" style={{ animationDelay: `${(index % 12) * 28}ms` }}>
      <div className="flex items-start gap-3">
        <span className="v-story-ring">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" loading="lazy" className="h-11 w-11 object-cover" />
          ) : (
            <span className="inline-flex h-11 w-11 items-center justify-center text-base font-medium text-white" style={{ background: accent.from }}>
              {name[0]?.toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="v-ink font-medium truncate" style={{ fontSize: 15, letterSpacing: '-0.015em' }}>{name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 v-caption v-quiet" style={{ fontSize: 11.5 }}>
            <span className="truncate">{member.member?.email}</span>
            {profile.location && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-0.5 truncate">
                  <MapPin size={10} className="shrink-0" /> {profile.location}
                </span>
              </>
            )}
          </div>
        </div>
        <Chip color={isManager ? 'accent' : 'success'} variant="soft" size="sm" className="shrink-0">
          {isManager ? <Award size={10} /> : <Camera size={10} />}
          <Chip.Label>{isManager ? t('talent.managerFallback') : t('talent.creatorFallback')}</Chip.Label>
        </Chip>
      </div>

      {/* socials */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {links.length > 0 ? (
          links.map((l) => (
            <a key={l.id} className="v-social-chip" href={l.url || undefined} target="_blank" rel="noreferrer" title={l.label}>
              <span className="inline-flex" style={{ color: l.color }}>
                <PlatformIcon platform={PLATFORM_ICON_KEY[l.id]} size={13} />
              </span>
              {l.followers ? (
                <span className="v-ink font-medium tabular-nums" style={{ fontSize: 11 }}>{formatCompact(l.followers)}</span>
              ) : null}
            </a>
          ))
        ) : (
          <span className="v-caption v-quiet" style={{ fontSize: 11.5 }}>
            {profile.category || profile.specialty || t('team.noSocials')}
          </span>
        )}
      </div>

      {/* payment terms */}
      <div className="mt-4 rounded-xl p-3.5" style={{ background: 'rgba(244,242,255,0.55)', border: '1px solid var(--color-cool-gray)' }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="v-caption v-quiet font-medium uppercase tracking-wider inline-flex items-center gap-1" style={{ fontSize: 10 }}>
            <DollarSign size={10} /> {t('team.payment')}
          </span>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="v-caption inline-flex items-center gap-1 hover:underline" style={{ fontSize: 11, color: 'var(--color-campaign-purple)' }}>
              <Pencil size={10} /> {t('dash.edit')}
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(false)} className="v-caption inline-flex items-center gap-1 v-quiet" style={{ fontSize: 11 }}>
              <X size={10} /> {t('common.cancel')}
            </button>
          )}
        </div>
        {!editing ? (
          member.payment_amount ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium tabular-nums" style={{ fontSize: 17, letterSpacing: '-0.018em', color: '#0b6e3e' }}>
                {formatBudget(member.payment_amount, member.currency || 'USD')}
              </span>
              <span className="v-caption v-quiet" style={{ fontSize: 11.5 }}>
                / {t(`apps.freq.${member.payment_frequency || 'monthly'}`, { defaultValue: member.payment_frequency })}
              </span>
              {hasPaymentDay(member.payment_frequency) && (
                <span className="v-caption v-quiet inline-flex items-center gap-1 ml-auto" style={{ fontSize: 11 }}>
                  <Calendar size={10} /> {t('apps.dayN', { n: member.payment_day || 1 })}
                </span>
              )}
            </div>
          ) : (
            <span className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('team.noTerms')}</span>
          )
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <select className={fieldClass} value={curr} onChange={(e) => setCurr(e.target.value)} aria-label={t('wizard.currency')}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input type="number" min={0} step="0.01" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={t('apps.amount')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className={fieldClass} value={freq} onChange={(e) => setFreq(e.target.value)} aria-label={t('apps.frequency')}>
                {PAYMENT_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{t(`apps.freq.${f}`)}</option>
                ))}
              </select>
              <select className={fieldClass} value={day} onChange={(e) => setDay(e.target.value)} aria-label={t('apps.paymentDay')} disabled={!hasPaymentDay(freq)} style={!hasPaymentDay(freq) ? { opacity: 0.5 } : undefined}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{t('apps.dayN', { n: d })}</option>
                ))}
              </select>
            </div>
            <Button variant="primary" size="sm" fullWidth onPress={savePayment} isPending={saving === 'pay'}>
              <Check size={12} /> {t('apps.saveTerms')}
            </Button>
          </div>
        )}
      </div>

      {/* permissions */}
      <div className="mt-4">
        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-2" style={{ fontSize: 10 }}>{t('team.permissions')}</div>
        <div className="flex flex-col gap-1.5">
          {PERMISSIONS.map((k) => (
            <PermissionSwitch key={k} label={t(`team.perm.${k}`)} checked={!!perms[k]} onChange={(v) => setPerms((p) => ({ ...p, [k]: v }))} />
          ))}
        </div>
      </div>

      <div className="flex-1" style={{ minHeight: 12 }} aria-hidden />
      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {member.member?.id && (
            <Link to={`/dashboard/messages?newId=${member.member.id}&name=${encodeURIComponent(name)}`}>
              <Button variant="ghost" size="sm">
                <MessageSquare size={12} /> {t('apps.message')}
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" className="!text-danger" onPress={() => onRemove(member)}>
            <Trash2 size={12} /> {t('team.remove')}
          </Button>
        </div>
        <Button variant={permsDirty ? 'primary' : 'tertiary'} size="sm" isDisabled={!permsDirty} isPending={saving === 'perms'} onPress={savePerms}>
          <Check size={12} /> {t('team.savePerms')}
        </Button>
      </div>
    </article>
  );
};

const MyTeam: React.FC = () => {
  const { t } = useTranslation();
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'creator' | 'manager'>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setError(false);
    api
      .get('/invitations/team')
      .then((res) => setTeam(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const counts = useMemo(
    () => ({
      all: team.length,
      creator: team.filter((m) => m.member_type === 'creator').length,
      manager: team.filter((m) => m.member_type === 'manager').length,
    }),
    [team],
  );
  const monthly = useMemo(() => {
    // Rough monthly commitment in USD-equivalent is not computable without FX;
    // show per-currency totals instead.
    const byCur = new Map<string, number>();
    for (const m of team) {
      const n = Number(m.payment_amount) || 0;
      if (!n) continue;
      const perMonth = monthlyEquivalent(n, m.payment_frequency);
      if (!perMonth) continue; // one-time payments are not a monthly commitment
      const c = m.currency || 'USD';
      byCur.set(c, (byCur.get(c) || 0) + perMonth);
    }
    return [...byCur.entries()].map(([c, v]) => formatBudget(Math.round(v), c)).join(' + ') || '—';
  }, [team]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return team.filter((m) => {
      if (filter !== 'all' && m.member_type !== filter) return false;
      if (q && !`${nameOf(m)} ${m.member?.email || ''} ${profileOf(m).category || ''} ${profileOf(m).specialty || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [team, filter, search]);

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await api.delete(`/invitations/team/${pendingRemove.id}`);
      setNotice({ tone: 'success', text: t('team.removed', { name: nameOf(pendingRemove) }) });
      setPendingRemove(null);
      load();
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.response?.data?.message || t('team.saveFailed') });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('team.title')}
      titleAccent={t('team.titleAccent')}
      description={t('team.desc')}
      icon={<Users size={18} />}
      actions={
        <Link to="/dashboard/talent">
          <Button variant="primary" size="md">
            <Plus size={14} /> {t('team.recruit')}
          </Button>
        </Link>
      }
      stats={
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label={t('team.kpiMembers')} value={counts.all} icon={Users} />
          <MetricCard label={t('team.kpiCreators')} value={counts.creator} hint={t('team.kpiManagersN', { n: counts.manager })} icon={Star} />
          <MetricCard label={t('team.kpiMonthly')} value={monthly} hint={t('team.kpiMonthlyHint')} icon={DollarSign} />
        </div>
      }
    >
      {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}

      <DirectoryToolbar
        leading={
          <Segment size="sm" selectedKey={filter} onSelectionChange={(k) => setFilter(k as typeof filter)} aria-label="Member type">
            <Segment.Item id="all">{t('dash.all')} · {counts.all}</Segment.Item>
            <Segment.Item id="creator">{t('talent.tabCreators')} · {counts.creator}</Segment.Item>
            <Segment.Item id="manager">{t('talent.tabManagers')} · {counts.manager}</Segment.Item>
          </Segment>
        }
        search={{ value: search, onChange: setSearch, placeholder: t('talent.searchPh'), widthClass: 'w-full sm:w-[240px]' }}
        count={loading ? t('common.searching') : t('board.count', { shown: visible.length, total: team.length })}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="v-talent-card p-4" aria-hidden>
              <div className="flex items-start gap-3">
                <div className="v-skel h-12 w-12 !rounded-full shrink-0" />
                <div className="flex-1 pt-1">
                  <div className="v-skel h-4 w-1/2 mb-2" />
                  <div className="v-skel h-3 w-3/4" />
                </div>
              </div>
              <div className="v-skel h-16 w-full mt-4" />
              <div className="v-skel h-20 w-full mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('board.errTitle')} description={t('board.errDesc')} actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
      ) : team.length === 0 ? (
        <EmptyPanel
          icon={<Users size={22} />}
          title={t('dash.noTeamTitle')}
          description={t('dash.noTeamDesc')}
          actions={
            <>
              <Link to="/dashboard/talent">
                <Button variant="primary">
                  <Star size={13} /> {t('dash.browseTalent')}
                </Button>
              </Link>
              <Link to="/dashboard/applications">
                <Button variant="tertiary">{t('dash.openInbox')}</Button>
              </Link>
            </>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyPanel size="sm" icon={<SearchX size={20} />} title={t('board.emptyTitle')} description={t('board.emptyStatus')} actions={<Button variant="primary" size="sm" onPress={() => { setFilter('all'); setSearch(''); }}>{t('board.resetFilters')}</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((m, i) => (
            <MemberCard
              key={m.id}
              member={m}
              index={i}
              onChanged={(text) => { setNotice({ tone: 'success', text }); load(); }}
              onError={(text) => setNotice({ tone: 'error', text })}
              onRemove={setPendingRemove}
            />
          ))}
        </div>
      )}

      <AlertDialog isOpen={!!pendingRemove} onOpenChange={(open) => !open && !removing && setPendingRemove(null)}>
        <AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger">
                  <AlertTriangle size={18} />
                </AlertDialog.Icon>
                <AlertDialog.Heading>{t('team.removeTitle')}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>{t('team.removeBody', { name: pendingRemove ? nameOf(pendingRemove) : '' })}</AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" isDisabled={removing} onPress={() => setPendingRemove(null)}>{t('common.cancel')}</Button>
                <Button variant="danger" isPending={removing} onPress={confirmRemove}>
                  <Trash2 size={13} /> {t('team.remove')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </PageShell>
  );
};

export default MyTeam;
