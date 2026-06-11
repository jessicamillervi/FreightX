/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  History, 
  Database, 
  Play, 
  ShieldCheck, 
  TrendingUp, 
  Clock 
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';

export default function NanopayRevenue({ shipmentId }: { shipmentId: number | null }) {
  const { showToast, logTerminal } = useAppContext();
  const { wallet } = useWallet();

  // Balance and ledger states
  const [buyerBalance, setBuyerBalance] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<string>('5.00');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Simulation states
  const [simResult, setSimResult] = useState<any>(null);
  const [simType, setSimType] = useState<'reading' | 'history' | null>(null);

  const buyerAddress = wallet?.address || '0x9b1C51CEF8BC8757Ad757845eF80a390A3b9D194';
  const sellerAddress = process.env.NEXT_PUBLIC_GATEWAY_SELLER_ADDRESS || '0x9b1C51CEF8BC8757Ad757845eF80a390A3b9D194';

  // Fetch buyer deposit balance
  const fetchBalance = async () => {
    try {
      const res = await fetch(`/api/telemetry/deposit?buyerAddress=${buyerAddress}`);
      const data = await res.json();
      if (data.success) {
        setBuyerBalance(data.balance);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  // Fetch payment logs
  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/telemetry/revenue');
      const data = await res.json();
      if (data.success) {
        setPayments(data.data);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchPayments();
    
    // Auto-refresh stats every 8 seconds
    const interval = setInterval(() => {
      fetchBalance();
      fetchPayments();
    }, 8000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerAddress]);

  // Handle deposit
  const handleDeposit = async () => {
    if (!depositAmount || isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) <= 0) {
      showToast('Please enter a valid deposit amount', 'error');
      return;
    }
    setLoading(true);
    try {
      logTerminal(`Initiating Circle Gateway deposit of $${depositAmount} USDC for buyer: ${buyerAddress}`);
      const res = await fetch('/api/telemetry/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerAddress,
          amount: parseFloat(depositAmount)
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Gateway pre-paid balance funded successfully!', 'success');
        logTerminal(`[GATEWAY DEPOSIT SUCCESS] New Balance: $${data.newBalance} USDC`);
        setBuyerBalance(data.newBalance);
        fetchPayments();
      } else {
        showToast(data.message || 'Deposit failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Deposit error', 'error');
    }
    setLoading(false);
  };

  // Handle premium query simulation (gated endpoint call)
  const handleQuerySimulation = async (type: 'reading' | 'history') => {
    if (shipmentId === null) {
      showToast('Please select a shipment to query telematics.', 'error');
      return;
    }

    setSimType(type);
    setSimResult(null);
    setLoading(true);

    const price = type === 'reading' ? 0.001 : 0.01;
    const priceAtomic = Math.round(price * 1_000_000).toString();
    const nonce = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const validBefore = Math.floor(Date.now() / 1000) + 3600;

    logTerminal(`[x402 CLIENT] Accessing gated endpoint: /api/telemetry/${type}?shipmentId=${shipmentId}`);
    
    try {
      // 1. Initial pre-flight request to get the 402 challenge
      const initialRes = await fetch(`/api/telemetry/${type}?shipmentId=${shipmentId}`);
      logTerminal(`[x402 SERVER] Response Status: ${initialRes.status} Payment Required`);
      
      if (initialRes.status !== 402) {
        const data = await initialRes.json();
        setSimResult(data);
        setLoading(false);
        return;
      }

      const paymentRequiredHeader = initialRes.headers.get('PAYMENT-REQUIRED');
      if (!paymentRequiredHeader) {
        throw new Error('Server returned 402 without PAYMENT-REQUIRED header challenge');
      }

      logTerminal(`[x402 CLIENT] Decoded challenge from PAYMENT-REQUIRED header.`);

      // 2. Build and sign EIP-3009 payment signature payload
      // For testing, we sign using viem client-side if a private key is present,
      // otherwise the server will check for deposit balance
      let signature = '0x' + '0'.repeat(130); // dummy signature fallback

      if (wallet?.privateKey) {
        logTerminal(`[x402 CLIENT] Signing EIP-3009 transfer authorization using private key...`);
        try {
          const { privateKeyToAccount } = await import('viem/accounts');
          const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
          
          signature = await account.signTypedData({
            domain: {
              name: 'USD Coin',
              version: '2',
              chainId: 5042002,
              verifyingContract: '0x3600000000000000000000000000000000000000',
            },
            types: {
              TransferWithAuthorization: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'validAfter', type: 'uint256' },
                { name: 'validBefore', type: 'uint256' },
                { name: 'nonce', type: 'bytes32' },
              ],
            },
            primaryType: 'TransferWithAuthorization',
            message: {
              from: buyerAddress as `0x${string}`,
              to: sellerAddress as `0x${string}`,
              value: BigInt(priceAtomic),
              validAfter: 0n,
              validBefore: BigInt(validBefore),
              nonce: nonce as `0x${string}`,
            },
          });
          logTerminal(`[x402 CLIENT] Generated EIP-3009 signature successfully.`);
        } catch {
          logTerminal(`[x402 CLIENT] Key signing skipped, relying on prepaid deposit fallback.`);
        }
      } else {
        logTerminal(`[x402 CLIENT] No local private key. Submitting prepaid deposit authorization payload.`);
      }

      const paymentPayload = {
        from: buyerAddress,
        to: sellerAddress,
        value: priceAtomic,
        validAfter: '0',
        validBefore: validBefore.toString(),
        nonce,
        signature,
        shipmentId
      };

      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

      // 3. Retry API call with PAYMENT-SIGNATURE header
      logTerminal(`[x402 CLIENT] Retrying request with PAYMENT-SIGNATURE header.`);
      
      const retryRes = await fetch(`/api/telemetry/${type}?shipmentId=${shipmentId}`, {
        headers: {
          'payment-signature': base64Payload
        }
      });

      const data = await retryRes.json();
      logTerminal(`[x402 SERVER] Response Status: ${retryRes.status}. Payment verification result returned.`);
      
      if (retryRes.ok) {
        showToast(`Nanopayment of $${price} USDC verified and settled!`, 'success');
      } else {
        showToast(data.message || 'Nanopayment verification failed', 'error');
      }

      setSimResult(data);
      fetchBalance();
      fetchPayments();
    } catch (err: any) {
      showToast(err.message || 'Query simulation error', 'error');
    }
    setLoading(false);
  };

  // Compute stats
  const totalRevenue = payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
  const singleReadingCount = payments.filter(p => p.endpoint === '/api/telemetry/reading').length;
  const historyQueryCount = payments.filter(p => p.endpoint === '/api/telemetry/history').length;

  return (
    <div className="space-y-8">
      
      {/* SECTION 1: USER PRE-PAID DEPOSITS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 sub-card" style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '6px' }}>
              <Coins size={18} style={{ color: 'var(--secondary)' }} /> Fund Gateway Access Balance
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
              Pre-fund your local sandbox or Arc testnet wallet. Telemetry queries will automatically authenticate via EIP-3009 and deduct micro-fees per request.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>$</span>
              <input 
                type="number"
                step="0.1"
                min="0.1"
                className="form-input"
                style={{ paddingLeft: '28px', fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button
              disabled={loading}
              onClick={handleDeposit}
              className="btn btn-primary"
              style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Deposit USDC
            </button>
          </div>
        </div>

        <div className="sub-card flex flex-col justify-between" style={{
          background: 'linear-gradient(135deg, #0B0F19 0%, #111827 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {/* Glowing accent circle */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--success)',
            filter: 'blur(40px)',
            opacity: 0.15
          }} />
          
          <div>
            <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Pre-paid Buyer Balance</span>
            <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#10B981', marginTop: '6px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              ${buyerBalance.toFixed(4)} <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 'normal' }}>USDC</span>
            </h3>
          </div>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: '#9CA3AF' }}>
            <Clock size={12} className="text-emerald-500" />
            <span>Live balance on Arc Testnet</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: SIMULATED PREMIUM QUERIES */}
      <div className="sub-card" style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Play size={18} style={{ color: 'var(--accent)' }} /> Gated Telemetry Query Simulator
          </h4>
          <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontSize: '10px' }}>HTTP 402 Paywall</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
          Test the cryptographic EIP-3009 payment requirements. External auditing and telemetry requests are blocked by default and only released upon micro-payment signature verification.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <button
            disabled={loading || shipmentId === null}
            onClick={() => handleQuerySimulation('reading')}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '42px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              borderColor: 'var(--border)'
            }}
          >
            <span style={{ fontSize: '9px', background: 'var(--success-soft)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>GET</span>
            Query Single Reading ($0.001)
          </button>
          <button
            disabled={loading || shipmentId === null}
            onClick={() => handleQuerySimulation('history')}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '42px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              borderColor: 'var(--border)'
            }}
          >
            <span style={{ fontSize: '9px', background: 'var(--secondary-soft)', color: 'var(--secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>GET</span>
            Query Shipment History ($0.01)
          </button>
        </div>

        {simResult && (
          <div style={{
            background: '#0B0F19',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: simResult.success ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: simResult.success ? '#10B981' : '#EF4444' }} />
                Response: {simResult.success ? '200 OK (Paid Access)' : '402 Payment Required'}
              </span>
              <span style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                Endpoint: {simType === 'reading' ? '/telemetry/reading' : '/telemetry/history'}
              </span>
            </div>
            <pre className="custom-scrollbar" style={{
              margin: 0,
              fontSize: '11px',
              overflowX: 'auto',
              background: 'transparent',
              padding: 0,
              color: '#34D399',
              fontFamily: 'var(--font-mono)',
              maxHeight: '180px',
              lineHeight: '1.5'
            }}>
              {JSON.stringify(simResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* SECTION 3: REVENUE ANALYTICS PANEL */}
      <div className="sub-card" style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '20px' }}>
          <TrendingUp size={18} style={{ color: 'var(--success)' }} /> Seller Revenue Analytics Dashboard
        </h4>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Total Earnings</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              ${totalRevenue.toFixed(4)} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)' }}>USDC</span>
            </div>
          </div>
          
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Reading Queries</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {singleReadingCount} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)' }}>(${ (singleReadingCount * 0.001).toFixed(3) })</span>
            </div>
          </div>
          
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>History Queries</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {historyQueryCount} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)' }}>(${ (historyQueryCount * 0.01).toFixed(2) })</span>
            </div>
          </div>
        </div>

        {/* Ledger list */}
        <div>
          <h5 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={14} style={{ color: 'var(--text-secondary)' }} /> x402 Nanopayment Settlement Ledger
          </h5>
          <div className="custom-table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', fontSize: '10px' }}>Timestamp</th>
                  <th style={{ padding: '8px 12px', fontSize: '10px' }}>Buyer</th>
                  <th style={{ padding: '8px 12px', fontSize: '10px' }}>Endpoint</th>
                  <th style={{ padding: '8px 12px', fontSize: '10px', textAlign: 'center' }}>Shipment</th>
                  <th style={{ padding: '8px 12px', fontSize: '10px', textAlign: 'right' }}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                      No payment settlements recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p, idx) => (
                    <tr key={p.id || idx}>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {new Date(p.createdAt || Date.now()).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {p.buyerAddress ? `${p.buyerAddress.slice(0, 6)}...${p.buyerAddress.slice(-4)}` : 'Unknown'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px' }}>
                        <code style={{ fontSize: '11px', background: p.endpoint.includes('reading') ? 'var(--success-soft)' : 'var(--secondary-soft)', color: p.endpoint.includes('reading') ? 'var(--success)' : 'var(--secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{p.endpoint.replace('/api', '')}</code>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        #{p.shipmentId || 'N/A'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>
                        +${parseFloat(p.amount).toFixed(4)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
