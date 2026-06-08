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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <WalletConnect />
      
      {appMode === 'live' && <UnifiedBalance />}
      
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck style={{ color: 'var(--primary)' }} /> Deploy Secure Trade Gateways
        </h2>
        <p style={{ marginBottom: '1.25rem' }}>
          Activate the smart escrow and tracking gateways on Arc. System processing fees are paid transparently using stablecoins (USDC) rather than highly volatile digital assets.
        </p>

        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', marginBottom: '0.75rem' }}>GATEWAY SERVICES TO BE DEPLOYED:</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span className="badge badge-primary">CARGO PASSPORT</span>
                <strong style={{ fontSize: '0.85rem' }}>Cargo Digital Twin Passport (NFT)</strong>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Tokenizes your container into an immutable digital record. Log GPS pings, temperature graphs, and shipping timelines transparently without any risk of alteration.
              </span>
            </div>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span className="badge badge-success">DIGITAL VAULT</span>
                <strong style={{ fontSize: '0.85rem' }}>Milestone Escrow Gateway</strong>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Automates payments via USDC/EURC stablecoins. Funds are securely locked in a digital vault, released based on verified delivery milestones, and subjected to automated demurrage rules.
              </span>
            </div>
          </div>
        </div>

        {appMode === 'live' ? (
          <div>
            {contracts ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div className="flex-center" style={{ width: '48px', height: '48px', background: 'rgba(0,230,118,0.1)', borderRadius: '50%', color: 'var(--success)', margin: '0 auto 1rem' }}>
                  <ShieldCheck size={28} />
                </div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>FreightX Secure Gateways are Online!</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto 1.5rem' }}>
                  The secure protocol contracts have been deployed on Arc Testnet. You can now proceed to manage milestone escrows and purchase receivables.
                </p>
                <div className="flex-center" style={{ gap: '1rem' }}>
                  <button onClick={() => setActiveTab('escrows')} className="btn btn-primary">
                    Open Escrow Dashboard
                  </button>
                  <button onClick={handleResetContracts} className="btn btn-secondary" style={{ color: 'var(--danger)' }}>
                    Reset deployed instances
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <Clock size={16} style={{ color: 'var(--warning)', marginTop: '0.15rem' }} />
                    <div>
                      <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--warning)' }}>Deployment Requirements:</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Ensure your sandbox wallet holds gas/stablecoin balances (approx. 0.5 USDC required for deployment). Use the faucet on the left panel to top up for free.
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleDeployContracts} 
                  disabled={deploying}
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '1rem' }}
                >
                  {deploying ? (
                    <>
                      <Loader2 className="animate-spin-slow" size={18} /> {deployStatus}
                    </>
                  ) : (
                    <>
                      <Database size={18} /> Deploy Secure Trade Protocol to Arc Network
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
            <Compass size={32} style={{ color: 'var(--primary)', marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Running Offline Sandbox Simulation</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.25rem' }}>
              Sandbox mode stores simulation records locally in memory, executing instantly and at zero cost. Toggle &quot;Live Network&quot; in the header to transact on the public testnet.
            </p>
            <button onClick={() => handleModeChange('live')} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              Switch to Live Testnet
            </button>
          </div>
        )}
      </div>

      {/* FAQ section */}
      <div className="glass-panel">
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Advantage of Digital Stablecoin Escrows (USDC/EURC)</h3>
        <div className="grid-cols-2" style={{ gap: '1.25rem' }}>
          <div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>1. Milestone-Based Automated Payouts</h4>
            <p style={{ fontSize: '0.75rem' }}>
              Escrowed funds are protected and partially disbursed automatically when cold-chain telemetry verifies specific checkpoint arrivals (e.g., 30% upon clearing transit hubs), unlocking immediate liquidity.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>2. Sub-Second Instant Settlement</h4>
            <p style={{ fontSize: '0.75rem' }}>
              Settlement is confirmed in under a second. Upon final QR delivery verification, carrier fee disbursements land in driver wallets instantly, bypassing traditional net 30/90 delays.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>3. Harmonized Multi-Currency Options</h4>
            <p style={{ fontSize: '0.75rem' }}>
              Exporters and importers can select USD-pegged (USDC) or EUR-pegged (EURC) stable assets to perfectly hedge currency volatility during intercontinental transport.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>4. Embedded Purchase Order Financing</h4>
            <p style={{ fontSize: '0.75rem' }}>
              Suppliers can query capital pools for immediate PO financing from private investors. Repayments are trustlessly auto-deducted when the buyer deposits the escrow, removing default risks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
