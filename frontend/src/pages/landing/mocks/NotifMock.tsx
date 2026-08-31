import React from 'react';
import { Bell, DollarSign, UserPlus, MessageCircle, type LucideIcon } from 'lucide-react';

/**
 * NotifMock — single floating activity notification.
 *
 * Looks like the toast a brand or creator would see ("Lina just applied",
 * "Payout of $850 sent"). Used in the hero bento and ForCreators sections
 * to communicate liveness.
 */
type NotifKind = 'application' | 'payout' | 'message' | 'follow';

const KIND_STYLE: Record<NotifKind, { icon: LucideIcon; tint: string }> = {
  application: { icon: UserPlus,      tint: 'bg-accent-soft text-accent-soft-foreground' },
  payout:      { icon: DollarSign,    tint: 'bg-success-soft text-success-soft-foreground' },
  message:     { icon: MessageCircle, tint: 'bg-warning-soft text-warning-soft-foreground' },
  follow:      { icon: Bell,          tint: 'bg-surface-tertiary text-foreground' },
};

interface Props {
  kind?: NotifKind;
  title?: string;
  body?: string;
  time?: string;
  className?: string;
}

export const NotifMock: React.FC<Props> = ({
  kind = 'application',
  title = 'New application',
  body  = '@linaeats applied to your campaign',
  time  = 'now',
  className = '',
}) => {
  const { icon: Icon, tint } = KIND_STYLE[kind];

  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-overlay p-3 pr-4 flex items-center gap-3 w-full max-w-[260px] ${className}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-[10px] text-muted shrink-0">{time}</span>
        </div>
        <div className="text-xs text-muted truncate">{body}</div>
      </div>
    </div>
  );
};

export default NotifMock;
