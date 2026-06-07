/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabase, toCamelCase } from '../../../../lib/db';

export async function GET() {
  try {
    const { data: payments, error: dbError } = await supabase
      .from('gateway_payments' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (dbError) {
      throw dbError;
    }

    const cleanPayments = payments ? toCamelCase(payments) : [];

    return NextResponse.json({
      success: true,
      data: cleanPayments
    });
  } catch (err: any) {
    console.error('Failed to fetch gateway payments revenue:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}
