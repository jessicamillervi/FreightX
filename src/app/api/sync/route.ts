import { NextResponse } from 'next/server';
import { syncEventsFromChain } from '@/lib/event-indexer';
import { getAuthUser, logAudit } from '@/lib/auth';
import { USDC_ADDRESS, EURC_ADDRESS } from '@/services/sandbox';
import defaultAddresses from '@/abi/addresses.json';

// POST: Trigger manual synchronization with blockchain event indexer
export async function POST(req: Request) {
  try {
    const userAddress = await getAuthUser(req);
    const triggerer = userAddress || '0xSystemGuest';

    const body = await req.json().catch(() => ({}));
    const { escrowAddress, passportAddress, lookback } = body;

    // Use passed contract addresses or standard addresses or fallback
    let escrow = escrowAddress;
    let passport = passportAddress;

    if (!escrow || !passport) {
      if (defaultAddresses) {
        escrow = escrow || defaultAddresses.FreightEscrow;
        passport = passport || defaultAddresses.FreightPassport;
      }
    }

    if (!escrow || !passport) {
      return NextResponse.json(
        { error: 'No contract deployments found to sync. Please specify escrowAddress and passportAddress.' },
        { status: 400 }
      );
    }

    const contracts = {
      escrow: escrow as `0x${string}`,
      passport: passport as `0x${string}`,
      usdc: USDC_ADDRESS as `0x${string}`,
      eurc: EURC_ADDRESS as `0x${string}`,
      usyc: (body.usycAddress || escrowAddress) as `0x${string}`
    };

    const lookbackBlocks = lookback ? BigInt(lookback) : 5000n;

    console.log(`Manual sync triggered by ${triggerer} for Escrow: ${escrow}`);
    
    const result = await syncEventsFromChain(contracts, lookbackBlocks);

    await logAudit(triggerer, 'sync.trigger', {
      escrow,
      lookback: lookbackBlocks.toString(),
      success: result.success,
      syncedShipments: result.syncedShipments,
      syncedLoans: result.syncedLoans
    });

    return NextResponse.json({
      message: 'Blockchain event synchronization complete.',
      ...result
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Manual sync route error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
