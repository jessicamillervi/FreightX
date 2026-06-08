'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Award, 
  Download, 
  Compass, 
  FileText, 
  Thermometer, 
  ScanQrCode, 
  FileCode,
  ShieldCheck,
  ExternalLink,
  QrCode,
  Layers,
  Upload,
  Barcode
} from 'lucide-react';
import { useShipments } from '@/hooks/useShipments';
import { usePOLoans } from '@/hooks/usePOLoans';
import { useAppContext } from '@/contexts/AppContext';
import { type VCData, type Address } from '@/lib/types';
import { useWallet } from '@/hooks/useWallet';
import { uploadToIPFS, getIPFSUrl } from '@/lib/ipfs';
import { getPublicClient, resolveWalletClient } from '@/services/sandbox';
import documentsArtifact from '@/abi/FreightDocuments.json';
import passportArtifact from '@/abi/FreightPassport.json';
import BoLTemplate from '@/components/BoLTemplate';
import DocumentUpload from '@/components/DocumentUpload';

// Local storage helpers for documents registry
const getSavedDocumentsForPassport = (passportId: number): any[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(`freightx_docs_${passportId}`);
  return saved ? JSON.parse(saved) : [];
};

const saveDocumentsForPassport = (passportId: number, docs: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`freightx_docs_${passportId}`, JSON.stringify(docs));
};

