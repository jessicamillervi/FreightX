import React, { useState, useEffect } from 'react';
import { getLocalArbitrators, registerArbitrator, saveLocalArbitrators, type ArbitratorInfo } from '@/lib/dispute';
import { getAppMode, getOrCreateSandboxWallet } from '@/services/sandbox';

interface ArbitratorRegistryProps {
  currentAddress?: string;
  onRefreshBalances?: () => void;
}

export const ArbitratorRegistry: React.FC<ArbitratorRegistryProps> = ({ currentAddress, onRefreshBalances }) => {
  const [arbitrators, setArbitrators] = useState<ArbitratorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const mode = getAppMode();
  const wallet = getOrCreateSandboxWallet();
  const effectiveAddress = currentAddress || wallet.address;

  useEffect(() => {
    setArbitrators(getLocalArbitrators());
  }, []);

  const refreshArbitrators = () => {
    setArbitrators(getLocalArbitrators());
  };

  const handleRegister = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await registerArbitrator(effectiveAddress, mode);
      setMessage({ text: 'Arbitrator registered successfully with 100 USDC staked!', type: 'success' });
      refreshArbitrators();
      if (onRefreshBalances) onRefreshBalances();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to register arbitrator', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async () => {
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'local') {
        let list = getLocalArbitrators();
        const initialLen = list.length;
        list = list.filter(a => a.address.toLowerCase() !== effectiveAddress.toLowerCase());
        if (list.length === initialLen) {
          throw new Error('You are not registered as an arbitrator');
        }
        saveLocalArbitrators(list);
        setMessage({ text: 'Successfully unregistered and unstaked USDC', type: 'success' });
        refreshArbitrators();
        if (onRefreshBalances) onRefreshBalances();
      } else {
        throw new Error('On-chain unregistration must be executed via contract call');
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to unregister', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyRegistered = arbitrators.some(
    a => a.address.toLowerCase() === effectiveAddress.toLowerCase()
  );

  const currentArbDetails = arbitrators.find(
    a => a.address.toLowerCase() === effectiveAddress.toLowerCase()
  );

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
            Arbitrator Governance Registry
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Stake USDC to resolve cargo escrows. Consensus alignment yields reputation points.
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex gap-2">
          {!isAlreadyRegistered ? (
            <button
              onClick={handleRegister}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg shadow-md transition-all duration-200"
            >
              {loading ? 'Processing...' : 'Register as Arbitrator (Stake 100 USDC)'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-teal-950/80 border border-teal-800 text-teal-400 rounded-lg text-xs font-medium">
                Registered (Reputation: {currentArbDetails?.reputation || 100})
              </span>
              <button
                onClick={handleUnregister}
                disabled={loading}
                className="px-3 py-2 text-xs font-semibold text-red-400 hover:text-white bg-red-950/30 hover:bg-red-600/50 border border-red-900/50 disabled:opacity-50 rounded-lg transition-all duration-200"
              >
                Unregister & Refund
              </button>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-xs border ${
          message.type === 'success' 
            ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400' 
            : 'bg-red-950/30 border-red-800 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Active Arbitrators Pool</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 font-medium">Arbitrator Address</th>
                <th className="py-2.5 font-medium text-right">Staked Amount</th>
                <th className="py-2.5 font-medium text-right">Reputation Score</th>
                <th className="py-2.5 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {arbitrators.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-slate-500">
                    No registered arbitrators. Be the first to register!
                  </td>
                </tr>
              ) : (
                arbitrators.map((arb, index) => (
                  <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 font-mono text-slate-400">{arb.address}</td>
                    <td className="py-3 text-right font-semibold text-white">{arb.stakedAmount} USDC</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        arb.reputation >= 120 
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' 
                          : arb.reputation >= 80 
                          ? 'bg-blue-950 text-blue-400 border border-blue-900' 
                          : 'bg-amber-950 text-amber-400 border border-amber-900'
                      }`}>
                        {arb.reputation} / 200
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="w-2 h-2 inline-block rounded-full bg-emerald-500" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
