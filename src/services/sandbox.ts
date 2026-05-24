import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseUnits, 
  formatUnits, 
  type Address,
  getContract,
  type WalletClient,
  encodePacked,
  keccak256
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

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

import passportArtifact from '../abi/FreightPassport.json';
import escrowArtifact from '../abi/FreightEscrow.json';
import usycArtifact from '../abi/MockUSYC.json';

// Constants
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const EURC_ADDRESS = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';
export const ARC_RPC_URL = 'https://rpc.testnet.arc.network';
export const LOCAL_STATE_KEY = 'freightx_local_shipments';
export const WALLET_KEY = 'freightx_sandbox_wallet';
export const CONTRACTS_KEY = 'freightx_deployed_contracts';
export const MODE_KEY = 'freightx_mode'; // 'live' or 'local'

export interface BlockchainContracts {
  passport: Address;
  escrow: Address;
  usdc: Address;
  eurc: Address;
  usyc: Address;
}

export interface ViemWalletClient {
  deployContract: (args: { abi: unknown; bytecode: `0x${string}`; args?: unknown[] }) => Promise<`0x${string}`>;
  writeContract: (args: { address: `0x${string}`; abi: unknown; functionName: string; args?: unknown[] }) => Promise<`0x${string}`>;
}

export interface ShipmentHistory {
  timestamp: number;
  status: string;
  location: string;
  temperature: number;
  txHash?: string;
}

export interface ShipmentData {
  id: number;
  buyer: string;
  supplier: string;
  carrier: string;
  cargoValue: number; // in USDC/EURC (6 decimals)
  shippingFee: number; // in USDC/EURC (6 decimals)
  releasedSupplierAmount: number;
  releasedCarrierAmount: number;
  departurePort: string;
  destinationPort: string;
  status: 'Created' | 'In Transit' | 'Arrived' | 'Customs Cleared' | 'Completed' | 'Cancelled';
  arrivedTimestamp: number;
  customClearanceTimestamp: number;
  pickupTimestamp: number;
  freeTimeHours: number;
  demurrageRatePerHour: number; // in USDC/EURC (6 decimals)
  demurragePenaltyPaid: number;
  passportTokenId: number;
  temperature: number; // Current temperature * 100
  location: string;
  history: ShipmentHistory[];
  onChain?: boolean;
  txHash?: string;
  createdTimestamp?: number;
  yieldEarned?: number;
  temperatureViolations?: number;
  temperaturePenalty?: number;
  beneficiary?: string;
  factoringPrice?: number;
  factoringActive?: boolean;
  token?: string; // USDC or EURC address
  poId?: number; // linked PO loan ID (if any)
  hasPOLoan?: boolean;
  // Advanced: IoT Device Gateway
  iotGateway?: string;
  humidity?: number;
  // Advanced: USYC Yield Vault
  usycWrapped?: boolean;
  usycShares?: number;
  // Advanced: CCTP Cross-Chain
  cctpSourceDomain?: number;
  cctpSourceTxHash?: string;
}

export interface POLoanData {
  id: number;
  supplier: string;
  buyer: string;
  cargoValue: number;
  loanRequested: number;
  repaymentAmount: number;
  investor: string;
  funded: boolean;
  repaid: boolean;
  token: string;
}

export interface WalletInfo {
  privateKey: string;
  address: Address;
}

// ABI Interfaces
const erc20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

// 1. Manage Sandbox Wallet
export function getOrCreateSandboxWallet(): WalletInfo {
  if (typeof window === 'undefined') {
    return { privateKey: '', address: '0x' };
  }
  
  const saved = localStorage.getItem(WALLET_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.privateKey && parsed.address) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing sandbox wallet', e);
    }
  }

  const pkey = generatePrivateKey();
  const account = privateKeyToAccount(pkey);
  const info = {
    privateKey: pkey,
    address: account.address
  };
  localStorage.setItem(WALLET_KEY, JSON.stringify(info));
  return info;
}

