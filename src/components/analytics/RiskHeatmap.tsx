import React from 'react';
import { AlertTriangle, ShieldCheck, Thermometer } from 'lucide-react';

interface HeatmapData {
  temperatureViolationsRate: number;
  demurrageExposureCount: number;
  disputeRate: number;
  violationsHeat: Array<{ port: string; count: number }>;
}

interface RiskHeatmapProps {
  data: HeatmapData;
}

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ data }) => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 font-display">
        <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
        Vessel Route Risk & Compliance Heatmap
      </h3>
      <p className="text-slate-400 text-xs mb-6">
        Real-time monitoring of thermal excursions, port demurrage delays, and consensus dispute metrics.
      </p>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-lg">
          <div className="text-slate-400 text-xs mb-1 font-medium">Temperature Violation Rate</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-400">{data.temperatureViolationsRate}%</span>
            <span className="text-[10px] text-slate-500">Max limit: 8.0°C</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, data.temperatureViolationsRate * 10)}%` }} />
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-lg">
          <div className="text-slate-400 text-xs mb-1 font-medium">Active Demurrage Exposure</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{data.demurrageExposureCount} shipments</span>
            <span className="text-[10px] text-slate-500">past free-time limits</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, data.demurrageExposureCount * 25)}%` }} />
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-lg">
          <div className="text-slate-400 text-xs mb-1 font-medium">Escrow Dispute Rate</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-400">{data.disputeRate}%</span>
            <span className="text-[10px] text-slate-500">Consensus arbitration</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, data.disputeRate * 10)}%` }} />
          </div>
        </div>
      </div>

      {/* Heatmap Visual Matrix */}
      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Thermal breaches by destination port</h4>
        {data.violationsHeat.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400/80 opacity-70" />
            No active thermal breaches logged across active voyages. All systems nominal.
          </div>
        ) : (
          <div className="space-y-3">
            {data.violationsHeat.map((v, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                <Thermometer className="w-4 h-4 text-red-400" />
                <div className="flex-1">
                  <div className="text-xs text-white font-semibold">{v.port}</div>
                  <div className="text-[10px] text-slate-500">Breaches: {v.count} occurrences logged</div>
                </div>
                <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-900 rounded text-[10px] font-bold">
                  High Risk
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
