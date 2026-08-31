import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle, Loader2 } from 'lucide-react';
import api from '../../lib/api';

interface Message {
  id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender: { id: string };
  receiver: { id: string };
}

interface ChatWindowProps {
  applicationId: string;
  currentUserId: string;
  onClose: () => void;
  brandName?: string;
  creatorName?: string;
  isInline?: boolean;
}

export function ChatWindow({ applicationId, currentUserId, onClose, brandName, creatorName, isInline = false }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/messages/application/${applicationId}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [applicationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const txt = newMessage;
    setNewMessage('');

    // Optimistic update
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: txt,
      created_at: new Date().toISOString(),
      is_read: false,
      sender: { id: currentUserId },
      receiver: { id: '' },
    }]);

    try {
      await api.post(`/messages/application/${applicationId}`, { content: txt });
      fetchMessages();
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const displayName = brandName || creatorName || 'Chat';

  const content = (
    <div
      className={`${isInline ? 'w-full h-full' : 'bg-surface w-full sm:w-[420px] h-[80vh] sm:h-[600px] sm:rounded-2xl rounded-t-2xl border border-surface-200 shadow-2xl'} flex flex-col overflow-hidden animate-fade-up`}
      onClick={e => e.stopPropagation()}
    >
      {/* Header - Only show if not inline or if needed */}
      {!isInline && (
        <div className="bg-surface border-b border-surface-200 px-5 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
              <MessageCircle size={16} className="text-brand-500" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-surface-900 truncate">{displayName}</h3>
              <span className="text-[10px] text-surface-400 font-medium uppercase tracking-wider">Direct Message</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-surface-50">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-brand-500" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-10">
            <MessageCircle size={32} className="mx-auto text-surface-300 mb-3" />
            <p className="text-surface-500 text-sm font-medium">No messages yet</p>
            <p className="text-surface-400 text-xs mt-1">Send a message to start the conversation!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender.id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed flex flex-col gap-1 ${
                  isMine
                    ? 'bg-brand-500 text-white rounded-br-sm shadow-sm'
                    : 'bg-white border border-surface-200 text-surface-900 rounded-bl-sm shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <span className={`text-[10px] self-end ${isMine ? 'text-brand-100' : 'text-surface-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-surface border-t border-surface-200 shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            autoFocus
            className="flex-1 bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-brand-500 hover:bg-brand-600 text-white p-2.5 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center shadow-sm"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );

  if (isInline) return content;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      {content}
    </div>
  );
}