// 2. Manage Deployed Contracts
export function getSavedContracts(): BlockchainContracts | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(CONTRACTS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}

export function saveContracts(contracts: BlockchainContracts) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONTRACTS_KEY, JSON.stringify(contracts));
}

// 3. Mode Selection
export function getAppMode(): 'live' | 'local' {
  if (typeof window === 'undefined') return 'local';
  const mode = localStorage.getItem(MODE_KEY);
  return mode === 'live' ? 'live' : 'local';
}

export function setAppMode(mode: 'live' | 'local') {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODE_KEY, mode);
}

// 4. Client Creators
export function getPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL)
  });
}

export function getWalletClient(privateKey: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC_URL)
  });
}

// 5. Query Balances (USDC/EURC has 6 decimals, native Gas has 18 decimals)
export async function queryBalances(address: Address) {
  try {
    const publicClient = getPublicClient();
    
    // Gas balance (native token)
    const nativeBal = await publicClient.getBalance({ address });
    
    // USDC ERC-20 balance
    const usdcContract = getContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      client: publicClient
    });
    const tokenBal = await usdcContract.read.balanceOf([address]);

    // EURC ERC-20 balance
    const eurcContract = getContract({
      address: EURC_ADDRESS,
      abi: erc20Abi,
      client: publicClient
    });
    const eurcBal = await eurcContract.read.balanceOf([address]).catch(() => 0n);

    return {
      nativeGas: formatUnits(nativeBal, 18), // Arc uses 18 decimals for native USDC gas representation
      usdcToken: formatUnits(tokenBal, 6),   // ERC-20 has 6 decimals
      eurcToken: formatUnits(eurcBal, 6),
      rawNative: nativeBal,
      rawToken: tokenBal,
      rawEurc: eurcBal
    };
  } catch (error) {
    console.error('Failed to query balances:', error);
    return {
      nativeGas: '0.00',
      usdcToken: '0.00',
      eurcToken: '0.00',
      rawNative: 0n,
      rawToken: 0n,
      rawEurc: 0n
    };
  }
}

