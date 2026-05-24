'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FreightX Error Boundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '1.5rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255, 23, 68, 0.1)',
            border: '2px solid rgba(255, 23, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem'
          }}>
            ⚠️
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: '#ffffff' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#90a4ae', maxWidth: '500px', lineHeight: 1.6 }}>
              The FreightX dashboard encountered an unexpected error. This is likely a temporary issue.
            </p>
          </div>
          <pre style={{
            background: 'rgba(6, 8, 14, 0.8)',
            border: '1px solid rgba(255, 23, 68, 0.2)',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: '#ff1744',
            maxWidth: '600px',
            overflow: 'auto',
            textAlign: 'left'
          }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              background: 'linear-gradient(135deg, #0088ff 0%, #0056cc 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 136, 255, 0.3)'
            }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
