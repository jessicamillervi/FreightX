import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { logAudit } from '@/lib/auth';

// POST: Circle Webhook Event Ingestion Handler
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Log the received Circle webhook in the database audit logs
    const eventId = body?.id || 'unknown-evt';
    const eventType = body?.type || 'circle.unknown';
    const eventDetails = body?.data || {};

    console.log(`Received Circle Webhook: ${eventType} (${eventId})`);

    // In a production app, verify Circle signature header here.
    // ForAgora stablecoins challenge, we ingest and audit the event.
    await logAudit('0xCircleWebhook', eventType, {
      eventId,
      details: eventDetails
    });

    // Handle specific Circle Events
    if (eventType === 'wallet.created') {
      const walletAddress = eventDetails.wallet?.address;
      if (walletAddress) {
        // Log wallet mapping
        await supabase.from('users').upsert({
          wallet_address: walletAddress,
          wallet_type: 'circle',
          created_at: new Date().toISOString()
        });
      }
    } else if (eventType === 'transaction.updated') {
      const txHash = eventDetails.txHash;
      const state = eventDetails.state; // e.g. "CONFIRMED"
      const destinationAddress = eventDetails.destinationAddress;
      const amount = eventDetails.amount;
      
      // If payment represents an escrow or loan transaction, perform updates if needed
      console.log(`Circle Transaction Updated: ${txHash} -> ${state} for ${destinationAddress} of amount ${amount}`);
    }

    return NextResponse.json({ success: true, eventId });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Circle webhook ingestion error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
