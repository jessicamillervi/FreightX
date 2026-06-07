/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buyerAddress = searchParams.get('buyerAddress');

    if (!buyerAddress) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing buyerAddress parameter' },
        { status: 400 }
      );
    }

    const { data: balData, error: dbError } = await supabase
      .from('gateway_balances' as any)
      .select('balance')
      .eq('wallet_address', buyerAddress)
      .single();

    if (dbError && dbError.message !== 'Not found') {
      console.error('DB error fetching gateway balance:', dbError);
    }

    const balance = balData ? parseFloat(balData.balance as string) : 0;

    return NextResponse.json({
      success: true,
      buyerAddress,
      balance,
    });
  } catch (err: any) {
    console.error('Gateway deposit GET error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyerAddress, amount } = body;

    if (!buyerAddress || amount === undefined || isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing or invalid buyerAddress or amount' },
        { status: 400 }
      );
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Fetch existing balance
    const { data: balData } = await supabase
      .from('gateway_balances' as any)
      .select('balance')
      .eq('wallet_address', buyerAddress)
      .single();

    const currentBalance = balData ? parseFloat(balData.balance as string) : 0;
    const newBalance = currentBalance + depositAmount;

    // Save/update balance
    const { error: upsertError } = await supabase
      .from('gateway_balances' as any)
      .upsert({
        wallet_address: buyerAddress,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      throw upsertError;
    }

    // Log the event as an audit log or transaction
    await supabase
      .from('audit_logs')
      .insert({
        user_address: buyerAddress,
        action: 'GATEWAY_DEPOSIT',
        details: JSON.stringify({ amount: depositAmount, newBalance })
      });

    return NextResponse.json({
      success: true,
      buyerAddress,
      depositedAmount: depositAmount,
      newBalance,
      message: 'Deposit successful. Funds are now available for x402 nanopayments.'
    });
  } catch (err: any) {
    console.error('Gateway deposit POST error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}
