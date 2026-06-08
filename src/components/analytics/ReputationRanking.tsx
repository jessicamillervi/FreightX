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
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 font-display">
        <Award className="w-5 h-5 text-emerald-400" />
        Trading Counterparty Reputation Leaderboard
      </h3>
      <p className="text-slate-400 text-xs mb-6">
        Automated trade reliability index computed directly from shipment history and smart contract consensus records.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-350">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
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
                <td colSpan={5} className="text-center py-8 text-slate-500 italic">
                  No counterparty ratings compiled yet.
                </td>
              </tr>
            ) : (
              data.map((c, index) => {
                const getRatingBadge = (score: number) => {
                  if (score >= 95) return 'bg-emerald-950 text-emerald-400 border border-emerald-900';
                  if (score >= 88) return 'bg-teal-950 text-teal-400 border border-teal-900';
                  return 'bg-blue-950 text-blue-400 border border-blue-900';
                };

                return (
                  <tr key={index} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {c.name}
                          <ArrowUpRight className="w-3 h-3 text-slate-500 hover:text-white cursor-pointer" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{c.address}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        c.role === 'Supplier' 
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/40' 
                          : c.role === 'Buyer' 
                          ? 'bg-sky-950/80 text-sky-400 border border-sky-900/40' 
                          : 'bg-amber-950/80 text-amber-400 border border-amber-900/40'
                      }`}>
                        {c.role}
                      </span>
                    </td>
                    <td className="py-3 text-right font-semibold text-white">
                      {c.completedShipments}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRatingBadge(c.score)}`}>
                        {c.score}/100
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/30 text-emerald-400 rounded-lg text-[9px] border border-emerald-900/30">
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
