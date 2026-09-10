import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Segment } from '@heroui-pro/react';
import { BadgeCheck, Check, Lock, Send, TrendingUp } from 'lucide-react';
import type { LandingSettings } from '../useLandingData';
import { CREATOR_WORKFLOW_STEPS, WORKFLOW_STEPS } from '../copy';
import PlatformIcon from '../mocks/PlatformIcon';
import Portrait from '../mocks/Portrait';
import { Bar, Brand, C, Chip, Panel, Row, Txt, sparkPath } from '../mocks/SceneBits';

/**
 * HowItWorks — one machine, two journeys, drawn instead of described.
 *
 * A persona toggle swaps between the creator steps (browse → apply →
 * create → get paid) and the brand steps (brief → applicants → escrow →
 * track). Each card opens with a small illustrated scene of that step —
 * the same visual language as the hero phones (brief rows, fit bars,
 * escrow locks, payout receipts) — so a visitor can *see* the flow before
 * reading a word. A progress line with numbered nodes joins the four cards
 * on wide screens; on phones the cards stack with the node on each card.
 */
interface HowItWorksProps {
  settings: LandingSettings;
}

type Track = 'creators' | 'brands';

/* ── scenes ────────────────────────────────────────────────────────── */
const SceneBriefs: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <Row delay={0.05}>
        <Brand initials="GL" color={C.purple} />
        <div className="min-w-0 flex-1 flex flex-col">
          <Txt>{t('how.viz.brief1')}</Txt>
          <Txt sub>Glow Athletic · <PlatformIcon platform="tiktok" size={9} className="inline" /></Txt>
        </div>
        <Chip tone="success">$160–700</Chip>
      </Row>
      <Row delay={0.15} highlight>
        <Brand initials="ME" color={C.teal} />
        <div className="min-w-0 flex-1 flex flex-col">
          <Txt>{t('how.viz.brief2')}</Txt>
          <Txt sub>Mesa Coffee · <PlatformIcon platform="instagram" size={9} className="inline" /></Txt>
        </div>
        <Chip tone="success">$250–800</Chip>
      </Row>
      <Row delay={0.25}>
        <Brand initials="ST" color={C.warning} />
        <div className="min-w-0 flex-1 flex flex-col">
          <Txt>{t('how.viz.brief3')}</Txt>
          <Txt sub>Stride · <PlatformIcon platform="youtube" size={9} className="inline" /></Txt>
        </div>
        <Chip tone="success">$120–400</Chip>
      </Row>
    </Panel>
  );
};

const SceneApply: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <Row delay={0.05}>
        <Portrait id="selam" initials="S" size={24} color={C.purple} />
        <div className="min-w-0 flex-1 flex flex-col">
          <Txt>{t('how.viz.pitch')}</Txt>
          <Txt sub>{t('how.viz.pitchBody')}</Txt>
        </div>
      </Row>
      <div className="flex-1" />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="rounded-full py-2 px-3 flex items-center justify-center gap-1.5 font-medium"
        style={{ background: 'var(--gradient-signature)', color: '#fff', fontSize: 11 }}
      >
        <Send size={11} /> {t('how.viz.applied')}
        <motion.span initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.7, type: 'spring', stiffness: 400, damping: 18 }} className="inline-flex h-4 w-4 items-center justify-center rounded-full ml-1" style={{ background: 'rgba(255,255,255,0.25)' }}>
          <Check size={10} />
        </motion.span>
      </motion.div>
    </Panel>
  );
};

const ScenePost: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <div className="flex items-center justify-between gap-2">
        <Chip tone="purple">
          <Lock size={9} /> {t('how.viz.escrowed')}
        </Chip>
        <Chip tone="muted">
          <PlatformIcon platform="instagram" size={9} /> Reel
        </Chip>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="relative rounded-lg overflow-hidden flex-1"
        style={{ minHeight: 62, background: C.navy }}
      >
        <img src="/images/creators/selam.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '50% 30%' }} loading="lazy" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
        <span className="absolute inset-x-0 bottom-0 px-2 py-1.5 flex items-center gap-1.5" style={{ background: 'linear-gradient(180deg, rgba(11,23,54,0) 0%, rgba(11,23,54,0.8) 100%)', color: '#fff', fontSize: 10 }}>
          <BadgeCheck size={11} style={{ color: C.teal }} /> {t('how.viz.posted')}
          <span className="ml-auto opacity-80">12.4K ▶</span>
        </span>
      </motion.div>
    </Panel>
  );
};

