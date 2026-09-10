import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Check, Clock, Inbox, Lock, MessageSquare, TrendingUp } from 'lucide-react';
import { Button } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { AUDIENCES, type AudienceKey } from '../copy';
import PlatformIcon from '../mocks/PlatformIcon';
import Portrait from '../mocks/Portrait';
import { Bar, Brand, C, Chip, Panel, Row, Txt, sparkPath } from '../mocks/SceneBits';

const TAB_KEY: Record<AudienceKey, string> = {
  creator: 'audiences.tabCreator',
  brand: 'audiences.tabBrand',
  manager: 'audiences.tabManager',
};

/**
 * Audiences — HeroUI Pro Segment + three illustrated benefit cards.
 *
 * Each persona's three benefits are drawn as small product scenes (same
 * vocabulary as HowItWorks and the hero phones): brief rows, an escrow
 * timeline, a workspace list, fit bars, a live chart, a roster, a deal
 * thread, a commission split. Swapping the Segment swaps the whole set.
 */

/* ── creator scenes ────────────────────────────────────────────────── */
const CreatorCampaigns: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <Txt sub>{t('audiences.viz.newBriefs')}</Txt>
        <Chip tone="purple">3 {t('audiences.viz.today')}</Chip>
      </div>
      {[
        { face: 'ravi' as const, brand: 'Glow Athletic', mark: 'GL', color: C.purple, title: t('how.viz.brief1'), pay: '$160–700', p: 'tiktok' as const },
        { face: 'amara' as const, brand: 'Mesa Coffee', mark: 'ME', color: C.teal, title: t('how.viz.brief2'), pay: '$250–800', p: 'instagram' as const },
      ].map((b, i) => (
        <Row key={b.brand} delay={0.05 + i * 0.1} highlight={i === 0}>
          <span className="relative shrink-0">
            <Portrait id={b.face} initials={b.mark} size={24} color={b.color} />
            <span className="absolute -bottom-1 -right-1 inline-flex h-3 w-3 items-center justify-center rounded" style={{ background: b.color, color: '#fff', fontSize: 6, border: '1px solid #fff' }}>{b.mark}</span>
          </span>
          <div className="min-w-0 flex-1 flex flex-col">
            <Txt>{b.title}</Txt>
            <Txt sub>{b.brand} · <PlatformIcon platform={b.p} size={9} className="inline" /></Txt>
          </div>
          <Chip tone="success">{b.pay}</Chip>
        </Row>
      ))}
    </Panel>
  );
};

const CreatorEscrow: React.FC = () => {
  const { t } = useTranslation();
  const steps = [t('audiences.viz.accepted'), t('audiences.viz.escrowed'), t('audiences.viz.posted'), t('audiences.viz.released')];
  return (
    <Panel>
      <Row dark delay={0.05}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: 'rgba(108,99,255,0.35)' }}>
          <Lock size={11} />
        </span>
        <div className="min-w-0 flex-1 flex flex-col">
          <span className="font-medium truncate" style={{ fontSize: 11 }}>{t('audiences.viz.heldForYou')}</span>
          <span className="truncate" style={{ fontSize: 9.5, opacity: 0.7 }}>Mesa Coffee · {t('how.viz.brief2')}</span>
        </div>
        <span className="font-medium tabular-nums" style={{ fontSize: 12, color: C.teal }}>$640</span>
      </Row>
      <div className="px-0.5 pt-1">
        <Bar pct={100} delay={0.2} color={`linear-gradient(90deg, ${C.purple}, ${C.success})`} />
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {steps.map((s, i) => (
            <motion.span key={s} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.2 }} className="flex flex-col items-center gap-0.5 text-center">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full" style={{ background: i === 3 ? C.success : C.purple, color: '#fff' }}>
                <Check size={8} />
              </span>
              <span className="v-quiet leading-tight" style={{ fontSize: 8.5 }}>{s}</span>
            </motion.span>
          ))}
        </div>
      </div>
    </Panel>
  );
};

const CreatorWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const rows = [
    { title: t('how.viz.brief2'), meta: 'Mesa Coffee', chip: <Chip tone="success"><Check size={9} /> {t('audiences.viz.paid')}</Chip> },
    { title: t('how.viz.brief1'), meta: 'Glow Athletic', chip: <Chip tone="warning"><Clock size={9} /> {t('audiences.viz.dueIn', { n: 3 })}</Chip> },
    { title: t('how.viz.brief3'), meta: 'Stride', chip: <Chip tone="blue">{t('audiences.viz.shortlisted')}</Chip> },
  ];
  return (
    <Panel>
      {rows.map((r, i) => (
        <Row key={r.title} delay={0.05 + i * 0.1}>
          <div className="min-w-0 flex-1 flex flex-col">
            <Txt>{r.title}</Txt>
            <Txt sub>{r.meta}</Txt>
          </div>
          {r.chip}
        </Row>
      ))}
    </Panel>
  );
};

/* ── brand scenes ──────────────────────────────────────────────────── */
const BrandMatch: React.FC = () => {
  const { t } = useTranslation();
  const rows = [
    { id: 'amara' as const, handle: '@amara.glow', fit: 97 },
    { id: 'ravi' as const, handle: '@ravi.reviews', fit: 93 },
    { id: 'selam' as const, handle: '@selam.daily', fit: 88 },
  ];
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <Txt sub>{t('audiences.viz.matchedIn')}</Txt>
        <Chip tone="purple">{t('audiences.viz.aiRanked')}</Chip>
      </div>
      {rows.map((r, i) => (
        <Row key={r.id} delay={0.05 + i * 0.1} highlight={i === 0}>
          <Portrait id={r.id} initials={r.handle[1].toUpperCase()} size={22} color={[C.purple, C.teal, C.warning][i]} />
          <div className="min-w-0 flex-1 flex flex-col">
            <Txt>{r.handle}</Txt>
            <Bar pct={r.fit} delay={0.3 + i * 0.1} />
          </div>
          <Chip tone="purple">{r.fit}%</Chip>
        </Row>
      ))}
    </Panel>
  );
};

const BrandLive: React.FC = () => {
  const { t } = useTranslation();
  const w = 120, h = 30;
  return (
    <Panel>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { l: t('how.viz.reach'), v: '184K', d: '+38%' },
          { l: t('how.viz.engagement'), v: '6.2%', d: '+1.1' },
          { l: t('audiences.viz.clicks'), v: '2,140', d: '+22%' },
        ].map((k, i) => (
          <motion.div key={k.l} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.05 + i * 0.1 }} className="rounded-lg px-2 py-1.5 flex flex-col" style={{ background: '#fff', border: '1px solid var(--color-cool-gray)' }}>
            <span className="v-quiet truncate" style={{ fontSize: 8.5 }}>{k.l}</span>
            <span className="v-ink font-medium tabular-nums" style={{ fontSize: 12.5 }}>{k.v}</span>
            <span className="tabular-nums" style={{ fontSize: 8.5, color: '#0e9f6a' }}>{k.d}</span>
          </motion.div>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 30 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="aud-line" x1="0" x2="1"><stop offset="0" stopColor={C.purple} /><stop offset="1" stopColor={C.teal} /></linearGradient>
        </defs>
        <motion.path d={sparkPath([10, 16, 14, 22, 26, 24, 34, 40, 46, 55], w, h)} fill="none" stroke="url(#aud-line)" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      </svg>
      <div className="flex items-center gap-1.5">
        <Chip tone="muted"><PlatformIcon platform="instagram" size={9} /> 3</Chip>
        <Chip tone="muted"><PlatformIcon platform="tiktok" size={9} /> 2</Chip>
        <Chip tone="success"><TrendingUp size={9} /> {t('audiences.viz.live')}</Chip>
      </div>
    </Panel>
  );
};

