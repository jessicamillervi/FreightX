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
    <div className="glass-panel">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2 font-display">
        <AlertTriangle className="w-5 h-5 text-[var(--danger)] animate-pulse" />
        Vessel Route Risk & Compliance Heatmap
      </h3>
      <p className="text-[var(--text-secondary)] text-xs mb-6">
        Real-time monitoring of thermal excursions, port demurrage delays, and consensus dispute metrics.
      </p>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--bg-main)] border border-[var(--border)] p-4 rounded-lg">
          <div className="text-[var(--text-secondary)] text-xs mb-1 font-medium">Temperature Violation Rate</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600">{data.temperatureViolationsRate}%</span>
            <span className="text-[10px] text-[var(--text-muted)]">Max limit: 8.0°C</span>
          </div>
          <div className="w-full bg-[var(--bg-hover)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, data.temperatureViolationsRate * 10)}%` }} />
          </div>
        </div>

        <div className="bg-[var(--bg-main)] border border-[var(--border)] p-4 rounded-lg">
          <div className="text-[var(--text-secondary)] text-xs mb-1 font-medium">Active Demurrage Exposure</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{data.demurrageExposureCount} shipments</span>
            <span className="text-[10px] text-[var(--text-muted)]">past free-time limits</span>
          </div>
          <div className="w-full bg-[var(--bg-hover)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, data.demurrageExposureCount * 25)}%` }} />
          </div>
        </div>

        <div className="bg-[var(--bg-main)] border border-[var(--border)] p-4 rounded-lg">
          <div className="text-[var(--text-secondary)] text-xs mb-1 font-medium">Escrow Dispute Rate</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-600">{data.disputeRate}%</span>
            <span className="text-[10px] text-[var(--text-muted)]">Consensus arbitration</span>
          </div>
          <div className="w-full bg-[var(--bg-hover)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, data.disputeRate * 10)}%` }} />
          </div>
        </div>
      </div>

      {/* Heatmap Visual Matrix */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-3">Thermal breaches by destination port</h4>
        {data.violationsHeat.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] rounded-lg p-6 text-center text-[var(--text-muted)] text-xs flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600/80 opacity-70" />
            No active thermal breaches logged across active voyages. All systems nominal.
          </div>
        ) : (
          <div className="space-y-3">
            {data.violationsHeat.map((v, i) => (
              <div key={i} className="flex items-center gap-3 bg-[var(--bg-hover)] p-3 rounded-lg border border-[var(--border)]">
                <Thermometer className="w-4 h-4 text-[var(--danger)]" />
                <div className="flex-1">
                  <div className="text-xs text-[var(--text-primary)] font-semibold">{v.port}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Breaches: {v.count} occurrences logged</div>
                </div>
                <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold">
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
