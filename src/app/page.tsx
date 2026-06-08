'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Anchor, 
  Database, 
  Wallet, 
  RefreshCw, 
  ChevronRight, 
  AlertTriangle, 
  Scale, 
  Shield, 
  Landmark, 
  Activity, 
  Coins, 
  ScanQrCode, 
  Award, 
  Loader2,
  Fingerprint,
  BarChart3
} from 'lucide-react';
import { useAccount } from 'wagmi';

import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';
import { useShipments } from '@/hooks/useShipments';
import { 
  ErrorBoundary, 
  LoadingSkeleton, 
  OnboardingHub, 
  ToastContainer,
  ArbitratorRegistry,
  DisputePanel
} from '@/components';
import { 
  SandboxTab, 
  EscrowTab, 
  IoTTab, 
  PayrollTab, 
  PassportTab, 
  AdvancedTab 
} from '@/components/tabs';

function Dashboard() {
  const router = useRouter();
  const { 
    activeTab, 
    setActiveTab, 
    appMode, 
    handleModeChange, 
    contracts, 
    handleResetContracts, 
    toasts, 
    isInitialized,
    refreshShipmentsList
  } = useAppContext();

  const { 
    wallet, 
    signerType, 
    sandboxBalances, 
    web3Balances, 
    circleSession,
    circleBalances,
    isRefreshingBalances, 
    updateBalances 
  } = useWallet();

  const { shipments, selectedShipmentId, setSelectedShipmentId } = useShipments();
  const { isConnected, address: connectedAddress } = useAccount();

  if (!isInitialized) {
    return <LoadingSkeleton />;
  }

  return (
    <ErrorBoundary>
      <div style={{ paddingBottom: '320px' }}>
        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} />

        {/* Main App Container */}
        <div className="container" style={{ paddingTop: '2.5rem' }}>
          
          {/* Page Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="glass-panel" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: '10px', borderColor: 'rgba(0,136,255,0.3)', background: 'rgba(0,136,255,0.1)' }}>
                  <Anchor size={22} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h1 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff 0%, var(--text-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>FreightX</h1>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Secure Escrows & B2B Logistics Working Capital</p>
                </div>
              </div>
            </div>

            {/* Mode & Network Selection Banner */}
            <div className="glass-panel" style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '1.5rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={16} style={{ color: appMode === 'live' ? 'var(--success)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Operating Mode:</span>
                {appMode === 'live' ? (
                  <span className="badge badge-primary" style={{ textTransform: 'none' }}>Secure Ledger Network (Arc Testnet)</span>
                ) : (
                  <span className="badge badge-muted" style={{ textTransform: 'none' }}>Visual Sandbox Simulator</span>
                )}
              </div>
              
              <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>

              <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => handleModeChange('local')} 
                  className={`btn`} 
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px', background: appMode === 'local' ? 'var(--bg-surface-elevated)' : 'transparent', color: appMode === 'local' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  Sandbox Simulator
                </button>
                <button 
                  onClick={() => handleModeChange('live')} 
                  className={`btn`} 
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px', background: appMode === 'live' ? 'var(--bg-surface-elevated)' : 'transparent', color: appMode === 'live' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  Live Network
                </button>
              </div>
            </div>
          </header>

          {/* Dashboard Main Grid layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', minHeight: '600px' }}>
            
            {/* Sidebar Area: Sandbox Wallet Widget */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Wallet Panel */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Wallet size={18} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Active Trade Wallet</h3>
                  </div>
                  <button 
                    onClick={() => {
                      if (signerType === 'circle' && circleSession?.address) {
                        updateBalances(circleSession.address, 'circle');
                      } else if (signerType === 'sandbox' && wallet?.address) {
                        updateBalances(wallet.address, 'sandbox');
                      } else if (signerType === 'web3' && connectedAddress) {
                        updateBalances(connectedAddress, 'web3');
                      }
                    }}
                    className="btn btn-secondary btn-icon" 
                    style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                    disabled={isRefreshingBalances}
                  >
                    <RefreshCw size={12} className={isRefreshingBalances ? 'animate-spin-slow' : ''} />
                  </button>
                </div>

                {/* Status Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {signerType === 'circle' ? (
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Fingerprint size={12} /> PASSKEY WALLET
                    </span>
                  ) : signerType === 'web3' ? (
                    <span className="badge badge-success" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Wallet size={12} /> WEB3 CLIENT
                    </span>
                  ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Database size={12} /> SANDBOX KEYS
                    </span>
                  )}
                  {signerType === 'circle' && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--success)', fontWeight: 'bold' }}>GASLESS SPONSORED</span>
                  )}
                </div>

                {/* Signer specific panel */}
                {signerType === 'circle' ? (
                  circleSession ? (
                    <div>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>PASSKEY USERNAME</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>{circleSession.username}</span>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>SMART ACCOUNT ADDRESS</span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{circleSession.address}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>GAS BALANCE (USDC)</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{circleBalances.nativeGas}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>USDC TOKEN</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{circleBalances.usdcToken}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>EURC TOKEN</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--success)' }}>{circleBalances.eurcToken}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg-main)', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '1.25rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>No active passkey wallet session.</span>
                      <button 
                        onClick={() => setActiveTab('sandbox')}
                        className="btn btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                      >
                        Create Passkey Wallet
                      </button>
                    </div>
                  )
                ) : signerType === 'web3' ? (
                  <div>
                    {isConnected && connectedAddress ? (
                      <div>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                          <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>CONNECTED BROWSER WALLET</span>
                          <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{connectedAddress}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>GAS / SECURITIES (USDC)</span>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{web3Balances.nativeGas}</strong>
                          </div>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>USDC BALANCE</span>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{web3Balances.usdcToken}</strong>
                          </div>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>EURC BALANCE</span>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--success)' }}>{web3Balances.eurcToken}</strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--bg-main)', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '1.25rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Browser wallet disconnected.</span>
                        <button 
                          onClick={() => setActiveTab('sandbox')}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                        >
                          Connect Wallet
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  wallet ? (
                    <div>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>SANDBOX KEYS ADDRESS</span>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{wallet.address}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>GAS / SECURITIES (USDC)</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{sandboxBalances.nativeGas}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>USDC BALANCE</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{sandboxBalances.usdcToken}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>EURC BALANCE</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--success)' }}>{sandboxBalances.eurcToken}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px' }}>
                      <Loader2 className="animate-spin-slow" size={24} />
                    </div>
                  )
                )}

                <button 
                  onClick={() => setActiveTab('sandbox')}
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                >
                  Manage Wallets <ChevronRight size={12} />
                </button>
              </div>

              {/* Smart Contract Info Panel */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={18} style={{ color: 'var(--secondary)' }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Secure Gateway Protocol</h3>
                </div>

                {appMode === 'live' ? (
                  contracts ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>ESCROW LEDGER ADDRESS</span>
                        <a href={`https://testnet.arcscan.app/address/${contracts.escrow}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                          {contracts.escrow.slice(0, 16)}...{contracts.escrow.slice(-8)}
                        </a>
                      </div>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>CARGO DIGITAL TWIN TOKEN</span>
                        <a href={`https://testnet.arcscan.app/address/${contracts.passport}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                          {contracts.passport.slice(0, 16)}...{contracts.passport.slice(-8)}
                        </a>
                      </div>
                      
                      <button 
                        onClick={handleResetContracts}
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', width: '100%', borderColor: 'rgba(255,23,68,0.2)', color: 'var(--danger)' }}
                      >
                        Reset connection settings
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', textAlign: 'center', padding: '0.5rem' }}>
                      <AlertTriangle style={{ color: 'var(--warning)', width: '28px', height: '28px' }} />
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        No active FreightX secure gateway detected on Arc Testnet.
                      </p>
                      <button 
                        onClick={() => setActiveTab('sandbox')}
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', width: '100%' }}
                      >
                        Configure Gateway
                      </button>
                    </div>
                  )
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1rem', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Using Offline Sandbox Simulator.<br />Transactions are instant and free.
                    </p>
                  </div>
                )}
              </div>

              {/* Business stats mini widget */}
              <div className="glass-panel glass-panel-accent" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Scale size={16} style={{ color: 'var(--success)' }} />
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>System Trade Costs</h4>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Escrow protection rate:</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success)' }}>0.25% cargo value</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total active/settled cargo:</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>{shipments.length}</span>
                </div>
              </div>

              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => router.push('/analytics')}
                  className="btn btn-secondary animate-pulse"
                  style={{ width: '100%', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', borderColor: 'rgba(0,184,212,0.3)', color: 'var(--primary-light)' }}
                >
                  <BarChart3 size={14} /> View Enterprise Analytics
                </button>
              </div>

            </aside>

            {/* Main workspace */}
            <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* SME Friendly Interactive Walkthrough */}
              <OnboardingHub 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                appMode={appMode} 
                setAppMode={handleModeChange} 
                contracts={contracts} 
                shipments={shipments} 
                selectedShipmentId={selectedShipmentId} 
                setSelectedShipmentId={setSelectedShipmentId} 
              />

              {/* Main Navigation tabs */}
              <div className="tab-container">
                <button onClick={() => setActiveTab('sandbox')} className={`tab-btn ${activeTab === 'sandbox' ? 'active' : ''}`}>
                  <Shield size={16} /> Gateway Hub
                </button>
                <button onClick={() => setActiveTab('escrows')} className={`tab-btn ${activeTab === 'escrows' ? 'active' : ''}`}>
                  <Landmark size={16} /> Escrow Shipments
                </button>
                <button onClick={() => setActiveTab('iot')} className={`tab-btn ${activeTab === 'iot' ? 'active' : ''}`}>
                  <Activity size={16} /> IoT Tracking
                </button>
                <button onClick={() => setActiveTab('payroll')} className={`tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}>
                  <Coins size={16} /> Instant Payroll
                </button>
                <button onClick={() => setActiveTab('passport')} className={`tab-btn ${activeTab === 'passport' ? 'active' : ''}`}>
                  <ScanQrCode size={16} /> Reputation Passports
                </button>
                <button onClick={() => setActiveTab('advanced')} className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}>
                  <Award size={16} /> Capital Marketplace
                </button>
                <button onClick={() => setActiveTab('disputes')} className={`tab-btn ${activeTab === 'disputes' ? 'active' : ''}`}>
                  <Scale size={16} /> Dispute Center
                </button>
              </div>

              {/* Tabs Content */}
              {activeTab === 'sandbox' && <SandboxTab />}
              {activeTab === 'escrows' && <EscrowTab />}
              {activeTab === 'iot' && <IoTTab />}
              {activeTab === 'payroll' && <PayrollTab />}
              {activeTab === 'passport' && <PassportTab />}
              {activeTab === 'advanced' && <AdvancedTab />}
              {activeTab === 'disputes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <ArbitratorRegistry 
                    currentAddress={signerType === 'web3' && connectedAddress ? connectedAddress : wallet?.address}
                    onRefreshBalances={() => updateBalances(signerType === 'web3' && connectedAddress ? connectedAddress : wallet?.address || '', signerType)} 
                  />
                  <DisputePanel 
                    currentAddress={signerType === 'web3' && connectedAddress ? connectedAddress : wallet?.address}
                    onRefreshShipments={() => refreshShipmentsList(appMode, contracts, wallet)} 
                  />
                </div>
              )}

            </main>
          </div>

        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingSkeleton />;
  }

  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}
