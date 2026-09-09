import React from 'react';

/**
 * ErrorBoundary — the difference between a bad render and a white page.
 *
 * Nothing caught render errors, so one thrown exception anywhere in the
 * tree left the viewer staring at an empty document with no way forward.
 * This catches it, says so plainly, and offers the two things that
 * actually help: reload, or go back to the dashboard.
 *
 * Deliberately not translated — i18n itself may be what failed, and this
 * has to render when the rest of the app cannot.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Campaign Hubz] Render failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f7f7fb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#1a1c23',
        }}
      >
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.015em' }}>
            This page stopped working
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: '#565d6b', margin: '0 0 20px' }}>
            Something went wrong while drawing this screen. Your data is safe — reloading usually clears it.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background: '#6c63ff',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload the page
            </button>
            <a
              href="/dashboard"
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: '1px solid #d9dbe4',
                background: '#fff',
                color: '#1a1c23',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
