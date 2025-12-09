'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <h1 style={{
          fontSize: '3rem',
          margin: '0 0 1rem 0',
          fontWeight: 'bold'
        }}>Something went wrong!</h1>
        <p style={{
          fontSize: '1.1rem',
          margin: '1rem 0',
          color: '#666'
        }}>
          {error.message || 'An unexpected error occurred'}
        </p>
        {error.digest && (
          <p style={{
            fontSize: '0.9rem',
            margin: '1rem 0',
            color: '#999',
            fontFamily: 'monospace'
          }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: '2rem',
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background 0.3s ease'
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
