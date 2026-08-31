import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Dumbbell,
  Gamepad2,
  Lock,
  Music,
  Palette,
  Plane,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Cpu,
} from 'lucide-react';
import { Button } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { AnimatePresence, animate, motion, useMotionValue, useSpring } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import PlatformIcon, { type PlatformKey } from '../mocks/PlatformIcon';
import type { LandingSettings } from '../useLandingData';

/**
 * Hero — one hero, two audiences.
 *
 * An "I'm a creator / I'm a brand" switch swaps the entire pitch:
 *
 *  · Creator mode — "what's my content worth?": pick a niche + audience
 *    size, the phone restacks matching briefs and counts up a typical
 *    payout range.
 *  · Brand mode — "what does my budget buy?": pick a campaign niche +
 *    budget band, the phone flips to ranked applicants and an
 *    escrow-funded toast, with applicant + reach estimates.
 *
 * Both paths end in a labeled CTA that deep-links the register page
 * with the right role (/register?role=creator|brand).
 */

interface HeroProps {
  settings: LandingSettings;
}

type Mode = 'creator' | 'brand';

/* ── Shared niche data ──────────────────────────────────────────── */

type NicheKey =
  | 'beauty' | 'fitness' | 'food' | 'travel'
  | 'tech' | 'gaming' | 'fashion' | 'music';

type Brief = {
  brand: string;
  title: string;
  platform: PlatformKey;
  payout: string;
  color: string;
};

const BRAND = {
  purple: '#6c63ff',
  blue: '#4f7cff',
  teal: '#00d4c7',
  navy: '#0b1736',
  success: '#16c784',
  warning: '#ffb547',
  error: '#ff5a5f',
};

