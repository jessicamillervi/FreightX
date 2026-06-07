import { NextResponse } from 'next/server';
import { supabase, toCamelCase, toSnakeCase } from '@/lib/db';
import { getAuthUser, logAudit } from '@/lib/auth';

// GET: Retrieve a single shipment details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id, 10);
    if (isNaN(shipmentId)) {
      return NextResponse.json({ error: 'Invalid shipment ID' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json(toCamelCase(data));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// PATCH: Update shipment status, location, readings, or penalties
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id, 10);
    if (isNaN(shipmentId)) {
      return NextResponse.json({ error: 'Invalid shipment ID' }, { status: 400 });
    }

    const userAddress = await getAuthUser(req);
    const updater = userAddress || '0xSystemGuest';

    const body = await req.json();
    if (!body) {
      return NextResponse.json({ error: 'Empty update body' }, { status: 400 });
    }

    // Convert keys to snake_case
    const dbUpdates = toSnakeCase(body) as Record<string, unknown>;

    const { data, error } = await supabase
      .from('shipments')
      .update(dbUpdates)
      .eq('id', shipmentId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAudit(updater, 'shipment.update', { shipmentId, updates: body });
    return NextResponse.json(toCamelCase(data));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
