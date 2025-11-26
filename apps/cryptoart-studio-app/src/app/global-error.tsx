'use client';

import { APP_NAME } from '~/lib/constants';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Error | {APP_NAME}</title>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white',
          padding: '2rem',
          maxWidth: '600px'
        }}>
          <h1 style={{
            fontSize: '4rem',
            margin: '0',
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>Oops!</h1>
          <h2 style={{
            fontSize: '2rem',
            margin: '1rem 0',
            fontWeight: 'normal'
          }}>Something went wrong</h2>
          <p style={{
            fontSize: '1.1rem',
            margin: '1.5rem 0',
            opacity: 0.9
          }}>
            {error.message || 'An unexpected error occurred'}
          </p>
          {error.digest && (
            <p style={{
              fontSize: '0.9rem',
              margin: '1rem 0',
              opacity: 0.7,
              fontFamily: 'monospace'
            }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              display: 'inline-block',
              marginTop: '2rem',
              padding: '1rem 2rem',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              fontSize: '1.1rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
