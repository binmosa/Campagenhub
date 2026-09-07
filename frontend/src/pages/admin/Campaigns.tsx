import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Briefcase, Eye, EyeOff, Globe, Pause, Play, Radio, RotateCcw, XCircle } from 'lucide-react';
import { Button, Chip, Modal } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from '../../lib/toast';
import { weekSeries } from '../../lib/series';
import { formatBudget, postedLabel } from '../../lib/campaignFormat';
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_COLOR, normalizeApplicationStatus, normalizeCampaignStatus, type CampaignStatus } from '../../lib/catalog';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { CampaignCard, parsePlatforms, type PlatformId } from '../../components/common/CampaignCard';
import { BriefDetails } from '../../components/common/BriefDetails';
import { DirectoryToolbar, PlatformChipRow } from '../../components/common/filters';
import { LoadMore, LoadMoreSkeleton } from '../../components/common/LoadMore';
import { usePagedList, useDebounced } from '../../lib/usePagedList';
import { StoryAvatar } from '../../components/common/StoryAvatar';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Fact, money, userIdentity } from './shared';

/**
 * AdminCampaigns — moderation view of every brief on the platform, on the
 * same cards creators and brands see. Publish, pause, close or reopen a
 * brief from the card; open it to read the full brief and its targeting.
 */
type StatusFilter = 'all' | CampaignStatus;
type SortKey = 'newest' | 'budget' | 'applicants';
const PAGE = 24;

const CampaignSkeleton: React.FC = () => (
  <div className="v-talent-card p-4" aria-hidden>
    <div className="flex items-center gap-2.5"><div className="v-skel h-8 w-8 !rounded-full" /><div className="v-skel h-3 w-1/3" /></div>
    <div className="v-skel h-4 w-3/4 mt-4" /><div className="v-skel h-3 w-full mt-2" /><div className="v-skel h-3 w-2/3 mt-1.5" />
  </div>
);