const NICHES: {
  key: NicheKey;
  label: string;
  icon: LucideIcon;
  range: [number, number];      // creator: typical per-brief payout at 1–10K followers
  applicants: [number, number]; // brand: typical applicant pool at $1–5K budget
  reachK: [number, number];     // brand: est. campaign reach (thousands) at $1–5K
  briefs: Brief[];
}[] = [
  {
    key: 'beauty', label: 'Beauty', icon: Palette,
    range: [150, 900], applicants: [50, 110], reachK: [400, 1100],
    briefs: [
      { brand: 'Aurora Skin', title: 'Golden-hour skincare routine', platform: 'instagram', payout: '$180–$650', color: BRAND.error },
      { brand: 'Velvet Lab', title: '15s "one product, one week" test', platform: 'tiktok', payout: '$150–$480', color: BRAND.purple },
      { brand: 'Mise Beauty', title: 'Get-ready-with-me, no filter', platform: 'tiktok', payout: '$220–$900', color: BRAND.teal },
    ],
  },
  {
    key: 'fitness', label: 'Fitness', icon: Dumbbell,
    range: [120, 800], applicants: [40, 90], reachK: [350, 900],
    briefs: [
      { brand: 'Glow Athletic', title: 'Summer outdoor workout UGC', platform: 'tiktok', payout: '$160–$700', color: BRAND.purple },
      { brand: 'CoreFuel', title: 'Honest 30-day protein review', platform: 'youtube', payout: '$250–$800', color: BRAND.blue },
      { brand: 'Stride', title: 'Sunrise run POV reel', platform: 'instagram', payout: '$120–$400', color: BRAND.teal },
    ],
  },
  {
    key: 'food', label: 'Food', icon: UtensilsCrossed,
    range: [100, 700], applicants: [45, 100], reachK: [300, 800],
    briefs: [
      { brand: 'Mesa Coffee', title: 'Morning ritual photo set', platform: 'instagram', payout: '$140–$500', color: BRAND.warning },
      { brand: 'Hyperloop Snacks', title: 'Gen-Z mealtime POV', platform: 'tiktok', payout: '$150–$600', color: BRAND.teal },
      { brand: 'Sobremesa', title: '3-ingredient dinner series', platform: 'youtube', payout: '$200–$700', color: BRAND.error },
    ],
  },
  {
    key: 'travel', label: 'Travel', icon: Plane,
    range: [200, 1200], applicants: [30, 70], reachK: [500, 1400],
    briefs: [
      { brand: 'Nomad Audio', title: 'Long-haul flight unboxing', platform: 'youtube', payout: '$400–$1.2k', color: BRAND.blue },
      { brand: 'Atlas Stays', title: 'Hidden-gem weekend vlog', platform: 'tiktok', payout: '$250–$900', color: BRAND.purple },
      { brand: 'Fjord & Co', title: 'Pack-with-me carry-on edit', platform: 'instagram', payout: '$200–$650', color: BRAND.teal },
    ],
  },
  {
    key: 'tech', label: 'Tech', icon: Cpu,
    range: [250, 1500], applicants: [25, 60], reachK: [450, 1300],
    briefs: [
      { brand: 'Nomad Audio', title: 'Long-form earbuds review', platform: 'youtube', payout: '$500–$1.5k', color: BRAND.blue },
      { brand: 'Keyframe', title: '60s editing-app speedrun', platform: 'tiktok', payout: '$250–$800', color: BRAND.purple },
      { brand: 'Voltbox', title: 'Desk setup transformation', platform: 'instagram', payout: '$300–$1k', color: BRAND.warning },
    ],
  },
  {
    key: 'gaming', label: 'Gaming', icon: Gamepad2,
    range: [150, 900], applicants: [35, 80], reachK: [400, 1000],
    briefs: [
      { brand: 'Hexline', title: 'First-play reaction stream clip', platform: 'twitch', payout: '$200–$900', color: BRAND.purple },
      { brand: 'PixelForge', title: 'Speedrun challenge short', platform: 'youtube', payout: '$180–$700', color: BRAND.error },
      { brand: 'LagZero', title: 'Setup tour + FPS test', platform: 'tiktok', payout: '$150–$500', color: BRAND.teal },
    ],
  },
  {
    key: 'fashion', label: 'Fashion', icon: Shirt,
    range: [150, 1000], applicants: [45, 100], reachK: [420, 1100],
    briefs: [
      { brand: 'Loom & Fade', title: '5 outfits, 1 jacket transition', platform: 'tiktok', payout: '$200–$800', color: BRAND.purple },
      { brand: 'Atelier Nine', title: 'Capsule wardrobe lookbook', platform: 'instagram', payout: '$250–$1k', color: BRAND.error },
      { brand: 'Thrift Theory', title: 'Styled vs. thrifted haul', platform: 'youtube', payout: '$180–$600', color: BRAND.teal },
    ],
  },
  {
    key: 'music', label: 'Music', icon: Music,
    range: [120, 850], applicants: [30, 75], reachK: [350, 900],
    briefs: [
      { brand: 'Reverb Rooms', title: 'Bedroom studio tour', platform: 'youtube', payout: '$200–$850', color: BRAND.blue },
      { brand: 'Chorus', title: '15s sound-on transition edit', platform: 'tiktok', payout: '$120–$450', color: BRAND.purple },
      { brand: 'Analog Wave', title: 'Vinyl unboxing + first spin', platform: 'instagram', payout: '$150–$550', color: BRAND.warning },
    ],
  },
];

/* Creator: audience-size bands */
type BandKey = 'micro' | 'mid' | 'macro';
const BANDS: { key: BandKey; label: string; multiplier: number }[] = [
  { key: 'micro', label: '1–10K', multiplier: 1 },
  { key: 'mid', label: '10–100K', multiplier: 3.2 },
  { key: 'macro', label: '100K+', multiplier: 8 },
];

/* Brand: budget bands */
type BudgetKey = 'seed' | 'growth' | 'scale';
const BUDGETS: { key: BudgetKey; label: string; multiplier: number; escrow: string }[] = [
  { key: 'seed', label: '$1–5K', multiplier: 1, escrow: '$3,000' },
  { key: 'growth', label: '$5–20K', multiplier: 2.4, escrow: '$12,000' },
  { key: 'scale', label: '$20K+', multiplier: 5.5, escrow: '$35,000' },
];

