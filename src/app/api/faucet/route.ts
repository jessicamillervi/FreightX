import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

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

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address || !address.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid address parameter' }, { status: 400 });
    }

    const pk1 = process.env.PRIVATE_KEY;
    const pk2 = process.env.AGENT_PRIVATE_KEY;
    if (!pk1 && !pk2) {
      return NextResponse.json({ error: 'No deployer private key configured on server' }, { status: 500 });
    }

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network')
    });

    // Select the key with higher balance to avoid depletion
    let selectedKey = pk1 || pk2;
    if (pk1 && pk2) {
      try {
        const clean1 = pk1.startsWith('0x') ? pk1 : `0x${pk1}`;
        const clean2 = pk2.startsWith('0x') ? pk2 : `0x${pk2}`;
        const acc1 = privateKeyToAccount(clean1 as `0x${string}`);
        const acc2 = privateKeyToAccount(clean2 as `0x${string}`);
        const [bal1, bal2] = await Promise.all([
          publicClient.getBalance({ address: acc1.address }),
          publicClient.getBalance({ address: acc2.address })
        ]);
        if (bal2 > bal1) {
          selectedKey = pk2;
        }
      } catch (err) {
        console.warn('Failed to compare key balances, falling back to default:', err);
      }
    }

    const cleanKey = selectedKey!.startsWith('0x') ? selectedKey! : `0x${selectedKey!}`;
    const account = privateKeyToAccount(cleanKey as `0x${string}`);

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network')
    });

    // 1. Send native gas (18 decimals native USDC)
    const nativeAmount = parseUnits('0.5', 18);
    const gasTxHash = await walletClient.sendTransaction({
      to: address as `0x${string}`,
      value: nativeAmount
    });

    // 2. Send ERC-20 USDC (6 decimals)
    const tokenAmount = parseUnits('5.0', 6);
    const erc20TxHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [address as `0x${string}`, tokenAmount]
    });

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash: gasTxHash });
    await publicClient.waitForTransactionReceipt({ hash: erc20TxHash });

    return NextResponse.json({
      success: true,
      gasTxHash,
      erc20TxHash,
      message: 'Successfully funded sandbox wallet with 0.5 gas USDC and 5.0 ERC-20 USDC!'
    });
  } catch (err: unknown) {
    console.error('Faucet error:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
