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

  const buyerAddress = wallet?.address || '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194';
  const sellerAddress = process.env.NEXT_PUBLIC_GATEWAY_SELLER_ADDRESS || '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
      
      {/* SECTION 1: USER PRE-PAID DEPOSITS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Coins size={15} /> Fund Buyer Gateway Balance
          </h4>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Fund your testnet wallet balance to pay for telemetry queries. Funds are held in a smart escrow and deducted per query.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="number"
                step="0.1"
                min="0.1"
                className="form-control"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem 0.4rem 1.8rem', background: '#04060a', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', width: '100%' }}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
              />
              <span style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>$</span>
            </div>
            <button
              disabled={loading}
              onClick={handleDeposit}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              Deposit USDC
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pre-paid Buyer Balance</span>
          <strong style={{ fontSize: '1.6rem', color: 'var(--success)', margin: '0.25rem 0' }}>
            ${buyerBalance.toFixed(4)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>USDC</span>
          </strong>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={10} /> Live balance on Arc Testnet
          </span>
        </div>
      </div>

      {/* SECTION 2: SIMULATED PREMIUM QUERIES */}
      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Play size={15} /> Gated Telemetry Query Simulator
        </h4>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Test the paywall protocol. Querying telemetry returns actual sensor database logs only if EIP-3009 payment or pre-paid balance is verified.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <button
            disabled={loading || shipmentId === null}
            onClick={() => handleQuerySimulation('reading')}
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <ShieldCheck size={14} /> Query Single Reading ($0.001)
          </button>
          <button
            disabled={loading || shipmentId === null}
            onClick={() => handleQuerySimulation('history')}
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <History size={14} /> Query Shipment History ($0.01)
          </button>
        </div>

        {simResult && (
          <div style={{ background: '#04060a', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: simResult.success ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                ● Response: {simResult.success ? '200 OK (Paid Access Granted)' : '402 Payment Required'}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                Endpoint: {simType === 'reading' ? '/reading' : '/history'}
              </span>
            </div>
            <pre style={{ margin: 0, fontSize: '0.65rem', overflowX: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)', color: '#00e676', fontFamily: 'var(--font-mono)' }}>
              {JSON.stringify(simResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* SECTION 3: REVENUE ANALYTICS PANEL */}
      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <TrendingUp size={15} /> Seller Revenue Analytics Dashboard
        </h4>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ background: '#04060a', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Total Earnings</span>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--success)' }}>
              ${totalRevenue.toFixed(4)} USDC
            </div>
          </div>
          <div style={{ background: '#04060a', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Reading Queries</span>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              {singleReadingCount} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(${ (singleReadingCount * 0.001).toFixed(3) })</span>
            </div>
          </div>
          <div style={{ background: '#04060a', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>History Queries</span>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              {historyQueryCount} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(${ (historyQueryCount * 0.01).toFixed(2) })</span>
            </div>
          </div>
        </div>

        {/* Query Ledger Log */}
        <div>
          <h5 style={{ fontSize: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Database size={12} /> x402 Nanopayment Settlement Ledger
          </h5>
          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.65rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#04060a', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.4rem' }}>Timestamp</th>
                  <th style={{ padding: '0.4rem' }}>Buyer</th>
                  <th style={{ padding: '0.4rem' }}>Endpoint</th>
                  <th style={{ padding: '0.4rem' }}>Shipment</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No payment settlements recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p, idx) => (
                    <tr key={p.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', verticalAlign: 'middle' }}>
                      <td style={{ padding: '0.4rem', color: 'var(--text-muted)' }}>
                        {new Date(p.createdAt || Date.now()).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '0.4rem', fontFamily: 'var(--font-mono)' }}>
                        {p.buyerAddress ? `${p.buyerAddress.slice(0, 6)}...${p.buyerAddress.slice(-4)}` : 'Unknown'}
                      </td>
                      <td style={{ padding: '0.4rem', color: '#00b0ff' }}>
                        {p.endpoint}
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                        #{p.shipmentId || 'N/A'}
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }}>
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
