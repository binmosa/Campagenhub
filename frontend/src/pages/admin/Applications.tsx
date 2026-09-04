import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileText, Percent, Users, Video } from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { weekSeries } from '../../lib/series';
import { formatBudget, postedLabel } from '../../lib/campaignFormat';
import { APPLICATION_STATUSES, APPLICATION_STATUS_COLOR, normalizeApplicationStatus, type ApplicationStatus } from '../../lib/catalog';
import { formatCompact, totalFollowers, verifiedFollowers } from '../../lib/socialLinks';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { DirectoryToolbar } from '../../components/common/filters';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { Fact, RowSkeletons, dateShort, userIdentity } from './shared';

/**
 * AdminApplications — every pitch across every brief, read-only for the
 * platform team: who applied where, with what audience, and how the brand
 * answered. Open a row to read the full pitch and watch the video intro.
 */
type StatusFilter = 'all' | ApplicationStatus;
const PAGE = 30;

const audienceOf = (creator: any) => {
  const raw = creator?.creatorProfile?.social_links;
  return { claimed: totalFollowers(raw), verified: verifiedFollowers(raw) };
};

const AdminApplications: React.FC = () => {
  const { t } = useTranslation();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<any>(null);

  const load = useCallback(() => {
    setError(false);
    api
      .get('/admin/applications')
      .then((r) => setApps(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const a of apps) {
      const s = normalizeApplicationStatus(a.status);
      by[s] = (by[s] || 0) + 1;
    }
    const decided = (by.accepted || 0) + (by.rejected || 0);
    return { by, rate: decided ? Math.round(((by.accepted || 0) / decided) * 100) : 0 };
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (status !== 'all' && normalizeApplicationStatus(a.status) !== status) return false;
      if (!q) return true;
      const who = userIdentity(a.creator);
      const brand = userIdentity(a.campaign?.brand);
      return [a.creator?.email, who.name, who.handle, a.campaign?.title, brand.name, a.pitch].some((s) => String(s || '').toLowerCase().includes(q));
    });
  }, [apps, search, status]);
  const shown = filtered.slice(0, limit);

  const stats = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('adm.apps.kpiAll')} value={apps.length} hint={t('adm.apps.kpiAllHint', { n: new Set(apps.map((a) => a.campaign?.id).filter(Boolean)).size })} series={weekSeries(apps)} icon={FileText} />
      <MetricCard label={t('appStatus.pending')} value={counts.by.pending || 0} hint={t('apps.kpiPendingHint')} icon={Clock} iconStatus={counts.by.pending ? 'warning' : undefined} />
      <MetricCard label={t('appStatus.accepted')} value={counts.by.accepted || 0} hint={t('adm.apps.kpiAcceptedHint')} icon={CheckCircle2} iconStatus={counts.by.accepted ? 'success' : undefined} chartColor="var(--color-signal-green, #16c784)" series={weekSeries(apps, (a) => normalizeApplicationStatus(a.status) === 'accepted')} />
      <MetricCard label={t('adm.apps.kpiRate')} value={`${counts.rate}%`} hint={t('adm.apps.kpiRateHint')} icon={Percent} />
    </div>
  );

  const openWho = open ? userIdentity(open.creator) : null;
  const openStatus = open ? normalizeApplicationStatus(open.status) : 'pending';

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('adm.apps.title')}
      titleAccent={t('adm.apps.titleAccent')}
      description={t('adm.apps.desc')}
      icon={<FileText size={18} />}
      stats={stats}
    >
      <div>
        <DirectoryToolbar
          search={{ value: search, onChange: setSearch, placeholder: t('adm.apps.searchPh'), widthClass: 'w-full sm:w-[320px]' }}
          count={t('adm.apps.count', { shown: shown.length, total: filtered.length })}
        >
          <Segment size="sm" selectedKey={status} onSelectionChange={(k) => { setStatus(k as StatusFilter); setLimit(PAGE); }} aria-label={t('adm.users.statusFilter')}>
            <Segment.Item id="all">{t('dash.all')} · {apps.length}</Segment.Item>
            {APPLICATION_STATUSES.map((s) => (
              <Segment.Item key={s} id={s}>{t(`appStatus.${s}`)} · {counts.by[s] || 0}</Segment.Item>
            ))}
          </Segment>
        </DirectoryToolbar>

        {loading ? (
          <RowSkeletons n={5} />
        ) : error ? (
          <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('adm.errTitle')} description={t('adm.errDesc')} actions={<Button variant="primary" onPress={() => { setLoading(true); load(); }}>{t('common.tryAgain')}</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyPanel
            icon={<FileText size={22} />}
            title={apps.length === 0 ? t('adm.apps.emptyTitle') : t('common.noMatches')}
            description={apps.length === 0 ? t('adm.apps.emptyDesc') : t('board.emptyStatus')}
            actions={apps.length > 0 ? <Button variant="tertiary" onPress={() => { setSearch(''); setStatus('all'); }}>{t('board.resetFilters')}</Button> : undefined}
          />
        ) : (
          <>
            <ul className="space-y-3">
              {shown.map((a) => {
                const who = userIdentity(a.creator);
                const brand = userIdentity(a.campaign?.brand);
                const s = normalizeApplicationStatus(a.status);
                const aud = audienceOf(a.creator);
                return (
                  <li key={a.id} className="v-talent-card p-4 grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_minmax(200px,1fr)_minmax(220px,1.4fr)_auto] gap-4 items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <StoryAvatar src={who.avatar} name={who.name || a.creator?.email} seed={a.creator?.id || a.id} size={44} />
                      <div className="min-w-0">
                        <div className="v-ink font-medium truncate" style={{ fontSize: 14.5 }}>{who.name || a.creator?.email}</div>
                        <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                          {who.handle || a.creator?.email}
                          {aud.claimed > 0 && (
                            <>
                              {' · '}
                              <Users size={10} className="inline" /> {formatCompact(aud.verified || aud.claimed)} {aud.verified ? t('adm.apps.verified') : t('adm.apps.claimed')}
                            </>
                          )}
                        </div>
                        {who.sub && <div className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>{who.sub}</div>}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="v-ink font-medium truncate" style={{ fontSize: 13.5 }}>{a.campaign?.title || t('dash.campaign')}</div>
                      <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
                        {brand.name || a.campaign?.brand?.email || ''} · {t('adm.apps.applied', { when: postedLabel(a.created_at) })}
                      </div>
                      {s === 'accepted' && a.payment_amount && (
                        <div className="v-caption tabular-nums truncate mt-0.5" style={{ fontSize: 11.5, color: '#0b6e3e' }}>
                          {formatBudget(a.payment_amount, a.currency || 'USD')}{a.payment_frequency ? ` / ${t(`apps.freq.${a.payment_frequency}`, { defaultValue: a.payment_frequency })}` : ''}
                        </div>
                      )}
                    </div>

                    <button type="button" onClick={() => setOpen(a)} className="text-left min-w-0">
                      <p className="v-body v-muted line-clamp-2" style={{ fontSize: 12.5 }}>{a.pitch || t('apps.noPitch')}</p>
                      {a.video_pitch_url && (
                        <span className="inline-flex items-center gap-1 v-caption mt-1" style={{ fontSize: 11, color: 'var(--color-campaign-purple)' }}>
                          <Video size={10} /> {t('apps.video')}
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-2 lg:flex-col lg:items-end shrink-0">
                      <Chip color={APPLICATION_STATUS_COLOR[s]} variant="soft" size="sm">
                        <Chip.Label>{t(`appStatus.${s}`)}</Chip.Label>
                      </Chip>
                      <Button variant="ghost" size="sm" className="!px-2.5" onPress={() => setOpen(a)}>{t('apps.open')}</Button>
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

      <Modal isOpen={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex items-center gap-3 min-w-0 pr-8">
                  <StoryAvatar src={openWho?.avatar} name={openWho?.name || open?.creator?.email} seed={open?.creator?.id || open?.id} size={40} />
                  <div className="min-w-0">
                    <Modal.Heading className="truncate">{openWho?.name || open?.creator?.email}</Modal.Heading>
                    <p className="v-caption v-quiet truncate" style={{ fontSize: 12 }}>
                      {open?.creator?.email} · {open?.campaign?.title}
                    </p>
                  </div>
                </div>
              </Modal.Header>
              <Modal.Body>
                {open && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip color={APPLICATION_STATUS_COLOR[openStatus]} variant="soft" size="sm"><Chip.Label>{t(`appStatus.${openStatus}`)}</Chip.Label></Chip>
                      <span className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('adm.apps.applied', { when: dateShort(open.created_at) })}</span>
                    </div>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Fact label={t('side.roleBrand')}>{userIdentity(open.campaign?.brand).name || open.campaign?.brand?.email || '—'}</Fact>
                      <Fact label={t('talent.fFollowers')}>{formatCompact(audienceOf(open.creator).verified || audienceOf(open.creator).claimed)}</Fact>
                      <Fact label={t('apps.amount')}>{open.payment_amount ? formatBudget(open.payment_amount, open.currency || 'USD') : '—'}</Fact>
                      <Fact label={t('apps.frequency')}>{open.payment_frequency ? t(`apps.freq.${open.payment_frequency}`, { defaultValue: open.payment_frequency }) : '—'}</Fact>
                    </dl>
                    <div>
                      <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1" style={{ fontSize: 10.5 }}>{t('apps.pitch')}</div>
                      <p className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 13.5 }}>{open.pitch || t('apps.noPitch')}</p>
                    </div>
                    {open.video_pitch_url && (
                      <div>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1" style={{ fontSize: 10.5 }}>{t('apps.video')}</div>
                        <video src={open.video_pitch_url} controls className="w-full rounded-xl v-hairline" style={{ maxHeight: 360 }} />
                      </div>
                    )}
                    {open.notes && (
                      <div>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1" style={{ fontSize: 10.5 }}>{t('apps.notes')}</div>
                        <p className="v-body v-muted whitespace-pre-wrap" style={{ fontSize: 12.5 }}>{open.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setOpen(null)}>{t('common.close')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </PageShell>
  );
};

export default AdminApplications;
