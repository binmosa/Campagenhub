import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CheckCircle2, Circle, Clock, LayoutDashboard, Link2, MessageSquare, Pencil, Plus, Search, Send, XCircle } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from '../../lib/toast';
import { SOCIAL_PLATFORMS, formatCompact, parseSocialLinks, verifiedFollowers } from '../../lib/socialLinks';
import PlatformIcon from '../../pages/landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY } from '../../pages/talent/shared';
import { PageShell } from '../ui';
import { fieldClass } from '../../pages/talent/shared';
import { AddPlatformsModal } from './AddPlatformsModal';

/**
 * StarterHome — what a creator sees instead of the full dashboard until
 * something is actually happening (first application or contract). One
 * clear "what happens next" card, a four-line progress list, and the
 * welcome-post box when that is the thing left to do. Nothing else.
 */
type Status = 'todo' | 'pending' | 'done' | 'rejected';

const StatusIcon: React.FC<{ s: Status }> = ({ s }) =>
  s === 'done' ? (
    <CheckCircle2 size={18} style={{ color: 'var(--color-signal-green)' }} />
  ) : s === 'pending' ? (
    <Clock size={18} style={{ color: '#d98a00' }} />
  ) : s === 'rejected' ? (
    <XCircle size={18} style={{ color: '#b3261e' }} />
  ) : (
    <Circle size={18} className="v-quiet" />
  );

