import React, { useEffect, useRef, useState } from 'react';
import { Quote, Star } from 'lucide-react';
import type { EmblaCarouselType } from 'embla-carousel';
import { Avatar, Button, Chip, Modal } from '@heroui/react';
import { Carousel } from '@heroui-pro/react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import api from '../../../lib/api';
import type { LandingSettings, Review } from '../useLandingData';
import { MOCK_TESTIMONIALS } from '../copy';

/**
 * Testimonials — HeroUI Pro Carousel of richer testimonial slides.
 *
 *   Auto-advances every 6s, pauses on hover, dot navigation.
 *   Each slide shows quote + verified author + result chip + brand badge.
 */
interface TestimonialsProps {
  settings: LandingSettings;
  reviews: Review[];
  onReviewSubmitted: () => void;
}

type Slide = {
  quote: string;
  name: string;
  handle: string;
  role: string;
  initial: string;
  avatarColor: string;
  brand: string;
  brandColor: string;
  rating: number;
  result?: { label: string; tone: 'success' | 'accent' | 'warning' };
};

const AVATAR_COLORS = ['#6c63ff', '#00d4c7', '#ffb547', '#4f7cff', '#ff5a5f', '#7b61ff'];
const BRAND_COLORS = ['#00d4c7', '#6c63ff', '#4f7cff', '#7b61ff', '#ffb547', '#16c784'];

const HANDLES = ['@ahmed.fm', '@linaeats', '@omarcreates', '@studioveda', '@code.with.ada', '@nomad.audio'];

/* Rich mock slides — used when admin testimonials_mock_enabled is true. */
const RICH_SLIDES: Slide[] = [
  {
    quote:
      "We launched a UGC challenge on a Friday and had 38 creator applications by Monday morning. The match quality was uncanny — every single applicant fit the brief.",
    name: 'Ahmed K.',
    handle: '@ahmed.fm',
    role: 'VP of Marketing',
    initial: 'A',
    avatarColor: '#6c63ff',
    brand: 'Glow Athletic',
    brandColor: '#00d4c7',
    rating: 5,
    result: { label: '+38% engagement rate', tone: 'success' },
  },
  {
    quote:
      "I used to chase three brands at once for invoices. Now my payouts settle the day my post ships, and the dashboard shows me my next collab before I close the app.",
    name: 'Lina M.',
    handle: '@linaeats',
    role: 'Content Creator · 2.5M',
    initial: 'L',
    avatarColor: '#00d4c7',
    brand: 'Aurora Skin',
    brandColor: '#ff5a5f',
    rating: 5,
    result: { label: '$120k attributed sales', tone: 'success' },
  },
  {
    quote:
      "We needed a SOC-2 compliant platform that could handle our scale. Campgains Hub completely revolutionized our discovery workflow — we shortlist in 20 minutes now.",
    name: 'Omar S.',
    handle: '@omarcreates',
    role: 'Director of Digital',
    initial: 'O',
    avatarColor: '#4f7cff',
    brand: 'Nomad Audio',
    brandColor: '#7b61ff',
    rating: 5,
    result: { label: '12k new followers · 14d', tone: 'accent' },
  },
  {
    quote:
      "The AI brief shortcut wrote our holiday push in four seconds. We tweaked one line and shipped it the same day — the creators applying clearly understood what we wanted.",
    name: 'Maya R.',
    handle: '@studioveda',
    role: 'Brand Lead',
    initial: 'M',
    avatarColor: '#ffb547',
    brand: 'Mesa Coffee',
    brandColor: '#6c63ff',
    rating: 5,
    result: { label: '4.2× ROAS this quarter', tone: 'success' },
  },
  {
    quote:
      "Managing my roster used to mean four spreadsheets and a calendar. Now every creator under me has their pipeline, deadlines, and commissions in one inbox. I just collect.",
    name: 'Yara H.',
    handle: '@yaramanages',
    role: 'Talent Manager',
    initial: 'Y',
    avatarColor: '#7b61ff',
    brand: 'Loom Talent',
    brandColor: '#00d4c7',
    rating: 5,
    result: { label: '+27% roster earnings YoY', tone: 'success' },
  },
];

