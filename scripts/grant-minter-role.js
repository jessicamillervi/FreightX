require('dotenv').config();
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const documentsArtifact = require('../src/abi/FreightDocuments.json');
const addresses = require('../src/abi/addresses.json');

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

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY not found in env');
    process.exit(1);
  }

  const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(cleanKey);
  console.log('Deployer/Admin Address:', account.address);

  const publicClient = createPublicClient({
    chain: customArcTestnet,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: customArcTestnet,
    transport: http()
  });

  const contractAddress = addresses.FreightDocuments;
  const targetAddress = process.argv[2] || '0x628bedf8d0522224937280a87668928946a94712';
  const roleHash = '0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929'; // keccak256("MINTER_ROLE")

  console.log(`Granting MINTER_ROLE on contract: ${contractAddress} to user address: ${targetAddress}...`);

  try {
    // 1. Check if user already has the role
    const hasRole = await publicClient.readContract({
      address: contractAddress,
      abi: documentsArtifact.abi,
      functionName: 'hasRole',
      args: [roleHash, targetAddress]
    });

    if (hasRole) {
      console.log(`Address ${targetAddress} already has the MINTER_ROLE.`);
      return;
    }

    // 2. Send transaction to grant role
    const tx = await walletClient.writeContract({
      address: contractAddress,
      abi: documentsArtifact.abi,
      functionName: 'grantRole',
      args: [roleHash, targetAddress]
    });

    console.log(`Submitted grantRole transaction. Hash: ${tx}`);
    console.log('Waiting for block confirmation...');
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`Transaction successfully confirmed! Block number: ${receipt.blockNumber}`);
    console.log(`Role MINTER_ROLE successfully granted to ${targetAddress}.`);
  } catch (err) {
    console.error('Failed to grant role:', err);
  }
}

main().catch(console.error);
