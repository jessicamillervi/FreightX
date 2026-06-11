/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ArrowRightLeft, 
  Coins, 
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';

export default function FXRateCard() {
  const { showToast, logTerminal } = useAppContext();
  const { wallet } = useWallet();

  const [fromCurrency, setFromCurrency] = useState('AED');
  const [toCurrency, setToCurrency] = useState('USDC');
  const [amount, setAmount] = useState('1000');
  
  const [quote, setQuote] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [swapping, setSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<any>(null);

  const fetchRate = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/fx/rates?from=${fromCurrency}&to=${toCurrency}&amount=${amount}`);
      const data = await res.json();
      if (data.success) {
        setQuote(data.quote);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching FX rates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRate();
    const interval = setInterval(fetchRate, 10000); // Poll rates every 10 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCurrency, toCurrency, amount]);

  const handleSwap = async () => {
    if (!quote || !wallet) {
      showToast('Wallet not connected or quote not generated.', 'error');
      return;
    }
    setSwapping(true);
    logTerminal(`Initiating Circle StableFX on-chain swap for quote: ${quote.id}`);
    try {
      const res = await fetch('/api/fx/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          takerAddress: wallet.address
        })
      });
      const data = await res.json();
      if (data.success) {
        setSwapResult(data.trade);
        showToast('Currency conversion swap executed successfully!', 'success');
        logTerminal(`[StableFX Trade Settle] Quote: ${data.trade.quoteId} | Tx: ${data.trade.txHash}`);
      } else {
        showToast(data.error || 'Swap execution failed', 'error');
      }
    } catch (err) {
      showToast('Error executing FX swap transaction', 'error');
    } finally {
      setSwapping(false);
    }
  };

  // Helper to generate SVG points for the historical rate graph
  const renderSparkline = () => {
    if (!history || history.length === 0) return '';
    const rates = history.map(h => h.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const range = max - min === 0 ? 1 : max - min;

    const width = 360;
    const height = 80;
    const padding = 5;

    const points = history.map((h, i) => {
      const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((h.rate - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return points.join(' ');
  };

  const currentRate = quote ? quote.rate : 0;
  const isSwapSupported = (fromCurrency === 'USDC' && toCurrency === 'EURC') || (fromCurrency === 'EURC' && toCurrency === 'USDC');

  return (
    <div className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Live converter controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Converter fields card */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] p-6 rounded-2xl shadow-sm" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <ArrowRightLeft className="h-4 w-4 text-[var(--success)]" />
              StableFX Converter
            </h4>
            <span style={{ fontSize: '10px', background: 'var(--success-soft)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
              Live Oracle Rates
            </span>
          </div>

          {/* From / To Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Source Currency</label>
              <select
                className="form-select"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', fontWeight: 600, fontSize: '13px' }}
                value={fromCurrency}
                onChange={(e) => {
                  setFromCurrency(e.target.value);
                  if (e.target.value === toCurrency) {
                    setToCurrency(e.target.value === 'USDC' ? 'EURC' : 'USDC');
                  }
                }}
              >
                <option value="AED">AED (Emirati Dirham)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (British Pound)</option>
                <option value="USDC">USDC (USD Coin)</option>
                <option value="EURC">EURC (Euro Coin)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px 4px 0', color: 'var(--text-muted)' }}>
              <ArrowRightLeft size={16} />
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Target Stablecoin</label>
              <select
                className="form-select"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', fontWeight: 600, fontSize: '13px' }}
                value={toCurrency}
                onChange={(e) => {
                  setToCurrency(e.target.value);
                  if (e.target.value === fromCurrency) {
                    setFromCurrency(e.target.value === 'USDC' ? 'EURC' : 'USDC');
                  }
                }}
              >
                <option value="USDC">USDC (USD Coin)</option>
                <option value="EURC">EURC (Euro Coin)</option>
              </select>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Input Amount</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount..."
                className="form-input"
                style={{ width: '100%', padding: '12px 14px', fontSize: '15px', fontWeight: 700, borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)' }}
              />
              <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700 }}>
                {fromCurrency}
              </span>
            </div>
          </div>

          {/* Live Quote Output & FX rate display */}
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '68px'
          }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Live Quote Output</span>
              {loading && !quote ? (
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw className="h-3 w-3 animate-spin text-[var(--success)]" /> Fetching quote...
                </span>
              ) : (
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  {quote ? parseFloat(quote.toAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{toCurrency}</span>
                </span>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Oracle FX Rate</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)' }}>
                1 {fromCurrency} = {currentRate.toFixed(4)} {toCurrency}
              </span>
            </div>
          </div>
        </div>

        {/* Live chart card */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] p-6 rounded-2xl shadow-sm" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <TrendingUp className="h-4 w-4 text-[var(--secondary)]" />
              Live Rate Chart (Past 24h)
            </h4>
            <span style={{ fontSize: '10px', background: 'var(--secondary-soft)', color: 'var(--secondary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
              Pair: {fromCurrency}/{toCurrency}
            </span>
          </div>

          {/* Sparkline chart with background lines and pulsing dot */}
          <div style={{
            height: '116px',
            background: 'var(--bg-main)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Gridlines */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: '25%', height: 0, borderTop: '1px dashed rgba(0,0,0,0.04)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 0, borderTop: '1px dashed rgba(0,0,0,0.04)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: '75%', height: 0, borderTop: '1px dashed rgba(0,0,0,0.04)' }} />

            <div style={{ position: 'absolute', top: '8px', right: '12px', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Max: {history.length > 0 ? Math.max(...history.map(h => h.rate)).toFixed(4) : '0.0000'}
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Min: {history.length > 0 ? Math.min(...history.map(h => h.rate)).toFixed(4) : '0.0000'}
            </div>

            {history && history.length > 0 ? (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 360 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>
                {/* Area path */}
                <path
                  d={`M 5,80 L ${renderSparkline()} L 355,80 Z`}
                  fill="url(#chartGradient)"
                />
                {/* Line path */}
                <polyline
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={renderSparkline()}
                />
                
                {/* Pulsing indicator dot at current value */}
                {(() => {
                  if (!history || history.length === 0) return null;
                  const rates = history.map(h => h.rate);
                  const min = Math.min(...rates);
                  const max = Math.max(...rates);
                  const range = max - min === 0 ? 1 : max - min;

                  const width = 360;
                  const height = 80;
                  const padding = 5;

                  const idx = history.length - 1;
                  const val = history[idx];
                  const cx = padding + (idx / (history.length - 1)) * (width - 2 * padding);
                  const cy = height - padding - ((val.rate - min) / range) * (height - 2 * padding);
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r="4" fill="var(--secondary)" />
                      <circle cx={cx} cy={cy} r="8" fill="var(--secondary)" opacity="0.3" className="animate-ping" style={{ transformOrigin: `${cx}px ${cy}px` }} />
                    </g>
                  );
                })()}
              </svg>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No chart data available</span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '0 4px' }}>
            <span>24 hours ago</span>
            <span>Current Quote</span>
          </div>
        </div>
      </div>

      {/* On-chain Swap Settlement Block */}
      {isSwapSupported && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h5 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Coins className="h-4 w-4 text-[var(--success)]" />
              On-Chain FX Swap Settlement (USDC ↔ EURC)
            </h5>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', maxWidth: '600px' }}>
              Takers can swap USDC and EURC with locked-rate guarantees utilizing Circle StableFX. Settlement utilizes Permit2 for Payment-versus-Payment guarantees on Arc Testnet.
            </p>
          </div>

          <div style={{ flexShrink: 0 }}>
            <button
              onClick={handleSwap}
              disabled={swapping || !quote}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 24px', height: '42px', fontSize: '13px', fontWeight: 600 }}
            >
              {swapping ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Swapping...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4" /> Execute Swap
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success Trade Log Details */}
      {swapResult && (
        <div style={{
          background: 'var(--success-soft)',
          border: '1px solid var(--success-border)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 700, fontSize: '13px' }}>
            <CheckCircle2 className="h-4.5 w-4.5" />
            <span>StableFX Trade Settled!</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Trade Reference ID</span>
              <span style={{ fontWeight: 600 }}>{swapResult.id}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Quote ID</span>
              <span style={{ fontWeight: 600 }}>{swapResult.quoteId}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Exchanged Amount</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                {parseFloat(swapResult.fromAmount).toFixed(2)} {swapResult.fromCurrency} ➔ {parseFloat(swapResult.toAmount).toFixed(2)} {swapResult.toCurrency}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Transaction Hash</span>
              <a 
                href={`https://testnet.arcscan.app/tx/${swapResult.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                {swapResult.txHash.substring(0, 16)}...
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
