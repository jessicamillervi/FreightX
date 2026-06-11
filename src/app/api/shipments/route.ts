import { NextResponse } from 'next/server';
import { supabase, toCamelCase, toSnakeCase } from '@/lib/db';
import { getAuthUser, logAudit } from '@/lib/auth';

// GET: List all shipments
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const buyer = searchParams.get('buyer');
    const supplier = searchParams.get('supplier');
    const carrier = searchParams.get('carrier');

    let query = supabase.from('shipments').select('*');

    if (buyer) query = query.eq('buyer', buyer);
    if (supplier) query = query.eq('supplier', supplier);
    if (carrier) query = query.eq('carrier', carrier);

    // Sort by created_at descending to show most recent first
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(toCamelCase(data) || []);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// POST: Create or upsert shipment(s)
export async function POST(req: Request) {
  try {
    const userAddress = await getAuthUser(req);
    const creator = userAddress || '0xSystemGuest';

    const VALID_SHIPMENT_COLUMNS = new Set([
      'id',
      'buyer',
      'supplier',
      'carrier',
      'cargo_value',
      'shipping_fee',
      'released_supplier_amount',
      'released_carrier_amount',
      'departure_port',
      'destination_port',
      'status',
      'arrived_timestamp',
      'custom_clearance_timestamp',
      'pickup_timestamp',
      'free_time_hours',
      'demurrage_rate_per_hour',
      'demurrage_penalty_paid',
      'passport_token_id',
      'temperature',
      'location',
      'history',
      'on_chain',
      'tx_hash',
      'created_timestamp',
      'yield_earned',
      'temperature_violations',
      'temperature_penalty',
      'beneficiary',
      'factoring_price',
      'factoring_active',
      'token',
      'po_id',
      'has_po_loan',
      'iot_gateway',
      'humidity',
      'usyc_wrapped',
      'usyc_shares',
      'cctp_source_domain',
      'cctp_source_tx_hash'
    ]);

    const body = await req.json();
    if (!body) {
      return NextResponse.json({ error: 'Missing shipment body' }, { status: 400 });
    }

    if (Array.isArray(body)) {
      const rows = body.map(item => {
        const rawRow = toSnakeCase(item) as Record<string, unknown>;
        const clean: Record<string, unknown> = {};
        for (const k of Object.keys(rawRow)) {
          if (VALID_SHIPMENT_COLUMNS.has(k)) {
            clean[k] = rawRow[k];
          }
        }
        return clean;
      });

      const { data, error } = await supabase.from('shipments').upsert(rows).select();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await logAudit(creator, 'shipments.upsert_batch', { count: body.length });
      return NextResponse.json(toCamelCase(data));
    }

    if (body.id === undefined) {
      return NextResponse.json({ error: 'Missing shipment ID' }, { status: 400 });
    }

    const rawRow = toSnakeCase(body) as Record<string, unknown>;
    const attemptRow: Record<string, unknown> = {};
    for (const k of Object.keys(rawRow)) {
      if (VALID_SHIPMENT_COLUMNS.has(k)) {
        attemptRow[k] = rawRow[k];
      }
    }

    const { data, error } = await supabase.from('shipments').insert(attemptRow).select().single();

    if (error) {
      // If shipment already exists, update/upsert instead
      const { data: upsertData, error: upsertErr } = await supabase
        .from('shipments')
        .upsert(attemptRow)
        .select()
        .single();
        
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
      
      await logAudit(creator, 'shipment.upsert', { shipmentId: body.id });
      return NextResponse.json(toCamelCase(upsertData));
    }

    await logAudit(creator, 'shipment.create', { shipmentId: body.id });
    return NextResponse.json(toCamelCase(data));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