// 6. Deploy Contracts Client-side (Interactive)
export async function deployContractsOnchain(
  walletSigner: string | WalletClient,
  onProgress: (status: string) => void
): Promise<BlockchainContracts> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  onProgress('Deploying FreightPassport (ERC-721)...');
  const passportHash = await walletClient.deployContract({
    abi: passportArtifact.abi,
    bytecode: passportArtifact.bytecode.startsWith('0x') ? passportArtifact.bytecode as `0x${string}` : `0x${passportArtifact.bytecode}` as `0x${string}`,
  });
  
  onProgress('Waiting for FreightPassport confirmation...');
  const passportReceipt = await publicClient.waitForTransactionReceipt({ hash: passportHash });
  const passportAddress = passportReceipt.contractAddress!;
  onProgress(`FreightPassport deployed at ${passportAddress}`);

  onProgress('Deploying FreightEscrow...');
  const escrowHash = await walletClient.deployContract({
    abi: escrowArtifact.abi,
    bytecode: escrowArtifact.bytecode.startsWith('0x') ? escrowArtifact.bytecode as `0x${string}` : `0x${escrowArtifact.bytecode}` as `0x${string}`,
    args: [USDC_ADDRESS, EURC_ADDRESS],
  });

  onProgress('Waiting for FreightEscrow confirmation...');
  const escrowReceipt = await publicClient.waitForTransactionReceipt({ hash: escrowHash });
  const escrowAddress = escrowReceipt.contractAddress!;
  onProgress(`FreightEscrow deployed at ${escrowAddress}`);

  onProgress('Linking contracts: setEscrowContract in FreightPassport...');
  const setEscrowHash = await walletClient.writeContract({
    address: passportAddress,
    abi: passportArtifact.abi,
    functionName: 'setEscrowContract',
    args: [escrowAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: setEscrowHash });

  onProgress('Linking contracts: setPassportContract in FreightEscrow...');
  const setPassportHash = await walletClient.writeContract({
    address: escrowAddress,
    abi: escrowArtifact.abi,
    functionName: 'setPassportContract',
    args: [passportAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: setPassportHash });

  onProgress('Contracts compiled, deployed, and linked successfully!');

  // Deploy MockUSYC Yield Vault
  onProgress('Deploying MockUSYC Yield Vault (ERC-4626)...');
  const usycHash = await walletClient.deployContract({
    abi: usycArtifact.abi,
    bytecode: usycArtifact.bytecode.startsWith('0x') ? usycArtifact.bytecode as `0x${string}` : `0x${usycArtifact.bytecode}` as `0x${string}`,
    args: [USDC_ADDRESS],
  });
  onProgress('Waiting for MockUSYC confirmation...');
  const usycReceipt = await publicClient.waitForTransactionReceipt({ hash: usycHash });
  const usycAddress = usycReceipt.contractAddress!;
  onProgress(`MockUSYC deployed at ${usycAddress}`);

  // Link USYC vault to Escrow
  onProgress('Linking USYC Vault to FreightEscrow...');
  const setUsycHash = await walletClient.writeContract({
    address: escrowAddress,
    abi: escrowArtifact.abi,
    functionName: 'setUsycVault',
    args: [usycAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: setUsycHash });
  onProgress('USYC Vault linked successfully!');

  const result: BlockchainContracts = {
    passport: passportAddress,
    escrow: escrowAddress,
    usdc: USDC_ADDRESS,
    eurc: EURC_ADDRESS,
    usyc: usycAddress,
  };

  saveContracts(result);
  return result;
}

// 7. Manage Local Storage Shipments (Fallback/Mock mode)
export function getLocalShipments(): ShipmentData[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(LOCAL_STATE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }
  return [];
}

export function saveLocalShipments(shipments: ShipmentData[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(shipments));
}

// 8. On-Chain Shipment Management
export async function createShipmentOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  params: {
    supplier: string;
    carrier: string;
    cargoValue: number; // in float, e.g. 500
    shippingFee: number; // in float, e.g. 100
    departurePort: string;
    destinationPort: string;
    freeTimeHours: number;
    demurrageRatePerHour: number; // in float
    token: Address;
    poId?: number;
  },
  onProgress: (status: string) => void
): Promise<{ shipmentId: number; txHash: string }> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  const cargoRaw = parseUnits(params.cargoValue.toString(), 6);
  const shippingRaw = parseUnits(params.shippingFee.toString(), 6);
  const demurrageRaw = parseUnits(params.demurrageRatePerHour.toString(), 6);
  const totalNeeded = cargoRaw + shippingRaw;
  
  const tokenAddress = params.token || contracts.usdc;
  const tokenSymbol = tokenAddress === contracts.eurc ? 'EURC' : 'USDC';

  onProgress(`Step 1: Approving ${tokenSymbol} spending allowance...`);
  const approveHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [contracts.escrow, totalNeeded],
  });
  
  onProgress(`Waiting for ${tokenSymbol} allowance confirmation...`);
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  onProgress('Allowance approved successfully.');

  onProgress('Step 2: Depositing funds and creating Shipment Escrow...');
  const poIdBig = params.poId !== undefined && params.poId !== null ? BigInt(params.poId) : 999999n;

  const createHash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'createShipment',
    args: [
      params.supplier as Address,
      params.carrier as Address,
      cargoRaw,
      shippingRaw,
      params.departurePort,
      params.destinationPort,
      BigInt(params.freeTimeHours),
      demurrageRaw,
      tokenAddress,
      poIdBig
    ]
  });

  onProgress('Waiting for shipment confirmation...');
  await publicClient.waitForTransactionReceipt({ hash: createHash });
  
  let shipmentId = 0;
  try {
    const nextId = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'nextShipmentId'
    }) as bigint;
    shipmentId = Number(nextId) - 1;
  } catch (err) {
    console.error('Error parsing event logs', err);
  }

  onProgress(`Shipment created successfully! ID: ${shipmentId}`);
  return { shipmentId, txHash: createHash };
}

