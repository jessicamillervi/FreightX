'use client';

import React from 'react';
import { ShieldCheck, Clock, Loader2, Database, Compass } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useAppContext } from '@/contexts/AppContext';
import { WalletConnect, UnifiedBalance } from '@/components';

export default function SandboxTab() {
  const { appMode, handleModeChange, setActiveTab } = useAppContext();
  const { contracts, deploying, deployStatus, handleDeployContracts, handleResetContracts } = useWallet();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <WalletConnect />
      
      {appMode === 'live' && <UnifiedBalance />}
      
      <div className="glass-panel">
        <div className="section-header" style={{ marginBottom: '20px' }}>
          <div>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck style={{ color: 'var(--primary)' }} /> Deploy Trade Gateways
            </h2>
            <p className="section-subtitle">
              Activate smart escrow and tracking on Arc. Fees paid in USDC stablecoins.
            </p>
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginBottom: '16px', letterSpacing: '0.02em' }}>GATEWAY SERVICES</h3>
          
          <div className="grid-cols-2" style={{ gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="badge badge-primary">PASSPORT</span>
                <strong style={{ fontSize: '14px' }}>Cargo Digital Twin (NFT)</strong>
              </div>
              <p style={{ fontSize: '14px' }}>
                Tokenizes containers into immutable digital records with GPS, temperature, and timeline data.
              </p>
            </div>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="badge badge-success">VAULT</span>
                <strong style={{ fontSize: '14px' }}>Milestone Escrow Gateway</strong>
              </div>
              <p style={{ fontSize: '14px' }}>
                Automates USDC/EURC payments. Funds locked in vaults, released on verified delivery milestones.
              </p>
            </div>
          </div>
        </div>

        {appMode === 'live' ? (
          <div>
            {contracts ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div className="flex-center" style={{ width: '48px', height: '48px', background: 'var(--success-soft)', borderRadius: '50%', color: 'var(--success)', margin: '0 auto 16px' }}>
                  <ShieldCheck size={24} />
                </div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Gateways Online</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px' }}>
                  Smart contracts deployed on Arc Testnet. Proceed to manage escrows.
                </p>
                <div className="flex-center" style={{ gap: '12px' }}>
                  <button onClick={() => setActiveTab('escrows')} className="btn btn-primary">
                    Open Escrow Dashboard
                  </button>
                  <button onClick={handleResetContracts} className="btn btn-secondary" style={{ color: 'var(--danger)' }}>
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <Clock size={16} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '14px', display: 'block', color: 'var(--warning)' }}>Requirements</strong>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Ensure wallet holds ~0.5 USDC for deployment gas fees.
                    </span>
                  </div>
                </div>

                <button 
                  onClick={handleDeployContracts} 
                  disabled={deploying}
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '14px' }}
                >
                  {deploying ? (
                    <>
                      <Loader2 className="animate-spin-slow" size={18} /> {deployStatus}
                    </>
                  ) : (
                    <>
                      <Database size={18} /> Deploy to Arc Network
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Compass size={28} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Sandbox Mode</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 20px' }}>
              Transactions execute instantly at zero cost. Switch to Live to transact on testnet.
            </p>
            <button onClick={() => handleModeChange('live')} className="btn btn-primary">
              Switch to Live
            </button>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="glass-panel">
        <h3 className="section-title" style={{ marginBottom: '20px' }}>Why Stablecoin Escrows</h3>
        <div className="grid-cols-2" style={{ gap: '20px' }}>
          <div>
            <h4 style={{ fontSize: '15px', color: 'var(--primary)', marginBottom: '6px' }}>Milestone Payouts</h4>
            <p style={{ fontSize: '14px' }}>
              Funds partially disbursed when cold-chain telemetry verifies checkpoint arrivals.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '15px', color: 'var(--primary)', marginBottom: '6px' }}>Instant Settlement</h4>
            <p style={{ fontSize: '14px' }}>
              Sub-second confirmation. Carrier fees land instantly, bypassing net 30/90 delays.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '15px', color: 'var(--primary)', marginBottom: '6px' }}>Multi-Currency</h4>
            <p style={{ fontSize: '14px' }}>
              USDC or EURC to hedge currency volatility during intercontinental transport.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '15px', color: 'var(--primary)', marginBottom: '6px' }}>PO Financing</h4>
            <p style={{ fontSize: '14px' }}>
              Suppliers access capital pools. Repayments auto-deducted when buyer deposits escrow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
