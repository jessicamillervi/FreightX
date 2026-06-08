'use client';

import React from 'react';
import DocumentVerify from '@/components/DocumentVerify';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function VerifyPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = React.use(params);

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      color: '#f8fafc',
      padding: '2rem 1.5rem',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Navigation & Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          paddingBottom: '1rem'
        }}>
          <Link href="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            transition: 'color 0.2s'
          }}>
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={24} style={{ color: 'var(--success)' }} />
            <span style={{ fontWeight: 700, letterSpacing: '1px', fontSize: '1rem' }}>FREIGHTX COMPLIANCE ENGINE</span>
          </div>
        </header>

        {/* Headline */}
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', background: 'linear-gradient(to right, #a5b4fc, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Verified Trade Document Audit
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Verifying authenticity of blockchain-backed Bill of Lading & cargo digital twins.
          </p>
        </div>

        {/* Verification Render */}
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
          <DocumentVerify tokenId={tokenId} />
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
          <p>© {new Date().getFullYear()} FreightX. All rights reserved. Registered cargo compliance standard FRTX-DOC.</p>
        </footer>

      </div>
    </main>
  );
}
