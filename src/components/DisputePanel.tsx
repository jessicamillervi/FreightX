import React, { useState, useEffect } from 'react';
import { getLocalDisputes, raiseDispute, submitArbitratorVote, getLocalArbitrators, type DisputeInfo } from '@/lib/dispute';
import { getAppMode, getOrCreateSandboxWallet, getLocalShipments, type ShipmentData } from '@/services/sandbox';

interface DisputePanelProps {
  currentAddress?: string;
  onRefreshShipments?: () => void;
}

export const DisputePanel: React.FC<DisputePanelProps> = ({ currentAddress, onRefreshShipments }) => {
  const [disputes, setDisputes] = useState<DisputeInfo[]>([]);
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | ''>('');
  const [evidenceHash, setEvidenceHash] = useState('');
  const [proposedSupplier, setProposedSupplier] = useState('');
  const [proposedCarrier, setProposedCarrier] = useState('');
  const [violationsReason, setViolationsReason] = useState('');
  
  // Voting states
  const [voteSupplier, setVoteSupplier] = useState<Record<number, string>>({});
  const [voteCarrier, setVoteCarrier] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const mode = getAppMode();
  const wallet = getOrCreateSandboxWallet();
  const effectiveAddress = currentAddress || wallet.address;

  useEffect(() => {
    setDisputes(getLocalDisputes());
    setShipments(getLocalShipments());
    
    // Periodically sync dispute status from backend
    const interval = setInterval(() => {
      fetch('/api/disputes')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.disputes) {
            setDisputes(data.disputes);
          }
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    setDisputes(getLocalDisputes());
    setShipments(getLocalShipments());
    if (onRefreshShipments) onRefreshShipments();
  };

  const handleRaiseDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedShipmentId === '') return;
    
    setLoading(true);
    setMessage(null);
    try {
      const s = shipments.find(item => item.id === Number(selectedShipmentId));
      if (!s) throw new Error('Shipment not found');

      const supplierVal = parseFloat(proposedSupplier);
      const carrierVal = parseFloat(proposedCarrier);
      if (isNaN(supplierVal) || isNaN(carrierVal)) {
        throw new Error('Please enter valid numerical proposed payouts');
      }

      if (supplierVal + carrierVal > s.cargoValue + s.shippingFee) {
        throw new Error('Proposed payouts exceed total escrow amount');
      }

      const compositeEvidence = JSON.stringify({
        cid: evidenceHash,
        reason: violationsReason,
        timestamp: Date.now()
      });

      await raiseDispute(effectiveAddress, s.id, compositeEvidence, supplierVal, carrierVal, mode);
      setMessage({ text: 'Dispute filed successfully! Escrow settlement is now locked.', type: 'success' });
      
      // Reset form
      setSelectedShipmentId('');
      setEvidenceHash('');
      setProposedSupplier('');
      setProposedCarrier('');
      setViolationsReason('');
      
      refreshData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to file dispute', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCastVote = async (disputeId: number) => {
    setLoading(true);
    setMessage(null);
    try {
      const sVal = parseFloat(voteSupplier[disputeId]);
      const cVal = parseFloat(voteCarrier[disputeId]);

      if (isNaN(sVal) || isNaN(cVal)) {
        throw new Error('Please enter valid numerical agreed payouts to vote');
      }

      await submitArbitratorVote(effectiveAddress, disputeId, sVal, cVal, mode);
      setMessage({ text: 'Your vote was successfully cast!', type: 'success' });
      refreshData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to submit vote', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const arbitrators = getLocalArbitrators();
  const isArbitrator = arbitrators.some(
    a => a.address.toLowerCase() === effectiveAddress.toLowerCase()
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* File Dispute Form */}
      <div className="glass-panel">
        <div className="absolute top-0 left-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2 font-display">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          File Multi-Sig Dispute
        </h2>
        <p className="text-[var(--text-secondary)] text-xs mb-4">
          Lock escrow payout execution and trigger arbitrator intervention for damaged or delayed cargo.
        </p>

        <form onSubmit={handleRaiseDispute} className="space-y-4">
          <div>
            <label className="block text-[var(--text-secondary)] text-xs font-semibold mb-1">Target Shipment</label>
            <select
              value={selectedShipmentId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedShipmentId(val === '' ? '' : Number(val));
                if (val !== '') {
                  const s = shipments.find(item => item.id === Number(val));
                  if (s) {
                    setProposedSupplier(s.cargoValue.toString());
                    setProposedCarrier(s.shippingFee.toString());
                  }
                }
              }}
              required
              className="form-select border-[var(--border)] focus:border-red-550/45 focus:ring-1 focus:ring-red-550/45"
            >
              <option value="">Select Shipment...</option>
              {shipments
                .filter(s => s.status !== 'Completed' && s.status !== 'Cancelled')
                .map(s => (
                  <option key={s.id} value={s.id}>
                    Shipment #{s.id} (Value: {s.cargoValue} USDC / status: {s.status})
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold mb-1">Proposed Supplier Payout</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 800"
                value={proposedSupplier}
                onChange={(e) => setProposedSupplier(e.target.value)}
                required
                className="form-input border-[var(--border)] focus:border-red-550/45 focus:ring-1 focus:ring-red-550/45"
              />
            </div>
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold mb-1">Proposed Carrier Payout</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 50"
                value={proposedCarrier}
                onChange={(e) => setProposedCarrier(e.target.value)}
                required
                className="form-input border-[var(--border)] focus:border-red-550/45 focus:ring-1 focus:ring-red-550/45"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] text-xs font-semibold mb-1">Evidence IPFS Document Hash</label>
            <input
              type="text"
              placeholder="e.g. QmTemperatureViolationVerificationHash"
              value={evidenceHash}
              onChange={(e) => setEvidenceHash(e.target.value)}
              required
              className="form-input font-mono border-[var(--border)] focus:border-red-550/45 focus:ring-1 focus:ring-red-550/45"
            />
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] text-xs font-semibold mb-1">Dispute Reason / IoT Log References</label>
            <textarea
              placeholder="Provide context regarding damaged cargo, temperature logs or compliance failures..."
              value={violationsReason}
              onChange={(e) => setViolationsReason(e.target.value)}
              required
              rows={3}
              className="form-input resize-none border-[var(--border)] focus:border-red-550/45 focus:ring-1 focus:ring-red-550/45"
            />
          </div>

          <button
            type="submit"
            disabled={loading || selectedShipmentId === ''}
            className="btn btn-secondary text-red-650 border-red-200 hover:bg-red-50/50 w-full"
          >
            {loading ? 'Filing...' : 'Lock Escrow & Open Dispute'}
          </button>
        </form>
      </div>

      {/* Disputes Resolution Queue */}
      <div className="lg:col-span-2 glass-panel">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2 font-display">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Disputes Arbitration Docket
        </h2>
        <p className="text-[var(--text-secondary)] text-xs mb-6">
          Multi-sig dispute arbitration panel. Required: 3-of-5 concordant votes to resolve and execute payout.
        </p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg text-xs border ${
            message.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {disputes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] text-xs">
              No active disputes in docket queue. Escrows proceeding normally.
            </div>
          ) : (
            disputes.map((d) => {
              let parsedEvidence = { cid: d.evidenceHash, reason: '' };
              try {
                parsedEvidence = JSON.parse(d.evidenceHash);
              } catch {
                // Not JSON, fallback
              }

              // Calculate consensus stats
              const outcomes: Record<string, number> = {};
              Object.values(d.votes).forEach(v => {
                const key = `${v.supplierPayout}-${v.carrierPayout}`;
                outcomes[key] = (outcomes[key] || 0) + 1;
              });

              return (
                <div key={d.id} className="border border-[var(--border)] rounded-xl bg-[var(--bg-main)] p-5 relative">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)] font-display">Dispute #{d.id}</span>
                        <span className="text-[var(--text-secondary)] text-xs font-medium">• Shipment #{d.shipmentId}</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">Claimant: {d.claimant}</p>
                    </div>
                    
                    <span className={`px-2.5 py-1 rounded text-[10px] font-semibold ${
                      d.resolved 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                    }`}>
                      {d.resolved ? 'RESOLVED' : 'ACTIVE DISPUTE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3">
                      <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Claimant Proposal</span>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 font-semibold text-[var(--text-primary)]">
                        <div>Supplier: {d.proposedSupplierPayout} USDC</div>
                        <div>Carrier: {d.proposedCarrierPayout} USDC</div>
                      </div>
                    </div>

                    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3">
                      <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Consensus Verdict</span>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 font-semibold text-[var(--text-primary)]">
                        {d.resolved ? (
                          <>
                            <div className="text-emerald-600">Supplier: {d.verdictSupplierPayout} USDC</div>
                            <div className="text-emerald-600">Carrier: {d.verdictCarrierPayout} USDC</div>
                          </>
                        ) : (
                          <div className="col-span-2 text-[var(--text-muted)] italic">Awaiting voting quorum...</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 text-xs bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 text-[var(--text-primary)]">
                    <div className="text-[var(--text-muted)] text-[10px] uppercase font-semibold mb-1">Evidence Records</div>
                    <div className="font-semibold text-[var(--text-primary)] font-mono break-all text-[11px] mb-1.5">
                      CID: <a href={`/api/documents?cid=${parsedEvidence.cid}`} target="_blank" rel="noreferrer" className="text-teal-600 underline">{parsedEvidence.cid}</a>
                    </div>
                    {parsedEvidence.reason && <p className="italic text-[var(--text-secondary)] text-xs">Reason: "{parsedEvidence.reason}"</p>}
                  </div>

                  {/* Voters block */}
                  <div className="mb-4">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-2">Quorum Status ({d.voteCount}/5 Votes cast)</span>
                    {Object.keys(d.votes).length === 0 ? (
                      <p className="text-[var(--text-muted)] text-xs italic">No arbitrator votes cast yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(d.votes).map(([voter, v], i) => (
                          <span key={i} className="px-2.5 py-1 bg-[var(--bg-hover)] border border-[var(--border)] rounded-lg text-[10px] text-[var(--text-secondary)] font-mono">
                            {voter.slice(0, 6)}...{voter.slice(-4)}: (S: {v.supplierPayout} | C: {v.carrierPayout})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Arbitrator Voting Inputs */}
                  {!d.resolved && (
                    <div className="border-t border-[var(--border)] pt-4 mt-2">
                      {isArbitrator ? (
                        <div>
                          <span className="text-[var(--text-primary)] text-xs font-semibold block mb-2">Submit Arbitrator Verdict Decision</span>
                          <div className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1">
                              <label className="block text-[var(--text-muted)] text-[10px] mb-1">Agreed Supplier Payout</label>
                              <input
                                type="number"
                                placeholder="Supplier"
                                value={voteSupplier[d.id] || ''}
                                onChange={(e) => setVoteSupplier({ ...voteSupplier, [d.id]: e.target.value })}
                                className="form-input"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[var(--text-muted)] text-[10px] mb-1">Agreed Carrier Payout</label>
                              <input
                                type="number"
                                placeholder="Carrier"
                                value={voteCarrier[d.id] || ''}
                                onChange={(e) => setVoteCarrier({ ...voteCarrier, [d.id]: e.target.value })}
                                className="form-input"
                              />
                            </div>
                            <button
                              onClick={() => handleCastVote(d.id)}
                              className="btn btn-primary bg-amber-600 hover:bg-amber-700 border-amber-600 text-white px-5"
                            >
                              Cast Multi-Sig Vote
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[var(--text-muted)] text-xs italic">Only registered arbitrators can vote to resolve disputes.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
