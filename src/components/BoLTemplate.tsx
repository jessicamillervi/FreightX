'use client';

import React, { useState } from 'react';
import { FileText, Anchor, User, ShieldAlert, Barcode, Scale, HelpCircle } from 'lucide-react';

interface BoLData {
  shipper: string;
  consignee: string;
  cargoDescription: string;
  weightKg: string;
  containerNumber: string;
  portOfLoading: string;
  portOfDischarge: string;
}

interface BoLTemplateProps {
  onSubmit: (data: BoLData) => void;
  loading: boolean;
  defaultPortOfLoading?: string;
  defaultPortOfDischarge?: string;
}

export default function BoLTemplate({
  onSubmit,
  loading,
  defaultPortOfLoading = 'Singapore Keppel Terminal',
  defaultPortOfDischarge = 'Rotterdam Gateway'
}: BoLTemplateProps) {
  const [formData, setFormData] = useState<BoLData>({
    shipper: 'Global Supply Chain Ltd.',
    consignee: 'Apex Retail Distributors Inc.',
    cargoDescription: '500 Cartons of Temperature-Sensitive Pharmaceuticals (Insulin Vaccines). Store strictly between 2°C and 8°C.',
    weightKg: '4250',
    containerNumber: 'CRXU-891045-2',
    portOfLoading: defaultPortOfLoading,
    portOfDischarge: defaultPortOfDischarge
  });

  const [previewMode, setPreviewMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText style={{ color: 'var(--primary)' }} size={20} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Bill of Lading Generator</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn ${!previewMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setPreviewMode(false)}
          >
            Edit Form
          </button>
          <button
            type="button"
            className={`btn ${previewMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setPreviewMode(true)}
          >
            Preview Document
          </button>
        </div>
      </div>

      {!previewMode ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={12} /> Shipper (Consignor)
              </label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.shipper}
                onChange={(e) => setFormData({ ...formData, shipper: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={12} /> Consignee
              </label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.consignee}
                onChange={(e) => setFormData({ ...formData, consignee: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Anchor size={12} /> Port of Loading
              </label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.portOfLoading}
                onChange={(e) => setFormData({ ...formData, portOfLoading: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Anchor size={12} /> Port of Discharge
              </label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.portOfDischarge}
                onChange={(e) => setFormData({ ...formData, portOfDischarge: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Scale size={12} /> Gross Weight (kg)
              </label>
              <input
                type="number"
                className="form-input"
                required
                value={formData.weightKg}
                onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Barcode size={12} /> Container / Seal Number
              </label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.containerNumber}
                onChange={(e) => setFormData({ ...formData, containerNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Cargo Description & Handling Instructions</label>
            <textarea
              className="form-input"
              rows={3}
              required
              value={formData.cargoDescription}
              onChange={(e) => setFormData({ ...formData, cargoDescription: e.target.value })}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ alignSelf: 'flex-end', marginTop: '0.5rem' }}
          >
            {loading ? 'Minting Document...' : 'Generate & Mint Bill of Lading'}
          </button>
        </form>
      ) : (
        /* PROFESSIONAL DRAFT PDF PREVIEW */
        <div style={{
          background: '#ffffff',
          color: '#1a1a1a',
          padding: '2rem',
          borderRadius: '8px',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '0.8rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          border: '4px double #1a1a1a',
          maxWidth: '700px',
          margin: '0 auto',
          position: 'relative'
        }}>
          {/* Watermark Draft */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: '5rem',
            color: 'rgba(0, 0, 0, 0.05)',
            fontWeight: 'bold',
            letterSpacing: '10px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase'
          }}>
            DRAFT COPY
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1a1a1a', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>FREIGHTX LOGISTICS</h2>
              <span style={{ fontSize: '0.75rem' }}>Global Ocean Cargo Transport & Settlement</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>BILL OF LADING</h3>
              <span>NFT DIGITAL COMPLIANT TWIN</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ borderRight: '1px solid #1a1a1a', paddingRight: '0.5rem' }}>
              <strong style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#555' }}>Shipper / Exporting Client:</strong>
              <div style={{ whiteSpace: 'pre-wrap', fontWeight: 'bold' }}>{formData.shipper}</div>
            </div>
            <div style={{ paddingLeft: '0.5rem' }}>
              <strong style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#555' }}>Consignee / Importer:</strong>
              <div style={{ whiteSpace: 'pre-wrap', fontWeight: 'bold' }}>{formData.consignee}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ borderRight: '1px solid #1a1a1a', paddingRight: '0.5rem' }}>
              <strong style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#555' }}>Port of Loading:</strong>
              <div style={{ fontWeight: 'bold' }}>{formData.portOfLoading}</div>
            </div>
            <div style={{ paddingLeft: '0.5rem' }}>
              <strong style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#555' }}>Port of Discharge:</strong>
              <div style={{ fontWeight: 'bold' }}>{formData.portOfDischarge}</div>
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <strong style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#555' }}>Description of Packages and Goods:</strong>
            <div style={{ whiteSpace: 'pre-wrap', minHeight: '60px', padding: '0.25rem 0', fontWeight: 'bold' }}>{formData.cargoDescription}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderBottom: '2px solid #1a1a1a', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ borderRight: '1px solid #1a1a1a', paddingRight: '0.5rem' }}>
              <strong style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#555' }}>Container / Seal ID:</strong>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.9rem' }}>{formData.containerNumber}</div>
            </div>
            <div style={{ paddingLeft: '0.5rem' }}>
              <strong style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#555' }}>Gross Weight (Metric/KG):</strong>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{Number(formData.weightKg).toLocaleString()} KG</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: '#777' }}>
                <ShieldAlert size={10} />
                <span>E-Signature Cryptographically Locked</span>
              </div>
              <div style={{ fontStyle: 'italic', marginTop: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}>APPROVED BY ORACLE CONTRACT</div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <div style={{ fontSize: '1.5rem', letterSpacing: '2px', lineHeight: 1, fontFamily: 'monospace' }}>||||| | |||| |||</div>
              <span style={{ fontSize: '0.6rem', color: '#777' }}>Barcode: ARC-SECURE-METADATA</span>
            </div>
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button
              onClick={() => onSubmit(formData)}
              disabled={loading}
              className="btn btn-primary"
              style={{
                fontFamily: 'sans-serif',
                fontSize: '0.8rem',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem 1.5rem',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Minting Draft NFT...' : 'Confirm Draft & Mint Document'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
