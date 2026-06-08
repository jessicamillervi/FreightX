/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getStableFXQuote, mockHistory24h } from '@/lib/stablefx';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromCurrency = searchParams.get('from') || 'USDC';
    const toCurrency = searchParams.get('to') || 'EURC';
    const amount = searchParams.get('amount') || '1.0';

    const quote = await getStableFXQuote(fromCurrency, toCurrency, amount);

    // Look up historical charts
    const pairKey = `${fromCurrency.toUpperCase()}/${toCurrency.toUpperCase()}`;
    const reversePairKey = `${toCurrency.toUpperCase()}/${fromCurrency.toUpperCase()}`;
    const history = (mockHistory24h as any)[pairKey] || (mockHistory24h as any)[reversePairKey] || [];

    return NextResponse.json({
      success: true,
      quote,
      history,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
