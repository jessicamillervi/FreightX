/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  Play, 
  RefreshCw, 
  ExternalLink,
  Award,
  Cpu,
  UserCheck
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

export default function AgentDashboard() {
  const { showToast, logTerminal } = useAppContext();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/agent/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error fetching agent status:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStatus().finally(() => setLoading(false));

    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualTrigger = async () => {
    setExecuting(true);
    logTerminal('Manually triggering AI Agent Logistics Coordinator verification run...');
    try {
      const res = await fetch('/api/agent/execute', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Agent loop run successfully!', 'success');
        logTerminal(`[AI Agent] Coordinator execution completed. Executed logs count: ${data.executedLogs.length}`);
        fetchStatus();
      } else {
        showToast('Agent run failed or returned warning status.', 'warning');
      }
    } catch (err) {
      showToast('Error executing agent loop', 'error');
    } finally {
      setExecuting(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
        <RefreshCw className="h-8 w-8 animate-spin mb-4 text-emerald-500" />
        <p className="text-sm font-medium">Querying agent state on Arc Network...</p>
      </div>
    );
  }

  // Filter logs representing dispute jobs (ERC-8183) or settlements
  const logs = status?.logs || [];
  const disputeJobs = logs.filter((l: any) => l.action === 'Dispute Flagged');
  const settlementJobs = logs.filter((l: any) => l.action === 'Cargo Settled');

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-40 w-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 shadow-inner">
              <Bot className="h-10 w-10 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">{status?.name || 'Logistics Coordinator'}</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {status?.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-md">
                Autonomous AI Coordinator managing logistics milestones, cold-chain temperature compliance, dispute logging, and settlements.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchStatus}
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition duration-200"
              title="Refresh State"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={handleManualTrigger}
              disabled={executing}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black font-semibold rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {executing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-black" />
                  Running Loop...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-black text-black" />
                  Execute Loop
                </>
              )}
            </button>
          </div>
        </div>

        {/* Identity & Reputation Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-800/60">
          <div className="bg-zinc-900/40 border border-zinc-800/40 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-cyan-400" />
              <div>
                <span className="text-xs text-zinc-500 block">Agent Wallet Address</span>
                <span className="text-sm font-mono text-zinc-300">
                  {status?.walletAddress ? `${status.walletAddress.substring(0, 8)}...${status.walletAddress.substring(36)}` : 'Loading...'}
                </span>
              </div>
            </div>
            {status?.walletAddress && (
              <a
                href={`https://testnet.arcscan.app/address/${status.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-white transition"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/40 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <span className="text-xs text-zinc-500 block">ERC-8004 On-Chain Identity</span>
                <span className="text-sm font-semibold text-zinc-300">
                  {status?.onChainRegistered ? `NFT Token ID: #${status.agentId}` : 'Not Registered'}
                </span>
              </div>
            </div>
            {status?.onChainRegistered && (
              <span className="px-2 py-0.5 text-3xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
                VERIFIED
              </span>
            )}
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/40 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-amber-400" />
              <div>
                <span className="text-xs text-zinc-500 block">Reputation Score</span>
                <span className="text-sm font-bold text-zinc-100">
                  {status?.reputation ?? 100} / 100
                </span>
              </div>
            </div>
            <div className="h-2 w-24 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 rounded-full" 
                style={{ width: `${status?.reputation ?? 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Job Summary and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ERC-8183 Job Registry */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
            <ShieldAlert className="h-5 w-5 text-zinc-400" />
            <h3 className="text-base font-bold text-white">ERC-8183 Jobs Registry</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800/60 p-4 rounded-xl text-center">
              <span className="text-2xl font-black text-amber-500 block">{disputeJobs.length}</span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Active Disputes</span>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/60 p-4 rounded-xl text-center">
              <span className="text-2xl font-black text-emerald-400 block">{settlementJobs.length}</span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Settled Escrows</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Pending Tasks</h4>
            {disputeJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/20 border border-zinc-800/40 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-500">No active cargo disputes detected.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {disputeJobs.map((job: any) => (
                  <div key={job.id} className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-400">Shipment #{job.shipmentId}</span>
                      <p className="text-3xs text-zinc-400 truncate max-w-xs">{job.details}</p>
                    </div>
                    <span className="px-2 py-0.5 text-3xs font-bold bg-amber-500/10 text-amber-400 rounded">
                      Disputed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Logs Timeline */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-zinc-400" />
              <h3 className="text-base font-bold text-white">Coordinator Operations Log</h3>
            </div>
            <span className="text-2xs text-zinc-500 font-medium">Real-time telemetry feeds</span>
          </div>

          {logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500">
              <Activity className="h-8 w-8 text-zinc-700 animate-pulse mb-3" />
              <p className="text-sm">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-4 max-h-[340px] overflow-y-auto pr-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex gap-4 p-3.5 bg-zinc-900/30 border border-zinc-800/60 rounded-xl hover:bg-zinc-900/60 transition">
                  <div className="mt-0.5">
                    {log.status === 'warning' && (
                      <span className="h-2 w-2 rounded-full bg-amber-500 block shadow-glow-amber animate-pulse" />
                    )}
                    {log.status === 'success' && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 block shadow-glow-emerald" />
                    )}
                    {log.status === 'error' && (
                      <span className="h-2 w-2 rounded-full bg-rose-500 block animate-ping" />
                    )}
                    {(!log.status || log.status === 'info') && (
                      <span className="h-2 w-2 rounded-full bg-zinc-500 block" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{log.action}</span>
                      <span className="text-3xs text-zinc-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">{log.details}</p>
                    {log.txHash && log.txHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                      <div className="pt-1 flex items-center gap-1.5">
                        <span className="text-3xs text-zinc-600 font-mono">Tx:</span>
                        <a 
                          href={`https://testnet.arcscan.app/tx/${log.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-3xs text-emerald-400/80 hover:text-emerald-400 font-mono hover:underline flex items-center gap-0.5 transition"
                        >
                          {log.txHash.substring(0, 16)}...
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
