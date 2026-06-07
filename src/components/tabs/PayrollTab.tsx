'use client';

import React, { useState } from 'react';
import { type WalletClient } from 'viem';
import { Box, Coins, Truck, Send, Loader2 } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useShipments } from '@/hooks/useShipments';
import { useAppContext } from '@/contexts/AppContext';
import { payoutCrewOnchain, saveLocalShipments, EURC_ADDRESS } from '@/services/sandbox';

export default function PayrollTab() {
  const { appMode, showToast, logTerminal, updateBalances, contracts, setActiveTab } = useAppContext();
  const { wallet, signerType, connectedAddress, browserWalletClient } = useWallet();
  const { shipments, setShipments, selectedShipmentId, loading, setLoading, refreshShipmentsList } = useShipments();

  // Local Payroll States
  const [payrollProgress, setPayrollProgress] = useState('');
  const [payrollCrew, setPayrollCrew] = useState([
    { name: 'Driver Chief (US)', address: '0x2e11a58c4bb489b3ab1c51cef8bc8757845ef80a', amount: '60' },
    { name: 'Route Navigator (EU)', address: '0x4b32D677cD6303Cec089B5F319D72aA797da53', amount: '20' }
  ]);

  if (selectedShipmentId === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem' }}>Instant Payroll & Crew Split Pay</h2>
            <p style={{ fontSize: '0.8rem' }}>Automates payout splits, routing funds instantly to harbor tolls, truck drivers, fuel merchants, and logistics staff upon delivery.</p>
          </div>
        </div>

        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
          <Coins size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>No Escrow Selected</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Please select a successfully settled shipment cargo escrow from the active registry to divide freight payouts.
          </p>
          <button onClick={() => setActiveTab('escrows')} className="btn btn-secondary">
            Go to Cargo Registry
          </button>
        </div>
      </div>
    );
  }

  const currentShipment = shipments.find(s => s.id === selectedShipmentId);
  if (!currentShipment) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <p>Cargo Shipment records not found.</p>
      </div>
    );
  }

  const tokenSymbol = currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC';

  const handlePayoutCrew = async () => {
    if (selectedShipmentId === null || !currentShipment || !wallet) return;
    setLoading(true);
    setPayrollProgress('Preparing Mass Payroll structure...');
    logTerminal(`Preparing crew payroll for Shipment #${currentShipment.id}. Carrier address: ${currentShipment.carrier}`);

    const crewAddresses = payrollCrew.map(c => c.address);
    const crewAmounts = payrollCrew.map(c => parseFloat(c.amount));
    const totalDisbursed = crewAmounts.reduce((a, b) => a + b, 0);

    if (appMode === 'local') {
      const updatedHistory = [...currentShipment.history];
      updatedHistory.push({
        timestamp: Date.now(),
        status: `Mass Payroll disbursed: ${totalDisbursed} ${tokenSymbol} split between ${payrollCrew.length} crew members.`,
        location: currentShipment.destinationPort,
        temperature: currentShipment.temperature
      });

      const updatedShipment = {
        ...currentShipment,
        releasedCarrierAmount: currentShipment.releasedCarrierAmount + totalDisbursed,
        history: updatedHistory
      };

      const updatedList = shipments.map(s => s.id === selectedShipmentId ? updatedShipment : s);
      setShipments(updatedList);
      saveLocalShipments(updatedList);

      logTerminal(`Local Mass Payroll disburse complete! Distributed ${totalDisbursed} ${tokenSymbol} to drivers.`);
      showToast('Mass Payroll disbursed locally!', 'success');
      setLoading(false);
      setPayrollProgress('');
    } else {
      // Live on chain
      if (!contracts) return;
      try {
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
        const hash = await payoutCrewOnchain(
          signer,
          contracts,
          selectedShipmentId,
          crewAddresses,
          crewAmounts,
          currentShipment.token as `0x${string}`,
          (status) => {
            setPayrollProgress(status);
            logTerminal(status);
          }
        );

        showToast('Onchain Mass Payroll Disbursed!', 'success');
        logTerminal(`Mass Pay confirmed. Tx: ${hash.slice(0, 15)}...`);
        
        await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Mass Pay failed: ${errMsg}`);
        showToast('Mass Pay disbursement failed. Check balances/allowance.', 'error');
      } finally {
        setLoading(false);
        setPayrollProgress('');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Instant Payroll & Crew Split Pay</h2>
          <p style={{ fontSize: '0.8rem' }}>Automates payout splits, routing funds instantly to harbor tolls, truck drivers, fuel merchants, and logistics staff upon delivery.</p>
        </div>
        <span className="badge badge-primary">Active Cargo Escrow: #{selectedShipmentId}</span>
      </div>

      <div className="grid-cols-2">
        
        {/* Selected cargo brief */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Box size={16} style={{ color: 'var(--primary)' }} /> Freight Payout Breakdown Ledger
          </h3>
          
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Carrier Wallet Address:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentShipment.carrier.slice(0, 12)}...{currentShipment.carrier.slice(-10)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Locked Freight Escrow Amount:</span>
              <strong>{currentShipment.shippingFee} {tokenSymbol}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Storage Demurrage Deductible:</span>
              <strong>{currentShipment.demurragePenaltyPaid} {tokenSymbol}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Net Carrier Payout Disbursed:</span>
              <strong style={{ color: 'var(--success)', fontSize: '0.9rem' }}>{currentShipment.releasedCarrierAmount} {tokenSymbol}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,136,255,0.05)', border: '1px solid rgba(0,136,255,0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}>
            <Truck size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div>
              <span><strong>Automated Multi-Party Split Pay (Circle Programmable Mass Pay):</strong> Logistics dispatchers can programmatically split the escrow freight payout among ground drivers, harbor authorities, toll agencies, and subcontractors with one unified command.</span>
            </div>
          </div>
        </div>

        {/* Split payouts control panel */}
        {currentShipment.status !== 'Completed' ? (
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem' }}>
            Awaiting physical container delivery. Mass payroll controls will become active as soon as final cargo escrow is released.
          </div>
        ) : (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={16} style={{ color: 'var(--success)' }} /> Freight Payroll & Subcontractor Payouts
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {payrollCrew.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {c.address.slice(0, 8)}...{c.address.slice(-6)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                    <input 
                      type="number" 
                      value={c.amount} 
                      onChange={(e) => {
                        const updated = [...payrollCrew];
                        updated[i].amount = e.target.value;
                        setPayrollCrew(updated);
                      }}
                      className="form-input" 
                      style={{ width: '80px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', textAlign: 'right' }} 
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{tokenSymbol}</span>
                  </div>
                </div>
              ))}
            </div>

            {payrollProgress && (
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', textAlign: 'center', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                {payrollProgress}
              </div>
            )}

            <button 
              onClick={handlePayoutCrew} 
              disabled={loading}
              className="btn btn-primary" 
              style={{ width: '100%' }}
            >
              {loading ? (
                <Loader2 className="animate-spin-slow" size={16} style={{ color: '#fff', margin: '0 auto' }} />
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <Send size={16} /> Authorize Mass Payout Splits (One-Click Settlement)
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