const BrandEscrow: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <Row dark delay={0.05}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: 'rgba(108,99,255,0.35)' }}>
          <Lock size={11} />
        </span>
        <div className="min-w-0 flex-1 flex flex-col">
          <span className="font-medium truncate" style={{ fontSize: 11 }}>{t('how.viz.funded')}</span>
          <span className="truncate" style={{ fontSize: 9.5, opacity: 0.7 }}>{t('how.viz.heldUntil')}</span>
        </div>
        <span className="font-medium tabular-nums" style={{ fontSize: 12, color: C.teal }}>$1,200</span>
      </Row>
      {[
        { who: 'amara' as const, handle: '@amara.glow', state: t('audiences.viz.delivered'), amt: '$640', done: true },
        { who: 'ravi' as const, handle: '@ravi.reviews', state: t('audiences.viz.inProgress'), amt: '$560', done: false },
      ].map((r, i) => (
        <Row key={r.handle} delay={0.2 + i * 0.1}>
          <Portrait id={r.who} initials={r.handle[1].toUpperCase()} size={22} color={C.purple} />
          <div className="min-w-0 flex-1 flex flex-col">
            <Txt>{r.handle}</Txt>
            <Txt sub>{r.state}</Txt>
          </div>
          {r.done ? <Chip tone="success"><Check size={9} /> {r.amt}</Chip> : <Chip tone="muted"><Lock size={9} /> {r.amt}</Chip>}
        </Row>
      ))}
    </Panel>
  );
};

/* ── manager scenes ────────────────────────────────────────────────── */
const ManagerRoster: React.FC = () => {
  const { t } = useTranslation();
  const rows = [
    { id: 'selam' as const, name: 'Selam', pipeline: 3, earned: '$2.4K' },
    { id: 'amara' as const, name: 'Amara', pipeline: 2, earned: '$1.9K' },
    { id: 'ravi' as const, name: 'Ravi', pipeline: 4, earned: '$3.1K' },
  ];
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <Txt sub>{t('audiences.viz.roster')}</Txt>
        <span className="flex -space-x-1.5">
          {rows.map((r) => <Portrait key={r.id} id={r.id} initials={r.name[0]} size={16} color={C.purple} style={{ border: '1.5px solid #fff' }} />)}
        </span>
      </div>
      {rows.map((r, i) => (
        <Row key={r.id} delay={0.05 + i * 0.1}>
          <Portrait id={r.id} initials={r.name[0]} size={22} color={[C.purple, C.teal, C.warning][i]} />
          <div className="min-w-0 flex-1 flex flex-col">
            <Txt>{r.name} <BadgeCheck size={9} className="inline" style={{ color: C.teal }} /></Txt>
            <Txt sub>{t('audiences.viz.activeDeals', { n: r.pipeline })}</Txt>
          </div>
          <span className="v-ink font-medium tabular-nums" style={{ fontSize: 11 }}>{r.earned}</span>
        </Row>
      ))}
    </Panel>
  );
};

const ManagerBroker: React.FC = () => {
  const { t } = useTranslation();
  const msgs = [
    { from: 'brand', text: `${t('audiences.viz.offer')} $900`, tone: 'muted' as const },
    { from: 'you', text: `${t('audiences.viz.counter')} $1,100`, tone: 'purple' as const },
    { from: 'brand', text: `${t('audiences.viz.agreed')} · $1,100`, tone: 'success' as const },
  ];
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <Brand initials="ME" color={C.teal} size={20} />
        <Txt>Mesa Coffee</Txt>
        <span className="v-quiet" style={{ fontSize: 9 }}>×</span>
        <Portrait id="selam" initials="S" size={20} color={C.purple} />
        <Txt>Selam</Txt>
        <Chip tone="muted"><MessageSquare size={9} /> {t('audiences.viz.oneInbox')}</Chip>
      </div>
      {msgs.map((m, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: m.from === 'you' ? 8 : -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.18 }} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
          <span
            className="rounded-xl px-2.5 py-1.5 font-medium max-w-[80%]"
            style={{
              fontSize: 10.5,
              background: m.from === 'you' ? 'var(--gradient-signature)' : '#fff',
              color: m.from === 'you' ? '#fff' : 'var(--color-deep-navy)',
              border: m.from === 'you' ? 'none' : '1px solid var(--color-cool-gray)',
              borderBottomRightRadius: m.from === 'you' ? 4 : undefined,
              borderBottomLeftRadius: m.from === 'you' ? undefined : 4,
            }}
          >
            {m.text}
            {m.tone === 'success' && <Check size={10} className="inline ml-1" style={{ color: C.success }} />}
          </span>
        </motion.div>
      ))}
    </Panel>
  );
};

