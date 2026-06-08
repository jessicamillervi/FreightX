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
      <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-display">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          File Multi-Sig Dispute
        </h2>
        <p className="text-slate-400 text-xs mb-4">
          Lock escrow payout execution and trigger arbitrator intervention for damaged or delayed cargo.
        </p>

        <form onSubmit={handleRaiseDispute} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Target Shipment</label>
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
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500/50 rounded-lg p-2.5 text-xs text-white outline-none transition-colors"
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
              <label className="block text-slate-400 text-xs font-semibold mb-1">Proposed Supplier Payout</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 800"
                value={proposedSupplier}
                onChange={(e) => setProposedSupplier(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500/50 rounded-lg p-2.5 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">Proposed Carrier Payout</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 50"
                value={proposedCarrier}
                onChange={(e) => setProposedCarrier(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500/50 rounded-lg p-2.5 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Evidence IPFS Document Hash</label>
            <input
              type="text"
              placeholder="e.g. QmTemperatureViolationVerificationHash"
              value={evidenceHash}
              onChange={(e) => setEvidenceHash(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500/50 rounded-lg p-2.5 text-xs text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1">Dispute Reason / IoT Log References</label>
            <textarea
              placeholder="Provide context regarding damaged cargo, temperature logs or compliance failures..."
              value={violationsReason}
              onChange={(e) => setViolationsReason(e.target.value)}
              required
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500/50 rounded-lg p-2.5 text-xs text-white outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || selectedShipmentId === ''}
            className="w-full py-2.5 bg-red-950/60 hover:bg-red-600 border border-red-900/50 hover:border-red-500 text-white rounded-lg text-xs font-semibold shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Filing...' : 'Lock Escrow & Open Dispute'}
          </button>
        </form>
      </div>

      {/* Disputes Resolution Queue */}
      <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2 font-display">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Disputes Arbitration Docket
        </h2>
        <p className="text-slate-400 text-xs mb-6">
          Multi-sig dispute arbitration panel. Required: 3-of-5 concordant votes to resolve and execute payout.
        </p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg text-xs border ${
            message.type === 'success' 
              ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400' 
              : 'bg-red-950/30 border-red-800 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {disputes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
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
                <div key={d.id} className="border border-slate-800 rounded-xl bg-slate-950/40 p-5 relative">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-display">Dispute #{d.id}</span>
                        <span className="text-slate-500 text-xs font-medium">• Shipment #{d.shipmentId}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Claimant: {d.claimant}</p>
                    </div>
                    
                    <span className={`px-2.5 py-1 rounded text-[10px] font-semibold ${
                      d.resolved 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' 
                        : 'bg-amber-950 text-amber-400 border border-amber-900 animate-pulse'
                    }`}>
                      {d.resolved ? 'RESOLVED' : 'ACTIVE DISPUTE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                    <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Claimant Proposal</span>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 font-semibold text-white">
                        <div>Supplier: {d.proposedSupplierPayout} USDC</div>
                        <div>Carrier: {d.proposedCarrierPayout} USDC</div>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Consensus Verdict</span>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 font-semibold text-white">
                        {d.resolved ? (
                          <>
                            <div className="text-emerald-400">Supplier: {d.verdictSupplierPayout} USDC</div>
                            <div className="text-emerald-400">Carrier: {d.verdictCarrierPayout} USDC</div>
                          </>
                        ) : (
                          <div className="col-span-2 text-slate-500 italic">Awaiting voting quorum...</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 text-xs bg-slate-900/30 border border-slate-800/40 rounded-lg p-3 text-slate-300">
                    <div className="text-slate-500 text-[10px] uppercase font-semibold mb-1">Evidence Records</div>
                    <div className="font-semibold text-white font-mono break-all text-[11px] mb-1.5">
                      CID: <a href={`/api/documents?cid=${parsedEvidence.cid}`} target="_blank" rel="noreferrer" className="text-teal-400 underline">{parsedEvidence.cid}</a>
                    </div>
                    {parsedEvidence.reason && <p className="italic text-slate-400 text-xs">Reason: "{parsedEvidence.reason}"</p>}
                  </div>

                  {/* Voters block */}
                  <div className="mb-4">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-2">Quorum Status ({d.voteCount}/5 Votes cast)</span>
                    {Object.keys(d.votes).length === 0 ? (
                      <p className="text-slate-600 text-xs italic">No arbitrator votes cast yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(d.votes).map(([voter, v], i) => (
                          <span key={i} className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-300 font-mono">
                            {voter.slice(0, 6)}...{voter.slice(-4)}: (S: {v.supplierPayout} | C: {v.carrierPayout})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Arbitrator Voting Inputs */}
                  {!d.resolved && (
                    <div className="border-t border-slate-800/80 pt-4 mt-2">
                      {isArbitrator ? (
                        <div>
                          <span className="text-slate-300 text-xs font-semibold block mb-2">Submit Arbitrator Verdict Decision</span>
                          <div className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1">
                              <label className="block text-slate-500 text-[10px] mb-1">Agreed Supplier Payout</label>
                              <input
                                type="number"
                                placeholder="Supplier"
                                value={voteSupplier[d.id] || ''}
                                onChange={(e) => setVoteSupplier({ ...voteSupplier, [d.id]: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-slate-500 text-[10px] mb-1">Agreed Carrier Payout</label>
                              <input
                                type="number"
                                placeholder="Carrier"
                                value={voteCarrier[d.id] || ''}
                                onChange={(e) => setVoteCarrier({ ...voteCarrier, [d.id]: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                              />
                            </div>
                            <button
                              onClick={() => handleCastVote(d.id)}
                              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-all duration-200"
                            >
                              Cast Multi-Sig Vote
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-xs italic">Only registered arbitrators can vote to resolve disputes.</p>
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
