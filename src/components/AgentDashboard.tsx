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
    <div className="space-y-6 text-[#F3F4F6]">
      {/* Premium Dark Autopilot Dashboard Panel */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0a0d16 0%, #111522 100%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Glow ambient spots */}
        <div style={{
          position: 'absolute',
          top: '-15%',
          right: '-15%',
          width: '240px',
          height: '240px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-15%',
          width: '240px',
          height: '240px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 70%)',
          pointerEvents: 'none'
        }} />

        {/* Top Header Block */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '20px',
          marginBottom: '20px'
        }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)',
                padding: '8px',
                borderRadius: '10px',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
              }}>
                <Bot size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white leading-tight flex items-center gap-2 m-0">
                  AI Agent Logistics Coordinator
                </h3>
                <span className="text-3xs text-[#9CA3AF] uppercase tracking-wider font-bold">ERC-8004 & ERC-8183 On-Chain Autopilot</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(31, 41, 55, 0.4)', padding: '5px 12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', tracking: '0.05em' }}>Status:</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    boxShadow: '0 0 8px #10B981',
                    display: 'inline-block'
                  }} />
                  {status?.status || 'ACTIVE'}
                </span>
              </div>

              <button
                onClick={fetchStatus}
                style={{
                  background: 'rgba(31, 41, 55, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#D1D5DB',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                title="Refresh State"
              >
                <RefreshCw size={14} />
              </button>

              <button
                onClick={handleManualTrigger}
                disabled={executing}
                style={{
                  background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: executing ? 'not-allowed' : 'pointer',
                  borderRadius: '10px',
                  padding: '0 16px',
                  height: '36px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                {executing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    RUNNING...
                  </>
                ) : (
                  <>
                    <Play size={13} fill="#FFFFFF" />
                    EXECUTE LOOP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Identity & Reputation Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Card 1: Agent Wallet */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div className="flex items-center gap-3">
              <div style={{
                background: 'rgba(99, 102, 241, 0.1)',
                padding: '8px',
                borderRadius: '8px',
                color: '#6366F1'
              }}>
                <Cpu size={18} />
              </div>
              <div>
                <span style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em', marginBottom: '2px' }}>Agent Wallet Address</span>
                <span className="text-xs font-mono text-white font-bold">
                  {status?.walletAddress ? `${status.walletAddress.substring(0, 8)}...${status.walletAddress.substring(34)}` : 'Loading...'}
                </span>
              </div>
            </div>
            {status?.walletAddress && (
              <a
                href={`https://testnet.arcscan.app/address/${status.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#9CA3AF' }}
                className="hover:text-white transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Card 2: ERC-8004 */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div className="flex items-center gap-3">
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '8px',
                borderRadius: '8px',
                color: '#10B981'
              }}>
                <UserCheck size={18} />
              </div>
              <div>
                <span style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em', marginBottom: '2px' }}>ERC-8004 Identity</span>
                <span className="text-xs text-white font-bold">
                  {status?.onChainRegistered ? `NFT Token ID: #${status.agentId}` : 'Not Registered'}
                </span>
              </div>
            </div>
            {status?.onChainRegistered && (
              <span style={{
                fontSize: '8px',
                fontWeight: 900,
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#6366F1',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}>
                VERIFIED
              </span>
            )}
          </div>

          {/* Card 3: Reputation */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div className="flex items-center gap-3">
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                padding: '8px',
                borderRadius: '8px',
                color: '#F59E0B'
              }}>
                <Award size={18} />
              </div>
              <div>
                <span style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em', marginBottom: '2px' }}>Reputation Score</span>
                <span className="text-xs text-white font-bold">
                  {status?.reputation ?? 100} / 100
                </span>
              </div>
            </div>
            <div className="h-2 w-16 bg-[#1F2937] rounded-full overflow-hidden border border-[rgba(255,255,255,0.06)] relative" style={{ minWidth: '64px' }}>
              <div 
                className="h-full rounded-full transition-all duration-500" 
                style={{ 
                  width: `${status?.reputation ?? 100}%`,
                  background: (status?.reputation ?? 100) >= 80 
                    ? 'linear-gradient(90deg, #10B981 0%, #059669 100%)' 
                    : 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Main Grid: Job Summary and Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ERC-8183 Job Registry */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.08)] pb-3">
              <ShieldAlert className="h-4 w-4 text-[#9CA3AF]" />
              <h3 className="text-sm font-bold text-white m-0">ERC-8183 Jobs Registry</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div 
                className="border p-3.5 rounded-xl text-center transition duration-300"
                style={{
                  background: disputeJobs.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(31, 41, 55, 0.2)',
                  borderColor: disputeJobs.length > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.06)'
                }}
              >
                <span className="text-2xl font-black block leading-none mb-1" style={{ color: disputeJobs.length > 0 ? '#EF4444' : '#9CA3AF' }}>
                  {disputeJobs.length}
                </span>
                <span className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-wider block">Active Disputes</span>
              </div>
              <div 
                className="border p-3.5 rounded-xl text-center transition duration-300"
                style={{
                  background: 'rgba(16, 185, 129, 0.06)',
                  borderColor: 'rgba(16, 185, 129, 0.2)'
                }}
              >
                <span className="text-2xl font-black block leading-none mb-1" style={{ color: '#10B981' }}>
                  {settlementJobs.length}
                </span>
                <span className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-wider block">Settled Escrows</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider block">Pending Tasks</span>
              {disputeJobs.length === 0 ? (
                <div style={{
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  background: 'rgba(31, 41, 55, 0.15)',
                  borderRadius: '10px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}>
                  <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                  <p className="text-[11px] text-[#9CA3AF] font-semibold m-0">No active cargo disputes</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {disputeJobs.map((job: any) => (
                    <div key={job.id} style={{
                      background: 'rgba(245, 158, 11, 0.05)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderLeft: '4px solid #F59E0B'
                    }}>
                      <div>
                        <span className="text-xs font-bold text-[#F59E0B] block">Shipment #{job.shipmentId}</span>
                        <p className="text-3xs text-[#9CA3AF] truncate max-w-[120px] m-0">{job.details}</p>
                      </div>
                      <span className="px-1.5 py-0.5 text-3xs font-extrabold bg-[rgba(245, 158, 11, 0.1)] text-[#F59E0B] rounded border border-rgba(245, 158, 11, 0.15)">
                        Disputed
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity Logs Timeline */}
          <div 
            className="lg:col-span-2 shadow-sm flex flex-col min-h-[280px]"
            style={{
              background: 'rgba(17, 24, 39, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '16px',
              padding: '20px',
              gap: '16px'
            }}
          >
            <div className="flex items-center justify-between border-b border-[rgba(255, 255, 255, 0.08)] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#9CA3AF]" />
                <h3 className="text-sm font-bold text-white m-0">Coordinator Operations Log</h3>
              </div>
              <span className="text-[9px] text-[#9CA3AF] font-bold uppercase tracking-wider">Real-time telemetry feeds</span>
            </div>

            {logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#9CA3AF] gap-2">
                <Activity className="h-6 w-6 text-[#4B5563] animate-pulse" />
                <p className="text-xs m-0">No activity recorded yet.</p>
              </div>
            ) : (
              <div 
                style={{
                  background: '#060912',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '16px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontFamily: 'monospace'
                }}
                className="custom-scrollbar"
              >
                {logs.map((log: any) => {
                  let statusColor = '#9CA3AF';
                  let logTagBg = 'rgba(156, 163, 175, 0.08)';
                  let logTagText = '#9CA3AF';
                  if (log.status === 'success') {
                    statusColor = '#10B981';
                    logTagBg = 'rgba(16, 185, 129, 0.1)';
                    logTagText = '#10B981';
                  } else if (log.status === 'warning') {
                    statusColor = '#F59E0B';
                    logTagBg = 'rgba(245, 158, 11, 0.1)';
                    logTagText = '#F59E0B';
                  } else if (log.status === 'error') {
                    statusColor = '#EF4444';
                    logTagBg = 'rgba(239, 68, 68, 0.1)';
                    logTagText = '#EF4444';
                  }

                  return (
                    <div key={log.id} style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      paddingBottom: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            background: logTagBg,
                            color: logTagText,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            border: `1px solid ${logTagText}20`
                          }}>
                            {log.action}
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full block animate-pulse" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
                        </div>
                        <span style={{ fontSize: '10px', color: '#4B5563' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <p className="text-xs text-[#D1D5DB] m-0" style={{ lineHeight: '1.4' }}>{log.details}</p>
                      
                      {log.txHash && log.txHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                        <div className="pt-0.5 flex items-center gap-1.5">
                          <span className="text-3xs text-[#4B5563] font-mono">Tx:</span>
                          <a 
                            href={`https://testnet.arcscan.app/tx/${log.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-3xs text-[#6366F1] opacity-90 hover:opacity-100 font-mono hover:underline flex items-center gap-0.5 transition"
                          >
                            {log.txHash.substring(0, 16)}...
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
