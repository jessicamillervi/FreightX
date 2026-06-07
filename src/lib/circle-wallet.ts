import { 
  toModularTransport, 
  toPasskeyTransport, 
  toCircleSmartAccount, 
  WebAuthnMode,
  toWebAuthnCredential
} from '@circle-fin/modular-wallets-core';
import { toWebAuthnAccount, createBundlerClient } from 'viem/account-abstraction';
import { createPublicClient, http, type Hex, type Address, encodeFunctionData, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from './arc-config';

// Load keys from environment
const CLIENT_KEY = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY || '';
const CLIENT_URL = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL || 'https://api.circle.com/v1/w3s';

// Storage Keys
const SESSION_STORAGE_KEY = 'freightx_circle_wallet_session';

export interface CircleWalletSession {
  address: Address;
  username: string;
  isMock: boolean;
  credentialId?: string;
  serializedCredential?: string;
}

// Check if Circle Modular Wallets are properly configured
export const isCircleConfigured = (): boolean => {
  return !!CLIENT_KEY && CLIENT_KEY !== 'mock_client_key_for_testing' && !!CLIENT_URL;
};

// Create browser passkey transport
export const getPasskeyTransport = () => {
  if (typeof window === 'undefined') return null;
  return toPasskeyTransport(CLIENT_URL, CLIENT_KEY);
};

// Create modular blockchain transport
export const getModularTransport = () => {
  return toModularTransport(`${CLIENT_URL}/arcTestnet`, CLIENT_KEY);
};

// Create standard public client
export const getCirclePublicClient = () => {
  const transport = isCircleConfigured() 
    ? getModularTransport() 
    : http('https://rpc.testnet.arc.network');
  
  return createPublicClient({
    chain: arcTestnet,
    transport,
  });
};

/**
 * Register a new passkey credential and deploy/create the smart account
 */
export async function registerCircleWallet(username: string): Promise<CircleWalletSession> {
  if (typeof window === 'undefined') {
    throw new Error('WebAuthn is only available in the browser.');
  }

  if (!isCircleConfigured()) {
    console.warn('[Circle Wallet] Missing Circle API credentials. Initializing in Simulation/Mock Mode.');
    return createMockSession(username);
  }

  try {
    const passkeyTransport = getPasskeyTransport();
    if (!passkeyTransport) throw new Error('Passkey transport failed to initialize.');

    // 1. WebAuthn Registration
    const credential = await toWebAuthnCredential({
      transport: passkeyTransport,
      mode: WebAuthnMode.Register,
      username,
    });

    if (!credential) {
      throw new Error('WebAuthn registration cancelled or failed.');
    }

    // 2. Initialize Smart Account
    const publicClient = getCirclePublicClient();
    const smartAccount = await toCircleSmartAccount({
      client: publicClient,
      owner: toWebAuthnAccount({ credential }),
    });

    const session: CircleWalletSession = {
      address: smartAccount.address,
      username,
      isMock: false,
      credentialId: credential.id,
      serializedCredential: JSON.stringify(credential),
    };

    saveSession(session);
    return session;
  } catch (error) {
    console.error('[Circle Wallet] Real registration failed, falling back to mock mode:', error);
    return createMockSession(username);
  }
}

/**
 * Authenticate with an existing passkey
 */
export async function loginCircleWallet(): Promise<CircleWalletSession> {
  if (typeof window === 'undefined') {
    throw new Error('WebAuthn is only available in the browser.');
  }

  if (!isCircleConfigured()) {
    console.warn('[Circle Wallet] Missing Circle API credentials. Logging in via last Mock session.');
    const saved = getSavedSession();
    if (saved && saved.isMock) return saved;
    return createMockSession('SandboxUser');
  }

  try {
    const passkeyTransport = getPasskeyTransport();
    if (!passkeyTransport) throw new Error('Passkey transport failed to initialize.');

    // 1. WebAuthn Authentication
    const credential = await toWebAuthnCredential({
      transport: passkeyTransport,
      mode: WebAuthnMode.Login,
    });

    if (!credential) {
      throw new Error('WebAuthn authentication cancelled or failed.');
    }

    // 2. Re-initialize Smart Account
    const publicClient = getCirclePublicClient();
    const smartAccount = await toCircleSmartAccount({
      client: publicClient,
      owner: toWebAuthnAccount({ credential }),
    });

    // Detect username from credentials or fallback
    const username = 'PasskeyUser';

    const session: CircleWalletSession = {
      address: smartAccount.address,
      username,
      isMock: false,
      credentialId: credential.id,
      serializedCredential: JSON.stringify(credential),
    };

    saveSession(session);
    return session;
  } catch (error) {
    console.error('[Circle Wallet] Real login failed, falling back to mock session:', error);
    const saved = getSavedSession();
    if (saved && saved.isMock) return saved;
    return createMockSession('SandboxUser');
  }
}

/**
 * Recreate the smart account from stored credential without prompting browser biometrics
 */
export async function restoreCircleWallet(session: CircleWalletSession): Promise<unknown> {
  if (session.isMock) {
    return createMockWalletClient(session.username);
  }

  if (!session.serializedCredential) {
    throw new Error('No saved credential found in session.');
  }

  const credential = JSON.parse(session.serializedCredential);
  const publicClient = getCirclePublicClient();
  
  return toCircleSmartAccount({
    client: publicClient,
    owner: toWebAuthnAccount({ credential }),
  });
}

/**
 * Execute contract write on behalf of modular wallet (gasless via paymaster)
 */
export async function executeModularTransaction(
  session: CircleWalletSession,
  args: { address: Address; abi: unknown; functionName: string; args?: unknown[] }
): Promise<Hex> {
  if (session.isMock) {
    console.log(`[Circle Wallet] Executing Mock sponsored transaction for ${args.functionName}...`);
    const mockClient = createMockWalletClient(session.username);
    
    // Auto-fund the mock passkey address from sandbox faucet/wallet to cover transaction costs on-chain
    await ensureMockAddressHasGas(session.address);

    const hash = await mockClient.writeContract({
      address: args.address,
      abi: args.abi as unknown as import('viem').Abi,
      functionName: args.functionName,
      args: args.args || [],
    });
    return hash;
  }

  console.log(`[Circle Wallet] Dispatching sponsored user operation via Circle Paymaster...`);
  
  const modularTransport = getModularTransport();
  const smartAccount = (await restoreCircleWallet(session)) as import('viem/account-abstraction').SmartAccount;

  const bundlerClient = createBundlerClient({
    account: smartAccount,
    chain: arcTestnet,
    transport: modularTransport,
  });

  const callData = encodeFunctionData({
    abi: args.abi as unknown as import('viem').Abi,
    functionName: args.functionName,
    args: args.args || [],
  });

  const userOpHash = await bundlerClient.sendUserOperation({
    account: smartAccount,
    calls: [
      {
        to: args.address,
        data: callData,
      }
    ],
    paymaster: true, // Gas Station sponsorship
  });

  const userOpReceipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  const txHash = userOpReceipt.receipt.transactionHash || (userOpReceipt as { transactionHash?: Hex } & unknown).transactionHash || '';
  return txHash;
}

// Helpers for Session Persistence
export function saveSession(session: CircleWalletSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function getSavedSession(): CircleWalletSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSavedSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// Mock Implementation for simulation mode
function createMockSession(username: string): CircleWalletSession {
  const privateKey = getOrCreateMockPrivateKey(username);
  const account = privateKeyToAccount(privateKey);
  
  const session: CircleWalletSession = {
    address: account.address,
    username,
    isMock: true,
  };
  saveSession(session);
  return session;
}

function getOrCreateMockPrivateKey(username: string): Hex {
  const storageKey = `freightx_mock_privkey_${username}`;
  let privKey = localStorage.getItem(storageKey);
  if (!privKey) {
    privKey = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    localStorage.setItem(storageKey, privKey);
  }
  return privKey as Hex;
}

function createMockWalletClient(username: string) {
  const privateKey = getOrCreateMockPrivateKey(username);
  const account = privateKeyToAccount(privateKey);
  
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http('https://rpc.testnet.arc.network'),
  });
}