const Stars: React.FC<{ rating: number; size?: number }> = ({ rating, size = 13 }) => (
  <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={size}
        style={{
          color: n <= rating ? '#ffb547' : 'var(--color-cool-gray)',
          fill: n <= rating ? '#ffb547' : 'transparent',
        }}
      />
    ))}
  </div>
);

const SlideCard: React.FC<{ slide: Slide }> = ({ slide }) => (
  <div className="relative w-full">
    <div
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: 'var(--color-paper)',
        border: '1px solid var(--color-cool-gray)',
        padding: '36px 28px 32px',
        boxShadow:
          'rgba(11,23,54,0.04) 0px 1px 2px 0px, rgba(11,23,54,0.06) 0px 12px 32px -12px',
      }}
    >
      {/* Decorative quote mark */}
      <Quote
        aria-hidden
        size={64}
        strokeWidth={1.25}
        className="absolute"
        style={{
          top: 18,
          right: 22,
          color: 'var(--color-soft-lavender)',
          fill: 'var(--color-soft-lavender)',
        }}
      />

      {/* Brand chip top-left */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg font-medium"
            style={{ background: slide.brandColor, color: '#fff', fontSize: 11 }}
          >
            {slide.brand.slice(0, 2).toUpperCase()}
          </span>
          <span className="v-body v-ink font-medium" style={{ fontSize: 13 }}>
            {slide.brand}
          </span>
        </div>
        <Stars rating={slide.rating} />
      </div>

      {/* Quote */}
      <p
        className="v-ink relative"
        style={{
          fontSize: 18,
          lineHeight: 1.55,
          letterSpacing: '-0.014em',
          fontWeight: 400,
        }}
      >
        "{slide.quote}"
      </p>

      {/* Author + result */}
      <div
        className="mt-7 pt-5 flex items-center gap-3 flex-wrap"
        style={{ borderTop: '1px solid var(--color-cool-gray)' }}
      >
        <Avatar size="sm">
          <Avatar.Fallback
            style={{
              background: slide.avatarColor,
              color: '#fff',
              fontWeight: 500,
            }}
          >
            {slide.initial}
          </Avatar.Fallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="v-body v-ink font-medium truncate">{slide.name}</div>
          <div className="v-caption v-quiet truncate">
            {slide.handle} · {slide.role}
          </div>
        </div>
        {slide.result && (
          <Chip color={slide.result.tone} variant="soft" size="sm">
            {slide.result.label}
          </Chip>
        )}
      </div>
    </div>
  </div>
);

