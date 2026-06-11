import React from 'react';
import { Coins, TrendingUp } from 'lucide-react';

interface TradeFinanceChartProps {
  data: {
    poUtilizationRate: number;
    totalFactoringVolume: number;
    poolApy: number;
    loansOverTime: Array<{ month: string; amount: number }>;
  };
}

export const TradeFinanceChart: React.FC<TradeFinanceChartProps> = ({ data }) => {
  // SVG Chart Dimensions & Computations
  const chartWidth = 500;
  const chartHeight = 150;
  const padding = 20;

  const maxAmount = Math.max(...data.loansOverTime.map(d => d.amount), 50000);
  const points = data.loansOverTime.map((d, index) => {
    const x = padding + (index * (chartWidth - padding * 2)) / (data.loansOverTime.length - 1);
    const y = chartHeight - padding - (d.amount / maxAmount) * (chartHeight - padding * 2);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, index) => {
    return index === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = points.reduce((acc, p, index) => {
    if (index === 0) {
      return `M ${p.x} ${chartHeight - padding} L ${p.x} ${p.y}`;
    }
    if (index === points.length - 1) {
      return `${acc} L ${p.x} ${p.y} L ${p.x} ${chartHeight - padding} Z`;
    }
    return `${acc} L ${p.x} ${p.y}`;
  }, '');

  return (
    <div className="glass-panel">
      {/* Glow background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-[var(--border)]">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2 font-display">
            <Coins className="w-5 h-5 text-teal-600" />
            PO Financing & Invoice Factoring Pools
          </h3>
          <p className="text-[var(--text-secondary)] text-xs mt-1">
            Supplier pre-shipment working capital, APY yields, and monthly transaction volumes.
          </p>
        </div>
        <div className="mt-4 md:mt-0 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-1.5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--success)]" />
          <span className="text-[var(--text-muted)] text-[10px] uppercase font-semibold">Vault APY:</span>
          <span className="text-[var(--success)] text-xs font-bold">{data.poolApy.toFixed(2)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Metric 1 */}
        <div className="bg-[var(--bg-main)] border border-[var(--border)] p-4 rounded-lg">
          <div className="text-[var(--text-muted)] text-[10px] uppercase font-semibold mb-1">PO Funding Rate</div>
          <div className="text-xl font-bold text-[var(--text-primary)] font-display">{data.poUtilizationRate}%</div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-1">of PO requests successfully funded</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[var(--bg-main)] border border-[var(--border)] p-4 rounded-lg">
          <div className="text-[var(--text-muted)] text-[10px] uppercase font-semibold mb-1">Invoice Factoring Volume</div>
          <div className="text-xl font-bold text-[var(--text-primary)] font-display">
            {data.totalFactoringVolume.toLocaleString()} USDC
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-1">Total cargo value factoring active</div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[var(--bg-main)] border border-[var(--border)] p-4 rounded-lg">
          <div className="text-[var(--text-muted)] text-[10px] uppercase font-semibold mb-1">Yield Wrapped Pool</div>
          <div className="text-xl font-bold text-teal-600 font-display">Active</div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-1">USYC vault auto-reinvestments online</div>
        </div>
      </div>

      {/* SVG Financing Chart */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-4">Capital Disbursement Volume History (USDC)</h4>
        <div className="w-full overflow-hidden bg-[var(--bg-main)] rounded-xl p-4 border border-[var(--border)]">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto text-teal-600 overflow-visible"
          >
            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="var(--border)" strokeWidth={1} opacity="0.3" />
            <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="var(--border)" strokeWidth={1} opacity="0.3" />
            <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="var(--border)" strokeWidth={1} opacity="0.6" />

            {/* Filled Area */}
            {points.length > 1 && (
              <path
                d={areaD}
                fill="url(#chart-gradient)"
                className="opacity-20"
              />
            )}

            {/* Line */}
            {points.length > 1 && (
              <path
                d={pathD}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="stroke-teal-650"
              />
            )}

            {/* Data Dots */}
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  className="fill-teal-600 stroke-[var(--bg-main)] stroke-2 cursor-pointer hover:r-6 transition-all"
                />
                <text
                  x={p.x}
                  y={p.y - 8}
                  textAnchor="middle"
                  className="fill-[var(--text-secondary)] text-[8px] font-mono"
                >
                  {(p.amount / 1000).toFixed(0)}k
                </text>
                <text
                  x={p.x}
                  y={chartHeight - 4}
                  textAnchor="middle"
                  className="fill-[var(--text-muted)] text-[8px] font-semibold"
                >
                  {p.month}
                </text>
              </g>
            ))}

            {/* Gradients */}
            <defs>
              <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(13, 148, 136)" />
                <stop offset="100%" stopColor="rgba(13, 148, 136, 0)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
};
