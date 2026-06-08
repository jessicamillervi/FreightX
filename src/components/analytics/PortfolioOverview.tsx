import React from 'react';
import { Landmark, Activity, Coins, TrendingUp } from 'lucide-react';

interface PortfolioOverviewProps {
  data: {
    totalEscrowValue: number;
    activeShipments: number;
    yieldEarned: number;
    revenue: number;
  };
}

export const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({ data }) => {
  const formatUSDC = (val: number) => {
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDC';
  };

  const cards = [
    {
      title: 'Total Escrow Value Secured',
      value: formatUSDC(data.totalEscrowValue),
      sub: 'Active logistics escrow collateral',
      icon: <Landmark className="w-5 h-5 text-teal-400" />,
      glowColor: 'bg-teal-500/10',
      borderColor: 'border-teal-500/20',
      percentChange: '+14.2% MoM'
    },
    {
      title: 'Active Cargo Shipments',
      value: data.activeShipments.toString(),
      sub: 'Containers currently in transit',
      icon: <Activity className="w-5 h-5 text-sky-400" />,
      glowColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/20',
      percentChange: 'Live telematics tracking'
    },
    {
      title: 'Realized Yield Earned',
      value: formatUSDC(data.yieldEarned),
      sub: 'USYC wrapped liquidity yield',
      icon: <Coins className="w-5 h-5 text-emerald-400" />,
      glowColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      percentChange: '5.25% average APY'
    },
    {
      title: 'Platform System Revenue',
      value: formatUSDC(data.revenue),
      sub: 'Flat PO fees & dispute penalties',
      icon: <TrendingUp className="w-5 h-5 text-amber-400" />,
      glowColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      percentChange: '+8.7% MoM'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`bg-slate-900/60 backdrop-blur-md border ${card.borderColor} rounded-xl p-5 relative overflow-hidden shadow-lg transition-transform hover:-translate-y-0.5 duration-200`}
        >
          {/* Subtle Background Glow */}
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${card.glowColor} -z-10`} />

          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{card.title}</span>
            <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800/80">
              {card.icon}
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">{card.value}</h3>
            <p className="text-slate-400 text-[11px]">{card.sub}</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 flex justify-between items-center text-[10px]">
            <span className="text-emerald-400 font-semibold">{card.percentChange}</span>
            <span className="text-slate-500">Updated just now</span>
          </div>
        </div>
      ))}
    </div>
  );
};
