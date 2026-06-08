import crypto from 'crypto';

/**
 * Verifies the authenticity of a Circle Webhook payload (AWS SNS format).
 * Gated by certificate domain whitelist and cryptographic signature verification.
 */
export async function verifyCircleWebhookSignature(
  rawBody: string,
  headers: Headers
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    const json = JSON.parse(rawBody);
    
    // AWS SNS / Circle Webhooks standard properties
    const signature = json.Signature;
    const signatureVersion = json.SignatureVersion;
    const signingCertUrl = json.SigningCertURL;
    const type = json.Type;
    
    // If not SNS signature fields, check for custom X-Circle-Signature
    const xCircleSig = headers.get('x-circle-signature') || headers.get('X-Circle-Signature');

    if (!signature && !xCircleSig) {
      return { 
        isValid: false, 
        reason: 'Missing signature headers (Signature or X-Circle-Signature)' 
      };
    }

    // Case 1: Standard AWS SNS format used by Circle
    if (signature && signingCertUrl) {
      // 1. Validate certificate domain to prevent SSRF or rogue certificate injection
      const certUrl = new URL(signingCertUrl);
      const isTrustedDomain = 
        certUrl.protocol === 'https:' && 
        (certUrl.hostname.endsWith('.amazonaws.com') || certUrl.hostname.endsWith('.circle.com'));
      
      if (!isTrustedDomain) {
        return { isValid: false, reason: `Untrusted certificate domain: ${certUrl.hostname}` };
      }

      // 2. Fetch the certificate from the trusted domain
      const response = await fetch(signingCertUrl);
      if (!response.ok) {
        return { isValid: false, reason: 'Failed to retrieve signing certificate' };
      }
      const certText = await response.text();

      // 3. Reconstruct the signature payload string (following AWS SNS signature guidelines)
      let signString = '';
      if (type === 'Notification') {
        signString = 
          `Message\n${json.Message}\n` +
          `MessageId\n${json.MessageId}\n` +
          (json.Subject ? `Subject\n${json.Subject}\n` : '') +
          `Timestamp\n${json.Timestamp}\n` +
          `TopicArn\n${json.TopicArn}\n` +
          `Type\n${json.Type}\n`;
      } else if (type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation') {
        signString = 
          `Message\n${json.Message}\n` +
          `MessageId\n${json.MessageId}\n` +
          `SubscribeURL\n${json.SubscribeURL}\n` +
          `Timestamp\n${json.Timestamp}\n` +
          `Token\n${json.Token}\n` +
          `TopicArn\n${json.TopicArn}\n` +
          `Type\n${json.Type}\n`;
      } else {
        return { isValid: false, reason: `Unknown SNS message type: ${type}` };
      }

      // 4. Verify signature cryptographically using public key certificate
      const publicKey = crypto.createPublicKey(certText);
      const verifier = crypto.createVerify('sha1WithRSAEncryption');
      verifier.update(signString, 'utf8');
      
      const isVerified = verifier.verify(publicKey, signature, 'base64');
      if (isVerified) {
        return { isValid: true };
      } else {
        return { isValid: false, reason: 'Cryptographic signature verification failed' };
      }
    }

    // Case 2: Custom X-Circle-Signature header
    if (xCircleSig) {
      // Custom developer key validation
      const webhookSecret = process.env.CIRCLE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return { isValid: false, reason: 'CIRCLE_WEBHOOK_SECRET environment variable is not configured' };
      }

      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (xCircleSig === expectedSig) {
        return { isValid: true };
      } else {
        return { isValid: false, reason: 'X-Circle-Signature HMAC mismatch' };
      }
    }

    return { isValid: false, reason: 'Invalid signature structure' };
  } catch (error: any) {
    return { isValid: false, reason: `Error during verification: ${error.message}` };
  }
}
