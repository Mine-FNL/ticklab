'use client';

/**
 * Global error boundary. Catches uncaught exceptions in the React tree and
 * surfaces a friendly fallback with a reset action. Logs the error to the
 * console for now — wire to your APM (Sentry / Datadog / OpenTelemetry)
 * when deploying.
 */

import React, { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app] uncaught error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          color: '#e4e4e7',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: '1.5rem 2rem',
            borderRadius: 12,
            background: '#18181b',
            border: '1px solid #27272a',
          }}
        >
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 1rem', color: '#a1a1aa', fontSize: '0.9rem', lineHeight: 1.5 }}>
            The application hit an unexpected error. Your inputs and strategies are preserved.
          </p>
          {error?.message ? (
            <pre
              style={{
                margin: '0 0 1rem',
                padding: '0.75rem',
                background: '#0a0a0f',
                border: '1px solid #27272a',
                borderRadius: 8,
                fontSize: '0.78rem',
                color: '#f87171',
                overflow: 'auto',
                maxHeight: 140,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              background: '#10b981',
              color: '#0a0a0f',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}