export const Testimonials: React.FC<TestimonialsProps> = ({
  settings,
  reviews,
  onReviewSubmitted,
}) => {
  const { t } = useTranslation();
  if (settings.testimonials_enabled === 'false') return null;

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const useReal = reviews.length > 0;
  const useMocks = !useReal && settings.testimonials_mock_enabled !== 'false';

  const slides: Slide[] = useReal
    ? reviews.slice(0, 6).map((r, i) => ({
        quote: r.comment || '',
        name: r.user_name || 'Anonymous',
        handle: HANDLES[i % HANDLES.length],
        role: r.user_role || 'Member',
        initial: (r.user_name?.[0] || 'U').toUpperCase(),
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        brand: 'Campgains Hub',
        brandColor: BRAND_COLORS[i % BRAND_COLORS.length],
        rating: r.rating ?? 5,
      }))
    : useMocks
    ? RICH_SLIDES.concat(
        MOCK_TESTIMONIALS.slice(0, 3).map((t, i) => ({
          quote: t.quote,
          name: t.name,
          handle: HANDLES[(i + RICH_SLIDES.length) % HANDLES.length],
          role: `${t.role} · ${t.affiliation}`,
          initial: t.name[0],
          avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
          brand: t.affiliation,
          brandColor: BRAND_COLORS[i % BRAND_COLORS.length],
          rating: 5,
        }))
      )
    : [];

  /* Auto-advance via Embla API exposed by HeroUI Pro Carousel */
  const [carouselApi, setCarouselApi] = useState<EmblaCarouselType | null>(null);
  const hoveredRef = useRef(false);

  useEffect(() => {
    if (!carouselApi || slides.length <= 1) return;
    const id = window.setInterval(() => {
      if (!hoveredRef.current) carouselApi.scrollNext();
    }, 6500);
    return () => window.clearInterval(id);
  }, [carouselApi, slides.length]);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ user_name: '', comment: '', rating: 5 });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/reviews', form);
      setOpen(false);
      setForm({ user_name: '', comment: '', rating: 5 });
      onReviewSubmitted();
    } catch {
      alert('Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="testimonials"
      className="px-6 lg:px-10 py-24 sm:py-28"
      style={{ borderTop: '1px solid var(--color-cool-gray)' }}
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-12">
          <span className="v-pill-quiet">{t('testi.pill')}</span>
          <h2 className="mt-5 v-heading-xl">
            {t('testi.title')}
          </h2>
          <p className="mt-4 v-body-lg v-muted">
            {t('testi.desc')}
          </p>
          {token && (
            <div className="mt-6">
              <Button variant="outline" size="sm" className="!rounded-xl" onPress={() => setOpen(true)}>
                <Star size={14} /> {t('testi.leaveReview')}
              </Button>
            </div>
          )}
        </div>

        {slides.length === 0 ? (
          <p className="text-center v-body v-muted">No reviews yet — be the first.</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={() => { hoveredRef.current = true; }}
            onMouseLeave={() => { hoveredRef.current = false; }}
            className="max-w-[760px] mx-auto"
          >
            <Carousel opts={{ loop: true, align: 'start' }} setApi={setCarouselApi}>
              <Carousel.Content>
                {slides.map((s, i) => (
                  <Carousel.Item key={`${s.name}-${i}`}>
                    <SlideCard slide={s} />
                  </Carousel.Item>
                ))}
              </Carousel.Content>
              <div className="mt-7 flex items-center justify-between gap-4">
                <Carousel.Previous />
                <Carousel.Dots />
                <Carousel.Next />
              </div>
            </Carousel>
          </motion.div>
        )}
      </div>

      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{t('testi.leaveReview')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form id="hero-review-form" onSubmit={submit} className="space-y-4">
                <input
                  className="w-full px-3.5 py-2.5 rounded-lg v-body v-ink"
                  style={{ background: '#fff', border: '1px solid var(--color-cool-gray)', outline: 'none' }}
                  placeholder={t('contact.namePh')}
                  value={form.user_name}
                  onChange={(e) => setForm({ ...form, user_name: e.target.value })}
                />
                <div>
                  <label className="v-caption v-quiet font-medium uppercase tracking-wider">
                    {t('testi.rating')}
                  </label>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, rating: s })}
                        aria-label={`${s} star`}
                        className="p-1"
                      >
                        <Star
                          size={22}
                          style={{
                            color: s <= form.rating ? '#ffb547' : 'var(--color-cool-gray)',
                            fill: s <= form.rating ? '#ffb547' : 'transparent',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  required
                  placeholder={t('testi.sharePh')}
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg v-body v-ink h-24 resize-none"
                  style={{ background: '#fff', border: '1px solid var(--color-cool-gray)', outline: 'none' }}
                />
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setOpen(false)}>{t('testi.cancel')}</Button>
              <Button
                variant="primary"
                type="submit"
                form="hero-review-form"
                isPending={submitting}
              >
                {t('testi.submit')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
};

export default Testimonials;
