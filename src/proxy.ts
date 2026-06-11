import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16: renamed from `middleware` to `proxy`
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only gate specific telemetry endpoints
  const isReading = pathname.startsWith('/api/telemetry/reading');
  const isHistory = pathname.startsWith('/api/telemetry/history');

  if (isReading || isHistory) {
    // Check for payment signature header (case-insensitive)
    const paymentSig = request.headers.get('payment-signature') || request.headers.get('PAYMENT-SIGNATURE');

    if (!paymentSig) {
      // Determine price
      const price = isReading ? 0.001 : 0.01;
      const amountAtomic = Math.round(price * 1_000_000).toString();
      
      const SELLER_ADDRESS = process.env.GATEWAY_SELLER_ADDRESS || '0x9b1C51CEF8BC8757Ad757845eF80a390A3b9D194';
      const USDC_ASSET = '0x3600000000000000000000000000000000000000';
      const ARC_NETWORK = 'eip155:5042002';

      // Build requirements object
      const requirements = {
        x402Version: '2.0.0',
        accepts: [
          {
            scheme: 'GatewayWalletBatched',
            payTo: SELLER_ADDRESS,
            network: ARC_NETWORK,
            asset: USDC_ASSET,
            maxAmountRequired: amountAtomic,
          },
        ],
      };

      const base64Reqs = Buffer.from(JSON.stringify(requirements)).toString('base64');

      return new NextResponse(
        JSON.stringify({
          error: 'Payment Required',
          message: `This resource requires a nanopayment of $${price} USDC via Circle Gateway.`,
          requirements
        }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED',
            'PAYMENT-REQUIRED': base64Reqs,
          },
        }
      );
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/api/telemetry/reading/:path*', '/api/telemetry/history/:path*'],
};
