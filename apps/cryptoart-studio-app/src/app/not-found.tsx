import Link from 'next/link';
import { APP_NAME } from '~/lib/constants';

export default function NotFound() {
  return (
    <div style={{
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
        padding: '2rem'
      }}>
        <h1 style={{
          fontSize: '6rem',
          margin: '0',
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>404</h1>
        <h2 style={{
          fontSize: '2rem',
          margin: '1rem 0',
          fontWeight: 'normal'
        }}>Page Not Found</h2>
        <p style={{
          fontSize: '1.2rem',
          margin: '1.5rem 0',
          opacity: 0.9
        }}>
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
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
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
