/* eslint-disable @typescript-eslint/no-explicit-any */
import { createPublicClient, createWalletClient, http, keccak256, encodePacked, recoverAddress, hashMessage } from 'viem';
import { privateKeyToAccount, publicKeyToAddress } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';
import { supabase, toSnakeCase } from './db';
import addresses from '../abi/addresses.json';
import oracleArtifact from '../abi/FreightOracle.json';
import escrowArtifact from '../abi/FreightEscrow.json';

// Load oracle contract address dynamically from addresses.json
const oracleAddress = (addresses as any).FreightOracle || '';
const escrowAddress = (addresses as any).FreightEscrow || '';
const privateKey = process.env.PRIVATE_KEY || '';
const rpcUrl = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';

/**
 * Format public key to derived Ethereum address
 */
export function getDeviceAddress(publicKey: string): string {
  let formatted = publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`;
  if (formatted.length === 128) {
    formatted = '0x04' + formatted.substring(2);
  } else if (formatted.length === 130 && !formatted.startsWith('0x04')) {
    formatted = '0x04' + formatted.substring(2);
  }
  return publicKeyToAddress(formatted as `0x${string}`);
}

/**
 * Server-side ECDSA signature verification for IoT telemetry
 */
export async function verifyTelemetrySignature(
  shipmentId: number,
  milestoneType: string,
  temperature: number,
  humidity: number,
  timestamp: number,
  signature: string,
  devicePublicKey: string
): Promise<boolean> {
  try {
    const expectedAddress = getDeviceAddress(devicePublicKey).toLowerCase();

    // Reconstruct raw packed message hash
    const rawHash = keccak256(
      encodePacked(
        ['uint256', 'string', 'int256', 'uint256', 'uint256'],
        [BigInt(shipmentId), milestoneType, BigInt(temperature), BigInt(humidity), BigInt(timestamp)]
      )
    );

    // Apply Ethereum Signed Message prefix and recover address
    const recoveredAddress = await recoverAddress({
      hash: hashMessage({ raw: rawHash }),
      signature: signature as `0x${string}`,
    });

    console.log(`[IoT Oracle] Recovered Signer Address: ${recoveredAddress.toLowerCase()}, Expected: ${expectedAddress}`);
    return recoveredAddress.toLowerCase() === expectedAddress;
  } catch (error) {
    console.error('[IoT Oracle] Signature verification failed:', error);
    return false;
  }
}

/**
 * Relays verified telemetry data to FreightOracle on-chain via ORACLE_ROLE (server wallet)
 */
export async function relayMilestoneToChain(
  shipmentId: number,
  milestoneType: string,
  temperature: number,
  humidity: number,
  timestamp: number,
  signature: string
): Promise<string> {
  if (!privateKey) {
    console.warn('[IoT Oracle] PRIVATE_KEY not set, skipping on-chain relay (running in simulated database mode)');
    return '0x_simulated_oracle_relay_hash';
  }

  if (!oracleAddress) {
    throw new Error('[IoT Oracle] FreightOracle address not set in addresses.json');
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? (privateKey as `0x${string}`) : `0x${privateKey}`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  console.log(`[IoT Oracle] Relaying milestone "${milestoneType}" for shipment #${shipmentId} from wallet: ${account.address}`);

  const { request } = await publicClient.simulateContract({
    address: oracleAddress as `0x${string}`,
    abi: oracleArtifact.abi,
    functionName: 'verifyAndRelay',
    args: [
      BigInt(shipmentId),
      milestoneType,
      BigInt(temperature),
      BigInt(humidity),
      BigInt(timestamp),
      signature as `0x${string}`,
    ],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  console.log(`[IoT Oracle] Transaction submitted on-chain: ${txHash}`);
  
  // Wait for receipt (Arc has sub-second finality)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`[IoT Oracle] Transaction mined: ${receipt.transactionHash}`);

  // Fetch updated shipment info to save in DB
  try {
    const updatedStatus = (await publicClient.readContract({
      address: escrowAddress as `0x${string}`,
      abi: escrowArtifact.abi,
      functionName: 'shipments',
      args: [BigInt(shipmentId)],
    })) as any;

    const statusStrings = ['Created', 'InTransit', 'Arrived', 'CustomCleared', 'Completed', 'Cancelled'];
    const newStatus = statusStrings[updatedStatus[10]];

    // Sync state to DB
    await supabase
      .from('shipments')
      .update(toSnakeCase({
        status: newStatus,
        location: milestoneType === 'departure' ? 'In Transit' : milestoneType === 'singapore' ? 'Singapore Checkpoint' : milestoneType === 'arrival' ? 'Arrived at Destination' : 'Customs Cleared',
        temperature: temperature / 100,
        humidity: humidity / 100,
      }) as any)
      .eq('id', shipmentId);
      
  } catch (syncError) {
    console.error('[IoT Oracle] Failed to sync updated shipment status to database:', syncError);
  }

  return txHash;
}
