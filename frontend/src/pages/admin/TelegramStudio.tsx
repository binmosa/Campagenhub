import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  Copy,
  MessageCircle,
  Send,
  Settings,
  Users,
} from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  Label,
  Separator,
  TextArea,
} from '@heroui/react';
import { KPI, RadioButtonGroup } from '@heroui-pro/react';
import api, { serverOrigin } from '../../lib/api';
import { PageShell } from '../../components/ui';

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface text-foreground text-sm placeholder:text-muted border border-border focus:outline-none focus:border-field-border-focus';

const TelegramStudio: React.FC = () => {
  const [stats, setStats] = useState({ total_subscribers: 0, active_today: 0 });
  const [loading, setLoading] = useState(true);
  const [broadcastTarget, setBroadcastTarget] = useState<
    'all' | 'creators' | 'brands'
  >('all');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get('/telegram/admin/stats')
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setBroadcastStatus('sending');
    try {
      await api.post('/telegram/admin/broadcast', {
        message: broadcastMessage,
        target: broadcastTarget,
      });
      setBroadcastStatus('success');
      setBroadcastMessage('');
      setTimeout(() => setBroadcastStatus('idle'), 3000);
    } catch {
      setBroadcastStatus('error');
      setTimeout(() => setBroadcastStatus('idle'), 3000);
    }
  };

  const webhookUrl = `${serverOrigin}/telegram/webhook`;
  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <PageShell
      title="Telegram studio"
      description="Manage bot commands, broadcast messages, and track engagement."
      icon={<MessageCircle size={18} />}
    >
      {/* Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPI>
          <KPI.Header>
            <KPI.Title>Total subscribers</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={loading ? 0 : stats.total_subscribers}
              maximumFractionDigits={0}
            />
            <KPI.Trend trend="neutral">All time</KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Active today</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value
              value={loading ? 0 : stats.active_today}
              maximumFractionDigits={0}
            />
            <KPI.Trend trend={stats.active_today > 0 ? 'up' : 'neutral'}>
              Daily reach
            </KPI.Trend>
          </KPI.Content>
        </KPI>
        <KPI>
          <KPI.Header>
            <KPI.Title>Bot connection</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <div className="inline-flex items-center gap-2 text-success text-base font-semibold">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              Healthy
            </div>
          </KPI.Content>
        </KPI>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Broadcast form */}
        <Card className="lg:col-span-2">
          <Card.Header>
            <Card.Title className="inline-flex items-center gap-2 text-base">
              <Send size={15} className="text-accent" /> Live broadcast engine
            </Card.Title>
            <Card.Description>
              Dispatch an instant push notification to platform users directly
              inside Telegram.
            </Card.Description>
          </Card.Header>
          <Separator />
          <Card.Content className="p-5">
            <form onSubmit={handleBroadcast} className="space-y-5">
              <div>
                <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-2">
                  Target audience
                </Label>
                <RadioButtonGroup
                  aria-label="Target audience"
                  value={broadcastTarget}
                  onChange={(v) =>
                    setBroadcastTarget(v as typeof broadcastTarget)
                  }
                  layout="flex"
                >
                  <RadioButtonGroup.Item value="all">
                    <RadioButtonGroup.ItemIcon>
                      <Users size={14} />
                    </RadioButtonGroup.ItemIcon>
                    <RadioButtonGroup.ItemContent>
                      All users
                    </RadioButtonGroup.ItemContent>
                    <RadioButtonGroup.Indicator />
                  </RadioButtonGroup.Item>
                  <RadioButtonGroup.Item value="creators">
                    <RadioButtonGroup.ItemContent>
                      Only creators
                    </RadioButtonGroup.ItemContent>
                    <RadioButtonGroup.Indicator />
                  </RadioButtonGroup.Item>
                  <RadioButtonGroup.Item value="brands">
                    <RadioButtonGroup.ItemContent>
                      Only brands
                    </RadioButtonGroup.ItemContent>
                    <RadioButtonGroup.Indicator />
                  </RadioButtonGroup.Item>
                </RadioButtonGroup>
              </div>

              <div>
                <Label className="text-muted text-xs font-medium uppercase tracking-wider block mb-2">
                  Message content
                </Label>
                <TextArea
                  value={broadcastMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setBroadcastMessage(e.target.value)
                  }
                  required
                  rows={5}
                  placeholder="Hey everyone! We just dropped a huge new feature for…"
                  className={`${fieldClass} resize-none`}
                />
                <p className="text-muted text-xs mt-2">
                  Supports basic Telegram markdown (e.g. **bold** _italic_).
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  {broadcastStatus === 'success' && (
                    <Chip color="success" variant="soft" size="md">
                      <Activity size={13} />
                      <Chip.Label>Broadcast sent</Chip.Label>
                    </Chip>
                  )}
                  {broadcastStatus === 'error' && (
                    <Chip color="danger" variant="soft" size="md">
                      <AlertCircle size={13} />
                      <Chip.Label>Network error</Chip.Label>
                    </Chip>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  isPending={broadcastStatus === 'sending'}
                  isDisabled={!broadcastMessage.trim()}
                >
                  <Send size={13} /> Dispatch message
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-accent-soft border-accent/30">
            <Card.Content className="p-4">
              <h3 className="text-foreground text-sm font-semibold mb-2">
                Did you know?
              </h3>
              <p className="text-foreground text-xs leading-relaxed">
                CampaignHub automatically leverages this Telegram bot when
                brands click "Broadcast to Telegram" during campaign creation.
                It matches the brand's target audience with subscribed
                followers instantly.
              </p>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="inline-flex items-center gap-2 text-sm">
                <Settings size={14} className="text-accent" /> Essential bot
                hooks
              </Card.Title>
            </Card.Header>
            <Separator />
            <Card.Content className="p-4 space-y-3">
              <div>
                <Label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-1.5">
                  Bot webhook URL
                </Label>
                <div className="flex items-center gap-2 bg-surface-secondary border border-border p-2 rounded-lg">
                  <code className="text-accent text-xs truncate flex-1 font-mono">
                    {webhookUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label="Copy webhook URL"
                    onPress={copyWebhook}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </Button>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </PageShell>
  );
};

export default TelegramStudio;
