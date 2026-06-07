'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { type Address } from 'viem';
import { 
  getOrCreateSandboxWallet, 
  queryBalances, 
  deployContractsOnchain,
  getSavedContracts,
  getAppMode,
  setAppMode as saveAppMode,
  getLocalShipments,
  saveLocalShipments,
  getPublicClient,
  fetchShipmentFromChain,
  fetchPOLoanFromChain,
  USDC_ADDRESS,
  CONTRACTS_KEY
} from '@/services/sandbox';
import escrowArtifact from '@/abi/FreightEscrow.json';
import { type ShipmentData, type BlockchainContracts, type WalletInfo, type POLoanData, type Toast, type VCData } from '@/lib/types';
import { DEFAULT_MOCK_SHIPMENTS } from '@/lib/constants';
import { type CircleWalletSession, getSavedSession } from '@/lib/circle-wallet';


interface AppContextProps {
  activeTab: 'sandbox' | 'escrows' | 'iot' | 'payroll' | 'passport' | 'advanced';
  setActiveTab: (tab: 'sandbox' | 'escrows' | 'iot' | 'payroll' | 'passport' | 'advanced') => void;
  appMode: 'local' | 'live';
  handleModeChange: (newMode: 'live' | 'local') => void;
  isInitialized: boolean;
  
  wallet: WalletInfo | null;
  setWallet: (w: WalletInfo | null) => void;
  signerType: 'sandbox' | 'web3' | 'circle';
  setSignerType: (type: 'sandbox' | 'web3' | 'circle') => void;
  sandboxBalances: { nativeGas: string; usdcToken: string; eurcToken: string };
  web3Balances: { nativeGas: string; usdcToken: string; eurcToken: string };
  circleSession: CircleWalletSession | null;
  setCircleSession: (session: CircleWalletSession | null) => void;
  circleBalances: { nativeGas: string; usdcToken: string; eurcToken: string };
  setCircleBalances: (balances: { nativeGas: string; usdcToken: string; eurcToken: string }) => void;
  contracts: BlockchainContracts | null;
  setContracts: (c: BlockchainContracts | null) => void;
  deploying: boolean;
  deployStatus: string;
  isRefreshingBalances: boolean;
  
  shipments: ShipmentData[];
  setShipments: React.Dispatch<React.SetStateAction<ShipmentData[]>>;
  selectedShipmentId: number | null;
  setSelectedShipmentId: (id: number | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  
  terminalLogs: string[];
  logTerminal: (msg: string) => void;
  toasts: Toast[];
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  
  poLoans: POLoanData[];
  setPoLoans: React.Dispatch<React.SetStateAction<POLoanData[]>>;
  poProgress: string;
  setPoProgress: (p: string) => void;
  
  stableFxInputAed: string;
  setStableFxInputAed: (val: string) => void;
  
  showVcModal: boolean;
  setShowVcModal: (show: boolean) => void;
  vcModalData: VCData | null;
  setVcModalData: (data: VCData | null) => void;
  
  connectedAddress: Address | undefined;
  isConnected: boolean;
  browserWalletClient: unknown;
  
  updateBalances: (addr: string, type: 'sandbox' | 'web3' | 'circle') => Promise<void>;
  refreshShipmentsList: (mode: 'live' | 'local', cList: BlockchainContracts | null, _wInfo: WalletInfo | null) => Promise<void>;
  refreshPOLoansList: (mode: 'live' | 'local', cList: BlockchainContracts | null) => Promise<void>;
  handleDeployContracts: () => Promise<void>;
  handleResetContracts: () => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'escrows' | 'iot' | 'payroll' | 'passport' | 'advanced'>('sandbox');
  const [appMode, setAppMode] = useState<'local' | 'live'>('local');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Wallet & Contracts
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [signerType, setSignerType] = useState<'sandbox' | 'web3' | 'circle'>('sandbox');
  const [sandboxBalances, setSandboxBalances] = useState({ nativeGas: '0.00', usdcToken: '0.00', eurcToken: '0.00' });
  const [web3Balances, setWeb3Balances] = useState({ nativeGas: '0.00', usdcToken: '0.00', eurcToken: '0.00' });
  const [circleSession, setCircleSession] = useState<CircleWalletSession | null>(null);
  const [circleBalances, setCircleBalances] = useState({ nativeGas: '0.00', usdcToken: '0.00', eurcToken: '0.00' });
  const [contracts, setContracts] = useState<BlockchainContracts | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState('');
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);