const AdminCampaigns: React.FC = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [platform, setPlatform] = useState<'all' | PlatformId>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<any>(null);
  const [confirmClose, setConfirmClose] = useState<any>(null);

  /*
   * Server-paged. This screen used to download every campaign AND every
   * application in the system just to count applicants per brief; the
   * funnel counts now arrive on each row, computed for that page alone.
   */
  const debouncedSearch = useDebounced(search);
  const { items: enriched, total, hasMore, stats: serverStats, loading, loadingMore, error, loadMore, refresh } = usePagedList<any>(
    '/admin/campaigns',
    { search: debouncedSearch, status, platform, sort },
    PAGE,
  );
  const load = refresh;

  /* Status tallies, live budget and brand count come from the API so they
     describe every brief, not the page on screen. */
  const counts = {
    by: (serverStats?.by || {}) as Record<string, number>,
    liveUsd: Number(serverStats?.liveUsd || 0),
    brands: Number(serverStats?.brands || 0),
    all: Number(serverStats?.all || 0),
  };
  const filtersOn = !!search || status !== 'all' || platform !== 'all';

  const setCampaignStatus = async (c: any, next: CampaignStatus) => {
    setBusy(c.id);
    try {
      await api.patch(`/admin/campaigns/${c.id}/status`, { status: next });
      if (open?.id === c.id) setOpen((o: any) => ({ ...o, status: next }));
      refresh();
      toast.success(t(`dash.statusChanged.${next}`, { title: c.title }));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('dash.updateFailed'));
    } finally {
      setBusy(null);
    }
  };

  const moderation = (c: any) => {
    const s = normalizeCampaignStatus(c.status);
    const pending = busy === c.id;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button variant="ghost" size="sm" className="!px-2.5" onPress={() => setOpen(c)}>
          <Eye size={11} /> {t('apps.open')}
        </Button>
        {s === 'active' && (
          <Button variant="tertiary" size="sm" className="!px-2.5" isPending={pending} onPress={() => setCampaignStatus(c, 'paused')}>
            <Pause size={11} /> {t('dash.pause')}
          </Button>
        )}
        {(s === 'paused' || s === 'draft') && (
          <Button variant="primary" size="sm" className="!px-2.5" isPending={pending} onPress={() => setCampaignStatus(c, 'active')}>
            <Play size={11} /> {s === 'draft' ? t('adm.camps.publish') : t('dash.resume')}
          </Button>
        )}
        {s === 'closed' && (
          <Button variant="tertiary" size="sm" className="!px-2.5" isPending={pending} onPress={() => setCampaignStatus(c, 'active')}>
            <RotateCcw size={11} /> {t('dash.reopen')}
          </Button>
        )}
        {s !== 'closed' && (
          <Button variant="ghost" size="sm" className="!px-2.5 !text-danger ml-auto" isPending={pending} onPress={() => setConfirmClose(c)}>
            <XCircle size={11} /> {t('dash.close')}
          </Button>
        )}
      </div>
    );
  };

  const stats = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label={t('adm.camps.kpiAll')} value={counts.all} hint={t('adm.camps.kpiAllHint', { n: counts.brands })} series={weekSeries(enriched)} icon={Briefcase} />
      <MetricCard label={t('dash.kpiActiveCampaigns')} value={counts.by.active || 0} hint={t('adm.camps.kpiLiveHint', { n: counts.by.paused || 0 })} icon={Radio} iconStatus={counts.by.active ? 'success' : undefined} chartColor="var(--chart-1, #00d4c7)" series={weekSeries(enriched, (c: any) => normalizeCampaignStatus(c.status) === 'active')} />
      <MetricCard label={t('adm.camps.kpiDrafts')} value={counts.by.draft || 0} hint={t('adm.camps.kpiDraftsHint', { n: counts.by.closed || 0 })} icon={EyeOff} />
      <MetricCard label={t('adm.camps.kpiBudget')} value={money(counts.liveUsd)} hint={t('adm.camps.kpiBudgetHint')} icon={Globe} iconStatus={counts.liveUsd ? 'success' : undefined} />
    </div>
  );

  const openStatus = open ? normalizeCampaignStatus(open.status) : 'draft';
  const openBrand = open ? userIdentity(open.brand) : null;

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('adm.camps.title')}
      titleAccent={t('adm.camps.titleAccent')}
      description={t('adm.camps.desc')}
      icon={<Briefcase size={18} />}
      stats={stats}
    >
      <div>
        <DirectoryToolbar
          search={{ value: search, onChange: setSearch, placeholder: t('adm.camps.searchPh'), widthClass: 'w-full sm:w-[300px]' }}
          count={loading ? t('common.searching') : t('adm.camps.count', { shown: enriched.length, total })}
          leading={
            <Segment size="sm" selectedKey={status} onSelectionChange={(k) => setStatus(k as StatusFilter)} aria-label={t('adm.users.statusFilter')}>
              <Segment.Item id="all">{t('dash.all')} · {enriched.length}</Segment.Item>
              {CAMPAIGN_STATUSES.map((s) => (
                <Segment.Item key={s} id={s}>{t(`status.${s}`)} · {counts.by[s] || 0}</Segment.Item>
              ))}
            </Segment>
          }
        >
          <Segment size="sm" selectedKey={sort} onSelectionChange={(k) => setSort(k as SortKey)} aria-label={t('common.sortBy')}>
            <Segment.Item id="newest">{t('board.sortNewest')}</Segment.Item>
            <Segment.Item id="applicants">{t('dash.sortApplicants')}</Segment.Item>
            <Segment.Item id="budget">{t('board.sortBudget')}</Segment.Item>
          </Segment>
        </DirectoryToolbar>
        <PlatformChipRow value={platform} onChange={setPlatform} />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <CampaignSkeleton key={i} />)}</div>
        ) : error ? (
          <EmptyPanel tone="error" icon={<AlertTriangle size={22} />} title={t('board.errTitle')} description={t('board.errDesc')} actions={<Button variant="primary" onPress={refresh}>{t('common.tryAgain')}</Button>} />
        ) : enriched.length === 0 ? (
          <EmptyPanel
            icon={<Briefcase size={22} />}
            title={filtersOn ? t('board.emptyTitle') : t('adm.camps.emptyTitle')}
            description={filtersOn ? t('board.emptyStatus') : t('adm.camps.emptyDesc')}
            actions={filtersOn ? <Button variant="tertiary" onPress={() => { setSearch(''); setStatus('all'); setPlatform('all'); }}>{t('board.resetFilters')}</Button> : undefined}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {enriched.map((c: any, i: number) => (
                <CampaignCard key={c.id} camp={c} index={i} applied={false} loggedIn isCreator={false} onApply={() => {}} variant="owner" onOpen={setOpen} actions={moderation(c)} />
              ))}
            </div>
            {loadingMore && <LoadMoreSkeleton n={2} />}
            <LoadMore onLoadMore={loadMore} remaining={hasMore ? total - enriched.length : 0} pending={loadingMore} />
          </>
        )}
      </div>

      {/* Brief details */}
      <Modal isOpen={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="!max-w-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex items-center gap-3 min-w-0 pr-8">
                  <StoryAvatar src={openBrand?.avatar} name={openBrand?.name || open?.brand?.email} seed={open?.brand?.id || open?.id} size={40} />
                  <div className="min-w-0">
                    <Modal.Heading className="truncate">{open?.title}</Modal.Heading>
                    <p className="v-caption v-quiet truncate" style={{ fontSize: 12 }}>
                      {openBrand?.name || open?.brand?.email} · {open?.brand?.email} · {postedLabel(open?.created_at)}
                    </p>
                  </div>
                </div>
              </Modal.Header>
              <Modal.Body>
                {open && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip color={CAMPAIGN_STATUS_COLOR[openStatus]} variant="soft" size="sm"><Chip.Label>{t(`status.${openStatus}`)}</Chip.Label></Chip>
                      {parsePlatforms(open.platform).map((p) => (
                        <Chip key={p} color="default" variant="soft" size="sm"><Chip.Label className="capitalize">{p === 'twitter' ? 'X' : p}</Chip.Label></Chip>
                      ))}
                    </div>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Fact label={t('wizard.budget', { defaultValue: 'Budget' })}>{formatBudget(open.budget, open.currency || 'USD')}</Fact>
                      <Fact label={t('dash.kpiApplicants')}>{open.applicants_count}</Fact>
                      <Fact label={t('dash.kpiAccepted')}>{open.accepted_count}</Fact>
                      <Fact label={t('board.sortDeadline')}>{open.deadline ? new Date(open.deadline).toLocaleDateString() : '—'}</Fact>
                    </dl>
                    <div>
                      <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1" style={{ fontSize: 10.5 }}>{t('adm.camps.brief')}</div>
                      <p className="v-body v-ink whitespace-pre-wrap" style={{ fontSize: 13.5 }}>{open.description || t('card.noBrief')}</p>
                    </div>
                    <BriefDetails campaign={open} />
                    {open.contract_template && (
                      <div>
                        <div className="v-caption v-quiet font-medium uppercase tracking-wider mb-1" style={{ fontSize: 10.5 }}>{t('board.contractTerms')}</div>
                        <p className="v-body v-muted whitespace-pre-wrap line-clamp-6" style={{ fontSize: 12.5 }}>{open.contract_template}</p>
                      </div>
                    )}
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <div className="flex-1">{open && moderation(open)}</div>
                <Button variant="ghost" onPress={() => setOpen(null)}>{t('common.close')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmModal
        open={!!confirmClose}
        tone="danger"
        pending={!!confirmClose && busy === confirmClose.id}
        title={t('adm.camps.closeTitle')}
        body={t('adm.camps.closeBody', { title: confirmClose?.title })}
        confirmLabel={t('dash.close')}
        onConfirm={async () => { if (confirmClose) await setCampaignStatus(confirmClose, 'closed'); setConfirmClose(null); }}
        onClose={() => setConfirmClose(null)}
      />
    </PageShell>
  );
};

export default AdminCampaigns;
