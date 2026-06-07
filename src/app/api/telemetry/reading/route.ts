/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { processPayment, buildPaymentRequirements, encodeRequirements } from '../../../../lib/gateway-nanopay';
import { supabase, toCamelCase } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shipmentIdStr = searchParams.get('shipmentId');
    
    if (!shipmentIdStr) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing shipmentId parameter' },
        { status: 400 }
      );
    }

    const shipmentId = parseInt(shipmentIdStr, 10);
    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid shipmentId parameter' },
        { status: 400 }
      );
    }

    // 1. Check payment-signature header
    const paymentSig = request.headers.get('payment-signature') || request.headers.get('PAYMENT-SIGNATURE');
    const price = 0.001;

    if (!paymentSig) {
      const requirements = buildPaymentRequirements(price);
      return NextResponse.json(
        { error: 'Payment Required', message: `Nanopayment of $${price} required.`, requirements },
        {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': encodeRequirements(requirements),
          },
        }
      );
    }

    // 2. Process payment
    const paymentResult = await processPayment(paymentSig, price, '/api/telemetry/reading', shipmentId);
    if (!paymentResult.success) {
      const requirements = buildPaymentRequirements(price);
      return NextResponse.json(
        { error: 'Payment Required', message: paymentResult.error || 'Payment failed verification' },
        {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': encodeRequirements(requirements),
          },
        }
      );
    }

    // 3. Fetch latest reading
    const { data: reading, error: dbError } = await supabase
      .from('iot_readings')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (dbError && dbError.message !== 'Not found') {
      console.error('DB error fetching latest reading:', dbError);
    }

    const cleanReading = reading ? (toCamelCase(reading) as any) : null;

    return NextResponse.json({
      success: true,
      data: cleanReading || {
        shipmentId,
        temperature: -18.2,
        humidity: 62.4,
        timestamp: new Date().toISOString(),
        note: 'Mock reading fallback (No telemetry readings recorded for this shipment yet)'
      },
      payment: {
        amountPaid: price,
        buyer: paymentResult.buyerAddress,
        status: 'Settled gaslessly via Circle Gateway'
      }
    });
  } catch (err: any) {
    console.error('Telemetry reading route error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}
