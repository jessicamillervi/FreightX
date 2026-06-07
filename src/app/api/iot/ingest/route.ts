/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase, toSnakeCase } from '../../../../lib/db';
import { verifyTelemetrySignature, relayMilestoneToChain } from '../../../../lib/iot-oracle';
import { checkThresholdsAndAlert } from '../../../../lib/iot-alerts';
import { iotStreamHub } from '../../../../lib/iot-stream-hub';

export async function POST(request: NextRequest) {
  try {
    const { shipmentId, milestoneType, temperature, humidity, timestamp, signature } = await request.json();

    if (
      shipmentId === undefined ||
      !milestoneType ||
      temperature === undefined ||
      humidity === undefined ||
      !timestamp ||
      !signature
    ) {
      return NextResponse.json(
        { error: 'Missing required telemetry fields' },
        { status: 400 }
      );
    }

    // 1. Fetch registered device public key from DB
    const { data: device, error: deviceError } = await supabase
      .from('iot_devices')
      .select('public_key')
      .eq('shipment_id', shipmentId)
      .single();

    if (deviceError || !device) {
      console.error(`[IoT Ingest] No registered device found for shipment #${shipmentId}`);
      return NextResponse.json(
        { error: 'No registered device found for this shipment' },
        { status: 404 }
      );
    }

    // 2. Cryptographic signature verification
    const isValid = await verifyTelemetrySignature(
      Number(shipmentId),
      milestoneType,
      Number(temperature),
      Number(humidity),
      Number(timestamp),
      signature,
      device.public_key
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Cryptographic signature verification failed' }, { status: 401 });
    }

    console.log(`[IoT Ingest] Signature verified for Shipment #${shipmentId}`);

    // 3. Store reading in Supabase `iot_readings`
    const { data: reading, error: insertError } = await supabase.from('iot_readings').insert(
      toSnakeCase({
        shipmentId,
        temperature: temperature / 100, // store in Celsius
        humidity: humidity / 100,       // store in Pct
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        txHash: signature, // use signature hash as tracking proof
      }) as any
    );

    if (insertError) {
      console.error('[IoT Ingest] Failed to insert telemetry into DB:', insertError);
    }

    // 4. Update the shipment's current temperature/humidity in shipments table
    const { error: shipmentUpdateError } = await supabase
      .from('shipments')
      .update(
        toSnakeCase({
          temperature: temperature / 100,
          humidity: humidity / 100,
        }) as any
      )
      .eq('id', shipmentId);

    if (shipmentUpdateError) {
      console.error('[IoT Ingest] Failed to update current temp/humidity in shipments:', shipmentUpdateError);
    }

    // 5. Trigger threshold checks and alerts
    const { breached, message } = await checkThresholdsAndAlert(
      Number(shipmentId),
      Number(temperature),
      Number(humidity),
      Number(timestamp)
    );

    // 6. Publish to real-time subscribers via Stream Hub
    const telemetryEvent = {
      shipmentId: Number(shipmentId),
      milestoneType,
      temperature: temperature / 100,
      humidity: humidity / 100,
      timestamp: Number(timestamp),
      breached,
      alertMessage: message || null,
    };
    iotStreamHub.publish(telemetryEvent);

    // 7. On-chain Oracle Relay if it represents a milestone transition
    let txHash = '';
    const validMilestones = ['departure', 'singapore', 'arrival', 'customs'];
    if (validMilestones.includes(milestoneType.toLowerCase())) {
      try {
        console.log(`[IoT Ingest] Auto-submitting milestone "${milestoneType}" on-chain...`);
        txHash = await relayMilestoneToChain(
          Number(shipmentId),
          milestoneType.toLowerCase(),
          Number(temperature),
          Number(humidity),
          Number(timestamp),
          signature
        );
      } catch (relayError: any) {
        console.error('[IoT Ingest] On-chain milestone relay failed:', relayError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Telemetry processed successfully',
      breached,
      onChainRelayed: !!txHash,
      txHash,
    });
  } catch (err: any) {
    console.error('[IoT Ingest] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
