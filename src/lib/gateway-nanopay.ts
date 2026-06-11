/* eslint-disable @typescript-eslint/no-explicit-any */
import { recoverAddress, hashTypedData } from 'viem';
import { supabase } from './db';

export interface PaymentSignaturePayload {
  from: string;
  to: string;
  value: string; // in atomic units, e.g. "1000" for $0.001 (6 decimals)
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
  shipmentId?: number;
}

export interface GatewayPaymentRequirements {
  x402Version: string;
  accepts: Array<{
    scheme: string;
    payTo: string;
    network: string;
    asset: string;
    maxAmountRequired: string;
  }>;
}

const SELLER_ADDRESS = process.env.GATEWAY_SELLER_ADDRESS || '0x9b1C51CEF8BC8757Ad757845eF80a390A3b9D194';
const USDC_ASSET = '0x3600000000000000000000000000000000000000';
const ARC_NETWORK = 'eip155:5042002'; // Arc Testnet CAIP-2

/**
 * Builds x402 payment requirements object
 */
export function buildPaymentRequirements(priceUsd: number): GatewayPaymentRequirements {
  // Convert price to micro-USDC (6 decimals)
  const amountAtomic = Math.round(priceUsd * 1_000_000).toString();
  return {
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
}

/**
 * Encodes requirements to Base64
 */
export function encodeRequirements(reqs: GatewayPaymentRequirements): string {
  return Buffer.from(JSON.stringify(reqs)).toString('base64');
}

/**
 * Decodes client's payment signature header
 */
export function decodePaymentSignature(headerValue: string): PaymentSignaturePayload | null {
  try {
    const raw = Buffer.from(headerValue, 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to decode payment signature header:', err);
    return null;
  }
}

/**
 * Verifies EIP-3009 payment signature.
 * Under EIP-3009, TransferWithAuthorization is signed by the owner.
 * We verify the signature matches the 'from' address.
 */
export async function verifyPaymentSignature(
  payload: PaymentSignaturePayload,
  requiredAmountAtomic: number
): Promise<boolean> {
  try {
    const { from, to, value, validAfter, validBefore, nonce, signature } = payload;

    // 1. Basic validation
    if (!from || !to || !value || !signature) {
      console.warn('Payment validation failed: Missing required fields in payload');
      return false;
    }

    // 2. Validate recipient
    if (to.toLowerCase() !== SELLER_ADDRESS.toLowerCase()) {
      console.warn(`Payment validation failed: Recipient ${to} does not match seller address ${SELLER_ADDRESS}`);
      return false;
    }

    // 3. Validate value
    const valNum = parseInt(value, 10);
    if (isNaN(valNum) || valNum < requiredAmountAtomic) {
      console.warn(`Payment validation failed: Paid value ${valNum} is less than required ${requiredAmountAtomic}`);
      return false;
    }

    // 4. Validate timeouts
    const nowSecs = Math.floor(Date.now() / 1000);
    const beforeNum = parseInt(validBefore, 10);
    const afterNum = parseInt(validAfter, 10);
    if (nowSecs > beforeNum || nowSecs < afterNum) {
      console.warn(`Payment validation failed: Outside valid timestamp window. Now: ${nowSecs}, Before: ${beforeNum}, After: ${afterNum}`);
      return false;
    }

    // 5. Cryptographic signature verification (EIP-3009 TransferWithAuthorization format)
    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: 5042002,
      verifyingContract: USDC_ASSET as `0x${string}`,
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const message = {
      from: from as `0x${string}`,
      to: to as `0x${string}`,
      value: BigInt(value),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: nonce as `0x${string}`,
    };

    const recovered = await recoverAddress({
      hash: hashTypedData({ domain, types, primaryType: 'TransferWithAuthorization', message }),
      signature: signature as `0x${string}`,
    });

    if (recovered.toLowerCase() !== from.toLowerCase()) {
      console.warn(`Payment validation failed: Cryptographic signature mismatch. Recovered: ${recovered}, Expected: ${from}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error during cryptographic signature verification:', err);
    // In dev mode/sandbox mode, if signature parsing fails due to dummy input,
    // we fallback to verifying if the buyer address exists or has a deposit.
    return false;
  }
}

/**
 * Handles the payment verification and debiting ledger logic.
 */
export async function processPayment(
  signatureHeader: string,
  priceUsd: number,
  endpoint: string,
  shipmentId?: number
): Promise<{ success: boolean; buyerAddress?: string; error?: string }> {
  try {
    const payload = decodePaymentSignature(signatureHeader);
    if (!payload) {
      return { success: false, error: 'Invalid x402 signature format' };
    }

    const requiredAtomic = Math.round(priceUsd * 1_000_000);
    
    // Check if cryptographic signature is valid OR buyer has deposit balance in db.
    // Real wallets will sign EIP-3009, sandbox wallets will leverage the prepaid balances.
    let isValid = await verifyPaymentSignature(payload, requiredAtomic);
    
    // Fallback: Check if they have prepaid deposit balance
    const { data: balData } = await supabase
      .from('gateway_balances' as any)
      .select('balance')
      .eq('wallet_address', payload.from)
      .single();

    const currentBalance = balData ? parseFloat(balData.balance as string) : 0;
    const paymentAmountUsd = requiredAtomic / 1_000_000;

    if (!isValid) {
      if (currentBalance >= paymentAmountUsd) {
        isValid = true;
      } else {
        return { success: false, error: 'Cryptographic signature mismatch and insufficient deposit balance' };
      }
    }

    // Debit the prepaid balance if they used deposit, or record the new balance/transaction
    const newBalance = Math.max(0, currentBalance - paymentAmountUsd);
    await supabase
      .from('gateway_balances' as any)
      .upsert({
        wallet_address: payload.from,
        balance: newBalance,
        updated_at: new Date().toISOString()
      });

    // Record the earnings in gateway_payments
    await supabase
      .from('gateway_payments' as any)
      .insert({
        buyer_address: payload.from,
        seller_address: SELLER_ADDRESS,
        amount: paymentAmountUsd,
        endpoint,
        shipment_id: shipmentId || null,
        tx_hash: payload.signature.substring(0, 66) // use signature as pseudo tx_hash
      });

    return { success: true, buyerAddress: payload.from };
  } catch (err: any) {
    console.error('Error processing nanopayment:', err);
    return { success: false, error: err.message || 'Internal payment error' };
  }
}
