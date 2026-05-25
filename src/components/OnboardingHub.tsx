'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  ArrowRight, 
  CheckCircle2, 
  Compass, 
  Activity, 
  Landmark, 
  Coins, 
  Lock, 
  Shield, 
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';

interface Shipment {
  id: number;
  status: string;
  token?: string;
  cargoValue: number;
  shippingFee: number;
  releasedSupplierAmount: number;
  releasedCarrierAmount: number;
  hasPOLoan?: boolean;
}

interface OnboardingHubProps {
  activeTab: string;
  setActiveTab: (tab: 'sandbox' | 'escrows' | 'iot' | 'payroll' | 'passport' | 'advanced') => void;
  appMode: 'live' | 'local';
  setAppMode: (mode: 'live' | 'local') => void;
  contracts: unknown;
  shipments: Shipment[];
  selectedShipmentId: number | null;
  setSelectedShipmentId: (id: number | null) => void;
}

export function OnboardingHub({
  setActiveTab,
  appMode,
  contracts,
  shipments,
  selectedShipmentId
}: OnboardingHubProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeStep, setActiveStep] = useState(1);

  const steps: { num: number; label: string; tab: 'sandbox' | 'escrows' | 'iot' | 'payroll' | 'passport' | 'advanced'; icon: React.ReactNode }[] = [
    { num: 1, label: 'Active Keys', tab: 'sandbox', icon: <Shield size={12} /> },
    { num: 2, label: 'Secure Escrow', tab: 'escrows', icon: <Landmark size={12} /> },
    { num: 3, label: 'Track Transit', tab: 'iot', icon: <Activity size={12} /> },
    { num: 4, label: 'Final Settlement', tab: 'escrows', icon: <Coins size={12} /> },
    { num: 5, label: 'Trade Passport', tab: 'passport', icon: <UserCheck size={12} /> }
  ];
  const [showDictionary, setShowDictionary] = useState(false);

  // Dynamic progress evaluation
  useEffect(() => {
    if (appMode === 'live' && !contracts) {
      setActiveStep(1); // Needs activation
    } else if (shipments.length === 0) {
      setActiveStep(2); // Needs escrow creation
    } else {
      const selected = shipments.find(s => s.id === selectedShipmentId);
      if (!selected) {
        setActiveStep(3); // Needs tracking selection
      } else if (selected.status === 'Created' || selected.status === 'In Transit') {
        setActiveStep(3); // In transit tracking
      } else if (selected.status === 'Arrived' || selected.status === 'Customs Cleared') {
        setActiveStep(4); // Demurrage / Pickup
      } else if (selected.status === 'Completed') {
        setActiveStep(5); // All complete!
      }
    }
  }, [appMode, contracts, shipments, selectedShipmentId]);

  const dictionaryItems = [
    {
      term: 'Smart Contract',
      normal: 'Digitally Autographed Smart Contract',
      desc: 'An automated agreement that executes financial actions directly when milestones are met, without needing banks or intermediates.'
    },
    {
      term: 'Escrow Account',
      normal: 'Secured Digital Vault',
      desc: 'A temporary storage holding client funds securely. The capital is only released to the transporter or seller when shipping conditions are validated.'
    },
    {
      term: 'Gas Fee',
      normal: 'Network Compute & Security Cost',
      desc: 'A tiny charge paid in USDC to write data securely onto the ledger. FreightX settles these in stable USDC behind the scenes so you do not have to purchase crypto tokens.'
    },
    {
      term: 'Invoice Factoring',
      normal: 'Instant Invoice Cash-out',
      desc: 'Allows sellers to exchange outstanding invoices for immediate working capital from institutional investors at a tiny discount.'
    },
    {
      term: 'PO Financing',
      normal: 'Pre-Shipment Manufacturing Capital',
      desc: 'Securing upfront working capital from liquidity pools based on confirmed purchase orders. The loan automatically repays when the importer deposits USDC into the escrow.'
    },
    {
      term: 'NFT / Provenance Passport',
      normal: 'Digital Journey Passport',
      desc: "A cryptographically signed, immutable digital record of a cargo's live transit telemetry, location events, and cold-chain compliance history."
    },
    {
      term: 'USYC Yield Vault',
      normal: 'Automated Treasury APY Sweep',
      desc: 'Sweeps idle capital stored within escrows to capture passive yield (~5% APY) from US Treasuries during cargo transit, returning it to the buyer at destination.'
    }
  ];

  // Dynamic system message assistant
  const getAssistantMessage = () => {
    if (appMode === 'live' && !contracts) {
      return {
        title: '👉 Step 1: Active Sandbox Keypair',
        text: 'FreightX is running live. Click "Deploy Smart Contracts" to initialize your test keys, or toggle "Simulator Mode" to run sandbox escrows instantly!',
        actionText: 'Activate Sandbox',
        action: () => setActiveTab('sandbox')
      };
    }

    if (shipments.length === 0) {
      return {
        title: '👉 Step 2: Establish Your First Escrow',
        text: 'No active shipments registered. Create a new cargo escrow transaction to see automated payment flows and multi-party milestone splits!',
        actionText: 'Create Secured Escrow',
        action: () => {
          setActiveTab('escrows');
        }
      };
    }

    const selected = shipments.find(s => s.id === selectedShipmentId);
    if (!selected) {
      return {
        title: '👉 Step 3: Interface with a Cargo Shipment',
        text: 'We found ' + shipments.length + ' active shipments. Select a cargo item from the registry below to track live routing or manage invoice financing.',
        actionText: 'Go to Cargo Registry',
        action: () => setActiveTab('escrows')
      };
    }

    if (selected.status === 'Created') {
      return {
        title: '👉 Step 3: Trigger Departure & Live Telemetry',
        text: `Cargo #${selected.id} is secured in escrow. Head to the "Transit Telemetry" tab to trigger the vessel's Port Departure!`,
        actionText: 'Track Live Telemetry',
        action: () => setActiveTab('iot')
      };
    }

    if (selected.status === 'In Transit') {
      return {
        title: '👉 Step 3: Advance Route Checkpoints',
        text: `Cargo #${selected.id} is in maritime transit. Simulate a "Singapore Checkpoint" to trigger a 30% partial payout to the supplier!`,
        actionText: 'Update Checkpoint',
        action: () => setActiveTab('iot')
      };
    }

    if (selected.status === 'Arrived') {
      return {
        title: '👉 Step 3: Record Customs Attestation',
        text: `Cargo #${selected.id} arrived at destination port. Trigger "Customs Cleared" to start the terminal storage demurrages stopwatch.`,
        actionText: 'Verify Customs',
        action: () => setActiveTab('iot')
      };
    }

    if (selected.status === 'Customs Cleared') {
      return {
        title: '👉 Step 4: Authorize Cargo Release & Payout',
        text: `Cargo #${selected.id} passed import inspections. Tap "Release Cargo & Settle" under active escrows to finalize payment splits.`,
        actionText: 'Release Cargo & Settle',
        action: () => setActiveTab('escrows')
      };
    }

    return {
      title: '🎉 Workflow Completed!',
      text: 'Delivery confirmed and multi-party funds settled instantly via automated on-chain logic. Check the Trade Passport to view updated reputation scores!',
      actionText: 'View Trade Passport',
      action: () => setActiveTab('passport')
    };
  };

  const assistant = getAssistantMessage();

  return (
    <div className="glass-panel" style={{ 
      borderColor: 'rgba(0, 136, 255, 0.4)', 
      background: 'linear-gradient(135deg, rgba(0, 136, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
      padding: '1.25rem',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      marginBottom: '1rem'
    }}>
      {/* Header and Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Sparkles size={20} style={{ color: 'var(--primary)' }} />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Interactive Guide & SME Onboarding Hub
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              FreightX translates complex blockchain infrastructure into intuitive, everyday business tools.
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={() => setShowDictionary(!showDictionary)}
            className="btn btn-secondary"
            style={{ 
              fontSize: '0.75rem', 
              padding: '0.35rem 0.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem',
              borderColor: 'rgba(255,255,255,0.08)' 
            }}
          >
            <BookOpen size={14} /> {showDictionary ? 'Hide Glossary' : 'Business Glossary'}
          </button>
          
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-muted)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Main walkthrough steps */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(5, 1fr)', 
            gap: '0.75rem',
            background: 'rgba(0,0,0,0.15)',
            padding: '0.75rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            {steps.map((step) => {
              const isActive = activeStep === step.num;
              const isCompleted = activeStep > step.num;
              return (
                <div 
                  key={step.num}
                  onClick={() => setActiveTab(step.tab)}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.35rem', 
                    cursor: 'pointer',
                    opacity: isActive ? 1 : isCompleted ? 0.9 : 0.45,
                    borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                    paddingLeft: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {isCompleted ? (
                      <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                    ) : (
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 700, 
                        width: '16px', 
                        height: '16px', 
                        borderRadius: '50%', 
                        background: isActive ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                        color: isActive ? '#fff' : 'var(--text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {step.num}
                      </span>
                    )}
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>STEP {step.num}</span>
                  </div>
                  <strong style={{ fontSize: '0.75rem', color: isActive ? 'var(--primary)' : '#fff', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {step.icon} {step.label}
                  </strong>
                </div>
              );
            })}
          </div>

          {/* Dynamic real-time assistant explainer */}
          <div style={{ 
            background: 'linear-gradient(90deg, rgba(0, 136, 255, 0.08) 0%, rgba(255,255,255,0.01) 100%)', 
            border: '1px solid rgba(0, 136, 255, 0.15)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1.5rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '75%' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Compass size={15} /> {assistant.title}
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {assistant.text}
              </p>
            </div>
            
            <button 
              onClick={assistant.action} 
              className="btn btn-primary"
              style={{ 
                fontSize: '0.75rem', 
                padding: '0.5rem 1rem', 
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              {assistant.actionText} <ArrowRight size={12} />
            </button>
          </div>

          {/* Dictionary overlay */}
          {showDictionary && (
            <div style={{ 
              background: 'var(--bg-main)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '12px', 
              padding: '1rem',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <BookOpen size={16} style={{ color: 'var(--primary)' }} />
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Translating Technical Web3 into Business Terms</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {dictionaryItems.map((item, idx) => (
                  <div key={idx} style={{ 
                    background: 'rgba(255,255,255,0.01)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '0.65rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{item.term}</span>
                      <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>Simplifying</span>
                    </div>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'block', marginBottom: '0.25rem' }}>
                      {item.normal}
                    </strong>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safety and Reassurance trust line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <Lock size={12} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Secured via automated digital signing on the Circle Arc blockchain. Settlement tokens maintain strict 1:1 parity with fiat USD.
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
