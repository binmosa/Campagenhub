import React from 'react';
import { motion } from 'motion/react';

/**
 * SceneBits — the tiny UI vocabulary the landing page uses to *draw* the
 * product inside a card: a soft panel, list rows, chips, brand marks, fit
 * bars, a count-up number. Shared by HowItWorks, Audiences and Stats so
 * every illustrated scene speaks the same visual language as the hero
 * phones.
 */
export const C = {
  purple: '#6c63ff',
  teal: '#00d4c7',
  navy: '#0b1736',
  success: '#16c784',
  warning: '#ffb547',
  blue: '#4f7cff',
};

export const Panel: React.FC<{ children: React.ReactNode; className?: string; minHeight?: number }> = ({ children, className = '', minHeight = 118 }) => (
  <div
    className={`rounded-xl p-3 flex flex-col gap-2 select-none ${className}`}
    style={{ background: 'linear-gradient(180deg, rgba(244,242,255,0.9) 0%, rgba(236,249,248,0.9) 100%)', border: '1px solid var(--color-cool-gray)', minHeight }}
    aria-hidden
  >
    {children}
  </div>
);

export const Row: React.FC<{ children: React.ReactNode; highlight?: boolean; delay?: number; dark?: boolean }> = ({ children, highlight, delay = 0, dark }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    className="rounded-lg px-2.5 py-2 flex items-center gap-2"
    style={
      dark
        ? { background: C.navy, color: '#fff' }
        : { background: '#fff', border: `1px solid ${highlight ? 'rgba(108,99,255,0.45)' : 'var(--color-cool-gray)'}`, boxShadow: highlight ? 'rgba(108,99,255,0.18) 0 6px 16px -8px' : undefined }
    }
  >
    {children}
  </motion.div>
);

export const Chip: React.FC<{ children: React.ReactNode; tone?: 'purple' | 'success' | 'warning' | 'muted' | 'blue' }> = ({ children, tone = 'purple' }) => {
  const map = {
    purple: { bg: 'rgba(108,99,255,0.10)', fg: C.purple },
    blue: { bg: 'rgba(79,124,255,0.12)', fg: '#2f5fe6' },
    success: { bg: 'rgba(22,199,132,0.12)', fg: '#0e9f6a' },
    warning: { bg: 'rgba(255,181,71,0.18)', fg: '#a86a00' },
    muted: { bg: 'var(--color-cool-gray)', fg: 'var(--color-graphite)' },
  }[tone];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium tabular-nums whitespace-nowrap" style={{ background: map.bg, color: map.fg, fontSize: 9.5 }}>
      {children}
    </span>
  );
};

export const Brand: React.FC<{ initials: string; color: string; size?: number }> = ({ initials, color, size = 24 }) => (
  <span className="inline-flex items-center justify-center rounded-md font-medium shrink-0" style={{ width: size, height: size, background: color, color: '#fff', fontSize: size * 0.35 }}>
    {initials}
  </span>
);

export const Txt: React.FC<{ children: React.ReactNode; sub?: boolean; className?: string }> = ({ children, sub, className = '' }) => (
  <span className={`truncate ${sub ? 'v-quiet' : 'v-ink font-medium'} ${className}`} style={{ fontSize: sub ? 9.5 : 11 }}>
    {children}
  </span>
);

export const Bar: React.FC<{ pct: number; delay?: number; color?: string }> = ({ pct, delay = 0, color }) => (
  <span className="block h-1 rounded-full overflow-hidden w-full" style={{ background: 'var(--color-cool-gray)' }}>
    <motion.span
      className="block h-1 rounded-full"
      initial={{ width: 0 }}
      whileInView={{ width: `${pct}%` }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: color || `linear-gradient(90deg, ${C.purple}, ${C.teal})` }}
    />
  </span>
);

/** A number that counts up when it scrolls into view. Honest: it only animates to the real value. */
export const CountUp: React.FC<{ value: number; format?: (n: number) => string; duration?: number; className?: string; style?: React.CSSProperties }> = ({ value, format, duration = 1.1, className, style }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / (duration * 1000));
        const eased = 1 - Math.pow(1 - p, 3);
        setN(value * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  const shown = Math.round(n);
  return (
    <span ref={ref} className={className} style={style}>
      {format ? format(shown) : shown.toLocaleString()}
    </span>
  );
};

/** Short sparkline path for a small SVG; `pts` are relative heights. */
export const sparkPath = (pts: number[], w = 120, h = 34, max = 60) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * w},${h - (p / max) * h}`).join(' ');
