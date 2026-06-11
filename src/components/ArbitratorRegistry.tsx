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
    <div className="glass-panel">
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-[var(--border)]">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 font-display">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse" />
            Arbitrator Governance Registry
          </h2>
          <p className="text-[var(--text-secondary)] text-xs mt-1">
            Stake USDC to resolve cargo escrows. Consensus alignment yields reputation points.
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex gap-2">
          {!isAlreadyRegistered ? (
            <button
              onClick={handleRegister}
              disabled={loading}
              className="btn btn-primary bg-teal-600 hover:bg-teal-700 border-teal-600 text-white px-5"
            >
              {loading ? 'Processing...' : 'Register as Arbitrator (Stake 100 USDC)'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-xs font-medium">
                Registered (Reputation: {currentArbDetails?.reputation || 100})
              </span>
              <button
                onClick={handleUnregister}
                disabled={loading}
                className="btn btn-secondary border-red-200 text-red-650 hover:bg-red-50/50 px-4"
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
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Active Arbitrators Pool</h3>
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Arbitrator Address</th>
                <th className="text-right">Staked Amount</th>
                <th className="text-right">Reputation Score</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {arbitrators.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-[var(--text-muted)] italic">
                    No registered arbitrators. Be the first to register!
                  </td>
                </tr>
              ) : (
                arbitrators.map((arb, index) => (
                  <tr key={index} className="align-middle">
                    <td className="font-mono text-[var(--text-secondary)]">{arb.address}</td>
                    <td className="text-right font-semibold text-[var(--text-primary)]">{arb.stakedAmount} USDC</td>
                    <td className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        arb.reputation >= 120 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : arb.reputation >= 80 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {arb.reputation} / 200
                      </span>
                    </td>
                    <td className="text-center">
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
