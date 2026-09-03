import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Check, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { postedLabel } from '../../lib/campaignFormat';

interface Notification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  reference_id?: string;
  created_at: string;
}

/** Where a notification takes you when clicked. Types come from several
 *  backend modules with mixed casing, so match loosely. */
const targetFor = (n: Notification): string => {
  const type = (n.type || '').toLowerCase();
  if (type === 'new_campaign') return '/campaigns';
  if (type === 'new_message') return '/dashboard/messages';
  if (['invitation', 'payment_approval', 'negotiation_updated', 'invitation_accepted', 'invitation_declined'].includes(type))
    return `/dashboard/invitations?inviteId=${n.reference_id || ''}`;
  if (type.startsWith('application_')) return '/dashboard/applications';
  if (type.startsWith('contract_')) return '/dashboard/contracts';
  if (type.includes('payment') || type.includes('payout')) return '/dashboard/payments';
  return '/dashboard';
};

/** `scrolled` is accepted for the legacy UserNav caller and ignored — the
 *  bell now has one look everywhere. */
export function NotificationsDropdown(_props: { scrolled?: boolean } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* stay quiet — the bell just shows no badge */
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  /* Click-outside + Esc */
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* ignore */
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
      api.post(`/notifications/${notif.id}/read`).catch(() => {});
    }
    setIsOpen(false);
    navigate(targetFor(notif));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={t('notif.title')}
        aria-expanded={isOpen}
        className="v-shell-btn"
        data-active={isOpen || undefined}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="v-shell-badge" aria-label={`${unreadCount} unread`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 v-facet-panel !p-0 overflow-hidden" style={{ width: 340 }}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-border">
            <span className="v-ink font-medium" style={{ fontSize: 14 }}>
              {t('notif.title')}
              {unreadCount > 0 && (
                <span className="v-quiet font-normal" style={{ fontSize: 12 }}>
                  {' '}
                  · {t('notif.unreadN', { n: unreadCount })}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="v-caption inline-flex items-center gap-1 hover:underline"
                style={{ fontSize: 11.5, color: 'var(--color-campaign-purple)' }}
              >
                <Check size={11} /> {t('notif.markAll')}
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-3">
                <div className="v-empty" data-size="sm" data-tone="neutral">
                  <span className="v-empty-orb" aria-hidden>
                    <span>
                      <BellOff size={16} />
                    </span>
                  </span>
                  <div className="v-empty-title">{t('notif.emptyTitle')}</div>
                  <p className="v-empty-desc">{t('notif.emptyDesc')}</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notif) => (
                  <li key={notif.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      className="w-full text-left px-4 py-3 flex gap-3 transition-colors"
                      style={{ background: notif.is_read ? 'transparent' : 'rgba(244,242,255,0.6)' }}
                    >
                      <span className="mt-1.5 shrink-0">
                        {notif.is_read ? (
                          <span className="block h-2 w-2 rounded-full" style={{ background: 'var(--color-fog)' }} />
                        ) : (
                          <span className="block h-2 w-2 rounded-full" style={{ background: 'var(--gradient-signature)' }} />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block v-body ${notif.is_read ? 'v-muted' : 'v-ink font-medium'}`}
                          style={{ fontSize: 13, lineHeight: 1.45 }}
                        >
                          {notif.message}
                        </span>
                        <span className="mt-1 inline-flex items-center gap-1 v-caption v-quiet" style={{ fontSize: 11 }}>
                          <Clock size={10} />
                          {postedLabel(notif.created_at) || new Date(notif.created_at).toLocaleDateString()}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