const ManagerCommission: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Panel>
      <Row highlight delay={0.05}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: 'rgba(22,199,132,0.14)', color: C.success }}>
          <Check size={12} />
        </span>
        <div className="min-w-0 flex-1 flex flex-col">
          <Txt>{t('how.viz.released')}</Txt>
          <Txt sub>Mesa Coffee × Selam</Txt>
        </div>
        <span className="v-ink font-medium tabular-nums" style={{ fontSize: 12.5 }}>$1,100</span>
      </Row>
      <div className="flex flex-col gap-1 px-0.5">
        <span className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-cool-gray)' }}>
          <motion.span initial={{ width: 0 }} whileInView={{ width: '85%' }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.3 }} className="h-2" style={{ background: C.teal }} />
          <motion.span initial={{ width: 0 }} whileInView={{ width: '15%' }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 1 }} className="h-2" style={{ background: C.purple }} />
        </span>
        <div className="flex items-center justify-between">
          <Txt sub><span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ background: C.teal }} />{t('audiences.viz.creatorShare')} · $935</Txt>
          <Txt sub><span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ background: C.purple }} />{t('audiences.viz.yourCut')} 15% · <span className="v-ink font-medium">$165</span></Txt>
        </div>
        <Txt sub><Inbox size={9} className="inline mr-1" />{t('audiences.viz.autoSplit')}</Txt>
      </div>
    </Panel>
  );
};

const SCENES: Record<AudienceKey, React.FC[]> = {
  creator: [CreatorCampaigns, CreatorEscrow, CreatorWorkspace],
  brand: [BrandMatch, BrandLive, BrandEscrow],
  manager: [ManagerRoster, ManagerBroker, ManagerCommission],
};

export const Audiences: React.FC = () => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<AudienceKey>('creator');
  const current = AUDIENCES.find((a) => a.key === selected) ?? AUDIENCES[0];

  return (
    <section id="audiences" className="px-6 lg:px-10 py-24 sm:py-28">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[680px] mx-auto mb-12">
          <span className="v-pill-quiet">{t('audiences.pill')}</span>
          <h2 className="mt-5 v-heading-xl">
            {t('audiences.titleA')}{' '}
            <span className="v-text-signature">{t('audiences.titleB')}</span>
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            {t('audiences.desc')}
          </p>
        </div>

        {/* HeroUI Pro Segment — smooth indicator transitions */}
        <div className="flex justify-center mb-12">
          <Segment
            selectedKey={selected}
            onSelectionChange={(k) => setSelected(k as AudienceKey)}
            size="md"
          >
            {AUDIENCES.map((a, i) => (
              <React.Fragment key={a.key}>
                {i > 0 && <Segment.Separator />}
                <Segment.Item id={a.key}>{t(TAB_KEY[a.key])}</Segment.Item>
              </React.Fragment>
            ))}
          </Segment>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            data-testid="audience-panel"
          >
            <div className="text-center max-w-[760px] mx-auto mb-10">
              <div className="v-badge-new">{t(`audiences.${current.key}.eyebrow`)}</div>
              <h3 className="mt-5 v-heading-lg">{t(`audiences.${current.key}.headline`)}</h3>
              <p className="mt-4 v-body-lg v-muted">{t(`audiences.${current.key}.desc`)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {current.benefits.map((b, i) => {
                const Icon = b.icon;
                const Scene = SCENES[current.key][i];
                return (
                  <motion.div
                    key={b.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.05 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -4 }}
                    className="v-card flex flex-col"
                    style={{ transition: 'border-color 200ms, box-shadow 200ms' }}
                  >
                    <Scene />
                    <div className="mt-4 flex items-center gap-2.5">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-soft-lavender) 0%, rgba(0,212,199,0.18) 100%)',
                          color: 'var(--color-campaign-purple)',
                        }}
                      >
                        <Icon size={15} strokeWidth={1.75} />
                      </span>
                      <h4 className="v-ink font-medium" style={{ fontSize: 17, lineHeight: 1.25, letterSpacing: '-0.018em' }}>
                        {t(`audiences.${current.key}.b${i + 1}t`)}
                      </h4>
                    </div>
                    <p className="mt-2 v-body v-muted" style={{ fontSize: 14 }}>{t(`audiences.${current.key}.b${i + 1}d`)}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-12 flex justify-center">
              <Link to={current.ctaHref}>
                <Button variant="primary" size="lg" className="!rounded-xl">
                  {t(`audiences.${current.key}.cta`)} <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default Audiences;
