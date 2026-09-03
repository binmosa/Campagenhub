import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Camera,
  CheckCircle,
  Clock,
  DollarSign,
  Edit3,
  MapPin,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Modal,
  SearchField,
  Separator,
} from '@heroui/react';
import {
  EmptyState,
  Segment,
} from '@heroui-pro/react';
import api from '../lib/api';
import { PitchModal } from '../components/common/PitchModal';
import { MetricCard, PageShell } from '../components/ui';
import { EmptyPanel } from '../components/common/EmptyPanel';
import { toast } from '../lib/toast';
import { Sparkles as ActiveIcon, Tag as TypeIcon } from 'lucide-react';

type Offer = {
  id: string;
  title: string;
  description?: string;
  content_type: string;
  price: number | string;
  currency: string;
  delivery_days: number | string;
  is_active?: boolean;
  user?: {
    id?: string;
    name?: string;
    avatar?: string;
    role?: 'creator' | 'manager' | 'brand' | string;
    followers?: string;
    location?: string;
  };
};

const CONTENT_TYPES = [
  'Post',
  'Reel',
  'Story',
  'TikTok',
  'YouTube Video',
  'YouTube Short',
  'Thread',
  'Blog Post',
  'Podcast',
  'Live Stream',
  'Newsletter',
  'Other',
];
const CURRENCIES = ['USD', 'NGN', 'KES', 'GHS', 'ZAR', 'EUR', 'GBP'];

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted';
const fieldStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  outline: 'none',
};

