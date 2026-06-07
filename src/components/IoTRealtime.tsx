/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  Key, 
  Send, 
  AlertTriangle, 
  CheckCircle, 
  Compass, 
  Thermometer, 
  Droplets,
  RefreshCw
} from 'lucide-react';
import { keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { useAppContext } from '@/contexts/AppContext';
import { useShipments } from '@/hooks/useShipments';

interface TelemetryReading {
  shipmentId: number;
  milestoneType: string;
  temperature: number;
  humidity: number;
  timestamp: number;
  breached: boolean;
  alertMessage: string | null;
}

export default function IoTRealtime() {
  const { appMode, contracts, wallet, showToast, logTerminal } = useAppContext();
  const { shipments, selectedShipmentId, refreshShipmentsList } = useShipments();

  const currentShipment = shipments.find(s => s.id === selectedShipmentId);

  // States
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [devicePrivateKey, setDevicePrivateKey] = useState<string>('');
  const [deviceAddress, setDeviceAddress] = useState<string>('');
  const [devicePublicKey, setDevicePublicKey] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Form states
  const [milestone, setMilestone] = useState<string>('departure');
  const [tempInput, setTempInput] = useState<string>('4.5');
  const [humidityInput, setHumidityInput] = useState<string>('55.0');
  const [isSending, setIsSending] = useState<boolean>(false);

  // Key generator
  const generateNewDevice = () => {
    try {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      const hex = '0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      setDevicePrivateKey(hex);
      
      const account = privateKeyToAccount(hex as `0x${string}`);
      setDeviceAddress(account.address);
      setDevicePublicKey(account.publicKey);
      setIsRegistered(false);
      
      logTerminal(`Generated new secure IoT device keys. Address: ${account.address}`);
      showToast('New IoT device keys generated locally.', 'success');
    } catch (err: any) {
      showToast('Failed to generate secure keys', 'error');
    }
  };

  // Check if current shipment already has an IoT Gateway set
  useEffect(() => {
    if (currentShipment && currentShipment.iotGateway && currentShipment.iotGateway !== '0x0000000000000000000000000000000000000000') {
      // If we don't have a private key locally matching it, we let the user know
      if (currentShipment.iotGateway.toLowerCase() === deviceAddress.toLowerCase()) {
        setIsRegistered(true);
      } else {
        setIsRegistered(false);
      }
    } else {
      setIsRegistered(false);
    }
  }, [currentShipment, deviceAddress]);

  // Load state from localStorage on init
  useEffect(() => {
    const savedKey = localStorage.getItem('freightx_iot_private_key');
    if (savedKey) {
      setDevicePrivateKey(savedKey);
      try {
        const account = privateKeyToAccount(savedKey as `0x${string}`);
        setDeviceAddress(account.address);
        setDevicePublicKey(account.publicKey);
      } catch {}
    } else {
      generateNewDevice();
    }
  }, []);

  // Save key locally
  useEffect(() => {
    if (devicePrivateKey) {
      localStorage.setItem('freightx_iot_private_key', devicePrivateKey);
    }
  }, [devicePrivateKey]);

  // SSE Stream Listener
  useEffect(() => {
    const eventSource = new EventSource('/api/iot/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.shipmentId === selectedShipmentId) {
          setReadings(prev => [data, ...prev].slice(0, 20));
          
          if (data.breached) {
            showToast(data.alertMessage || 'IoT Threshold breach detected!', 'error');
          } else {
            showToast(`IoT telemetry update received: ${data.temperature}°C`, 'info');
          }
        }
      } catch (err) {
        console.error('[SSE] Failed to parse event stream data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('[SSE] EventSource disconnected, reconnecting...');
    };

    return () => {
      eventSource.close();
    };
  }, [selectedShipmentId]);

  // Register device with backend
  const handleRegisterDevice = async () => {
    if (selectedShipmentId === null || !devicePublicKey) return;
    setIsRegistering(true);

    try {
      logTerminal(`Registering IoT device ${deviceAddress.slice(0, 10)}... for shipment #${selectedShipmentId}`);
      const res = await fetch('/api/iot/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: `DEV-${selectedShipmentId}-${deviceAddress.slice(2, 8).toUpperCase()}`,
          publicKey: devicePublicKey,
          shipmentId: selectedShipmentId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setIsRegistered(true);
      logTerminal(`Device registered. EVM Address: ${data.deviceAddress}. Chain Tx: ${data.txHash || 'Simulated'}`);
      showToast('IoT device registered successfully!', 'success');
      
      // Force refresh shipment list
      if (refreshShipmentsList) {
        refreshShipmentsList(appMode, contracts, wallet);
      }
    } catch (err: any) {
      console.error(err);
      logTerminal(`IoT Registration failed: ${err.message}`);
      showToast(`Registration failed: ${err.message}`, 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  // Sign and submit telemetry
  const handleSendTelemetry = async () => {
    if (selectedShipmentId === null || !devicePrivateKey) return;
    setIsSending(true);

    try {
      const temperatureRaw = Math.round(parseFloat(tempInput) * 100);
      const humidityRaw = Math.round(parseFloat(humidityInput) * 100);
      const timestamp = Math.floor(Date.now() / 1000);

      // Reconstruct hash client-side to sign
      const messageHash = keccak256(
        encodePacked(
          ['uint256', 'string', 'int256', 'uint256', 'uint256'],
          [BigInt(selectedShipmentId), milestone, BigInt(temperatureRaw), BigInt(humidityRaw), BigInt(timestamp)]
        )
      );

      // Sign the message hash using the device account
      const account = privateKeyToAccount(devicePrivateKey as `0x${string}`);
      const signature = await account.signMessage({
        message: { raw: messageHash }
      });

      logTerminal(`[IoT Device] Telemetry signed. Signature: ${signature.slice(0, 18)}...`);

      const res = await fetch('/api/iot/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: selectedShipmentId,
          milestoneType: milestone,
          temperature: temperatureRaw,
          humidity: humidityRaw,
          timestamp,
          signature
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ingestion failed');

      logTerminal(`[IoT Relay] Telemetry ingested. On-chain relay: ${data.onChainRelayed ? 'Yes' : 'No'}. Tx: ${data.txHash || 'Local-only'}`);
      showToast('Telemetry signature submitted!', 'success');
    } catch (err: any) {
      console.error(err);
      logTerminal(`Telemetry ingest failed: ${err.message}`);
      showToast(`Ingestion failed: ${err.message}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (selectedShipmentId === null || !currentShipment) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      {/* Device Credentials and Configuration Card */}
      <div className="glass-panel" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Cpu size={18} style={{ color: 'var(--primary)' }} /> Live Hardware Device Registry
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Derive an ECDSA cryptographic keypair for the cold-chain telemetry device. Bind the hardware signature to this shipment to enforce trustless oracle execution.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          {/* Key fields */}
          <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>EVM ADDRESS:</span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }} className="badge badge-muted">
                {deviceAddress || 'Generating...'}
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PUBLIC KEY:</span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', maxHeight: '50px', overflowY: 'auto' }}>
                {devicePublicKey ? `${devicePublicKey.slice(0, 30)}...` : 'Generating...'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PRIVATE KEY:</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', filter: 'blur(4px)' }}>
                  {devicePrivateKey ? devicePrivateKey.slice(0, 20) + '...' : ''}
                </span>
                <button onClick={generateNewDevice} className="btn-icon-secondary" title="Regenerate Device Keys">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {isRegistered ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(0, 230, 118, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)' }}>Device Bound to Shipment</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>On-chain gateway registered. Accepting signed telemetry.</span>
              </div>
            ) : (
              <button 
                onClick={handleRegisterDevice}
                disabled={isRegistering || selectedShipmentId === null}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
              >
                {isRegistering ? (
                  <>
                    <RefreshCw size={16} className="animate-spin-slow" style={{ marginRight: '0.5rem' }} />
                    Binding Gateway...
                  </>
                ) : (
                  <>
                    <Key size={16} style={{ marginRight: '0.5rem' }} />
                    Bind & Register Device
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid-cols-2">
        
        {/* Device Telemetry Simulator form */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={16} /> Device Telemetry Transmitter
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Simulate the device hardware sending signed sensor data packet to `/api/iot/ingest`. If milestone criteria matches, the oracle relays it on-chain.
          </p>

          <div className="form-group">
            <label className="form-label">Active Milestone / Telemetry Type</label>
            <select 
              value={milestone} 
              onChange={(e) => setMilestone(e.target.value)} 
              className="form-control"
              style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', padding: '0.5rem' }}
            >
              <option value="departure">1. Departure ({currentShipment.departurePort})</option>
              <option value="singapore">2. Singapore Checkpoint</option>
              <option value="arrival">3. Arrival ({currentShipment.destinationPort})</option>
              <option value="customs">4. Customs Clearance</option>
              <option value="telemetry">Periodic Telemetry Update</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Temperature (°C)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Thermometer size={14} style={{ color: 'var(--danger)' }} />
                <input 
                  type="number" 
                  step="0.1" 
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', background: 'var(--bg-main)' }}
                />
              </div>
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Humidity (%)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Droplets size={14} style={{ color: 'var(--primary)' }} />
                <input 
                  type="number" 
                  step="0.5" 
                  value={humidityInput}
                  onChange={(e) => setHumidityInput(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', background: 'var(--bg-main)' }}
                />
              </div>
            </div>
          </div>

          <button 
            onClick={handleSendTelemetry}
            disabled={isSending || !isRegistered}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', gap: '0.5rem' }}
          >
            {isSending ? (
              <>
                <RefreshCw size={14} className="animate-spin-slow" />
                Signing & Transmitting...
              </>
            ) : (
              <>
                <Send size={14} />
                Transmit Cryptographic Telemetry
              </>
            )}
          </button>
        </div>

        {/* Real-time Streaming Monitor log */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '380px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} className="pulsing-glow" style={{ color: 'var(--success)' }} /> Realtime SSE Stream Monitor
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>SSE Live Feed</span>
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Real-time telemetry event messages broadcast from server-sent events stream:
          </p>

          <div style={{ 
            flex: 1, 
            background: 'rgba(0,0,0,0.2)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px', 
            padding: '0.75rem', 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.7rem', 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            minHeight: '180px'
          }}>
            {readings.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '3rem' }}>
                Awaiting real-time telemetry stream packets...
              </div>
            ) : (
              readings.map((r, i) => (
                <div 
                  key={i} 
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    paddingBottom: '0.4rem',
                    color: r.breached ? 'var(--danger)' : 'inherit'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700 }}>[{new Date(r.timestamp * 1000).toLocaleTimeString()}] Milestone: {r.milestoneType.toUpperCase()}</span>
                    <span>{r.breached ? '⚠️ BREACHED' : '✅ OK'}</span>
                  </div>
                  <div>Temp: {r.temperature}°C | Humidity: {r.humidity}%</div>
                  {r.alertMessage && <div style={{ fontSize: '0.65rem', marginTop: '0.1rem' }}>{r.alertMessage}</div>}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
