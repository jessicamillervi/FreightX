'use client';

import { Anchor } from 'lucide-react';

export function LoadingSkeleton() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2rem',
      padding: '2rem',
      background: 'var(--bg-main)'
    }}>
      {/* Animated logo */}
      <div style={{
        position: 'relative',
        width: '80px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid rgba(0, 136, 255, 0.1)',
          borderTopColor: 'var(--primary)',
          animation: 'spin-slow 1.5s linear infinite'
        }} />
        <Anchor size={28} style={{ color: 'var(--primary)' }} />
      </div>

      {/* Brand */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: '1.8rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #0088ff 0%, #00d2ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem',
          letterSpacing: '-0.03em'
        }}>
          FreightX
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Initializing sandbox wallet &amp; blockchain connector...
        </p>
      </div>

      {/* Skeleton cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        width: '100%',
        maxWidth: '600px'
      }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{
            height: '60px',
            borderRadius: '12px',
            opacity: 0.6
          }} />
        ))}
      </div>

      {/* Progress bar */}
      <div style={{
        width: '200px',
        height: '4px',
        borderRadius: '2px',
        background: 'var(--bg-surface-elevated)',
        overflow: 'hidden'
      }}>
        <div style={{
          width: '60%',
          height: '100%',
          borderRadius: '2px',
          background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
          animation: 'shimmer 1.5s infinite'
        }} />
      </div>
    </div>
  );
}
