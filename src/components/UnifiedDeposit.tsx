/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { 
  ArrowRight, 
  Coins, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';
import { depositToUnifiedBalance } from '@/lib/unified-balance';

interface UnifiedDepositProps {
  onSuccess?: () => void;
}

export default function UnifiedDeposit({ onSuccess }: UnifiedDepositProps) {
  const { showToast, logTerminal, browserWalletClient } = useAppContext();
  const { wallet, signerType } = useWallet();

  const [chain, setChain] = useState<'Ethereum_Sepolia' | 'Arbitrum_Sepolia'>('Ethereum_Sepolia');
  const [amount, setAmount] = useState('10.0');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'approving' | 'depositing' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState('');
  const [explorerUrl, setExplorerUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleDeposit = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      showToast('Please enter a valid deposit amount.', 'warning');
      return;
    }

    if (!wallet) {
      showToast('Wallet not connected.', 'error');
      return;
    }

    setLoading(true);
    setStep('approving');
    setErrorMessage('');
    
    const chainName = chain === 'Ethereum_Sepolia' ? 'Ethereum Sepolia' : 'Arbitrum Sepolia';
    logTerminal(`Initiating Unified Balance Deposit: ${amount} USDC from ${chainName}`);

    try {
      // Step 1 & 2: Approve & Deposit via Unified Balance SDK
      setStep('depositing');
      const res = await depositToUnifiedBalance(
        chain,
        amount,
        signerType,
        wallet,
        browserWalletClient
      );

      if (res.success && res.txHash) {
        setTxHash(res.txHash);
        setExplorerUrl(res.explorerUrl || '');
        setStep('success');
        showToast(`Successfully deposited ${amount} USDC from ${chainName}!`, 'success');
        logTerminal(`[Unified Balance Deposit Success] Chain: ${chain} | Tx: ${res.txHash}`);
        if (onSuccess) onSuccess();
      } else {
        setStep('error');
        setErrorMessage(res.error || 'Unknown deposit error');
        showToast(res.error || 'Deposit execution failed', 'error');
        logTerminal(`[Unified Balance Deposit Failed] Error: ${res.error}`);
      }
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || String(err));
      showToast(err.message || 'Error executing deposit', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)' }}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
        <Coins size={18} /> Deposit USDC into Unified Balance
      </h3>
      
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Deposit USDC from other testnet blockchains. App Kit Unified Balance aggregates these deposits into a single spendable pool on Arc Testnet, performing gasless cross-chain CCTP routing behind the scenes.
      </p>

      {step === 'success' ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <div className="flex-center" style={{ width: '48px', height: '48px', background: 'rgba(0,230,118,0.1)', borderRadius: '50%', color: 'var(--success)', margin: '0 auto 1rem' }}>
            <CheckCircle2 size={28} />
          </div>
          <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--success)' }}>Deposit Submitted Successfully!</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Your transaction has been sent to the network. The funds will be credited to your Unified Balance once confirmed.
          </p>
          
          {txHash && (
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                {txHash}
              </span>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                  Verify <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}

          <button onClick={() => setStep('idle')} className="btn btn-secondary" style={{ width: '100%' }}>
            Make Another Deposit
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Source Blockchain</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button 
                type="button"
                onClick={() => setChain('Ethereum_Sepolia')}
                style={{ 
                  background: chain === 'Ethereum_Sepolia' ? 'rgba(84, 110, 238, 0.15)' : 'var(--bg-main)', 
                  border: chain === 'Ethereum_Sepolia' ? '1px solid var(--primary)' : '1px solid var(--border-color)', 
                  color: chain === 'Ethereum_Sepolia' ? 'var(--primary)' : 'var(--text-main)',
                  borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                Ethereum Sepolia
              </button>
              <button 
                type="button"
                onClick={() => setChain('Arbitrum_Sepolia')}
                style={{ 
                  background: chain === 'Arbitrum_Sepolia' ? 'rgba(18, 144, 244, 0.15)' : 'var(--bg-main)', 
                  border: chain === 'Arbitrum_Sepolia' ? '1px solid #1290f4' : '1px solid var(--border-color)', 
                  color: chain === 'Arbitrum_Sepolia' ? '#1290f4' : 'var(--text-main)',
                  borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                Arbitrum Sepolia
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>USDC Deposit Amount</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.0"
                disabled={loading}
                style={{ 
                  width: '100%', padding: '0.75rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none'
                }}
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>USDC</span>
            </div>
          </div>

          {step === 'error' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'rgba(244,67,54,0.1)', border: '1px solid var(--danger)', padding: '0.75rem', borderRadius: '8px' }}>
              <AlertCircle size={16} style={{ color: 'var(--danger)', marginTop: '0.1rem', flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'block' }}>Deposit Failed</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{errorMessage}</span>
              </div>
            </div>
          )}

          <button 
            type="button"
            onClick={handleDeposit} 
            disabled={loading}
            className="btn btn-primary" 
            style={{ width: '100%', padding: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin-slow" size={16} /> 
                {step === 'approving' ? 'Authorizing ERC-20 limit...' : 'Broadcasting Deposit...'}
              </>
            ) : (
              <>
                Initiate Cross-Chain Deposit <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
