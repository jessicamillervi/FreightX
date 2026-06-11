import { NextResponse } from 'next/server';
import { supabase, toCamelCase, toSnakeCase } from '@/lib/db';
import { getAuthUser, logAudit } from '@/lib/auth';

// GET: Retrieve all PO financing loans
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const supplier = searchParams.get('supplier');
    const buyer = searchParams.get('buyer');

    let query = supabase.from('po_loans').select('*');

    if (supplier) query = query.eq('supplier', supplier);
    if (buyer) query = query.eq('buyer', buyer);

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

// POST: Create or upsert PO loan(s)
export async function POST(req: Request) {
  try {
    const userAddress = await getAuthUser(req);
    const creator = userAddress || '0xSystemGuest';

    const body = await req.json();
    if (!body) {
      return NextResponse.json({ error: 'Missing PO loan body' }, { status: 400 });
    }

    if (Array.isArray(body)) {
      const rows = body.map(item => toSnakeCase(item) as Record<string, unknown>);
      const { data, error } = await supabase.from('po_loans').upsert(rows).select();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await logAudit(creator, 'po_loans.upsert_batch', { count: body.length });
      return NextResponse.json(toCamelCase(data));
    }

    if (body.id === undefined) {
      return NextResponse.json({ error: 'Missing PO loan ID' }, { status: 400 });
    }

    const dbRow = toSnakeCase(body) as Record<string, unknown>;
    const { data, error } = await supabase.from('po_loans').insert(dbRow).select().single();

    if (error) {
      // If loan already exists, upsert it instead
      const { data: upsertData, error: upsertErr } = await supabase
        .from('po_loans')
        .upsert(dbRow)
        .select()
        .single();
        
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
      
      await logAudit(creator, 'po_loan.upsert', { poId: body.id });
      return NextResponse.json(toCamelCase(upsertData));
    }

    await logAudit(creator, 'po_loan.create', { poId: body.id });
    return NextResponse.json(toCamelCase(data));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
