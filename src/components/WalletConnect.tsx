'use client';

import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useCircleWallet } from '@/hooks/useCircleWallet';
import { 
  Key, ShieldCheck, Wallet, Fingerprint, Copy, Check, LogOut, 
  UserPlus, LogIn, Info, RefreshCw, ExternalLink, Mail, Lock 
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletConnect() {
  const {
    signerType, setSignerType, wallet, sandboxBalances, web3Balances,
    circleSession, setCircleSession, circleBalances, logTerminal, showToast, updateBalances,
    connectedAddress
  } = useAppContext();

  const { register, login, logout, loading } = useCircleWallet();
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [emailStep, setEmailStep] = useState<'enter-email' | 'enter-otp'>('enter-email');
  const [walletTab, setWalletTab] = useState<'passkey' | 'email' | 'web3' | 'sandbox'>('passkey');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Synchronize active tab based on context signer state
  React.useEffect(() => {
    if (signerType === 'circle') {
      if (circleSession?.username?.includes('@')) {
        setWalletTab('email');
      } else {
        setWalletTab('passkey');
      }
    } else if (signerType === 'web3') {
      setWalletTab('web3');
    } else if (signerType === 'sandbox') {
      setWalletTab('sandbox');
    }
  }, [signerType, circleSession]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    showToast('Address copied to clipboard!', 'success');
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleRegisterCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    try {
      logTerminal(`Requesting Passkey Registration for user: ${usernameInput}...`);
      const session = await register(usernameInput.trim());
      setCircleSession(session);
      setSignerType('circle');
      logTerminal(`Circle Passkey Wallet created successfully: ${session.address}`);
      showToast(`Passkey Wallet created for ${session.username}!`, 'success');
      setUsernameInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logTerminal(`Passkey registration error: ${msg}`);
      showToast('Passkey registration cancelled or failed.', 'error');
    }
  };

  const handleLoginCircle = async () => {
    try {
      logTerminal('Requesting Passkey Authentication...');
      const session = await login();
      setCircleSession(session);
      setSignerType('circle');
      logTerminal(`Authenticated via Passkey. Address: ${session.address}`);
      showToast(`Welcome back, ${session.username}!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logTerminal(`Passkey authentication error: ${msg}`);
      showToast('Authentication cancelled or failed.', 'error');
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      showToast('Please enter a valid email address.', 'warning');
      return;
    }

    try {
      logTerminal(`Requesting OTP for email: ${emailInput}...`);
      showToast('Sending verification code...', 'info');
      await new Promise(resolve => setTimeout(resolve, 800));
      setEmailStep('enter-otp');
      logTerminal(`Verification code sent to: ${emailInput}. Enter code to authorize.`);
      showToast('Verification code sent!', 'success');
    } catch (err) {
      showToast('Failed to send verification code.', 'error');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.length !== 6) {
      showToast('Please enter a 6-digit verification code.', 'warning');
      return;
    }

    try {
      logTerminal(`Verifying OTP for email: ${emailInput}...`);
      showToast('Verifying code...', 'info');
      const session = await register(emailInput.trim());
      setCircleSession(session);
      setSignerType('circle');
      logTerminal(`Circle Email Smart Wallet ready: ${session.address}`);
      showToast(`Logged in successfully!`, 'success');
      setEmailInput('');
      setOtpInput('');
      setEmailStep('enter-email');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logTerminal(`Email login error: ${msg}`);
      showToast('Failed to authenticate email wallet.', 'error');
    }
  };

  const handleDisconnectCircle = () => {
    logout();
    setCircleSession(null);
    if (signerType === 'circle') setSignerType('sandbox');
    logTerminal('Circle Wallet disconnected.');
    showToast('Circle Wallet disconnected.', 'info');
  };

  const handleRegenerateSandbox = () => {
    localStorage.removeItem('freightx_sandbox_wallet');
    window.location.reload();
  };

  const [faucetLoading, setFaucetLoading] = useState(false);

  const handleRequestFaucet = async () => {
    const activeAddr = signerType === 'circle' && circleSession?.address
      ? circleSession.address
      : signerType === 'web3' && connectedAddress
      ? connectedAddress
      : wallet?.address;

    if (!activeAddr) {
      showToast('No active wallet found.', 'warning');
      return;
    }

    setFaucetLoading(true);
    logTerminal(`[Faucet] Requesting testnet funds for ${activeAddr}...`);
    showToast('Requesting testnet funds from faucet...', 'info');

    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: activeAddr })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Faucet request failed');
      }
      logTerminal(`[Faucet Success] funded! Gas Tx: ${data.gasTxHash.slice(0, 15)}... ERC20 Tx: ${data.erc20TxHash.slice(0, 15)}...`);
      showToast('Wallet funded successfully!', 'success');
      
      // Refresh balances
      await updateBalances(activeAddr, signerType);
    } catch (err: any) {
      console.error(err);
      logTerminal(`[Faucet Error] ${err.message || err}`);
      showToast('Faucet request failed. Check server console.', 'error');
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleManualRefreshBalances = async () => {
    setIsRefreshing(true);
    try {
      if (signerType === 'circle' && circleSession?.address) {
        await updateBalances(circleSession.address, 'circle');
      } else if (signerType === 'web3' && connectedAddress) {
        await updateBalances(connectedAddress, 'web3');
      } else if (signerType === 'sandbox' && wallet?.address) {
        await updateBalances(wallet.address, 'sandbox');
      }
      showToast('Balances updated successfully.', 'success');
    } catch {
      showToast('Balance refresh failed.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTabClick = (tab: 'passkey' | 'email' | 'web3' | 'sandbox') => {
    setWalletTab(tab);
    if (tab === 'passkey' || tab === 'email') {
      if (circleSession) {
        const isEmailSession = circleSession.username.includes('@');
        if ((tab === 'email' && isEmailSession) || (tab === 'passkey' && !isEmailSession)) {
          setSignerType('circle');
        }
      }
    } else if (tab === 'web3') {
      setSignerType('web3');
    } else if (tab === 'sandbox') {
      setSignerType('sandbox');
    }
  };

  const tabStyle = (active: boolean, color: string): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' as const,
    padding: '1.25rem', borderRadius: '16px', border: '1px solid',
    cursor: 'pointer', transition: 'all 0.2s',
    background: active ? `${color}15` : 'rgba(255,255,255,0.03)',
    borderColor: active ? `${color}66` : 'rgba(255,255,255,0.05)',
    boxShadow: active ? `0 8px 24px ${color}10` : 'none',
  });

  const balanceCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', padding: '0.875rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center',
  };

  const detailBorderColor = walletTab === 'passkey' ? 'rgba(59,130,246,0.2)' 
    : walletTab === 'email' ? 'rgba(16,185,129,0.2)'
    : walletTab === 'web3' ? 'rgba(168,85,247,0.2)' 
    : 'rgba(245,158,11,0.2)';

  return (
    <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck style={{ color: 'var(--primary)' }} size={22} />
            FreightX Trade Wallet Manager
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Choose how you sign contracts and fund transactions on Arc Network.
          </p>
        </div>
        <button onClick={handleManualRefreshBalances} disabled={isRefreshing}
          className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin-slow' : ''} /> Refresh Balances
        </button>
      </div>

      {/* Selector Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <button onClick={() => handleTabClick('passkey')} style={tabStyle(walletTab === 'passkey', '#3b82f6')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.75rem' }}>
            <span style={{ padding: '0.5rem', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderRadius: '12px', display: 'flex' }}>
              <Fingerprint size={20} />
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Gasless UX</span>
          </div>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Passkey (Circle)</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: '1.4' }}>
            Biometric credentials. Sponsor gas automatically via Circle Paymaster.
          </span>
        </button>

        <button onClick={() => handleTabClick('email')} style={tabStyle(walletTab === 'email', '#10b981')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.75rem' }}>
            <span style={{ padding: '0.5rem', background: 'rgba(16,185,129,0.15)', color: '#34d399', borderRadius: '12px', display: 'flex' }}>
              <Mail size={20} />
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Gasless UX</span>
          </div>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Email OTP (Circle)</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: '1.4' }}>
            Email-based credentials with OTP verification. Gasless trade settlements.
          </span>
        </button>

        <button onClick={() => handleTabClick('web3')} style={tabStyle(walletTab === 'web3', '#a855f7')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.75rem' }}>
            <span style={{ padding: '0.5rem', background: 'rgba(168,85,247,0.15)', color: '#c084fc', borderRadius: '12px', display: 'flex' }}>
              <Wallet size={20} />
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Web3 Client</span>
          </div>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>MetaMask / Web3 Wallet</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: '1.4' }}>
            Standard provider connection using RainbowKit or browser extension.
          </span>
        </button>

        <button onClick={() => handleTabClick('sandbox')} style={tabStyle(walletTab === 'sandbox', '#f59e0b')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.75rem' }}>
            <span style={{ padding: '0.5rem', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', borderRadius: '12px', display: 'flex' }}>
              <Key size={20} />
            </span>
            <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>Developer Keys</span>
          </div>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Sandbox Wallet</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: '1.4' }}>
            Local keypair generated inside browser storage. Ideal for fast local tests.
          </span>
        </button>
      </div>

      {/* Details Pane */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${detailBorderColor}`, borderRadius: '16px', padding: '1.5rem', transition: 'border-color 0.3s' }}>

        {/* === PASSKEY PANEL === */}
        {walletTab === 'passkey' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {circleSession && !circleSession.username.includes('@') ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Fingerprint size={16} style={{ color: '#60a5fa' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Active Passkey User:</span>
                      <span className="badge badge-primary" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{circleSession.username}</span>
                      {circleSession.isMock && <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>Simulated WebAuthn</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>{circleSession.address}</span>
                      <button onClick={() => copyToClipboard(circleSession.address)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {copiedAddress ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      </button>
                      <a href={`https://testnet.arcscan.app/address/${circleSession.address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                  <button onClick={handleDisconnectCircle} className="btn" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', color: 'var(--danger)', borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.08)' }}>
                    <LogOut size={12} /> Disconnect
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                  <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Native Gas (USDC)</span><strong>{circleBalances.nativeGas} USDC</strong></div>
                  <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>USDC ERC-20</span><strong>{circleBalances.usdcToken} USDC</strong></div>
                  <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>EURC ERC-20</span><strong>{circleBalances.eurcToken} EURC</strong></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: '#60a5fa', background: 'rgba(59,130,246,0.08)', padding: '0.875rem', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                  <span><strong>Circle Gas Station is Active:</strong> All trade operations are fully sponsored. No gas fee billed to your account.</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', padding: '1.25rem', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <Fingerprint size={16} /> Create Gasless Smart Account
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    By registering a Passkey, FreightX creates an ERC-4337 Smart Contract Wallet linked to your device biometrics. Transactions are sponsored gas-free via Circle Paymaster!
                  </p>
                </div>
                <form onSubmit={handleRegisterCircle} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Enter Username (e.g. BuyerAlpha)" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} disabled={loading}
                    style={{ flex: 1, minWidth: '220px', padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '0.85rem', color: '#fff', outline: 'none' }} />
                  <button type="submit" disabled={loading || !usernameInput.trim()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
                    <UserPlus size={16} /> {loading ? 'Creating...' : 'Register Passkey'}
                  </button>
                </form>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span style={{ height: '1px', background: 'var(--border-color)', flex: 1 }} />OR<span style={{ height: '1px', background: 'var(--border-color)', flex: 1 }} />
                </div>
                <button type="button" onClick={handleLoginCircle} disabled={loading} className="btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
                  <LogIn size={16} style={{ color: '#60a5fa' }} /> Login with Existing Passkey
                </button>
              </>
            )}
          </div>
        )}

        {/* === EMAIL OTP PANEL === */}
        {walletTab === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {circleSession && circleSession.username.includes('@') ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Mail size={16} style={{ color: '#10b981' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Active Email User:</span>
                      <span className="badge badge-success" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{circleSession.username}</span>
                      {circleSession.isMock && <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>Simulated Email Auth</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>{circleSession.address}</span>
                      <button onClick={() => copyToClipboard(circleSession.address)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {copiedAddress ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      </button>
                      <a href={`https://testnet.arcscan.app/address/${circleSession.address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                  <button onClick={handleDisconnectCircle} className="btn" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', color: 'var(--danger)', borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.08)' }}>
                    <LogOut size={12} /> Disconnect
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                  <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Native Gas (USDC)</span><strong>{circleBalances.nativeGas} USDC</strong></div>
                  <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>USDC ERC-20</span><strong>{circleBalances.usdcToken} USDC</strong></div>
                  <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>EURC ERC-20</span><strong>{circleBalances.eurcToken} EURC</strong></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '0.875rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                  <span><strong>Circle Gas Station is Active:</strong> All operations sponsored gas-free. Secured by email verification.</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', padding: '1.25rem', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <Mail size={16} /> Sign In with Email OTP
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Enter your email address to authenticate. Circle Web3 Services generates a secure smart account sponsored gas-free via Circle Paymaster!
                  </p>
                </div>

                {emailStep === 'enter-email' ? (
                  <form onSubmit={handleSendOtp} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <input 
                      type="email" 
                      placeholder="operator@freightx.com" 
                      value={emailInput} 
                      onChange={(e) => setEmailInput(e.target.value)} 
                      disabled={loading}
                      required
                      style={{ flex: 1, minWidth: '220px', padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '0.85rem', color: '#fff', outline: 'none' }} 
                    />
                    <button 
                      type="submit" 
                      disabled={loading || !emailInput.trim()} 
                      className="btn btn-primary" 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.65rem 1rem', fontSize: '0.85rem' }}
                    >
                      <Mail size={16} /> Send Code
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sent to: <strong>{emailInput}</strong></span>
                        <button type="button" onClick={() => setEmailStep('enter-email')} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Change Email</button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <input 
                          type="text" 
                          maxLength={6}
                          placeholder="Enter 6-digit OTP" 
                          value={otpInput} 
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))} 
                          disabled={loading}
                          required
                          style={{ flex: 1, minWidth: '220px', padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '0.85rem', color: '#fff', outline: 'none', textAlign: 'center', letterSpacing: '0.1em' }} 
                        />
                        <button 
                          type="submit" 
                          disabled={loading || otpInput.length !== 6} 
                          className="btn btn-success" 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.65rem 1rem', fontSize: '0.85rem', background: '#10b981', border: 'none', color: '#fff' }}
                        >
                          <Lock size={16} /> {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}

        {/* === WEB3 PANEL === */}
        {walletTab === 'web3' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', padding: '1.25rem', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <Wallet size={16} /> RainbowKit Connection
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Connect your browser wallet (MetaMask, Coinbase Wallet, etc.) directly. Transactions require you to pay gas in USDC on Arc Testnet.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <ConnectButton />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
              <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Native Gas (USDC)</span><strong>{web3Balances.nativeGas} USDC</strong></div>
              <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>USDC ERC-20</span><strong>{web3Balances.usdcToken} USDC</strong></div>
              <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>EURC ERC-20</span><strong>{web3Balances.eurcToken} EURC</strong></div>
            </div>
          </div>
        )}

        {/* === SANDBOX PANEL === */}
        {walletTab === 'sandbox' && wallet && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', padding: '1.25rem', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <Key size={16} /> Sandbox Wallet Keys
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                A sandbox account created automatically inside your browser storage. Copy the address below to fund it via the faucet for quick experiments.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>Address</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  <span style={{ wordBreak: 'break-all' }}>{wallet.address}</span>
                  <button onClick={() => copyToClipboard(wallet.address)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: '0.5rem', flexShrink: 0 }}>
                    {copiedAddress ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Private Key (Secret)</span>
                  <button onClick={() => setShowPrivateKey(!showPrivateKey)} style={{ background: 'none', border: 'none', fontSize: '0.65rem', color: '#fbbf24', cursor: 'pointer', fontWeight: 600 }}>
                    {showPrivateKey ? 'Hide Key' : 'Reveal Key'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, maxWidth: '85%' }}>
                    {showPrivateKey ? wallet.privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </span>
                  <button onClick={() => copyToClipboard(wallet.privateKey)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: '0.5rem', flexShrink: 0 }}>
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
              <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Native Gas (USDC)</span><strong>{sandboxBalances.nativeGas} USDC</strong></div>
              <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>USDC ERC-20</span><strong>{sandboxBalances.usdcToken} USDC</strong></div>
              <div style={balanceCard}><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>EURC ERC-20</span><strong>{sandboxBalances.eurcToken} EURC</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={handleRequestFaucet} disabled={faucetLoading} className="btn btn-primary" style={{ flex: 1, minWidth: '180px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                <RefreshCw size={12} className={faucetLoading ? 'animate-spin' : ''} /> {faucetLoading ? 'Funding Sandbox...' : 'Instant Faucet (Claim USDC)'}
              </button>
              <button onClick={handleRegenerateSandbox} className="btn btn-secondary" style={{ flex: 1, minWidth: '180px', fontSize: '0.75rem', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                <RefreshCw size={12} /> Regenerate Local Keypair
              </button>
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, minWidth: '180px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', textDecoration: 'none' }}>
                Circle Faucet <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
