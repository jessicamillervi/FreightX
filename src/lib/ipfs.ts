/**
 * IPFS Client Integration using Pinata API
 * Fallback to in-memory/localStorage mock when keys are not configured.
 */

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || '';
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || '';

// In-memory registry for mock IPFS files so we can retrieve them in the verify tab/routes
const getMockRegistry = (): Record<string, { name: string; content: string; type: string; timestamp: number }> => {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem('freightx_mock_ipfs_registry');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const saveMockRegistry = (registry: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('freightx_mock_ipfs_registry', JSON.stringify(registry));
  } catch (err) {
    console.error('Failed to save mock IPFS registry', err);
  }
};

/**
 * Uploads a file or JSON data to IPFS.
 */
export async function uploadToIPFS(
  fileOrData: File | Blob | Record<string, any> | string,
  fileName = 'file'
): Promise<{ success: boolean; cid: string; ipfsUrl: string; error?: string }> {
  try {
    const isRealPinata = PINATA_JWT || (PINATA_API_KEY && PINATA_SECRET_KEY);

    if (isRealPinata) {
      const formData = new FormData();
      
      if (fileOrData instanceof File || fileOrData instanceof Blob) {
        formData.append('file', fileOrData);
      } else {
        const content = typeof fileOrData === 'object' ? JSON.stringify(fileOrData) : fileOrData;
        const blob = new Blob([content], { type: 'application/json' });
        formData.append('file', blob, fileName);
      }

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
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Pinata error: ${response.statusText}`);
      }

      const result = await response.json();
      const cid = result.IpfsHash;
      return {
        success: true,
        cid,
        ipfsUrl: getIPFSUrl(cid),
      };
    } else {
      // MOCK UPLOAD
      console.warn('⚠️ Pinata API keys not found. Mocking IPFS upload.');
      
      // Generate realistic looking IPFS V0 CID (starts with Qm, 46 characters)
      const randomHex = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      const cid = `QmMockIPFSHash${randomHex}`.substring(0, 46);

      let contentStr = '';
      let typeStr = 'application/json';

      if (fileOrData instanceof File) {
        contentStr = `[File Mock] ${fileOrData.name} (${fileOrData.size} bytes)`;
        typeStr = fileOrData.type;
      } else if (fileOrData instanceof Blob) {
        contentStr = `[Blob Mock] (${fileOrData.size} bytes)`;
        typeStr = fileOrData.type;
      } else if (typeof fileOrData === 'object') {
        contentStr = JSON.stringify(fileOrData, null, 2);
      } else {
        contentStr = String(fileOrData);
        typeStr = 'text/plain';
      }

      const registry = getMockRegistry();
      registry[cid] = {
        name: fileName,
        content: contentStr,
        type: typeStr,
        timestamp: Date.now(),
      };
      saveMockRegistry(registry);

      // Sync to API server to persist across backend route calls
      try {
        await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cid, name: fileName, content: contentStr, type: typeStr }),
        });
      } catch (e) {
        console.error('Failed to sync mock IPFS to API server:', e);
      }

      // Return the mock result
      return {
        success: true,
        cid,
        ipfsUrl: getIPFSUrl(cid),
      };
    }
  } catch (err) {
    console.error('IPFS upload failed:', err);
    return {
      success: false,
      cid: '',
      ipfsUrl: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Resolves a CID to a gateway URL.
 */
export function getIPFSUrl(cid: string): string {
  if (!cid) return '';
  if (cid.startsWith('QmMockIPFSHash')) {
    // Return a special endpoint or public path we can render internally
    return `/api/documents?cid=${cid}`;
  }
  return `https://ipfs.io/ipfs/${cid}`;
}

/**
 * Retrieves content from IPFS/Mock registry.
 */
export async function getIPFSContent(cid: string): Promise<string> {
  if (cid.startsWith('QmMockIPFSHash')) {
    const registry = getMockRegistry();
    const mockFile = registry[cid];
    if (mockFile) return mockFile.content;
    throw new Error('Mock file not found');
  }

  const response = await fetch(getIPFSUrl(cid));
  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
  }
  return response.text();
}
