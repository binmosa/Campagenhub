import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Smile,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Separator,
} from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import api from '../lib/api';
import { PageShell } from '../components/ui';

/**
 * Messages — direct messaging shell.
 *
 *   Left column  — searchable conversation list (HeroUI Avatar + Chip for unread).
 *   Right column — active thread with optional "active offer" header.
 *
 * Conversations poll every 10s; the active thread polls every 5s. Both are
 * preserved from the prior implementation.
 */

interface Conversation {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  lastMessage?: string;
  unread?: number;
  time?: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender: { id: string };
  receiver: { id: string };
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  outline: 'none',
};

const Messages: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeOffer, setActiveOffer] = useState<any>(null);
  const [searchParams] = useSearchParams();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const role = (localStorage.getItem('role') || 'creator').toLowerCase();

  /* Resolve incoming deep-link target convo + offer context */
  useEffect(() => {
    const newId = searchParams.get('newId');
    const newName = searchParams.get('name') || 'New message…';
    const offerJson = searchParams.get('offer');
    if (newId) setActiveConvo({ id: newId, name: newName, email: '' });
    if (offerJson) {
      try {
        setActiveOffer(JSON.parse(offerJson));
      } catch {
        /* ignore */
      }
    }
  }, [searchParams]);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setCurrentUserId(res.data.userId))
      .catch(() => {});
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConversations(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery.length >= 2) {
        api.get(`/users/search?q=${searchQuery}`).then((res) => {
          setSearchResults(res.data || []);
        });
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchMessages = async (userId: string) => {
    try {
      const res = await api.get(`/messages/direct/${userId}`);
      setMessages(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeConvo) {
      setLoadingMessages(true);
      fetchMessages(activeConvo.id);
      const interval = setInterval(() => {
        fetchMessages(activeConvo.id);
      }, 5000);
      return () => clearInterval(interval);
    }
    setMessages([]);
  }, [activeConvo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConvo) return;
    const txt = newMessage;
    setNewMessage('');
    const tempId = Date.now().toString();

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        content: txt,
        sender: { id: currentUserId },
        receiver: { id: activeConvo.id },
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      await api.post(`/messages/direct/${activeConvo.id}`, { content: txt });
      await fetchMessages(activeConvo.id);
      fetchConversations();
    } catch (e) {
      console.error('Failed to send:', e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const displayList = useMemo(
    () => (searchQuery.length >= 2 ? searchResults : conversations),
    [searchQuery, searchResults, conversations]
  );

  return (
    <PageShell
      title="Messages"
      description={`Communicate with ${role === 'brand' ? 'creators' : 'brands'} directly.`}
      icon={<MessageSquare size={18} />}
    >
      <Card className="overflow-hidden">
        <div className="flex" style={{ minHeight: 600, height: '75vh' }}>
          {/* ─── Sidebar ────────────────────────────────────────── */}
          <div
            className={`w-full md:w-80 flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}
            style={{ borderRight: '1px solid var(--border)' }}
          >
            <div
              className="p-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search brand or creator…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-foreground text-sm placeholder:text-muted"
                  style={fieldStyle}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {searchQuery.length >= 2 && searchResults.length === 0 ? (
                <div className="p-6 text-muted text-sm text-center">
                  No results found for "{searchQuery}".
                </div>
              ) : displayList.length === 0 ? (
                <div className="p-6">
                  <EmptyState>
                    <EmptyState.Media>
                      <MessageSquare className="size-6" />
                    </EmptyState.Media>
                    <EmptyState.Title>No conversations yet</EmptyState.Title>
                    <EmptyState.Description>
                      Search above to find someone.
                    </EmptyState.Description>
                  </EmptyState>
                </div>
              ) : (
                <ul>
                  {displayList.map((convo) => {
                    const isActive = activeConvo?.id === convo.id;
                    return (
                      <li key={convo.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveConvo(convo);
                            setSearchQuery('');
                          }}
                          className={`w-full text-left flex items-center gap-3 p-3 border-b border-border transition-colors ${
                            isActive
                              ? 'bg-accent-soft border-l-2 border-l-accent'
                              : 'border-l-2 border-l-transparent hover:bg-surface-hover'
                          }`}
                        >
                          <Avatar size="sm">
                            {convo.avatar && (
                              <Avatar.Image src={convo.avatar} alt={convo.name} />
                            )}
                            <Avatar.Fallback>
                              {(convo.name?.[0] || 'U').toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-foreground text-sm font-semibold truncate">
                                {convo.name}
                              </span>
                              {convo.time && (
                                <span className="text-muted text-[10px]">
                                  {new Date(convo.time).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="text-muted text-xs truncate">
                              {convo.lastMessage || convo.email}
                            </p>
                          </div>
                          {convo.unread && convo.unread > 0 ? (
                            <Chip
                              color="accent"
                              variant="primary"
                              size="sm"
                              className="shrink-0 !min-w-5 !justify-center !rounded-full"
                            >
                              {convo.unread}
                            </Chip>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ─── Chat area ──────────────────────────────────────── */}
          <div
            className={`flex-1 flex flex-col ${!activeConvo ? 'hidden md:flex' : 'flex'}`}
            style={{ background: 'var(--background)' }}
          >
            {activeConvo ? (
              <>
                {/* Chat header */}
                <div
                  className="h-14 flex items-center gap-3 px-4 sm:px-5 shrink-0"
                  style={{
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    className="md:hidden !rounded-lg"
                    aria-label="Back"
                    onPress={() => setActiveConvo(null)}
                  >
                    <ArrowLeft size={16} />
                  </Button>
                  <Avatar size="sm">
                    {activeConvo.avatar && (
                      <Avatar.Image src={activeConvo.avatar} alt={activeConvo.name} />
                    )}
                    <Avatar.Fallback>
                      {(activeConvo.name?.[0] || 'U').toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-foreground text-sm font-semibold truncate">
                      {activeConvo.name}
                    </div>
                    <div className="text-muted text-xs truncate">
                      {activeConvo.email}
                    </div>
                  </div>
                </div>

                {/* Active offer context banner */}
                {activeOffer && (
                  <div className="mx-4 sm:mx-5 mt-4 p-4 rounded-2xl flex items-center justify-between gap-3 bg-accent-soft border border-accent/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-accent-soft-foreground">
                        <DollarSign size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-muted text-[10px] font-medium uppercase tracking-wider">
                          Active offer context
                        </div>
                        <div className="text-foreground text-sm font-semibold tabular-nums">
                          {activeOffer.currency}{' '}
                          {Number(activeOffer.payment_amount || 0).toLocaleString()}
                          {' / '}
                          {activeOffer.payment_frequency}
                        </div>
                      </div>
                    </div>
                    <Chip color="accent" variant="soft" size="sm">
                      Negotiation mode
                    </Chip>
                  </div>
                )}

                {/* Thread */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                  {loadingMessages ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="text-accent animate-spin" size={22} />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-muted text-sm text-center py-10">
                      Start the conversation by sending a message.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender.id === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className="max-w-[75%] lg:max-w-[65%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed flex flex-col gap-1"
                            style={
                              isMe
                                ? {
                                    background: 'var(--accent)',
                                    color: 'var(--accent-foreground)',
                                    borderBottomRightRadius: 6,
                                  }
                                : {
                                    background: 'var(--surface)',
                                    color: 'var(--foreground)',
                                    border: '1px solid var(--border)',
                                    borderBottomLeftRadius: 6,
                                  }
                            }
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <span
                              className={`text-[10px] self-end ${
                                isMe
                                  ? 'text-accent-foreground/70'
                                  : 'text-muted'
                              }`}
                            >
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <Separator />
                <div
                  className="p-3 flex items-center gap-2"
                  style={{ background: 'var(--surface)' }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    className="!rounded-lg"
                    aria-label="Emoji"
                  >
                    <Smile size={16} />
                  </Button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a message…"
                    autoFocus
                    className="flex-1 px-3.5 py-2.5 rounded-xl text-foreground text-sm placeholder:text-muted"
                    style={fieldStyle}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    isIconOnly
                    className="!rounded-xl"
                    isDisabled={!newMessage.trim()}
                    onPress={handleSend}
                    aria-label="Send"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <EmptyState>
                  <EmptyState.Media>
                    <MessageSquare className="size-7" />
                  </EmptyState.Media>
                  <EmptyState.Title>Your conversations</EmptyState.Title>
                  <EmptyState.Description>
                    Select a conversation on the left or search for someone to
                    start messaging in real-time.
                  </EmptyState.Description>
                </EmptyState>
              </div>
            )}
          </div>
        </div>
      </Card>
    </PageShell>
  );
};

export default Messages;
