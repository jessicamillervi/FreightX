'use client';

import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useCircleWallet } from '@/hooks/useCircleWallet';
import { 
  Key, 
  ShieldCheck, 
  Wallet, 
  Fingerprint, 
  Copy, 
  Check, 
  LogOut, 
  UserPlus, 
  LogIn, 
  Info,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletConnect() {
  const {
    signerType,
    setSignerType,
    wallet,
    sandboxBalances,
    web3Balances,
    circleSession,
    setCircleSession,
    circleBalances,
    logTerminal,
    showToast,
    updateBalances
  } = useAppContext();

  const { register, login, logout, loading } = useCircleWallet();
  const [usernameInput, setUsernameInput] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleDisconnectCircle = () => {
    logout();
    setCircleSession(null);
    if (signerType === 'circle') {
      setSignerType('sandbox');
    }
    logTerminal('Passkey Wallet disconnected.');
    showToast('Passkey Wallet disconnected.', 'info');
  };

  const handleRegenerateSandbox = () => {
    localStorage.removeItem('freightx_sandbox_wallet');
    // Reloading wallet will automatically create a new keypair
    window.location.reload();
  };

  const handleManualRefreshBalances = async () => {
    setIsRefreshing(true);
    try {
      if (signerType === 'circle' && circleSession?.address) {
        await updateBalances(circleSession.address, 'circle');
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

  return (
    <div className="bg-[#111318]/90 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-blue-400" size={22} />
            FreightX Trade Wallet Manager
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Choose how you sign contracts and fund transactions on Arc Network.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefreshBalances}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh Balances
          </button>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Passkey Option */}
        <button
          onClick={() => setSignerType('circle')}
          className={`flex flex-col items-start text-left p-4 rounded-2xl border transition-all ${
            signerType === 'circle'
              ? 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
              : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Fingerprint size={20} />
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              Gasless UX
            </span>
          </div>
          <h3 className="font-bold text-white text-sm">Passkey (Circle)</h3>
          <p className="text-xs text-gray-400 mt-1">
            Biometric credentials. Sponsor gas automatically via Circle Paymaster.
          </p>
        </button>

        {/* Browser Wallet Option */}
        <button
          onClick={() => setSignerType('web3')}
          className={`flex flex-col items-start text-left p-4 rounded-2xl border transition-all ${
            signerType === 'web3'
              ? 'bg-purple-500/10 border-purple-500/40 shadow-lg shadow-purple-500/5'
              : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <Wallet size={20} />
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/10">
              Web3 Client
            </span>
          </div>
          <h3 className="font-bold text-white text-sm">MetaMask / Web3 Wallet</h3>
          <p className="text-xs text-gray-400 mt-1">
            Standard provider connection using RainbowKit or browser extension.
          </p>
        </button>

        {/* Sandbox Keypair Option */}
        <button
          onClick={() => setSignerType('sandbox')}
          className={`flex flex-col items-start text-left p-4 rounded-2xl border transition-all ${
            signerType === 'sandbox'
              ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
              : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Key size={20} />
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 text-gray-300">
              Developer Keys
            </span>
          </div>
          <h3 className="font-bold text-white text-sm">Sandbox Wallet</h3>
          <p className="text-xs text-gray-400 mt-1">
            Local keypair generated inside browser storage. Ideal for fast local tests.
          </p>
        </button>
      </div>

      {/* Active Selection Details Pane */}
      <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
        {/* Passkey Panel */}
        {signerType === 'circle' && (
          <div>
            {circleSession ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-white/5 p-4 rounded-xl border border-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Fingerprint size={16} className="text-blue-400" />
                      <span className="text-sm font-bold text-white">Active Passkey User:</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-mono">
                        {circleSession.username}
                      </span>
                      {circleSession.isMock && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] uppercase font-bold">
                          Simulated WebAuthn
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 font-mono text-xs text-gray-400">
                      <span>{circleSession.address}</span>
                      <button 
                        onClick={() => copyToClipboard(circleSession.address)}
                        className="hover:text-white transition-colors"
                      >
                        {copiedAddress ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                      <a
                        href={`https://testnet.arcscan.app/address/${circleSession.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-white transition-colors flex items-center gap-0.5"
                      >
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={handleDisconnectCircle}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/10"
                    >
                      <LogOut size={12} />
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Balances list */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                    <span className="text-xs text-gray-400 block mb-1">Native Gas (USDC)</span>
                    <span className="text-base font-bold text-white">{circleBalances.nativeGas} USDC</span>
                  </div>
                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                    <span className="text-xs text-gray-400 block mb-1">USDC ERC-20</span>
                    <span className="text-base font-bold text-white">{circleBalances.usdcToken} USDC</span>
                  </div>
                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                    <span className="text-xs text-gray-400 block mb-1">EURC ERC-20</span>
                    <span className="text-base font-bold text-white">{circleBalances.eurcToken} EURC</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-blue-400 bg-blue-500/10 p-3.5 rounded-xl border border-blue-500/20 mt-2">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Circle Gas Station is Active:</span> All trade operations, escrows, and milestone triggers are fully sponsored. No transaction gas fee will be billed to your account.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                  <h4 className="text-sm font-bold text-blue-400 flex items-center gap-1.5 mb-1">
                    <Fingerprint size={16} />
                    Create Gasless Smart Account
                  </h4>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    By registering a Passkey, FreightX creates an ERC-4337 Smart Contract Wallet linked to your device biometrics (FaceID/TouchID). Transactions are sponsored gas-free via the Circle Paymaster!
                  </p>
                </div>

                <form onSubmit={handleRegisterCircle} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Enter Username (e.g. BuyerAlpha)"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                  />
                  <button
                    type="submit"
                    disabled={loading || !usernameInput.trim()}
                    className="flex items-center justify-center gap-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors border border-blue-500/30"
                  >
                    <UserPlus size={16} />
                    {loading ? 'Creating...' : 'Register Passkey'}
                  </button>
                </form>

                <div className="flex items-center gap-2 justify-center py-2 text-xs text-gray-400">
                  <span className="h-px bg-white/10 flex-1" />
                  <span>OR</span>
                  <span className="h-px bg-white/10 flex-1" />
                </div>

                <button
                  type="button"
                  onClick={handleLoginCircle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl text-sm transition-colors border border-white/10"
                >
                  <LogIn size={16} className="text-blue-400" />
                  Login with Existing Passkey
                </button>
              </div>
            )}
          </div>
        )}

        {/* Browser Wallet Panel */}
        {signerType === 'web3' && (
          <div className="space-y-4">
            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
              <h4 className="text-sm font-bold text-purple-400 flex items-center gap-1.5 mb-1">
                <Wallet size={16} />
                RainbowKit Connection
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                Connect your browser wallet (MetaMask, Coinbase Wallet, etc.) directly. In this mode, transactions are sent from your Web3 address, requiring you to pay gas in USDC on Arc Testnet.
              </p>
            </div>

            <div className="flex justify-center p-4 bg-black/20 rounded-xl border border-white/5">
              <ConnectButton />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <span className="text-xs text-gray-400 block mb-1">Native Gas (USDC)</span>
                <span className="text-base font-bold text-white">{web3Balances.nativeGas} USDC</span>
              </div>
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <span className="text-xs text-gray-400 block mb-1">USDC ERC-20</span>
                <span className="text-base font-bold text-white">{web3Balances.usdcToken} USDC</span>
              </div>
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <span className="text-xs text-gray-400 block mb-1">EURC ERC-20</span>
                <span className="text-base font-bold text-white">{web3Balances.eurcToken} EURC</span>
              </div>
            </div>
          </div>
        )}

        {/* Sandbox Panel */}
        {signerType === 'sandbox' && wallet && (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                <Key size={16} />
                Sandbox Wallet Keys
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                A sandbox account created automatically inside your browser storage. You can copy the address below to fund it via the faucet for quick experiments.
              </p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold mb-1">Address</span>
                <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-lg border border-white/5 font-mono text-xs text-white">
                  <span>{wallet.address}</span>
                  <button 
                    onClick={() => copyToClipboard(wallet.address)}
                    className="hover:text-white text-gray-400 transition-colors"
                  >
                    {copiedAddress ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Private Key (Secret)</span>
                  <button 
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    {showPrivateKey ? 'Hide Key' : 'Reveal Key'}
                  </button>
                </div>
                <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-lg border border-white/5 font-mono text-xs text-white">
                  <span className="truncate flex-1 max-w-[85%]">
                    {showPrivateKey ? wallet.privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </span>
                  <button 
                    onClick={() => copyToClipboard(wallet.privateKey)}
                    className="hover:text-white text-gray-400 transition-colors ml-2"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <span className="text-xs text-gray-400 block mb-1">Native Gas (USDC)</span>
                <span className="text-base font-bold text-white">{sandboxBalances.nativeGas} USDC</span>
              </div>
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <span className="text-xs text-gray-400 block mb-1">USDC ERC-20</span>
                <span className="text-base font-bold text-white">{sandboxBalances.usdcToken} USDC</span>
              </div>
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <span className="text-xs text-gray-400 block mb-1">EURC ERC-20</span>
                <span className="text-base font-bold text-white">{sandboxBalances.eurcToken} EURC</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRegenerateSandbox}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-semibold rounded-xl text-xs transition-colors border border-amber-500/20"
              >
                <RefreshCw size={12} />
                Regenerate Local Keypair
              </button>
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl text-xs transition-colors border border-white/10"
              >
                Circle Faucet
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
