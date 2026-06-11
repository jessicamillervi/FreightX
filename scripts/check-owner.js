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
  const tokenId = 0n;

  try {
    const owner = await publicClient.readContract({
      address: contractAddress,
      abi: passportArtifact.abi,
      functionName: 'ownerOf',
      args: [tokenId]
    });
    console.log(`Owner of Passport Token #${tokenId}: ${owner}`);
  } catch (err) {
    console.error(`Error querying ownerOf(${tokenId}):`, err.message || err);
  }
}

main().catch(console.error);
