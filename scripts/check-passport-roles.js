const { createPublicClient, http } = require('viem');
const passportArtifact = require('../src/abi/FreightPassport.json');
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
  const publicClient = createPublicClient({
    chain: customArcTestnet,
    transport: http()
  });

  const contractAddress = addresses.FreightPassport;

  try {
    const operatorRole = await publicClient.readContract({
      address: contractAddress,
      abi: passportArtifact.abi,
      functionName: 'OPERATOR_ROLE'
    });
    console.log('OPERATOR_ROLE hash:', operatorRole);

    const adminRole = await publicClient.readContract({
      address: contractAddress,
      abi: passportArtifact.abi,
      functionName: 'ADMIN_ROLE'
    });
    console.log('ADMIN_ROLE hash:', adminRole);

    // Let's check if our deployer address has these roles
    const deployerAddress = '0x1Dc98cf9B21a29EF1400e7F39E2C2486bBef1717';
    const hasAdmin = await publicClient.readContract({
      address: contractAddress,
      abi: passportArtifact.abi,
      functionName: 'hasRole',
      args: [adminRole, deployerAddress]
    });
    console.log(`Deployer ${deployerAddress} has ADMIN_ROLE:`, hasAdmin);

    const hasOperator = await publicClient.readContract({
      address: contractAddress,
      abi: passportArtifact.abi,
      functionName: 'hasRole',
      args: [operatorRole, deployerAddress]
    });
    console.log(`Deployer ${deployerAddress} has OPERATOR_ROLE:`, hasOperator);

    // Let's check the user address
    const userAddress = '0x68a2e0b5a19d3e965174d656881a4dd2df3a3c8f';
    const userHasOperator = await publicClient.readContract({
      address: contractAddress,
      abi: passportArtifact.abi,
      functionName: 'hasRole',
      args: [operatorRole, userAddress]
    });
    console.log(`User ${userAddress} has OPERATOR_ROLE:`, userHasOperator);

  } catch (err) {
    console.error('Error querying roles:', err.message || err);
  }
}

main().catch(console.error);
