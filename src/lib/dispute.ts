import { createPublicClient, http, type Address, getContract, parseUnits, formatUnits } from 'viem';
import { getPublicClient, resolveWalletClient, getSavedContracts, getOrCreateSandboxWallet } from '@/services/sandbox';
import disputeArtifact from '@/abi/DisputeArbitration.json';
import addresses from '@/abi/addresses.json';

const LOCAL_ARBITRATORS_KEY = 'freightx_arbitrators';
const LOCAL_DISPUTES_KEY = 'freightx_disputes';

export interface ArbitratorInfo {
  address: string;
  stakedAmount: number; // in USDC
  reputation: number;
  registered: boolean;
}

export interface DisputeInfo {
  id: number;
  shipmentId: number;
  evidenceHash: string;
  proposedSupplierPayout: number; // in USDC/EURC
  proposedCarrierPayout: number;  // in USDC/EURC
  claimant: string;
  voteCount: number;
  resolved: boolean;
  verdictSupplierPayout: number;
  verdictCarrierPayout: number;
  votes: Record<string, { supplierPayout: number; carrierPayout: number }>;
}

// Helper to query on-chain disputes
export async function getArbitratorsOnchain(): Promise<ArbitratorInfo[]> {
  try {
    const publicClient = getPublicClient();
    const contractAddr = (addresses as any).DisputeArbitration;
    if (!contractAddr) return [];

    return [];
  } catch {
    return [];
  }
}

