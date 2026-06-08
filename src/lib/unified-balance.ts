/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppKit } from '@circle-fin/app-kit';
import { ViemAdapter } from '@circle-fin/adapter-viem-v2';
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, arbitrumSepolia } from 'viem/chains';
import { type WalletInfo } from '@/lib/types';

// Arc Testnet chain definition matching sandbox.ts
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
} as const;

export const chainRpcUrls = {
  Ethereum_Sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
  Arbitrum_Sepolia: 'https://arbitrum-sepolia-rpc.publicnode.com',
  Arc_Testnet: 'https://rpc.testnet.arc.network',
};

// Map chain name to viem chain object
export function getViemChain(chain: 'Ethereum_Sepolia' | 'Arbitrum_Sepolia' | 'Arc_Testnet') {
  if (chain === 'Ethereum_Sepolia') return sepolia;
  if (chain === 'Arbitrum_Sepolia') return arbitrumSepolia;
  return arcTestnet;
}

// Instantiate clients dynamically
export function getViemClients(
  chain: 'Ethereum_Sepolia' | 'Arbitrum_Sepolia' | 'Arc_Testnet',
  signerType: 'sandbox' | 'web3' | 'circle',
  wallet: WalletInfo | null,
  browserWalletClient: any
) {
  const rpcUrl = chainRpcUrls[chain];
  const viemChain = getViemChain(chain);

  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  });

  let walletClient = null;

  if (signerType === 'web3' && browserWalletClient) {
    walletClient = browserWalletClient;
  } else if (wallet && wallet.privateKey) {
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    walletClient = createWalletClient({
      account,
      chain: viemChain,
      transport: http(rpcUrl),
    });
  } else {
    throw new Error('No wallet signer available for writing on-chain');
  }

  return { publicClient, walletClient };
}

// Create a ViemAdapter for Unified Balance
export function createViemAdapter(
  chain: 'Ethereum_Sepolia' | 'Arbitrum_Sepolia' | 'Arc_Testnet',
  signerType: 'sandbox' | 'web3' | 'circle',
  wallet: WalletInfo | null,
  browserWalletClient: any
) {
  const { publicClient, walletClient } = getViemClients(chain, signerType, wallet, browserWalletClient);
  const viemChain = getViemChain(chain);
  return new ViemAdapter(
    {
      getPublicClient: () => publicClient as any,
      getWalletClient: () => walletClient as any,
    },
    {
      addressContext: 'user-controlled',
      supportedChains: [viemChain],
    }
  );
}

// Initialize AppKit singleton
let appKitInstance: AppKit | null = null;
export function getAppKit() {
  if (!appKitInstance) {
    appKitInstance = new AppKit();
  }
  return appKitInstance;
}

// 1. Fetch Aggregated USDC Balance and Breakdown
export async function fetchUnifiedBalances(address: string) {
  try {
    const kit = getAppKit();
    const result = await kit.unifiedBalance.getBalances({
      token: 'USDC',
      sources: {
        address,
        chains: ['Ethereum_Sepolia', 'Arbitrum_Sepolia', 'Arc_Testnet'],
      },
      networkType: 'testnet',
      includePending: true,
    });

    const totalConfirmed = parseFloat(result.totalConfirmedBalance || '0');
    const totalPending = parseFloat(result.totalPendingBalance || '0');

    // Parse breakdown
    const breakdown = (result.breakdown || []).flatMap((depositorBreakdown) =>
      (depositorBreakdown.breakdown || []).map((chainBreakdown) => ({
        chain: chainBreakdown.chain,
        confirmed: parseFloat(chainBreakdown.confirmedBalance || '0'),
        pending: parseFloat(chainBreakdown.pendingBalance || '0'),
      }))
    );

    return {
      success: true,
      totalConfirmed,
      totalPending,
      breakdown,
    };
  } catch (err) {
    console.warn('[Unified Balance] fetchUnifiedBalances error, falling back to direct RPC query:', err);
    try {
      const arcPublicClient = createPublicClient({
        chain: getViemChain('Arc_Testnet'),
        transport: http(chainRpcUrls['Arc_Testnet']),
      });
      const nativeBal = await arcPublicClient.getBalance({ address: address as `0x${string}` });
      const arcUsdc = parseFloat(formatUnits(nativeBal, 18));
      
      return {
        success: true,
        totalConfirmed: arcUsdc,
        totalPending: 0,
        breakdown: [
          { chain: 'Arc_Testnet', confirmed: arcUsdc, pending: 0 },
          { chain: 'Ethereum_Sepolia', confirmed: 0, pending: 0 },
          { chain: 'Arbitrum_Sepolia', confirmed: 0, pending: 0 },
        ],
      };
    } catch (fallbackErr) {
      console.error('[Unified Balance] Fallback RPC query also failed:', fallbackErr);
      return {
        success: false,
        totalConfirmed: 0,
        totalPending: 0,
        breakdown: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// 2. Deposit into Unified Balance
export async function depositToUnifiedBalance(
  chain: 'Ethereum_Sepolia' | 'Arbitrum_Sepolia' | 'Arc_Testnet',
  amount: string,
  signerType: 'sandbox' | 'web3' | 'circle',
  wallet: WalletInfo | null,
  browserWalletClient: any
) {
  try {
    const kit = getAppKit();
    const adapter = createViemAdapter(chain, signerType, wallet, browserWalletClient);

    const result = await kit.unifiedBalance.deposit({
      from: { adapter, chain },
      amount,
      token: 'USDC',
      allowanceStrategy: 'approve', // Standard ERC20 approval
    });

    return {
      success: true,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
    };
  } catch (err) {
    console.error('[Unified Balance] depositToUnifiedBalance error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// 3. Spend from Unified Balance to fund escrow
export async function spendFromUnifiedBalance(
  fromChain: 'Ethereum_Sepolia' | 'Arbitrum_Sepolia' | 'Arc_Testnet',
  destChain: 'Arc_Testnet',
  recipientAddress: string,
  amount: string,
  signerType: 'sandbox' | 'web3' | 'circle',
  wallet: WalletInfo | null,
  browserWalletClient: any
) {
  try {
    const kit = getAppKit();
    const fromAdapter = createViemAdapter(fromChain, signerType, wallet, browserWalletClient);
    
    // Create destination adapter (Arc Testnet)
    const toAdapter = createViemAdapter(destChain, signerType, wallet, browserWalletClient);

    const result = await kit.unifiedBalance.spend({
      from: {
        adapter: fromAdapter,
        allocations: [{ amount, chain: fromChain }],
      },
      to: {
        adapter: toAdapter,
        chain: destChain,
        recipientAddress,
      },
      amount,
      token: 'USDC',
    });

    return {
      success: true,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
    };
  } catch (err) {
    console.error('[Unified Balance] spendFromUnifiedBalance error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