export const StarterHome: React.FC<{
  me: any;
  profile: any;
  onRefresh: () => void;
  onShowFull: () => void;
}> = ({ me, profile, onRefresh, onShowFull }) => {
  const { t } = useTranslation();
  const [postUrl, setPostUrl] = useState('');
  const [sending, setSending] = useState(false);
  /* The welcome-post ask is an admin switch; off until Campaign Hubz runs its own campaign for that. */
  const [postEnabled, setPostEnabled] = useState(false);
  const [addingPlatforms, setAddingPlatforms] = useState(false);
  useEffect(() => {
    api.get('/public/settings').then((r) => setPostEnabled(r.data?.onboarding_post_enabled === 'true')).catch(() => {});
  }, []);

  const firstName = (profile?.first_name || profile?.full_name || '').split(' ')[0];
  const socials = useMemo(() => parseSocialLinks(profile?.social_links), [profile]);
  const channelCount = Object.keys(socials).length;
  const verifiedTotal = verifiedFollowers(profile?.social_links);
  const verifyStatus: Status = useMemo(() => {
    const list = Object.values(socials);
    if (list.some((e) => e?.status === 'verified')) return 'done';
    if (list.some((e) => e?.status === 'rejected')) return 'rejected';
    return channelCount ? 'pending' : 'todo';
  }, [socials, channelCount]);

  /* Every linked platform with where its verification stands — a creator
     who adds X after Instagram was verified sees both, not one summary. */
  type ChannelState = 'verified' | 'waiting' | 'rejected';
  const channels = useMemo(
    () =>
      SOCIAL_PLATFORMS.filter((p) => socials[p.id]?.url).map((p) => {
        const st = socials[p.id]?.status;
        const state: ChannelState = st === 'verified' ? 'verified' : st === 'rejected' ? 'rejected' : 'waiting';
        return { id: p.id, label: p.label.replace(' / Twitter', ''), color: p.color, state };
      }),
    [socials],
  );
  const byState = (state: ChannelState) => channels.filter((c) => c.state === state).map((c) => c.label);
  const waiting = byState('waiting');
  const rejected = byState('rejected');
  const verifiedNames = byState('verified');
  const verifyDesc = [
    rejected.length ? t('starter.rejectedOf', { list: rejected.join(', ') }) : '',
    waiting.length ? t('starter.waitingFor', { list: waiting.join(', ') }) : '',
    verifiedNames.length ? t('starter.verifiedOf', { list: verifiedNames.join(', '), n: formatCompact(verifiedTotal) }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const CHANNEL_CHIP: Record<ChannelState, { color: 'success' | 'warning' | 'danger'; icon: React.ReactNode; label: string }> = {
    verified: { color: 'success', icon: <BadgeCheck size={10} />, label: t('social.status.verified') },
    waiting: { color: 'warning', icon: <Clock size={10} />, label: t('starter.chipWaiting') },
    rejected: { color: 'danger', icon: <XCircle size={10} />, label: t('social.status.rejected') },
  };

  const onb = me?.onboarding || {};
  const postStatus: Status = !onb.post_url ? 'todo' : onb.post_status === 'approved' ? 'done' : onb.post_status === 'rejected' ? 'rejected' : 'pending';
  const showPost = postEnabled || !!onb.post_url;

  /* The one next action. Order: fix a rejected channel → share the post → wait / apply. */
  const cta =
    verifyStatus === 'rejected'
      ? { title: t('starter.ctaRejectedTitle'), desc: t('starter.ctaRejectedDesc'), kind: 'fix' as const }
      : showPost && (postStatus === 'todo' || postStatus === 'rejected')
      ? { title: t('starter.ctaPostTitle'), desc: t('starter.ctaPostDesc'), kind: 'post' as const }
      : verifyStatus === 'done'
      ? { title: t('starter.ctaVerifiedTitle'), desc: t('starter.ctaVerifiedDesc'), kind: 'apply' as const }
      : { title: t('starter.ctaWaitTitle'), desc: t('starter.ctaWaitDesc'), kind: 'wait' as const };

  const sendPost = async () => {
    const url = postUrl.trim();
    if (!url) return;
    setSending(true);
    try {
      await api.post('/creators/onboarding/welcome-post', { url });
      toast.success(t('onb.postSaved'));
      setPostUrl('');
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' ') : msg || t('onb.errPost'));
    } finally {
      setSending(false);
    }
  };

  const steps: { key: string; s: Status; title: string; desc: string }[] = [
    { key: 'channels', s: channelCount ? 'done' : 'todo', title: t('starter.stepChannels'), desc: t('starter.stepChannelsDesc', { n: channelCount }) },
    {
      key: 'verify',
      // Something still waiting keeps the step open even once one platform is verified.
      s: rejected.length ? 'rejected' : waiting.length ? 'pending' : verifiedNames.length ? 'done' : 'todo',
      title: t('starter.stepVerify'),
      desc: verifyDesc || t('starter.stepVerifyPending'),
    },
    ...(showPost ? [{
      key: 'post',
      s: postStatus,
      title: t('starter.stepPost'),
      desc: postStatus === 'done' ? t('starter.stepPostApproved') : postStatus === 'pending' ? t('starter.stepPostPending') : postStatus === 'rejected' ? t('starter.stepPostRejected') : t('starter.stepPostNone'),
    }] : []),
    { key: 'apply', s: 'todo', title: t('starter.stepApply'), desc: t('starter.stepApplyDesc') },
  ];

  return (
    <PageShell
      hero
      containerSize="narrow"
      title={t('starter.hello', { name: firstName || t('cdash.you') })}
      description={t('starter.subtitle')}
      icon={<LayoutDashboard size={18} />}
      actions={
        <Button variant="ghost" size="sm" onPress={onShowFull} data-testid="starter-show-full">
          {t('starter.fullDashboard')} <ArrowRight size={11} />
        </Button>
      }
    >
      {/* the one next action */}
      <section className="v-talent-card p-5 sm:p-7" data-testid="starter-cta" data-kind={cta.kind}>
        <div className="flex items-start gap-4">
          <span className="v-hero-icon shrink-0" style={{ width: 44, height: 44, borderRadius: 13 }}>
            {cta.kind === 'wait' ? <Clock size={18} /> : cta.kind === 'post' ? <Send size={18} /> : cta.kind === 'apply' ? <BadgeCheck size={18} /> : <Pencil size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="v-subheading v-ink" style={{ letterSpacing: '-0.015em' }}>
              {cta.title}
            </h2>
            <p className="v-body v-muted mt-1" style={{ fontSize: 14.5 }}>
              {cta.desc}
            </p>

            {cta.kind === 'post' && (
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 v-quiet pointer-events-none" />
                  <input className={`${fieldClass} !pl-9`} value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder={t('starter.postLinkPh')} inputMode="url" data-testid="starter-post-url" />
                </div>
                <Button variant="primary" size="md" onPress={sendPost} isPending={sending} isDisabled={!postUrl.trim()} data-testid="starter-post-send">
                  <Send size={13} /> {t('starter.postSend')}
                </Button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {cta.kind === 'fix' ? (
                <Link to="/dashboard/profile">
                  <Button variant="primary" size="md">
                    <Pencil size={13} /> {t('starter.fixProfile')}
                  </Button>
                </Link>
              ) : (
                <Link to="/dashboard/campaigns?tab=browse">
                  <Button variant={cta.kind === 'apply' ? 'primary' : 'tertiary'} size="md">
                    <Search size={13} /> {t('starter.browse')}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* progress */}
      <section className="v-talent-card p-5 sm:p-6">
        <ol className="space-y-4" data-testid="starter-steps">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-start gap-3" data-status={s.s}>
              <span className="shrink-0 mt-0.5">
                <StatusIcon s={s.s} />
              </span>
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${s.s === 'todo' ? 'v-muted' : 'v-ink'}`} style={{ fontSize: 14 }}>
                  {i + 1}. {s.title}
                </div>
                <div className="v-caption v-quiet" style={{ fontSize: 12.5 }}>
                  {s.desc}
                </div>
                {s.key === 'verify' && channels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2" data-testid="starter-channel-states">
                    {channels.map((c) => (
                      <Chip key={c.id} color={CHANNEL_CHIP[c.state].color} variant="soft" size="sm" data-state={c.state} data-platform={c.id}>
                        <span className="inline-flex" style={{ color: c.color }}>
                          <PlatformIcon platform={PLATFORM_ICON_KEY[c.id]} size={11} />
                        </span>
                        <Chip.Label>
                          {c.label} · {CHANNEL_CHIP[c.state].label}
                        </Chip.Label>
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
              {s.key === 'channels' && (
                <Button variant="ghost" size="sm" onPress={() => setAddingPlatforms(true)} data-testid="starter-add-platforms">
                  <Plus size={12} /> {t('social.addPlatforms')}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 v-hairline" style={{ background: 'var(--color-paper)' }}>
        <span className="v-hero-icon shrink-0" style={{ width: 34, height: 34, borderRadius: 10 }}>
          <MessageSquare size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="v-ink font-medium" style={{ fontSize: 13.5 }}>
            {t('starter.needHelp')}
          </div>
          <div className="v-caption v-quiet" style={{ fontSize: 12 }}>
            {t('starter.needHelpDesc')}
          </div>
        </div>
        <Link to="/dashboard/messages">
          <Button variant="ghost" size="sm">
            {t('side.messages')} <ArrowRight size={11} />
          </Button>
        </Link>
      </div>
      {addingPlatforms && (
        <AddPlatformsModal open onClose={() => setAddingPlatforms(false)} socialLinks={profile?.social_links} onSaved={onRefresh} />
      )}
    </PageShell>
  );
};

export default StarterHome;
