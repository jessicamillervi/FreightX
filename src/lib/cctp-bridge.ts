/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppKit } from "@circle-fin/app-kit";
import { ViemAdapter } from "@circle-fin/adapter-viem-v2";
import { decodeEventLog } from "viem";

const messageSentAbi = {
  name: 'MessageSent',
  type: 'event',
  inputs: [{ type: 'bytes', name: 'message', indexed: false }]
} as const;

export interface BridgeParams {
  sourceChain: "Ethereum_Sepolia" | "Arbitrum_Sepolia";
  sourcePublicClient: unknown;
  sourceWalletClient: unknown;
  destPublicClient: unknown;
  destWalletClient: unknown;
  amount: string;
  onStatusUpdate: (stage: 'approve' | 'burn' | 'attestation' | 'mint' | 'complete' | 'error', detail: string, txHash?: string) => void;
}

interface BridgeEventPayload {
  values?: {
    txHash?: string;
  };
}

export async function executeBridge(params: BridgeParams) {
  const {
    sourceChain,
    sourcePublicClient,
    sourceWalletClient,
    destPublicClient,
    destWalletClient,
    amount,
    onStatusUpdate
  } = params;

  try {
    onStatusUpdate('approve', 'Initializing AppKit adapters...', undefined);
    
    // Create source adapter
    const sourceAdapter = new ViemAdapter({
      getPublicClient: () => sourcePublicClient as any,
      getWalletClient: () => sourceWalletClient as any,
    }, {
      addressContext: 'user-controlled',
      supportedChains: [sourceChain]
    });

    // Create destination adapter (Arc Testnet)
    const destAdapter = new ViemAdapter({
      getPublicClient: () => destPublicClient as any,
      getWalletClient: () => destWalletClient as any,
    }, {
      addressContext: 'user-controlled',
      supportedChains: ['Arc_Testnet']
    });

    const kit = new AppKit();
    
    let burnTxHash: string | undefined;
    let mintTxHash: string | undefined;
    let messageBytes: string | undefined;
    
    // Register listeners
    kit.on('bridge.approve', (payload: unknown) => {
      const p = payload as BridgeEventPayload;
      const txHash = p?.values?.txHash;
      onStatusUpdate('approve', 'Approving USDC on source chain...', txHash);
    });

    kit.on('bridge.burn', (payload: unknown) => {
      const p = payload as BridgeEventPayload;
      const txHash = p?.values?.txHash;
      burnTxHash = txHash;
      onStatusUpdate('burn', 'USDC successfully burned on source. Retrieving CCTP message...', txHash);
    });

    kit.on('bridge.fetchAttestation', () => {
      onStatusUpdate('attestation', 'Polling Circle Iris API for CCTP attestation signature...', undefined);
    });

    kit.on('bridge.mint', (payload: unknown) => {
      const p = payload as BridgeEventPayload;
      const txHash = p?.values?.txHash;
      mintTxHash = txHash;
      onStatusUpdate('mint', 'Relaying attestation and minting USDC on Arc Testnet...', txHash);
    });

    onStatusUpdate('approve', 'Initiating cross-chain bridge transfer...', undefined);
    
    // Execute bridge
    const result = await kit.bridge({
      from: {
        adapter: sourceAdapter,
        chain: sourceChain
      },
      to: {
        adapter: destAdapter,
        chain: "Arc_Testnet"
      },
      amount: amount
    });
    
    // Once result is returned, extract the burn receipt to get the CCTP message bytes
    if (burnTxHash && sourcePublicClient) {
      try {
        const client = sourcePublicClient as any;
        const receipt = await client.getTransactionReceipt({ hash: burnTxHash as `0x${string}` });
        const log = receipt.logs.find((l: any) => l.topics[0] === '0x8c5261668696ce227b8379c0ff736eacb7b5dbe287798fe1a2ee74b45508a8a4');
        if (log) {
          const decoded = decodeEventLog({
            abi: [messageSentAbi],
            data: log.data,
            topics: log.topics,
          });
          messageBytes = decoded.args.message;
        }
      } catch (e) {
        console.error('Failed to parse CCTP message bytes from burn logs:', e);
      }
    }

    onStatusUpdate('complete', 'Bridge transaction completed successfully!', mintTxHash);

    return {
      burnTxHash,
      mintTxHash,
      messageBytes,
      result
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    onStatusUpdate('error', err?.message || String(error), undefined);
    throw error;
  }
}