/* ── Create / edit offer modal ───────────────────────────────────── */
const OfferModal: React.FC<{
  offer?: Offer | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ offer, isOpen, onClose, onSaved }) => {
  const [title, setTitle] = useState(offer?.title || '');
  const [description, setDescription] = useState(offer?.description || '');
  const [contentType, setContentType] = useState(offer?.content_type || 'Post');
  const [price, setPrice] = useState(offer?.price?.toString() || '');
  const [currency, setCurrency] = useState(offer?.currency || 'USD');
  const [deliveryDays, setDeliveryDays] = useState(
    offer?.delivery_days?.toString() || '3'
  );
  const [saving, setSaving] = useState(false);
  const [showPitch, setShowPitch] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(offer?.title || '');
      setDescription(offer?.description || '');
      setContentType(offer?.content_type || 'Post');
      setPrice(offer?.price?.toString() || '');
      setCurrency(offer?.currency || 'USD');
      setDeliveryDays(offer?.delivery_days?.toString() || '3');
    }
  }, [isOpen, offer]);

  const submit = async () => {
    if (!title.trim() || !price) return;
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        content_type: contentType,
        price: Number(price),
        currency,
        delivery_days: Number(deliveryDays),
      };
      if (offer?.id) {
        await api.patch(`/offers/${offer.id}`, payload);
      } else {
        await api.post('/offers', payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{offer ? 'Edit offer' : 'New offer'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <div>
                  <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Title *
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Instagram Reel package"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-muted text-xs font-medium uppercase tracking-wider">
                      Description
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPitch(true)}
                      className="text-accent text-xs font-medium inline-flex items-center gap-1"
                    >
                      <Sparkles size={11} /> AI pitch gen
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what's included…"
                    className={`${fieldClass} resize-none`}
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Content type
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  >
                    {CONTENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-1.5">
                      Price
                    </label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0"
                      className={fieldClass}
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-1.5">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className={fieldClass}
                      style={fieldStyle}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-1.5">
                      Delivery (days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(e.target.value)}
                      className={fieldClass}
                      style={fieldStyle}
                    />
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isDisabled={!title.trim() || !price}
                isPending={saving}
                onPress={submit}
              >
                {offer ? (
                  'Update offer'
                ) : (
                  <>
                    <Plus size={13} /> Publish offer
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      {showPitch && (
        <PitchModal
          onClose={() => setShowPitch(false)}
          defaultCampaignName={title}
        />
      )}
    </>
  );
};

/* ── Direct invite modal (brand buying a creator's offer) ────────── */
const OfferInviteModal: React.FC<{
  offer: Offer;
  isOpen: boolean;
  onClose: () => void;
}> = ({ offer, isOpen, onClose }) => {
  const [message, setMessage] = useState(
    `Hi ${offer.user?.name || 'there'}! I'd like to collaborate based on your "${offer.title}" package.`
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPitch, setShowPitch] = useState(false);

  const send = async () => {
    setSending(true);
    setErrorMsg('');
    try {
      await api.post('/invitations', {
        receiver_id: offer.user?.id,
        type:
          offer.user?.role === 'manager' ? 'manager_assign' : 'creator_collab',
        message,
        contract_content: `SERVICE AGREEMENT FOR: ${offer.title}\n\nPrice: ${offer.currency} ${offer.price}\nDelivery Time: ${offer.delivery_days} days\nContent Type: ${offer.content_type}\n\nDescription: ${offer.description || 'Standard offer terms apply.'}`,
        payment_amount: Number(offer.price),
        currency: offer.currency,
      });
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setErrorMsg(
        Array.isArray(e?.response?.data?.message)
          ? e.response.data.message[0]
          : e?.response?.data?.message || 'Failed to send invitation'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Modal.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Book service</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-accent text-sm font-semibold mb-4">{offer.title}</p>
              <div className="flex items-center gap-3 p-4 rounded-xl mb-4 bg-accent-soft border border-accent/30">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-surface text-accent-soft-foreground">
                  <DollarSign size={17} />
                </span>
                <div>
                  <div className="text-muted text-xs font-medium uppercase tracking-wider">
                    Total price
                  </div>
                  <div className="text-foreground text-lg font-semibold tabular-nums">
                    {offer.currency} {Number(offer.price).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-muted text-xs font-medium uppercase tracking-wider">
                    Message to {offer.user?.name || 'talent'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPitch(true)}
                    className="text-accent text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Sparkles size={11} /> AI pitch gen
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${fieldClass} resize-none`}
                  style={fieldStyle}
                />
              </div>
              {errorMsg && (
                <div className="mt-3 p-3 rounded-lg text-sm font-medium bg-danger-soft border border-danger/40 text-danger-soft-foreground">
                  {errorMsg}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              {sent ? (
                <Chip color="success" variant="soft" size="md">
                  <CheckCircle size={13} /> Invitation sent
                </Chip>
              ) : (
                <>
                  <Button variant="ghost" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={!message.trim()}
                    isPending={sending}
                    onPress={send}
                  >
                    <Send size={13} /> Send invite
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      {showPitch && (
        <PitchModal
          onClose={() => setShowPitch(false)}
          defaultCampaignName={offer.title}
          defaultCreatorName={offer.user?.name || ''}
        />
      )}
    </>
  );
};

/* ── Main page ──────────────────────────────────────────────────── */
const OffersPage: React.FC = () => {
  const role = (localStorage.getItem('role') || 'creator').toLowerCase();
  const isBrandOrAdmin = role === 'brand' || role === 'admin';
  const isCreatorOrManager = role === 'creator' || role === 'manager';

  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [inviteModalOffer, setInviteModalOffer] = useState<Offer | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [view, setView] = useState<'browse' | 'mine'>(
    isBrandOrAdmin ? 'browse' : 'mine'
  );

  const myId = useMemo(() => {
    try {
      const tok = api.defaults.headers.common['Authorization'] as string;
      if (!tok) return '';
      return JSON.parse(atob(tok.split('.')[1])).sub || '';
    } catch {
      return '';
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, myRes] = await Promise.all([
        api.get('/offers'),
        isCreatorOrManager
          ? api.get('/offers/mine')
          : Promise.resolve({ data: [] }),
      ]);
      setAllOffers(allRes.data || []);
      setMyOffers(myRes.data || []);
    } catch {}
    setLoading(false);
  }, [isCreatorOrManager]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      (view === 'mine' ? myOffers : allOffers).filter((o) => {
        if (
          search &&
          !o.title?.toLowerCase().includes(search.toLowerCase()) &&
          !o.user?.name?.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        if (filterType !== 'All' && o.content_type !== filterType) return false;
        return true;
      }),
    [view, myOffers, allOffers, search, filterType]
  );

  return (
    <PageShell
      hero
      containerSize="wide"
      title={isBrandOrAdmin ? 'Creator' : 'My'}
      titleAccent={isBrandOrAdmin ? 'marketplace' : 'offers'}
      stats={
        <div className="grid grid-cols-3 gap-3">
          {isCreatorOrManager ? (
            <>
              <MetricCard label="My offers" value={myOffers.length} icon={ShoppingBag} />
              <MetricCard label="Live" value={myOffers.filter((o) => o.is_active).length} hint={`${myOffers.filter((o) => !o.is_active).length} paused`} icon={ActiveIcon} iconStatus="success" />
              <MetricCard label="On the marketplace" value={allOffers.length} hint="all creators & managers" icon={TypeIcon} />
            </>
          ) : (
            <>
              <MetricCard label="Offers" value={allOffers.length} hint="from creators & managers" icon={ShoppingBag} />
              <MetricCard label="Formats" value={new Set(allOffers.map((o) => o.content_type).filter(Boolean)).size} hint="content types on offer" icon={TypeIcon} />
              <MetricCard label="Matching" value={filtered.length} hint="with current filters" icon={ActiveIcon} />
            </>
          )}
        </div>
      }
      description={
        isBrandOrAdmin
          ? 'Browse service offerings from verified creators and managers.'
          : 'Publish your services and set your rates.'
      }
      icon={<ShoppingBag size={18} />}
      actions={
        isCreatorOrManager ? (
          <Button
            variant="primary"
            size="md"
            className="!rounded-xl"
            onPress={() => {
              setEditing(null);
              setShowOfferModal(true);
            }}
          >
            <Plus size={14} /> New offer
          </Button>
        ) : null
      }
    >
      {/* View tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {isCreatorOrManager ? (
          <Segment
            selectedKey={view}
            onSelectionChange={(k) => setView(k as typeof view)}
          >
            <Segment.Item id="mine">Mine · {myOffers.length}</Segment.Item>
            <Segment.Item id="browse">
              Browse · {allOffers.length}
            </Segment.Item>
          </Segment>
        ) : (
          <span />
        )}
        <SearchField
          aria-label="Search offers"
          value={search}
          onChange={setSearch}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              className="w-full sm:w-[280px]"
              placeholder="Search offers…"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      {/* Content type chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['All', ...CONTENT_TYPES.slice(0, 8)].map((t) => {
          const active = filterType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className="v-niche-chip shrink-0"
              data-active={active || undefined}
              aria-pressed={active}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Offers grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="v-talent-card p-4">
              <div className="v-skel h-4 w-1/2 mb-2" />
              <div className="v-skel h-3 w-full mb-1" />
              <div className="v-skel h-3 w-3/4 mb-4" />
              <div className="v-skel h-8 w-24 !rounded-lg" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyPanel
          icon={<ShoppingBag size={22} />}
          title={view === 'mine' ? 'No offers yet' : search || filterType !== 'All' ? 'No offers match' : 'The marketplace is quiet'}
          description={
            view === 'mine'
              ? 'Package what you do — a review video, a story set, a monthly retainer — and brands can hire you without a campaign.'
              : search || filterType !== 'All'
                ? 'Try another format or clear the search.'
                : 'Creators and managers publish service offers here. Check back soon, or invite talent from the directory.'
          }
          actions={
            view === 'mine' && isCreatorOrManager ? (
              <Button
                variant="primary"
                onPress={() => {
                  setEditing(null);
                  setShowOfferModal(true);
                }}
              >
                <Plus size={14} /> New offer
              </Button>
            ) : search || filterType !== 'All' ? (
              <Button variant="primary" size="sm" onPress={() => { setSearch(''); setFilterType('All'); }}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((offer) => (
            <Card key={offer.id} className="overflow-hidden flex flex-col">
              {/* Top accent bar */}
              <div
                className="h-1"
                style={{
                  background:
                    'linear-gradient(90deg, var(--accent) 0%, var(--accent-2, var(--accent)) 100%)',
                }}
              />
              <Card.Content className="p-5 flex flex-col flex-1">
                {/* User row (browse view) */}
                {view === 'browse' && offer.user && (
                  <div className="flex items-center gap-2.5 mb-3">
                    <Avatar size="sm">
                      {offer.user.avatar && (
                        <Avatar.Image
                          src={offer.user.avatar}
                          alt={offer.user.name}
                        />
                      )}
                      <Avatar.Fallback>
                        {(offer.user.name || 'U').slice(0, 1).toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground text-sm font-semibold truncate">
                        {offer.user.name || 'User'}
                      </div>
                      <div className="text-muted text-[10px] flex items-center gap-2">
                        <span className="inline-flex items-center gap-0.5 capitalize">
                          {offer.user.role === 'creator' ? (
                            <Camera size={9} />
                          ) : (
                            <Award size={9} />
                          )}{' '}
                          {offer.user.role}
                        </span>
                        {offer.user.followers && (
                          <span className="inline-flex items-center gap-0.5">
                            <Users size={9} /> {offer.user.followers}
                          </span>
                        )}
                        {offer.user.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin size={9} /> {offer.user.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Chip variant="soft" color="accent" size="sm">
                    {offer.content_type}
                  </Chip>
                  {view === 'mine' && (
                    <Chip
                      color={offer.is_active ? 'success' : 'default'}
                      variant="soft"
                      size="sm"
                    >
                      {offer.is_active ? 'Active' : 'Paused'}
                    </Chip>
                  )}
                </div>

                <h3 className="text-foreground text-sm font-semibold mb-1">
                  {offer.title}
                </h3>
                {offer.description && (
                  <p className="text-muted text-xs line-clamp-2 mb-3">
                    {offer.description}
                  </p>
                )}

                <div className="flex items-center gap-3 mb-3 mt-auto">
                  <span className="text-success inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
                    <DollarSign size={13} /> {offer.currency}{' '}
                    {Number(offer.price).toLocaleString()}
                  </span>
                  <span className="text-muted inline-flex items-center gap-1 text-xs">
                    <Clock size={11} /> {offer.delivery_days} day
                    {offer.delivery_days !== 1 ? 's' : ''}
                  </span>
                </div>

                <Separator className="!mb-3" />

                {/* Actions */}
                {view === 'mine' ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="!rounded-lg flex-1"
                      onPress={() => {
                        setEditing(offer);
                        setShowOfferModal(true);
                      }}
                    >
                      <Edit3 size={12} /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      className="!rounded-lg"
                      aria-label={offer.is_active ? 'Pause' : 'Activate'}
                      onPress={async () => {
                        await api.patch(`/offers/${offer.id}/toggle`);
                        load();
                      }}
                    >
                      {offer.is_active ? (
                        <ToggleRight size={15} className="text-success" />
                      ) : (
                        <ToggleLeft size={15} className="text-muted" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      className="!rounded-lg !text-danger"
                      aria-label="Delete"
                      onPress={async () => {
                        if (confirm('Delete this offer?')) {
                          await api.delete(`/offers/${offer.id}`);
                          load();
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ) : (
                  offer.user?.id !== myId &&
                  role !== 'creator' && (
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      className="!rounded-lg"
                      onPress={() => setInviteModalOffer(offer)}
                    >
                      <Send size={12} /> Send invite
                    </Button>
                  )
                )}
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <OfferModal
        offer={editing}
        isOpen={showOfferModal}
        onClose={() => setShowOfferModal(false)}
        onSaved={load}
      />
      {inviteModalOffer && (
        <OfferInviteModal
          offer={inviteModalOffer}
          isOpen={!!inviteModalOffer}
          onClose={() => setInviteModalOffer(null)}
        />
      )}
    </PageShell>
  );
};

export default OffersPage;