/**
 * To maintain the on-chain sandbox experience in mock mode,
 * we automatically transfer 0.05 USDC from the sandbox account to the passkey account
 * if it runs low on gas. This simulates a completely gasless experience for the user.
 */
async function ensureMockAddressHasGas(address: Address) {
  try {
    const publicClient = getCirclePublicClient();
    const balance = await publicClient.getBalance({ address });
    
    // Gas is low, top up from the sandbox wallet if available
    if (balance < 10000000000000000n) { // Less than 0.01 USDC
      const sandboxWalletRaw = localStorage.getItem('freightx_sandbox_wallet');
      if (sandboxWalletRaw) {
        const sandboxWallet = JSON.parse(sandboxWalletRaw);
        if (sandboxWallet && sandboxWallet.privateKey) {
          const senderAccount = privateKeyToAccount(sandboxWallet.privateKey);
          const walletClient = createWalletClient({
            account: senderAccount,
            chain: arcTestnet,
            transport: http('https://rpc.testnet.arc.network'),
          });
          
          console.log(`[Paymaster Simulator] Sponsoring transaction gas. Topping up passkey account ${address}...`);
          const hash = await walletClient.sendTransaction({
            to: address,
            value: 50000000000000000n, // 0.05 USDC
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }
    }
  } catch (error) {
    console.error('[Paymaster Simulator] Gas top up failed:', error);
  }
}