// Standard SDK functions supporting both Local and On-Chain modes
export function getLocalArbitrators(): ArbitratorInfo[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(LOCAL_ARBITRATORS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // fallback
    }
  }
  // Initialize with some default test arbitrators
  const defaults: ArbitratorInfo[] = [
    { address: '0x90F8bf5E37941700d118a36FEf1e944783b9c792', stakedAmount: 100, reputation: 100, registered: true },
    { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', stakedAmount: 100, reputation: 110, registered: true },
    { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', stakedAmount: 100, reputation: 90, registered: true },
  ];
  localStorage.setItem(LOCAL_ARBITRATORS_KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveLocalArbitrators(list: ArbitratorInfo[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_ARBITRATORS_KEY, JSON.stringify(list));
}

export function getLocalDisputes(): DisputeInfo[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(LOCAL_DISPUTES_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // fallback
    }
  }
  return [];
}

export function saveLocalDisputes(list: DisputeInfo[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_DISPUTES_KEY, JSON.stringify(list));
  
  // Sync to server API
  fetch('/api/disputes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  }).catch(err => console.error('Failed to sync disputes:', err));
}

// 1. Arbitrator Registration
export async function registerArbitrator(
  walletSigner: any,
  mode: 'live' | 'local'
): Promise<string> {
  if (mode === 'local') {
    const list = getLocalArbitrators();
    const addr = typeof walletSigner === 'string' ? walletSigner : walletSigner.address || '0xArbitrator';
    if (list.some(a => a.address.toLowerCase() === addr.toLowerCase())) {
      throw new Error('Arbitrator already registered');
    }
    list.push({
      address: addr,
      stakedAmount: 100,
      reputation: 100,
      registered: true
    });
    saveLocalArbitrators(list);
    return '0xMockTxHashArbitratorRegistration';
  } else {
    const walletClient = resolveWalletClient(walletSigner);
    const contractAddr = (addresses as any).DisputeArbitration;
    if (!contractAddr) throw new Error('Arbitration contract not deployed');

    // First approve USDC staking transfer
    const usdcAddr = (addresses as any).USDC || '0x3600000000000000000000000000000000000000';
    const approveAbi = [
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }]
      }
    ];

    const approveHash = await walletClient.writeContract({
      address: usdcAddr as Address,
      abi: approveAbi,
      functionName: 'approve',
      args: [contractAddr, 100n * 1000000n] // 100 USDC
    });
    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    // Register arbitrator
    const hash = await walletClient.writeContract({
      address: contractAddr as Address,
      abi: disputeArtifact.abi,
      functionName: 'registerArbitrator',
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
}

// 2. Raise Dispute
export async function raiseDispute(
  walletSigner: any,
  shipmentId: number,
  evidenceHash: string,
  proposedSupplierPayout: number,
  proposedCarrierPayout: number,
  mode: 'live' | 'local'
): Promise<{ disputeId: number; txHash: string }> {
  if (mode === 'local') {
    const disputesList = getLocalDisputes();
    const disputeId = disputesList.length + 1;
    const newDispute: DisputeInfo = {
      id: disputeId,
      shipmentId,
      evidenceHash,
      proposedSupplierPayout,
      proposedCarrierPayout,
      claimant: typeof walletSigner === 'string' ? walletSigner : (walletSigner.address || '0xClaimant'),
      voteCount: 0,
      resolved: false,
      verdictSupplierPayout: 0,
      verdictCarrierPayout: 0,
      votes: {}
    };
    disputesList.push(newDispute);
    saveLocalDisputes(disputesList);

    // Lock shipment local state
    const savedLocalShipments = localStorage.getItem('freightx_local_shipments');
    if (savedLocalShipments) {
      const shipments = JSON.parse(savedLocalShipments);
      const idx = shipments.findIndex((s: any) => s.id === shipmentId);
      if (idx !== -1) {
        shipments[idx].status = 'In Transit'; // Pause settlement/hold
        shipments[idx].disputeActive = true;
        localStorage.setItem('freightx_local_shipments', JSON.stringify(shipments));
      }
    }

    return { disputeId, txHash: '0xMockTxHashRaiseDispute' };
  } else {
    const walletClient = resolveWalletClient(walletSigner);
    const contractAddr = (addresses as any).DisputeArbitration;
    if (!contractAddr) throw new Error('Arbitration contract not deployed');

    const hash = await walletClient.writeContract({
      address: contractAddr as Address,
      abi: disputeArtifact.abi,
      functionName: 'raiseDispute',
      args: [
        BigInt(shipmentId),
        evidenceHash,
        BigInt(Math.round(proposedSupplierPayout * 1e6)),
        BigInt(Math.round(proposedCarrierPayout * 1e6))
      ]
    });
    const publicClient = getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    // Parse dispute ID from receipt events
    let disputeId = 1; 
    return { disputeId, txHash: hash };
  }
}

// 3. Submit Arbitrator Vote
export async function submitArbitratorVote(
  walletSigner: any,
  disputeId: number,
  supplierPayout: number,
  carrierPayout: number,
  mode: 'live' | 'local'
): Promise<string> {
  const voterAddress = typeof walletSigner === 'string' ? walletSigner : (walletSigner.address || '0xArbitrator');
  
  if (mode === 'local') {
    const list = getLocalDisputes();
    const idx = list.findIndex(d => d.id === disputeId);
    if (idx === -1) throw new Error('Dispute not found');

    const d = list[idx];
    if (d.resolved) throw new Error('Dispute already resolved');
    if (d.votes[voterAddress]) throw new Error('Arbitrator already voted');

    // Cast vote
    d.votes[voterAddress] = { supplierPayout, carrierPayout };
    d.voteCount = Object.keys(d.votes).length;

    // Check for 3-of-5 consensus (3 matching outcomes)
    const outcomes: Record<string, number> = {};
    let winningOutcome: { supplierPayout: number; carrierPayout: number } | null = null;

    Object.values(d.votes).forEach(v => {
      const key = `${v.supplierPayout}-${v.carrierPayout}`;
      outcomes[key] = (outcomes[key] || 0) + 1;
      if (outcomes[key] >= 3) {
        winningOutcome = v;
      }
    });

    if (winningOutcome) {
      d.resolved = true;
      d.verdictSupplierPayout = (winningOutcome as any).supplierPayout;
      d.verdictCarrierPayout = (winningOutcome as any).carrierPayout;

      // Unlock shipment and settle payouts locally
      const savedLocalShipments = localStorage.getItem('freightx_local_shipments');
      if (savedLocalShipments) {
        const shipments = JSON.parse(savedLocalShipments);
        const sIdx = shipments.findIndex((s: any) => s.id === d.shipmentId);
        if (sIdx !== -1) {
          const s = shipments[sIdx];
          s.status = 'Completed';
          s.disputeActive = false;
          s.releasedSupplierAmount = d.verdictSupplierPayout;
          s.releasedCarrierAmount = d.verdictCarrierPayout;
          localStorage.setItem('freightx_local_shipments', JSON.stringify(shipments));
        }
      }

      // Update local arbitrator reputations
      const arbitrators = getLocalArbitrators();
      const matchKey = `${d.verdictSupplierPayout}-${d.verdictCarrierPayout}`;
      arbitrators.forEach(arb => {
        const vote = d.votes[arb.address];
        if (vote) {
          const voteKey = `${vote.supplierPayout}-${vote.carrierPayout}`;
          if (voteKey === matchKey) {
            arb.reputation = Math.min(200, arb.reputation + 10);
          } else {
            arb.reputation = Math.max(0, arb.reputation - 15);
          }
        }
      });
      saveLocalArbitrators(arbitrators);
    }

    saveLocalDisputes(list);
    return '0xMockTxHashArbitratorVoteCast';
  } else {
    const walletClient = resolveWalletClient(walletSigner);
    const contractAddr = (addresses as any).DisputeArbitration;
    if (!contractAddr) throw new Error('Arbitration contract not deployed');

    const hash = await walletClient.writeContract({
      address: contractAddr as Address,
      abi: disputeArtifact.abi,
      functionName: 'vote',
      args: [
        BigInt(disputeId),
        BigInt(Math.round(supplierPayout * 1e6)),
        BigInt(Math.round(carrierPayout * 1e6))
      ]
    });
    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
}
