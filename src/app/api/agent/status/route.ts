/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getAgentWallet } from '@/lib/circle-agent';
import { agentLogs } from '@/lib/agent-coordinator';
import { createPublicClient, http, type Address } from 'viem';
import { arcTestnet } from '@/lib/arc-config';
import addresses from '@/abi/addresses.json';
import agentArtifact from '@/abi/FreightAgent.json';

export async function GET() {
  try {
    const wallet = await getAgentWallet();
    const agentAddress = (addresses as any).FreightAgent;
    
    let reputation = wallet.reputation;
    let onChainRegistered = false;
    let agentId = 0n;

    if (agentAddress) {
      try {
        const publicClient = createPublicClient({
          chain: arcTestnet,
          transport: http(process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network')
        });

        reputation = Number(await publicClient.readContract({
          address: agentAddress as Address,
          abi: agentArtifact.abi,
          functionName: 'reputation'
        }));

        agentId = await publicClient.readContract({
          address: agentAddress as Address,
          abi: agentArtifact.abi,
          functionName: 'agentId'
        }) as bigint;

        onChainRegistered = agentId > 0n;
      } catch (err) {
        console.warn('[Agent Status API] Failed to fetch on-chain reputation:', err);
      }
    }

    return NextResponse.json({
      name: 'FreightX Logistics Coordinator',
      walletAddress: wallet.address,
      reputation,
      onChainRegistered,
      agentId: agentId.toString(),
      status: 'Active',
      logs: agentLogs
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
