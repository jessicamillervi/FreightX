import { createPublicClient, http, parseEventLogs } from 'viem';
import { supabase, toSnakeCase } from './db';
import { fetchShipmentFromChain, fetchPOLoanFromChain } from '@/services/sandbox';
import escrowArtifact from '@/abi/FreightEscrow.json';

// Arc Testnet Chain config
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network'] },
    public: { http: [process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network'] },
  },
  testnet: true
} as const;

/**
 * Syncs contract events to Supabase PostgreSQL database
 */
export async function syncEventsFromChain(
  contracts: {
    escrow: `0x${string}`;
    passport: `0x${string}`;
    usdc: `0x${string}`;
    eurc: `0x${string}`;
    usyc: `0x${string}`;
  },
  lookbackBlocks = 5000n
): Promise<{ success: boolean; syncedShipments: number; syncedLoans: number }> {
  try {
    const rpcUrl = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl)
    });

    const currentBlock = await publicClient.getBlockNumber();
    const startBlock = currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : 0n;

    console.log(`Syncing events from block ${startBlock} to ${currentBlock} for escrow contract ${contracts.escrow}`);

    // Fetch all logs from escrow contract
    const logs = await publicClient.getLogs({
      address: contracts.escrow,
      fromBlock: startBlock,
      toBlock: currentBlock
    });

    const parsedLogs = parseEventLogs({
      abi: escrowArtifact.abi,
      logs
    });

    const shipmentIdsToSync = new Set<number>();
    const poIdsToSync = new Set<number>();

    for (const log of parsedLogs) {
      const typedLog = log as { eventName?: string; args?: { shipmentId?: bigint; poId?: bigint } };
      const eventName = typedLog.eventName || '';
      const args = typedLog.args;
      
      // Process Shipment events
      if (
        ['ShipmentCreated', 'MilestoneReached', 'DemurrageCharged', 'ShipmentCompleted', 'ShipmentCancelled', 'CarrierPayrollPaid', 'FactoringOffered', 'FactoringCancelled', 'FactoringPurchased', 'TemperatureViolationLogged', 'IoTGatewayRegistered', 'IoTSignatureVerified', 'EscrowWrappedInUSYC', 'EscrowRedeemedFromUSYC', 'CCTPFundingReceived'].includes(eventName)
      ) {
        if (args && args.shipmentId !== undefined) {
          shipmentIdsToSync.add(Number(args.shipmentId));
        }
      }

      // Process Purchase Order (PO) events
      if (
        ['POFinancingRequested', 'POFinancingFunded', 'POFinancingRepaid'].includes(eventName)
      ) {
        if (args && args.poId !== undefined) {
          poIdsToSync.add(Number(args.poId));
        }
      }
    }

    console.log(`Found ${shipmentIdsToSync.size} unique shipments and ${poIdsToSync.size} unique PO loans to sync.`);

    // 1. Fetch & Update Shipments
    let syncedShipments = 0;
    for (const shipmentId of shipmentIdsToSync) {
      const onchainData = await fetchShipmentFromChain(contracts, shipmentId);
      if (onchainData) {
        // Map fields and save to DB
        const dbRow = toSnakeCase({
          ...onchainData,
          onChain: true
        }) as Record<string, unknown>;
        
        const { error } = await supabase
          .from('shipments')
          .upsert(dbRow);
          
        if (error) {
          console.error(`Failed to sync shipment ${shipmentId} in database:`, error.message);
        } else {
          syncedShipments++;
        }
      }
    }

    // 2. Fetch & Update PO Loans
    let syncedLoans = 0;
    for (const poId of poIdsToSync) {
      const onchainLoan = await fetchPOLoanFromChain(contracts, poId);
      if (onchainLoan) {
        const dbRow = toSnakeCase(onchainLoan) as Record<string, unknown>;
        const { error } = await supabase
          .from('po_loans')
          .upsert(dbRow);

        if (error) {
          console.error(`Failed to sync PO loan ${poId} in database:`, error.message);
        } else {
          syncedLoans++;
        }
      }
    }

    return {
      success: true,
      syncedShipments,
      syncedLoans
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Event sync failed:', errMsg);
    return {
      success: false,
      syncedShipments: 0,
      syncedLoans: 0
    };
  }
}