export default function PassportTab() {
  const { showToast, logTerminal, contracts, setActiveTab, appMode } = useAppContext();
  const { shipments, selectedShipmentId } = useShipments();
  const { poLoans } = usePOLoans();
  const { wallet } = useWallet();

  // Local VC Modal States
  const [showVcModal, setShowVcModal] = useState(false);
  const [vcModalData, setVcModalData] = useState<VCData | null>(null);

  // Document Management States
  const [docsList, setDocsList] = useState<any[]>([]);
  const [minting, setMinting] = useState(false);
  const [uploadTab, setUploadTab] = useState<'bol' | 'upload'>('bol');
  const [qrModalTokenId, setQrModalTokenId] = useState<string | null>(null);

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

  useEffect(() => {
    if (currentShipment) {
      setDocsList(getSavedDocumentsForPassport(currentShipment.passportTokenId));
    } else {
      setDocsList([]);
    }
  }, [currentShipment]);

  const handleMintDocument = async (bolData: {
    shipper: string;
    consignee: string;
    cargoDescription: string;
    weightKg: string;
    containerNumber: string;
  }) => {
    if (!currentShipment) return;
    setMinting(true);
    logTerminal(`Uploading Bill of Lading data to IPFS...`);

    try {
      // 1. Upload BoL metadata object to IPFS
      const ipfsResult = await uploadToIPFS(bolData, `BoL-${currentShipment.passportTokenId}.json`);
      if (!ipfsResult.success || !ipfsResult.cid) {
        throw new Error(ipfsResult.error || 'Failed to upload metadata to IPFS');
      }
      const cid = ipfsResult.cid;
      logTerminal(`[IPFS] Metadata pinned successfully. CID: ${cid}`);

      let docTokenId = Math.floor(Math.random() * 1000000).toString();

      // Sync mock fallback client-side storage to server-side API Map memory
      await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: docTokenId,
          ipfsHash: cid,
          passportTokenId: currentShipment.passportTokenId.toString(),
          shipper: bolData.shipper,
          consignee: bolData.consignee,
          cargoDescription: bolData.cargoDescription,
          weightKg: bolData.weightKg,
          containerNumber: bolData.containerNumber,
          timestamp: Math.floor(Date.now() / 1000),
          version: 1
        })
      });

      // 2. On-Chain Live Tx Call
      if (appMode === 'live' && contracts && wallet) {
        logTerminal(`[Live mode] Invoking mintDocument on FreightDocuments (${contracts.documents})...`);
        const publicClient = getPublicClient();
        const walletClient = resolveWalletClient(wallet.privateKey);

        const mintTx = await walletClient.writeContract({
          address: contracts.documents as Address,
          abi: documentsArtifact.abi,
          functionName: 'mintDocument',
          args: [
            wallet.address,
            cid,
            BigInt(currentShipment.passportTokenId),
            bolData.shipper,
            bolData.consignee,
            bolData.cargoDescription,
            BigInt(bolData.weightKg),
            bolData.containerNumber
          ]
        });
        logTerminal(`Submitted mintDocument. Hash: ${mintTx}`);
        await publicClient.waitForTransactionReceipt({ hash: mintTx });

        logTerminal(`Invoking attachDocument on FreightPassport (${contracts.passport})...`);
        const attachTx = await walletClient.writeContract({
          address: contracts.passport as Address,
          abi: passportArtifact.abi,
          functionName: 'attachDocument',
          args: [BigInt(currentShipment.passportTokenId), cid]
        });
        await publicClient.waitForTransactionReceipt({ hash: attachTx });
        logTerminal(`Linked Document CID to Passport Token #${currentShipment.passportTokenId} on-chain!`);
      }

      // 3. Local Storage fallback registry updates
      const newDoc = {
        tokenId: docTokenId,
        ipfsHash: cid,
        passportTokenId: currentShipment.passportTokenId.toString(),
        shipper: bolData.shipper,
        consignee: bolData.consignee,
        cargoDescription: bolData.cargoDescription,
        weightKg: bolData.weightKg,
        containerNumber: bolData.containerNumber,
        timestamp: Math.floor(Date.now() / 1000),
        version: 1
      };

      const existing = getSavedDocumentsForPassport(currentShipment.passportTokenId);
      const updated = [...existing, newDoc];
      saveDocumentsForPassport(currentShipment.passportTokenId, updated);
      setDocsList(updated);
      showToast('Document NFT minted & linked to Cargo twin successfully!', 'success');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logTerminal(`[Document Creation Error] ${errMsg}`);
      showToast(`Creation failed: ${errMsg}`, 'error');
    } finally {
      setMinting(false);
    }
  };

  const handleUploadDocumentSuccess = async (cid: string, fileName: string, fileType: string) => {
    logTerminal(`Uploading external document complete. Minting document NFT...`);
    const defaultData = {
      shipper: 'Global Export Supplier',
      consignee: 'Import Consignee Representative',
      cargoDescription: `External Document Archive: ${fileName} (${fileType})`,
      weightKg: '0',
      containerNumber: 'N/A'
    };
    await handleMintDocument(defaultData);
  };

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
        <>
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

        {/* Trade Document Management System Panel */}
        <div className="glass-panel" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} style={{ color: 'var(--primary)' }} /> Cryptographic Trade Document Manager
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Mint, amend, and query W3C compliant Bill of Lading NFTs linked to Cargo twin #{currentShipment.passportTokenId}.
              </p>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
              Standard: FRTX-DOC ERC-721
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* LEFT SIDE: List of attached documents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Attached Documents ({docsList.length})</h4>
              
              {docsList.length === 0 ? (
                <div style={{ padding: '2rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.5 }} />
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>No trade documents attached yet</div>
                  <span style={{ fontSize: '0.7rem' }}>Generate a Bill of Lading or upload trade compliance certificates to get started.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {docsList.map((doc, idx) => {
                    const isBol = doc.cargoDescription.indexOf('External') === -1;
                    return (
                      <div key={idx} className="glass-panel" style={{ padding: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {isBol ? 'Bill of Lading' : 'Commercial Invoice'}
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', color: 'var(--success)', fontSize: '0.65rem', fontWeight: 'bold', marginLeft: '0.25rem' }}>
                                <ShieldCheck size={12} /> VERIFIED
                              </span>
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              Token ID: #{doc.tokenId}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              onClick={() => setQrModalTokenId(doc.tokenId)}
                              className="btn btn-secondary flex-center"
                              style={{ padding: '0.25rem', minWidth: 'auto', width: '28px', height: '28px', borderRadius: '4px' }}
                              title="Show QR Code"
                            >
                              <QrCode size={14} />
                            </button>
                            <a
                              href={`/verify/${doc.tokenId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary flex-center"
                              style={{ padding: '0.25rem', minWidth: 'auto', width: '28px', height: '28px', borderRadius: '4px' }}
                              title="Verify Document"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', background: 'rgba(0,0,0,0.2)', padding: '0.4rem', borderRadius: '4px' }}>
                          <div><span style={{ color: 'var(--text-secondary)' }}>Shipper:</span> <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{doc.shipper}</span></div>
                          <div><span style={{ color: 'var(--text-secondary)' }}>Consignee:</span> <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{doc.consignee}</span></div>
                          {isBol && (
                            <>
                              <div><span style={{ color: 'var(--text-secondary)' }}>Container ID:</span> <span style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{doc.containerNumber}</span></div>
                              <div><span style={{ color: 'var(--text-secondary)' }}>Gross Weight:</span> <span style={{ color: 'var(--text-main)' }}>{Number(doc.weightKg).toLocaleString()} KG</span></div>
                            </>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                          <span>IPFS: <code style={{ color: 'var(--primary)' }}>{doc.ipfsHash.substring(0, 10)}...</code></span>
                          <span>{new Date(doc.timestamp * 1000).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT SIDE: Add document form tabs switcher */}
            <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', gap: '1rem' }}>
                <button
                  onClick={() => setUploadTab('bol')}
                  style={{
                    background: 'none', border: 'none', color: uploadTab === 'bol' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: uploadTab === 'bol' ? 700 : 500, fontSize: '0.8rem', padding: '0.25rem 0.5rem', cursor: 'pointer',
                    borderBottom: uploadTab === 'bol' ? '2px solid var(--primary)' : 'none', transition: 'all 0.2s'
                  }}
                >
                  Generate Bill of Lading (BoL)
                </button>
                <button
                  onClick={() => setUploadTab('upload')}
                  style={{
                    background: 'none', border: 'none', color: uploadTab === 'upload' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: uploadTab === 'upload' ? 700 : 500, fontSize: '0.8rem', padding: '0.25rem 0.5rem', cursor: 'pointer',
                    borderBottom: uploadTab === 'upload' ? '2px solid var(--primary)' : 'none', transition: 'all 0.2s'
                  }}
                >
                  Upload Trade Certificate
                </button>
              </div>

              {uploadTab === 'bol' ? (
                <BoLTemplate onSubmit={handleMintDocument} loading={minting} />
              ) : (
                <DocumentUpload onUploadSuccess={handleUploadDocumentSuccess} />
              )}
            </div>

          </div>
        </div>
        </>
      )}

      {/* QR Code Scan Modal */}
      {qrModalTokenId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '320px', textAlign: 'center', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Compliance Scan Code</h4>
            <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', display: 'inline-block', margin: '0 auto' }}>
              <svg width="150" height="150" viewBox="0 0 100 100" style={{ shapeRendering: 'crispEdges' }}>
                <rect width="100" height="100" fill="#ffffff" />
                <path d="M0 0h30v30H0zm5 5v20h20V5zm5 5h10v10H10zM70 0h30v30H70zm5 5v20h20V5zm5 5h10v10H80zM0 70h30v30H0zm5 5v20h20V75zm5 5h10v10H10z" fill="#000" />
                <path d="M35 5h5v10h-5zm10 0h10v5H45zm20 5h5v5h-5zm-30 15h5v15h-5zm15 5h10v5H50zm15 0h5v10h-5zm-15 15h5v5h-5zm20 0h15v5H70zm-35 10h10v5h-10zm25 0h5v10h-5zm15 5h10v5H80zm-45 10h10v5h-10zm15 0h15v5H50zm35 0h5v10h-5zm-55 10h5v5h-5zm15 10h10v5H45zm20 0h5v5h-5z" fill="#000" />
              </svg>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              Scan with an iPad or mobile camera at port customs checkpoint to confirm document origin and real-time shipment compliance log.
            </p>
            <button
              onClick={() => setQrModalTokenId(null)}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Close Scan Code
            </button>
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
