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
    <div className="space-y-4">
      {/* Live converter controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Converter fields */}
        <div className="space-y-4 bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-400" />
            StableFX FX Converter
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 font-semibold block mb-1">Source Currency</label>
              <select
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                value={fromCurrency}
                onChange={(e) => {
                  setFromCurrency(e.target.value);
                  // Ensure different target if identical
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

            <div>
              <label className="text-[10px] text-zinc-500 font-semibold block mb-1">Target Stablecoin</label>
              <select
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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

          <div>
            <label className="text-[10px] text-zinc-500 font-semibold block mb-1">Input Amount</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 pr-12 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-zinc-500 font-bold">{fromCurrency}</span>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase block">Live Quote Output</span>
              {loading && !quote ? (
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Fetching quote...
                </span>
              ) : (
                <span className="text-base font-bold text-white">
                  {quote ? parseFloat(quote.toAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}{' '}
                  <span className="text-xs text-zinc-400 font-normal">{toCurrency}</span>
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase block">FX Rate</span>
              <span className="text-xs font-semibold text-emerald-400">
                1 {fromCurrency} = {currentRate.toFixed(4)} {toCurrency}
              </span>
            </div>
          </div>
        </div>

        {/* Live graph Sparkline */}
        <div className="flex flex-col justify-between bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
              Live Rate Chart (Past 24h)
            </h4>
            <span className="text-3xs text-zinc-500 font-semibold uppercase tracking-wider">
              Pair: {fromCurrency}/{toCurrency}
            </span>
          </div>

          {/* Sparkline container */}
          <div className="h-24 bg-zinc-950/40 rounded-lg border border-zinc-900 flex items-center justify-center p-2 relative my-2 overflow-hidden">
            <div className="absolute top-1 right-2 text-[8px] text-zinc-600 font-mono">
              Max: {history.length > 0 ? Math.max(...history.map(h => h.rate)).toFixed(4) : '0.00'}
            </div>
            <div className="absolute bottom-1 right-2 text-[8px] text-zinc-600 font-mono">
              Min: {history.length > 0 ? Math.min(...history.map(h => h.rate)).toFixed(4) : '0.00'}
            </div>

            {history && history.length > 0 ? (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 360 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
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
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={renderSparkline()}
                />
              </svg>
            ) : (
              <span className="text-xs text-zinc-500">No chart data available</span>
            )}
          </div>

          <div className="flex items-center justify-between text-3xs text-zinc-500 font-mono">
            <span>24 hours ago</span>
            <span>Current Quote</span>
          </div>
        </div>
      </div>

      {/* On-chain Swap Settlement Block */}
      {isSwapSupported && (
        <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-emerald-400" />
              On-Chain FX Swap Settlement (USDC ↔ EURC)
            </h5>
            <p className="text-[11px] text-zinc-400 max-w-xl">
              Takers can swap USDC and EURC with locked-rate guarantees utilizing Circle StableFX. Settlement utilizes Permit2 for Payment-versus-Payment guarantees on Arc Testnet.
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2 shrink-0">
            <button
              onClick={handleSwap}
              disabled={swapping || !quote}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black font-bold text-xs rounded-lg shadow-md hover:shadow-emerald-500/10 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {swapping ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Swapping...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Execute swap
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success Trade Log Details */}
      {swapResult && (
        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-bold">StableFX Trade Settled!</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-3xs text-zinc-400 font-mono">
            <div>
              <span className="text-zinc-500 block">Trade Reference ID</span>
              <span>{swapResult.id}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Quote ID</span>
              <span>{swapResult.quoteId}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Exchanged Amount</span>
              <span className="text-zinc-200 font-bold">
                {parseFloat(swapResult.fromAmount).toFixed(2)} {swapResult.fromCurrency} ➔ {parseFloat(swapResult.toAmount).toFixed(2)} {swapResult.toCurrency}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Transaction Hash</span>
              <a 
                href={`https://testnet.arcscan.app/tx/${swapResult.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                {swapResult.txHash.substring(0, 24)}...
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
