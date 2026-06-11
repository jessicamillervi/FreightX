'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Database, 
  User, 
  RefreshCw, 
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Layers,
  Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { 
  PortfolioOverview, 
  RiskHeatmap, 
  TradeFinanceChart, 
  ReputationRanking 
} from '@/components';
import { getOrCreateSandboxWallet } from '@/services/sandbox';

export default function AnalyticsPage() {
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'buyer' | 'supplier' | 'carrier' | 'investor'>('admin');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // Sync wallet address
  useEffect(() => {
    const w = getOrCreateSandboxWallet();
    if (w?.address) {
      setAddress(w.address);
    }
  }, []);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?role=${role}&address=${address}`);
      const result = await res.json();
      if (res.ok && result.success) {
        setAnalyticsData(result.data);
      } else {
        setError(result.error || 'Failed to fetch analytics datasets.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during network query.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [role, address]);

  // Real-time updates simulation (WebSocket/Polling sync)
  useEffect(() => {
    if (!realtime) return;
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 8000);
    return () => clearInterval(interval);
  }, [realtime, role, address]);

  const handleExportCSV = (section: string) => {
    if (!analyticsData) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    if (section === 'portfolio') {
      csvContent += 'Metric,Value\n';
      csvContent += `Total Escrow Value Secured,${analyticsData.portfolio.totalEscrowValue}\n`;
      csvContent += `Active Shipments,${analyticsData.portfolio.activeShipments}\n`;
      csvContent += `Yield Earned,${analyticsData.portfolio.yieldEarned}\n`;
      csvContent += `System Revenue,${analyticsData.portfolio.revenue}\n`;
    } else if (section === 'risk') {
      csvContent += 'Metric,Value\n';
      csvContent += `Temperature Violations Rate,${analyticsData.risk.temperatureViolationsRate}%\n`;
      csvContent += `Demurrage Exposure Count,${analyticsData.risk.demurrageExposureCount}\n`;
      csvContent += `Dispute Rate,${analyticsData.risk.disputeRate}%\n`;
    } else if (section === 'tradeFinance') {
      csvContent += 'Metric,Value\n';
      csvContent += `PO Utilization Rate,${analyticsData.tradeFinance.poUtilizationRate}%\n`;
      csvContent += `Factoring Volume,${analyticsData.tradeFinance.totalFactoringVolume}\n`;
      csvContent += `Pool APY,${analyticsData.tradeFinance.poolApy.toFixed(2)}%\n`;
    } else {
      csvContent += 'Name,Role,Reputation Score,Address,Completed Shipments\n';
      analyticsData.reputation.forEach((r: any) => {
        csvContent += `"${r.name}",${r.role},${r.score},${r.address},${r.completedShipments}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `freightx_analytics_${section}_${role}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] p-4 sm:p-8 font-sans print:bg-white print:text-black">
      
      {/* Header Panel */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border)] pb-6 print:border-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/')}
            className="p-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Go back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 bg-[var(--primary-soft)] border border-[var(--primary-border)] rounded text-[var(--text-primary)] text-[10px] font-bold tracking-wider uppercase">Enterprise</span>
              <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight font-display">Analytics & Financial Intelligence</h1>
            </div>
            <p className="text-[var(--text-secondary)] text-xs mt-1">
              Live trade logs, risk heatmaps, yield rates, and counterparty scorecard indicators.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time status */}
          <button
            onClick={() => setRealtime(!realtime)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 flex items-center gap-1.5 ${
              realtime 
                ? 'bg-[var(--success-soft)] border-[var(--success-border)] text-[var(--success)]' 
                : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${realtime ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-disabled)]'}`} />
            {realtime ? 'Live Updates Active' : 'Updates Paused'}
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-primary)] transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export to PDF
          </button>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="max-w-7xl mx-auto space-y-6">
        
        {/* Filter Toolbar controls */}
        <section className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[var(--text-secondary)] text-xs font-semibold flex items-center gap-1.5 mr-2">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Role Filter:
            </span>
            {(['admin', 'buyer', 'supplier', 'carrier', 'investor'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 uppercase tracking-wider ${
                  role === r
                    ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-sm'
                    : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto font-mono text-[11px] text-[var(--text-secondary)] bg-[var(--bg-hover)] p-2.5 border border-[var(--border)] rounded-lg">
            <Database className="w-4 h-4 text-[var(--text-primary)]" />
            <span className="text-[var(--text-muted)]">WALLET:</span>
            <span className="text-[var(--text-primary)] truncate max-w-[200px]" title={address}>{address}</span>
          </div>
        </section>

        {/* Loading / Error States */}
        {loading && !analyticsData ? (
          <div className="text-center py-20 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-sm">
            <RefreshCw className="animate-spin-slow w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-[var(--text-secondary)] text-xs">Aggregating multi-chain logistics databases...</p>
          </div>
        ) : error ? (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger-border)] rounded-xl p-6 text-center text-[var(--danger)] text-xs">
            {error}
          </div>
        ) : (
          analyticsData && (
            <div className="space-y-6">
              
              {/* Portfolio Grid */}
              <section className="relative">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    Macro Portfolio Position
                  </h2>
                  <button 
                    onClick={() => handleExportCSV('portfolio')}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[10px] font-semibold flex items-center gap-1 print:hidden"
                  >
                    Export CSV
                  </button>
                </div>
                <PortfolioOverview data={analyticsData.portfolio} />
              </section>

              {/* Two Column details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Risk matrix */}
                <section>
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                      Voyage Risk Vectors
                    </h2>
                    <button 
                      onClick={() => handleExportCSV('risk')}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[10px] font-semibold flex items-center gap-1 print:hidden"
                    >
                      Export CSV
                    </button>
                  </div>
                  <RiskHeatmap data={analyticsData.risk} />
                </section>

                {/* Trade Finance graphs */}
                <section>
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      Pre-Shipment Capital Pools
                    </h2>
                    <button 
                      onClick={() => handleExportCSV('tradeFinance')}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[10px] font-semibold flex items-center gap-1 print:hidden"
                    >
                      Export CSV
                    </button>
                  </div>
                  <TradeFinanceChart data={analyticsData.tradeFinance} />
                </section>

              </div>

              {/* Counterparty rating leaderboard */}
              <section>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[var(--success)]" />
                    Reputation Matrices
                  </h2>
                  <button 
                    onClick={() => handleExportCSV('reputation')}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[10px] font-semibold flex items-center gap-1 print:hidden"
                  >
                    Export CSV
                  </button>
                </div>
                <ReputationRanking data={analyticsData.reputation} />
              </section>

            </div>
          )
        )}

      </main>
    </div>
  );
}
