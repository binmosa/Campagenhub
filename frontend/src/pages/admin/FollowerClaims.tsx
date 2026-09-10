import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Check, Clock, ExternalLink, ImageOff, MapPin, Send, ShieldCheck, XCircle } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { useTranslation } from 'react-i18next';
import api, { serverOrigin } from '../../lib/api';
import { toast } from '../../lib/toast';
import { SOCIAL_PLATFORMS, formatCompact, parseCompactNumber, splitCompact, type SocialPlatformId } from '../../lib/socialLinks';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import PlatformIcon from '../landing/mocks/PlatformIcon';
import { PLATFORM_ICON_KEY, accentFor, fieldClass } from '../talent/shared';

/**
 * FollowerClaims — admin / support queue for creators' follower counts.
 * Each row is one platform claim: who, where, how many, the evidence they
 * attached, and any auto-check note. Verify (with the count you confirm)
 * or reject with a reason; the creator is notified either way.
 */
type Claim = {
  user_id: string;
  email?: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  category?: string;
  location?: string;
  platform: SocialPlatformId | string;
  url: string;
  followers?: number;
  verified_followers?: number;
  claimed_at?: string;
  verified_at?: string;
  evidence_url?: string;
  note?: string;
  status: 'pending' | 'verified' | 'rejected';
  /** false = link only (guided onboarding) — the reviewer enters the count. */
  has_count?: boolean;
};

type WelcomePost = {
  user_id: string;
  email?: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  category?: string;
  location?: string;
  followed: string[];
  url: string;
  platform?: string;
  submitted_at?: string;
  reviewed_at?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
};

type Tab = 'pending' | 'verified' | 'rejected' | 'posts';

