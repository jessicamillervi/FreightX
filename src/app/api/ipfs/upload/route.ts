import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || process.env.PINATA_JWT || '';
    const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || process.env.PINATA_API_KEY || '';
    const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || process.env.PINATA_SECRET_KEY || '';

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file found in form data' }, { status: 400 });
    }

    const isRealPinata = !!(PINATA_JWT || (PINATA_API_KEY && PINATA_SECRET_KEY));

    if (isRealPinata) {
      const pinataFormData = new FormData();
      pinataFormData.append('file', file, file.name || 'file.json');

      const headers: Record<string, string> = {};
      if (PINATA_JWT) {
        headers['Authorization'] = `Bearer ${PINATA_JWT}`;
      } else {
        headers['pinata_api_key'] = PINATA_API_KEY;
        headers['pinata_secret_api_key'] = PINATA_SECRET_KEY;
      }

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers,
        body: pinataFormData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Pinata error: ${response.statusText} - ${errText}`);
      }

      const result = await response.json();
      return NextResponse.json({
        success: true,
        cid: result.IpfsHash,
      });
    } else {
      // Mock Fallback
      const randomHex = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      const cid = `QmMockIPFSHash${randomHex}`.substring(0, 46);

      return NextResponse.json({
        success: true,
        cid,
        mock: true,
      });
    }
  } catch (err: any) {
    console.error('API IPFS upload error:', err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
