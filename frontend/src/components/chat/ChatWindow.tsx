import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { accentFor } from '../../pages/talent/shared';
import { EmptyPanel } from '../common/EmptyPanel';
import { Notice } from '../common/Notice';

/**
 * ChatWindow — the per-application direct message thread.
 *
 * Renders as a HeroUI modal (default) or inline inside another surface
 * (`isInline`, used by the negotiation modal). Polls every 5s, sends
 * optimistically and rolls back on failure, groups bubbles by day.
 */
interface Message {
  id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender: { id: string };
  receiver: { id: string };
  pending?: boolean;
}

interface ChatWindowProps {
  applicationId: string;
  currentUserId: string;
  onClose: () => void;
  brandName?: string;
  creatorName?: string;
  /** Counterparty avatar / logo, shown in the story ring. */
  avatarUrl?: string;
  /** Context line under the name (e.g. the campaign title). */
  subtitle?: string;
  isInline?: boolean;
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const dayLabel = (iso: string, today: string, yesterday: string) => {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (dayKey(iso) === dayKey(now.toISOString())) return today;
  if (dayKey(iso) === dayKey(y.toISOString())) return yesterday;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function ChatWindow({
  applicationId,
  currentUserId,
  onClose,
  brandName,
  creatorName,
  avatarUrl,
  subtitle,
  isInline = false,
}: ChatWindowProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/messages/application/${applicationId}`);
      setMessages((prev) => {
        const server: Message[] = Array.isArray(res.data) ? res.data : [];
        // Keep optimistic bubbles that the server hasn't echoed yet.
        const pending = prev.filter((m) => m.pending && !server.some((s) => s.content === m.content && s.sender?.id === currentUserId));
        return [...server, ...pending];
      });
      setError('');
    } catch {
      if (loading) setError(t('chat.errLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const send = async () => {
    const txt = newMessage.trim();
    if (!txt || sending) return;
    setNewMessage('');
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, content: txt, created_at: new Date().toISOString(), is_read: false, sender: { id: currentUserId }, receiver: { id: '' }, pending: true },
    ]);
    try {
      await api.post(`/messages/application/${applicationId}`, { content: txt });
      await fetchMessages();
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(txt);
      setError(e?.response?.data?.message || t('chat.errSend'));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const displayName = creatorName || brandName || t('chat.title');
  const accent = accentFor(displayName);
  const today = t('chat.today');
  const yesterday = t('chat.yesterday');

  let lastDay = '';
  const thread = (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 v-bg-dawn-subtle" style={{ minHeight: 0 }}>
      {loading ? (
        <div className="space-y-3" aria-hidden>
          <div className="v-skel h-10 w-2/3" />
          <div className="v-skel h-10 w-1/2 ml-auto" />
          <div className="v-skel h-14 w-3/4" />
        </div>
      ) : messages.length === 0 ? (
        <EmptyPanel size="sm" icon={<MessageCircle size={18} />} title={t('chat.emptyTitle')} description={t('chat.emptyDesc', { name: displayName })} />
      ) : (
        messages.map((msg) => {
          const mine = msg.sender?.id === currentUserId;
          const key = dayKey(msg.created_at);
          const showDay = key !== lastDay;
          lastDay = key;
          return (
            <React.Fragment key={msg.id}>
              {showDay && (
                <div className="flex items-center gap-2 py-1" aria-hidden>
                  <span className="h-px flex-1" style={{ background: 'var(--color-cool-gray)' }} />
                  <span className="v-caption v-quiet" style={{ fontSize: 10.5 }}>{dayLabel(msg.created_at, today, yesterday)}</span>
                  <span className="h-px flex-1" style={{ background: 'var(--color-cool-gray)' }} />
                </div>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[82%] px-3.5 py-2 flex flex-col gap-0.5"
                  style={
                    mine
                      ? { background: 'var(--gradient-signature)', color: '#fff', borderRadius: '16px 16px 4px 16px', opacity: msg.pending ? 0.7 : 1, boxShadow: 'rgba(108,99,255,0.25) 0 6px 14px -8px' }
                      : { background: 'var(--color-paper)', color: 'var(--color-deep-navy)', border: '1px solid var(--color-cool-gray)', borderRadius: '16px 16px 16px 4px' }
                  }
                >
                  <p className="whitespace-pre-wrap v-body" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{msg.content}</p>
                  <span className="self-end tabular-nums" style={{ fontSize: 10, opacity: 0.7 }}>
                    {msg.pending ? t('chat.sending') : new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })
      )}
      <div ref={endRef} />
    </div>
  );

  const composer = (
    <div className="px-3 py-3 border-t border-border shrink-0" style={{ background: 'var(--color-paper)' }}>
      {error && (
        <Notice tone="error" className="mb-2" onDismiss={() => setError('')}>
          {error}
        </Notice>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t('chat.placeholder')}
          rows={1}
          autoFocus
          className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm v-ink outline-none"
          style={{ background: 'var(--color-paper)', border: '1px solid var(--color-cool-gray)', maxHeight: 120 }}
          aria-label={t('chat.placeholder')}
        />
        <Button variant="primary" isIconOnly aria-label={t('chat.send')} onPress={send} isDisabled={!newMessage.trim()} isPending={sending}>
          <Send size={15} />
        </Button>
      </div>
      <p className="v-caption v-quiet mt-1.5" style={{ fontSize: 10.5 }}>{t('chat.hint')}</p>
    </div>
  );

  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <span className="v-story-ring" style={{ padding: 2 }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-9 w-9 object-cover" />
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center text-sm font-medium text-white" style={{ background: accent.from }}>
            {displayName[0]?.toUpperCase() || '?'}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <div className="v-ink font-medium truncate" style={{ fontSize: 15 }}>{displayName}</div>
        <div className="v-caption v-quiet truncate" style={{ fontSize: 11 }}>{subtitle || t('chat.subtitle')}</div>
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className="flex flex-col h-full w-full rounded-xl overflow-hidden v-hairline">
        {thread}
        {composer}
      </div>
    );
  }

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="!max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{header}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="!p-0">
              <div className="flex flex-col" style={{ height: 'min(60vh, 560px)' }}>
                {thread}
                {composer}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default ChatWindow;