  // Wagmi/RainbowKit hooks
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: browserWalletClient } = useWalletClient();

  // Shipments State
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Terminal & Toasts
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Advanced Feature States
  const [poLoans, setPoLoans] = useState<POLoanData[]>([
    {
      id: 1,
      supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
      buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
      cargoValue: 1000,
      loanRequested: 800,
      repaymentAmount: 840,
      investor: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e',
      funded: true,
      repaid: false,
      token: USDC_ADDRESS
    }
  ]);
  const [poProgress, setPoProgress] = useState('');
  const [stableFxInputAed, setStableFxInputAed] = useState('1000');
  const [showVcModal, setShowVcModal] = useState(false);
  const [vcModalData, setVcModalData] = useState<VCData | null>(null);

  // Terminal Logger Helper
  const logTerminal = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Toast Notifications Helper
  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Balance query helper
  const updateBalances = async (addr: string, type: 'sandbox' | 'web3' | 'circle') => {
    if (!addr) return;
    if (type === 'sandbox') setIsRefreshingBalances(true);
    try {
      const bal = await queryBalances(addr as `0x${string}`);
      const formatted = {
        nativeGas: parseFloat(bal.nativeGas).toFixed(2),
        usdcToken: parseFloat(bal.usdcToken).toFixed(2),
        eurcToken: parseFloat(bal.eurcToken).toFixed(2)
      };
      if (type === 'sandbox') {
        setSandboxBalances(formatted);
      } else if (type === 'web3') {
        setWeb3Balances(formatted);
      } else {
        setCircleBalances(formatted);
      }
    } catch (e) {
      console.error('Failed to update balances', e);
    } finally {
      if (type === 'sandbox') setIsRefreshingBalances(false);
    }
  };

  // Fetch or simulate shipments
  const refreshShipmentsList = async (
    mode: 'live' | 'local', 
    cList: BlockchainContracts | null, 
    _wInfo: WalletInfo | null
  ) => {
    if (_wInfo) {
      // Unused parameter preserved for interface compatibility
    }
    setLoading(true);
    if (mode === 'local') {
      const local = getLocalShipments();
      if (local.length === 0) {
        saveLocalShipments(DEFAULT_MOCK_SHIPMENTS);
        setShipments(DEFAULT_MOCK_SHIPMENTS);
      } else {
        setShipments(local);
      }
    } else {
      if (!cList) {
        setShipments([]);
        setLoading(false);
        return;
      }
      try {
        logTerminal('Fetching shipments from Arc Testnet...');
        const shipmentsFetched: ShipmentData[] = [];
        const publicClient = getPublicClient();
        const nextId = await publicClient.readContract({
          address: cList.escrow,
          abi: escrowArtifact.abi,
          functionName: 'nextShipmentId'
        }) as bigint;

        const limit = Number(nextId);
        for (let i = 0; i < limit; i++) {
          const sData = await fetchShipmentFromChain(cList, i);
          if (sData) {
            shipmentsFetched.push(sData as ShipmentData);
          }
        }
        setShipments(shipmentsFetched);
        logTerminal(`Fetched ${shipmentsFetched.length} shipments from contract.`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Error fetching chain data: ${errMsg}`);
        showToast('Failed to fetch shipments from Arc Testnet.', 'error');
        setShipments([]);
      }
    }
    setLoading(false);
  };

  // Fetch PO loans from chain (live mode)
  const refreshPOLoansList = async (mode: 'live' | 'local', cList: BlockchainContracts | null) => {
    if (mode === 'local') {
      // Local state is preserved
    } else {
      if (!cList) return;
      try {
        const publicClient = getPublicClient();
        const nextId = await publicClient.readContract({
          address: cList.escrow,
          abi: escrowArtifact.abi,
          functionName: 'nextPOId'
        }) as bigint;
        
        const limit = Number(nextId);
        const fetched: POLoanData[] = [];
        for (let i = 0; i < limit; i++) {
          const loan = await fetchPOLoanFromChain(cList, i);
          if (loan) {
            fetched.push(loan as POLoanData);
          }
        }
        setPoLoans(fetched);
      } catch (e) {
        console.error('Error fetching PO loans:', e);
      }
    }
  };

  // Toggle mode (Live vs Local)
  const handleModeChange = (newMode: 'live' | 'local') => {
    setAppMode(newMode);
    saveAppMode(newMode);
    logTerminal(`Switched app mode to: ${newMode.toUpperCase()}`);
    showToast(`Switched to ${newMode === 'live' ? 'Live Arc Testnet' : 'Local Simulation'} Mode`, 'info');
    
    setSelectedShipmentId(null);

    const savedContracts = getSavedContracts();
    refreshShipmentsList(newMode, savedContracts, wallet);
    refreshPOLoansList(newMode, savedContracts);
  };

  // Deploy contracts
  const handleDeployContracts = async () => {
    if (!wallet || appMode !== 'live') return;
    setDeploying(true);
    setDeployStatus('Starting compilation deployment sequence...');
    logTerminal('Initiating Solidity deployer client on Arc Testnet...');

    try {
      const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
      const c = await deployContractsOnchain(signer, (status) => {
        setDeployStatus(status);
        logTerminal(status);
      });
      setContracts(c);
      showToast('Contracts deployed successfully!', 'success');
      logTerminal(`Smart Contracts Linked. Escrow: ${c.escrow}, Passport NFT: ${c.passport}`);
      if (wallet.address) await updateBalances(wallet.address, 'sandbox');
      if (connectedAddress) await updateBalances(connectedAddress, 'web3');
      refreshShipmentsList('live', c, wallet);
      refreshPOLoansList('live', c);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logTerminal(`Deployment failed: ${errorMsg}`);
      showToast('Deployment failed. Verify sandbox wallet has USDC for gas.', 'error');
    } finally {
      setDeploying(false);
      setDeployStatus('');
    }
  };

  // Reset sandbox addresses
  const handleResetContracts = () => {
    localStorage.removeItem(CONTRACTS_KEY);
    setContracts(null);
    logTerminal('Sandbox contract addresses reset.');
    showToast('Sandbox contracts cleared.', 'info');
    setShipments([]);
    setPoLoans([]);
  };

  // Load Wallet, Mode, Contracts and Shipments on mount
  useEffect(() => {
    const w = getOrCreateSandboxWallet();
    setWallet(w);
    
    const mode = getAppMode();
    setAppMode(mode);

    const savedContracts = getSavedContracts();
    setContracts(savedContracts);

    logTerminal(`App initialized in ${mode.toUpperCase()} mode.`);
    logTerminal(`Sandbox Wallet Loaded: ${w.address}`);

    if (mode === 'live') {
      if (savedContracts) {
        logTerminal(`Live Contracts Loaded: Escrow at ${savedContracts.escrow}`);
      } else {
        logTerminal(`WARNING: No active contract deployments found on Arc Testnet. Go to 'Onchain Sandbox' to deploy.`);
      }
    }

    const savedCircle = getSavedSession();
    if (savedCircle) {
      setCircleSession(savedCircle);
      setSignerType('circle');
      logTerminal(`Circle Passkey Wallet Loaded: ${savedCircle.address}`);
    }

    refreshShipmentsList(mode, savedContracts, w);
    refreshPOLoansList(mode, savedContracts);
    setIsInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wallet && wallet.address) {
      updateBalances(wallet.address, 'sandbox');
    }
  }, [wallet, appMode]);

  useEffect(() => {
    if (connectedAddress) {
      updateBalances(connectedAddress, 'web3');
    }
  }, [connectedAddress, appMode]);

  useEffect(() => {
    if (circleSession && circleSession.address) {
      updateBalances(circleSession.address, 'circle');
    }
  }, [circleSession, appMode]);

  return (
    <AppContext.Provider value={{
      activeTab,
      setActiveTab,
      appMode,
      handleModeChange,
      isInitialized,
      
      wallet,
      setWallet,
      signerType,
      setSignerType,
      sandboxBalances,
      web3Balances,
      circleSession,
      setCircleSession,
      circleBalances,
      setCircleBalances,
      contracts,
      setContracts,
      deploying,
      deployStatus,
      isRefreshingBalances,
      
      shipments,
      setShipments,
      selectedShipmentId,
      setSelectedShipmentId,
      loading,
      setLoading,
      
      terminalLogs,
      logTerminal,
      toasts,
      showToast,
      
      poLoans,
      setPoLoans,
      poProgress,
      setPoProgress,
      
      stableFxInputAed,
      setStableFxInputAed,
      
      showVcModal,
      setShowVcModal,
      vcModalData,
      setVcModalData,
      
      connectedAddress,
      isConnected,
      browserWalletClient,
      
      updateBalances,
      refreshShipmentsList,
      refreshPOLoansList,
      handleDeployContracts,
      handleResetContracts
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
