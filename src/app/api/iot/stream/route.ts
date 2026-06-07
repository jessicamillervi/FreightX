import { NextRequest } from 'next/server';
import { iotStreamHub } from '../../../../lib/iot-stream-hub';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      console.log('[IoT Stream] SSE Client connected');

      // Subscribe to real-time events from IoT Ingestion
      const unsubscribe = iotStreamHub.subscribe((data) => {
        try {
          // Standard SSE protocol data packet format: data: {json}\n\n
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (err) {
          console.error('[IoT Stream] Error enqueuing message:', err);
        }
      });

      // Keep connection alive with periodic heartbeats
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch (err) {
          // Suppress errors if connection is closing
        }
      }, 15000);

      // Handle stream cancellation/abort
      request.signal.addEventListener('abort', () => {
        console.log('[IoT Stream] SSE Client disconnected');
        clearInterval(keepAliveInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Content-Encoding': 'none',
    },
  });
}
