import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * Notice — inline feedback strip (replaces window.alert across the app).
 * Same washes as the directory cards: lavender / mint / coral.
 */
const TONES = {
  info: { bg: 'rgba(108,99,255,0.08)', border: 'rgba(108,99,255,0.25)', color: '#3f37b8', Icon: Info },
  success: { bg: 'rgba(22,199,132,0.10)', border: 'rgba(22,199,132,0.28)', color: '#0b6e3e', Icon: CheckCircle2 },
  error: { bg: 'rgba(255,90,95,0.08)', border: 'rgba(255,90,95,0.25)', color: '#b3261e', Icon: AlertCircle },
} as const;

export const Notice: React.FC<{
  tone?: keyof typeof TONES;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}> = ({ tone = 'info', children, onDismiss, className = '' }) => {
  const { bg, border, color, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-xl px-3.5 py-3 v-body ${className}`}
      style={{ background: bg, border: `1px solid ${border}`, color, fontSize: 13 }}
    >
      <Icon size={15} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default Notice;