export async function triggerMilestoneOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  milestoneType: 'departure' | 'singapore' | 'arrival' | 'customs',
  temperature: number, // Celsius, e.g. 4.5
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;
  
  // Temperature represented on chain as (temp * 100)
  const tempScaled = BigInt(Math.round(temperature * 100));

  let functionName = 'triggerMilestoneDeparture';
  let desc = 'Departure Milestone';

  if (milestoneType === 'singapore') {
    functionName = 'triggerMilestoneSingapore';
    desc = 'Singapore Checkpoint (30% Payout)';
  } else if (milestoneType === 'arrival') {
    functionName = 'triggerMilestoneArrived';
    desc = 'Destination Arrival';
  } else if (milestoneType === 'customs') {
    functionName = 'triggerCustomClearance';
    desc = 'Customs Clearance';
  }

  onProgress(`Triggering ${desc} on-chain...`);
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName,
    args: [BigInt(shipmentId), tempScaled]
  });

  onProgress('Waiting for milestone confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress(`${desc} confirmed!`);
  return hash;
}

export async function getDemurragePenaltyOnchain(
  contracts: BlockchainContracts,
  shipmentId: number
): Promise<{ hoursLate: number; penaltyAmount: number }> {
  try {
    const publicClient = getPublicClient();
    const result = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'getDemurragePenalty',
      args: [BigInt(shipmentId)]
    }) as [bigint, bigint];

    return {
      hoursLate: Number(result[0]),
      penaltyAmount: Number(formatUnits(result[1], 6))
    };
  } catch (error) {
    console.error('Error fetching demurrage penalty:', error);
    return { hoursLate: 0, penaltyAmount: 0 };
  }
}

export async function pickupCargoOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  penaltyAmount: number, // float
  tokenAddress: Address,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  if (penaltyAmount > 0) {
    const tokenSymbol = tokenAddress === contracts.eurc ? 'EURC' : 'USDC';
    onProgress(`Approving demurrage penalty of ${penaltyAmount} ${tokenSymbol}...`);
    const penaltyRaw = parseUnits(penaltyAmount.toString(), 6);
    const approveHash = await walletClient.writeContract({
      address: tokenAddress || contracts.usdc,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contracts.escrow, penaltyRaw]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    onProgress('Demurrage allowance approved.');
  }

  onProgress('Confirming Cargo Pickup and final settlement...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'pickupCargo',
    args: [BigInt(shipmentId)]
  });

  onProgress('Waiting for final transaction finality...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress('Cargo picked up! Final payments settled on Arc Network.');
  return hash;
}

