'use client';

import React from 'react';

export function LoadingSkeleton() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0B0D10',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header skeleton */}
      <div style={{
        height: '56px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 48px'
      }}>
        <div className="skeleton" style={{ width: '120px', height: '24px' }} />
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ width: '160px', height: '32px', borderRadius: '16px' }} />
      </div>

      {/* Content skeleton */}
      <div style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '48px' }}>
        {/* Timeline */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '48px', padding: '0 32px' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div className="skeleton" style={{ width: '80px', height: '14px' }} />
            </div>
          ))}
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '48px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ 
              background: '#12161B', 
              border: '1px solid rgba(255,255,255,0.06)', 
              borderRadius: '10px', 
              padding: '24px' 
            }}>
              <div className="skeleton" style={{ width: '100px', height: '14px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ width: '80px', height: '36px' }} />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="skeleton" style={{ width: '100%', height: '300px', borderRadius: '10px' }} />
      </div>
    </div>
  );
}
