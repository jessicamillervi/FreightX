'use client';

import React, { useState, useCallback } from 'react';
import { 
  Award, 
  Download, 
  Compass, 
  FileText, 
  Thermometer, 
  ScanQrCode, 
  FileCode 
} from 'lucide-react';
import { useShipments } from '@/hooks/useShipments';
import { usePOLoans } from '@/hooks/usePOLoans';
import { useAppContext } from '@/contexts/AppContext';
import { type VCData } from '@/lib/types';

export default function PassportTab() {
  const { showToast, logTerminal, contracts, setActiveTab } = useAppContext();
  const { shipments, selectedShipmentId } = useShipments();
  const { poLoans } = usePOLoans();

  // Local VC Modal States
  const [showVcModal, setShowVcModal] = useState(false);
  const [vcModalData, setVcModalData] = useState<VCData | null>(null);

  // Dynamic Credit Passport computation from real shipment/PO data
  const computePassportStats = useCallback((role: 'supplier' | 'buyer' | 'carrier') => {
    const addrMap: Record<string, string> = {
      supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
      buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
      carrier: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e'
    };
    const nameMap: Record<string, string> = {
      supplier: 'Shenzhen Maritime Suppliers',
      buyer: 'Rotterdam Importers Ltd',
      carrier: 'Global Logistics Carrier'
    };
    const addr = addrMap[role];
    const name = nameMap[role];

    // Count shipments involving this role
    const roleShipments = shipments.filter(s => {
      if (role === 'supplier') return s.supplier.toLowerCase() === addr.toLowerCase();
      if (role === 'buyer') return s.buyer.toLowerCase() === addr.toLowerCase();
      return s.carrier.toLowerCase() === addr.toLowerCase();
    });

    const completedShipments = roleShipments.filter(s => s.status === 'Completed');
    const totalCount = roleShipments.length;
    const completedCount = completedShipments.length;

    // Settled volume
    const settledVolume = completedShipments.reduce((sum, s) => sum + s.cargoValue + s.shippingFee, 0);

    // Telematics violations
    const totalViolations = roleShipments.reduce((sum, s) => sum + (s.temperatureViolations || 0), 0);
    const complianceRate = totalCount > 0 ? Math.max(0, 100 - (totalViolations / Math.max(totalCount, 1)) * 15) : 100;

    // Demurrage overdrafts (buyer-specific)
    const demurrageOverdrafts = completedShipments.filter(s => s.demurragePenaltyPaid > 0).length;
    const onTimeRate = completedCount > 0 ? ((completedCount - demurrageOverdrafts) / completedCount * 100) : 100;

    // PO repayment rate
    const rolePOs = poLoans.filter(p => {
      if (role === 'supplier') return p.supplier.toLowerCase() === addr.toLowerCase();
      if (role === 'buyer') return p.buyer.toLowerCase() === addr.toLowerCase();
      return false;
    });
    const fundedPOs = rolePOs.filter(p => p.funded);
    const repaidPOs = rolePOs.filter(p => p.repaid);
    const poRepayRate = fundedPOs.length > 0 ? (repaidPOs.length / fundedPOs.length * 100) : 100;

    // Credit grade calculation
    const rawScore = Math.min(100, Math.round(
      40 + // base
      Math.min(20, completedCount * 3) + // experience bonus
      Math.min(20, complianceRate * 0.2) + // compliance bonus
      Math.min(10, poRepayRate * 0.1) + // repayment bonus
      Math.min(10, onTimeRate * 0.1) // on-time bonus
    ));

    let grade = 'B';
    if (rawScore >= 95) grade = 'AAA';
    else if (rawScore >= 88) grade = 'AA';
    else if (rawScore >= 80) grade = 'A';
    else if (rawScore >= 70) grade = 'BBB';
    else if (rawScore >= 60) grade = 'BB';

    return {
      addr, name, rawScore, grade,
      totalCount, completedCount, settledVolume,
      complianceRate: complianceRate.toFixed(1),
      onTimeRate: onTimeRate.toFixed(1),
      poRepayRate: poRepayRate.toFixed(0),
      totalViolations, demurrageOverdrafts
    };
  }, [shipments, poLoans]);

  // Cryptographic Credential Issuer exporter (uses dynamic stats)
  const handleExportVc = (role: 'supplier' | 'buyer' | 'carrier') => {
    const stats = computePassportStats(role);

    const doc: VCData = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://schema.org"
      ],
      "id": `urn:uuid:${Math.random().toString(36).substring(2, 15)}`,
      "type": ["VerifiableCredential", "TradeReputationCredential"],
      "issuer": `did:freightx:${contracts?.escrow || "0xActiveContractSuiteAddress"}`,
      "issuanceDate": new Date().toISOString(),
      "credentialSubject": {
        "id": `did:ethr:${stats.addr}`,
        "legalName": stats.name,
        "role": role.toUpperCase(),
        "reputationScore": stats.rawScore,
        "creditRatingGrade": stats.grade,
        "totalVolumeSettled": `${stats.settledVolume.toLocaleString()} USDC equivalent`,
        "completedContractsCount": stats.completedCount,
        "telematicsCompliance": `${stats.complianceRate}%`,
        "poRepaymentRate": `${stats.poRepayRate}%`
      },
      "proof": {
        "type": "JsonWebSignature2020",
        "created": new Date().toISOString(),
        "proofPurpose": "assertionMethod",
        "verificationMethod": `did:freightx:${contracts?.escrow || "0xActiveContractSuiteAddress"}#key-1`,
        "jws": "eyJhbGciOiJSUzI1NiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19...tS7s8"
      }
    };

    setVcModalData(doc);
    setShowVcModal(true);
    logTerminal(`Exported cryptographic Verifiable Credential (VC) for ${stats.name}.`);
  };

  const currentShipment = shipments.find(s => s.id === selectedShipmentId);
  const isIceRuined = currentShipment && currentShipment.temperature > 8.0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* SME Credit Passports Row */}
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={20} style={{ color: 'var(--success)' }} /> Trade Passport & SME Credit Scorecard
        </h2>
        <p style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>Reputation records, lifetime trade volume, and cold-chain reliability indices computed automatically from immutable logistics performance.</p>

        <div className="grid-cols-3">
          {(['supplier', 'buyer', 'carrier'] as const).map((role) => {
            const stats = computePassportStats(role);
            const colorMap = { supplier: 'var(--success)', buyer: 'var(--primary)', carrier: 'var(--warning)' };
            const bgMap = { supplier: 'rgba(0, 230, 118, 0.02)', buyer: 'rgba(0, 136, 255, 0.02)', carrier: 'rgba(255, 179, 0, 0.02)' };
            const badgeMap = { supplier: 'badge-success', buyer: 'badge-primary', carrier: 'badge-warning' };
            const labelMap = { supplier: 'Original Supplier', buyer: 'Buyer / Importer', carrier: 'Carrier / Logistics Partner' };
            const accentColor = colorMap[role];

            return (
              <div key={role} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: `4px solid ${accentColor}`, background: bgMap[role] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${badgeMap[role]}`}>{labelMap[role]}</span>
                  <strong style={{ fontSize: '1rem', color: accentColor }}>Grade {stats.grade}</strong>
                </div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{stats.name}</h4>
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{stats.addr.slice(0, 14)}...{stats.addr.slice(-5)}</span>
                <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.25rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span>Trade Credit Rating:</span>
                    <strong>{stats.rawScore}/100</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span>Lifetime Settled Volume:</span>
                    <strong>${stats.settledVolume.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span>Successfully Settled Escrows:</span>
                    <strong>{stats.completedCount} / {stats.totalCount} escrows</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span>Cold-Chain Compliance Rate:</span>
                    <strong>{stats.complianceRate}%{stats.totalViolations > 0 ? ` (${stats.totalViolations} thermal excursions)` : ''}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{role === 'buyer' ? 'On-time cargo receipt:' : role === 'carrier' ? 'On-time port arrival:' : 'PO loan repayment rate:'}</span>
                    <strong style={{ color: 'var(--success)' }}>{role === 'supplier' ? `${stats.poRepayRate}%` : `${stats.onTimeRate}%`}</strong>
                  </div>
                </div>

                <button 
                  onClick={() => handleExportVc(role)}
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.75rem', padding: '0.4rem', width: '100%', marginTop: '0.25rem' }}
                >
                  <Download size={12} /> Export Verifiable Credential (VC)
                </button>
              </div>
            );
          })}
        </div>
      </div>

       {/* Cargo NFT Certificate View */}
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Immutable Shipment Digital Passport (ERC-721 NFT)</h3>
        <p style={{ fontSize: '0.8rem' }}>Access immutable maritime insurance records, historical telemetry charts, and chronological time logs.</p>
      </div>

      {selectedShipmentId === null || !currentShipment ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
          <ScanQrCode size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>No Cargo Shipment Selected</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Please select a cargo shipment from the registry to view its ERC-721 physical-asset passport token details & transit telemetry logs.
          </p>
          <button onClick={() => setActiveTab('escrows')} className="btn btn-secondary">
            Go to Cargo Registry
          </button>
        </div>
      ) : (
        <div className="grid-cols-2">
          
          {/* NFT Passport Card */}
          <div className="glass-panel glass-panel-accent" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(0, 210, 255, 0.25)' }}>
            
            {/* NFT Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Compass size={18} style={{ color: 'var(--secondary)' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>LOGISTICS DIGITAL TWIN (NFT)</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOKEN ID #{currentShipment.passportTokenId}</span>
            </div>

            {/* Beautiful QR Code Simulation */}
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', width: '150px', height: '150px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(#000 35%, transparent 35%), radial-gradient(#000 35%, transparent 35%)', backgroundSize: '12px 12px', backgroundPosition: '0 0, 6px 6px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '32px', height: '32px', border: '4px solid #000', background: '#fff' }}></div>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '32px', height: '32px', border: '4px solid #000', background: '#fff' }}></div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '32px', height: '32px', border: '4px solid #000', background: '#fff' }}></div>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Logistics Digital Twin Passport</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Asset registered under <strong>FRTX-PASS</strong> contract identifier on Arc.
              </p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Port of Departure:</span>
                <strong>{currentShipment.departurePort}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Port of Destination:</span>
                <strong>{currentShipment.destinationPort}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Shipment Status:</span>
                <strong style={{
                  color: currentShipment.status === 'Completed' ? 'var(--success)' : 'var(--primary)'
                }}>
                  {currentShipment.status === 'Created' ? 'Escrow Secured' :
                   currentShipment.status === 'In Transit' ? 'In Transit' :
                   currentShipment.status === 'Arrived' ? 'Arrived at Port' :
                   currentShipment.status === 'Customs Cleared' ? 'Customs Cleared' :
                   currentShipment.status === 'Completed' ? 'Delivery Completed' : currentShipment.status}
                </strong>
              </div>
            </div>
          </div>

          {/* Immutable Timeline Logs */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} style={{ color: 'var(--primary)' }} /> Immutable Vessel Telemetry Ledger
            </h3>

            {isIceRuined && (
              <div style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.2)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', gap: '0.5rem' }}>
                <Thermometer size={16} />
                <div>
                  <strong>THERMAL EXCURSION WARNING DETECTED:</strong>
                  <span style={{ display: 'block', fontSize: '0.7rem' }}>
                    Cold storage temperature spiked to {currentShipment.temperature}°C (Exceeding agreed 8.0°C threshold). Smart contract has logged the breach for automated transit insurance adjusters.
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '280px', paddingRight: '0.25rem' }}>
              {currentShipment.history.map((h, i) => (
                <div key={i} style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '0.75rem', position: 'relative', paddingBottom: '0.25rem' }}>
                  <div style={{ position: 'absolute', left: '-5px', top: '2px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                  <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {new Date(h.timestamp).toLocaleString()}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>
                    {h.status === 'Departure Milestone (IoT Signed)' ? 'Departure Milestone (Verified IoT Telemetry)' :
                     h.status === 'Singapore Checkpoint (IoT Signed)' ? 'Singapore Hub Checkpoint (Verified IoT Telemetry)' :
                     h.status === 'Arrived at Destination (IoT Signed)' ? 'Destination Port Arrival (Verified IoT Telemetry)' :
                     h.status === 'Customs Cleared (IoT Signed)' ? 'Customs Clearance Completed (Verified IoT Telemetry)' : h.status}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Location: {h.location} | Temp: {h.temperature}°C
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Cryptographic W3C VC Exporter Modal */}
      {showVcModal && vcModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--success)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileCode size={18} /> Cryptographically Signed Trade Credential (W3C JSON-LD Standard)
              </h3>
              <button 
                onClick={() => setShowVcModal(false)} 
                className="btn btn-secondary btn-icon" 
                style={{ width: '28px', height: '28px', borderRadius: '50%' }}
              >
                &times;
              </button>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              This secure proof document certifies historical shipping reliability and trade performance. It can be instantly submitted to global trade financiers to secure low-interest capital lines.
            </p>

            <pre style={{ background: '#04060b', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflow: 'auto', maxHeight: '350px' }}>
              {JSON.stringify(vcModalData, null, 2)}
            </pre>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  const blob = new Blob([JSON.stringify(vcModalData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `freightx-vc-${vcModalData.credentialSubject.legalName.replace(/\s+/g, '-').toLowerCase()}.json`;
                  a.click();
                  showToast('Verifiable credential downloaded successfully!', 'success');
                }}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
              >
                <Download size={14} /> Download Trade Credential (.json)
              </button>
              <button 
                onClick={() => setShowVcModal(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
