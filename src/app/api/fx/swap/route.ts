/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { executeStableFXSwap } from '@/lib/stablefx';
import { Address } from 'viem';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quoteId, takerAddress } = body;

    if (!quoteId || !takerAddress) {
      return NextResponse.json({ success: false, error: 'Missing quoteId or takerAddress' }, { status: 400 });
    }

    const trade = await executeStableFXSwap(quoteId, takerAddress as Address);

    return NextResponse.json({
      success: true,
      trade,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
