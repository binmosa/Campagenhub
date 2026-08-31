import React, { useState, useEffect } from 'react';
import { Bell, Check, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface Notification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  reference_id?: string;
  created_at: string;
}

export function NotificationsDropdown({ scrolled }: { scrolled?: boolean }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setIsOpen(false);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post(`/notifications/read-all`);
      setIsOpen(false);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await api.post(`/notifications/${notif.id}/read`);
        fetchNotifications();
      } catch(e){}
    }
    setIsOpen(false);
    if (notif.type === 'NEW_CAMPAIGN') {
      navigate('/campaigns');
    } else if (notif.type === 'NEW_MESSAGE') {
      navigate('/dashboard/messages');
    } else if (['invitation', 'payment_approval', 'negotiation_updated'].includes(notif.type)) {
      navigate(`/dashboard/invitations?inviteId=${notif.reference_id}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative h-10 w-10 flex items-center justify-center rounded-full transition-all active:scale-95 ${
          isOpen ? 'bg-surface-100 text-brand-600' 
          : (scrolled === false ? 'text-slate-200 hover:text-white border border-white/20 hover:bg-white/20' : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900')
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full animate-pulse ring-2 ring-surface" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 bg-surface border border-surface-200 rounded-2xl shadow-xl z-50 overflow-hidden">
            <div className="p-4 border-b border-surface-200 flex justify-between items-center bg-surface-50">
              <h3 className="font-semibold text-surface-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-surface-400 text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  No new notifications
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 border-b border-surface-100 hover:bg-surface-50 transition-colors cursor-pointer flex gap-3 ${
                      !notif.is_read ? 'bg-brand-50/50' : ''
                    }`}
                  >
                    <div className="mt-1">
                      {!notif.is_read ? (
                        <div className="w-2 h-2 bg-brand-500 rounded-full" />
                      ) : (
                        <Check className="w-3 h-3 text-surface-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed ${!notif.is_read ? 'text-surface-900 font-medium' : 'text-surface-600'}`}>
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-surface-400 font-medium">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