export async function payoutCrewOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  crew: string[],
  amounts: number[], // float representation
  tokenAddress: Address,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;
  
  const amountsRaw = amounts.map(amt => parseUnits(amt.toString(), 6));
  const totalNeeded = amountsRaw.reduce((acc, val) => acc + val, 0n);
  const tokenSymbol = tokenAddress === contracts.eurc ? 'EURC' : 'USDC';

  onProgress(`Approving ${tokenSymbol} transfer allowance from Carrier wallet for Crew Payroll...`);
  const approveHash = await walletClient.writeContract({
    address: tokenAddress || contracts.usdc,
    abi: erc20Abi,
    functionName: 'approve',
    args: [contracts.escrow, totalNeeded]
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  onProgress('Allowance approved.');

  onProgress('Executing Mass Payout to crew members...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'payoutCrew',
    args: [
      BigInt(shipmentId),
      crew as Address[],
      amountsRaw
    ]
  });

  onProgress('Waiting for Mass Payout transaction confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress('Mass Crew Payroll distributed successfully on Arc!');
  return hash;
}

export async function fetchShipmentFromChain(
  contracts: BlockchainContracts,
  shipmentId: number
): Promise<ShipmentData | null> {
  try {
    const publicClient = getPublicClient();
    type OnchainShipment = readonly [
      bigint, Address, Address, Address, bigint, bigint, bigint, bigint, string, string, number, bigint, bigint, bigint, bigint, bigint, bigint, bigint, Address, boolean
    ];

    const s = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'shipments',
      args: [BigInt(shipmentId)]
    }) as unknown as OnchainShipment;

    if (!s || !s[19]) return null; // s[19] is exists boolean

    // Status map
    const statusMap: ShipmentData['status'][] = [
      'Created', 'In Transit', 'Arrived', 'Customs Cleared', 'Completed', 'Cancelled'
    ];

    type OnchainPassportMeta = readonly [string, bigint, bigint] & {
      lastLocation: string;
      lastTemperature: bigint;
      timestamp: bigint;
    };

    const passportMeta = await publicClient.readContract({
      address: contracts.passport,
      abi: passportArtifact.abi,
      functionName: 'getMetadata',
      args: [s[17]] // s[17] is passportTokenId
    }) as unknown as OnchainPassportMeta;

    type OnchainPassportHistory = readonly [
      readonly string[],
      readonly bigint[],
      readonly bigint[]
    ];

    const passportHistory = await publicClient.readContract({
      address: contracts.passport,
      abi: passportArtifact.abi,
      functionName: 'getHistory',
      args: [s[17]]
    }) as unknown as OnchainPassportHistory;

    // Convert history
    const history: ShipmentHistory[] = [];
    if (passportHistory) {
      const locations = passportHistory[0];
      const temperatures = passportHistory[1];
      const timeline = passportHistory[2];

      for (let i = 0; i < locations.length; i++) {
        history.push({
          timestamp: Number(timeline[i]) * 1000,
          status: i === 0 ? 'Created' : i === 1 ? 'In Transit' : i === 2 ? 'Milestone: Singapore' : 'Updated',
          location: locations[i],
          temperature: Number(temperatures[i]) / 100
        });
      }
    }

    // Advanced features mapping reads
    const createdTimestampBig = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'createdTimestamps',
      args: [BigInt(shipmentId)]
    }).catch(() => 0n) as bigint;

    const yieldEarnedBig = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'yieldEarned',
      args: [BigInt(shipmentId)]
    }).catch(() => 0n) as bigint;

    const temperatureViolationsBig = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'temperatureViolations',
      args: [BigInt(shipmentId)]
    }).catch(() => 0n) as bigint;

    const tempPenaltyBig = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'temperaturePenalties',
      args: [BigInt(shipmentId)]
    }).catch(() => 0n) as bigint;

    const beneficiaryAddr = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'shipmentBeneficiary',
      args: [BigInt(shipmentId)]
    }).catch(() => s[2]) as Address;

    type OnchainFactoringOffer = readonly [bigint, boolean, Address];
    const factoringOffer = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'factoringOffers',
      args: [BigInt(shipmentId)]
    }).catch(() => [0n, false, '0x0000000000000000000000000000000000000000'] as const) as unknown as OnchainFactoringOffer;

    const hasPOLoan = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'shipmentHasPOLoan',
      args: [BigInt(shipmentId)]
    }).catch(() => false) as boolean;

    let poId = 0;
    if (hasPOLoan) {
      const poIdBig = await publicClient.readContract({
        address: contracts.escrow,
        abi: escrowArtifact.abi,
        functionName: 'shipmentPOLoans',
        args: [BigInt(shipmentId)]
      }).catch(() => 0n) as bigint;
      poId = Number(poIdBig);
    }

    return {
      id: Number(s[0]),
      buyer: s[1],
      supplier: s[2],
      carrier: s[3],
      cargoValue: Number(formatUnits(s[4], 6)),
      shippingFee: Number(formatUnits(s[5], 6)),
      releasedSupplierAmount: Number(formatUnits(s[6], 6)),
      releasedCarrierAmount: Number(formatUnits(s[7], 6)),
      departurePort: s[8],
      destinationPort: s[9],
      status: statusMap[s[10]] || 'Created',
      arrivedTimestamp: Number(s[11]) * 1000,
      customClearanceTimestamp: Number(s[12]) * 1000,
      pickupTimestamp: Number(s[13]) * 1000,
      freeTimeHours: Number(s[14]),
      demurrageRatePerHour: Number(formatUnits(s[15], 6)),
      demurragePenaltyPaid: Number(formatUnits(s[16], 6)),
      passportTokenId: Number(s[17]),
      temperature: Number(passportMeta?.lastTemperature || 1500) / 100,
      location: passportMeta?.lastLocation || s[8],
      history,
      onChain: true,
      createdTimestamp: Number(createdTimestampBig) * 1000,
      yieldEarned: Number(formatUnits(yieldEarnedBig, 6)),
      temperatureViolations: Number(temperatureViolationsBig),
      temperaturePenalty: Number(formatUnits(tempPenaltyBig, 6)),
      beneficiary: beneficiaryAddr,
      factoringPrice: Number(formatUnits(factoringOffer[0], 6)),
      factoringActive: factoringOffer[1],
      token: s[18],
      poId: hasPOLoan ? poId : undefined,
      hasPOLoan,
      // Advanced feature fields
      iotGateway: await publicClient.readContract({
        address: contracts.escrow, abi: escrowArtifact.abi, functionName: 'iotGateway', args: [BigInt(shipmentId)]
      }).catch(() => '0x0000000000000000000000000000000000000000') as string,
      humidity: Number(await publicClient.readContract({
        address: contracts.escrow, abi: escrowArtifact.abi, functionName: 'humidityData', args: [BigInt(shipmentId)]
      }).catch(() => 0n) as bigint),
      usycWrapped: await publicClient.readContract({
        address: contracts.escrow, abi: escrowArtifact.abi, functionName: 'usycWrapped', args: [BigInt(shipmentId)]
      }).catch(() => false) as boolean,
      usycShares: Number(await publicClient.readContract({
        address: contracts.escrow, abi: escrowArtifact.abi, functionName: 'usycShares', args: [BigInt(shipmentId)]
      }).catch(() => 0n) as bigint),
      cctpSourceDomain: Number(await publicClient.readContract({
        address: contracts.escrow, abi: escrowArtifact.abi, functionName: 'cctpSourceDomain', args: [BigInt(shipmentId)]
      }).catch(() => 0n) as bigint),
      cctpSourceTxHash: (await publicClient.readContract({
        address: contracts.escrow, abi: escrowArtifact.abi, functionName: 'cctpSourceTxHash', args: [BigInt(shipmentId)]
      }).catch(() => '0x0000000000000000000000000000000000000000000000000000000000000000') as string),
    };
  } catch (error) {
    console.error('Error fetching shipment:', error);
    return null;
  }
}

