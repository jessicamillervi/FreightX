'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileText, Calendar, Hash, User, Anchor, Barcode, ExternalLink, History, Info, AlertTriangle } from 'lucide-react';

interface DocumentVersion {
  ipfsHash: string;
  passportTokenId: string;
  shipper: string;
  consignee: string;
  cargoDescription: string;
  weightKg: string;
  containerNumber: string;
  timestamp: number;
  version: number;
}

interface DocumentVerifyProps {
  tokenId: string;
}

export default function DocumentVerify({ tokenId }: DocumentVerifyProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DocumentVersion[]>([]);
  const [activeVersionIdx, setActiveVersionIdx] = useState<number>(0);
  const [contractAddress, setContractAddress] = useState<string>('');

  useEffect(() => {
    async function loadDocumentData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch verification info from API
        const res = await fetch(`/api/documents?tokenId=${tokenId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to fetch document verified records');
        }

        const data = await res.json();
        if (data.success && data.history) {
          setHistory(data.history);
          setActiveVersionIdx(data.history.length - 1); // Default to latest version
        } else {
          throw new Error('No verified document history found.');
        }

        // Fetch contract address
        try {
          const addrData = await import('@/abi/addresses.json') as any;
          setContractAddress(addrData.FreightDocuments || addrData.default?.FreightDocuments || '0x0000000000000000000000000000000000000000');
        } catch {
          // Ignore
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    if (tokenId) {
      loadDocumentData();
    }
  }, [tokenId]);

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)' }}>
        <div className="animate-spin-slow" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)' }} />
        <span>Verifying on-chain compliance metadata...</span>
      </div>
    );
  }

  if (error || history.length === 0) {
    return (
      <div className="glass-panel flex-center" style={{ minHeight: '250px', flexDirection: 'column', gap: '1rem', border: '1px solid rgba(239, 83, 80, 0.3)', padding: '2rem' }}>
        <AlertTriangle size={48} style={{ color: '#ef5350' }} />
        <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Verification Failed</h3>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem', margin: 0, maxWidth: '400px' }}>
          {error || 'The requested Document NFT token ID does not exist or has not been deployed on the Arc Testnet.'}
        </p>
      </div>
    );
  }

  const activeDoc = history[activeVersionIdx];
  const formattedDate = new Date(activeDoc.timestamp * 1000).toLocaleString();
  const verifyUrl = typeof window !== 'undefined' ? `${window.location.origin}/verify/${tokenId}` : '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
      
      {/* LEFT COLUMN: DOCUMENT FORM / PREVIEW */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{
          background: '#ffffff',
          color: '#111111',
          padding: '2.5rem',
          borderRadius: '12px',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '0.85rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          border: '4px double #111111',
          position: 'relative'
        }}>
          {/* Compliance Shield Watermark */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: '4.5rem',
            color: 'rgba(74, 201, 153, 0.04)',
            fontWeight: 'bold',
            letterSpacing: '5px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            VERIFIED COMPLIANT
          </div>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>FREIGHTX SECURE</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>On-Chain Compliant Cargo Document</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#4caf50', fontWeight: 'bold', justifyContent: 'flex-end', fontSize: '0.9rem' }}>
                <ShieldCheck size={16} /> VERIFIED
              </div>
              <span style={{ fontSize: '0.7rem' }}>Token ID: #{tokenId} (v{activeDoc.version})</span>
            </div>
          </div>

          {/* Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderBottom: '1px solid #111', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ borderRight: '1px solid #111', paddingRight: '0.75rem' }}>
              <span style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#666' }}>Shipper (Consignor):</span>
              <strong style={{ fontSize: '0.9rem', color: '#000', display: 'block', marginTop: '0.15rem' }}>{activeDoc.shipper}</strong>
            </div>
            <div style={{ paddingLeft: '0.75rem' }}>
              <span style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#666' }}>Consignee (Consignee):</span>
              <strong style={{ fontSize: '0.9rem', color: '#000', display: 'block', marginTop: '0.15rem' }}>{activeDoc.consignee}</strong>
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #111', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#666' }}>Cargo Description & Special Instructions:</span>
            <div style={{ fontSize: '0.85rem', color: '#222', marginTop: '0.25rem', fontWeight: 'bold', whiteSpace: 'pre-wrap' }}>
              {activeDoc.cargoDescription}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderBottom: '2px solid #111', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ borderRight: '1px solid #111', paddingRight: '0.75rem' }}>
              <span style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#666' }}>Container ID / Seal Number:</span>
              <strong style={{ fontSize: '0.9rem', color: '#000', fontFamily: 'monospace' }}>{activeDoc.containerNumber}</strong>
            </div>
            <div style={{ paddingLeft: '0.75rem' }}>
              <span style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#666' }}>Gross Weight (KG):</span>
              <strong style={{ fontSize: '0.9rem', color: '#000' }}>{Number(activeDoc.weightKg).toLocaleString()} KG</strong>
            </div>
          </div>

          {/* Footer Metadata */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.65rem', color: '#666' }}>IPFS Content Hash (CID):</span>
              <code style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', wordBreak: 'break-all' }}>{activeDoc.ipfsHash}</code>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#555' }}>Linked Cargo Twin: <strong>Passport NFT #{activeDoc.passportTokenId}</strong></span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
              <div style={{ fontSize: '1.25rem', letterSpacing: '1px', lineHeight: 1 }}>|||| ||| | |||</div>
              <span style={{ fontSize: '0.6rem', color: '#666' }}>SECURE VERIFICATION SHIELD</span>
            </div>
          </div>
        </div>

        {/* ON-CHAIN COMPLIANCE PROOF DETAILS */}
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={18} style={{ color: 'var(--success)' }} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>On-Chain Authenticity Audit</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.75rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Contract Standard</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>ERC-721 Digital Trade Document</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Network</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Arc Testnet (ID: 5042002)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Contract Address</span>
              <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                {contractAddress ? `${contractAddress.substring(0, 10)}...${contractAddress.substring(34)}` : 'N/A'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Verification Timestamp</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{formattedDate}</span>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a
              href={`https://testnet.arcscan.app/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
            >
              Verify Contract on ArcScan <ExternalLink size={12} />
            </a>
            <a
              href={activeDoc.ipfsHash.startsWith('QmMock') ? `/api/documents?cid=${activeDoc.ipfsHash}` : `https://ipfs.io/ipfs/${activeDoc.ipfsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
            >
              View Raw IPFS Data <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: DOCUMENT HISTORY & SHARE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* SHARE AREA AND QR CODE PLACEHOLDER */}
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 600 }}>Share Verification</h4>
          
          {/* Barcode/QR Code Representation */}
          <div style={{
            background: '#ffffff',
            padding: '1rem',
            borderRadius: '8px',
            display: 'inline-block',
            marginBottom: '0.75rem',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
          }}>
            {/* Simple SVG Drawing of a QR Code grid for high design quality */}
            <svg width="120" height="120" viewBox="0 0 100 100" style={{ shapeRendering: 'crispEdges' }}>
              <rect width="100" height="100" fill="#ffffff" />
              {/* Outer corners */}
              <path d="M0 0h30v30H0zm5 5v20h20V5zm5 5h10v10H10zM70 0h30v30H70zm5 5v20h20V5zm5 5h10v10H80zM0 70h30v30H0zm5 5v20h20V75zm5 5h10v10H10z" fill="#000" />
              {/* Random QR Code blocks */}
              <path d="M35 5h5v10h-5zm10 0h10v5H45zm20 5h5v5h-5zm-30 15h5v15h-5zm15 5h10v5H50zm15 0h5v10h-5zm-15 15h5v5h-5zm20 0h15v5H70zm-35 10h10v5h-10zm25 0h5v10h-5zm15 5h10v5H80zm-45 10h10v5h-10zm15 0h15v5H50zm35 0h5v10h-5zm-55 10h5v5h-5zm15 0h10v5H45zm20 0h5v5h-5z" fill="#000" />
            </svg>
          </div>

          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
            Counterparties, customs officials, and auditors can scan this QR code to view live compliance history.
          </p>

          <button
            onClick={() => {
              navigator.clipboard.writeText(verifyUrl);
              alert('Copied verification URL to clipboard!');
            }}
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}
          >
            Copy Verification URL
          </button>
        </div>

        {/* AMENDMENTS HISTORY TIMELINE */}
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <History size={18} style={{ color: 'var(--primary)' }} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Amendments History</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
            {history.map((ver, idx) => (
              <div
                key={idx}
                onClick={() => setActiveVersionIdx(idx)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: idx === activeVersionIdx ? 'rgba(84, 110, 238, 0.15)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${idx === activeVersionIdx ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: idx === activeVersionIdx ? 'var(--primary)' : 'var(--text-main)' }}>
                    Version {ver.version} {ver.version === 1 ? '(Original)' : '(Amendment)'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    #{ver.ipfsHash.substring(0, 8)}
                  </span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {new Date(ver.timestamp * 1000).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
