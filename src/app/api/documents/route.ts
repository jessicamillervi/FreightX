import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';

// Arc Testnet chain definition matching sandbox.ts
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

// Global server-side registry for mock IPFS uploads to persist across API calls
const mockIpfsRegistry = new Map<string, { name: string; content: string; type: string; timestamp: number }>();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get('cid');
    const tokenIdStr = searchParams.get('tokenId');

    if (cid) {
      // 1. Retrieve mock IPFS content
      if (mockIpfsRegistry.has(cid)) {
        const file = mockIpfsRegistry.get(cid)!;
        return NextResponse.json({
          success: true,
          cid,
          name: file.name,
          content: file.content,
          type: file.type,
          timestamp: file.timestamp
        });
      }
      return NextResponse.json({ error: 'CID not found in mock IPFS registry' }, { status: 404 });
    }

    if (tokenIdStr) {
      // 2. Fetch verified document history from Arc Testnet
      const tokenId = BigInt(tokenIdStr);
      let addresses;
      let documentsArtifact;
      
      try {
        addresses = require('@/abi/addresses.json');
        documentsArtifact = require('@/abi/FreightDocuments.json');
      } catch {
        return NextResponse.json({ error: 'Contract ABIs or addresses not found. Please compile and deploy.' }, { status: 400 });
      }

      const publicClient = createPublicClient({
        chain: arcTestnet,
        transport: http(process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network')
      });

      const contractAddress = addresses.FreightDocuments;
      if (!contractAddress) {
        return NextResponse.json({ error: 'FreightDocuments contract address not set in addresses.json' }, { status: 400 });
      }

      // Call getDocumentHistory on-chain
      const history = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: documentsArtifact.abi,
        functionName: 'getDocumentHistory',
        args: [tokenId]
      }) as any[];

      const formattedHistory = history.map((doc: any) => ({
        ipfsHash: doc.ipfsHash,
        passportTokenId: doc.passportTokenId.toString(),
        shipper: doc.shipper,
        consignee: doc.consignee,
        cargoDescription: doc.cargoDescription,
        weightKg: doc.weightKg.toString(),
        containerNumber: doc.containerNumber,
        timestamp: Number(doc.timestamp),
        version: Number(doc.version)
      }));

      return NextResponse.json({
        success: true,
        tokenId: tokenIdStr,
        history: formattedHistory
      });
    }

    // Return mock data list if no params are supplied
    return NextResponse.json({
      success: true,
      filesCount: mockIpfsRegistry.size,
      cids: Array.from(mockIpfsRegistry.keys())
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cid, name, content, type } = body;

    if (!cid) {
      return NextResponse.json({ error: 'Missing CID parameter' }, { status: 400 });
    }

    mockIpfsRegistry.set(cid, {
      name: name || 'file.json',
      content: typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content),
      type: type || 'application/json',
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      cid,
      message: 'Successfully registered mock IPFS file on server side'
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
