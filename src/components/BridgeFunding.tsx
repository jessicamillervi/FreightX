'use client';

import React, { useState, useEffect } from 'react';
import { ChainSelector, SupportedChain } from './ChainSelector';
import { executeBridge } from '@/lib/cctp-bridge';
import { recordCCTPFundingOnchain } from '@/services/sandbox';
import { useAppContext } from '@/contexts/AppContext';
import { useAccount, useWalletClient, useSwitchChain, usePublicClient } from 'wagmi';
import { WalletClient } from 'viem';
import { sepolia, arbitrumSepolia } from 'viem/chains';
import { 
  ArrowRight, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2, 
  ExternalLink,
  ShieldAlert,
  Coins,
  History
} from 'lucide-react';

interface BridgeFundingProps {
  shipmentId: number;
  requiredAmount: number; // in USDC
  onComplete: () => void;
}

interface BridgeState {
  stage: 'idle' | 'approve' | 'burn' | 'attestation' | 'mint' | 'escrow' | 'complete' | 'error';
  detail: string;
  burnTxHash?: string;
  mintTxHash?: string;
  messageBytes?: string;
  errorMsg?: string;
}

export function BridgeFunding({ shipmentId, requiredAmount, onComplete }: BridgeFundingProps) {
  const { wallet, contracts, signerType, browserWalletClient, logTerminal, showToast, circleSession } = useAppContext();
  const { isConnected, chainId } = useAccount();
  const { data: sourceWalletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  
  const [sourceChain, setSourceChain] = useState<SupportedChain>('Arbitrum_Sepolia');
  const [bridgeState, setBridgeState] = useState<BridgeState>({
    stage: 'idle',
    detail: ''
  });

  const sourceChainId = sourceChain === 'Ethereum_Sepolia' ? sepolia.id : arbitrumSepolia.id;
  const sourceChainName = sourceChain === 'Ethereum_Sepolia' ? 'Ethereum Sepolia' : 'Arbitrum Sepolia';
  
  // Create viem client for source public reads
  const sourcePublicClient = usePublicClient({ chainId: sourceChainId });
  const destPublicClient = usePublicClient({ chainId: 5042002 }); // Arc Testnet

  // Load persisted bridge state for this shipment if it exists
  useEffect(() => {
    const saved = localStorage.getItem(`freightx_bridge_${shipmentId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.stage !== 'complete' && parsed.stage !== 'idle') {
          setBridgeState(parsed);
        }
      } catch (e) {
        console.error('Failed to load persisted bridge state', e);
      }
    }
  }, [shipmentId]);

  // Persist state changes
  const updateBridgeState = (newState: Partial<BridgeState>) => {
    setBridgeState(prev => {
      const updated = { ...prev, ...newState };
      localStorage.setItem(`freightx_bridge_${shipmentId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearHistory = () => {
    localStorage.removeItem(`freightx_bridge_${shipmentId}`);
    setBridgeState({ stage: 'idle', detail: '' });
  };

  const handleStartBridge = async () => {
    if (!isConnected || !sourceWalletClient) {
      showToast('Please connect your Web3 wallet (MetaMask) first!', 'error');
      return;
    }

    // Ensure we are on the correct source chain
    if (chainId !== sourceChainId) {
      try {
        updateBridgeState({ stage: 'approve', detail: `Switching network to ${sourceChainName}...` });
        await switchChainAsync({ chainId: sourceChainId });
      } catch {
        showToast(`Failed to switch network to ${sourceChainName}.`, 'error');
        updateBridgeState({ stage: 'idle', detail: '' });
        return;
      }
    }

    if (!contracts) {
      showToast('Sandbox contracts not loaded.', 'error');
      return;
    }

    try {
      logTerminal(`[CCTP Bridge] Initiating real bridge from ${sourceChainName} for Shipment #${shipmentId}...`);
      
      // Determine destination signer
      let destSigner: any;
      if (signerType === 'web3' && browserWalletClient) {
        destSigner = browserWalletClient as unknown as WalletClient;
      } else if (signerType === 'circle' && circleSession) {
        destSigner = circleSession;
      } else if (wallet) {
        destSigner = wallet.privateKey;
      } else {
        throw new Error("No active wallet or signer available.");
      }

      // Execute Bridge Kit / App Kit
      const bridgeResult = await executeBridge({
        sourceChain,
        sourcePublicClient,
        sourceWalletClient,
        destPublicClient,
        destWalletClient: destSigner,
        amount: requiredAmount.toString(),
        onStatusUpdate: (stage, detail, txHash) => {
          logTerminal(`[CCTP Bridge][${stage.toUpperCase()}] ${detail}`);
          if (stage === 'complete') {
            updateBridgeState({ stage: 'escrow', detail: 'Bridge complete. Recording escrow funding on Arc...', mintTxHash: txHash });
          } else if (stage === 'error') {
            updateBridgeState({ stage: 'error', errorMsg: detail, detail: `Failed at stage: ${stage}` });
          } else {
            updateBridgeState({
              stage: stage as BridgeState['stage'],
              detail,
              burnTxHash: stage === 'burn' || stage === 'attestation' || stage === 'mint' ? txHash : undefined
            });
          }
        }
      });

      // Now register on-chain in our FreightEscrow contract
      updateBridgeState({ 
        stage: 'escrow', 
        detail: 'CCTP mint complete. Finalizing escrow funding on Arc...',
        burnTxHash: bridgeResult.burnTxHash,
        mintTxHash: bridgeResult.mintTxHash,
        messageBytes: bridgeResult.messageBytes
      });

      if (!bridgeResult.messageBytes) {
        throw new Error("Could not extract CCTP message bytes from source logs.");
      }

      logTerminal(`[CCTP Bridge] Recording CCTP verification on Arc Testnet for Shipment #${shipmentId}...`);

      // Call recordCCTPFunding
      const escrowRegTx = await recordCCTPFundingOnchain(
        destSigner,
        contracts,
        shipmentId,
        bridgeResult.burnTxHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
        bridgeResult.messageBytes,
        (status) => {
          logTerminal(`[Escrow Register] ${status}`);
          updateBridgeState({ detail: status });
        }
      );

      logTerminal(`[CCTP Bridge] Escrow successfully funded! Registration Tx: ${escrowRegTx}`);
      updateBridgeState({ stage: 'complete', detail: 'Cross-chain escrow funding completed successfully!' });
      showToast('Escrow successfully funded via real CCTP bridge!', 'success');
      localStorage.removeItem(`freightx_bridge_${shipmentId}`);
      onComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logTerminal(`[CCTP Bridge] Error: ${msg}`);
      updateBridgeState({ stage: 'error', errorMsg: msg, detail: 'An error occurred during the bridge process.' });
      showToast('Bridge operation failed. You can resume or retry.', 'error');
    }
  };

  const getStageStyle = (stage: string) => {
    const currentStage = bridgeState.stage;
    if (currentStage === 'complete') return { color: '#00e676', fontWeight: 600 };
    if (currentStage === 'error') return { color: '#ff1744', fontWeight: 600 };
    
    const stages = ['idle', 'approve', 'burn', 'attestation', 'mint', 'escrow'];
    const currentIndex = stages.indexOf(currentStage);
    const targetIndex = stages.indexOf(stage);

    if (currentIndex > targetIndex) {
      return { color: '#00e676', opacity: 0.8 }; // completed
    } else if (currentIndex === targetIndex) {
      return { color: '#00b0ff', fontWeight: 600, textDecoration: 'underline' }; // active
    } else {
      return { color: 'var(--text-secondary)', opacity: 0.4 }; // pending
    }
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Coins size={20} style={{ color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>CCTP V2 Cross-Chain Funding</h3>
        </div>
        <div style={{ fontSize: '0.75rem', background: 'rgba(0,136,255,0.1)', color: '#0088ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
          USDC Stablecoin
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
        Bridge USDC directly from Ethereum Sepolia or Arbitrum Sepolia using Circle&apos;s App Kit. The funds will be minted on Arc Testnet and deposited directly into the Escrow contract for Shipment #{shipmentId}.
      </p>

      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Required Funding Amount:</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {requiredAmount.toLocaleString()} USDC
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Destination Network:</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00e676', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.25rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e676' }}></span>
            Arc Testnet
          </div>
        </div>
      </div>

      {bridgeState.stage === 'idle' ? (
        <>
          <ChainSelector selectedChain={sourceChain} onChainChange={setSourceChain} />

          {isConnected ? (
            <button
              onClick={handleStartBridge}
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '12px',
                background: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
            >
              Start Bridge & Deposit ({requiredAmount} USDC) <ArrowRight size={16} />
            </button>
          ) : (
            <div style={{
              padding: '1rem',
              borderRadius: '12px',
              background: 'rgba(255, 171, 0, 0.05)',
              border: '1px solid rgba(255, 171, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              textAlign: 'center'
            }}>
              <ShieldAlert size={24} style={{ color: '#ffab00' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffab00' }}>Web3 Wallet Disconnected</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Please connect a Web3 wallet (e.g. MetaMask) in the top-right wallet panel to bridge funds.</span>
            </div>
          )}
        </>
      ) : (
        <div style={{
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {bridgeState.stage === 'complete' ? (
              <CheckCircle2 size={24} style={{ color: '#00e676' }} />
            ) : bridgeState.stage === 'error' ? (
              <AlertTriangle size={24} style={{ color: '#ff1744' }} />
            ) : (
              <Loader2 size={24} className="animate-spin" style={{ color: '#00b0ff' }} />
            )}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                {bridgeState.stage === 'complete' 
                  ? 'Transfer Successful!' 
                  : bridgeState.stage === 'error' 
                    ? 'Bridge Failed' 
                    : `Active Stage: ${bridgeState.stage.toUpperCase()}`}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                {bridgeState.detail}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '0.75rem',
            fontSize: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...getStageStyle('approve') }}>
              <span>1. Source Chain Approve</span>
              <span>{bridgeState.stage === 'approve' ? 'IN_PROGRESS' : 'DONE'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...getStageStyle('burn') }}>
              <span>2. Source Burn Transaction</span>
              {bridgeState.burnTxHash ? (
                <a 
                  href={`https://${sourceChain === 'Ethereum_Sepolia' ? 'sepolia.etherscan.io' : 'sepolia.arbiscan.io'}/tx/${bridgeState.burnTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#00b0ff', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  View Burn <ExternalLink size={10} />
                </a>
              ) : (
                <span>PENDING</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...getStageStyle('attestation') }}>
              <span>3. Fetch Attestation Signature</span>
              <span>{bridgeState.stage === 'attestation' ? 'POLLING' : 'PENDING'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...getStageStyle('mint') }}>
              <span>4. Relay & Mint on Arc</span>
              {bridgeState.mintTxHash ? (
                <a 
                  href={`https://testnet.arcscan.app/tx/${bridgeState.mintTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#00b0ff', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  View Mint <ExternalLink size={10} />
                </a>
              ) : (
                <span>PENDING</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...getStageStyle('escrow') }}>
              <span>5. Record Escrow Funding</span>
              <span>{bridgeState.stage === 'escrow' ? 'WRITING' : 'PENDING'}</span>
            </div>
          </div>

          {bridgeState.stage === 'error' && (
            <div style={{
              background: 'rgba(255, 23, 68, 0.05)',
              border: '1px solid rgba(255, 23, 68, 0.15)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: '#ff1744',
              lineHeight: 1.4
            }}>
              <strong>Error Details:</strong>
              <div style={{ marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>{bridgeState.errorMsg}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            {bridgeState.stage === 'error' && (
              <button
                onClick={handleStartBridge}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: 'var(--accent-color)',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Retry Bridge
              </button>
            )}
            <button
              onClick={handleClearHistory}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <History size={12} /> Clear History & Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