/* Brand: ranked applicant rows shown in the phone */
const APPLICANTS = [
  { handle: '@mara.moves', followers: '48K', er: '6.2%', fit: 97, color: BRAND.purple },
  { handle: '@jai.frames', followers: '210K', er: '4.1%', fit: 93, color: BRAND.teal },
  { handle: '@nova.daily', followers: '96K', er: '5.4%', fit: 88, color: BRAND.warning },
];

const roundTo10 = (n: number) => Math.round(n / 10) * 10;
const fmtMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
const fmtCount = (n: number) => `${Math.round(n)}`;
const fmtReach = (k: number) =>
  k >= 1000 ? `${(k / 1000).toFixed(1).replace(/\.0$/, '')}M` : `${Math.round(k)}K`;

/* ── Count-up number ────────────────────────────────────────────── */
const CountUp: React.FC<{ value: number; format?: (n: number) => string }> = ({
  value,
  format = fmtMoney,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      el.textContent = format(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { el.textContent = format(v); },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, format]);

  return <span ref={ref} className="tabular-nums">{format(value)}</span>;
};

/* ── Toasts ─────────────────────────────────────────────────────── */
const Toast: React.FC<{ icon: React.ReactNode; title: string; sub: string; seq: number }> = ({
  icon, title, sub, seq,
}) => (
  <motion.div
    key={seq}
    initial={{ opacity: 0, y: -18, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.35 }}
    className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
    style={{
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(8px)',
      boxShadow: 'rgba(11,23,54,0.14) 0 10px 30px -8px, rgba(11,23,54,0.05) 0 0 0 1px',
    }}
  >
    {icon}
    <div className="min-w-0">
      <div className="v-caption font-medium v-ink" style={{ fontSize: 12 }}>{title}</div>
      <div className="v-caption v-quiet" style={{ fontSize: 10.5 }}>{sub}</div>
    </div>
  </motion.div>
);

