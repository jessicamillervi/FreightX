'use client';

import React, { useState, useEffect, useRef } from 'react';
import { type WalletClient } from 'viem';
import { 
  Activity, 
  Thermometer, 
  ChevronRight, 
  Shield, 
  Clock, 
  Coins, 
  Landmark, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useShipments } from '@/hooks/useShipments';
import { useAppContext } from '@/contexts/AppContext';
import { 
  triggerMilestoneOnchain, 
  pickupCargoOnchain, 
  getDemurragePenaltyOnchain, 
  offerShipmentForFactoringOnchain, 
  cancelFactoringOfferOnchain, 
  purchaseFactoredShipmentOnchain, 
  saveLocalShipments, 
  EURC_ADDRESS 
} from '@/services/sandbox';
import { type ShipmentData } from '@/lib/types';
import IoTRealtime from '../IoTRealtime';
 
export default function IoTTab() {
  const { appMode, showToast, logTerminal, updateBalances, contracts, setActiveTab } = useAppContext();
  const { wallet, signerType, connectedAddress, browserWalletClient } = useWallet();
  const { shipments, setShipments, selectedShipmentId, loading, setLoading, refreshShipmentsList } = useShipments();

  // Local Sensor Simulation States
  const [iotTemp, setIotTemp] = useState('4.2');
  const [iotProgress, setIotProgress] = useState('');
  const [demurrageMultiplier, setDemurrageMultiplier] = useState(0);
  const [simulatedTimeElapsed, setSimulatedTimeElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Local Factoring States
  const [factoringPriceInput, setFactoringPriceInput] = useState('');
  const [factoringProgress, setFactoringProgress] = useState('');

  const currentShipment = shipments.find(s => s.id === selectedShipmentId);

  // Reset timers when target shipment changes
  useEffect(() => {
    setSimulatedTimeElapsed(0);
    setDemurrageMultiplier(0);
  }, [selectedShipmentId]);

  // Demurrage Timer accelerator simulator
  useEffect(() => {
    if (demurrageMultiplier === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSimulatedTimeElapsed(prev => prev + demurrageMultiplier);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [demurrageMultiplier]);

  const demurrageHoursLate = currentShipment && currentShipment.status === 'Customs Cleared'
    ? Math.max(0, simulatedTimeElapsed - currentShipment.freeTimeHours)
    : 0;
  const simulatedDemurragePenalty = currentShipment
    ? demurrageHoursLate * currentShipment.demurrageRatePerHour
    : 0;

  // IoT Simulation Checkpoint Triggers
  const handleTriggerMilestone = async (milestone: 'departure' | 'singapore' | 'arrival' | 'customs') => {
    if (selectedShipmentId === null || !currentShipment) return;
    
    setLoading(true);
    setIotProgress(`Processing IoT payload for ${milestone.toUpperCase()}...`);
    logTerminal(`Container IoT GPS ping received. Port: ${milestone === 'singapore' ? 'Singapore' : currentShipment.destinationPort}. Temp: ${iotTemp}°C`);

    const temperature = parseFloat(iotTemp);
    const tokenSymbol = currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC';

    if (appMode === 'local') {
      const updatedHistory = [...currentShipment.history];
      let newStatus: ShipmentData['status'] = currentShipment.status;
      let newLocation = currentShipment.location;
      let releasedSupplier = currentShipment.releasedSupplierAmount;
      let arrivedTs = currentShipment.arrivedTimestamp;
      let customsTs = currentShipment.customClearanceTimestamp;

      let violations = currentShipment.temperatureViolations || 0;
      let tempPenalty = currentShipment.temperaturePenalty || 0;
      if (temperature > 8.0) {
        violations += 1;
        tempPenalty = violations * 0.05 * currentShipment.cargoValue;
        logTerminal(`[IOT PENALTY TRIGGER] Temp: ${temperature}°C (> 8.0°C). Violation logged. Deducting 5% of cargo value (${0.05 * currentShipment.cargoValue} ${tokenSymbol})`);
      }

      const timeInTransitSeconds = (Date.now() - (currentShipment.createdTimestamp || Date.now())) / 1000;
      const hoursTransit = timeInTransitSeconds / 3600;
      const simulatedYield = parseFloat((currentShipment.cargoValue * 0.05 * (hoursTransit || 0.1) / 8760).toFixed(6));

      if (milestone === 'departure') {
        newStatus = 'In Transit';
        newLocation = currentShipment.departurePort;
        updatedHistory.push({ timestamp: Date.now(), status: 'Departure Milestone', location: newLocation, temperature });
      } else if (milestone === 'singapore') {
        if (currentShipment.hasPOLoan) {
          logTerminal(`Singapore payout skipped for PO Financed shipment to avoid double payout.`);
        } else {
          releasedSupplier = currentShipment.cargoValue * 0.3; // 30% released
        }
        updatedHistory.push({ 
          timestamp: Date.now(), 
          status: currentShipment.hasPOLoan ? 'Singapore Checkpoint Passed (Financed Payout Skipped)' : `Singapore Checkpoint Passed (30% Payout Released)`, 
          location: 'Singapore Transshipment Hub', 
          temperature 
        });
      } else if (milestone === 'arrival') {
        newStatus = 'Arrived';
        newLocation = currentShipment.destinationPort;
        arrivedTs = Date.now();
        updatedHistory.push({ timestamp: Date.now(), status: 'Arrived at Destination Port', location: newLocation, temperature });
      } else if (milestone === 'customs') {
        newStatus = 'Customs Cleared';
        customsTs = Date.now();
        updatedHistory.push({ timestamp: Date.now(), status: 'Customs Cleared - Ready for Pickup', location: currentShipment.destinationPort, temperature });
      }

      const updatedShipment: ShipmentData = {
        ...currentShipment,
        status: newStatus,
        location: newLocation,
        releasedSupplierAmount: releasedSupplier,
        arrivedTimestamp: arrivedTs,
        customClearanceTimestamp: customsTs,
        temperature,
        temperatureViolations: violations,
        temperaturePenalty: tempPenalty,
        yieldEarned: simulatedYield,
        history: updatedHistory
      };

      const updatedList = shipments.map(s => s.id === selectedShipmentId ? updatedShipment : s);
      setShipments(updatedList);
      saveLocalShipments(updatedList);
      logTerminal(`Local Shipment #${currentShipment.id} state updated to: ${newStatus}`);
      showToast(`Milestone: ${milestone.toUpperCase()} updated.`, 'success');
      setLoading(false);
      setIotProgress('');
    } else {
      // Live on-chain
      if (!contracts || !wallet) return;
      try {
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
        const hash = await triggerMilestoneOnchain(
          signer,
          contracts,
          selectedShipmentId,
          milestone,
          temperature,
          (status) => {
            setIotProgress(status);
            logTerminal(status);
          }
        );

        showToast(`Milestone ${milestone.toUpperCase()} Confirmed!`, 'success');
        logTerminal(`Tx Confirmed: ${hash.slice(0, 15)}...`);

        await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Milestone failed: ${errMsg}`);
        showToast('Milestone execution failed.', 'error');
      } finally {
        setLoading(false);
        setIotProgress('');
      }
    }
  };

  // Pickup Container release disbursement
  const handlePickupCargo = async () => {
    if (selectedShipmentId === null || !currentShipment || !wallet) return;
    setLoading(true);
    const tokenSymbol = currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC';
    logTerminal(`Initiating Cargo Pickup container release. Target Shipment: #${currentShipment.id}`);

    if (appMode === 'local') {
      const penalty = simulatedDemurragePenalty;
      const tempPenalty = currentShipment.temperaturePenalty || 0;
      const yieldRebate = currentShipment.yieldEarned || 0;
      
      const platformFee = (currentShipment.cargoValue + currentShipment.shippingFee) * 0.0025;
      
      const beneficiaryAddr = currentShipment.beneficiary || currentShipment.supplier;
      const supplierPayout = Math.max(0, (currentShipment.cargoValue - currentShipment.releasedSupplierAmount) - tempPenalty - (currentShipment.cargoValue * 0.0025));
      const carrierPayout = Math.max(0, currentShipment.shippingFee - (currentShipment.shippingFee * 0.0025));

      const updatedHistory = [...currentShipment.history];
      if (penalty > 0) {
        updatedHistory.push({ 
          timestamp: Date.now(), 
          status: `Demurrage Penalty Charged: ${penalty} ${tokenSymbol} (${demurrageHoursLate} Hours Late)`, 
          location: currentShipment.destinationPort, 
          temperature: currentShipment.temperature 
        });
      }
      if (tempPenalty > 0) {
        updatedHistory.push({
          timestamp: Date.now(),
          status: `Quality Breach Temperature Penalty Applied: -${tempPenalty} ${tokenSymbol} deducted from supplier.`,
          location: currentShipment.destinationPort,
          temperature: currentShipment.temperature
        });
      }
      if (yieldRebate > 0) {
        updatedHistory.push({
          timestamp: Date.now(),
          status: `USYC Treasury Escrow Yield Rebate Paid to Buyer: +${yieldRebate} ${tokenSymbol}.`,
          location: currentShipment.destinationPort,
          temperature: currentShipment.temperature
        });
      }
      updatedHistory.push({ 
        timestamp: Date.now(), 
        status: `Cargo Delivered. Settle Beneficiary (${beneficiaryAddr.slice(0, 8)}...): ${supplierPayout} ${tokenSymbol}, Carrier: ${carrierPayout} ${tokenSymbol}. Escrow fee: ${platformFee} ${tokenSymbol}.`, 
        location: currentShipment.destinationPort, 
        temperature: currentShipment.temperature 
      });

      const updatedShipment: ShipmentData = {
        ...currentShipment,
        status: 'Completed',
        pickupTimestamp: Date.now(),
        demurragePenaltyPaid: penalty,
        history: updatedHistory
      };

      const updatedList = shipments.map(s => s.id === selectedShipmentId ? updatedShipment : s);
      setShipments(updatedList);
      saveLocalShipments(updatedList);
      
      logTerminal(`Local Shipment #${currentShipment.id} Completed! Settled beneficiary: ${supplierPayout} ${tokenSymbol}, Carrier ${carrierPayout} ${tokenSymbol}.`);
      showToast('Cargo Released & Escrow Disbursed!', 'success');
      setLoading(false);
      setDemurrageMultiplier(0);
      setSimulatedTimeElapsed(0);
    } else {
      // Live on chain
      if (!contracts) return;
      try {
        const onchainPenalty = await getDemurragePenaltyOnchain(contracts, selectedShipmentId);
        logTerminal(`Onchain Demurrage Penalty query returned: ${onchainPenalty.penaltyAmount} ${tokenSymbol} (${onchainPenalty.hoursLate} hours late)`);

        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
        const hash = await pickupCargoOnchain(
          signer,
          contracts,
          selectedShipmentId,
          onchainPenalty.penaltyAmount,
          currentShipment.token as `0x${string}`,
          (status) => {
            logTerminal(status);
          }
        );

        showToast('Cargo Picked Up & Escrow Disbursed!', 'success');
        logTerminal(`Settlement confirmed on Arc. Tx: ${hash.slice(0, 15)}...`);
        
        await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
        
        setDemurrageMultiplier(0);
        setSimulatedTimeElapsed(0);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Pickup failed: ${errMsg}`);
        showToast('Pickup transaction failed. Verify wallet approvals.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  // Receivables Factoring Offers
  const handleOfferFactoring = async (shipmentId: number, price: number) => {
    if (appMode === 'local') {
      const updated = shipments.map(s => {
        if (s.id === shipmentId) {
          return {
            ...s,
            factoringPrice: price,
            factoringActive: true
          };
        }
        return s;
      });
      setShipments(updated);
      saveLocalShipments(updated);
      showToast('Receivable offered for factoring (Local)', 'success');
      logTerminal(`Shipment #${shipmentId} receivable offered for ${price} USDC/EURC`);
    } else {
      if (!contracts || !wallet) return;
      setLoading(true);
      setFactoringProgress('Submitting factoring offer...');
      try {
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
        await offerShipmentForFactoringOnchain(signer, contracts, shipmentId, price, (status) => {
          setFactoringProgress(status);
          logTerminal(status);
        });
        showToast('Receivable offered for factoring on Arc!', 'success');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Factoring failed: ${errMsg}`);
        showToast('Factoring offer failed.', 'error');
      } finally {
        setLoading(false);
        setFactoringProgress('');
      }
    }
  };

  const handleCancelFactoring = async (shipmentId: number) => {
    if (appMode === 'local') {
      const updated = shipments.map(s => {
        if (s.id === shipmentId) {
          return {
            ...s,
            factoringActive: false
          };
        }
        return s;
      });
      setShipments(updated);
      saveLocalShipments(updated);
      showToast('Factoring offer cancelled (Local)', 'info');
    } else {
      if (!contracts || !wallet) return;
      setLoading(true);
      setFactoringProgress('Cancelling factoring offer...');
      try {
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
        await cancelFactoringOfferOnchain(signer, contracts, shipmentId, (status) => {
          setFactoringProgress(status);
          logTerminal(status);
        });
        showToast('Factoring offer cancelled on Arc!', 'success');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Factoring cancellation failed: ${errMsg}`);
        showToast('Factoring cancellation failed.', 'error');
      } finally {
        setLoading(false);
        setFactoringProgress('');
      }
    }
  };

  const handlePurchaseFactoring = async (shipmentId: number, price: number) => {
    const activeAddr = signerType === 'web3' ? connectedAddress : wallet?.address;
    if (!activeAddr) {
      showToast('No active wallet account loaded.', 'error');
      return;
    }

    if (!currentShipment) return;

    if (appMode === 'local') {
      const updated = shipments.map(s => {
        if (s.id === shipmentId) {
          return {
            ...s,
            beneficiary: activeAddr,
            factoringActive: false
          };
        }
        return s;
      });
      setShipments(updated);
      saveLocalShipments(updated);
      showToast('Factored receivable purchased (Local)!', 'success');
      logTerminal(`Factoring purchase completed for Shipment #${shipmentId}. Payout beneficiary redirected to ${activeAddr}`);
    } else {
      if (!contracts || !wallet) return;
      setLoading(true);
      setFactoringProgress('Purchasing factored receivable...');
      try {
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
        await purchaseFactoredShipmentOnchain(
          signer, 
          contracts, 
          shipmentId, 
          price, 
          currentShipment.token as `0x${string}`,
          (status) => {
            setFactoringProgress(status);
            logTerminal(status);
          }
        );
        showToast('Receivable purchased on Arc!', 'success');
        await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Purchase factoring failed: ${errMsg}`);
        showToast('Purchase factoring failed. Fund investor address.', 'error');
      } finally {
        setLoading(false);
        setFactoringProgress('');
      }
    }
  };

  if (selectedShipmentId === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem' }}>IoT Telematics Sensor Simulator</h2>
            <p style={{ fontSize: '0.8rem' }}>Simulate GPS coordinates, track cold-chain temperature thresholds, and compute real-time demurrage penalties.</p>
          </div>
        </div>

        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
          <Activity size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>No Escrow Selected</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Please return to the Escrow Shipments tab and click &quot;Track Shipments&quot; on an active escrow.
          </p>
          <button onClick={() => setActiveTab('escrows')} className="btn btn-secondary">
            Go to Escrow Shipments
          </button>
        </div>
      </div>
    );
  }

  if (!currentShipment) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <p>Cargo Shipment records not found.</p>
      </div>
    );
  }

  const isCreated = currentShipment.status === 'Created';
  const isInTransit = currentShipment.status === 'In Transit';
  const isArrived = currentShipment.status === 'Arrived';
  const isCustoms = currentShipment.status === 'Customs Cleared';
  const isCompleted = currentShipment.status === 'Completed';

  const tokenSymbol = currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC';

  let progressPercent = 0;
  if (isInTransit) progressPercent = 33;
  if (isArrived) progressPercent = 66;
  if (isCustoms) progressPercent = 85;
  if (isCompleted) progressPercent = 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>IoT Telematics Sensor Simulator</h2>
          <p style={{ fontSize: '0.8rem' }}>Simulate GPS coordinates, track cold-chain temperature thresholds, and compute real-time demurrage penalties.</p>
        </div>
        <span className="badge badge-primary">Active Cargo Escrow: #{selectedShipmentId}</span>
      </div>

      {/* Shipment Route Summary */}
      <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>TOTAL SECURED CAPITAL</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{(currentShipment.cargoValue + currentShipment.shippingFee).toLocaleString()} {tokenSymbol}</span>
        </div>
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>PORT OF DEPARTURE</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{currentShipment.departurePort}</span>
        </div>
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>PORT OF DESTINATION</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{currentShipment.destinationPort}</span>
        </div>
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>CURRENT GPS POSITION</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>{currentShipment.location || currentShipment.departurePort}</span>
        </div>
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>CONTAINER TEMPERATURE</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: currentShipment.temperature > 8.0 ? 'var(--danger)' : 'var(--success)' }}>{currentShipment.temperature}°C</span>
        </div>
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>CARGO STATUS</span>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700 }} className={currentShipment.status === 'Completed' ? 'color-success' : 'color-primary'}>
            {currentShipment.status === 'Created' ? 'Escrow Opened' :
             currentShipment.status === 'In Transit' ? 'In Transit' :
             currentShipment.status === 'Arrived' ? 'Arrived at Destination' :
             currentShipment.status === 'Customs Cleared' ? 'Customs Cleared' :
             currentShipment.status === 'Completed' ? 'Settled' : currentShipment.status}
          </span>
        </div>
      </div>

      {/* Interactive Milestone Progress Track */}
      <div className="glass-panel" style={{ padding: '2rem 1.5rem 1rem' }}>
        <div className="milestone-tracker">
          <div className="milestone-progress-bar" style={{ width: `${progressPercent}%` }}></div>
          
          <div className={`milestone-step ${isCreated || isInTransit || isArrived || isCustoms || isCompleted ? 'completed' : ''}`}>
            <div className="milestone-node">1</div>
            <span className="milestone-label">Escrow Secured</span>
          </div>
          <div className={`milestone-step ${isInTransit || isArrived || isCustoms || isCompleted ? 'completed' : ''}`}>
            <div className="milestone-node">2</div>
            <span className="milestone-label">Departed Departure Port</span>
          </div>
          <div className={`milestone-step ${isArrived || isCustoms || isCompleted ? 'completed' : ''}`}>
            <div className="milestone-node">3</div>
            <span className="milestone-label">Arrived at Destination Port</span>
          </div>
          <div className={`milestone-step ${isCustoms || isCompleted ? 'completed' : ''}`}>
            <div className="milestone-node">4</div>
            <span className="milestone-label">Customs Cleared</span>
          </div>
          <div className={`milestone-step ${isCompleted ? 'completed' : ''}`}>
            <div className="milestone-node">5</div>
            <span className="milestone-label">Delivery Completed</span>
          </div>
        </div>
      </div>

      <div className="grid-cols-2">
        
        {/* Climate Sensor Control */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Thermometer size={16} style={{ color: 'var(--danger)' }} /> Cold-Chain Telemetry & Thermal Sensors
          </h3>
          <p style={{ fontSize: '0.8rem' }}>Simulate container temperature fluctuations. If temperature exceeds the safe threshold of 8.0°C, smart contract penalties are auto-deducted from carrier payout.</p>
          
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Temperature Controller (°C)</label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input 
                type="range" 
                min="-25" 
                max="25" 
                step="0.5" 
                value={iotTemp} 
                onChange={(e) => setIotTemp(e.target.value)} 
                style={{ flex: 1, accentColor: parseFloat(iotTemp) > 8.0 ? 'var(--danger)' : 'var(--success)' }} 
                disabled={isCompleted}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, width: '70px', textAlign: 'right', color: parseFloat(iotTemp) > 8.0 ? 'var(--danger)' : 'var(--success)' }}>
                {iotTemp}°C
              </span>
            </div>
            {parseFloat(iotTemp) > 8.0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 600 }}>CRITICAL WARNING: Temperature has breached the safe cold-chain threshold!</span>
            )}
          </div>

          <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

          <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>Submit Shipment Transit Checkpoints:</h4>
          
          {iotProgress && (
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              {iotProgress}
            </div>
          )}

          {!isCompleted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => handleTriggerMilestone('departure')} 
                disabled={!isCreated}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}
              >
                <span>1. Confirm Departure from Port ({currentShipment.departurePort})</span>
                <ChevronRight size={16} />
              </button>
              
              <button 
                onClick={() => handleTriggerMilestone('singapore')} 
                disabled={!isInTransit || currentShipment.releasedSupplierAmount > 0}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}
              >
                <span>2. Arrived at Singapore Hub (Unlocks 30% Early Milestone Payout)</span>
                <Coins size={16} style={{ color: 'var(--success)' }} />
              </button>

              <button 
                onClick={() => handleTriggerMilestone('arrival')} 
                disabled={!isInTransit || (currentShipment.releasedSupplierAmount === 0 && !currentShipment.hasPOLoan)}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}
              >
                <span>3. Confirm Arrival at Destination Port ({currentShipment.destinationPort})</span>
                <ChevronRight size={16} />
              </button>

              <button 
                onClick={() => handleTriggerMilestone('customs')} 
                disabled={!isArrived}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}
              >
                <span>4. Confirm Customs Clearance Completed</span>
                <Shield size={16} style={{ color: 'var(--primary)' }} />
              </button>
            </div>
          )}

          {isCompleted && (
            <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', color: 'var(--success)', textAlign: 'center', fontWeight: 600 }}>
              Cargo successfully delivered. All secured escrow funds have been settled and disbursed.
            </div>
          )}
        </div>

        {/* Dynamic Demurrage Penalty Billing Simulator */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} style={{ color: 'var(--warning)' }} /> Demurrage Penalty & Storage Fees
          </h3>

          {isCustoms ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.15)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem' }}>
                <strong style={{ display: 'block', color: 'var(--warning)', marginBottom: '0.15rem' }}>Storage Conditions & Penalty Terms:</strong>
                Allotted discharge window (free hours): <strong>{currentShipment.freeTimeHours} Hours</strong> post customs clearance.<br />
                Demurrage penalty rate: <strong>{currentShipment.demurrageRatePerHour} {tokenSymbol}/hour</strong>.
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Time Simulation Rate</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {demurrageMultiplier === 0 ? 'PAUSED' : `${demurrageMultiplier} hours / second`}
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button onClick={() => setDemurrageMultiplier(0)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1, background: demurrageMultiplier === 0 ? 'var(--bg-surface-elevated)' : 'transparent' }}>
                    Pause
                  </button>
                  <button onClick={() => setDemurrageMultiplier(1)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1, background: demurrageMultiplier === 1 ? 'var(--bg-surface-elevated)' : 'transparent' }}>
                    1 hour/sec
                  </button>
                  <button onClick={() => setDemurrageMultiplier(4)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1, background: demurrageMultiplier === 4 ? 'var(--bg-surface-elevated)' : 'transparent' }}>
                    4 hours/sec
                  </button>
                  <button onClick={() => setDemurrageMultiplier(12)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1, background: demurrageMultiplier === 12 ? 'var(--bg-surface-elevated)' : 'transparent' }}>
                    12 hours/sec
                  </button>
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '0.75rem' }}>
                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>ELAPSED TIME</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700 }}>{simulatedTimeElapsed} Hours</span>
                </div>
                
                <div style={{ 
                  background: demurrageHoursLate > 0 ? 'rgba(255,23,68,0.1)' : 'var(--bg-main)', 
                  border: '1px solid', 
                  borderColor: demurrageHoursLate > 0 ? 'rgba(255,23,68,0.2)' : 'var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '0.75rem', 
                  textAlign: 'center' 
                }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>DEMURRAGE PENALTY INCURRED ({tokenSymbol})</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: demurrageHoursLate > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {simulatedDemurragePenalty} {tokenSymbol}
                  </span>
                </div>
              </div>

              {demurrageHoursLate > 0 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--danger)', textAlign: 'center', display: 'block', fontWeight: 600, animation: 'pulseGlow 2s infinite' }}>
                  LATE WARNING: DISCHARGE WINDOW EXCEEDED BY {demurrageHoursLate} HOURS!
                </span>
              )}

              <button 
                onClick={handlePickupCargo} 
                disabled={loading}
                className="btn btn-success" 
                style={{ padding: '0.85rem' }}
              >
                {loading ? (
                  <Loader2 className="animate-spin-slow" size={16} style={{ color: '#fff', margin: '0 auto' }} />
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    <CheckCircle2 size={16} /> Accept Container & Trigger Final Settlement
                  </span>
                )}
              </button>
            </div>
          ) : isCompleted ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Final Escrow Settlement Receipt:</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span>Storage demurrage deductions:</span>
                  <strong style={{ color: currentShipment.demurragePenaltyPaid > 0 ? 'var(--danger)' : 'inherit' }}>-{currentShipment.demurragePenaltyPaid} {tokenSymbol}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span>Thermal breach penalties:</span>
                  <strong style={{ color: (currentShipment.temperaturePenalty || 0) > 0 ? 'var(--danger)' : 'inherit' }}>-{(currentShipment.temperaturePenalty || 0)} {tokenSymbol}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span>USYC auto-yield accrued:</span>
                  <strong style={{ color: 'var(--success)' }}>+{currentShipment.yieldEarned || 0} {tokenSymbol}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                  <span>Net payout disbursed to Supplier:</span>
                  <strong>{currentShipment.releasedSupplierAmount} {tokenSymbol}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
              Demurrage timers will automatically activate once the cargo status changes to &quot;Customs Cleared&quot;.
            </div>
          )}
        </div>
      </div>

      {/* New Advanced Features Panel Grid */}
      <div className="grid-cols-2" style={{ marginTop: '0.5rem' }}>
        
        {/* USYC Yield Vault Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderColor: 'rgba(0,230,118,0.25)' }}>
          <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
            <Landmark size={18} /> Automated Treasury Yield Account (USYC)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Escrow deposits are automatically sweeped into the USYC Treasury Yield fund, earning 5% APY during transit. Accrued yield is credited to the buyer upon successful delivery.
          </p>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                <span>Annualized Yield Rate (APY)</span>
                <strong style={{ color: 'var(--success)' }}>5.00% APY</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
              <span>Principal Collateral Locked</span>
              <strong>{(currentShipment.cargoValue + currentShipment.shippingFee).toLocaleString()} {tokenSymbol}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>Accrued Yield Earned</span>
              <strong style={{ color: 'var(--success)', textShadow: '0 0 8px rgba(0,230,118,0.2)' }}>+{currentShipment.yieldEarned || 0} {tokenSymbol}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.1)', padding: '0.65rem', borderRadius: '6px' }}>
            <div className="pulsing-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
            <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>Smart Yield optimization is active and running.</span>
          </div>
        </div>

        {/* Receivables Factoring Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderColor: currentShipment.factoringActive ? 'rgba(0,136,255,0.3)' : 'var(--border-color)' }}>
          <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <Coins size={18} /> Pre-Shipment Receivable Factoring Hub
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Suppliers can auction pending escrow receivables to investors at a minor discount to unlock immediate operating liquidity, optimizing working capital.
          </p>
          
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
              <span>Escrow Receivable Sale Price</span>
              <strong>{currentShipment.factoringActive ? `${currentShipment.factoringPrice} ${tokenSymbol}` : 'Not listed'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
              <span>Current Claims Beneficiary</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{currentShipment.beneficiary ? `${currentShipment.beneficiary.slice(0, 10)}...${currentShipment.beneficiary.slice(-8)}` : 'Original Supplier'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>Assignment Status</span>
              <span className={`badge ${currentShipment.factoringActive ? 'badge-primary pulsing-glow' : 'badge-muted'}`} style={{ margin: 0, padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>
                {currentShipment.factoringActive ? 'Active Offer' : currentShipment.beneficiary && currentShipment.beneficiary !== currentShipment.supplier ? 'Transferred to Investor' : 'Unlisted'}
              </span>
            </div>
          </div>

          {loading && factoringProgress ? (
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <Loader2 className="animate-spin-slow" size={16} style={{ color: 'var(--primary)', margin: '0 auto 0.25rem' }} />
              <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{factoringProgress}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Seller side: List/Cancel */}
              {!currentShipment.beneficiary || currentShipment.beneficiary === currentShipment.supplier ? (
                !currentShipment.factoringActive ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="number"
                      placeholder={`Listing Price (${tokenSymbol})`}
                      value={factoringPriceInput}
                      onChange={(e) => setFactoringPriceInput(e.target.value)}
                      className="form-input"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                    />
                    <button 
                      onClick={() => {
                        const price = parseFloat(factoringPriceInput);
                        if (isNaN(price) || price <= 0) {
                          showToast('Please enter a valid discounted price.', 'warning');
                          return;
                        }
                        handleOfferFactoring(currentShipment.id, price);
                      }}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem' }}
                    >
                      Sell Invoice Claims
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleCancelFactoring(currentShipment.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.45rem' }}
                  >
                    Cancel Receivable Listing
                  </button>
                )
              ) : (
                <div style={{ background: 'rgba(0,136,255,0.05)', border: '1px dashed rgba(0,136,255,0.2)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', textAlign: 'center' }}>
                  Receivable has been successfully transferred to an external funder.
                </div>
              )}

              {/* Buyer side: Purchase */}
              {currentShipment.factoringActive && (
                <button 
                  onClick={() => handlePurchaseFactoring(currentShipment.id, currentShipment.factoringPrice || 0)}
                  className="btn btn-success"
                  style={{ fontSize: '0.75rem', padding: '0.45rem' }}
                >
                  Purchase invoice receivables for {currentShipment.factoringPrice} {tokenSymbol}
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      <IoTRealtime />

    </div>
  );
}
