import { supabase } from './db';

/**
 * Extracts and validates the authenticated wallet address from a request.
 * Supports standard Bearer Token authorization header containing the wallet address.
 */
export async function getAuthUser(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization') || '';
    let walletAddress = '';

    if (authHeader.startsWith('Bearer ')) {
      walletAddress = authHeader.substring(7).trim();
    } else {
      // Fallback to custom header
      walletAddress = req.headers.get('x-user-address') || '';
    }

    if (!walletAddress || walletAddress.length < 26) {
      return null;
    }

    // Ensure user exists in database
    await ensureUserExists(walletAddress);

    return walletAddress;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Automatically inserts user record on the first session detection.
 */
async function ensureUserExists(walletAddress: string): Promise<void> {
  try {
    // Check if user exists
    const { data } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('wallet_address', walletAddress)
      .single();

    if (!data) {
      // Create user
      const isCircle = walletAddress.startsWith('0x') && walletAddress.length === 42; // standard check or mock
      await supabase.from('users').insert({
        wallet_address: walletAddress,
        wallet_type: isCircle ? 'circle' : 'web3'
      });
    }
  } catch (e) {
    console.error('Failed to register session user', e);
  }
}

/**
 * Logs a user action to the audit logs database.
 */
export async function logAudit(
  userAddress: string,
  action: string,
  details: unknown
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_address: userAddress,
      action,
      details: typeof details === 'string' ? { message: details } : details
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}