/** One creator's welcome post about Campaign Hubz — approve or send back. */
const PostRow: React.FC<{ post: WelcomePost; onDone: () => void }> = ({ post, onDone }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const meta = SOCIAL_PLATFORMS.find((p) => p.id === post.platform);
  const name = post.full_name || post.username || post.email?.split('@')[0] || 'Creator';
  const accent = accentFor(String(post.user_id));

  const decide = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) return toast.error('Add a short reason so the creator knows what to fix.');
    setBusy(action);
    try {
      await api.patch(`/creators/admin/welcome-posts/${post.user_id}`, { action, note: note.trim() || undefined });
      toast.success(action === 'approve' ? `${name}'s welcome post approved.` : `${name}'s welcome post sent back.`);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not save the decision.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="v-talent-card p-4 grid grid-cols-1 lg:grid-cols-[minmax(220px,1.2fr)_minmax(240px,1.4fr)_minmax(280px,1.2fr)] gap-4 items-start" data-testid="welcome-post-row">
      <div className="flex items-start gap-3 min-w-0">
        <span className="v-story-ring">
          {post.avatar_url ? (
            <img src={post.avatar_url} alt="" className="h-11 w-11 object-cover" />
          ) : (
            <span className="inline-flex h-11 w-11 items-center justify-center text-base font-medium text-white" style={{ background: accent.from }}>{name[0]?.toUpperCase()}</span>
          )}
        </span>
        <div className="min-w-0">
          <div className="v-ink font-medium truncate" style={{ fontSize: 14.5 }}>{name}</div>
          <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
            {post.username ? `@${post.username}` : post.email}
            {post.location && (<>{' · '}<MapPin size={10} className="inline" /> {post.location}</>)}
          </div>
          {post.followed?.length > 0 && (
            <div className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>follows us on {post.followed.join(', ')}</div>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <a href={post.url} target="_blank" rel="noreferrer" className="v-social-chip !h-auto py-1.5 max-w-full" title={post.url}>
          <span className="inline-flex" style={{ color: meta?.color }}>
            <PlatformIcon platform={PLATFORM_ICON_KEY[post.platform || ''] || 'instagram'} size={13} />
          </span>
          <span className="v-ink truncate" style={{ fontSize: 12 }}>{post.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          <ExternalLink size={10} className="v-quiet shrink-0" />
        </a>
        <div className="mt-2 v-caption v-quiet" style={{ fontSize: 11 }}>
          {post.submitted_at ? `shared ${new Date(post.submitted_at).toLocaleDateString()}` : ''}
          {post.reviewed_at ? ` · reviewed ${new Date(post.reviewed_at).toLocaleDateString()}` : ''}
        </div>
        {post.note && <div className="mt-1 v-caption" style={{ fontSize: 11.5, color: post.status === 'rejected' ? '#b3261e' : 'var(--color-graphite)' }}>{post.note}</div>}
      </div>

      <div>
        {post.status === 'pending' ? (
          <div className="space-y-2">
            <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason if sending back (sent to the creator)" />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" className="!text-danger" onPress={() => decide('reject')} isPending={busy === 'reject'} isDisabled={busy === 'approve'}>
                <XCircle size={12} /> Send back
              </Button>
              <Button variant="primary" size="sm" onPress={() => decide('approve')} isPending={busy === 'approve'} isDisabled={busy === 'reject'}>
                <BadgeCheck size={12} /> Approve
              </Button>
            </div>
          </div>
        ) : (
          <Chip color={post.status === 'approved' ? 'success' : 'danger'} variant="soft" size="sm">
            {post.status === 'approved' ? <ShieldCheck size={11} /> : <XCircle size={11} />}
            <Chip.Label>{post.status === 'approved' ? 'Approved' : 'Sent back'}</Chip.Label>
          </Chip>
        )}
      </div>
    </article>
  );
};

const ClaimRow: React.FC<{ claim: Claim; onDone: () => void }> = ({ claim, onDone }) => {
  const { t } = useTranslation();
  const init = splitCompact(claim.followers);
  const [count, setCount] = useState(init.amount ? `${init.amount}${init.unit === 'x' ? '' : init.unit}` : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'verify' | 'reject' | null>(null);
  const meta = SOCIAL_PLATFORMS.find((p) => p.id === claim.platform);
  const name = claim.full_name || claim.username || claim.email?.split('@')[0] || 'Creator';
  const accent = accentFor(String(claim.user_id));
  const evidence = claim.evidence_url ? (claim.evidence_url.startsWith('/') ? `${serverOrigin}${claim.evidence_url}` : claim.evidence_url) : '';
  const parsed = parseCompactNumber(count);

  const decide = async (action: 'verify' | 'reject') => {
    if (action === 'verify' && !(parsed > 0)) return toast.error('Enter the follower count you verified.');
    if (action === 'reject' && !note.trim()) return toast.error('Add a short reason so the creator knows what to fix.');
    setBusy(action);
    try {
      await api.patch(`/creators/admin/follower-claims/${claim.user_id}/${claim.platform}`, {
        action,
        verified_followers: action === 'verify' ? parsed : undefined,
        note: note.trim() || undefined,
      });
      toast.success(action === 'verify' ? `${name}'s ${meta?.label || claim.platform} audience verified at ${formatCompact(parsed)}.` : `${name}'s ${meta?.label || claim.platform} claim rejected.`);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not save the decision.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="v-talent-card p-4 grid grid-cols-1 lg:grid-cols-[minmax(220px,1.2fr)_minmax(200px,1fr)_auto_minmax(280px,1.4fr)] gap-4 items-start">
      {/* who */}
      <div className="flex items-start gap-3 min-w-0">
        <span className="v-story-ring">
          {claim.avatar_url ? (
            <img src={claim.avatar_url} alt="" className="h-11 w-11 object-cover" />
          ) : (
            <span className="inline-flex h-11 w-11 items-center justify-center text-base font-medium text-white" style={{ background: accent.from }}>{name[0]?.toUpperCase()}</span>
          )}
        </span>
        <div className="min-w-0">
          <div className="v-ink font-medium truncate" style={{ fontSize: 14.5 }}>{name}</div>
          <div className="v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>
            {claim.username ? `@${claim.username}` : claim.email}
            {claim.location && (
              <>
                {' · '}<MapPin size={10} className="inline" /> {claim.location}
              </>
            )}
          </div>
          {claim.category && <div className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>{claim.category}</div>}
        </div>
      </div>

      {/* what */}
      <div className="min-w-0">
        <a href={claim.url} target="_blank" rel="noreferrer" className="v-social-chip !h-auto py-1.5 max-w-full" title={claim.url}>
          <span className="inline-flex" style={{ color: meta?.color }}>
            <PlatformIcon platform={PLATFORM_ICON_KEY[claim.platform] || 'instagram'} size={13} />
          </span>
          <span className="v-ink truncate" style={{ fontSize: 12 }}>{claim.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          <ExternalLink size={10} className="v-quiet shrink-0" />
        </a>
        <div className="mt-2 flex items-baseline gap-1.5">
          {claim.followers ? (
            <>
              <span className="v-ink font-medium tabular-nums" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>{formatCompact(claim.followers)}</span>
              <span className="v-caption v-quiet" style={{ fontSize: 11.5 }}>claimed · {Number(claim.followers).toLocaleString()}</span>
            </>
          ) : (
            <span className="v-caption" style={{ fontSize: 12, color: 'var(--color-graphite)' }}>No count given — open the profile and enter what you verify.</span>
          )}
        </div>
        <div className="v-caption v-quiet" style={{ fontSize: 11 }}>
          {claim.claimed_at ? `claimed ${new Date(claim.claimed_at).toLocaleDateString()}` : ''}
          {claim.verified_at ? ` · verified ${new Date(claim.verified_at).toLocaleDateString()}` : ''}
        </div>
        {claim.note && (
          <div className="mt-1 v-caption" style={{ fontSize: 11.5, color: claim.status === 'rejected' ? '#b3261e' : 'var(--color-graphite)' }}>{claim.note}</div>
        )}
      </div>

      {/* evidence */}
      <div className="shrink-0">
        {evidence ? (
          <a href={evidence} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden v-hairline" style={{ width: 120, height: 84 }} title="Open evidence">
            <img src={evidence} alt="Evidence" className="w-full h-full object-cover" />
          </a>
        ) : (
          <div className="rounded-lg v-hairline flex flex-col items-center justify-center v-quiet" style={{ width: 120, height: 84, borderStyle: 'dashed' }}>
            <ImageOff size={16} />
            <span className="v-caption" style={{ fontSize: 10.5 }}>no proof</span>
          </div>
        )}
      </div>

      {/* decision */}
      <div>
        {claim.status === 'pending' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input className={`${fieldClass} !w-32 tabular-nums`} value={count} onChange={(e) => setCount(e.target.value)} placeholder="e.g. 45k" aria-label="Verified count" />
              <span className="v-caption v-quiet tabular-nums" style={{ fontSize: 11.5 }}>{parsed ? `= ${parsed.toLocaleString()}` : ''}</span>
              <Button variant="primary" size="sm" className="ml-auto" onPress={() => decide('verify')} isPending={busy === 'verify'} isDisabled={busy === 'reject'}>
                <BadgeCheck size={12} /> Verify
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason if rejecting (sent to the creator)" />
              <Button variant="ghost" size="sm" className="!text-danger shrink-0" onPress={() => decide('reject')} isPending={busy === 'reject'} isDisabled={busy === 'verify'}>
                <XCircle size={12} /> Reject
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Chip color={claim.status === 'verified' ? 'success' : 'danger'} variant="soft" size="sm">
              {claim.status === 'verified' ? <ShieldCheck size={11} /> : <XCircle size={11} />}
              <Chip.Label>{claim.status === 'verified' ? `Verified · ${formatCompact(claim.verified_followers || claim.followers || 0)}` : 'Rejected'}</Chip.Label>
            </Chip>
            {claim.status === 'verified' ? (
              <Button variant="ghost" size="sm" className="!text-danger" onPress={() => decide('reject')} isPending={busy === 'reject'}>
                Revoke
              </Button>
            ) : (
              <Button variant="tertiary" size="sm" onPress={() => decide('verify')} isPending={busy === 'verify'}>
                <Check size={12} /> Verify anyway
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

const FollowerClaims: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('pending');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [posts, setPosts] = useState<WelcomePost[]>([]);
  const [postTab, setPostTab] = useState<WelcomePost['status']>('pending');
  const [counts, setCounts] = useState<Record<Tab, number>>({ pending: 0, verified: 0, rejected: 0, posts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (which: Tab, postStatus: WelcomePost['status'] = 'pending') => {
    setLoading(true);
    setError(false);
    try {
      const [cur, pend, ver, rej, pendingPosts, curPosts] = await Promise.all([
        api.get('/creators/admin/follower-claims', { params: { status: which === 'posts' ? 'pending' : which } }),
        api.get('/creators/admin/follower-claims', { params: { status: 'pending' } }),
        api.get('/creators/admin/follower-claims', { params: { status: 'verified' } }),
        api.get('/creators/admin/follower-claims', { params: { status: 'rejected' } }),
        api.get('/creators/admin/welcome-posts', { params: { status: 'pending' } }).catch(() => ({ data: [] })),
        api.get('/creators/admin/welcome-posts', { params: { status: postStatus } }).catch(() => ({ data: [] })),
      ]);
      setClaims(Array.isArray(cur.data) ? cur.data : []);
      setPosts(Array.isArray(curPosts.data) ? curPosts.data : []);
      setCounts({ pending: pend.data?.length || 0, verified: ver.data?.length || 0, rejected: rej.data?.length || 0, posts: pendingPosts.data?.length || 0 });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load(tab, postTab);
  }, [tab, postTab, load]);

  const totalVerified = useMemo(() => claims.reduce((s, c) => s + (c.status === 'verified' ? c.verified_followers || 0 : 0), 0), [claims]);

  return (
    <PageShell
      hero
      containerSize="wide"
      title="Follower"
      titleAccent="claims"
      description="Creators' follower counts are claims until you confirm them. Check the profile link and the evidence, then verify the number you can stand behind — the badge shows on their card immediately."
      icon={<BadgeCheck size={18} />}
      stats={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Awaiting review" value={counts.pending} hint="channels to verify" icon={Clock} iconStatus={counts.pending ? 'warning' : undefined} />
          <MetricCard label="Verified" value={counts.verified} hint={tab === 'verified' ? `${formatCompact(totalVerified)} followers on this page` : 'platform badges live'} icon={ShieldCheck} iconStatus="success" />
          <MetricCard label="Rejected" value={counts.rejected} hint="sent back with a reason" icon={XCircle} />
          <MetricCard label="Welcome posts" value={counts.posts} hint="waiting for a look" icon={Send} iconStatus={counts.posts ? 'warning' : undefined} />
        </div>
      }
    >
      <Segment size="md" selectedKey={tab} onSelectionChange={(k) => setTab(k as Tab)} aria-label="Claim status">
        <Segment.Item id="pending">Pending · {counts.pending}</Segment.Item>
        <Segment.Item id="verified">Verified · {counts.verified}</Segment.Item>
        <Segment.Item id="rejected">Rejected · {counts.rejected}</Segment.Item>
        <Segment.Item id="posts">Welcome posts · {counts.posts}</Segment.Item>
      </Segment>

      {tab === 'posts' ? (
        <div className="space-y-3" data-testid="welcome-posts">
          <Segment size="sm" selectedKey={postTab} onSelectionChange={(k) => setPostTab(k as WelcomePost['status'])} aria-label="Welcome post status">
            <Segment.Item id="pending">Pending</Segment.Item>
            <Segment.Item id="approved">Approved</Segment.Item>
            <Segment.Item id="rejected">Sent back</Segment.Item>
          </Segment>
          {loading ? (
            <div className="v-talent-card p-4"><div className="v-skel h-11 w-1/3 mb-2" /><div className="v-skel h-3 w-2/3" /></div>
          ) : posts.length === 0 ? (
            <EmptyPanel
              tone={postTab === 'pending' ? 'success' : 'neutral'}
              icon={<Send size={22} />}
              title={postTab === 'pending' ? 'No welcome posts waiting' : `No ${postTab === 'rejected' ? 'sent-back' : postTab} posts`}
              description="Creators share one post about Campaign Hubz during onboarding. New links land here for a quick look."
            />
          ) : (
            posts.map((p) => <PostRow key={p.user_id} post={p} onDone={() => load(tab, postTab)} />)
          )}
        </div>
      ) : loading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="v-talent-card p-4"><div className="v-skel h-11 w-1/3 mb-2" /><div className="v-skel h-3 w-2/3" /></div>
          ))}
        </div>
      ) : error ? (
        <EmptyPanel tone="error" title={t('board.errTitle')} description={t('board.errDesc')} actions={<Button variant="primary" onPress={() => load(tab, postTab)}>{t('common.tryAgain')}</Button>} />
      ) : claims.length === 0 ? (
        <EmptyPanel
          tone={tab === 'pending' ? 'success' : 'neutral'}
          icon={tab === 'pending' ? <ShieldCheck size={22} /> : <Clock size={22} />}
          title={tab === 'pending' ? 'Queue is clear' : `No ${tab} claims`}
          description={tab === 'pending' ? 'Every follower claim has been reviewed. New ones appear here the moment a creator saves a count.' : 'Decisions you make on pending claims show up here.'}
        />
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <ClaimRow key={`${c.user_id}-${c.platform}`} claim={c} onDone={() => load(tab, postTab)} />
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default FollowerClaims;
