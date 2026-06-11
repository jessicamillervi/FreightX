require('dotenv').config();
const { createPublicClient, createWalletClient, http, keccak256, toBytes, parseUnits, encodePacked } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

// Load contract ABIs
const passportArtifact = require('../src/abi/FreightPassport.json');
const escrowArtifact = require('../src/abi/FreightEscrow.json');
const oracleArtifact = require('../src/abi/FreightOracle.json');
const agentArtifact = require('../src/abi/FreightAgent.json');
const documentsArtifact = require('../src/abi/FreightDocuments.json');
const disputeArtifact = require('../src/abi/DisputeArbitration.json');

// Contract addresses
const CONTRACTS = {
  escrow: '0xa62d82d5c5b63525dc19b570b5a666e01d1cae1d',
  passport: '0x414c07483092e9111b82870eece22f7fda689e00',
  documents: '0x886f808c75e92475ad66db69418a99844db41e1a',
  dispute: '0xb06da182b5aab2d8f2e3ab3b9a63fc500d12c8da',
  agent: '0x9ee7234ef354d4c350f7e48350e25bd57826af27',
  oracle: '0xc5cdd922f3bc30018f1cec3ddbfc324286f866bb',
  usdc: '0x3600000000000000000000000000000000000000',
};

const customArcTestnet = {
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
};

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
  }
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY is not defined in .env file.');
    process.exit(1);
  }

  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey);
  const walletAddress = account.address;

  console.log(`=======================================================`);
  console.log(`FreightX On-Chain Transaction Generator (Arc Testnet)`);
  console.log(`=======================================================`);
  console.log(`Executing from account: ${walletAddress}`);

  const publicClient = createPublicClient({
    chain: customArcTestnet,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: customArcTestnet,
    transport: http()
  });

  const balance = await publicClient.getBalance({ address: walletAddress });
  const gasUSDC = Number(balance) / 1e18;
  console.log(`USDC Gas Balance: ${gasUSDC.toFixed(4)} USDC`);
  
  if (gasUSDC < 2.0) {
    console.error(`ERROR: Insufficient gas balance to run test transactions.`);
    console.error(`Please fund your wallet with USDC at the Circle Faucet first:`);
    console.error(`--> https://faucet.circle.com (Select Arc Testnet)`);
    process.exit(1);
  }

  // Step 1: ERC20 Approve
  console.log('\n--- [Step 1: Approve Escrow Contract to spend USDC] ---');
  const cargoRaw = parseUnits('1.5', 6); // $1.5 USDC cargo value
  const shippingRaw = parseUnits('0.5', 6); // $0.5 USDC shipping fee
  const totalRaw = cargoRaw + shippingRaw;

  console.log(`Approving ${Number(totalRaw)/1e6} USDC for FreightEscrow...`);
  const approveTx = await walletClient.writeContract({
    address: CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: 'approve',
    args: [CONTRACTS.escrow, totalRaw],
  });
  console.log(`Transaction: ${approveTx}`);
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`✓ Approved successfully.`);

  // Step 2: Create Shipment
  console.log('\n--- [Step 2: Create Shipment Escrow & Mint Passport NFT] ---');
  const supplierAddress = '0x8D92F677cd6303cEc089B5F319D72Aa797Da5300';
  const carrierAddress = '0x1C902e11A58c4BB489B3ab1c51CEf8BC8757845E';
  const departurePort = 'Tokyo Bay Terminal';
  const destinationPort = 'Seattle Cargo Port';
  const freeTimeHours = 48n;
  const demurrageRate = parseUnits('1', 6);
  const poId = 777n;

  console.log(`Invoking createShipment on FreightEscrow...`);
  const createShipmentTx = await walletClient.writeContract({
    address: CONTRACTS.escrow,
    abi: escrowArtifact.abi,
    functionName: 'createShipment',
    args: [
      supplierAddress,
      carrierAddress,
      cargoRaw,
      shippingRaw,
      departurePort,
      destinationPort,
      freeTimeHours,
      demurrageRate,
      CONTRACTS.usdc,
      poId
    ]
  });
  console.log(`Transaction: ${createShipmentTx}`);
  await publicClient.waitForTransactionReceipt({ hash: createShipmentTx });

  const nextId = await publicClient.readContract({
    address: CONTRACTS.escrow,
    abi: escrowArtifact.abi,
    functionName: 'nextShipmentId'
  });
  const shipmentId = Number(nextId) - 1;
  console.log(`✓ Shipment Escrow created! ID: ${shipmentId}`);

  // Step 3: Register Device in FreightOracle
  console.log('\n--- [Step 3: Register Wallet as IoT Device in FreightOracle] ---');
  console.log(`Registering device ${walletAddress} for shipment ${shipmentId}...`);
  const regDeviceTx = await walletClient.writeContract({
    address: CONTRACTS.oracle,
    abi: oracleArtifact.abi,
    functionName: 'registerDevice',
    args: [BigInt(shipmentId), walletAddress]
  });
  console.log(`Transaction: ${regDeviceTx}`);
  await publicClient.waitForTransactionReceipt({ hash: regDeviceTx });
  console.log(`✓ Device registered in FreightOracle.`);

  // Step 4: Sign & Relay Telemetry (Milestone Trigger)
  console.log('\n--- [Step 4: Verify and Relay Telemetry (Milestone Departure)] ---');
  const milestoneType = 'departure';
  const temperature = 450n; // 4.50 °C
  const humidity = 65n; // 65%
  const timestamp = BigInt(Math.floor(Date.now() / 1000));

  // Construct message hash according to smart contract logic
  const rawHash = keccak256(
    encodePacked(
      ['uint256', 'string', 'int256', 'uint256', 'uint256'],
      [BigInt(shipmentId), milestoneType, temperature, humidity, timestamp]
    )
  );

  console.log(`Signing telemetry hash: ${rawHash}`);
  const signature = await account.signMessage({ message: { raw: rawHash } });
  console.log(`Signature generated: ${signature}`);

  console.log(`Relaying telemetry through FreightOracle.verifyAndRelay...`);
  const relayTx = await walletClient.writeContract({
    address: CONTRACTS.oracle,
    abi: oracleArtifact.abi,
    functionName: 'verifyAndRelay',
    args: [
      BigInt(shipmentId),
      milestoneType,
      temperature,
      humidity,
      timestamp,
      signature
    ]
  });
  console.log(`Transaction: ${relayTx}`);
  await publicClient.waitForTransactionReceipt({ hash: relayTx });
  console.log(`✓ Telemetry relayed and Departure milestone triggered successfully.`);

  // Step 5: Register Agent in FreightAgent
  console.log('\n--- [Step 5: Register Agent on FreightAgent] ---');
  const agentMetadataURI = `ipfs://QmHeartbeat_${Date.now()}`;
  console.log(`Registering agent with URI: ${agentMetadataURI}...`);
  const agentTx = await walletClient.writeContract({
    address: CONTRACTS.agent,
    abi: agentArtifact.abi,
    functionName: 'registerAgent',
    args: [agentMetadataURI]
  });
  console.log(`Transaction: ${agentTx}`);
  await publicClient.waitForTransactionReceipt({ hash: agentTx });
  console.log(`✓ Agent registered.`);

  // Step 6: Create Dispute Job on FreightAgent
  console.log('\n--- [Step 6: Create Dispute Job on FreightAgent] ---');
  console.log(`Creating dispute job for shipment ${shipmentId}...`);
  const createJobTx = await walletClient.writeContract({
    address: CONTRACTS.agent,
    abi: agentArtifact.abi,
    functionName: 'createDisputeJob',
    args: [BigInt(shipmentId), 'AI Autopilot detected temperature violation']
  });
  console.log(`Transaction: ${createJobTx}`);
  await publicClient.waitForTransactionReceipt({ hash: createJobTx });
  console.log(`✓ Dispute Job created.`);

  // Step 7: Raise Dispute on DisputeArbitration
  console.log('\n--- [Step 7: Raise Dispute on DisputeArbitration] ---');
  console.log(`Raising dispute in DisputeArbitration for shipment ${shipmentId}...`);
  const disputeTx = await walletClient.writeContract({
    address: CONTRACTS.dispute,
    abi: disputeArtifact.abi,
    functionName: 'raiseDispute',
    args: [
      BigInt(shipmentId),
      'Simulated temperature breach threshold dispute',
      parseUnits('1', 6), // Propose $1 USDC to supplier
      parseUnits('0.2', 6) // Propose $0.2 USDC to carrier
    ]
  });
  console.log(`Transaction: ${disputeTx}`);
  await publicClient.waitForTransactionReceipt({ hash: disputeTx });
  console.log(`✓ Dispute raised in DisputeArbitration.`);

  console.log(`\n=======================================================`);
  console.log(`SUCCESS: All smart contract test transactions completed!`);
  console.log(`Explorer Link: https://testnet.arcscan.app/address/${walletAddress}`);
  console.log(`=======================================================`);
}

main().catch((error) => {
  console.error('\nERROR running transaction script:', error.shortMessage || error.message || error);
  if (error.stack && !error.shortMessage) {
    console.error(error.stack.split('\n').slice(0, 10).join('\n'));
  }
  process.exit(1);
});
