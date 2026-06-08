/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase, toCamelCase, toSnakeCase } from './db';
import { executeAgentTransaction } from './circle-agent';
import addresses from '../abi/addresses.json';
import agentArtifact from '../abi/FreightAgent.json';
import escrowArtifact from '../abi/FreightEscrow.json';
import { createPublicClient, http, type Hex, type Address } from 'viem';
import { arcTestnet } from './arc-config';

export interface AgentLog {
  id: string;
  timestamp: string;
  shipmentId: number;
  action: string;
  details: string;
  txHash?: string;
  status: 'info' | 'warning' | 'success' | 'error';
}

// In-memory log cache for the coordinator activity
export const agentLogs: AgentLog[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
    shipmentId: 101,
    action: 'Agent Registered',
    details: 'FreightX Coordinator registered with ERC-8004 Identity on Arc Testnet.',
    status: 'success'
  }
];

// Keep track of which shipments we already processed to prevent spamming
const processedDisputes = new Set<number>();
const processedSettlements = new Set<number>();

/**
 * Main coordinator logic loop that monitors telemetry and automates on-chain operations
 */
export async function runAgentCoordinator(): Promise<{ success: boolean; executedLogs: AgentLog[] }> {
  const executedLogs: AgentLog[] = [];
  try {
    console.log('[Agent Coordinator] Running verification loop...');
    const agentAddress = (addresses as any).FreightAgent;
    const escrowAddress = (addresses as any).FreightEscrow;

    if (!agentAddress || !escrowAddress) {
      console.warn('[Agent Coordinator] Smart contract addresses not configured in addresses.json.');
      return { success: false, executedLogs };
    }

    // Initialize Viem public client for onchain state reads
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network')
    });

    // 1. Fetch active shipments from Database
    const { data: dbShipments, error: fetchError } = await supabase
      .from('shipments')
      .select('*');

    if (fetchError) {
      console.error('[Agent Coordinator] Failed to fetch shipments from database:', fetchError);
      return { success: false, executedLogs };
    }

    const shipments = toCamelCase(dbShipments) as any[];

    for (const shipment of shipments) {
      const shipmentId = Number(shipment.id);
      const temp = Number(shipment.temperature || 0);
      const status = shipment.status || 'Created';

      // Skip completed / cancelled shipments
      if (status === 'Completed' || status === 'Cancelled' || status === 4 || status === 5) {
        continue;
      }

      // Check on-chain shipment state to prevent duplicate operations
      let onChainStatus = status;
      try {
        const chainShipment = await publicClient.readContract({
          address: escrowAddress as Address,
          abi: escrowArtifact.abi,
          functionName: 'shipments',
          args: [BigInt(shipmentId)]
        }) as any;

        const statusEnum = Number(chainShipment[10] ?? chainShipment.status);
        const statuses = ['Created', 'InTransit', 'Arrived', 'CustomCleared', 'Completed', 'Cancelled'];
        onChainStatus = statuses[statusEnum] || status;
      } catch (err) {
        console.warn(`[Agent Coordinator] Could not fetch onchain status for shipment #${shipmentId}:`, err);
      }

      if (onChainStatus === 'Completed' || onChainStatus === 'Cancelled') {
        continue;
      }

      // Requirement 1: Automated dispute flagging for temperature breaches in transit (> 8.0 C)
      if (temp > 8.0 && !processedDisputes.has(shipmentId)) {
        // Double check onchain if a job already exists
        let jobExists = false;
        try {
          const jobId = await publicClient.readContract({
            address: agentAddress as Address,
            abi: agentArtifact.abi,
            functionName: 'shipmentJobs',
            args: [BigInt(shipmentId)]
          }) as bigint;
          if (jobId > 0n) {
            jobExists = true;
          }
        } catch (jobErr) {
          console.warn('[Agent Coordinator] Failed to read shipmentJobs mapping:', jobErr);
        }

        if (!jobExists) {
          console.log(`[Agent Coordinator] Telemetry breach detected on Shipment #${shipmentId} (Temp: ${temp}°C). Creating on-chain dispute job...`);
          
          try {
            const txHash = await executeAgentTransaction(
              agentAddress as Address,
              agentArtifact.abi,
              'createDisputeJob',
              [BigInt(shipmentId), `IoT Telemetry breach: Temperature of ${temp}°C exceeds limits.`]
            );

            const newLog: AgentLog = {
              id: Math.random().toString(),
              timestamp: new Date().toISOString(),
              shipmentId,
              action: 'Dispute Flagged',
              details: `Breach detected: ${temp}°C. Flagged ERC-8183 dispute job on-chain.`,
              txHash,
              status: 'warning'
            };

            agentLogs.unshift(newLog);
            executedLogs.push(newLog);
            processedDisputes.add(shipmentId);

            // Sync with local DB if applicable
            await supabase.from('audit_logs').insert(toSnakeCase({
              shipmentId,
              event: 'Dispute Flagged',
              details: `Autonomous Agent created ERC-8183 dispute job (Temp: ${temp}°C). Tx: ${txHash}`,
              timestamp: new Date().toISOString()
            }) as any);

          } catch (txErr: any) {
            console.error('[Agent Coordinator] On-chain dispute creation failed:', txErr);
          }
        } else {
          processedDisputes.add(shipmentId);
        }
      }

      // Requirement 2: Automated settlement (pickupCargo) once customs cleared and no active breaches
      const isCustomsCleared = onChainStatus === 'CustomCleared' || status === 'Customs Cleared' || status === 'Custom Cleared';
      
      if (isCustomsCleared && !processedSettlements.has(shipmentId)) {
        // Ensure no active temperature breaches exist
        const hasViolations = temp > 8.0 || processedDisputes.has(shipmentId);

        if (!hasViolations) {
          console.log(`[Agent Coordinator] Shipment #${shipmentId} customs cleared. Triggering autonomous settlement...`);

          try {
            const txHash = await executeAgentTransaction(
              agentAddress as Address,
              agentArtifact.abi,
              'executeSettlement',
              [BigInt(shipmentId)]
            );

            const newLog: AgentLog = {
              id: Math.random().toString(),
              timestamp: new Date().toISOString(),
              shipmentId,
              action: 'Cargo Settled',
              details: `Autonomous payout & cargo pickup settled via on-chain contract trigger.`,
              txHash,
              status: 'success'
            };

            agentLogs.unshift(newLog);
            executedLogs.push(newLog);
            processedSettlements.add(shipmentId);

            // Sync with local DB status update
            await supabase
              .from('shipments')
              .update({ status: 'Completed' })
              .eq('id', shipmentId);

            await supabase.from('audit_logs').insert(toSnakeCase({
              shipmentId,
              event: 'Cargo Settled',
              details: `Autonomous agent successfully triggered shipment settlement and payouts. Tx: ${txHash}`,
              timestamp: new Date().toISOString()
            }) as any);

          } catch (settleErr: any) {
            console.error('[Agent Coordinator] Autonomous settlement failed:', settleErr);
          }
        } else {
          console.log(`[Agent Coordinator] Shipment #${shipmentId} cleared customs but has an active dispute. Holding settlement.`);
        }
      }
    }

    return { success: true, executedLogs };
  } catch (globalErr: any) {
    console.error('[Agent Coordinator] Loop execution error:', globalErr);
    return { success: false, executedLogs };
  }
}
