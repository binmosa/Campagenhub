import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Check, Copy, ExternalLink, Link2, MessageCircle, Radio, Send, Sparkles, Users } from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api, { serverOrigin } from '../../lib/api';
import { toast } from '../../lib/toast';
import { buildTelegramLink, getTelegramBotUsername } from '../../lib/telegram';
import { fieldClass } from '../talent/shared';
import { MetricCard, PageShell } from '../../components/ui';
import { EmptyPanel } from '../../components/common/EmptyPanel';
import { Field, Panel } from './shared';

/**
 * TelegramStudio — the bot's control room: how many people are reachable,
 * a broadcast composer with a live preview, and the hooks (webhook URL,
 * bot link) you need when wiring BotFather.
 */
type Target = 'all' | 'creators' | 'brands';
const MAX = 4096;

const TelegramStudio: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{ total_subscribers: number; active_today: number } | null>(null);
  const [botUsername, setBotUsername] = useState<string>('');
  const [target, setTarget] = useState<Target>('all');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<{ target: Target; at: Date } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.get('/telegram/admin/stats').then((r) => setStats(r.data)).catch(() => setStats({ total_subscribers: 0, active_today: 0 }));
    getTelegramBotUsername().then(setBotUsername).catch(() => setBotUsername(''));
  }, []);

  const webhookUrl = `${serverOrigin}/telegram/webhook`;
  const botLink = botUsername ? buildTelegramLink(botUsername) : '';
  const configured = !!botUsername;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      toast.success(t('adm.tg.copied'));
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post('/telegram/admin/broadcast', { message, target });
      toast.success(t('adm.tg.sent', { audience: t(`adm.tg.audience.${target}`) }));
      setLastSent({ target, at: new Date() });
      setMessage('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('adm.tg.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  /* Very small Telegram-markdown preview: **bold** _italic_ `code`. */
  const preview = useMemo(() => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc(message)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  }, [message]);

  const kpis = (
    <div className="grid grid-cols-3 gap-3">
      <MetricCard label={t('adm.tg.kpiSubs')} value={stats ? stats.total_subscribers : '…'} hint={t('adm.tg.kpiSubsHint')} icon={Users} iconStatus={stats?.total_subscribers ? 'success' : undefined} />
      <MetricCard label={t('adm.tg.kpiActive')} value={stats ? stats.active_today : '…'} hint={t('adm.tg.kpiActiveHint')} icon={Activity} />
      <MetricCard
        label={t('adm.tg.kpiBot')}
        value={
          <span className="inline-flex items-center gap-2" style={{ fontSize: 18 }}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${configured ? 'v-pulse-dot' : ''}`} style={{ background: configured ? '#16c784' : '#ffb547' }} />
            {configured ? t('adm.tg.botOn') : t('adm.tg.botOff')}
          </span>
        }
        hint={configured ? `@${botUsername}` : t('adm.tg.botOffHint')}
        icon={Bot}
        iconStatus={configured ? 'success' : 'warning'}
      />
    </div>
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={t('adm.tg.title')}
      titleAccent={t('adm.tg.titleAccent')}
      description={t('adm.tg.desc')}
      icon={<MessageCircle size={18} />}
      actions={
        botLink ? (
          <a href={botLink} target="_blank" rel="noreferrer">
            <Button variant="tertiary" size="md"><ExternalLink size={13} /> {t('adm.tg.openBot')}</Button>
          </a>
        ) : undefined
      }
      stats={kpis}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Panel icon={<Send size={15} />} title={t('adm.tg.broadcast')} desc={t('adm.tg.broadcastDesc')}>
            {stats && stats.total_subscribers === 0 ? (
              <EmptyPanel size="sm" icon={<Radio size={18} />} title={t('adm.tg.noSubsTitle')} description={t('adm.tg.noSubsDesc')} className="mb-4" />
            ) : null}
            <form onSubmit={send} className="space-y-4">
              <div>
                <span className="v-caption v-ink font-medium block mb-1.5" style={{ fontSize: 12 }}>{t('adm.tg.target')}</span>
                <div className="flex items-center gap-1.5 flex-wrap" role="radiogroup" aria-label={t('adm.tg.target')}>
                  {(['all', 'creators', 'brands'] as Target[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={target === k} className="v-niche-chip" data-active={target === k || undefined} onClick={() => setTarget(k)}>
                      {t(`adm.tg.audience.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
              <Field label={t('adm.tg.message')} hint={`${message.length}/${MAX}`}>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                  rows={6}
                  required
                  placeholder={t('adm.tg.messagePh')}
                  className={`${fieldClass} resize-y`}
                />
              </Field>
              <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('adm.tg.markdownHint')}</p>
              <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                <div>
                  {lastSent && (
                    <Chip color="success" variant="soft" size="sm">
                      <Check size={11} />
                      <Chip.Label>{t('adm.tg.lastSent', { audience: t(`adm.tg.audience.${lastSent.target}`), when: lastSent.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</Chip.Label>
                    </Chip>
                  )}
                </div>
                <Button type="submit" variant="primary" isPending={sending} isDisabled={!message.trim()}>
                  <Send size={13} /> {t('adm.tg.send')}
                </Button>
              </div>
            </form>
          </Panel>
        </div>

        <aside className="space-y-5">
          {/* Live preview */}
          <Panel icon={<Sparkles size={15} />} title={t('adm.tg.preview')} desc={t('adm.tg.previewDesc')}>
            <div className="rounded-2xl p-3" style={{ background: '#e7f0f9' }}>
              <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-white v-hairline" style={{ maxWidth: 300 }}>
                <div className="v-caption font-medium mb-0.5" style={{ fontSize: 11.5, color: '#2a9df4' }}>Campgains Hub</div>
                {message.trim() ? (
                  <div className="v-ink" style={{ fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: preview }} />
                ) : (
                  <div className="v-quiet" style={{ fontSize: 13 }}>{t('adm.tg.previewEmpty')}</div>
                )}
                <div className="text-right v-caption v-quiet mt-1" style={{ fontSize: 10 }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          </Panel>

          {/* Hooks */}
          <Panel icon={<Link2 size={15} />} title={t('adm.tg.hooks')} desc={t('adm.tg.hooksDesc')}>
            <div className="space-y-3">
              <div>
                <span className="v-caption v-quiet font-medium uppercase tracking-wider block mb-1" style={{ fontSize: 10.5 }}>{t('adm.tg.webhook')}</span>
                <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 v-hairline" style={{ background: 'var(--color-cool-gray)' }}>
                  <code className="truncate flex-1" style={{ fontSize: 11.5, color: 'var(--color-campaign-purple)' }}>{webhookUrl}</code>
                  <Button variant="ghost" size="sm" isIconOnly aria-label={t('adm.tg.copyWebhook')} onPress={() => copy(webhookUrl, 'hook')}>
                    {copied === 'hook' ? <Check size={13} /> : <Copy size={13} />}
                  </Button>
                </div>
              </div>
              <div>
                <span className="v-caption v-quiet font-medium uppercase tracking-wider block mb-1" style={{ fontSize: 10.5 }}>{t('adm.tg.botLink')}</span>
                {botLink ? (
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 v-hairline" style={{ background: 'var(--color-cool-gray)' }}>
                    <code className="truncate flex-1" style={{ fontSize: 11.5, color: 'var(--color-campaign-purple)' }}>{botLink}</code>
                    <Button variant="ghost" size="sm" isIconOnly aria-label={t('adm.tg.copyBotLink')} onPress={() => copy(botLink, 'bot')}>
                      {copied === 'bot' ? <Check size={13} /> : <Copy size={13} />}
                    </Button>
                  </div>
                ) : (
                  <p className="v-caption v-quiet" style={{ fontSize: 12 }}>{t('adm.tg.botOffHint')}</p>
                )}
              </div>
              <p className="v-caption v-quiet" style={{ fontSize: 11.5 }}>{t('adm.tg.howUsed')}</p>
            </div>
          </Panel>
        </aside>
      </div>
    </PageShell>
  );
};

export default TelegramStudio;
