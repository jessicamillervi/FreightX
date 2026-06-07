import { NextResponse } from 'next/server';
import { supabase, toCamelCase } from '@/lib/db';
import { logAudit } from '@/lib/auth';

// POST: Ingest IoT cold-chain telematic readings for a shipment
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shipmentId, temperature, humidity, txHash, location } = body;

    if (shipmentId === undefined || temperature === undefined) {
      return NextResponse.json({ error: 'Missing shipmentId or temperature' }, { status: 400 });
    }

    const shipId = parseInt(shipmentId, 10);
    const tempNum = parseFloat(temperature);
    const humNum = humidity !== undefined ? parseFloat(humidity) : 0;
    const locStr = location || 'Transit Container';

    // 1. Fetch current shipment details
    const { data: shipment, error: fetchErr } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipId)
      .single();

    if (fetchErr || !shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    // 2. Insert IoT Reading record
    const { data: reading, error: insertErr } = await supabase
      .from('iot_readings')
      .insert({
        shipment_id: shipId,
        temperature: tempNum,
        humidity: humNum,
        tx_hash: txHash,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 3. Update shipment history and violations
    // Standard limit in FreightEscrow is 8.0 °C
    const isViolation = tempNum > 8.0;
    const violationsInc = isViolation ? 1 : 0;
    const newViolations = (shipment.temperature_violations || 0) + violationsInc;
    
    // Increment penalty: e.g. $50 per violation (in 6 decimals format or normal float)
    const newPenalty = (shipment.temperature_penalty || 0) + (isViolation ? 50 : 0);

    // Parse history array
    let history: unknown[] = [];
    if (shipment.history) {
      try {
        history = typeof shipment.history === 'string' 
          ? JSON.parse(shipment.history) 
          : (shipment.history as unknown[]);
      } catch {
        history = [];
      }
    }

    // Append new reading history item
    history.push({
      timestamp: Date.now(),
      status: isViolation ? 'IoT Temp Violation Logged' : 'IoT Telematics Logged',
      location: locStr,
      temperature: tempNum,
      txHash: txHash || undefined
    });

    const { error: updateErr } = await supabase
      .from('shipments')
      .update({
        temperature: tempNum,
        humidity: humNum,
        temperature_violations: newViolations,
        temperature_penalty: newPenalty,
        location: locStr,
        history: JSON.stringify(history)
      })
      .eq('id', shipId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 4. Log audit event
    await logAudit('0xIoTGateway', 'iot.ingest_reading', {
      shipmentId: shipId,
      temperature: tempNum,
      humidity: humNum,
      violation: isViolation
    });

    return NextResponse.json({
      success: true,
      reading: toCamelCase(reading),
      violation: isViolation
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
