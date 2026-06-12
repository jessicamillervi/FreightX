'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Anchor, 
  Database, 
  Wallet, 
  RefreshCw, 
  ChevronRight, 
  Shield, 
  Landmark, 
  Activity, 
  Coins, 
  ScanQrCode, 
  Award, 
  Loader2,
  Fingerprint,
  Scale,
  ArrowRight,
  Package,
  CheckCircle2,
  Ship,
  FileCheck,
  CircleDollarSign,
  User,
  Settings,
  HelpCircle,
  Search
} from 'lucide-react';
import { useAccount } from 'wagmi';

import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';
import { useShipments } from '@/hooks/useShipments';
import { 
  ErrorBoundary, 
  LoadingSkeleton, 
  ToastContainer,
  ArbitratorRegistry,
  DisputePanel,
  CommandPalette
} from '@/components';
import { 
  SandboxTab, 
  EscrowTab, 
  IoTTab, 
  PayrollTab, 
  PassportTab, 
  AdvancedTab 
} from '@/components/tabs';

/* ─────────────────────────────────────────────
   WORKFLOW TIMELINE — Hero Section
   ───────────────────────────────────────────── */

function WorkflowTimeline({ 
  shipments, 
  selectedShipmentId, 
  setActiveTab,
  appMode,
  contracts
}: {
  shipments: Array<{ id: number; status: string; cargoValue: number; shippingFee: number; }>;
  selectedShipmentId: number | null;
  setActiveTab: (tab: string) => void;
  appMode: string;
  contracts: unknown;
}) {
  const steps = [
    { key: 'escrow', label: 'Escrow Created', icon: <Landmark size={15} /> },
    { key: 'transit', label: 'In Transit', icon: <Ship size={15} /> },
    { key: 'customs', label: 'Customs Check', icon: <FileCheck size={15} /> },
    { key: 'delivered', label: 'Delivered', icon: <Package size={15} /> },
    { key: 'settled', label: 'Settlement', icon: <CircleDollarSign size={15} /> },
  ];

  const selected = shipments.find(s => s.id === selectedShipmentId);
  
  let activeIndex = 0;
  if (!selected) {
    activeIndex = appMode === 'live' && !contracts ? -1 : 0;
  } else {
    switch (selected.status) {
      case 'Created': activeIndex = 0; break;
      case 'In Transit': activeIndex = 1; break;
      case 'Arrived': activeIndex = 2; break;
      case 'Customs Cleared': activeIndex = 3; break;
      case 'Completed': activeIndex = 4; break;
      default: activeIndex = 0;
    }
  }

  const progressWidth = activeIndex >= 0 ? `${(activeIndex / (steps.length - 1)) * 100}%` : '0%';

  const getAssistantMessage = () => {
    if (appMode === 'live' && !contracts) {
      return { text: 'Deploy your smart gateways on the network to begin.', action: () => setActiveTab('sandbox'), btn: 'Deploy Contracts' };
    }
    if (shipments.length === 0) {
      return { text: 'Create your first smart cargo escrow to start tracing assets.', action: () => setActiveTab('escrows'), btn: 'Create Escrow' };
    }
    if (!selected) {
      return { text: `${shipments.length} shipment pipelines found. Select one to audit details.`, action: () => setActiveTab('escrows'), btn: 'View Shipments' };
    }
    switch (selected.status) {
      case 'Created': return { text: `Escrow for Shipment #${selected.id} is funded. Trigger departure milestone to start IoT telemetry.`, action: () => setActiveTab('iot'), btn: 'Track Shipment' };
      case 'In Transit': return { text: `Shipment #${selected.id} is currently in transit. Update physical hub checkpoint.`, action: () => setActiveTab('iot'), btn: 'Update Checkpoint' };
      case 'Arrived': return { text: `Cargo has arrived. Attach customs clearance cryptograhic proof.`, action: () => setActiveTab('iot'), btn: 'Verify Customs' };
      case 'Customs Cleared': return { text: `Customs verified. Release locked stablecoins and settle carrier payouts.`, action: () => setActiveTab('escrows'), btn: 'Release & Settle' };
      case 'Completed': return { text: `Shipment #${selected.id} settled. Exporter trade passport grade is updated.`, action: () => setActiveTab('passport'), btn: 'View Passport' };
      default: return { text: 'Select a shipment pipeline to view actions.', action: () => setActiveTab('escrows'), btn: 'View Shipments' };
    }
  };

  const assistant = getAssistantMessage();

  return (
    <section className="workflow-section">
      <div className="workflow-timeline">
        <div className="workflow-progress" style={{ width: progressWidth }} />
        {steps.map((step, i) => {
          const isCompleted = activeIndex > i;
          const isActive = activeIndex === i;
          return (
            <div key={step.key} className={`workflow-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
              <div className="workflow-node">
                {isCompleted ? <CheckCircle2 size={16} /> : step.icon}
              </div>
              <span className="workflow-step-label">{step.label}</span>
            </div>
          );
        })}
      </div>

      <div className="workflow-assistant">
        <div className="workflow-assistant-text">
          <Activity size={16} style={{ color: 'var(--primary)' }} />
          <p style={{ margin: 0 }}>{assistant.text}</p>
        </div>
        <button onClick={assistant.action} className="btn btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {assistant.btn} <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   KPI GRID & TREND CHART
   ───────────────────────────────────────────── */

function MiniBarChart({ active }: { active?: boolean }) {
  return (
    <svg width="46" height="30" viewBox="0 0 46 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
      <rect x="2" y="16" width="3" height="14" rx="1.5" fill="var(--border-hover)" />
      <rect x="9" y="10" width="3" height="20" rx="1.5" fill="var(--border-hover)" />
      <rect x="16" y="20" width="3" height="10" rx="1.5" fill={active ? "var(--primary)" : "var(--border-hover)"} />
      <rect x="23" y="6" width="3" height="24" rx="1.5" fill="var(--primary)" />
      <rect x="30" y="12" width="3" height="18" rx="1.5" fill="var(--border-hover)" />
      <rect x="37" y="18" width="3" height="12" rx="1.5" fill="var(--border-hover)" />
      <rect x="44" y="8" width="3" height="22" rx="1.5" fill="var(--primary)" />
    </svg>
  );
}

function KPIGrid({ shipments, poLoansCount }: { 
  shipments: Array<{ id: number; status: string; cargoValue: number; shippingFee: number; hasPOLoan?: boolean }>;
  poLoansCount: number;
}) {
  const activeEscrows = shipments.filter(s => s.status !== 'Completed' && s.status !== 'Cancelled').length;
  const totalSecured = shipments.reduce((sum, s) => sum + s.cargoValue + s.shippingFee, 0);
  const inTransit = shipments.filter(s => s.status === 'In Transit').length;

  const cards = [
    {
      title: 'Active Escrows',
      value: activeEscrows.toString(),
      trend: '+1.4% this month',
      subtitle: `${shipments.length} total shipments`,
      active: activeEscrows > 0
    },
    {
      title: 'Secured Volume',
      value: `$${totalSecured.toLocaleString()}`,
      trend: '+12.8% vs last month',
      subtitle: 'Stablecoin total values',
      active: totalSecured > 0
    },
    {
      title: 'Active Transit',
      value: inTransit.toString(),
      trend: '+4.1% this week',
      subtitle: 'Containers mid-route',
      active: inTransit > 0
    },
    {
      title: 'Outstanding Credit',
      value: poLoansCount.toString(),
      trend: '+0.9% last quarter',
      subtitle: 'Active factoring & POs',
      active: poLoansCount > 0
    }
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c, i) => (
        <div key={i} className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="kpi-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {c.title}
              </span>
              <span className="kpi-value" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
                {c.value}
              </span>
            </div>
            <div style={{ paddingTop: '4px' }}>
              <MiniBarChart active={c.active} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '16px', 
              height: '16px', 
              borderRadius: '50%', 
              background: 'var(--success-soft)', 
              color: 'var(--success)',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              ↑
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success)' }}>
              {c.trend.split(' ')[0]}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {c.trend.split(' ').slice(1).join(' ')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShipmentTrend({ shipments }: { shipments: any[] }) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const totalBlocks = 15;
  const monthlyBlocks = [4, 5, 8, 6, 7, 11, 8, 9, 5, 7, 8, 10];
  const secondaryBlocks = [2, 3, 4, 3, 3, 5, 4, 3, 2, 3, 3, 4];
  
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(5); // default to JUN

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Shipment Volume Trend
          </span>
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '14px', 
            height: '14px', 
            borderRadius: '50%', 
            background: 'var(--bg-hover)', 
            color: 'var(--text-muted)',
            fontSize: '9px',
            cursor: 'pointer'
          }} title="YTD Cargo Volume processed through Smart Escrows">
            i
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '20px', background: 'var(--bg-hover)', border: 'none' }}>Weekly</button>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '20px', background: 'var(--primary)', color: '#FFFFFF', border: 'none' }}>Monthly</button>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '20px', background: 'var(--bg-hover)', border: 'none' }}>Yearly</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'baseline', marginBottom: '24px' }}>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Value Processed</span>
          <h3 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
            ${shipments.reduce((sum, s) => sum + s.cargoValue + s.shippingFee, 0).toLocaleString()}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
            COMPLETED VOYAGES
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)' }} />
            ACTIVE VOYAGES
          </span>
        </div>
      </div>

      {/* Grid Canvas */}
      <div style={{ position: 'relative', padding: '10px 0 20px 0' }}>
        {/* Y Axis Labels */}
        <div style={{
          position: 'absolute', left: 0, top: 10, bottom: 44, display: 'flex', flexDirection: 'column', 
          justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', width: '30px', textAlign: 'right'
        }}>
          <span>60k</span>
          <span>45k</span>
          <span>30k</span>
          <span>15k</span>
          <span>0k</span>
        </div>

        {/* Chart columns container */}
        <div style={{ marginLeft: '40px', display: 'flex', justifyContent: 'space-between', height: '180px', position: 'relative' }}>
          {/* Tooltip Popup overlay */}
          {hoveredMonth !== null && (
            <div style={{
              position: 'absolute',
              left: `calc(${(hoveredMonth / 11) * 85}% - 60px)`,
              top: '-75px',
              background: '#FFFFFF',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              boxShadow: 'var(--shadow-premium)',
              zIndex: 30,
              pointerEvents: 'none',
              width: '160px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{months[hoveredMonth]} 2026</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>• Completed</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{monthlyBlocks[hoveredMonth] * 4}k USDC</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>• Active</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{secondaryBlocks[hoveredMonth] * 4}k USDC</span>
              </div>
            </div>
          )}

          {months.map((m, monthIdx) => {
            const val = monthlyBlocks[monthIdx];
            const active = secondaryBlocks[monthIdx];
            
            return (
              <div 
                key={m} 
                onMouseEnter={() => setHoveredMonth(monthIdx)}
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '0 4px'
                }}
              >
                {/* Block Stack */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column-reverse', 
                  gap: '2px', 
                  height: '100%', 
                  width: '100%',
                  maxWidth: '32px'
                }}>
                  {Array.from({ length: totalBlocks }).map((_, blockIdx) => {
                    let fill = 'rgba(0, 0, 0, 0.03)';
                    if (blockIdx < val) {
                      fill = 'var(--primary)';
                    } else if (blockIdx < val + active) {
                      fill = 'var(--text-muted)';
                    }
                    
                    const isHovered = hoveredMonth === monthIdx;
                    
                    return (
                      <div 
                        key={blockIdx} 
                        style={{ 
                          height: '9px', 
                          background: fill, 
                          borderRadius: '1px',
                          transition: 'background 0.1s ease',
                          opacity: isHovered ? 1 : 0.85
                        }} 
                      />
                    );
                  })}
                </div>
                {/* Month Label */}
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: hoveredMonth === monthIdx ? 700 : 500, 
                  color: hoveredMonth === monthIdx ? 'var(--text-primary)' : 'var(--text-muted)',
                  marginTop: '12px' 
                }}>
                  {m}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
   ───────────────────────────────────────────── */

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
    refreshShipmentsList,
    poLoans
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

  // Get the active balance to show in sidebar/header
  const activeBalance = useMemo(() => {
    if (signerType === 'circle') return circleBalances.nativeGas;
    if (signerType === 'web3') return web3Balances.nativeGas;
    return sandboxBalances.nativeGas;
  }, [signerType, circleBalances, web3Balances, sandboxBalances]);

  const activeAddress = useMemo(() => {
    if (signerType === 'circle' && circleSession?.address) return circleSession.address;
    if (signerType === 'web3' && connectedAddress) return connectedAddress;
    return wallet?.address || '';
  }, [signerType, circleSession, connectedAddress, wallet]);

  const poLoansCount = useMemo(() => {
    return poLoans ? poLoans.filter(p => p.funded && !p.repaid).length : 0;
  }, [poLoans]);

  if (!isInitialized) {
    return <LoadingSkeleton />;
  }

  // Map tabs to titles and subtitles for dynamic header rendering
  const tabMetadata: Record<string, { title: string; desc: string }> = {
    escrows: {
      title: "Escrow Shipments",
      desc: "Fund, link purchase orders, and orchestrate cross-border trade payouts."
    },
    iot: {
      title: "IoT Telematics",
      desc: "Monitor container temperatures, gps location checkpoints, and demurrage rules in real-time."
    },
    payroll: {
      title: "Carrier Split-Pay",
      desc: "Automate driver, harbor, and subcontractor payouts directly from cleared shipping fees."
    },
    passport: {
      title: "Reputation Passports",
      desc: "Audit trade history, telemetry records, and claim W3C Verifiable Credentials."
    },
    advanced: {
      title: "Capital Marketplace",
      desc: "Apply for pre-shipment financing or trade factoring invoices at a discount."
    },
    sandbox: {
      title: "Gateway Connection",
      desc: "Manage cryptographic wallets, smart contract deployments, and testing modules."
    },
    disputes: {
      title: "Dispute Center",
      desc: "Resolve cold-chain discrepancies and handle arbitration claims with multi-sig checks."
    }
  };

  const currentMeta = tabMetadata[activeTab] || { title: "Dashboard", desc: "FreightX Logistics Console" };

  return (
    <ErrorBoundary>
      <div className="app-layout-wrapper">
        {/* Command Palette for power users */}
        <CommandPalette />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} />

        {/* ── Left Sidebar Navigation ── */}
        <aside className="app-sidebar">
          {/* Consortium/FreightX Logo Box */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FFFFFF',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: '32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF'
                }}>
                  <Anchor size={15} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>FreightX</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>Global Consortium</span>
                </div>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▼</span>
            </div>

            {/* Nav Groups */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: '8px', display: 'block', marginBottom: '8px' }}>Operations</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button 
                    onClick={() => setActiveTab('escrows')} 
                    className={`tab-btn ${activeTab === 'escrows' ? 'active' : ''}`}
                    style={{ width: '100%', justifyContent: 'flex-start', borderBottom: 'none', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Landmark size={16} /> Escrows
                  </button>
                  <button 
                    onClick={() => setActiveTab('iot')} 
                    className={`tab-btn ${activeTab === 'iot' ? 'active' : ''}`}
                    style={{ width: '100%', justifyContent: 'flex-start', borderBottom: 'none', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Activity size={16} /> IoT Telemetics
                  </button>
                  <button 
                    onClick={() => setActiveTab('disputes')} 
                    className={`tab-btn ${activeTab === 'disputes' ? 'active' : ''}`}
                    style={{ width: '100%', justifyContent: 'flex-start', borderBottom: 'none', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Scale size={16} /> Disputes
                  </button>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: '8px', display: 'block', marginBottom: '8px' }}>Trade Finance</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button 
                    onClick={() => setActiveTab('advanced')} 
                    className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
                    style={{ width: '100%', justifyContent: 'flex-start', borderBottom: 'none', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Award size={16} /> Marketplace
                  </button>
                  <button 
                    onClick={() => setActiveTab('payroll')} 
                    className={`tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}
                    style={{ width: '100%', justifyContent: 'flex-start', borderBottom: 'none', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Coins size={16} /> Crew Payroll
                  </button>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: '8px', display: 'block', marginBottom: '8px' }}>Identity & Security</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button 
                    onClick={() => setActiveTab('passport')} 
                    className={`tab-btn ${activeTab === 'passport' ? 'active' : ''}`}
                    style={{ width: '100%', justifyContent: 'flex-start', borderBottom: 'none', borderRadius: 'var(--radius-sm)' }}
                  >
                    <ScanQrCode size={16} /> Credit Passports
                  </button>
                  <button 
                    onClick={() => setActiveTab('sandbox')} 
                    className={`tab-btn ${activeTab === 'sandbox' ? 'active' : ''}`}
                    style={{ width: '100%', justifyContent: 'flex-start', borderBottom: 'none', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Shield size={16} /> Gateways
                  </button>
                </div>
              </div>
            </nav>
          </div>

          {/* Sidebar Footer Widget */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            {activeAddress && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {signerType === 'circle' ? (
                      <Fingerprint size={14} style={{ color: 'var(--primary)' }} />
                    ) : signerType === 'web3' ? (
                      <Wallet size={14} style={{ color: 'var(--success)' }} />
                    ) : (
                      <Database size={14} style={{ color: 'var(--text-secondary)' }} />
                    )}
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      if (signerType === 'circle' && circleSession?.address) updateBalances(circleSession.address, 'circle');
                      else if (signerType === 'sandbox' && wallet?.address) updateBalances(wallet.address, 'sandbox');
                      else if (signerType === 'web3' && connectedAddress) updateBalances(connectedAddress, 'web3');
                    }}
                    className="btn btn-secondary btn-icon" 
                    style={{ width: 20, height: 20, border: 'none' }}
                    disabled={isRefreshingBalances}
                  >
                    <RefreshCw size={10} className={isRefreshingBalances ? 'animate-spin-slow' : ''} />
                  </button>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                  {activeBalance} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>USDC</span>
                </div>
              </div>
            )}

            {/* Sandbox / Live toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Network Mode</span>
                <span className="network-pill" style={{ padding: '2px 8px', border: 'none', background: 'transparent' }}>
                  <span className="network-dot" style={{ background: appMode === 'live' ? 'var(--success)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: '11px' }}>{appMode === 'live' ? 'Arc Testnet' : 'Local Sandbox'}</span>
                </span>
              </div>
              <div className="mode-toggle" style={{ width: '100%' }}>
                <button 
                  onClick={() => handleModeChange('local')} 
                  className={appMode === 'local' ? 'active' : ''}
                  style={{ flex: 1, textAlign: 'center' }}
                >
                  Sandbox
                </button>
                <button 
                  onClick={() => handleModeChange('live')} 
                  className={appMode === 'live' ? 'active' : ''}
                  style={{ flex: 1, textAlign: 'center' }}
                >
                  Live L1
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content Panel ── */}
        <main className="app-main-content">
          {/* Top Navbar */}
          <header className="global-header">
            <div className="container" style={{ padding: '0 40px' }}>
              <div>
                <h2 className="section-title">{currentMeta.title}</h2>
                <p className="section-subtitle" style={{ fontSize: '12px', marginTop: 0 }}>{currentMeta.desc}</p>
              </div>
              
              <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => {
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  }}
                >
                  <Search size={14} />
                  <span>Search commands</span>
                  <kbd style={{
                    padding: '2px 4px',
                    backgroundColor: 'var(--bg-hover)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)'
                  }}>⌘K</kbd>
                </button>

                <div className="network-pill">
                  <span className="network-dot" style={{ background: appMode === 'live' ? 'var(--success)' : 'var(--text-muted)' }} />
                  {appMode === 'live' ? 'Arc L1 Testnet' : 'Sandbox Network'}
                </div>
              </div>
            </div>
          </header>

          {/* Welcome Greeting, Workflow Timeline Section, and KPI Trend */}
          <div className="container" style={{ padding: '2.5rem 40px 6rem', display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
            <div style={{ margin: 0 }}>
              <h2 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.025em', margin: 0 }}>
                Welcome back, Operator
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                Monitor international supply chain milestones, automated trade escrows, and IoT compliance rules.
              </p>
            </div>

            <WorkflowTimeline 
              shipments={shipments}
              selectedShipmentId={selectedShipmentId}
              setActiveTab={(tab: string) => setActiveTab(tab as 'sandbox' | 'escrows' | 'iot' | 'payroll' | 'passport' | 'advanced')}
              appMode={appMode}
              contracts={contracts}
            />

            {/* KPI Grid */}
            <KPIGrid shipments={shipments} poLoansCount={poLoansCount} />

            {/* Shipment Trend Chart */}
            <ShipmentTrend shipments={shipments} />

            {/* Dynamic View Panels */}
            <div className="tab-content-enter" style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
              {activeTab === 'sandbox' && <SandboxTab />}
              {activeTab === 'escrows' && <EscrowTab />}
              {activeTab === 'iot' && <IoTTab />}
              {activeTab === 'payroll' && <PayrollTab />}
              {activeTab === 'passport' && <PassportTab />}
              {activeTab === 'advanced' && <AdvancedTab />}
              {activeTab === 'disputes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
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
            </div>
          </div>
        </main>
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
