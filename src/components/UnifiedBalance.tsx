/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Layers, 
  Clock,
  Plus
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';
import UnifiedDeposit from './UnifiedDeposit';

export default function UnifiedBalance() {
  const { showToast, logTerminal } = useAppContext();
  const { wallet, unifiedBalance, unifiedBreakdown, updateUnifiedBalance } = useWallet();

  const [loading, setLoading] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);

  const getBalances = async (silent = false) => {
    if (!wallet || !wallet.address) return;
    if (!silent) setLoading(true);
    try {
      await updateUnifiedBalance(wallet.address);
    } catch (err) {
      console.error('Error fetching unified balance breakdown:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    getBalances();
    const interval = setInterval(() => getBalances(true), 15000); // Poll silently every 15s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address]);

  if (!wallet) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Decorative background glow */}
        <div style={{
          position: 'absolute', top: '-40%', right: '-20%', width: '250px', height: '250px',
          background: 'radial-gradient(circle, rgba(84,110,238,0.08) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none', borderRadius: '50%'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers style={{ color: 'var(--primary)' }} size={20} />
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>App Kit Unified Balance</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => getBalances()} 
              disabled={loading}
              className="flex-center btn btn-secondary btn-icon" 
              style={{
                width: '32px', height: '32px'
              }}
              title="Refresh balances"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin-slow' : ''} />
            </button>
            <button 
              onClick={() => setShowDepositForm(!showDepositForm)} 
              className="btn btn-primary"
              style={{ padding: '4px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> Deposit
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Aggregated Stablecoin Pool
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.25rem 0' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {unifiedBalance.confirmed.toFixed(2)}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>USDC</span>
            </div>
            {unifiedBalance.pending > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--warning)' }}>
                <Clock size={12} />
                <span>+ {unifiedBalance.pending.toFixed(2)} USDC pending confirmation</span>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--bg-hover)', borderRadius: '10px', padding: '0.75rem', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              CHAIN ALLOCATIONS:
            </span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Ethereum Sepolia */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#546eee' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Ethereum Sepolia</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {(unifiedBreakdown.find(b => b.chain === 'Ethereum_Sepolia')?.confirmed || 0).toFixed(2)} USDC
                </span>
              </div>

              {/* Arbitrum Sepolia */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1290f4' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Arbitrum Sepolia</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {(unifiedBreakdown.find(b => b.chain === 'Arbitrum_Sepolia')?.confirmed || 0).toFixed(2)} USDC
                </span>
              </div>

              {/* Arc Testnet */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e676' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Arc Testnet</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {(unifiedBreakdown.find(b => b.chain === 'Arc_Testnet')?.confirmed || 0).toFixed(2)} USDC
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDepositForm && (
        <UnifiedDeposit onSuccess={() => {
          // Auto refresh after deposit success
          setTimeout(() => getBalances(true), 3000);
        }} />
      )}
    </div>
  );
}
