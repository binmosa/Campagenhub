import React from 'react';
import { Link } from 'react-router-dom';

/**
 * AuthShell — the single-column frame the password-recovery pages sit in.
 *
 * Sign-in and sign-up use the full two-pane brand layout; recovery is a
 * short, one-thing-at-a-time errand, so it gets the same canvas, brand mark
 * and typography without the marketing panel competing for attention.
 * `.landing-visitors` carries the public palette and type, as on the other
 * two auth pages.
 */
export const authFieldClass = 'w-full px-3.5 py-3 rounded-lg v-body v-ink';

export const AuthShell: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="landing-visitors min-h-screen flex flex-col items-center px-6 py-12 v-bg-canvas">
    <Link to="/" className="inline-flex items-center gap-2 self-start lg:self-center mb-10">
      <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
      <span className="v-ink font-medium" style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
        Campgains <span style={{ color: 'var(--color-creator-teal-deep, #00a89d)' }}>Hub</span>
      </span>
    </Link>

    <div className="w-full max-w-md my-auto">
      <div className="mb-7">
        <h1 className="v-heading-xl">{title}</h1>
        {subtitle && (
          <p className="v-body v-muted mt-2" style={{ maxWidth: '46ch' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--color-paper, #fff)', border: '1px solid var(--color-cool-gray)' }}
      >
        {children}
      </div>
    </div>
  </div>
);

/* Inputs inside the shell match the sign-in page's hairline field. */
export const authFieldStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-cool-gray)',
  outline: 'none',
};
