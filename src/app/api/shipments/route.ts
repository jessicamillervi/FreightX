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

    // Sort by id descending
    query = query.order('id', { ascending: false });

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
    // Even if no user session header is found, allow creation for simulation/sandbox convenience
    const creator = userAddress || '0xSystemGuest';

    const body = await req.json();
    if (!body) {
      return NextResponse.json({ error: 'Missing shipment body' }, { status: 400 });
    }

    if (Array.isArray(body)) {
      const rows = body.map(item => toSnakeCase(item) as Record<string, unknown>);
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

    const dbRow = toSnakeCase(body) as Record<string, unknown>;
    const attemptRow = { ...dbRow };

    let { data, error } = await supabase.from('shipments').insert(attemptRow).select().single();

    if (error && error.message?.includes('column') && error.message?.includes('does not exist')) {
      delete attemptRow.locked_fx_rate;
      const secondAttempt = await supabase.from('shipments').insert(attemptRow).select().single();
      data = secondAttempt.data;
      error = secondAttempt.error;
    }

    if (error) {
      // If shipment already exists, update/upsert instead
      let { data: upsertData, error: upsertErr } = await supabase
        .from('shipments')
        .upsert(attemptRow)
        .select()
        .single();
        
      if (upsertErr && upsertErr.message?.includes('column') && upsertErr.message?.includes('does not exist')) {
        delete attemptRow.locked_fx_rate;
        const secondUpsert = await supabase
          .from('shipments')
          .upsert(attemptRow)
          .select()
          .single();
        upsertData = secondUpsert.data;
        upsertErr = secondUpsert.error;
      }

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