const ScenePaid: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <Row delay={0.05} highlight>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: 'rgba(22,199,132,0.14)', color: C.success }}>
          <Check size={12} />
        </span>
        <div className="min-w-0 flex-1 flex flex-col">
          <Txt>{t('how.viz.released')}</Txt>
          <Txt sub>Mesa Coffee · {t('how.viz.today')}</Txt>
        </div>
        <span className="v-ink font-medium tabular-nums" style={{ fontSize: 13, color: '#0e9f6a' }}>+$640</span>
      </Row>
      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex items-center justify-between">
          <Txt sub>{t('how.viz.balance')}</Txt>
          <Txt>$1,860</Txt>
        </div>
        <Bar pct={78} delay={0.3} color={`linear-gradient(90deg, ${C.success}, ${C.teal})`} />
        <Txt sub>{t('how.viz.payoutTo')} Telebirr · PayPal</Txt>
      </div>
    </Panel>
  );
};

const SceneBrief: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <div className="rounded-lg px-2.5 py-2 flex items-center gap-2" style={{ background: '#fff', border: '1px solid var(--color-cool-gray)' }}>
        <Txt>{t('how.viz.brief2')}</Txt>
        <motion.span className="ml-auto h-3 w-px" style={{ background: C.purple }} animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Chip tone="purple"><PlatformIcon platform="instagram" size={9} /> Instagram</Chip>
        <Chip tone="purple"><PlatformIcon platform="tiktok" size={9} /> TikTok</Chip>
        <Chip tone="muted">Reel · Story</Chip>
      </div>
      <div className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: '#fff', border: '1px solid var(--color-cool-gray)' }}>
        <Txt sub>{t('how.viz.budget')}</Txt>
        <Txt>$1,200</Txt>
      </div>
    </Panel>
  );
};

const SceneApplicants: React.FC = () => {
  const { t } = useTranslation();
  const rows = [
    { id: 'amara' as const, handle: '@amara.glow', fit: 97, followers: '48K' },
    { id: 'ravi' as const, handle: '@ravi.reviews', fit: 93, followers: '210K' },
    { id: 'selam' as const, handle: '@selam.daily', fit: 88, followers: '96K' },
  ];
  return (
    <Panel>
      {rows.map((r, i) => (
        <Row key={r.id} delay={0.05 + i * 0.1} highlight={i === 0}>
          <Portrait id={r.id} initials={r.handle[1].toUpperCase()} size={24} color={[C.purple, C.teal, C.warning][i]} />
          <div className="min-w-0 flex-1 flex flex-col">
            <Txt>{r.handle}</Txt>
            <Bar pct={r.fit} delay={0.3 + i * 0.1} />
          </div>
          <Chip tone="purple">{r.fit}% {t('how.viz.fit')}</Chip>
        </Row>
      ))}
    </Panel>
  );
};

const SceneEscrow: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <Row delay={0.05} highlight>
        <Portrait id="amara" initials="A" size={24} color={C.purple} />
        <div className="min-w-0 flex-1 flex flex-col">
          <Txt>@amara.glow</Txt>
          <Txt sub>{t('how.viz.accepted')}</Txt>
        </div>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background: 'rgba(22,199,132,0.14)', color: C.success }}>
          <Check size={11} />
        </span>
      </Row>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="rounded-lg px-2.5 py-2 flex items-center gap-2"
        style={{ background: C.navy, color: '#fff' }}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: 'rgba(108,99,255,0.35)' }}>
          <Lock size={11} />
        </span>
        <div className="min-w-0 flex-1 flex flex-col">
          <span className="font-medium truncate" style={{ fontSize: 11 }}>{t('how.viz.funded')}</span>
          <span className="truncate" style={{ fontSize: 9.5, opacity: 0.7 }}>{t('how.viz.heldUntil')}</span>
        </div>
        <span className="font-medium tabular-nums" style={{ fontSize: 12, color: C.teal }}>$1,200</span>
      </motion.div>
    </Panel>
  );
};

