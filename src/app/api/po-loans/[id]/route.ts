import { NextResponse } from 'next/server';
import { supabase, toCamelCase, toSnakeCase } from '@/lib/db';
import { getAuthUser, logAudit } from '@/lib/auth';

// GET: Retrieve detailed PO financing loan by ID
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const poId = parseInt(id, 10);
    if (isNaN(poId)) {
      return NextResponse.json({ error: 'Invalid PO ID' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('po_loans')
      .select('*')
      .eq('id', poId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'PO financing loan not found' }, { status: 404 });
    }

    return NextResponse.json(toCamelCase(data));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// PATCH: Update PO loan status (funded, repaid, investor)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const poId = parseInt(id, 10);
    if (isNaN(poId)) {
      return NextResponse.json({ error: 'Invalid PO ID' }, { status: 400 });
    }

    const userAddress = await getAuthUser(req);
    const updater = userAddress || '0xSystemGuest';

    const body = await req.json();
    if (!body) {
      return NextResponse.json({ error: 'Empty update body' }, { status: 400 });
    }

    const dbUpdates = toSnakeCase(body) as Record<string, unknown>;

    const { data, error } = await supabase
      .from('po_loans')
      .update(dbUpdates)
      .eq('id', poId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAudit(updater, 'po_loan.update', { poId, updates: body });
    return NextResponse.json(toCamelCase(data));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
