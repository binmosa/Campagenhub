import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  DollarSign,
  ExternalLink,
  Megaphone,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  SearchX,
  Send,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { AlertDialog, Button, Dropdown } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatBudget } from '../../lib/campaignFormat';
import {
  CAMPAIGN_STATUSES,
  normalizeCampaignStatus,
  type CampaignStatus,
} from '../../lib/catalog';
import { MetricCard, PageShell } from '../../components/ui';
import CampaignCard, {
  CampaignCardSkeleton,
  parsePlatforms,
  type PlatformId,
} from '../../components/common/CampaignCard';
import { CampaignWizard } from '../../components/common/CampaignWizard';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import FacetPopover from '../../components/common/FacetPopover';
import { Notice } from '../../components/common/Notice';
import {
  ActiveFilterChips,
  DirectoryToolbar,
  OptionRows,
  PlatformChipRow,
  type ActiveChip,
} from '../../components/common/filters';

/**
 * BrandCampaigns — the brand's briefs: the same cards, filters and
 * gradients as the public marketplace, in "owner" mode (lifecycle chip,
 * applicant funnel, manage menu), plus the 4-step CampaignWizard.
 */
type SortKey = 'newest' | 'budget' | 'deadline' | 'applicants';
type StatusFilter = 'all' | CampaignStatus;

const GRID = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';

const usdOf = (c: any): number => {
  if (c.budget_usd != null) return Number(c.budget_usd) || 0;
  if ((c.currency || 'USD') === 'USD') return Number(c.budget) || 0;
  return 0;
};