const SceneTrack: React.FC = () => {
  const { t } = useTranslation();
  const w = 120, h = 34;
  const d = sparkPath([8, 14, 12, 20, 24, 30, 27, 38, 44, 52], w, h);
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <Txt sub>{t('how.viz.reach')}</Txt>
          <span className="v-ink font-medium tabular-nums" style={{ fontSize: 15, letterSpacing: '-0.02em' }}>184K</span>
        </div>
        <Chip tone="success"><TrendingUp size={9} /> +38%</Chip>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 34 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="hiw-line" x1="0" x2="1"><stop offset="0" stopColor={C.purple} /><stop offset="1" stopColor={C.teal} /></linearGradient>
        </defs>
        <motion.path d={d} fill="none" stroke="url(#hiw-line)" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      </svg>
      <div className="flex items-center justify-between">
        <Txt sub>{t('how.viz.engagement')} 6.2%</Txt>
        <Chip tone="success"><Check size={9} /> {t('how.viz.settled')}</Chip>
      </div>
    </Panel>
  );
};

const SCENES: Record<Track, React.FC[]> = {
  creators: [SceneBriefs, SceneApply, ScenePost, ScenePaid],
  brands: [SceneBrief, SceneApplicants, SceneEscrow, SceneTrack],
};

/* ── section ───────────────────────────────────────────────────────── */
export const HowItWorks: React.FC<HowItWorksProps> = ({ settings }) => {
  const { t } = useTranslation();
  const [track, setTrack] = useState<Track>('creators');
  const steps = track === 'creators' ? CREATOR_WORKFLOW_STEPS : WORKFLOW_STEPS;
  const stepText = t(track === 'creators' ? 'how.creator' : 'how.brand', {
    returnObjects: true,
  }) as { title: string; desc: string }[];

  return (
    <section
      id="how-it-works"
      className="px-6 lg:px-10 py-24 sm:py-28"
      style={{
        borderTop: '1px solid var(--color-cool-gray)',
        borderBottom: '1px solid var(--color-cool-gray)',
      }}
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-12">
          <span className="v-pill-quiet">{t('how.pill')}</span>
          <h2 className="mt-5 v-heading-xl">
            {settings.how_it_works_title || t('how.title')}
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            {settings.how_it_works_desc || t('how.desc')}
          </p>

          <div className="mt-7 flex justify-center">
            <Segment
              selectedKey={track}
              onSelectionChange={(k) => setTrack(k as Track)}
              size="sm"
              aria-label="Show the flow for"
            >
              <Segment.Item id="creators">{t('how.tabCreators')}</Segment.Item>
              <Segment.Separator />
              <Segment.Item id="brands">{t('how.tabBrands')}</Segment.Item>
            </Segment>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={track}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
            data-testid="how-steps"
          >
            {/* progress line joining the numbered nodes (wide screens only) */}
            <div className="hidden lg:block absolute left-[12.5%] right-[12.5%] top-0 h-px" style={{ background: 'var(--color-cool-gray)' }} aria-hidden>
              <motion.div
                className="h-px"
                initial={{ width: 0 }}
                whileInView={{ width: '100%' }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: `linear-gradient(90deg, ${C.purple}, ${C.teal})` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-5">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const Scene = SCENES[track][i];
                return (
                  <motion.div
                    key={`${track}-${step.step}`}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -4 }}
                    className="v-card relative flex flex-col"
                    style={{ transition: 'border-color 200ms, box-shadow 200ms', paddingTop: 28 }}
                  >
                    {/* numbered node sitting on the progress line */}
                    <span
                      className="absolute left-1/2 -translate-x-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full font-medium tabular-nums"
                      style={{ top: -18, background: 'var(--gradient-signature)', color: '#fff', fontSize: 12.5, boxShadow: 'rgba(108,99,255,0.35) 0 8px 18px -8px, 0 0 0 5px var(--color-paper)' }}
                    >
                      {i + 1}
                    </span>

                    <Scene />

                    <div className="mt-4 flex items-center gap-2.5">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-soft-lavender) 0%, rgba(0,212,199,0.22) 100%)',
                          color: 'var(--color-campaign-purple)',
                        }}
                      >
                        <Icon size={15} strokeWidth={1.75} />
                      </span>
                      <h3 className="v-ink font-medium" style={{ fontSize: 17, lineHeight: 1.25, letterSpacing: '-0.018em' }}>
                        {stepText[i]?.title ?? step.title}
                      </h3>
                    </div>
                    <p className="mt-2 v-body v-muted" style={{ fontSize: 14 }}>{stepText[i]?.desc ?? step.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default HowItWorks;