export async function offerShipmentForFactoringOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  price: number,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;
  const priceRaw = parseUnits(price.toString(), 6);

  onProgress('Submitting invoice factoring offer to Arc...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'offerShipmentForFactoring',
    args: [BigInt(shipmentId), priceRaw]
  });

  onProgress('Waiting for factoring confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress('Invoice offered for factoring successfully!');
  return hash;
}

export async function cancelFactoringOfferOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  onProgress('Cancelling factoring offer...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'cancelFactoringOffer',
    args: [BigInt(shipmentId)]
  });

  onProgress('Waiting for cancellation confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress('Factoring offer cancelled.');
  return hash;
}

export async function purchaseFactoredShipmentOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  price: number,
  tokenAddress: Address,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;
  const priceRaw = parseUnits(price.toString(), 6);
  const tokenSymbol = tokenAddress === contracts.eurc ? 'EURC' : 'USDC';

  onProgress(`Approving ${tokenSymbol} transfer allowance from Investor for Factoring purchase...`);
  const approveHash = await walletClient.writeContract({
    address: tokenAddress || contracts.usdc,
    abi: erc20Abi,
    functionName: 'approve',
    args: [contracts.escrow, priceRaw]
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  onProgress(`${tokenSymbol} approved for factoring purchase.`);

  onProgress('Purchasing factored shipment receivable...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'purchaseFactoredShipment',
    args: [BigInt(shipmentId)]
  });

  onProgress('Confirming purchase finality...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress('Factored receivable purchased! Payout beneficiary redirected.');
  return hash;
}

// 9. PO Financing On-Chain Methods
export async function requestPOFinancingOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  params: {
    buyer: string;
    cargoValue: number;
    loanAmount: number;
    token: Address;
  },
  onProgress: (status: string) => void
): Promise<{ poId: number; txHash: string }> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  const cargoRaw = parseUnits(params.cargoValue.toString(), 6);
  const loanRaw = parseUnits(params.loanAmount.toString(), 6);

  onProgress('Submitting Purchase Order Financing Request to Arc...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'requestPOFinancing',
    args: [
      params.buyer as Address,
      cargoRaw,
      loanRaw,
      params.token
    ]
  });

  onProgress('Waiting for PO request confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });

  let poId = 0;
  try {
    const nextId = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'nextPOId'
    }) as bigint;
    poId = Number(nextId) - 1;
  } catch (err) {
    console.error('Error fetching PO ID', err);
  }

  onProgress(`PO Financing Request created! ID: ${poId}`);
  return { poId, txHash: hash };
}

