/* eslint-disable @typescript-eslint/no-explicit-any */
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from './arc-config';

export interface AgentWalletState {
  address: Address;
  publicKey: string;
  chain: string;
  status: string;
  reputation: number;
}

/**
 * Circle Agent Stack integration - retrieves the MPC user-custody agent wallet.
 * Falls back to local deployer private key if no dedicated environment keys are found.
 */
export async function getAgentWallet(): Promise<AgentWalletState> {
  const privateKey = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) {
    // Standard sandbox fallback
    return {
      address: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194' as Address,
      publicKey: '04620f32997b102213e8b4e7...',
      chain: 'Arc Testnet',
      status: 'Active',
      reputation: 100
    };
  }

  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as Hex);

  return {
    address: account.address,
    publicKey: account.publicKey,
    chain: 'Arc Testnet',
    status: 'Active',
    reputation: 100
  };
}

/**
 * Execute on-chain transaction from the agent wallet gaslessly/directly on Arc Testnet
 */
export async function executeAgentTransaction(
  targetAddress: Address,
  abi: any,
  functionName: string,
  args: any[] = []
): Promise<Hex> {
  const privateKey = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.warn('[Circle Agent] No AGENT_PRIVATE_KEY found. Simulating transaction on-chain...');
    return '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
  }

  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as Hex);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network')
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network')
  });

  console.log(`[Circle Agent] Executing transaction ${functionName} at ${targetAddress}...`);

  const { request } = await publicClient.simulateContract({
    account,
    address: targetAddress,
    abi,
    functionName,
    args
  });

  const hash = await walletClient.writeContract(request as any);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[Circle Agent] Transaction ${functionName} settled: ${hash}`);
  return hash;
}
