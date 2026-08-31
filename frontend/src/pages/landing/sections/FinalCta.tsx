import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Star, Zap } from 'lucide-react';
import { Button } from '@heroui/react';
import { motion } from 'motion/react';
import type { LandingSettings } from '../useLandingData';

/**
 * FinalCta — dark Deep-Navy panel with the signature gradient wash.
 */
interface FinalCtaProps {
  settings: LandingSettings;
}

const PROOF = [
  { icon: Star, label: '4.9 · 2.4K reviews', meta: 'G2 · Capterra' },
  { icon: Zap, label: 'Launch in 60 seconds', meta: 'free forever to start' },
  { icon: ShieldCheck, label: 'Pay on delivery', meta: 'funds escrow until ship' },
];

export const FinalCta: React.FC<FinalCtaProps> = ({ settings }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  return (
    <section className="px-6 lg:px-10 py-20 sm:py-24">
      <div className="max-w-[1100px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[28px] text-center"
          style={{
            background:
              'radial-gradient(110% 90% at 80% 0%, rgba(108,99,255,0.55) 0%, rgba(79,124,255,0.30) 40%, rgba(0,212,199,0.22) 75%, transparent 100%), #0B1736',
            padding: '64px 24px',
          }}
        >
          {/* Decorative grid */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage:
                'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
            }}
          />

          <div className="relative max-w-[720px] mx-auto">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '-0.012em',
              }}
            >
              Free to join · pay only when work ships
            </span>

            <h2
              className="mt-7"
              data-weight="display"
              style={{
                color: '#fff',
                fontSize: 'clamp(2rem, 5vw, 3.25rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                fontWeight: 500,
              }}
            >
              {settings.cta_title ? (
                settings.cta_title
              ) : (
                <>
                  Your next great campaign starts{' '}
                  <span
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, #ffffff 0%, #c8e1ff 50%, #00d4c7 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    today.
                  </span>
                </>
              )}
            </h2>

            <p
              className="mt-6 mx-auto"
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 17,
                lineHeight: 1.55,
                letterSpacing: '-0.012em',
                maxWidth: 560,
              }}
            >
              {settings.cta_desc ||
                'Join 12,847 creators and 520 brands building the next wave of culture. Launch in minutes — no contracts, no retainers, no surprises.'}
            </p>

            <div className="mt-9 flex items-center justify-center gap-2 flex-wrap">
              {token ? (
                <Link to="/dashboard">
                  <Button variant="primary" size="lg" className="!rounded-xl">
                    Open dashboard <ArrowRight size={16} />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register">
                    <Button variant="primary" size="lg" className="!rounded-xl">
                      Get started — free
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button
                      variant="ghost"
                      size="lg"
                      className="!rounded-xl"
                      style={{
                        color: '#fff',
                        background: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      Sign in
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-[640px] mx-auto">
              {PROOF.map((p, i) => {
                const Icon = p.icon;
                return (
                  <motion.div
                    key={p.label}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(108,99,255,0.35) 0%, rgba(0,212,199,0.35) 100%)',
                        color: '#fff',
                      }}
                    >
                      <Icon size={14} strokeWidth={2} />
                    </span>
                    <div className="text-left min-w-0">
                      <div
                        className="font-medium truncate"
                        style={{ color: '#fff', fontSize: 13, letterSpacing: '-0.012em' }}
                      >
                        {p.label}
                      </div>
                      <div
                        className="truncate"
                        style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5 }}
                      >
                        {p.meta}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCta;