const BrandCampaigns: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [brandName, setBrandName] = useState('');
  const [brandCountry, setBrandCountry] = useState<{ code?: string; name?: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>(() => {
    const s = params.get('status');
    return s && (CAMPAIGN_STATUSES as readonly string[]).includes(s) ? (s as CampaignStatus) : 'all';
  });
  const [platform, setPlatform] = useState<'all' | PlatformId>('all');
  const [objective, setObjective] = useState('');
  const [contentType, setContentType] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [camps, st] = await Promise.all([
        api.get('/campaigns/mine'),
        api.get('/campaigns/brand/stats').catch(() => ({ data: null })),
      ]);
      setCampaigns(Array.isArray(camps.data) ? camps.data : []);
      setStats(st.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api
      .get('/brands/profile')
      .then((res) => {
        setBrandName(res.data?.company_name || '');
        setBrandCountry({ code: res.data?.country_code || undefined, name: res.data?.country || undefined });
      })
      .catch(() => {});
  }, [load]);

  /* Deep link: /dashboard/campaigns?new=1 opens the wizard */
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null);
      setWizardOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  /* Facets that exist among this brand's campaigns */
  const facets = useMemo(() => {
    const count = (key: string) => {
      const m = new Map<string, number>();
      for (const c of campaigns) {
        const v = c[key];
        if (v) m.set(v, (m.get(v) || 0) + 1);
      }
      return [...m.entries()].map(([value, n]) => ({ value, count: n })).sort((a, b) => a.value.localeCompare(b.value));
    };
    return { objectives: count('objective'), contentTypes: count('content_type') };
  }, [campaigns]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: campaigns.length, draft: 0, active: 0, paused: 0, closed: 0 };
    for (const camp of campaigns) c[normalizeCampaignStatus(camp.status)]++;
    return c;
  }, [campaigns]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = campaigns.filter((c) => {
      if (status !== 'all' && normalizeCampaignStatus(c.status) !== status) return false;
      if (platform !== 'all' && !parsePlatforms(c.platform).includes(platform)) return false;
      if (objective && c.objective !== objective) return false;
      if (contentType && c.content_type !== contentType) return false;
      if (q && !`${c.title || ''} ${c.description || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const time = (d?: string) => (d ? new Date(d).getTime() : 0);
    list.sort((a, b) => {
      if (sort === 'budget') return usdOf(b) - usdOf(a);
      if (sort === 'applicants') return (Number(b.applicants_count) || 0) - (Number(a.applicants_count) || 0);
      if (sort === 'deadline') {
        const da = a.deadline ? time(a.deadline) : Infinity;
        const db = b.deadline ? time(b.deadline) : Infinity;
        return da - db;
      }
      return time(b.created_at) - time(a.created_at);
    });
    return list;
  }, [campaigns, search, status, platform, objective, contentType, sort]);

  const activeChips = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (search) chips.push({ key: 'search', label: t('talent.searchChip', { q: search }), onClear: () => setSearch('') });
    if (status !== 'all') chips.push({ key: 'status', label: t(`status.${status}`), onClear: () => setStatus('all') });
    if (platform !== 'all') chips.push({ key: 'platform', label: platform, onClear: () => setPlatform('all') });
    if (objective) chips.push({ key: 'objective', label: t(`objectives.${objective}`, { defaultValue: objective }), onClear: () => setObjective('') });
    if (contentType) chips.push({ key: 'ct', label: t(`contentTypes.${contentType}`, { defaultValue: contentType }), onClear: () => setContentType('') });
    return chips;
  }, [search, status, platform, objective, contentType, t]);

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setPlatform('all');
    setObjective('');
    setContentType('');
  };

  /* ── Mutations ─────────────────────────────────────────────────── */
  const setCampaignStatus = async (camp: any, next: CampaignStatus) => {
    setBusyId(camp.id);
    try {
      await api.patch(`/campaigns/${camp.id}`, { status: next });
      setNotice({ tone: 'success', text: t(`dash.statusChanged.${next}`, { title: camp.title }) });
      await load();
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.response?.data?.message || t('dash.updateFailed') });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/campaigns/${pendingDelete.id}`);
      setNotice({ tone: 'success', text: t('dash.deleted', { title: pendingDelete.title }) });
      setPendingDelete(null);
      await load();
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.response?.data?.message || t('dash.deleteFailed') });
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (camp: any) => {
    setEditing(camp);
    setWizardOpen(true);
  };
  const openNew = () => {
    setEditing(null);
    setWizardOpen(true);
  };
  const openApplicants = (camp: any) => navigate(`/dashboard/applications?campaign=${camp.id}`);

  /* ── Render ────────────────────────────────────────────────────── */
  const series = stats?.series;
  const kpis = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label={t('dash.kpiCampaigns')}
        value={counts.all}
        hint={t('dash.kpiActiveOf', { n: counts.active })}
        series={series?.campaigns}
        icon={Briefcase}
      />
      <MetricCard
        label={t('dash.kpiApplicants')}
        value={stats?.applications?.total ?? campaigns.reduce((s, c) => s + (Number(c.applicants_count) || 0), 0)}
        hint={t('dash.kpiPendingN', { n: stats?.applications?.pending ?? 0 })}
        series={series?.applications}
        chartColor="var(--chart-1, #00d4c7)"
        icon={Users}
        iconStatus={stats?.applications?.pending ? 'warning' : undefined}
      />
      <MetricCard
        label={t('dash.kpiAccepted')}
        value={stats?.applications?.accepted ?? 0}
        hint={t('dash.kpiHired')}
        series={series?.accepted}
        chartColor="var(--color-signal-green, #16c784)"
        icon={Send}
        iconStatus="success"
      />
      <MetricCard
        label={t('dash.kpiBudget')}
        value={formatBudget(stats?.budget?.committed_usd ?? campaigns.reduce((s, c) => s + usdOf(c), 0), 'USD')}
        hint={t('dash.kpiActiveBudget', { v: formatBudget(stats?.budget?.active_usd ?? 0, 'USD') })}
        icon={DollarSign}
      />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('dash.campaignsTitle')}
      titleAccent={t('dash.campaignsAccent')}
      description={t('dash.campaignsDesc')}
      icon={<Briefcase size={18} />}
      actions={
        <>
          <Link to="/campaigns" target="_blank" rel="noreferrer">
            <Button variant="tertiary" size="md">
              <ExternalLink size={13} /> {t('dash.viewMarketplace')}
            </Button>
          </Link>
          <Button variant="primary" size="md" onPress={openNew}>
            <Plus size={14} /> {t('dash.newCampaign')}
          </Button>
        </>
      }
      stats={kpis}
    >
      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {/* Toolbar */}
      <div>
        <DirectoryToolbar
          leading={
            <Segment size="sm" selectedKey={status} onSelectionChange={(k) => setStatus(k as StatusFilter)} aria-label="Status">
              <Segment.Item id="all">
                {t('dash.all')} · {counts.all}
              </Segment.Item>
              {CAMPAIGN_STATUSES.map((s) => (
                <Segment.Item key={s} id={s}>
                  {t(`status.${s}`)} · {counts[s]}
                </Segment.Item>
              ))}
            </Segment>
          }
          search={{ value: search, onChange: setSearch, placeholder: t('dash.searchCampaigns'), widthClass: 'w-full sm:w-[240px]' }}
          count={loading ? t('common.searching') : t('board.count', { shown: visible.length, total: campaigns.length })}
        >
          <Segment size="sm" selectedKey={sort} onSelectionChange={(k) => setSort(k as SortKey)} aria-label="Sort">
            <Segment.Item id="newest">{t('board.sortNewest')}</Segment.Item>
            <Segment.Item id="applicants">{t('dash.sortApplicants')}</Segment.Item>
            <Segment.Item id="budget">{t('board.sortBudget')}</Segment.Item>
            <Segment.Item id="deadline">{t('board.sortDeadline')}</Segment.Item>
          </Segment>
        </DirectoryToolbar>

        <PlatformChipRow
          value={platform}
          onChange={setPlatform}
          className="mb-3"
          trailing={
            <>
              <FacetPopover
                label={t('board.fOrientation')}
                width={240}
                badge={objective ? t(`objectives.${objective}`, { defaultValue: objective }) : undefined}
              >
                <OptionRows
                  options={[
                    { id: '', label: t('common.any') },
                    ...facets.objectives.map((o) => ({
                      id: o.value,
                      label: t(`objectives.${o.value}`, { defaultValue: o.value }),
                      hint: String(o.count),
                    })),
                  ]}
                  value={objective}
                  onSelect={setObjective}
                />
              </FacetPopover>
              <FacetPopover
                label={t('dash.fFormat')}
                width={220}
                badge={contentType ? t(`contentTypes.${contentType}`, { defaultValue: contentType }) : undefined}
              >
                <OptionRows
                  options={[
                    { id: '', label: t('common.any') },
                    ...facets.contentTypes.map((o) => ({
                      id: o.value,
                      label: t(`contentTypes.${o.value}`, { defaultValue: o.value }),
                      hint: String(o.count),
                    })),
                  ]}
                  value={contentType}
                  onSelect={setContentType}
                />
              </FacetPopover>
            </>
          }
        />

        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
      </div>

      {/* Results */}
      {loading ? (
        <div className={GRID} aria-label="Loading campaigns">
          {Array.from({ length: 6 }).map((_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyPanel
          tone="error"
          icon={<AlertTriangle size={22} />}
          title={t('board.errTitle')}
          description={t('board.errDesc')}
          actions={
            <Button variant="primary" onPress={() => { setLoading(true); load(); }}>
              {t('common.tryAgain')}
            </Button>
          }
        />
      ) : campaigns.length === 0 ? (
        <EmptyPanel
          icon={<Megaphone size={22} />}
          title={t('dash.noCampaignsTitle')}
          description={t('dash.noCampaignsDesc')}
          actions={
            <>
              <Button variant="primary" onPress={openNew}>
                <Plus size={13} /> {t('dash.createFirst')}
              </Button>
              <Link to="/dashboard/talent">
                <Button variant="tertiary">{t('dash.browseTalent')}</Button>
              </Link>
            </>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyPanel
          size="sm"
          icon={<SearchX size={20} />}
          title={t('board.emptyTitle')}
          description={t('board.emptyStatus')}
          actions={
            <Button variant="primary" size="sm" onPress={resetFilters}>
              {t('board.resetFilters')}
            </Button>
          }
        />
      ) : (
        <div className={GRID}>
          {visible.map((camp, i) => {
            const s = normalizeCampaignStatus(camp.status);
            const busy = busyId === camp.id;
            return (
              <CampaignCard
                key={camp.id}
                camp={camp}
                index={i}
                applied={false}
                loggedIn
                isCreator={false}
                onApply={() => {}}
                variant="owner"
                onOpen={openApplicants}
                corner={
                  <Dropdown>
                    <Dropdown.Trigger
                      aria-label={t('dash.manage')}
                      isDisabled={busy}
                      className="v-facet-btn !p-1.5 !rounded-lg shrink-0"
                    >
                      <MoreHorizontal size={16} />
                    </Dropdown.Trigger>
                    <Dropdown.Popover placement="bottom end">
                      <Dropdown.Menu>
                        <Dropdown.Item id="edit" textValue={t('dash.edit')} onAction={() => openEdit(camp)}>
                          <Pencil size={14} /> {t('dash.edit')}
                        </Dropdown.Item>
                        <Dropdown.Item id="applicants" textValue={t('dash.viewApplicants')} onAction={() => openApplicants(camp)}>
                          <Users size={14} /> {t('dash.viewApplicants')}
                        </Dropdown.Item>
                        {s === 'active' && (
                          <Dropdown.Item id="public" textValue={t('dash.viewPublic')} onAction={() => window.open('/campaigns', '_blank')}>
                            <ExternalLink size={14} /> {t('dash.viewPublic')}
                          </Dropdown.Item>
                        )}
                        {s === 'draft' && (
                          <Dropdown.Item id="publish" textValue={t('wizard.publish')} onAction={() => setCampaignStatus(camp, 'active')}>
                            <Send size={14} /> {t('wizard.publish')}
                          </Dropdown.Item>
                        )}
                        {s === 'active' && (
                          <Dropdown.Item id="pause" textValue={t('dash.pause')} onAction={() => setCampaignStatus(camp, 'paused')}>
                            <Pause size={14} /> {t('dash.pause')}
                          </Dropdown.Item>
                        )}
                        {s === 'paused' && (
                          <Dropdown.Item id="resume" textValue={t('dash.resume')} onAction={() => setCampaignStatus(camp, 'active')}>
                            <Play size={14} /> {t('dash.resume')}
                          </Dropdown.Item>
                        )}
                        {(s === 'active' || s === 'paused') && (
                          <Dropdown.Item id="close" textValue={t('dash.close')} onAction={() => setCampaignStatus(camp, 'closed')}>
                            <XCircle size={14} /> {t('dash.close')}
                          </Dropdown.Item>
                        )}
                        {s === 'closed' && (
                          <Dropdown.Item id="reopen" textValue={t('dash.reopen')} onAction={() => setCampaignStatus(camp, 'active')}>
                            <Play size={14} /> {t('dash.reopen')}
                          </Dropdown.Item>
                        )}
                        <Dropdown.Item id="delete" textValue={t('dash.delete')} onAction={() => setPendingDelete(camp)} className="!text-danger">
                          <Trash2 size={14} /> {t('dash.delete')}
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                }
                actions={
                  s === 'draft' ? (
                    <Button variant="primary" size="sm" onPress={() => openEdit(camp)} isPending={busy}>
                      <Pencil size={11} /> {t('dash.continueDraft')}
                    </Button>
                  ) : (
                    <Button variant={Number(camp.pending_count) > 0 ? 'primary' : 'tertiary'} size="sm" onPress={() => openApplicants(camp)}>
                      <Users size={11} />{' '}
                      {Number(camp.pending_count) > 0
                        ? t('dash.reviewN', { n: Number(camp.pending_count) })
                        : t('dash.applicantsN', { n: Number(camp.applicants_count) || 0 })}
                    </Button>
                  )
                }
              />
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog isOpen={!!pendingDelete} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger">
                  <AlertTriangle size={18} />
                </AlertDialog.Icon>
                <AlertDialog.Heading>{t('dash.deleteTitle')}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                {t('dash.deleteBody', { title: pendingDelete?.title || '', n: Number(pendingDelete?.applicants_count) || 0 })}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" isDisabled={deleting} onPress={() => setPendingDelete(null)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="danger" isPending={deleting} onPress={confirmDelete}>
                  <Trash2 size={13} /> {t('dash.delete')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <CampaignWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        editing={editing}
        brandName={brandName}
        brandCountryCode={brandCountry.code}
        brandCountryName={brandCountry.name}
        onSaved={(saved, mode) => {
          const published = normalizeCampaignStatus(saved?.status) === 'active';
          setNotice({
            tone: 'success',
            text:
              mode === 'created'
                ? published
                  ? t('dash.published', { title: saved?.title })
                  : t('dash.draftSaved', { title: saved?.title })
                : t('dash.updated', { title: saved?.title }),
          });
          load();
        }}
      />
    </PageShell>
  );
};

export default BrandCampaigns;
