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
    const price = 0.01;

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
    const paymentResult = await processPayment(paymentSig, price, '/api/telemetry/history', shipmentId);
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

    // 3. Fetch full history of readings
    const { data: readings, error: dbError } = await supabase
      .from('iot_readings')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('timestamp', { ascending: true });

    if (dbError) {
      console.error('DB error fetching telemetry history:', dbError);
    }

    const cleanReadings = readings ? (toCamelCase(readings) as any[]) : [];

    // Fallback history for demo if empty
    const responseData = cleanReadings.length > 0 ? cleanReadings : [
      {
        id: 'mock-1',
        shipmentId,
        temperature: -15.4,
        humidity: 65.0,
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: 'mock-2',
        shipmentId,
        temperature: -17.8,
        humidity: 63.2,
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'mock-3',
        shipmentId,
        temperature: -18.2,
        humidity: 62.4,
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ];

    return NextResponse.json({
      success: true,
      data: responseData,
      payment: {
        amountPaid: price,
        buyer: paymentResult.buyerAddress,
        status: 'Settled gaslessly via Circle Gateway'
      }
    });
  } catch (err: any) {
    console.error('Telemetry history route error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}
