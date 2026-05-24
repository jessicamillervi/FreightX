'use client';

import { Database } from 'lucide-react';
import { ARC_RPC_URL } from '@/services/sandbox';

interface TerminalLogProps {
  logs: string[];
}

export function TerminalLog({ logs }: TerminalLogProps) {
  const getLogColor = (log: string): string => {
    if (log.includes('ERROR')) return 'var(--danger)';
    if (log.includes('WARNING')) return 'var(--warning)';
    if (log.includes('successfully') || log.includes('Confirmed')) return 'var(--success)';
    return 'var(--text-secondary)';
  };

  return (
    <div
      className="glass-panel"
      style={{
        background: '#04060b',
        border: '1px solid rgba(255,255,255,0.03)',
        padding: '1rem',
        borderTop: '2px solid var(--primary)',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '180px',
        zIndex: 50,
        borderRadius: 0,
        borderBottom: 'none'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        paddingBottom: '0.25rem'
      }}>
        <span style={{
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--primary)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem'
        }}>
          <Database size={14} /> LIVE BLOCKCHAIN ORACLE & EVENT LEDGER
        </span>
        <span style={{
          fontSize: '0.65rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)'
        }}>
          Arc Network RPC: {ARC_RPC_URL}
        </span>
      </div>

      <div style={{
        overflowY: 'auto',
        height: '120px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        paddingRight: '0.5rem'
      }}>
        {logs.length === 0 ? (
          <span style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)'
          }}>
            Listening for block events and transaction confirmations...
          </span>
        ) : (
          logs.map((log, index) => (
            <span
              key={index}
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: getLogColor(log)
              }}
            >
              {log}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
