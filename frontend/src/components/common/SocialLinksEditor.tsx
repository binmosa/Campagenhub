import React, { useState } from 'react';
import { BadgeCheck, Clock, ExternalLink, ImagePlus, Link2, ShieldAlert, XCircle } from 'lucide-react';
import { Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api, { serverOrigin } from '../../lib/api';
import {
  SOCIAL_PLATFORMS,
  UNIT_MULT,
  formatCompact,
  splitCompact,
  type ClaimStatus,
  type CompactUnit,
  type SocialMap,
  type SocialPlatformId,
} from '../../lib/socialLinks';
import PlatformIcon from '../../pages/landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY, fieldClass } from '../../pages/talent/shared';

/**
 * SocialLinksEditor — one row per platform: profile link, follower count
 * entered as a number + unit (45 K, 1.2 M) instead of a spinner, and the
 * claim's verification state. Creators can attach a screenshot of their
 * analytics as evidence; an admin verifies from the Follower claims queue.
 */
const STATUS_COLOR: Record<ClaimStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  unverified: 'default',
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
};
const STATUS_ICON: Record<ClaimStatus, React.ReactNode> = {
  unverified: <ShieldAlert size={10} />,
  pending: <Clock size={10} />,
  verified: <BadgeCheck size={10} />,
  rejected: <XCircle size={10} />,
};
const UNITS: CompactUnit[] = ['x', 'K', 'M'];
const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

type Draft = { amount: string; unit: CompactUnit };

export const SocialLinksEditor: React.FC<{ value: SocialMap; onChange: (next: SocialMap) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Partial<Record<SocialPlatformId, Draft>>>(() => {
    const d: Partial<Record<SocialPlatformId, Draft>> = {};
    for (const p of SOCIAL_PLATFORMS) d[p.id] = splitCompact(value[p.id]?.followers);
    return d;
  });
  const [uploading, setUploading] = useState<SocialPlatformId | null>(null);
  const [uploadError, setUploadError] = useState('');

  const setEntry = (id: SocialPlatformId, patch: Partial<NonNullable<SocialMap[SocialPlatformId]>>) => {
    const prev = value[id] || { url: '' };
    onChange({ ...value, [id]: { ...prev, ...patch } });
  };

  const setFollowers = (id: SocialPlatformId, draft: Draft) => {
    setDrafts((d) => ({ ...d, [id]: draft }));
    const n = Number(String(draft.amount).replace(/,/g, ''));
    const followers = Number.isFinite(n) && n > 0 ? Math.round(n * UNIT_MULT[draft.unit]) : undefined;
    setEntry(id, { followers });
  };

  const onEvidence = (id: SocialPlatformId, file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_EVIDENCE_BYTES) return setUploadError(t('social.proofTooBig'));
    setUploadError('');
    const reader = new FileReader();
    reader.onload = async () => {
      setUploading(id);
      try {
        const res = await api.post('/uploads', { file: String(reader.result || ''), filename: `followers-${id}-${Date.now()}.${(file.name.split('.').pop() || 'png').toLowerCase()}` });
        if (res.data?.error || !res.data?.url) throw new Error(res.data?.error || 'upload');
        setEntry(id, { evidence_url: res.data.url });
      } catch (e: any) {
        setUploadError(e?.response?.data?.message || e?.message || t('social.proofFailed'));
      } finally {
        setUploading(null);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2.5">
      {uploadError && (
        <p className="v-caption" style={{ fontSize: 12, color: '#b3261e' }} role="alert">{uploadError}</p>
      )}
      {SOCIAL_PLATFORMS.map((p) => {
        const e = value[p.id];
        const draft = drafts[p.id] || { amount: '', unit: 'K' as CompactUnit };
        const followers = e?.followers || 0;
        const status: ClaimStatus = followers ? e?.status || 'pending' : 'unverified';
        const evidence = e?.evidence_url ? (e.evidence_url.startsWith('/') ? `${serverOrigin}${e.evidence_url}` : e.evidence_url) : '';
        return (
          <div key={p.id} className="rounded-xl p-3 v-hairline" style={{ background: e?.url || followers ? 'rgba(244,242,255,0.35)' : 'var(--color-paper)' }}>
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-2.5 items-center">
              <div className="flex items-center gap-2 min-w-[140px]">
                <span className="v-social-tile shrink-0" style={{ color: p.color }}>
                  <PlatformIcon platform={PLATFORM_ICON_KEY[p.id]} size={14} />
                </span>
                <span className="v-ink font-medium" style={{ fontSize: 13 }}>{p.label}</span>
              </div>

              <div className="relative">
                <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
                <input className={`${fieldClass} !pl-9`} value={e?.url || ''} onChange={(ev) => setEntry(p.id, { url: ev.target.value })} placeholder={p.placeholder} inputMode="url" />
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  className={`${fieldClass} !w-24 text-right tabular-nums`}
                  value={draft.amount}
                  onChange={(ev) => setFollowers(p.id, { ...draft, amount: ev.target.value.replace(/[^\d.]/g, '') })}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={`${p.label} ${t('social.followers')}`}
                />
                <div className="inline-flex rounded-lg overflow-hidden v-hairline" role="radiogroup" aria-label={t('social.unit')}>
                  {UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={draft.unit === u}
                      onClick={() => setFollowers(p.id, { ...draft, unit: u })}
                      className="px-2.5 py-2 text-xs font-medium transition-colors"
                      style={
                        draft.unit === u
                          ? { background: 'var(--gradient-signature)', color: '#fff' }
                          : { background: 'var(--color-paper)', color: 'var(--color-graphite)' }
                      }
                    >
                      {u === 'x' ? t('social.unitExact') : u}
                    </button>
                  ))}
                </div>
                <span className="v-caption v-quiet tabular-nums w-16 text-right" style={{ fontSize: 11.5 }}>
                  {followers ? `= ${formatCompact(followers)}` : ''}
                </span>
              </div>
            </div>

            {(followers > 0 || e?.url) && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Chip color={STATUS_COLOR[status]} variant="soft" size="sm">
                  {STATUS_ICON[status]}
                  <Chip.Label>
                    {t(`social.status.${status}`)}
                    {status === 'verified' && e?.verified_followers ? ` · ${formatCompact(e.verified_followers)}` : ''}
                  </Chip.Label>
                </Chip>
                {status === 'rejected' && e?.note && (
                  <span className="v-caption" style={{ fontSize: 11.5, color: '#b3261e' }}>{e.note}</span>
                )}
                {status === 'pending' && (
                  <span className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('social.pendingHint')}</span>
                )}
                {followers > 0 && status !== 'verified' && (
                  <label className="ml-auto inline-flex items-center gap-1.5 cursor-pointer v-caption font-medium" style={{ fontSize: 11.5, color: 'var(--color-campaign-purple)' }}>
                    <ImagePlus size={12} />
                    {uploading === p.id ? t('social.uploading') : evidence ? t('social.replaceProof') : t('social.addProof')}
                    <input type="file" accept="image/*" className="hidden" onChange={(ev) => onEvidence(p.id, ev.target.files?.[0])} disabled={uploading === p.id} />
                  </label>
                )}
                {evidence && (
                  <a href={evidence} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 v-caption hover:underline" style={{ fontSize: 11.5, color: 'var(--color-graphite)' }}>
                    <ExternalLink size={11} /> {t('social.viewProof')}
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
      <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('social.claimNote')}</p>
    </div>
  );
};

export default SocialLinksEditor;