export async function fundPOLoanOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  poId: number,
  loanAmount: number,
  tokenAddress: Address,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  const loanRaw = parseUnits(loanAmount.toString(), 6);
  const tokenSymbol = tokenAddress === contracts.eurc ? 'EURC' : 'USDC';

  onProgress(`Approving ${tokenSymbol} transfer allowance from Investor for PO Loan...`);
  const approveHash = await walletClient.writeContract({
    address: tokenAddress || contracts.usdc,
    abi: erc20Abi,
    functionName: 'approve',
    args: [contracts.escrow, loanRaw]
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  onProgress(`${tokenSymbol} allowance approved.`);

  onProgress(`Funding PO Loan #${poId}...`);
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'fundPOLoan',
    args: [BigInt(poId)]
  });

  onProgress('Confirming funding transaction...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress(`PO Loan #${poId} is funded! Principal sent to Supplier.`);
  return hash;
}

export async function fetchPOLoanFromChain(
  contracts: BlockchainContracts,
  poId: number
): Promise<POLoanData | null> {
  try {
    const publicClient = getPublicClient();
    type OnchainPOLoan = readonly [
      bigint, Address, Address, bigint, bigint, bigint, Address, boolean, boolean, Address
    ];

    const result = await publicClient.readContract({
      address: contracts.escrow,
      abi: escrowArtifact.abi,
      functionName: 'poLoans',
      args: [BigInt(poId)]
    }) as unknown as OnchainPOLoan;

    if (!result || result[1] === '0x0000000000000000000000000000000000000000') return null;

    return {
      id: Number(result[0]),
      supplier: result[1],
      buyer: result[2],
      cargoValue: Number(formatUnits(result[3], 6)),
      loanRequested: Number(formatUnits(result[4], 6)),
      repaymentAmount: Number(formatUnits(result[5], 6)),
      investor: result[6],
      funded: result[7],
      repaid: result[8],
      token: result[9]
    };
  } catch (error) {
    console.error(`Error fetching PO loan #${poId}:`, error);
    return null;
  }
}

// ─── Advanced Feature 1: IoT Gateway Registration & Signature Milestone ───

export async function setIotGatewayOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  gatewayAddress: string,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  onProgress('Registering IoT Device Gateway on-chain...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'setIotGateway',
    args: [BigInt(shipmentId), gatewayAddress as Address]
  });

  onProgress('Waiting for IoT Gateway registration confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress(`IoT Gateway ${gatewayAddress.slice(0, 10)}... registered for Shipment #${shipmentId}`);
  return hash;
}

export async function triggerMilestoneWithIoTSignatureOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  milestoneType: string,
  temperature: number,
  humidity: number,
  timestamp: number,
  signature: string,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  const tempScaled = BigInt(Math.round(temperature * 100));

  onProgress(`Submitting IoT-signed ${milestoneType} milestone to chain...`);
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'triggerMilestoneWithIoTSignature',
    args: [
      BigInt(shipmentId),
      milestoneType,
      tempScaled,
      BigInt(humidity),
      BigInt(timestamp),
      signature as `0x${string}`
    ]
  });

  onProgress('Verifying IoT ECDSA signature and executing milestone...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress(`IoT-verified milestone "${milestoneType}" confirmed on Arc!`);
  return hash;
}

// ─── Advanced Feature 2: USYC Yield Vault Wrapping ───

export async function wrapEscrowInUSYCOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  onProgress('Wrapping escrow funds into USYC Yield Vault (ERC-4626)...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'wrapEscrowInUSYC',
    args: [BigInt(shipmentId)]
  });

  onProgress('Waiting for USYC deposit confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress(`Escrow for Shipment #${shipmentId} is now earning yield in USYC vault!`);
  return hash;
}

export async function redeemUSYCOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  onProgress('Redeeming USYC shares back to USDC...');
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'redeemUSYCForShipment',
    args: [BigInt(shipmentId)]
  });

  onProgress('Waiting for USYC redemption confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress(`USYC shares redeemed. Yield accrued for Shipment #${shipmentId}!`);
  return hash;
}

// ─── Advanced Feature 3: CCTP Cross-Chain Bridge Recording ───

export async function recordCCTPFundingOnchain(
  walletSigner: string | WalletClient,
  contracts: BlockchainContracts,
  shipmentId: number,
  sourceDomain: number,
  sourceTxHash: string,
  amount: number,
  onProgress: (status: string) => void
): Promise<string> {
  const publicClient = getPublicClient();
  const walletClient = (typeof walletSigner === 'string' ? getWalletClient(walletSigner) : walletSigner) as unknown as ViemWalletClient;

  const amountRaw = parseUnits(amount.toString(), 6);

  onProgress(`Recording CCTP cross-chain funding from domain ${sourceDomain}...`);
  const hash = await walletClient.writeContract({
    address: contracts.escrow,
    abi: escrowArtifact.abi,
    functionName: 'recordCCTPFunding',
    args: [
      BigInt(shipmentId),
      sourceDomain,
      sourceTxHash as `0x${string}`,
      amountRaw
    ]
  });

  onProgress('Waiting for CCTP recording confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  onProgress(`CCTP funding recorded. Source tx: ${sourceTxHash.slice(0, 16)}...`);
  return hash;
}

export async function signIoTPayloadOnchain(
  gatewayPrivateKey: string,
  shipmentId: number,
  milestoneType: string,
  temperature: number,
  humidity: number,
  timestamp: number
): Promise<string> {
  const tempScaled = BigInt(Math.round(temperature * 100));

  const payloadHash = keccak256(
    encodePacked(
      ['uint256', 'string', 'uint256', 'uint256', 'uint256'],
      [BigInt(shipmentId), milestoneType, tempScaled, BigInt(humidity), BigInt(timestamp)]
    )
  );

  const account = privateKeyToAccount(gatewayPrivateKey as `0x${string}`);
  const signature = await account.signMessage({
    message: { raw: payloadHash }
  });

  return signature;
}

export async function signIoTPayloadWithWalletClient(
  walletClient: WalletClient,
  address: string,
  shipmentId: number,
  milestoneType: string,
  temperature: number,
  humidity: number,
  timestamp: number
): Promise<string> {
  const tempScaled = BigInt(Math.round(temperature * 100));

  const payloadHash = keccak256(
    encodePacked(
      ['uint256', 'string', 'uint256', 'uint256', 'uint256'],
      [BigInt(shipmentId), milestoneType, tempScaled, BigInt(humidity), BigInt(timestamp)]
    )
  );

  const signature = await walletClient.signMessage({
    account: address as Address,
    message: { raw: payloadHash }
  });

  return signature;
}