/* ── Phone: creator POV (briefs for you) ────────────────────────── */
const CreatorPhone: React.FC<{
  niche: (typeof NICHES)[number];
  band: (typeof BANDS)[number];
  seq: number;
}> = ({ niche, band, seq }) => {
  const lo = roundTo10(niche.range[0] * band.multiplier);
  const hi = roundTo10(niche.range[1] * band.multiplier);

  return (
    <div className="v-phone select-none" aria-label={`Example creator feed for ${niche.label}`}>
      <div className="v-phone-screen">
        <div className="flex items-center justify-between px-5 pt-3.5">
          <span className="v-caption v-ink font-medium" style={{ fontSize: 12 }}>9:41</span>
          <span className="h-[18px] w-[74px] rounded-full" style={{ background: BRAND.navy }} />
          <span className="v-caption v-quiet" style={{ fontSize: 11 }}>5G</span>
        </div>

        <div className="px-4 pt-3 h-[64px]">
          <AnimatePresence mode="wait">
            <Toast
              seq={seq}
              icon={
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0"
                  style={{ background: 'rgba(22,199,132,0.14)', color: BRAND.success }}
                >
                  <BadgeCheck size={14} />
                </span>
              }
              title={`Payout sent · ${fmtMoney(roundTo10((lo + hi) / 2))}`}
              sub="escrow released → @you"
            />
          </AnimatePresence>
        </div>

        <div className="px-5 pt-2 flex items-end justify-between gap-2">
          <div>
            <div className="v-caption v-quiet" style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Briefs for you
            </div>
            <div className="v-ink font-medium" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
              {niche.label} · {band.label}
            </div>
          </div>
          <div
            className="rounded-full px-2.5 py-1 v-caption font-medium tabular-nums shrink-0"
            style={{ background: 'rgba(22,199,132,0.12)', color: '#0e9f6a', fontSize: 11 }}
          >
            <CountUp value={lo} />–<CountUp value={hi} /> / brief
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 flex flex-col gap-2.5">
          <AnimatePresence mode="popLayout">
            {niche.briefs.map((b, i) => (
              <motion.div
                layout
                key={`${niche.key}-${b.brand}`}
                initial={{ opacity: 0, y: 22, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28, delay: i * 0.07 }}
                className="rounded-2xl p-3 flex items-center gap-3"
                style={{
                  background: '#fff',
                  border: '1px solid var(--color-cool-gray)',
                  boxShadow: 'rgba(11,23,54,0.05) 0 4px 14px -6px',
                }}
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl font-medium shrink-0"
                  style={{ background: b.color, color: '#fff', fontSize: 11 }}
                >
                  {b.brand.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="v-ink font-medium truncate" style={{ fontSize: 12.5, letterSpacing: '-0.01em' }}>
                    {b.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 v-caption v-quiet" style={{ fontSize: 10.5 }}>
                    <PlatformIcon platform={b.platform} size={11} />
                    {b.brand}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="v-caption font-medium tabular-nums" style={{ color: BRAND.purple, fontSize: 11.5 }}>
                    {b.payout}
                  </div>
                  <div className="v-caption v-quiet" style={{ fontSize: 10 }}>escrowed</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="px-4 pb-4 mt-auto">
          <Link to="/register?role=creator" className="block">
            <span
              className="flex items-center justify-center gap-1.5 rounded-full py-2.5 font-medium"
              style={{ background: 'var(--gradient-signature)', color: '#fff', fontSize: 13 }}
            >
              Apply in one tap <ArrowRight size={13} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

/* ── Phone: brand POV (ranked applicants) ───────────────────────── */
const BrandPhone: React.FC<{
  niche: (typeof NICHES)[number];
  budget: (typeof BUDGETS)[number];
  seq: number;
}> = ({ niche, budget, seq }) => {
  const aLo = Math.round(niche.applicants[0] * budget.multiplier);
  const aHi = Math.round(niche.applicants[1] * budget.multiplier);

  return (
    <div className="v-phone select-none" aria-label={`Example brand view for a ${niche.label} campaign`}>
      <div className="v-phone-screen">
        <div className="flex items-center justify-between px-5 pt-3.5">
          <span className="v-caption v-ink font-medium" style={{ fontSize: 12 }}>9:41</span>
          <span className="h-[18px] w-[74px] rounded-full" style={{ background: BRAND.navy }} />
          <span className="v-caption v-quiet" style={{ fontSize: 11 }}>5G</span>
        </div>

        <div className="px-4 pt-3 h-[64px]">
          <AnimatePresence mode="wait">
            <Toast
              seq={seq}
              icon={
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0"
                  style={{ background: 'rgba(108,99,255,0.12)', color: BRAND.purple }}
                >
                  <Lock size={13} />
                </span>
              }
              title={`Escrow funded · ${budget.escrow}`}
              sub="protected until content ships"
            />
          </AnimatePresence>
        </div>

        <div className="px-5 pt-2 flex items-end justify-between gap-2">
          <div>
            <div className="v-caption v-quiet" style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Ranked applicants
            </div>
            <div className="v-ink font-medium" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
              {niche.label} · {budget.label}
            </div>
          </div>
          <div
            className="rounded-full px-2.5 py-1 v-caption font-medium tabular-nums shrink-0"
            style={{ background: 'rgba(108,99,255,0.10)', color: BRAND.purple, fontSize: 11 }}
          >
            <CountUp value={aLo} format={fmtCount} />–<CountUp value={aHi} format={fmtCount} /> matched
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 flex flex-col gap-2.5">
          <AnimatePresence mode="popLayout">
            {APPLICANTS.map((a, i) => (
              <motion.div
                layout
                key={`${niche.key}-${a.handle}`}
                initial={{ opacity: 0, y: 22, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28, delay: i * 0.07 }}
                className="rounded-2xl p-3 flex items-center gap-3"
                style={{
                  background: '#fff',
                  border: '1px solid var(--color-cool-gray)',
                  boxShadow: 'rgba(11,23,54,0.05) 0 4px 14px -6px',
                }}
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full font-medium shrink-0"
                  style={{ background: a.color, color: '#fff', fontSize: 11 }}
                >
                  {a.handle.slice(1, 3).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="v-ink font-medium truncate" style={{ fontSize: 12.5, letterSpacing: '-0.01em' }}>
                      {a.handle}
                    </span>
                    <CheckCircle2 size={11} style={{ color: BRAND.purple }} />
                  </div>
                  <div className="mt-0.5 v-caption v-quiet" style={{ fontSize: 10.5 }}>
                    {niche.label} · {a.followers} · {a.er} ER
                  </div>
                </div>
                <div className="text-right shrink-0" style={{ width: 62 }}>
                  <div className="v-caption font-medium tabular-nums" style={{ color: BRAND.purple, fontSize: 11.5 }}>
                    {a.fit}% fit
                  </div>
                  <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-cool-gray)' }}>
                    <motion.div
                      className="h-1 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${a.fit}%` }}
                      transition={{ duration: 0.7, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                      style={{ background: `linear-gradient(90deg, ${BRAND.purple}, ${BRAND.teal})` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="px-4 pb-4 mt-auto">
          <Link to="/register?role=brand" className="block">
            <span
              className="flex items-center justify-center gap-1.5 rounded-full py-2.5 font-medium"
              style={{ background: 'var(--gradient-signature)', color: '#fff', fontSize: 13 }}
            >
              Review ranked applicants <ArrowRight size={13} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

/* ── Hero ───────────────────────────────────────────────────────── */
export const Hero: React.FC<HeroProps> = ({ settings }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [mode, setMode] = useState<Mode>('creator');
  const [nicheKey, setNicheKey] = useState<NicheKey>('fitness');
  const [bandKey, setBandKey] = useState<BandKey>('mid');
  const [budgetKey, setBudgetKey] = useState<BudgetKey>('growth');
  const [seq, setSeq] = useState(0);

  const niche = useMemo(() => NICHES.find((n) => n.key === nicheKey)!, [nicheKey]);
  const band = useMemo(() => BANDS.find((b) => b.key === bandKey)!, [bandKey]);
  const budget = useMemo(() => BUDGETS.find((b) => b.key === budgetKey)!, [budgetKey]);

  const bump = () => setSeq((s) => s + 1);
  const pick = (k: NicheKey) => { setNicheKey(k); bump(); };
  const pickBand = (k: BandKey) => { setBandKey(k); bump(); };
  const pickBudget = (k: BudgetKey) => { setBudgetKey(k); bump(); };
  const pickMode = (m: Mode) => { if (m !== mode) { setMode(m); bump(); } };

  /* pointer tilt (desktop, fine pointers, motion-safe only) */
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 160, damping: 18 });
  const sry = useSpring(ry, { stiffness: 160, damping: 18 });
  const tiltOk = useRef(false);
  useEffect(() => {
    tiltOk.current =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltOk.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };

  const isCreator = mode === 'creator';

  /* estimates for the inline result line */
  const estA = isCreator
    ? { lo: roundTo10(niche.range[0] * band.multiplier), hi: roundTo10(niche.range[1] * band.multiplier) }
    : { lo: Math.round(niche.applicants[0] * budget.multiplier), hi: Math.round(niche.applicants[1] * budget.multiplier) };
  const reach = {
    lo: niche.reachK[0] * budget.multiplier,
    hi: niche.reachK[1] * budget.multiplier,
  };

  return (
    <section id="home" className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 v-bg-dots pointer-events-none" />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          right: '-12%', top: '4%', width: '58%', height: '92%',
          background:
            'radial-gradient(45% 42% at 62% 38%, rgba(108,99,255,0.18), transparent 70%), radial-gradient(40% 38% at 42% 72%, rgba(0,212,199,0.16), transparent 70%), radial-gradient(30% 30% at 75% 70%, rgba(79,124,255,0.12), transparent 70%)',
          filter: 'blur(2px)',
        }}
      />

      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 pt-12 sm:pt-16 pb-16 sm:pb-24">
        {/* ── Audience switch — the first decision on the page ───── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center lg:justify-start mb-10"
        >
          <Segment
            selectedKey={mode}
            onSelectionChange={(k) => pickMode(k as Mode)}
            size="md"
            aria-label="I am a…"
          >
            <Segment.Item id="creator">I&apos;m a creator</Segment.Item>
            <Segment.Separator />
            <Segment.Item id="brand">I&apos;m a brand</Segment.Item>
          </Segment>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-center">
          {/* ── Left: pitch + picker ─────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="v-badge-new">
                <Sparkles size={11} />
                {isCreator ? 'For creators · free forever' : 'For brands + agencies · pay on delivery'}
              </div>

              <h1 className="mt-6 v-display">
                {isCreator ? (
                  settings.hero_title ? (
                    settings.hero_title
                  ) : (
                    <>
                      Make content.
                      <br />
                      Get paid. <span className="v-text-signature">Repeat.</span>
                    </>
                  )
                ) : (
                  <>
                    Launch creator campaigns.
                    <br />
                    Pay on <span className="v-text-signature">delivery.</span>
                  </>
                )}
              </h1>

              <p className="mt-6 v-body-lg v-muted" style={{ maxWidth: 480 }}>
                {isCreator
                  ? settings.hero_subtitle ||
                    'Real briefs from real brands on the platforms you already post on. Pick your niche, apply in a tap — the payout is escrowed before you hit record.'
                  : 'Post a brief and get matched with vetted creators on TikTok, Instagram, and YouTube. Your budget sits in escrow until content ships — with reach and engagement tracked live.'}
              </p>

              {/* picker */}
              <div className="mt-8">
                <div className="v-caption v-quiet mb-2.5" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {isCreator ? 'What do you post?' : "What's your campaign about?"}
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={isCreator ? 'Pick your niche' : 'Pick your campaign niche'}>
                  {NICHES.map((n) => {
                    const Icon = n.icon;
                    const active = n.key === nicheKey;
                    return (
                      <button
                        key={n.key}
                        type="button"
                        onClick={() => pick(n.key)}
                        className="v-niche-chip"
                        data-active={active || undefined}
                        aria-pressed={active}
                      >
                        <Icon size={13} />
                        {n.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  {isCreator ? (
                    <>
                      <Segment
                        selectedKey={bandKey}
                        onSelectionChange={(k) => pickBand(k as BandKey)}
                        size="sm"
                        aria-label="Your audience size"
                      >
                        {BANDS.map((b, i) => (
                          <React.Fragment key={b.key}>
                            {i > 0 && <Segment.Separator />}
                            <Segment.Item id={b.key}>{b.label}</Segment.Item>
                          </React.Fragment>
                        ))}
                      </Segment>
                      <span className="v-caption v-quiet">followers</span>
                    </>
                  ) : (
                    <>
                      <Segment
                        selectedKey={budgetKey}
                        onSelectionChange={(k) => pickBudget(k as BudgetKey)}
                        size="sm"
                        aria-label="Your campaign budget"
                      >
                        {BUDGETS.map((b, i) => (
                          <React.Fragment key={b.key}>
                            {i > 0 && <Segment.Separator />}
                            <Segment.Item id={b.key}>{b.label}</Segment.Item>
                          </React.Fragment>
                        ))}
                      </Segment>
                      <span className="v-caption v-quiet">budget</span>
                    </>
                  )}
                </div>

                <div className="mt-4 v-body v-muted" aria-live="polite">
                  {isCreator ? (
                    <>
                      Typical {niche.label.toLowerCase()} brief at your size:{' '}
                      <span className="font-medium" style={{ color: 'var(--color-campaign-purple)' }}>
                        <CountUp value={estA.lo} />
                        {'–'}
                        <CountUp value={estA.hi} />
                      </span>{' '}
                      <span className="v-quiet">· estimate from live briefs</span>
                    </>
                  ) : (
                    <>
                      Typical {niche.label.toLowerCase()} brief at this budget:{' '}
                      <span className="font-medium" style={{ color: 'var(--color-campaign-purple)' }}>
                        <CountUp value={estA.lo} format={fmtCount} />
                        {'–'}
                        <CountUp value={estA.hi} format={fmtCount} /> applicants
                      </span>{' '}
                      · est. reach{' '}
                      <span className="font-medium" style={{ color: 'var(--color-campaign-purple)' }}>
                        <CountUp value={reach.lo} format={fmtReach} />
                        {'–'}
                        <CountUp value={reach.hi} format={fmtReach} />
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-8 flex items-center gap-2 flex-wrap">
                {token ? (
                  <Link to="/dashboard">
                    <Button variant="primary" size="lg" className="!rounded-xl">
                      Open dashboard <ArrowRight size={16} />
                    </Button>
                  </Link>
                ) : isCreator ? (
                  <>
                    <Link to="/register?role=creator">
                      <Button variant="primary" size="lg" className="!rounded-xl">
                        Start earning — free
                      </Button>
                    </Link>
                    <a href="/#campaigns">
                      <Button variant="ghost" size="lg" className="!rounded-xl">
                        Browse open briefs <ArrowRight size={14} />
                      </Button>
                    </a>
                  </>
                ) : (
                  <>
                    <Link to="/register?role=brand">
                      <Button variant="primary" size="lg" className="!rounded-xl">
                        Launch a campaign
                      </Button>
                    </Link>
                    <a href="/#console">
                      <Button variant="ghost" size="lg" className="!rounded-xl">
                        See the console <ArrowRight size={14} />
                      </Button>
                    </a>
                  </>
                )}
              </div>

              <div className="mt-5 flex items-center gap-4 text-[12px] v-quiet flex-wrap">
                {isCreator ? (
                  <>
                    <span>Free for creators</span>
                    <span aria-hidden>·</span>
                    <span>Payouts escrowed up front</span>
                    <span aria-hidden>·</span>
                    <span>No card required</span>
                  </>
                ) : (
                  <>
                    <span>AI-ranked applicants</span>
                    <span aria-hidden>·</span>
                    <span>Budget escrowed until delivery</span>
                    <span aria-hidden>·</span>
                    <span>Live performance tracking</span>
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ── Right: reactive phone ────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center lg:justify-end"
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            style={{ perspective: 1200 }}
          >
            <motion.div style={{ rotateX: srx, rotateY: sry }} className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, rotateY: -12, scale: 0.97 }}
                  animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                  exit={{ opacity: 0, rotateY: 12, scale: 0.97 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  {isCreator ? (
                    <CreatorPhone niche={niche} band={band} seq={seq} />
                  ) : (
                    <BrandPhone niche={niche} budget={budget} seq={seq} />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* floating platform chips */}
              <div
                className="absolute hidden sm:flex items-center justify-center v-card v-float-slow"
                style={{ left: -26, top: 84, width: 44, height: 44, borderRadius: 14, padding: 0, color: '#ff2d78' }}
                aria-hidden
              >
                <PlatformIcon platform="instagram" size={20} />
              </div>
              <div
                className="absolute hidden sm:flex items-center justify-center v-card v-float-fast"
                style={{ right: -24, top: 200, width: 44, height: 44, borderRadius: 14, padding: 0, color: 'var(--color-deep-navy)' }}
                aria-hidden
              >
                <PlatformIcon platform="tiktok" size={20} />
              </div>
              <div
                className="absolute hidden sm:flex items-center justify-center v-card v-float-slow"
                style={{ left: -18, bottom: 120, width: 44, height: 44, borderRadius: 14, padding: 0, color: '#ff0000', animationDelay: '2s' }}
                aria-hidden
              >
                <PlatformIcon platform="youtube" size={20} />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
