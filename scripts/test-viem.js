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

  const address = addresses.FreightPassport;
  console.log('Querying FreightPassport at:', address);

  try {
    const name = await publicClient.readContract({
      address,
      abi: passportArtifact.abi,
      functionName: 'name'
    });
    console.log('Passport name:', name);
  } catch (err) {
    console.error('Error reading passport name:', err);
  }

  try {
    const symbol = await publicClient.readContract({
      address,
      abi: passportArtifact.abi,
      functionName: 'symbol'
    });
    console.log('Passport symbol:', symbol);
  } catch (err) {
    console.error('Error reading passport symbol:', err);
  }
}

main().catch(console.error);
