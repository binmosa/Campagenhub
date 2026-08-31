import React, { useState } from 'react';
import {
  CheckCircle,
  DollarSign,
  FileText,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Modal,
  Switch,
  TextArea,
  TextField,
} from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { Input } from 'react-aria-components';
import api from '../../lib/api';
import { CURRENCIES, fieldClass, type Talent } from './shared';

/**
 * InvitationModal — brand/manager sends a collaboration invite + contract
 * (with optional AI generation), payment terms, and permission grants.
 */
export const InvitationModal: React.FC<{
  talent: Talent;
  isOpen: boolean;
  type: 'creator_collab' | 'manager_assign';
  onClose: () => void;
}> = ({ talent, isOpen, type, onClose }) => {
  const role = localStorage.getItem('role') || '';
  const [message, setMessage] = useState(
    `Hi ${talent.full_name || 'there'}, I'd love to collaborate with you on an upcoming campaign. Let's work together!`
  );
  const [videoLink, setVideoLink] = useState('');
  const [contractContent, setContractContent] = useState('');
  const [contractMode, setContractMode] = useState<'ai' | 'manual'>('manual');
  const [generating, setGenerating] = useState(false);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [day, setDay] = useState(1);
  const [currency, setCurrency] = useState('NGN');
  const [perms, setPerms] = useState({
    can_add_campaigns: false,
    can_view_analytics: false,
    can_manage_applications: false,
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const generateContract = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/contracts/generate', {
        type,
        talent_name: talent.full_name,
        amount,
        frequency,
        currency,
      });
      setContractContent(res.data?.content || res.data?.contract || '');
    } catch {
      setContractContent(
        `COLLABORATION AGREEMENT\n\nThis agreement is between the Brand and ${
          talent.full_name || 'the Talent'
        } for professional content collaboration services.\n\nPayment: ${currency} ${amount} per ${frequency}, paid on day ${day} of each ${
          frequency === 'monthly' ? 'month' : 'year'
        }.\n\nBoth parties agree to maintain professionalism, deliver agreed deliverables on time, and treat all shared information as confidential.\n\nThis agreement is enforceable from the date of acceptance on CampaignHub.`
      );
    }
    setGenerating(false);
  };

  const send = async () => {
    setSending(true);
    try {
      await api.post('/invitations', {
        receiver_id: talent.user?.id || talent.user_id || talent.id,
        type,
        message,
        contract_content: contractContent,
        payment_amount: amount ? Number(amount) : undefined,
        payment_frequency: frequency,
        payment_day: day,
        currency,
        permissions: type === 'creator_collab' ? perms : undefined,
        video_link: videoLink,
        ...(role === 'manager' ? { payment_approved: false } : {}),
      });
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const togglePerm = (key: keyof typeof perms, v: boolean) =>
    setPerms((p) => ({ ...p, [key]: v }));

  const initial = (talent.full_name || 'T')[0].toUpperCase();

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="!max-w-xl">
            <Modal.Header>
              <div className="flex items-center gap-3">
                <Avatar size="md">
                  {talent.avatar_url && (
                    <Avatar.Image
                      src={talent.avatar_url}
                      alt={talent.full_name}
                    />
                  )}
                  <Avatar.Fallback>{initial}</Avatar.Fallback>
                </Avatar>
                <div>
                  <Modal.Heading>
                    {talent.full_name || talent.username || 'Talent'}
                  </Modal.Heading>
                  <p className="text-muted text-xs mt-0.5">
                    {type === 'creator_collab'
                      ? 'Creator collaboration'
                      : 'Manager invitation'}
                  </p>
                </div>
              </div>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-5">
                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Personal message
                  </Label>
                  <TextArea
                    value={message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setMessage(e.target.value)
                    }
                    rows={3}
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                <TextField
                  value={videoLink}
                  onChange={setVideoLink}
                  aria-label="Video pitch link"
                >
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Video pitch link (optional)
                  </Label>
                  <Input
                    className={fieldClass}
                    type="url"
                    placeholder="e.g. https://loom.com/share/…"
                  />
                </TextField>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider inline-flex items-center gap-1.5">
                      <FileText size={11} /> Contract
                    </Label>
                    <Segment
                      selectedKey={contractMode}
                      onSelectionChange={(k) =>
                        setContractMode(k as typeof contractMode)
                      }
                      size="sm"
                    >
                      <Segment.Item id="ai">AI generate</Segment.Item>
                      <Segment.Item id="manual">Write</Segment.Item>
                    </Segment>
                  </div>
                  {contractMode === 'ai' && (
                    <Button
                      variant="outline"
                      size="md"
                      fullWidth
                      className="!mb-3"
                      isPending={generating}
                      onPress={generateContract}
                    >
                      <Sparkles size={13} /> Generate contract with AI
                    </Button>
                  )}
                  <TextArea
                    value={contractContent}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setContractContent(e.target.value)
                    }
                    rows={5}
                    placeholder="Enter or generate contract terms…"
                    className={`${fieldClass} font-mono text-xs resize-none`}
                  />
                </div>

                <div>
                  <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-2 inline-flex items-center gap-1.5">
                    <DollarSign size={11} /> Payment terms
                  </Label>
                  {role === 'manager' && (
                    <Card className="bg-warning-soft border-warning/40 mb-3">
                      <Card.Content className="p-3 text-xs text-warning-soft-foreground font-medium">
                        Payment terms you set require brand approval before the
                        recipient can accept.
                      </Card.Content>
                    </Card>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      value={amount}
                      onChange={setAmount}
                      aria-label="Amount"
                    >
                      <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                        Amount
                      </Label>
                      <Input
                        className={fieldClass}
                        type="number"
                        placeholder="0"
                      />
                    </TextField>
                    <div>
                      <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                        Currency
                      </Label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className={fieldClass}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                        Frequency
                      </Label>
                      <select
                        value={frequency}
                        onChange={(e) =>
                          setFrequency(e.target.value as 'monthly' | 'yearly')
                        }
                        className={fieldClass}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-muted text-[10px] font-medium uppercase block mb-1">
                        Payment day (1–28)
                      </Label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={day}
                        onChange={(e) => setDay(Number(e.target.value))}
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </div>

                {type === 'creator_collab' && (
                  <div>
                    <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-2">
                      Permissions to grant
                    </Label>
                    <div className="flex flex-col gap-2">
                      {(
                        [
                          ['can_add_campaigns', 'Can add campaigns'],
                          ['can_view_analytics', 'Can view analytics'],
                          ['can_manage_applications', 'Can manage applications'],
                        ] as const
                      ).map(([key, label]) => (
                        <Switch
                          key={key}
                          isSelected={perms[key]}
                          onChange={(v) => togglePerm(key, v)}
                        >
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <Switch.Content>
                            <Label className="text-sm">{label}</Label>
                          </Switch.Content>
                        </Switch>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              {sent ? (
                <Chip color="success" variant="soft" size="md">
                  <CheckCircle size={13} />
                  <Chip.Label>Invitation & contract sent</Chip.Label>
                </Chip>
              ) : (
                <>
                  <Button variant="ghost" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    isPending={sending}
                    onPress={send}
                  >
                    <Send size={13} /> Send invitation & contract
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export default InvitationModal;
