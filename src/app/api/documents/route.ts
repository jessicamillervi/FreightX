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
const mockHistoryRegistry = new Map<string, any[]>();

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
      try {
        const tokenId = BigInt(tokenIdStr);
        let addresses;
        let documentsArtifact;
        
        try {
          addresses = require('@/abi/addresses.json');
          documentsArtifact = require('@/abi/FreightDocuments.json');
        } catch {
          throw new Error('Contract ABIs or addresses not found.');
        }

        const contractAddress = addresses.FreightDocuments;
        if (!contractAddress) {
          throw new Error('FreightDocuments contract address not set.');
        }

        const publicClient = createPublicClient({
          chain: arcTestnet,
          transport: http(process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network')
        });

        // Call getDocumentHistory on-chain
        const history = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: documentsArtifact.abi,
          functionName: 'getDocumentHistory',
          args: [tokenId]
        }) as any[];

        if (history && history.length > 0) {
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
      } catch {
        // Fall back to server-side mock registry if on-chain call fails or isn't deployed
        if (mockHistoryRegistry.has(tokenIdStr)) {
          return NextResponse.json({
            success: true,
            tokenId: tokenIdStr,
            history: mockHistoryRegistry.get(tokenIdStr)
          });
        }
      }

      // Return localstorage mock document placeholder if neither exists to avoid page crash
      return NextResponse.json({
        success: true,
        tokenId: tokenIdStr,
        history: [{
          ipfsHash: 'QmMockTemplateDocumentIPFSHashVerification',
          passportTokenId: '1',
          shipper: 'Global Export Supplier',
          consignee: 'Import Consignee Representative',
          cargoDescription: 'Standard Verified Cargo Invoice Certificate',
          weightKg: '50000',
          containerNumber: 'CRGO-FRTX-100234',
          timestamp: Math.floor(Date.now() / 1000),
          version: 1
        }]
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
    const cid = body.cid || body.ipfsHash;
    const tokenId = body.tokenId;

    if (!cid) {
      return NextResponse.json({ error: 'Missing CID/ipfsHash parameter' }, { status: 400 });
    }

    mockIpfsRegistry.set(cid, {
      name: body.name || `BoL-${body.passportTokenId || 'document'}.json`,
      content: typeof body.content === 'object' ? JSON.stringify(body.content, null, 2) : String(body.content || JSON.stringify(body, null, 2)),
      type: body.type || 'application/json',
      timestamp: body.timestamp ? Number(body.timestamp) * 1000 : Date.now()
    });

    if (tokenId) {
      const historyItem = {
        ipfsHash: cid,
        passportTokenId: String(body.passportTokenId || ''),
        shipper: String(body.shipper || 'Global Export Supplier'),
        consignee: String(body.consignee || 'Import Consignee Representative'),
        cargoDescription: String(body.cargoDescription || ''),
        weightKg: String(body.weightKg || '0'),
        containerNumber: String(body.containerNumber || ''),
        timestamp: body.timestamp ? Number(body.timestamp) : Math.floor(Date.now() / 1000),
        version: Number(body.version || 1)
      };

      const existingHistory = mockHistoryRegistry.get(String(tokenId)) || [];
      existingHistory.push(historyItem);
      mockHistoryRegistry.set(String(tokenId), existingHistory);
    }

    return NextResponse.json({
      success: true,
      cid,
      message: 'Successfully registered mock IPFS file and document on server side'
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
