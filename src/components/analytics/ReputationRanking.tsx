import React from 'react';
import { Award, ShieldCheck, ArrowUpRight } from 'lucide-react';

interface CounterpartyReputation {
  name: string;
  role: string;
  score: number;
  address: string;
  completedShipments: number;
}

interface ReputationRankingProps {
  data: CounterpartyReputation[];
}

export const ReputationRanking: React.FC<ReputationRankingProps> = ({ data }) => {
  return (
    <div className="glass-panel">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2 font-display">
        <Award className="w-5 h-5 text-emerald-600" />
        Trading Counterparty Reputation Leaderboard
      </h3>
      <p className="text-[var(--text-secondary)] text-xs mb-6">
        Automated trade reliability index computed directly from shipment history and smart contract consensus records.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[var(--text-primary)]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
              <th className="py-3 font-semibold">Counterparty</th>
              <th className="py-3 font-semibold">Trading Role</th>
              <th className="py-3 font-semibold text-right">Escrows Completed</th>
              <th className="py-3 font-semibold text-right">Reputation Score</th>
              <th className="py-3 font-semibold text-center">Identity Verification</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-[var(--text-muted)] italic">
                  No counterparty ratings compiled yet.
                </td>
              </tr>
            ) : (
              data.map((c, index) => {
                const getRatingBadge = (score: number) => {
                  if (score >= 95) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  if (score >= 88) return 'bg-teal-50 text-teal-700 border border-teal-200';
                  return 'bg-blue-50 text-blue-700 border border-blue-200';
                };

                return (
                  <tr key={index} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="py-3">
                      <div>
                        <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                          {c.name}
                          <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" />
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">{c.address}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        c.role === 'Supplier' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : c.role === 'Buyer' 
                          ? 'bg-sky-50 text-sky-700 border border-sky-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {c.role}
                      </span>
                    </td>
                    <td className="py-3 text-right font-semibold text-[var(--text-primary)]">
                      {c.completedShipments}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRatingBadge(c.score)}`}>
                        {c.score}/100
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" />
                        ERC-8004 DID
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
