import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { logAudit } from '@/lib/auth';
import { verifyCircleWebhookSignature } from '@/lib/circle-webhook-validator';

// POST: Circle Webhook Event Ingestion Handler
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const headers = req.headers;

    // Cryptographically verify the signature
    const verification = await verifyCircleWebhookSignature(rawBody, headers);
    
    if (!verification.isValid) {
      console.warn(`Circle Webhook signature validation failed: ${verification.reason}`);
      // Hard block on unauthorized payloads in production
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Unauthorized', reason: verification.reason },
          { status: 401 }
        );
      }
    }

    const body = JSON.parse(rawBody);

    // Auto-confirm AWS SNS subscriptions if received
    if (body.Type === 'SubscriptionConfirmation') {
      const subscribeUrl = body.SubscribeURL;
      if (subscribeUrl) {
        console.log(`SNS Subscription Confirmation URL received: ${subscribeUrl}`);
        await fetch(subscribeUrl);
      }
    }

    const eventId = body?.id || body?.MessageId || 'unknown-evt';
    const eventType = body?.type || body?.Type || 'circle.unknown';
    const eventDetails = typeof body?.data === 'object' ? body.data : body;

    console.log(`Received Circle Webhook: ${eventType} (${eventId})`);

    // Log event in audit table
    await logAudit('0xCircleWebhook', eventType, {
      eventId,
      details: eventDetails
    });

    // Handle specific Circle Events
    if (eventType === 'wallet.created') {
      const walletAddress = eventDetails.wallet?.address;
      if (walletAddress) {
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
      
      console.log(`Circle Transaction Updated: ${txHash} -> ${state} for ${destinationAddress} of amount ${amount}`);
    }

    return NextResponse.json({ success: true, eventId });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Circle webhook ingestion error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
