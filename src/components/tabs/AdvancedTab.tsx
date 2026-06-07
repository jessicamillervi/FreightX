'use client';

import React, { useState } from 'react';
import { type WalletClient } from 'viem';
import { 
  Activity, 
  ShieldCheck, 
  Send, 
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useShipments } from '@/hooks/useShipments';
import { useAppContext } from '@/contexts/AppContext';
import { 
  setIotGatewayOnchain, 
  signIoTPayloadOnchain, 
  signIoTPayloadWithWalletClient, 
  triggerMilestoneWithIoTSignatureOnchain, 
  wrapEscrowInUSYCOnchain, 
  redeemUSYCOnchain, 
  saveLocalShipments, 
  EURC_ADDRESS 
} from '@/services/sandbox';
import { BridgeFunding } from '../BridgeFunding';

export default function AdvancedTab() {
  const { appMode, showToast, logTerminal, contracts } = useAppContext();
  const { wallet, signerType, connectedAddress, browserWalletClient } = useWallet();
  const { shipments, setShipments, selectedShipmentId, loading, setLoading, refreshShipmentsList } = useShipments();

  // Local Advanced Tab States
  const [iotMilestone, setIotMilestone] = useState<'departure' | 'singapore' | 'arrival' | 'customs'>('departure');
  const [iotTemp, setIotTemp] = useState('4.2');
  const [iotHumidity, setIotHumidity] = useState<number>(65);

  const currentShipment = shipments.find(s => s.id === selectedShipmentId);

  if (selectedShipmentId === null || !currentShipment) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Advanced Trade Expansion Engine</h2>
          <p style={{ fontSize: '0.8rem' }}>Explore three corporate expansion modules: Secp256k1 IoT Sensor Gateway, USYC Treasury Sweeps, and Circle CCTP Cross-Chain liquidity rails.</p>
        </div>

        <div className="glass-panel" style={{ borderLeft: '3px solid var(--primary)' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Activity size={18} style={{ color: 'var(--primary)' }} /> Cryptographic Hardware IoT Sensor Gateway
          </h3>
          <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
            Bind a hardware IoT device wallet address to the cargo container. Periodic telemetry reports are cryptographically signed by the device&apos;s hardware enclave key (ECDSA). The smart contract performs standard <code>ecrecover</code> validation to verify authentic telemetry, neutralizing spoofing risks.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Please select a cargo shipment from the registry to interface with the hardware sensor emulator.</p>
          </div>
        </div>

        <div className="glass-panel" style={{ borderLeft: '3px solid var(--success)' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp size={18} style={{ color: 'var(--success)' }} /> USYC Automated Yield Sweep Vault (ERC-4626)
          </h3>
          <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
            Sweeps idle escrow collateral into institutional-grade USYC US Treasury Bills to capture a stable 5% APY yield. Accrued yield builds automatically during shipment transit and is returned to the buyer upon successful cargo receipt.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Please select a cargo shipment from the registry to sweep collateral into the Treasury Yield Vault.</p>
          </div>
        </div>

        <div className="glass-panel" style={{ borderLeft: '3px solid var(--secondary)' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Send size={18} style={{ color: 'var(--secondary)' }} /> Cross-Chain Escrow Funding (Circle CCTP)
          </h3>
          <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
            Sponsors, importers, and lenders on public EVM networks (Arbitrum, Avalanche, Mainnet) can instantly fund FreightX escrows using Circle&apos;s Cross-Chain Transfer Protocol (CCTP). CCTP burns origin-chain USDC and mints native gas-stable USDC on Arc with 1:1 parity and sub-second finality.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Please select a cargo shipment from the registry to simulate CCTP cross-chain funding.</p>
          </div>
        </div>
      </div>
    );
  }

  const tokenSymbol = currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.3rem' }}>Advanced Trade Expansion Engine</h2>
        <p style={{ fontSize: '0.8rem' }}>Explore three corporate expansion modules: Secp256k1 IoT Sensor Gateway, USYC Treasury Sweeps, and Circle CCTP Cross-Chain liquidity rails.</p>
      </div>

      {/* Feature 1: IoT Device Gateway */}
      <div className="glass-panel" style={{ borderLeft: '3px solid var(--primary)' }}>
        <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Activity size={18} style={{ color: 'var(--primary)' }} /> Cryptographic Hardware IoT Sensor Gateway
        </h3>
        <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Bind a hardware IoT device wallet address to the cargo container. Periodic telemetry reports are cryptographically signed by the device&apos;s hardware enclave key (ECDSA). The smart contract performs standard <code>ecrecover</code> validation to verify authentic telemetry, neutralizing spoofing risks.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>Register IoT Telemetry Device</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cargo #{selectedShipmentId} — Status: {
                currentShipment.status === 'Created' ? 'Escrow Secured' :
                currentShipment.status === 'In Transit' ? 'In Transit' :
                currentShipment.status === 'Arrived' ? 'Arrived at Port' :
                currentShipment.status === 'Customs Cleared' ? 'Customs Cleared' :
                currentShipment.status === 'Completed' ? 'Delivery Completed' : currentShipment.status
              }</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Connected Device Address: <strong style={{ color: currentShipment.iotGateway && currentShipment.iotGateway !== '0x0000000000000000000000000000000000000000' ? 'var(--success)' : 'var(--text-muted)' }}>
                  {currentShipment.iotGateway && currentShipment.iotGateway !== '0x0000000000000000000000000000000000000000' ? `${currentShipment.iotGateway.slice(0,10)}...` : 'None bound'}
                </strong>
              </div>
              <button
                disabled={loading || currentShipment.status !== 'Created'}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%', marginTop: '0.5rem' }}
                onClick={async () => {
                  if (!wallet) return;
                  setLoading(true);
                  const gateway = wallet.address;
                  logTerminal(`Registering hardware IoT sensor device: ${gateway} for cargo #${selectedShipmentId}`);
                  if (appMode === 'local') {
                    const updated = shipments.map(s => s.id === selectedShipmentId ? { ...s, iotGateway: gateway } : s);
                    setShipments(updated);
                    saveLocalShipments(updated);
                    showToast('IoT sensor device successfully bound (Local Sandbox mode)!', 'success');
                    logTerminal(`Bound device telemetry listener (Local): ${gateway}`);
                  } else if (contracts) {
                    try {
                      const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
                      await setIotGatewayOnchain(signer, contracts, selectedShipmentId, gateway, (s) => { logTerminal(s); });
                      showToast('IoT hardware signature successfully registered on-chain!', 'success');
                      await refreshShipmentsList('live', contracts, wallet);
                    } catch (err) { logTerminal(`Hardware device registration failed: ${err instanceof Error ? err.message : String(err)}`); showToast('Failed to register IoT telemetry device.', 'error'); }
                  }
                  setLoading(false);
                }}
              >
                Register Sandbox Key as Active IoT Sensor
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--secondary)' }}>Live Sensor Telemetry Metrics</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Core Ambient Temp:</span><strong style={{ color: currentShipment.temperature > 8 ? 'var(--danger)' : 'var(--success)' }}>{currentShipment.temperature}°C</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Relative Humidity:</span><strong>{currentShipment.humidity || 0}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Thermal Breach Alarms:</span><strong style={{ color: (currentShipment.temperatureViolations || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>{currentShipment.temperatureViolations || 0} times</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Signature Algorithm:</span><span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>ECDSA secp256k1</span></div>
            </div>
          </div>
        </div>

        {/* Cryptographic Transmission Panel */}
        {currentShipment.iotGateway && currentShipment.iotGateway !== '0x0000000000000000000000000000000000000000' && (
          <div style={{ marginTop: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={16} /> Simulate Secure Hardware Key Signatures (ECDSA)
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Simulate secure hardware encryption. We sign cargo telemetry metrics with the device&apos;s private key, generating cryptographic proof that is parsed on-chain by public keys for zero-trust delivery verification.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Simulated Route Checkpoint</label>
                <select 
                  className="form-control" 
                  style={{ fontSize: '0.8rem', padding: '0.4rem', background: '#04060a', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px' }}
                  value={iotMilestone}
                  onChange={(e) => setIotMilestone(e.target.value as 'departure' | 'singapore' | 'arrival' | 'customs')}
                >
                  <option value="departure" disabled={currentShipment.status !== 'Created'}>1. Confirm Port Departure</option>
                  <option value="singapore" disabled={currentShipment.status !== 'In Transit' || currentShipment.releasedSupplierAmount > 0}>2. Arrived Singapore Hub (Triggers 30% release)</option>
                  <option value="arrival" disabled={currentShipment.status !== 'In Transit' || (currentShipment.releasedSupplierAmount === 0 && !currentShipment.hasPOLoan)}>3. Arrived Destination Port</option>
                  <option value="customs" disabled={currentShipment.status !== 'Arrived'}>4. Customs Cleared & Storage Timers On</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Simulated Temperature (°C)</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min="-10" 
                    max="20" 
                    step="0.5" 
                    value={iotTemp} 
                    onChange={(e) => setIotTemp(e.target.value)} 
                    style={{ flex: 1, accentColor: parseFloat(iotTemp) > 8 ? 'var(--danger)' : 'var(--success)' }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '45px', textAlign: 'right' }}>{iotTemp}°C</span>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Simulated Humidity (%)</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min="20" 
                    max="95" 
                    step="1" 
                    value={iotHumidity} 
                    onChange={(e) => setIotHumidity(parseInt(e.target.value))} 
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '35px', textAlign: 'right' }}>{iotHumidity}%</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                disabled={loading || currentShipment.status === 'Completed' || currentShipment.status === 'Cancelled'}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                onClick={async () => {
                  setLoading(true);
                  const ts = Math.floor(Date.now() / 1000);
                  const temp = parseFloat(iotTemp);
                  logTerminal(`Generating ECDSA hardware keyspace signature for route milestone "${iotMilestone}"...`);
                  
                  if (appMode === 'local') {
                    logTerminal(`[ECDSA SIGNATURE] Generating hardware-attested signature from device wallet: ${currentShipment.iotGateway}`);
                    logTerminal(`Payload: ShipmentId=${selectedShipmentId}, Milestone=${iotMilestone}, Temp=${temp}°C, Humidity=${iotHumidity}%, Timestamp=${ts}`);
                    logTerminal(`[SOLIDITY ecrecover PASS] Signature verified. Recovered Signer: ${currentShipment.iotGateway} (MATCHES BOUND HARDWARE DEVICE)`);
                    
                    const updatedHistory = [...currentShipment.history];
                    let newStatus = currentShipment.status;
                    let newLocation = currentShipment.location;
                    let releasedSupplier = currentShipment.releasedSupplierAmount;
                    let arrivedTs = currentShipment.arrivedTimestamp;
                    let customsTs = currentShipment.customClearanceTimestamp;
                    let violations = currentShipment.temperatureViolations || 0;
                    let tempPenalty = currentShipment.temperaturePenalty || 0;

                    if (temp > 8.0) {
                      violations += 1;
                      tempPenalty = violations * 0.05 * currentShipment.cargoValue;
                    }

                    if (iotMilestone === 'departure') {
                      newStatus = 'In Transit';
                      newLocation = currentShipment.departurePort;
                      updatedHistory.push({ timestamp: Date.now(), status: 'Departure Milestone (Verified IoT Telemetry)', location: newLocation, temperature: temp });
                    } else if (iotMilestone === 'singapore') {
                      if (!currentShipment.hasPOLoan) {
                        releasedSupplier = currentShipment.cargoValue * 0.3;
                      }
                      updatedHistory.push({ timestamp: Date.now(), status: 'Singapore Hub Checkpoint (Verified IoT Telemetry)', location: 'Singapore Transshipment Hub', temperature: temp });
                    } else if (iotMilestone === 'arrival') {
                      newStatus = 'Arrived';
                      newLocation = currentShipment.destinationPort;
                      arrivedTs = Date.now();
                      updatedHistory.push({ timestamp: Date.now(), status: 'Destination Port Arrival (Verified IoT Telemetry)', location: newLocation, temperature: temp });
                    } else if (iotMilestone === 'customs') {
                      newStatus = 'Customs Cleared';
                      customsTs = Date.now();
                      updatedHistory.push({ timestamp: Date.now(), status: 'Customs Clearance Completed (Verified IoT Telemetry)', location: currentShipment.destinationPort, temperature: temp });
                    }

                    const updatedShipment = {
                      ...currentShipment,
                      status: newStatus,
                      location: newLocation,
                      releasedSupplierAmount: releasedSupplier,
                      arrivedTimestamp: arrivedTs,
                      customClearanceTimestamp: customsTs,
                      temperature: temp,
                      humidity: iotHumidity,
                      temperatureViolations: violations,
                      temperaturePenalty: tempPenalty,
                      history: updatedHistory
                    };

                    const updatedList = shipments.map(s => s.id === selectedShipmentId ? updatedShipment : s);
                    setShipments(updatedList);
                    saveLocalShipments(updatedList);
                    showToast('Simulated secure routing update verified successfully (Local)!', 'success');
                  } else {
                    // Live mode
                    if (!contracts || !wallet) {
                      showToast('Sandbox keypair not initialized.', 'error');
                      setLoading(false);
                      return;
                    }
                    try {
                      // 1. Sign payload
                      let signature = '';
                      if (signerType === 'web3') {
                        if (!browserWalletClient || !connectedAddress) {
                          showToast('Web3 browser wallet not connected.', 'error');
                          setLoading(false);
                          return;
                        }
                        signature = await signIoTPayloadWithWalletClient(
                          browserWalletClient as WalletClient,
                          connectedAddress,
                          selectedShipmentId,
                          iotMilestone,
                          temp,
                          iotHumidity,
                          ts
                        );
                      } else {
                        signature = await signIoTPayloadOnchain(
                          wallet.privateKey,
                          selectedShipmentId,
                          iotMilestone,
                          temp,
                          iotHumidity,
                          ts
                        );
                      }

                      logTerminal(`ECDSA cryptographically signed proof: ${signature.slice(0, 30)}...`);
                      logTerminal(`Transmitting verified proof packet to on-chain token contracts...`);

                      const txSigner = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
                      const txHash = await triggerMilestoneWithIoTSignatureOnchain(
                        txSigner,
                        contracts,
                        selectedShipmentId,
                        iotMilestone,
                        temp,
                        iotHumidity,
                        ts,
                        signature,
                        (s) => logTerminal(s)
                      );

                      showToast(`Route milestone ${iotMilestone.toUpperCase()} successfully updated and verified on-chain!`, 'success');
                      logTerminal(`Transaction receipt hash: ${txHash}`);
                      
                      await refreshShipmentsList('live', contracts, wallet);
                    } catch (err) {
                      const errMsg = err instanceof Error ? err.message : String(err);
                      logTerminal(`IoT telemetry transmission failed: ${errMsg}`);
                      showToast('Hardware signature failed to verify on-chain.', 'error');
                    }
                  }
                  setLoading(false);
                }}
              >
                <Send size={14} /> Sign ECDSA Proof & Transmit Telemetry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature 2: USYC Yield Vault */}
      <div className="glass-panel" style={{ borderLeft: '3px solid var(--success)' }}>
        <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--success)' }} /> USYC Automated Yield Sweep Vault (ERC-4626)
        </h3>
        <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Sweeps idle escrow collateral into institutional-grade USYC US Treasury Bills to capture a stable 5% APY yield. Accrued yield builds automatically during shipment transit and is returned to the buyer upon successful cargo receipt.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--success)' }}>Yield Sweep Controls</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Active Escrow Balance: {(currentShipment.cargoValue + currentShipment.shippingFee - currentShipment.releasedSupplierAmount).toLocaleString()} {tokenSymbol}</div>
              <div style={{ fontSize: '0.7rem', color: currentShipment.usycWrapped ? 'var(--success)' : 'var(--text-muted)' }}>Yield Sweep Status: {currentShipment.usycWrapped ? '✓ Active Yielding' : '✗ Inactive'}</div>
              <button
                disabled={loading || currentShipment.usycWrapped || currentShipment.status !== 'Created'}
                className="btn btn-success"
                style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%', marginTop: '0.25rem' }}
                onClick={async () => {
                  if (!wallet) return;
                  setLoading(true);
                  if (appMode === 'local') {
                    const updated = shipments.map(s => s.id === selectedShipmentId ? { ...s, usycWrapped: true, usycShares: s.cargoValue + s.shippingFee - s.releasedSupplierAmount } : s);
                    setShipments(updated);
                    saveLocalShipments(updated);
                    showToast('Collateral successfully swept into USYC Yield Fund (Local)!', 'success');
                    logTerminal(`USYC Yield Sweep (Local): Successfully deposited collateral ${currentShipment.cargoValue + currentShipment.shippingFee}`);
                  } else if (contracts) {
                    try {
                      const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
                      await wrapEscrowInUSYCOnchain(signer, contracts, selectedShipmentId, (s) => { logTerminal(s); });
                      showToast('Collateral successfully swept into USYC Yield Vault on-chain!', 'success');
                      await refreshShipmentsList('live', contracts, wallet);
                    } catch (err) { logTerminal(`Yield vault sweep failed: ${err instanceof Error ? err.message : String(err)}`); showToast('Failed to sweep collateral to yield vault.', 'error'); }
                  }
                  setLoading(false);
                }}
              >
                <TrendingUp size={14} /> Sweep Escrow Collateral to USYC Yield Vault
              </button>
              <button
                disabled={loading || !currentShipment.usycWrapped}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%' }}
                onClick={async () => {
                  if (!wallet) return;
                  setLoading(true);
                  if (appMode === 'local') {
                    const elapsed = (Date.now() - (currentShipment.createdTimestamp || Date.now())) / 1000;
                    const principal = currentShipment.cargoValue + currentShipment.shippingFee;
                    const yieldAmt = parseFloat((principal * 0.05 * elapsed / (365 * 24 * 3600)).toFixed(6));
                    const updated = shipments.map(s => s.id === selectedShipmentId ? { ...s, usycWrapped: false, usycShares: 0, yieldEarned: yieldAmt } : s);
                    setShipments(updated);
                    saveLocalShipments(updated);
                    showToast(`Successfully redeemed USYC yield sweep! Net yield accrued: ${yieldAmt}`, 'success');
                    logTerminal(`Yield Sweep Redemption (Local): Principal released, yield realized = ${yieldAmt}`);
                  } else if (contracts) {
                    try {
                      const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
                      await redeemUSYCOnchain(signer, contracts, selectedShipmentId, (s) => { logTerminal(s); });
                      showToast('Successfully redeemed yield-bearing shares on-chain!', 'success');
                      await refreshShipmentsList('live', contracts, wallet);
                    } catch (err) { logTerminal(`Yield sweep redemption failed: ${err instanceof Error ? err.message : String(err)}`); showToast('Failed to redeem yield-bearing shares.', 'error'); }
                  }
                  setLoading(false);
                }}
              >
                Redeem Escrow Collateral & Claim Yield
              </button>
            </div>
          </div>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--success)' }}>Treasury Yield Analytics</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Expected Treasury APY:</span><strong style={{ color: 'var(--success)' }}>5.00% APY</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Yield Fund Shares:</span><strong>{currentShipment.usycShares || 0} shares</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Net Yield Accrued:</span><strong style={{ color: 'var(--success)' }}>{currentShipment.yieldEarned || 0} {tokenSymbol}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Underlying Fund:</span><span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Hashnote USYC</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>ERC Standard Specification:</span><span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>ERC-4626</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 3: CCTP Cross-Chain Bridge */}
      <div className="glass-panel" style={{ borderLeft: '3px solid var(--secondary)' }}>
        <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Send size={18} style={{ color: 'var(--secondary)' }} /> Cross-Chain Escrow Funding (Circle CCTP)
        </h3>
        <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Sponsors, importers, and lenders on public EVM networks (Arbitrum, Avalanche, Mainnet) can instantly fund FreightX escrows using Circle&apos;s Cross-Chain Transfer Protocol (CCTP). CCTP burns origin-chain USDC and mints native gas-stable USDC on Arc with 1:1 parity and sub-second finality.
        </p>

        {currentShipment.cctpSourceTxHash && currentShipment.cctpSourceTxHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && currentShipment.cctpSourceTxHash !== '' ? (
          <div style={{
            background: 'rgba(0, 230, 118, 0.05)',
            border: '1px solid rgba(0, 230, 118, 0.15)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} style={{ color: '#00e676' }} />
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Shipment Escrow Fully Funded</strong>
            </div>
            <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Source Chain Domain:</span>
                <strong>{currentShipment.cctpSourceDomain === 0 ? 'Ethereum Sepolia (Domain 0)' : currentShipment.cctpSourceDomain === 3 ? 'Arbitrum Sepolia (Domain 3)' : `Domain ${currentShipment.cctpSourceDomain}`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Source Burn Tx Hash:</span>
                <a
                  href={`https://${currentShipment.cctpSourceDomain === 0 ? 'sepolia.etherscan.io' : 'sepolia.arbiscan.io'}/tx/${currentShipment.cctpSourceTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#00b0ff', fontFamily: 'var(--font-mono)' }}
                >
                  {currentShipment.cctpSourceTxHash.slice(0, 24)}...
                </a>
              </div>
            </div>
          </div>
        ) : (
          <BridgeFunding
            shipmentId={selectedShipmentId}
            requiredAmount={currentShipment.cargoValue + currentShipment.shippingFee}
            onComplete={async () => {
              if (appMode === 'live' && contracts) {
                await refreshShipmentsList('live', contracts, wallet);
              } else {
                const fakeTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
                const updated = shipments.map(s => s.id === selectedShipmentId ? { ...s, cctpSourceDomain: 3, cctpSourceTxHash: fakeTxHash } : s);
                setShipments(updated);
                saveLocalShipments(updated);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
