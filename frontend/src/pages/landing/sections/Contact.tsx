import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Mail, MapPin, Phone, Send } from 'lucide-react';
import { Button } from '@heroui/react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import api from '../../../lib/api';
import type { LandingSettings } from '../useLandingData';

/**
 * Contact — split panel, HeroUI Buttons, brand-aligned.
 */
interface ContactProps {
  settings: LandingSettings;
}

const fieldClass = 'w-full px-3.5 py-2.5 rounded-lg v-body v-ink';
const fieldStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-cool-gray)',
  outline: 'none',
};

export const Contact: React.FC<ContactProps> = ({ settings }) => {
  const { t } = useTranslation();
  if (settings.contact_enabled === 'false') return null;

  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSent, setNewsletterSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/support/tickets', {
        sender_name: form.name,
        sender_email: form.email,
        message: form.message,
      });
      setSent(true);
      setForm({ name: '', email: '', message: '' });
      setTimeout(() => setSent(false), 5000);
    } catch {
      alert('Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterSent(true);
    setNewsletterEmail('');
    setTimeout(() => setNewsletterSent(false), 5000);
  };

  return (
    <section
      id="contact"
      className="px-6 lg:px-10 py-24 sm:py-28"
      style={{ borderTop: '1px solid var(--color-cool-gray)' }}
    >
      <div className="max-w-[1100px] mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16">
        <div>
          <span className="v-pill-quiet">{settings.contact_badge || t('contact.badge')}</span>
          <h2 className="mt-5 v-heading-xl">{settings.contact_title || t('contact.title')}</h2>
          <p className="mt-4 v-body-lg v-muted">
            {settings.contact_desc || t('contact.desc')}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder={t('contact.namePh')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldClass}
                style={fieldStyle}
              />
              <input
                type="email"
                required
                placeholder={t('contact.emailPh')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <textarea
              required
              placeholder={t('contact.messagePh')}
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className={`${fieldClass} resize-none`}
              style={fieldStyle}
            />
            <AnimatePresence>
              {sent && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg v-body font-medium"
                  style={{ background: 'var(--color-mint-whisper)', color: '#0b6e3e' }}
                >
                  <CheckCircle2 size={15} /> {t('contact.sent')}
                </motion.div>
              )}
            </AnimatePresence>
            <Button variant="primary" type="submit" isPending={submitting}>
              {t('contact.send')} <Send size={14} />
            </Button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
            {[
              { icon: Mail, value: settings.contact_email || 'info@campgainshub.com' },
              { icon: Phone, value: settings.contact_phone || '+1 (555) 123-4567' },
              { icon: MapPin, value: settings.contact_loc || 'San Francisco, CA' },
            ].map((row, i) => {
              const Icon = row.icon;
              return (
                <div key={i} className="flex items-center gap-3 v-body v-muted">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                    style={{
                      background: 'var(--color-soft-lavender)',
                      color: 'var(--color-campaign-purple)',
                    }}
                  >
                    <Icon size={14} strokeWidth={1.75} />
                  </span>
                  <span className="font-normal truncate v-ink">{row.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Newsletter — Deep Navy panel */}
        <div
          className="relative overflow-hidden rounded-2xl p-8 sm:p-10 flex flex-col"
          style={{
            background:
              'radial-gradient(120% 100% at 100% 0%, rgba(108,99,255,0.40) 0%, rgba(0,212,199,0.22) 60%, transparent 100%), var(--color-deep-navy)',
            color: '#fff',
          }}
        >
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full self-start"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 12,
              fontWeight: 400,
            }}
          >
            {settings.newsletter_badge || t('contact.nlBadge')}
          </span>
          <h3
            className="mt-5"
            style={{
              color: '#fff',
              fontSize: 28,
              lineHeight: 1.15,
              letterSpacing: '-0.022em',
              fontWeight: 500,
            }}
          >
            {settings.newsletter_title || t('contact.nlTitle')}
          </h3>
          <p
            className="mt-3"
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 15,
              lineHeight: 1.55,
              letterSpacing: '-0.012em',
            }}
          >
            {settings.newsletter_desc || t('contact.nlDesc')}
          </p>

          <form onSubmit={submitNewsletter} className="mt-6 flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              placeholder={t('contact.nlEmailPh')}
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: '#fff',
                outline: 'none',
                fontSize: 14,
              }}
            />
            <Button variant="primary" type="submit">
              {settings.newsletter_btn || t('contact.nlBtn')} <ArrowRight size={14} />
            </Button>
          </form>

          <AnimatePresence>
            {newsletterSent && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg"
                style={{ background: 'rgba(22,199,132,0.14)', color: '#16c784', fontSize: 13, fontWeight: 500 }}
              >
                <CheckCircle2 size={14} /> {t('contact.nlSubscribed')}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-4" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            {t('contact.nlPrivacy')}
          </p>

          <div
            className="grid grid-cols-3 gap-6 mt-8 pt-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            {[
              { val: settings.newsletter_stats_1 || '5K+', lbl: settings.newsletter_lbl_1 || t('contact.nlLbl1') },
              { val: settings.newsletter_stats_2 || t('contact.nlWeekly'), lbl: settings.newsletter_lbl_2 || t('contact.nlLbl2') },
              { val: settings.newsletter_stats_3 || t('contact.nlFree'), lbl: settings.newsletter_lbl_3 || t('contact.nlLbl3') },
            ].map((s) => (
              <div key={s.lbl} className="text-center">
                <div
                  className="tabular-nums"
                  style={{ color: '#fff', fontSize: 22, letterSpacing: '-0.02em', fontWeight: 500 }}
                >
                  {s.val}
                </div>
                <div className="mt-1" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                  {s.lbl}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
