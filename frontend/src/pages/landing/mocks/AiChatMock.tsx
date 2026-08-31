import React from 'react';
import { Sparkles, Send } from 'lucide-react';

/**
 * AiChatMock — illustrative chat conversation with the AI Studio.
 *
 * Two-turn mock: brand asks → AI replies with a structured brief outline.
 * Pure visual; no real LLM call. Used in the AiStudio section to make the
 * feature tangible without screenshots.
 */
export const AiChatMock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-3xl border border-border bg-surface shadow-overlay overflow-hidden ${className}`}>
    {/* Chat header */}
    <div className="flex items-center justify-between px-5 py-3 border-b border-separator bg-surface-secondary/60">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center">
          <Sparkles size={14} className="text-accent-foreground" />
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground leading-none">AI Studio</div>
          <div className="text-[10px] text-muted leading-none mt-0.5">Always-on creative partner</div>
        </div>
      </div>
      <div className="inline-flex items-center gap-1 text-[10px] text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Online
      </div>
    </div>

    {/* Body */}
    <div className="p-5 space-y-4">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent text-accent-foreground px-4 py-2.5 text-sm leading-relaxed">
          Draft a campaign brief for a summer fitness drop on TikTok. Budget $5k.
        </div>
      </div>

      {/* AI bubble */}
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={13} className="text-accent-foreground" />
        </div>
        <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-surface-secondary text-foreground px-4 py-3 text-sm leading-relaxed">
          <div className="font-semibold mb-2">Summer Fitness Drop — TikTok Brief</div>
          <ul className="space-y-1.5 text-xs text-muted">
            <li>· <span className="text-foreground font-medium">Goal:</span> drive 250k impressions</li>
            <li>· <span className="text-foreground font-medium">Creator fit:</span> fitness, 100k–500k followers</li>
            <li>· <span className="text-foreground font-medium">Asset:</span> 30-sec workout reel</li>
            <li>· <span className="text-foreground font-medium">Deadline:</span> ship in 7 days</li>
          </ul>
        </div>
      </div>
    </div>

    {/* Input */}
    <div className="px-5 pb-5">
      <div className="flex items-center gap-2 rounded-full border border-field-border bg-field-background px-4 py-2.5">
        <input
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
          placeholder="Ask anything…"
          readOnly
        />
        <button
          type="button"
          className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center"
          aria-label="Send"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  </div>
);

export default AiChatMock;
