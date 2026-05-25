"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Activity, 
  Anchor, 
  Award, 
  Box, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Coins, 
  Compass, 
  Database, 
  Download, 
  FileText, 
  Landmark, 
  Loader2, 
  RefreshCw, 
  Scale, 
  ScanQrCode, 
  Send, 
  Shield, 
  ShieldCheck, 
  Thermometer, 
  Truck, 
  Wallet, 
  TrendingUp,
  Check,
  AlertTriangle,
  FileCode
} from 'lucide-react';
import { 
  getOrCreateSandboxWallet, 
  queryBalances, 
  deployContractsOnchain, 
  createShipmentOnchain, 
  triggerMilestoneOnchain, 
  pickupCargoOnchain, 
  payoutCrewOnchain, 
  fetchShipmentFromChain,
  getDemurragePenaltyOnchain,
  getPublicClient,
  getSavedContracts,
  getAppMode,
  setAppMode as saveAppMode,
  getLocalShipments,
  saveLocalShipments,
  USDC_ADDRESS,
  EURC_ADDRESS,
  CONTRACTS_KEY,
  offerShipmentForFactoringOnchain,
  cancelFactoringOfferOnchain,
  purchaseFactoredShipmentOnchain,
  requestPOFinancingOnchain,
  fundPOLoanOnchain,
  fetchPOLoanFromChain,
  setIotGatewayOnchain,
  wrapEscrowInUSYCOnchain,
  redeemUSYCOnchain,
  recordCCTPFundingOnchain,
  triggerMilestoneWithIoTSignatureOnchain,
  signIoTPayloadOnchain,
  signIoTPayloadWithWalletClient,
  type ShipmentData,
  type BlockchainContracts,
  type WalletInfo,
  type POLoanData
} from '@/services/sandbox';

import { ErrorBoundary, LoadingSkeleton, TerminalLog, ToastContainer, OnboardingHub, type Toast } from '@/components';

interface VCData {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: {
    id: string;
    legalName: string;
    role: string;
    reputationScore: number;
    creditRatingGrade: string;
    totalVolumeSettled: string;
    completedContractsCount: number;
    telematicsCompliance: string;
    poRepaymentRate: string;
  };
  proof: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    jws: string;
  };
}

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient } from 'wagmi';

import escrowArtifact from '@/abi/FreightEscrow.json';

const DEFAULT_MOCK_SHIPMENTS: ShipmentData[] = [
  {
    id: 101,
    buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
    supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
    carrier: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e',
    cargoValue: 12000,
    shippingFee: 1500,
    releasedSupplierAmount: 3600, // 30% released at Singapore
    releasedCarrierAmount: 0,
    departurePort: 'Shenzhen Port (CN)',
    destinationPort: 'Los Angeles Port (US)',
    status: 'In Transit',
    arrivedTimestamp: 0,
    customClearanceTimestamp: 0,
    pickupTimestamp: 0,
    freeTimeHours: 48,
    demurrageRatePerHour: 25,
    demurragePenaltyPaid: 0,
    passportTokenId: 88,
    temperature: -18.2, // Frozen goods
    location: 'Singapore Transshipment Hub',
    history: [
      { timestamp: Date.now() - 3 * 24 * 3600 * 1000, status: 'Created', location: 'Shenzhen Port (CN)', temperature: 22.0 },
      { timestamp: Date.now() - 2 * 24 * 3600 * 1000, status: 'Departure Milestone', location: 'South China Sea', temperature: -15.4 },
      { timestamp: Date.now() - 1 * 24 * 3600 * 1000, status: 'Singapore Checkpoint Passed (30% Payout)', location: 'Singapore Port', temperature: -18.2 }
    ],
    token: USDC_ADDRESS
  },
  {
    id: 102,
    buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
    supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
    carrier: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e',
    cargoValue: 8500,
    shippingFee: 950,
    releasedSupplierAmount: 0,
    releasedCarrierAmount: 0,
    departurePort: 'Singapore Keppel Terminal',
    destinationPort: 'Rotterdam Port (NL)',
    status: 'Created',
    arrivedTimestamp: 0,
    customClearanceTimestamp: 0,
    pickupTimestamp: 0,
    freeTimeHours: 72,
    demurrageRatePerHour: 15,
    demurragePenaltyPaid: 0,
    passportTokenId: 89,
    temperature: 4.5, // Chilled goods
    location: 'Singapore Keppel Terminal',
    history: [
      { timestamp: Date.now() - 12 * 3600 * 1000, status: 'Created', location: 'Singapore Keppel Terminal', temperature: 4.5 }
    ],
    token: EURC_ADDRESS
  }
];

function Dashboard() {
  // Navigation & Mode
  const [activeTab, setActiveTab] = useState<'sandbox' | 'escrows' | 'iot' | 'payroll' | 'passport' | 'advanced'>('sandbox');
  const [appMode, setAppMode] = useState<'local' | 'live'>('local');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Wallet & Contracts
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [signerType, setSignerType] = useState<'sandbox' | 'web3'>('sandbox');
  const [sandboxBalances, setSandboxBalances] = useState({ nativeGas: '0.00', usdcToken: '0.00', eurcToken: '0.00' });
  const [web3Balances, setWeb3Balances] = useState({ nativeGas: '0.00', usdcToken: '0.00', eurcToken: '0.00' });
  const [contracts, setContracts] = useState<BlockchainContracts | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState('');
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);

  // Wagmi/RainbowKit hooks
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: browserWalletClient } = useWalletClient();

  // Factoring state
  const [factoringPriceInput, setFactoringPriceInput] = useState('');
  const [factoringProgress, setFactoringProgress] = useState('');

  // Shipments State
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Creation Form State
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [createProgress, setCreateProgress] = useState('');
  const [formData, setFormData] = useState({
    supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
    carrier: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e',
    cargoValue: '500',
    shippingFee: '80',
    departurePort: 'Singapore Keppel Terminal',
    destinationPort: 'Rotterdam Gateway',
    freeTimeHours: '2', // small for testing
    demurrageRatePerHour: '15',
    tokenType: 'USDC' as 'USDC' | 'EURC',
    poId: '' // linked PO loan ID (optional)
  });

  // IoT Simulation & Milestones
  const [iotProgress, setIotProgress] = useState('');
  const [iotTemp, setIotTemp] = useState('4.2');
  const [iotMilestone, setIotMilestone] = useState<'departure' | 'singapore' | 'arrival' | 'customs'>('departure');
  const [iotHumidity, setIotHumidity] = useState<number>(65);
  
  // Time Accelerator Simulation
  const [demurrageMultiplier, setDemurrageMultiplier] = useState(0); // 0 = stopped, 1 = 1hr/sec, etc.
  const [simulatedTimeElapsed, setSimulatedTimeElapsed] = useState(0); // in simulated hours
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Payroll Form State
  const [payrollProgress, setPayrollProgress] = useState('');
  const [payrollCrew, setPayrollCrew] = useState([
    { name: 'Driver Chief (US)', address: '0x2e11a58c4bb489b3ab1c51cef8bc8757845ef80a', amount: '60' },
    { name: 'Route Navigator (EU)', address: '0x4b32D677cD6303Cec089B5F319D72aA797da53', amount: '20' }
  ]);

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
  const [poRequestForm, setPoRequestForm] = useState({
    buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
    cargoValue: '1000',
    loanAmount: '800',
    tokenType: 'USDC' as 'USDC' | 'EURC'
  });
  const [poProgress, setPoProgress] = useState('');

  // StableFX Conversion calculator state
  const [stableFxInputAed, setStableFxInputAed] = useState('1000');
  const convertedUsdc = parseFloat(stableFxInputAed) / 3.67;
  const convertedEurc = parseFloat(stableFxInputAed) / 3.98;

  // SME credit passport view state
  const [showVcModal, setShowVcModal] = useState(false);
  const [vcModalData, setVcModalData] = useState<VCData | null>(null);

  // 1. Terminal Logger Helper
  const logTerminal = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // 2. Toast Notifications Helper
  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // 3. Load Wallet, Mode, Contracts and Shipments on mount
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

    // Load shipments and PO loans
    refreshShipmentsList(mode, savedContracts, w);
    refreshPOLoansList(mode, savedContracts);
    setIsInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Balance query helper
  const updateBalances = async (addr: string, type: 'sandbox' | 'web3') => {
    if (!addr) return;
    if (type === 'sandbox') setIsRefreshingBalances(true);
    const bal = await queryBalances(addr as `0x${string}`);
    const formatted = {
      nativeGas: parseFloat(bal.nativeGas).toFixed(2),
      usdcToken: parseFloat(bal.usdcToken).toFixed(2),
      eurcToken: parseFloat(bal.eurcToken).toFixed(2)
    };
    if (type === 'sandbox') {
      setSandboxBalances(formatted);
      setIsRefreshingBalances(false);
    } else {
      setWeb3Balances(formatted);
    }
  };

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

  // Invoice Factoring Helpers
  const handleOfferFactoring = async (shipmentId: number, price: number) => {
    if (appMode === 'local') {
      const updated = shipments.map(s => {
        if (s.id === shipmentId) {
          return {
            ...s,
            factoringPrice: price,
            factoringActive: true
          };
        }
        return s;
      });
      setShipments(updated);
      saveLocalShipments(updated);
      showToast('Receivable offered for factoring (Local)', 'success');
      logTerminal(`Shipment #${shipmentId} receivable offered for ${price} USDC/EURC`);
    } else {
      if (!contracts || !wallet) return;
      setLoading(true);
      setFactoringProgress('Submitting factoring offer...');
      try {
        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        await offerShipmentForFactoringOnchain(signer, contracts, shipmentId, price, (status) => {
          setFactoringProgress(status);
          logTerminal(status);
        });
        showToast('Receivable offered for factoring on Arc!', 'success');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Factoring failed: ${errMsg}`);
        showToast('Factoring offer failed.', 'error');
      } finally {
        setLoading(false);
        setFactoringProgress('');
      }
    }
  };

  const handleCancelFactoring = async (shipmentId: number) => {
    if (appMode === 'local') {
      const updated = shipments.map(s => {
        if (s.id === shipmentId) {
          return {
            ...s,
            factoringActive: false
          };
        }
        return s;
      });
      setShipments(updated);
      saveLocalShipments(updated);
      showToast('Factoring offer cancelled (Local)', 'info');
    } else {
      if (!contracts || !wallet) return;
      setLoading(true);
      setFactoringProgress('Cancelling factoring offer...');
      try {
        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        await cancelFactoringOfferOnchain(signer, contracts, shipmentId, (status) => {
          setFactoringProgress(status);
          logTerminal(status);
        });
        showToast('Factoring offer cancelled on Arc!', 'success');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Factoring cancellation failed: ${errMsg}`);
        showToast('Factoring cancellation failed.', 'error');
      } finally {
        setLoading(false);
        setFactoringProgress('');
      }
    }
  };

  const handlePurchaseFactoring = async (shipmentId: number, price: number) => {
    const activeAddr = signerType === 'web3' ? connectedAddress : wallet?.address;
    if (!activeAddr) {
      showToast('No active wallet account loaded.', 'error');
      return;
    }

    const current = shipments.find(s => s.id === shipmentId);
    if (!current) return;

    if (appMode === 'local') {
      const updated = shipments.map(s => {
        if (s.id === shipmentId) {
          return {
            ...s,
            beneficiary: activeAddr,
            factoringActive: false
          };
        }
        return s;
      });
      setShipments(updated);
      saveLocalShipments(updated);
      showToast('Factored receivable purchased (Local)!', 'success');
      logTerminal(`Factoring purchase completed for Shipment #${shipmentId}. Payout beneficiary redirected to ${activeAddr}`);
    } else {
      if (!contracts || !wallet) return;
      setLoading(true);
      setFactoringProgress('Purchasing factored receivable...');
      try {
        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        await purchaseFactoredShipmentOnchain(
          signer, 
          contracts, 
          shipmentId, 
          price, 
          current.token as `0x${string}`,
          (status) => {
            setFactoringProgress(status);
            logTerminal(status);
          }
        );
        showToast('Receivable purchased on Arc!', 'success');
        await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Purchase factoring failed: ${errMsg}`);
        showToast('Purchase factoring failed. Fund investor address.', 'error');
      } finally {
        setLoading(false);
        setFactoringProgress('');
      }
    }
  };

  // Fetch or simulate shipments
  const refreshShipmentsList = async (
    mode: 'live' | 'local', 
    cList: BlockchainContracts | null, 
    wInfo: WalletInfo | null
  ) => {
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
      // Live mode - fetch from chain
      if (!cList || !wInfo) {
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
            shipmentsFetched.push(sData);
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
            fetched.push(loan);
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
    setSimulatedTimeElapsed(0);
    setDemurrageMultiplier(0);

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

  // Create Shipment
  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    setIsCreatingShipment(true);
    setCreateProgress('Preparing cargo escrow...');
    logTerminal('Creating cargo escrow shipment...');

    const val = parseFloat(formData.cargoValue);
    const fee = parseFloat(formData.shippingFee);
    const rate = parseFloat(formData.demurrageRatePerHour);
    const freeTime = parseInt(formData.freeTimeHours);
    const tokenAddr = formData.tokenType === 'EURC' ? EURC_ADDRESS : USDC_ADDRESS;
    const poIdNum = formData.poId !== '' ? parseInt(formData.poId) : 999999;

    if (appMode === 'local') {
      const newId = shipments.length > 0 ? Math.max(...shipments.map(s => s.id)) + 1 : 101;
      
      let releasedSupplier = 0;
      const beneficiary = formData.supplier;
      let hasPOLoan = false;

      // Handle local PO repayment waterfall
      if (formData.poId !== '') {
        const po = poLoans.find(p => p.id === poIdNum);
        if (po) {
          po.repaid = true;
          releasedSupplier = po.repaymentAmount;
          hasPOLoan = true;
          logTerminal(`[PO REPAYMENT WATERFALL] PO Loan #${poIdNum} Repayment amount (${po.repaymentAmount} ${formData.tokenType}) sent directly to Investor (${po.investor.slice(0,8)}...).`);
        }
      }

      const newShipment: ShipmentData = {
        id: newId,
        buyer: signerType === 'web3' && connectedAddress ? connectedAddress : wallet.address,
        supplier: formData.supplier,
        carrier: formData.carrier,
        cargoValue: val,
        shippingFee: fee,
        releasedSupplierAmount: releasedSupplier,
        releasedCarrierAmount: 0,
        departurePort: formData.departurePort,
        destinationPort: formData.destinationPort,
        status: 'Created',
        arrivedTimestamp: 0,
        customClearanceTimestamp: 0,
        pickupTimestamp: 0,
        freeTimeHours: freeTime,
        demurrageRatePerHour: rate,
        demurragePenaltyPaid: 0,
        passportTokenId: Math.floor(Math.random() * 1000) + 100,
        temperature: parseFloat(iotTemp),
        location: formData.departurePort,
        history: [
          { timestamp: Date.now(), status: 'Created', location: formData.departurePort, temperature: parseFloat(iotTemp) }
        ],
        createdTimestamp: Date.now(),
        yieldEarned: 0,
        temperatureViolations: 0,
        temperaturePenalty: 0,
        beneficiary: beneficiary,
        factoringPrice: 0,
        factoringActive: false,
        token: tokenAddr,
        poId: hasPOLoan ? poIdNum : undefined,
        hasPOLoan: hasPOLoan
      };

      const updated = [newShipment, ...shipments];
      setShipments(updated);
      saveLocalShipments(updated);
      setSelectedShipmentId(newId);
      logTerminal(`Local Shipment #${newId} Escrow created. Deposited ${val + fee} ${formData.tokenType}.`);
      showToast('Local Cargo Escrow Created!', 'success');
      setIsCreatingShipment(false);
      setCreateProgress('');
      setFormData({
        ...formData,
        poId: ''
      });
      setActiveTab('escrows');
    } else {
      // Live on-chain
      if (!contracts) {
        showToast('Please deploy sandbox contracts first!', 'error');
        setIsCreatingShipment(false);
        return;
      }

      try {
        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        const { shipmentId, txHash } = await createShipmentOnchain(
          signer,
          contracts,
          {
            supplier: formData.supplier,
            carrier: formData.carrier,
            cargoValue: val,
            shippingFee: fee,
            departurePort: formData.departurePort,
            destinationPort: formData.destinationPort,
            freeTimeHours: freeTime,
            demurrageRatePerHour: rate,
            token: tokenAddr as `0x${string}`,
            poId: poIdNum
          },
          (status) => {
            setCreateProgress(status);
            logTerminal(status);
          }
        );

        showToast(`Onchain Shipment #${shipmentId} Created!`, 'success');
        logTerminal(`Tx Confirmed: ${txHash.slice(0, 15)}... (GTV: ${val + fee} ${formData.tokenType})`);
        
        if (wallet.address) await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
        await refreshPOLoansList('live', contracts);
        setSelectedShipmentId(shipmentId);
        
        setIsCreatingShipment(false);
        setCreateProgress('');
        setFormData({
          ...formData,
          poId: ''
        });
        setActiveTab('escrows');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Onchain creation failed: ${errMsg}`);
        showToast('Token transfer or creation failed. Fund your address.', 'error');
        setIsCreatingShipment(false);
        setCreateProgress('');
      }
    }
  };

  // PO Financing Request Submission
  const handleRequestPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    setLoading(true);
    setPoProgress('Creating PO financing request...');
    logTerminal('Submitting Purchase Order Financing Request...');

    const val = parseFloat(poRequestForm.cargoValue);
    const loan = parseFloat(poRequestForm.loanAmount);
    const tokenAddr = poRequestForm.tokenType === 'EURC' ? EURC_ADDRESS : USDC_ADDRESS;

    if (loan > val * 0.8) {
      showToast('Loan request limit is 80% of cargo value.', 'warning');
      setLoading(false);
      setPoProgress('');
      return;
    }

    if (appMode === 'local') {
      const newId = poLoans.length > 0 ? Math.max(...poLoans.map(p => p.id)) + 1 : 1;
      const newPO: POLoanData = {
        id: newId,
        supplier: signerType === 'web3' && connectedAddress ? connectedAddress : wallet.address,
        buyer: poRequestForm.buyer,
        cargoValue: val,
        loanRequested: loan,
        repaymentAmount: loan * 1.05,
        investor: '0x0000000000000000000000000000000000000000',
        funded: false,
        repaid: false,
        token: tokenAddr
      };
      const updated = [newPO, ...poLoans];
      setPoLoans(updated);
      logTerminal(`Local PO Request #${newId} created. Capped interest: 5% (Total Repayment: ${newPO.repaymentAmount} ${poRequestForm.tokenType})`);
      showToast('Local PO Request Created!', 'success');
      setPoRequestForm({
        buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
        cargoValue: '1000',
        loanAmount: '800',
        tokenType: 'USDC'
      });
      setPoProgress('');
      setLoading(false);
    } else {
      if (!contracts) {
        showToast('Please deploy sandbox contracts first!', 'error');
        setLoading(false);
        setPoProgress('');
        return;
      }
      try {
        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        const { poId, txHash } = await requestPOFinancingOnchain(
          signer,
          contracts,
          {
            buyer: poRequestForm.buyer,
            cargoValue: val,
            loanAmount: loan,
            token: tokenAddr as `0x${string}`
          },
          (status) => {
            setPoProgress(status);
            logTerminal(status);
          }
        );
        showToast(`Onchain PO Request #${poId} Created!`, 'success');
        logTerminal(`Tx Confirmed: ${txHash.slice(0, 15)}...`);
        await refreshPOLoansList('live', contracts);
        setPoRequestForm({
          buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
          cargoValue: '1000',
          loanAmount: '800',
          tokenType: 'USDC'
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`PO Request failed: ${errMsg}`);
        showToast('PO Request failed. Fund your address.', 'error');
      } finally {
        setLoading(false);
        setPoProgress('');
      }
    }
  };

  // Fund PO Loan
  const handleFundPO = async (poId: number) => {
    if (!wallet) return;
    const loan = poLoans.find(p => p.id === poId);
    if (!loan) return;
    setLoading(true);
    setPoProgress(`Funding PO loan #${poId}...`);
    logTerminal(`Funding PO Financing Request #${poId}...`);

    const activeAddr = signerType === 'web3' ? connectedAddress : wallet.address;
    if (!activeAddr) {
      showToast('No active wallet account loaded.', 'error');
      setLoading(false);
      setPoProgress('');
      return;
    }

    if (appMode === 'local') {
      const updated = poLoans.map(p => {
        if (p.id === poId) {
          return {
            ...p,
            investor: activeAddr,
            funded: true
          };
        }
        return p;
      });
      setPoLoans(updated);
      logTerminal(`Local PO Loan #${poId} funded by investor ${activeAddr}. Supplier receives raw cash advance.`);
      showToast('Local PO Loan Funded!', 'success');
      setPoProgress('');
      setLoading(false);
    } else {
      if (!contracts) return;
      try {
        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        const hash = await fundPOLoanOnchain(
          signer,
          contracts,
          poId,
          loan.loanRequested,
          loan.token as `0x${string}`,
          (status) => {
            setPoProgress(status);
            logTerminal(status);
          }
        );
        showToast(`PO Loan #${poId} Funded on Arc!`, 'success');
        logTerminal(`Tx Confirmed: ${hash.slice(0, 15)}...`);
        if (wallet.address) await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshPOLoansList('live', contracts);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Funding failed: ${errMsg}`);
        showToast('Funding failed. Verify investor token allowance.', 'error');
      } finally {
        setLoading(false);
        setPoProgress('');
      }
    }
  };

  // IoT simulation milestone trigger
  const handleTriggerMilestone = async (milestone: 'departure' | 'singapore' | 'arrival' | 'customs') => {
    if (selectedShipmentId === null) return;
    const current = shipments.find(s => s.id === selectedShipmentId);
    if (!current) return;
    
    setLoading(true);
    setIotProgress(`Processing IoT payload for ${milestone.toUpperCase()}...`);
    logTerminal(`Container IoT GPS ping received. Port: ${milestone === 'singapore' ? 'Singapore' : current.destinationPort}. Temp: ${iotTemp}°C`);

    const temperature = parseFloat(iotTemp);
    const tokenSymbol = current.token === EURC_ADDRESS ? 'EURC' : 'USDC';

    if (appMode === 'local') {
      const updatedHistory = [...current.history];
      let newStatus: ShipmentData['status'] = current.status;
      let newLocation = current.location;
      let releasedSupplier = current.releasedSupplierAmount;
      let arrivedTs = current.arrivedTimestamp;
      let customsTs = current.customClearanceTimestamp;

      let violations = current.temperatureViolations || 0;
      let tempPenalty = current.temperaturePenalty || 0;
      if (temperature > 8.0) {
        violations += 1;
        tempPenalty = violations * 0.05 * current.cargoValue;
        logTerminal(`[IOT PENALTY TRIGGER] Temp: ${temperature}°C (> 8.0°C). Violation logged. Deducting 5% of cargo value (${0.05 * current.cargoValue} ${tokenSymbol})`);
      }

      const timeInTransitSeconds = (Date.now() - (current.createdTimestamp || Date.now())) / 1000;
      const hoursTransit = timeInTransitSeconds / 3600;
      const simulatedYield = parseFloat((current.cargoValue * 0.05 * (hoursTransit || 0.1) / 8760).toFixed(6));

      if (milestone === 'departure') {
        newStatus = 'In Transit';
        newLocation = current.departurePort;
        updatedHistory.push({ timestamp: Date.now(), status: 'Departure Milestone', location: newLocation, temperature });
      } else if (milestone === 'singapore') {
        if (current.hasPOLoan) {
          logTerminal(`Singapore payout skipped for PO Financed shipment to avoid double payout.`);
        } else {
          releasedSupplier = current.cargoValue * 0.3; // 30% released
        }
        updatedHistory.push({ 
          timestamp: Date.now(), 
          status: current.hasPOLoan ? 'Singapore Checkpoint Passed (Financed Payout Skipped)' : `Singapore Checkpoint Passed (30% Payout Released)`, 
          location: 'Singapore Transshipment Hub', 
          temperature 
        });
      } else if (milestone === 'arrival') {
        newStatus = 'Arrived';
        newLocation = current.destinationPort;
        arrivedTs = Date.now();
        updatedHistory.push({ timestamp: Date.now(), status: 'Arrived at Destination Port', location: newLocation, temperature });
      } else if (milestone === 'customs') {
        newStatus = 'Customs Cleared';
        customsTs = Date.now();
        updatedHistory.push({ timestamp: Date.now(), status: 'Customs Cleared - Ready for Pickup', location: current.destinationPort, temperature });
      }

      const updatedShipment: ShipmentData = {
        ...current,
        status: newStatus,
        location: newLocation,
        releasedSupplierAmount: releasedSupplier,
        arrivedTimestamp: arrivedTs,
        customClearanceTimestamp: customsTs,
        temperature,
        temperatureViolations: violations,
        temperaturePenalty: tempPenalty,
        yieldEarned: simulatedYield,
        history: updatedHistory
      };

      const updatedList = shipments.map(s => s.id === selectedShipmentId ? updatedShipment : s);
      setShipments(updatedList);
      saveLocalShipments(updatedList);
      logTerminal(`Local Shipment #${current.id} state updated to: ${newStatus}`);
      showToast(`Milestone: ${milestone.toUpperCase()} updated.`, 'success');
      setLoading(false);
      setIotProgress('');
    } else {
      // Live on-chain
      if (!contracts || !wallet) return;
      try {
        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        const hash = await triggerMilestoneOnchain(
          signer,
          contracts,
          selectedShipmentId,
          milestone,
          temperature,
          (status) => {
            setIotProgress(status);
            logTerminal(status);
          }
        );

        showToast(`Milestone ${milestone.toUpperCase()} Confirmed!`, 'success');
        logTerminal(`Tx Confirmed: ${hash.slice(0, 15)}...`);

        if (wallet.address) await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Milestone failed: ${errMsg}`);
        showToast('Milestone execution failed.', 'error');
      } finally {
        setLoading(false);
        setIotProgress('');
      }
    }
  };

  // Demurrage Timer accelerator simulator
  useEffect(() => {
    if (demurrageMultiplier === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSimulatedTimeElapsed(prev => prev + demurrageMultiplier);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [demurrageMultiplier]);

  const currentShipment = shipments.find(s => s.id === selectedShipmentId);
  const demurrageHoursLate = currentShipment && currentShipment.status === 'Customs Cleared'
    ? Math.max(0, simulatedTimeElapsed - currentShipment.freeTimeHours)
    : 0;
  const simulatedDemurragePenalty = currentShipment
    ? demurrageHoursLate * currentShipment.demurrageRatePerHour
    : 0;

  // Pickup Container
  const handlePickupCargo = async () => {
    if (selectedShipmentId === null || !currentShipment || !wallet) return;
    setLoading(true);
    const tokenSymbol = currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC';
    logTerminal(`Initiating Cargo Pickup container release. Target Shipment: #${currentShipment.id}`);

    if (appMode === 'local') {
      const penalty = simulatedDemurragePenalty;
      const tempPenalty = currentShipment.temperaturePenalty || 0;
      const yieldRebate = currentShipment.yieldEarned || 0;
      
      const platformFee = (currentShipment.cargoValue + currentShipment.shippingFee) * 0.0025;
      
      const beneficiaryAddr = currentShipment.beneficiary || currentShipment.supplier;
      const supplierPayout = Math.max(0, (currentShipment.cargoValue - currentShipment.releasedSupplierAmount) - tempPenalty - (currentShipment.cargoValue * 0.0025));
      const carrierPayout = Math.max(0, currentShipment.shippingFee - (currentShipment.shippingFee * 0.0025));

      const updatedHistory = [...currentShipment.history];
      if (penalty > 0) {
        updatedHistory.push({ 
          timestamp: Date.now(), 
          status: `Demurrage Penalty Charged: ${penalty} ${tokenSymbol} (${demurrageHoursLate} Hours Late)`, 
          location: currentShipment.destinationPort, 
          temperature: currentShipment.temperature 
        });
      }
      if (tempPenalty > 0) {
        updatedHistory.push({
          timestamp: Date.now(),
          status: `Quality Breach Temperature Penalty Applied: -${tempPenalty} ${tokenSymbol} deducted from supplier.`,
          location: currentShipment.destinationPort,
          temperature: currentShipment.temperature
        });
      }
      if (yieldRebate > 0) {
        updatedHistory.push({
          timestamp: Date.now(),
          status: `USYC Treasury Escrow Yield Rebate Paid to Buyer: +${yieldRebate} ${tokenSymbol}.`,
          location: currentShipment.destinationPort,
          temperature: currentShipment.temperature
        });
      }
      updatedHistory.push({ 
        timestamp: Date.now(), 
        status: `Cargo Delivered. Settle Beneficiary (${beneficiaryAddr.slice(0, 8)}...): ${supplierPayout} ${tokenSymbol}, Carrier: ${carrierPayout} ${tokenSymbol}. Escrow fee: ${platformFee} ${tokenSymbol}.`, 
        location: currentShipment.destinationPort, 
        temperature: currentShipment.temperature 
      });

      const updatedShipment: ShipmentData = {
        ...currentShipment,
        status: 'Completed',
        pickupTimestamp: Date.now(),
        demurragePenaltyPaid: penalty,
        history: updatedHistory
      };

      const updatedList = shipments.map(s => s.id === selectedShipmentId ? updatedShipment : s);
      setShipments(updatedList);
      saveLocalShipments(updatedList);
      
      logTerminal(`Local Shipment #${currentShipment.id} Completed! Settled beneficiary: ${supplierPayout} ${tokenSymbol}, Carrier ${carrierPayout} ${tokenSymbol}.`);
      showToast('Cargo Released & Escrow Disbursed!', 'success');
      setLoading(false);
      setDemurrageMultiplier(0);
      setSimulatedTimeElapsed(0);
    } else {
      // Live on chain
      if (!contracts) return;
      try {
        const onchainPenalty = await getDemurragePenaltyOnchain(contracts, selectedShipmentId);
        logTerminal(`Onchain Demurrage Penalty query returned: ${onchainPenalty.penaltyAmount} ${tokenSymbol} (${onchainPenalty.hoursLate} hours late)`);

        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        const hash = await pickupCargoOnchain(
          signer,
          contracts,
          selectedShipmentId,
          onchainPenalty.penaltyAmount,
          currentShipment.token as `0x${string}`,
          (status) => {
            logTerminal(status);
          }
        );

        showToast('Cargo Picked Up & Escrow Disbursed!', 'success');
        logTerminal(`Settlement confirmed on Arc. Tx: ${hash.slice(0, 15)}...`);
        
        if (wallet.address) await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
        
        setDemurrageMultiplier(0);
        setSimulatedTimeElapsed(0);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Pickup failed: ${errMsg}`);
        showToast('Pickup transaction failed. Verify wallet approvals.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  // Mass Payroll
  const handlePayoutCrew = async () => {
    if (selectedShipmentId === null || !currentShipment || !wallet) return;
    setLoading(true);
    setPayrollProgress('Preparing Mass Payroll structure...');
    const tokenSymbol = currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC';
    logTerminal(`Preparing crew payroll for Shipment #${currentShipment.id}. Carrier address: ${currentShipment.carrier}`);

    const crewAddresses = payrollCrew.map(c => c.address);
    const crewAmounts = payrollCrew.map(c => parseFloat(c.amount));
    const totalDisbursed = crewAmounts.reduce((a, b) => a + b, 0);

    if (appMode === 'local') {
      const updatedHistory = [...currentShipment.history];
      updatedHistory.push({
        timestamp: Date.now(),
        status: `Mass Payroll disbursed: ${totalDisbursed} ${tokenSymbol} split between ${payrollCrew.length} crew members.`,
        location: currentShipment.destinationPort,
        temperature: currentShipment.temperature
      });

      const updatedShipment = {
        ...currentShipment,
        releasedCarrierAmount: currentShipment.releasedCarrierAmount + totalDisbursed,
        history: updatedHistory
      };

      const updatedList = shipments.map(s => s.id === selectedShipmentId ? updatedShipment : s);
      setShipments(updatedList);
      saveLocalShipments(updatedList);

      logTerminal(`Local Mass Payroll disburse complete! Distributed ${totalDisbursed} ${tokenSymbol} to drivers.`);
      showToast('Mass Payroll disbursed locally!', 'success');
      setLoading(false);
      setPayrollProgress('');
    } else {
      // Live on chain
      if (!contracts) return;
      try {
        const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
        const hash = await payoutCrewOnchain(
          signer,
          contracts,
          selectedShipmentId,
          crewAddresses,
          crewAmounts,
          currentShipment.token as `0x${string}`,
          (status) => {
            setPayrollProgress(status);
            logTerminal(status);
          }
        );

        showToast('Onchain Mass Payroll Disbursed!', 'success');
        logTerminal(`Mass Pay confirmed. Tx: ${hash.slice(0, 15)}...`);
        
        if (wallet.address) await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Mass Pay failed: ${errMsg}`);
        showToast('Mass Pay disbursement failed. Check balances/allowance.', 'error');
      } finally {
        setLoading(false);
        setPayrollProgress('');
      }
    }
  };

  // Dynamic Credit Passport computation from real shipment/PO data
  const computePassportStats = useCallback((role: 'supplier' | 'buyer' | 'carrier') => {
    const addrMap: Record<string, string> = {
      supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
      buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
      carrier: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e'
    };
    const nameMap: Record<string, string> = {
      supplier: 'Shenzhen Maritime Suppliers',
      buyer: 'Rotterdam Importers Ltd',
      carrier: 'Global Logistics Carrier'
    };
    const addr = addrMap[role];
    const name = nameMap[role];

    // Count shipments involving this role
    const roleShipments = shipments.filter(s => {
      if (role === 'supplier') return s.supplier.toLowerCase() === addr.toLowerCase();
      if (role === 'buyer') return s.buyer.toLowerCase() === addr.toLowerCase();
      return s.carrier.toLowerCase() === addr.toLowerCase();
    });

    const completedShipments = roleShipments.filter(s => s.status === 'Completed');
    const totalCount = roleShipments.length;
    const completedCount = completedShipments.length;

    // Settled volume
    const settledVolume = completedShipments.reduce((sum, s) => sum + s.cargoValue + s.shippingFee, 0);

    // Telematics violations
    const totalViolations = roleShipments.reduce((sum, s) => sum + (s.temperatureViolations || 0), 0);
    const complianceRate = totalCount > 0 ? Math.max(0, 100 - (totalViolations / Math.max(totalCount, 1)) * 15) : 100;

    // Demurrage overdrafts (buyer-specific)
    const demurrageOverdrafts = completedShipments.filter(s => s.demurragePenaltyPaid > 0).length;
    const onTimeRate = completedCount > 0 ? ((completedCount - demurrageOverdrafts) / completedCount * 100) : 100;

    // PO repayment rate
    const rolePOs = poLoans.filter(p => {
      if (role === 'supplier') return p.supplier.toLowerCase() === addr.toLowerCase();
      if (role === 'buyer') return p.buyer.toLowerCase() === addr.toLowerCase();
      return false;
    });
    const fundedPOs = rolePOs.filter(p => p.funded);
    const repaidPOs = rolePOs.filter(p => p.repaid);
    const poRepayRate = fundedPOs.length > 0 ? (repaidPOs.length / fundedPOs.length * 100) : 100;

    // Credit grade calculation
    const rawScore = Math.min(100, Math.round(
      40 + // base
      Math.min(20, completedCount * 3) + // experience bonus
      Math.min(20, complianceRate * 0.2) + // compliance bonus
      Math.min(10, poRepayRate * 0.1) + // repayment bonus
      Math.min(10, onTimeRate * 0.1) // on-time bonus
    ));

    let grade = 'B';
    if (rawScore >= 95) grade = 'AAA';
    else if (rawScore >= 88) grade = 'AA';
    else if (rawScore >= 80) grade = 'A';
    else if (rawScore >= 70) grade = 'BBB';
    else if (rawScore >= 60) grade = 'BB';

    return {
      addr, name, rawScore, grade,
      totalCount, completedCount, settledVolume,
      complianceRate: complianceRate.toFixed(1),
      onTimeRate: onTimeRate.toFixed(1),
      poRepayRate: poRepayRate.toFixed(0),
      totalViolations, demurrageOverdrafts
    };
  }, [shipments, poLoans]);

  // Cryptographic Credential Issuer exporter (uses dynamic stats)
  const handleExportVc = (role: 'supplier' | 'buyer' | 'carrier') => {
    const stats = computePassportStats(role);

    const doc: VCData = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://schema.org"
      ],
      "id": `urn:uuid:${Math.random().toString(36).substring(2, 15)}`,
      "type": ["VerifiableCredential", "TradeReputationCredential"],
      "issuer": `did:freightx:${contracts?.escrow || "0xActiveContractSuiteAddress"}`,
      "issuanceDate": new Date().toISOString(),
      "credentialSubject": {
        "id": `did:ethr:${stats.addr}`,
        "legalName": stats.name,
        "role": role.toUpperCase(),
        "reputationScore": stats.rawScore,
        "creditRatingGrade": stats.grade,
        "totalVolumeSettled": `${stats.settledVolume.toLocaleString()} USDC equivalent`,
        "completedContractsCount": stats.completedCount,
        "telematicsCompliance": `${stats.complianceRate}%`,
        "poRepaymentRate": `${stats.poRepayRate}%`
      },
      "proof": {
        "type": "JsonWebSignature2020",
        "created": new Date().toISOString(),
        "proofPurpose": "assertionMethod",
        "verificationMethod": `did:freightx:${contracts?.escrow || "0xActiveContractSuiteAddress"}#key-1`,
        "jws": "eyJhbGciOiJSUzI1NiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19...tS7s8"
      }
    };

    setVcModalData(doc);
    setShowVcModal(true);
    logTerminal(`Exported cryptographic Verifiable Credential (VC) for ${stats.name}.`);
  };

  // Helper: Status to CSS Class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Created': return 'badge-muted';
      case 'In Transit': return 'badge-primary';
      case 'Arrived': return 'badge-warning';
      case 'Customs Cleared': return 'badge-warning pulsing-glow';
      case 'Completed': return 'badge-success';
      case 'Cancelled': return 'badge-danger';
      default: return 'badge-muted';
    }
  };

  if (!isInitialized) {
    return <LoadingSkeleton />;
  }

  return (
    <ErrorBoundary>
    <div style={{ paddingBottom: '320px' }}>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />

      {/* Main App Container */}
      <div className="container" style={{ paddingTop: '2.5rem' }}>
        
        {/* Page Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="glass-panel" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: '10px', borderColor: 'rgba(0,136,255,0.3)', background: 'rgba(0,136,255,0.1)' }}>
                <Anchor size={22} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff 0%, var(--text-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>FreightX</h1>
                <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Secure Escrows & B2B Logistics Working Capital</p>
              </div>
            </div>
          </div>

          {/* Mode & Network Selection Banner */}
          <div className="glass-panel" style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} style={{ color: appMode === 'live' ? 'var(--success)' : 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Operating Mode:</span>
              {appMode === 'live' ? (
                <span className="badge badge-primary" style={{ textTransform: 'none' }}>Secure Ledger Network (Arc Testnet)</span>
              ) : (
                <span className="badge badge-muted" style={{ textTransform: 'none' }}>Visual Sandbox Simulator</span>
              )}
            </div>
            
            <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>

            <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => handleModeChange('local')} 
                className={`btn`} 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px', background: appMode === 'local' ? 'var(--bg-surface-elevated)' : 'transparent', color: appMode === 'local' ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                Sandbox Simulator
              </button>
              <button 
                onClick={() => handleModeChange('live')} 
                className={`btn`} 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px', background: appMode === 'live' ? 'var(--bg-surface-elevated)' : 'transparent', color: appMode === 'live' ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                Live Network
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Main Grid layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', minHeight: '600px' }}>
          
          {/* Sidebar Area: Sandbox Wallet Widget */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Wallet Panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wallet size={18} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Trade Wallet Accounts</h3>
                </div>
                <button 
                  onClick={() => {
                    if (wallet?.address) updateBalances(wallet.address, 'sandbox');
                    if (connectedAddress) updateBalances(connectedAddress, 'web3');
                  }}
                  className="btn btn-secondary btn-icon" 
                  style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                  disabled={isRefreshingBalances}
                >
                  <RefreshCw size={12} className={isRefreshingBalances ? 'animate-spin-slow' : ''} />
                </button>
              </div>

              {appMode === 'live' && (
                <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '0.25rem' }}>
                  <button 
                    onClick={() => setSignerType('sandbox')}
                    className="btn"
                    style={{ flex: 1, padding: '0.35rem', fontSize: '0.7rem', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: signerType === 'sandbox' ? 'var(--bg-surface-elevated)' : 'transparent', color: signerType === 'sandbox' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    Quick Sandbox Wallet
                  </button>
                  <button 
                    onClick={() => setSignerType('web3')}
                    className="btn"
                    style={{ flex: 1, padding: '0.35rem', fontSize: '0.7rem', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: signerType === 'web3' ? 'var(--bg-surface-elevated)' : 'transparent', color: signerType === 'web3' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    Browser Web3 Wallet
                  </button>
                </div>
              )}

              {signerType === 'sandbox' || appMode === 'local' ? (
                wallet ? (
                  <div>
                    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                      <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>WALLET ACCOUNT ADDRESS</span>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{wallet.address}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>GAS / SECURITIES FEE (USDC)</span>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{sandboxBalances.nativeGas}</strong>
                      </div>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>USDC BALANCE</span>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{sandboxBalances.usdcToken}</strong>
                      </div>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>EURC BALANCE</span>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--success)' }}>{sandboxBalances.eurcToken}</strong>
                      </div>
                    </div>

                    {appMode === 'live' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                        <a 
                          href="https://faucet.circle.com" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn btn-secondary" 
                          style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', width: '100%' }}
                        >
                          Claim Free Test Funds <ChevronRight size={14} />
                        </a>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', display: 'block' }}>
                          Circles faucet provides both Gas & Stablecoin balances
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px' }}>
                    <Loader2 className="animate-spin-slow" size={24} />
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
                  </div>

                  {isConnected && connectedAddress ? (
                    <div>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>CONNECTED BROWSER WALLET</span>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{connectedAddress}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>GAS / SECURITIES FEE (USDC)</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{web3Balances.nativeGas}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>USDC BALANCE</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{web3Balances.usdcToken}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>EURC BALANCE</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--success)' }}>{web3Balances.eurcToken}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg-main)', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '1.25rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click the connect button above to link your web3 browser wallet.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Smart Contract Info Panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} style={{ color: 'var(--secondary)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Secure Gateway Protocol</h3>
              </div>

              {appMode === 'live' ? (
                contracts ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem' }}>
                      <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>ESCROW LEDGER ADDRESS</span>
                      <a href={`https://testnet.arcscan.app/address/${contracts.escrow}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                        {contracts.escrow.slice(0, 16)}...{contracts.escrow.slice(-8)}
                      </a>
                    </div>
                    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem' }}>
                      <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>CARGO DIGITAL TWIN TOKEN</span>
                      <a href={`https://testnet.arcscan.app/address/${contracts.passport}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                        {contracts.passport.slice(0, 16)}...{contracts.passport.slice(-8)}
                      </a>
                    </div>
                    
                    <button 
                      onClick={handleResetContracts}
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', width: '100%', borderColor: 'rgba(255,23,68,0.2)', color: 'var(--danger)' }}
                    >
                      Reset connection settings
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', textAlign: 'center', padding: '0.5rem' }}>
                    <AlertTriangle style={{ color: 'var(--warning)', width: '28px', height: '28px' }} />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      No active FreightX secure gateway detected on Arc Testnet.
                    </p>
                    <button 
                      onClick={() => setActiveTab('sandbox')}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', width: '100%' }}
                    >
                      Configure Gateway
                    </button>
                  </div>
                )
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1rem', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Using Offline Sandbox Simulator.<br />Transactions are instant and free.
                  </p>
                </div>
              )}
            </div>

            {/* Business stats mini widget */}
            <div className="glass-panel glass-panel-accent" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Scale size={16} style={{ color: 'var(--success)' }} />
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>System Trade Costs</h4>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Escrow protection rate:</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success)' }}>0.25% cargo value</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total active/settled cargo:</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>{shipments.length}</span>
              </div>
            </div>

          </aside>

          {/* Main workspace */}
          <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* SME Friendly Interactive Walkthrough */}
            <OnboardingHub 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              appMode={appMode} 
              setAppMode={handleModeChange} 
              contracts={contracts} 
              shipments={shipments} 
              selectedShipmentId={selectedShipmentId} 
              setSelectedShipmentId={setSelectedShipmentId} 
            />

            {/* Main Navigation tabs */}
            <div className="tab-container">
              <button onClick={() => setActiveTab('sandbox')} className={`tab-btn ${activeTab === 'sandbox' ? 'active' : ''}`}>
                <Shield size={16} /> Gateway Hub
              </button>
              <button onClick={() => setActiveTab('escrows')} className={`tab-btn ${activeTab === 'escrows' ? 'active' : ''}`}>
                <Landmark size={16} /> Escrow Shipments
              </button>
              <button onClick={() => setActiveTab('iot')} className={`tab-btn ${activeTab === 'iot' ? 'active' : ''}`}>
                <Activity size={16} /> IoT Tracking
              </button>
              <button onClick={() => setActiveTab('payroll')} className={`tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}>
                <Coins size={16} /> Instant Payroll
              </button>
              <button onClick={() => setActiveTab('passport')} className={`tab-btn ${activeTab === 'passport' ? 'active' : ''}`}>
                <ScanQrCode size={16} /> Reputation Passports
              </button>
              <button onClick={() => setActiveTab('advanced')} className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}>
                <Award size={16} /> Capital Marketplace
              </button>
            </div>

            {/* TAB CONTENT: SANDBOX SETUP */}
            {activeTab === 'sandbox' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-panel">
                  <h2 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck style={{ color: 'var(--primary)' }} /> Deploy Secure Trade Gateways
                  </h2>
                  <p style={{ marginBottom: '1.25rem' }}>
                    Activate the smart escrow and tracking gateways on Arc. System processing fees are paid transparently using stablecoins (USDC) rather than highly volatile digital assets.
                  </p>

                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', marginBottom: '0.75rem' }}>GATEWAY SERVICES TO BE DEPLOYED:</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span className="badge badge-primary">CARGO PASSPORT</span>
                          <strong style={{ fontSize: '0.85rem' }}>Cargo Digital Twin Passport (NFT)</strong>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Tokenizes your container into an immutable digital record. Log GPS pings, temperature graphs, and shipping timelines transparently without any risk of alteration.
                        </span>
                      </div>
                      
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span className="badge badge-success">DIGITAL VAULT</span>
                          <strong style={{ fontSize: '0.85rem' }}>Milestone Escrow Gateway</strong>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Automates payments via USDC/EURC stablecoins. Funds are securely locked in a digital vault, released based on verified delivery milestones, and subjected to automated demurrage rules.
                        </span>
                      </div>
                    </div>
                  </div>

                  {appMode === 'live' ? (
                    <div>
                      {contracts ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                          <div className="flex-center" style={{ width: '48px', height: '48px', background: 'rgba(0,230,118,0.1)', borderRadius: '50%', color: 'var(--success)', margin: '0 auto 1rem' }}>
                            <ShieldCheck size={28} />
                          </div>
                          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>FreightX Secure Gateways are Online!</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto 1.5rem' }}>
                            The secure protocol contracts have been deployed on Arc Testnet. You can now proceed to manage milestone escrows and purchase receivables.
                          </p>
                          <div className="flex-center" style={{ gap: '1rem' }}>
                            <button onClick={() => setActiveTab('escrows')} className="btn btn-primary">
                              Open Escrow Dashboard
                            </button>
                            <button onClick={handleResetContracts} className="btn btn-secondary" style={{ color: 'var(--danger)' }}>
                              Reset deployed instances
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                              <Clock size={16} style={{ color: 'var(--warning)', marginTop: '0.15rem' }} />
                              <div>
                                <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--warning)' }}>Deployment Requirements:</strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Ensure your sandbox wallet holds gas/stablecoin balances (approx. 0.5 USDC required for deployment). Use the faucet on the left panel to top up for free.
                                </span>
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={handleDeployContracts} 
                            disabled={deploying}
                            className="btn btn-primary" 
                            style={{ width: '100%', padding: '1rem' }}
                          >
                            {deploying ? (
                              <>
                                <Loader2 className="animate-spin-slow" size={18} /> {deployStatus}
                              </>
                            ) : (
                              <>
                                <Database size={18} /> Deploy Secure Trade Protocol to Arc Network
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem 0', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                      <Compass size={32} style={{ color: 'var(--primary)', marginBottom: '0.75rem' }} />
                      <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Running Offline Sandbox Simulation</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.25rem' }}>
                        Sandbox mode stores simulation records locally in memory, executing instantly and at zero cost. Toggle &quot;Live Network&quot; in the header to transact on the public testnet.
                      </p>
                      <button onClick={() => handleModeChange('live')} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                        Switch to Live Testnet
                      </button>
                    </div>
                  )}
                </div>

                {/* FAQ section */}
                <div className="glass-panel">
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Advantage of Digital Stablecoin Escrows (USDC/EURC)</h3>
                  <div className="grid-cols-2" style={{ gap: '1.25rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>1. Milestone-Based Automated Payouts</h4>
                      <p style={{ fontSize: '0.75rem' }}>
                        Escrowed funds are protected and partially disbursed automatically when cold-chain telemetry verifies specific checkpoint arrivals (e.g., 30% upon clearing transit hubs), unlocking immediate liquidity.
                      </p>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>2. Sub-Second Instant Settlement</h4>
                      <p style={{ fontSize: '0.75rem' }}>
                        Settlement is confirmed in under a second. Upon final QR delivery verification, carrier fee disbursements land in driver wallets instantly, bypassing traditional net 30/90 delays.
                      </p>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>3. Harmonized Multi-Currency Options</h4>
                      <p style={{ fontSize: '0.75rem' }}>
                        Exporters and importers can select USD-pegged (USDC) or EUR-pegged (EURC) stable assets to perfectly hedge currency volatility during intercontinental transport.
                      </p>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>4. Embedded Purchase Order Financing</h4>
                      <p style={{ fontSize: '0.75rem' }}>
                        Suppliers can query capital pools for immediate PO financing from private investors. Repayments are trustlessly auto-deducted when the buyer deposits the escrow, removing default risks.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: ESCROWS & CREATE SHIPMENT */}
            {activeTab === 'escrows' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Header with Create Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem' }}>Milestone Escrow Transactions</h2>
                    <p style={{ fontSize: '0.8rem' }}>Deploys or tracks secure cargo payment vaults with automated release conditions.</p>
                  </div>
                  
                  {!isCreatingShipment && (
                    <button onClick={() => setIsCreatingShipment(true)} className="btn btn-primary">
                      <Box size={16} /> Create Escrow Vault
                    </button>
                  )}
                </div>

                {/* StableFX Live conversion and Create Escrow form side-by-side */}
                {isCreatingShipment && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
                    
                    {/* Escrow Creation Form */}
                    <div className="glass-panel" style={{ border: '1px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Anchor size={18} style={{ color: 'var(--primary)' }} /> Configure New Escrow Vault
                        </h3>
                        <button onClick={() => setIsCreatingShipment(false)} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px', borderRadius: '50%' }}>
                          &times;
                        </button>
                      </div>

                      <form onSubmit={handleCreateShipment}>
                        
                        {/* Link PO Loan dropdown */}
                        <div className="form-group">
                          <label className="form-label">Link Pre-shipment PO Loan (Optional)</label>
                          <select 
                            className="form-input"
                            value={formData.poId}
                            onChange={(e) => {
                              const selectedPoId = e.target.value;
                              if (selectedPoId === '') {
                                setFormData({
                                  ...formData,
                                  poId: '',
                                  supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
                                  cargoValue: '500',
                                  tokenType: 'USDC'
                                });
                              } else {
                                const selectedPo = poLoans.find(p => p.id === parseInt(selectedPoId));
                                if (selectedPo) {
                                  setFormData({
                                    ...formData,
                                    poId: selectedPoId,
                                    supplier: selectedPo.supplier,
                                    cargoValue: selectedPo.cargoValue.toString(),
                                    tokenType: selectedPo.token === EURC_ADDRESS ? 'EURC' : 'USDC'
                                  });
                                }
                              }
                            }}
                          >
                            <option value="">-- Do not link PO loan --</option>
                            {poLoans.filter(p => p.funded && !p.repaid && p.buyer.toLowerCase() === (signerType === 'web3' && connectedAddress ? connectedAddress.toLowerCase() : wallet?.address?.toLowerCase())).map(p => (
                              <option key={p.id} value={p.id}>
                                PO #{p.id} (Supplier: {p.supplier.slice(0, 8)}..., Cargo Value: {p.cargoValue} {p.token === EURC_ADDRESS ? 'EURC' : 'USDC'})
                              </option>
                            ))}
                          </select>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Linking automatically repays both loan principal and interest to the funder immediately when buyer deposits escrow.</span>
                        </div>

                        <div className="grid-cols-2">
                          <div className="form-group">
                            <label className="form-label">Supplier Wallet Address (Receivable Beneficiary)</label>
                            <input 
                              className="form-input"
                              value={formData.supplier}
                              onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                              required
                              disabled={formData.poId !== ''}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Carrier Wallet Address (Logistics Partner)</label>
                            <input 
                              className="form-input"
                              value={formData.carrier}
                              onChange={(e) => setFormData({...formData, carrier: e.target.value})}
                              required
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="form-label">Goods / Cargo Value</label>
                            <input 
                              type="number"
                              className="form-input"
                              value={formData.cargoValue}
                              onChange={(e) => setFormData({...formData, cargoValue: e.target.value})}
                              required
                              disabled={formData.poId !== ''}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Shipping & Demurrage Escrow Fee</label>
                            <input 
                              type="number"
                              className="form-input"
                              value={formData.shippingFee}
                              onChange={(e) => setFormData({...formData, shippingFee: e.target.value})}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Currency Token</label>
                            <select 
                              className="form-input"
                              value={formData.tokenType}
                              onChange={(e) => setFormData({...formData, tokenType: e.target.value as 'USDC' | 'EURC'})}
                              disabled={formData.poId !== ''}
                            >
                              <option value="USDC">USDC</option>
                              <option value="EURC">EURC</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid-cols-2">
                          <div className="form-group">
                            <label className="form-label">Departure Port</label>
                            <input 
                              className="form-input"
                              value={formData.departurePort}
                              onChange={(e) => setFormData({...formData, departurePort: e.target.value})}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Destination Port</label>
                            <input 
                              className="form-input"
                              value={formData.destinationPort}
                              onChange={(e) => setFormData({...formData, destinationPort: e.target.value})}
                              required
                            />
                          </div>
                        </div>

                        <div className="grid-cols-2">
                          <div className="form-group">
                            <label className="form-label">Allotted Discharge Window (Free Hours)</label>
                            <input 
                              type="number"
                              className="form-input"
                              value={formData.freeTimeHours}
                              onChange={(e) => setFormData({...formData, freeTimeHours: e.target.value})}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Hourly Demurrage Penalty Rate</label>
                            <input 
                              type="number"
                              className="form-input"
                              value={formData.demurrageRatePerHour}
                              onChange={(e) => setFormData({...formData, demurrageRatePerHour: e.target.value})}
                              required
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => setIsCreatingShipment(false)} className="btn btn-secondary">
                            Cancel
                          </button>
                          <button type="submit" disabled={loading} className="btn btn-primary">
                            {loading ? (
                              <>
                                <Loader2 size={16} className="animate-spin-slow" /> {createProgress}
                              </>
                            ) : (
                              <>
                                <Landmark size={16} /> Lock Collateral & Open Escrow Vault
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* StableFX Live Oracle Converter Widget */}
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'fit-content' }}>
                      <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
                        <TrendingUp size={16} /> StableFX Real-Time Oracle Converter
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Instantly convert regional cargo invoices (e.g. AED Dirham) into digital dollar equivalents.
                      </p>

                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>EURC / USDC Oracle Rate:</span>
                          <strong>1.085 USDC</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>AED / USDC Oracle Rate:</span>
                          <strong>0.272 USDC</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>AED / EURC Oracle Rate:</span>
                          <strong>0.251 EURC</strong>
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Port Invoice Value (AED)</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }} 
                            value={stableFxInputAed}
                            onChange={(e) => setStableFxInputAed(e.target.value)}
                          />
                          <span className="badge badge-muted" style={{ display: 'flex', alignItems: 'center' }}>AED</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Digital Equivalent:</span>
                          <strong style={{ color: 'var(--primary)' }}>{convertedUsdc.toFixed(2)} USDC</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Digital Equivalent:</span>
                          <strong style={{ color: 'var(--success)' }}>{convertedEurc.toFixed(2)} EURC</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => {
                            setFormData({
                              ...formData,
                              cargoValue: convertedUsdc.toFixed(2),
                              tokenType: 'USDC'
                            });
                            showToast('Applied converted value to USDC field.', 'success');
                          }}
                          className="btn btn-secondary" 
                          style={{ flex: 1, padding: '0.45rem', fontSize: '0.7rem' }}
                        >
                          Apply USDC
                        </button>
                        <button 
                          onClick={() => {
                            setFormData({
                              ...formData,
                              cargoValue: convertedEurc.toFixed(2),
                              tokenType: 'EURC'
                            });
                            showToast('Applied converted value to EURC field.', 'success');
                          }}
                          className="btn btn-secondary" 
                          style={{ flex: 1, padding: '0.45rem', fontSize: '0.7rem' }}
                        >
                          Apply EURC
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {/* Shipments List */}
                <div className="glass-panel">
                  {loading && shipments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <Loader2 className="animate-spin-slow" size={32} style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
                      <p>Querying digital escrow ledgers...</p>
                    </div>
                  ) : shipments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                      <Anchor size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                      <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>No Escrow Shipments Found</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                        Initiate a new container booking to protect funds under automation.
                      </p>
                      <button onClick={() => setIsCreatingShipment(true)} className="btn btn-primary">
                        Create Your First Escrow
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Active Cargo Escrow Registry</h3>
                      <div className="custom-table-container">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Escrow ID</th>
                              <th>Trade Route</th>
                              <th>Total Funds Secured</th>
                              <th>Disbursed to Date</th>
                              <th>Cargo Transit Status</th>
                              <th>Secured Currency</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shipments.map(s => {
                              const symbol = s.token === EURC_ADDRESS ? 'EURC' : 'USDC';
                              return (
                                <tr 
                                  key={s.id} 
                                  onClick={() => setSelectedShipmentId(s.id)}
                                  style={{ 
                                    cursor: 'pointer',
                                    background: selectedShipmentId === s.id ? 'rgba(0,136,255,0.06)' : 'transparent' 
                                  }}
                                >
                                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>#{s.id}</td>
                                  <td>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.departurePort}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>&rarr; {s.destinationPort}</div>
                                  </td>
                                  <td style={{ fontWeight: 600 }}>
                                    {(s.cargoValue + s.shippingFee).toLocaleString()} {symbol}
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cargo: {s.cargoValue.toLocaleString()} | Shipping: {s.shippingFee.toLocaleString()}</div>
                                  </td>
                                  <td>
                                    <div style={{ fontSize: '0.75rem' }}>Supplier: {s.releasedSupplierAmount.toLocaleString()} {symbol}</div>
                                    <div style={{ fontSize: '0.75rem' }}>Carrier: {s.releasedCarrierAmount.toLocaleString()} {symbol}</div>
                                  </td>
                                  <td>
                                    <span className={`badge ${getStatusBadgeClass(s.status)}`}>
                                      {s.status === 'Created' ? 'Escrow Opened' :
                                       s.status === 'In Transit' ? 'In Transit' :
                                       s.status === 'Arrived' ? 'Arrived at Port' :
                                       s.status === 'Customs Cleared' ? 'Customs Cleared' :
                                       s.status === 'Completed' ? 'Fully Settled' : s.status}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge badge-primary" style={{ background: s.token === EURC_ADDRESS ? 'rgba(0, 230, 118, 0.1)' : 'rgba(0, 136, 255, 0.1)', color: s.token === EURC_ADDRESS ? 'var(--success)' : 'var(--primary)', borderColor: s.token === EURC_ADDRESS ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0, 136, 255, 0.2)' }}>{symbol}</span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                      <button 
                                        onClick={() => {
                                          setSelectedShipmentId(s.id);
                                          setActiveTab('iot');
                                        }}
                                        className="btn btn-secondary" 
                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                      >
                                        Track Shipments
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* PO Financing Section */}
                <div className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                        <Coins size={18} /> Purchase Order Financing Marketplace
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Allows suppliers to raise pre-shipment working capital directly from liquidity pools. Repayments are securely auto-deducted when buyers fund the main shipment escrow.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Request Form */}
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--primary)', fontFamily: 'var(--font-sans)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Apply for Pre-Shipment Capital</h4>
                      <form onSubmit={handleRequestPO} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Buyer Wallet Address</label>
                          <input 
                            className="form-input" 
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                            value={poRequestForm.buyer}
                            onChange={(e) => setPoRequestForm({...poRequestForm, buyer: e.target.value})}
                            placeholder="0x..."
                            required
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Total Target Cargo Value</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                            value={poRequestForm.cargoValue}
                            onChange={(e) => setPoRequestForm({...poRequestForm, cargoValue: e.target.value})}
                            placeholder="Total cargo value"
                            required
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Advance Financing Request (Max 80%)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                            value={poRequestForm.loanAmount}
                            onChange={(e) => setPoRequestForm({...poRequestForm, loanAmount: e.target.value})}
                            placeholder="Advance loan amount"
                            required
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Advance Financing Currency</label>
                          <select 
                            className="form-input"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                            value={poRequestForm.tokenType}
                            onChange={(e) => setPoRequestForm({...poRequestForm, tokenType: e.target.value as 'USDC' | 'EURC'})}
                          >
                            <option value="USDC">USDC</option>
                            <option value="EURC">EURC</option>
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', justifyContent: 'end' }}>
                          {poProgress && (
                            <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', textAlign: 'center' }}>{poProgress}</span>
                          )}
                          <button 
                            type="submit" 
                            disabled={loading} 
                            className="btn btn-primary" 
                            style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', width: '100%' }}
                          >
                            Submit Financing Request (5% flat)
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Active PO Loans board */}
                    <div className="custom-table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>PO ID</th>
                            <th>Trading Counterparties</th>
                            <th>Cargo Value / Loan Principal</th>
                            <th>Repayment Value & Fee</th>
                            <th>Financing Status</th>
                            <th>Capital Disbursement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poLoans.map(p => {
                            const symbol = p.token === EURC_ADDRESS ? 'EURC' : 'USDC';
                            return (
                              <tr key={p.id}>
                                <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>PO #{p.id}</td>
                                <td>
                                  <div style={{ fontSize: '0.75rem' }}>Supplier: <strong>{p.supplier.slice(0, 8)}...</strong></div>
                                  <div style={{ fontSize: '0.75rem' }}>Buyer: <strong>{p.buyer.slice(0, 8)}...</strong></div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.loanRequested} {symbol}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cargo Value: {p.cargoValue} {symbol}</div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.repaymentAmount} {symbol}</div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--success)' }}>5.0% flat fee</div>
                                </td>
                                <td>
                                  <span className={`badge ${p.repaid ? 'badge-success' : p.funded ? 'badge-primary pulsing-glow' : 'badge-muted'}`}>
                                    {p.repaid ? 'Fully Repaid' : p.funded ? 'Capital Disbursed' : 'Awaiting Capital Funder'}
                                  </span>
                                </td>
                                <td>
                                  {!p.funded && !p.repaid ? (
                                    <button 
                                      onClick={() => handleFundPO(p.id)}
                                      disabled={loading}
                                      className="btn btn-primary"
                                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                    >
                                      Fund PO Loan
                                    </button>
                                  ) : p.funded && !p.repaid ? (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Awaiting Buyer to Open Escrow</span>
                                  ) : (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Check size={12} /> Repayment Auto-Settled</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: IOT SIMULATOR & TELEMATICS */}
            {activeTab === 'iot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem' }}>IoT Telematics Sensor Simulator</h2>
                    <p style={{ fontSize: '0.8rem' }}>Simulate GPS coordinates, track cold-chain temperature thresholds, and compute real-time demurrage penalties.</p>
                  </div>
                  
                  {selectedShipmentId !== null && (
                    <span className="badge badge-primary">Active Cargo Escrow: #{selectedShipmentId}</span>
                  )}
                </div>

                {selectedShipmentId === null ? (
                  <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    <Activity size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>No Escrow Selected</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      Please return to the Escrow Shipments tab and click &quot;Track Shipments&quot; on an active escrow.
                    </p>
                    <button onClick={() => setActiveTab('escrows')} className="btn btn-secondary">
                      Go to Escrow Shipments
                    </button>
                  </div>
                ) : (() => {
                  const current = shipments.find(s => s.id === selectedShipmentId);
                    if (!current) return <p>Cargo Shipment records not found.</p>;

                    const isCreated = current.status === 'Created';
                    const isInTransit = current.status === 'In Transit';
                    const isArrived = current.status === 'Arrived';
                    const isCustoms = current.status === 'Customs Cleared';
                    const isCompleted = current.status === 'Completed';

                    const tokenSymbol = current.token === EURC_ADDRESS ? 'EURC' : 'USDC';

                    let progressPercent = 0;
                    if (isInTransit) progressPercent = 33;
                    if (isArrived) progressPercent = 66;
                    if (isCustoms) progressPercent = 85;
                    if (isCompleted) progressPercent = 100;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* Shipment Route Summary */}
                        <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>TOTAL SECURED CAPITAL</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{(current.cargoValue + current.shippingFee).toLocaleString()} {tokenSymbol}</span>
                          </div>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>PORT OF DEPARTURE</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{current.departurePort}</span>
                          </div>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>PORT OF DESTINATION</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{current.destinationPort}</span>
                          </div>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>CURRENT GPS POSITION</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>{current.location || current.departurePort}</span>
                          </div>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>CONTAINER TEMPERATURE</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: current.temperature > 8.0 ? 'var(--danger)' : 'var(--success)' }}>{current.temperature}°C</span>
                          </div>
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>CARGO STATUS</span>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700 }} className={current.status === 'Completed' ? 'color-success' : 'color-primary'}>
                              {current.status === 'Created' ? 'Escrow Opened' :
                               current.status === 'In Transit' ? 'In Transit' :
                               current.status === 'Arrived' ? 'Arrived at Destination' :
                               current.status === 'Customs Cleared' ? 'Customs Cleared' :
                               current.status === 'Completed' ? 'Settled' : current.status}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Milestone Progress Track */}
                        <div className="glass-panel" style={{ padding: '2rem 1.5rem 1rem' }}>
                          <div className="milestone-tracker">
                            <div className="milestone-progress-bar" style={{ width: `${progressPercent}%` }}></div>
                            
                            <div className={`milestone-step ${isCreated || isInTransit || isArrived || isCustoms || isCompleted ? 'completed' : ''}`}>
                              <div className="milestone-node">1</div>
                              <span className="milestone-label">Escrow Secured</span>
                            </div>
                            <div className={`milestone-step ${isInTransit || isArrived || isCustoms || isCompleted ? 'completed' : ''}`}>
                              <div className="milestone-node">2</div>
                              <span className="milestone-label">Departed Departure Port</span>
                            </div>
                            <div className={`milestone-step ${isArrived || isCustoms || isCompleted ? 'completed' : ''}`}>
                              <div className="milestone-node">3</div>
                              <span className="milestone-label">Arrived at Destination Port</span>
                            </div>
                            <div className={`milestone-step ${isCustoms || isCompleted ? 'completed' : ''}`}>
                              <div className="milestone-node">4</div>
                              <span className="milestone-label">Customs Cleared</span>
                            </div>
                            <div className={`milestone-step ${isCompleted ? 'completed' : ''}`}>
                              <div className="milestone-node">5</div>
                              <span className="milestone-label">Delivery Completed</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid-cols-2">
                          
                          {/* Climate Sensor Control */}
                          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Thermometer size={16} style={{ color: 'var(--danger)' }} /> Cold-Chain Telemetry & Thermal Sensors
                            </h3>
                            <p style={{ fontSize: '0.8rem' }}>Simulate container temperature fluctuations. If temperature exceeds the safe threshold of 8.0°C, smart contract penalties are auto-deducted from carrier payout.</p>
                            
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Temperature Controller (°C)</label>
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <input 
                                  type="range" 
                                  min="-25" 
                                  max="25" 
                                  step="0.5" 
                                  value={iotTemp} 
                                  onChange={(e) => setIotTemp(e.target.value)} 
                                  style={{ flex: 1, accentColor: parseFloat(iotTemp) > 8.0 ? 'var(--danger)' : 'var(--success)' }} 
                                  disabled={isCompleted}
                                />
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, width: '70px', textAlign: 'right', color: parseFloat(iotTemp) > 8.0 ? 'var(--danger)' : 'var(--success)' }}>
                                  {iotTemp}°C
                                </span>
                              </div>
                              {parseFloat(iotTemp) > 8.0 && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 600 }}>CRITICAL WARNING: Temperature has breached the safe cold-chain threshold!</span>
                              )}
                            </div>

                            <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

                            <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>Submit Shipment Transit Checkpoints:</h4>
                            
                            {iotProgress && (
                              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                                {iotProgress}
                              </div>
                            )}

                            {!isCompleted && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <button 
                                  onClick={() => handleTriggerMilestone('departure')} 
                                  disabled={!isCreated}
                                  className="btn btn-secondary"
                                  style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}
                                >
                                  <span>1. Confirm Departure from Port ({current.departurePort})</span>
                                  <ChevronRight size={16} />
                                </button>
                                
                                <button 
                                  onClick={() => handleTriggerMilestone('singapore')} 
                                  disabled={!isInTransit || current.releasedSupplierAmount > 0}
                                  className="btn btn-secondary"
                                  style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}
                                >
                                  <span>2. Arrived at Singapore Hub (Unlocks 30% Early Milestone Payout)</span>
                                  <Coins size={16} style={{ color: 'var(--success)' }} />
                                </button>

                                <button 
                                  onClick={() => handleTriggerMilestone('arrival')} 
                                  disabled={!isInTransit || (current.releasedSupplierAmount === 0 && !current.hasPOLoan)}
                                  className="btn btn-secondary"
                                  style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}
                                >
                                  <span>3. Confirm Arrival at Destination Port ({current.destinationPort})</span>
                                  <ChevronRight size={16} />
                                </button>

                                <button 
                                  onClick={() => handleTriggerMilestone('customs')} 
                                  disabled={!isArrived}
                                  className="btn btn-secondary"
                                  style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}
                                >
                                  <span>4. Confirm Customs Clearance Completed</span>
                                  <Shield size={16} style={{ color: 'var(--primary)' }} />
                                </button>
                              </div>
                            )}

                            {isCompleted && (
                              <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', color: 'var(--success)', textAlign: 'center', fontWeight: 600 }}>
                                Cargo successfully delivered. All secured escrow funds have been settled and disbursed.
                              </div>
                            )}
                          </div>

                          {/* Dynamic Demurrage Penalty Billing Simulator */}
                          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Clock size={16} style={{ color: 'var(--warning)' }} /> Demurrage Penalty & Storage Fees
                            </h3>

                            {isCustoms ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.15)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem' }}>
                                  <strong style={{ display: 'block', color: 'var(--warning)', marginBottom: '0.15rem' }}>Storage Conditions & Penalty Terms:</strong>
                                  Allotted discharge window (free hours): <strong>{current.freeTimeHours} Hours</strong> post customs clearance.<br />
                                  Demurrage penalty rate: <strong>{current.demurrageRatePerHour} {tokenSymbol}/hour</strong>.
                                </div>

                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Time Simulation Rate</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                      {demurrageMultiplier === 0 ? 'PAUSED' : `${demurrageMultiplier} hours / second`}
                                    </span>
                                  </label>
                                  <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <button onClick={() => setDemurrageMultiplier(0)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1, background: demurrageMultiplier === 0 ? 'var(--bg-surface-elevated)' : 'transparent' }}>
                                      Pause
                                    </button>
                                    <button onClick={() => setDemurrageMultiplier(1)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1, background: demurrageMultiplier === 1 ? 'var(--bg-surface-elevated)' : 'transparent' }}>
                                      1 hour/sec
                                    </button>
                                    <button onClick={() => setDemurrageMultiplier(4)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1, background: demurrageMultiplier === 4 ? 'var(--bg-surface-elevated)' : 'transparent' }}>
                                      4 hours/sec
                                    </button>
                                    <button onClick={() => setDemurrageMultiplier(12)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1, background: demurrageMultiplier === 12 ? 'var(--bg-surface-elevated)' : 'transparent' }}>
                                      12 hours/sec
                                    </button>
                                  </div>
                                </div>

                                <div className="grid-cols-2" style={{ gap: '0.75rem' }}>
                                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>ELAPSED TIME</span>
                                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{simulatedTimeElapsed} Hours</span>
                                  </div>
                                  
                                  <div style={{ 
                                    background: demurrageHoursLate > 0 ? 'rgba(255,23,68,0.1)' : 'var(--bg-main)', 
                                    border: '1px solid', 
                                    borderColor: demurrageHoursLate > 0 ? 'rgba(255,23,68,0.2)' : 'var(--border-color)', 
                                    borderRadius: '8px', 
                                    padding: '0.75rem', 
                                    textAlign: 'center' 
                                  }}>
                                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>DEMURRAGE PENALTY INCURRED ({tokenSymbol})</span>
                                    <span style={{ fontSize: '1rem', fontWeight: 700, color: demurrageHoursLate > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                                      {simulatedDemurragePenalty} {tokenSymbol}
                                    </span>
                                  </div>
                                </div>

                                {demurrageHoursLate > 0 && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--danger)', textAlign: 'center', display: 'block', fontWeight: 600, animation: 'pulseGlow 2s infinite' }}>
                                    LATE WARNING: DISCHARGE WINDOW EXCEEDED BY {demurrageHoursLate} HOURS!
                                  </span>
                                )}

                                <button 
                                  onClick={handlePickupCargo} 
                                  disabled={loading}
                                  className="btn btn-success" 
                                  style={{ padding: '0.85rem' }}
                                >
                                  {loading ? (
                                    <Loader2 className="animate-spin-slow" size={16} />
                                  ) : (
                                    <>
                                      <CheckCircle2 size={16} /> Accept Container & Trigger Final Settlement
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : isCompleted ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Final Escrow Settlement Receipt:</span>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                                    <span>Storage demurrage deductions:</span>
                                    <strong style={{ color: current.demurragePenaltyPaid > 0 ? 'var(--danger)' : 'inherit' }}>-{current.demurragePenaltyPaid} {tokenSymbol}</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                                    <span>Thermal breach penalties:</span>
                                    <strong style={{ color: (current.temperaturePenalty || 0) > 0 ? 'var(--danger)' : 'inherit' }}>-{(current.temperaturePenalty || 0)} {tokenSymbol}</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                                    <span>USYC auto-yield accrued:</span>
                                    <strong style={{ color: 'var(--success)' }}>+{current.yieldEarned || 0} {tokenSymbol}</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                                    <span>Net payout disbursed to Supplier:</span>
                                    <strong>{current.releasedSupplierAmount} {tokenSymbol}</strong>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                                Demurrage timers will automatically activate once the cargo status changes to &quot;Customs Cleared&quot;.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* New Advanced Features Panel Grid */}
                        <div className="grid-cols-2" style={{ marginTop: '0.5rem' }}>
                          {/* USYC Yield Vault Card */}
                          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderColor: 'rgba(0,230,118,0.25)' }}>
                            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                              <Landmark size={18} /> Automated Treasury Yield Account (USYC)
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Escrow deposits are automatically sweeped into the USYC Treasury Yield fund, earning 5% APY during transit. Accrued yield is credited to the buyer upon successful delivery.
                            </p>
                            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                                  <span>Annualized Yield Rate (APY)</span>
                                  <strong style={{ color: 'var(--success)' }}>5.00% APY</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                                <span>Principal Collateral Locked</span>
                                <strong>{(current.cargoValue + current.shippingFee).toLocaleString()} {tokenSymbol}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span>Accrued Yield Earned</span>
                                <strong style={{ color: 'var(--success)', textShadow: '0 0 8px rgba(0,230,118,0.2)' }}>+{current.yieldEarned || 0} {tokenSymbol}</strong>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.1)', padding: '0.65rem', borderRadius: '6px' }}>
                              <div className="pulsing-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>Smart Yield optimization is active and running.</span>
                            </div>
                          </div>

                          {/* Receivables Factoring Card */}
                          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderColor: current.factoringActive ? 'rgba(0,136,255,0.3)' : 'var(--border-color)' }}>
                            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                              <Coins size={18} /> Pre-Shipment Receivable Factoring Hub
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Suppliers can auction pending escrow receivables to investors at a minor discount to unlock immediate operating liquidity, optimizing working capital.
                            </p>
                            
                            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                                <span>Escrow Receivable Sale Price</span>
                                <strong>{current.factoringActive ? `${current.factoringPrice} ${tokenSymbol}` : 'Not listed'}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                                <span>Current Claims Beneficiary</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{current.beneficiary ? `${current.beneficiary.slice(0, 10)}...${current.beneficiary.slice(-8)}` : 'Original Supplier'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span>Assignment Status</span>
                                <span className={`badge ${current.factoringActive ? 'badge-primary pulsing-glow' : 'badge-muted'}`} style={{ margin: 0, padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>
                                  {current.factoringActive ? 'Active Offer' : current.beneficiary && current.beneficiary !== current.supplier ? 'Transferred to Investor' : 'Unlisted'}
                                </span>
                              </div>
                            </div>

                            {loading && factoringProgress ? (
                              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                                <Loader2 className="animate-spin-slow" size={16} style={{ color: 'var(--primary)', margin: '0 auto 0.25rem' }} />
                                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{factoringProgress}</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {/* Seller side: List/Cancel */}
                                {!current.beneficiary || current.beneficiary === current.supplier ? (
                                  !current.factoringActive ? (
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <input 
                                        type="number"
                                        placeholder={`Listing Price (${tokenSymbol})`}
                                        value={factoringPriceInput}
                                        onChange={(e) => setFactoringPriceInput(e.target.value)}
                                        className="form-input"
                                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                                      />
                                      <button 
                                        onClick={() => {
                                          const price = parseFloat(factoringPriceInput);
                                          if (isNaN(price) || price <= 0) {
                                            showToast('Please enter a valid discounted price.', 'warning');
                                            return;
                                          }
                                          handleOfferFactoring(current.id, price);
                                        }}
                                        className="btn btn-primary"
                                        style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem' }}
                                      >
                                        Sell Invoice Claims
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => handleCancelFactoring(current.id)}
                                      className="btn btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.45rem' }}
                                    >
                                      Cancel Receivable Listing
                                    </button>
                                  )
                                ) : (
                                  <div style={{ background: 'rgba(0,136,255,0.05)', border: '1px dashed rgba(0,136,255,0.2)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', textAlign: 'center' }}>
                                    Receivable has been successfully transferred to an external funder.
                                  </div>
                                )}

                                {/* Buyer side: Purchase */}
                                {current.factoringActive && (
                                  <button 
                                    onClick={() => handlePurchaseFactoring(current.id, current.factoringPrice || 0)}
                                    className="btn btn-success"
                                    style={{ fontSize: '0.75rem', padding: '0.45rem' }}
                                  >
                                    Purchase invoice receivables for {current.factoringPrice} {tokenSymbol}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })()}
              </div>
            )}

            {/* TAB CONTENT: CARRIER CREW PAYROLL */}
            {activeTab === 'payroll' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem' }}>Instant Payroll & Crew Split Pay</h2>
                    <p style={{ fontSize: '0.8rem' }}>Automates payout splits, routing funds instantly to harbor tolls, truck drivers, fuel merchants, and logistics staff upon delivery.</p>
                  </div>
                  {selectedShipmentId !== null && (
                    <span className="badge badge-primary">Active Cargo Escrow: #{selectedShipmentId}</span>
                  )}
                </div>

                {selectedShipmentId === null ? (
                  <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    <Coins size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>No Escrow Selected</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      Please select a successfully settled shipment cargo escrow from the active registry to divide freight payouts.
                    </p>
                    <button onClick={() => setActiveTab('escrows')} className="btn btn-secondary">
                      Go to Cargo Registry
                    </button>
                  </div>
                ) : (
                  (() => {
                    const current = shipments.find(s => s.id === selectedShipmentId);
                    if (!current) return <p>Cargo Shipment records not found.</p>;

                    const tokenSymbol = current.token === EURC_ADDRESS ? 'EURC' : 'USDC';

                    return (
                      <div className="grid-cols-2">
                        
                        {/* Selected cargo brief */}
                        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Box size={16} style={{ color: 'var(--primary)' }} /> Freight Payout Breakdown Ledger
                          </h3>
                          
                          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Carrier Wallet Address:</span>
                              <strong style={{ fontFamily: 'var(--font-mono)' }}>{current.carrier.slice(0, 12)}...{current.carrier.slice(-10)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Locked Freight Escrow Amount:</span>
                              <strong>{current.shippingFee} {tokenSymbol}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Storage Demurrage Deductible:</span>
                              <strong>{current.demurragePenaltyPaid} {tokenSymbol}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Net Carrier Payout Disbursed:</span>
                              <strong style={{ color: 'var(--success)', fontSize: '0.9rem' }}>{current.releasedCarrierAmount} {tokenSymbol}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,136,255,0.05)', border: '1px solid rgba(0,136,255,0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                            <Truck size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <div>
                              <span><strong>Automated Multi-Party Split Pay (Circle Programmable Mass Pay):</strong> Logistics dispatchers can programmatically split the escrow freight payout among ground drivers, harbor authorities, toll agencies, and subcontractors with one unified command.</span>
                            </div>
                          </div>
                        </div>

                        {/* Split payouts control panel */}
                        {current.status !== 'Completed' ? (
                          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem' }}>
                            Awaiting physical container delivery. Mass payroll controls will become active as soon as final cargo escrow is released.
                          </div>
                        ) : (
                          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Send size={16} style={{ color: 'var(--success)' }} /> Freight Payroll & Subcontractor Payouts
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {payrollCrew.map((c, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                  <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{c.name}</div>
                                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                      {c.address.slice(0, 8)}...{c.address.slice(-6)}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                    <input 
                                      type="number" 
                                      value={c.amount} 
                                      onChange={(e) => {
                                        const updated = [...payrollCrew];
                                        updated[i].amount = e.target.value;
                                        setPayrollCrew(updated);
                                      }}
                                      className="form-input" 
                                      style={{ width: '80px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', textAlign: 'right' }} 
                                    />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{tokenSymbol}</span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {payrollProgress && (
                              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', textAlign: 'center', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                                {payrollProgress}
                              </div>
                            )}

                            <button 
                              onClick={handlePayoutCrew} 
                              disabled={loading}
                              className="btn btn-primary" 
                              style={{ width: '100%' }}
                            >
                              {loading ? (
                                <Loader2 className="animate-spin-slow" size={16} />
                              ) : (
                                <>
                                  <Send size={16} /> Authorize Mass Payout Splits (One-Click Settlement)
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* TAB CONTENT: SME CREDIT PASSPORT & CARGO PASS */}
            {activeTab === 'passport' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* SME Credit Passports Row */}
                <div className="glass-panel">
                  <h2 style={{ fontSize: '1.3rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Award size={20} style={{ color: 'var(--success)' }} /> Trade Passport & SME Credit Scorecard
                  </h2>
                  <p style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>Reputation records, lifetime trade volume, and cold-chain reliability indices computed automatically from immutable logistics performance.</p>
 
                  <div className="grid-cols-3">
                    {(['supplier', 'buyer', 'carrier'] as const).map((role) => {
                      const stats = computePassportStats(role);
                      const colorMap = { supplier: 'var(--success)', buyer: 'var(--primary)', carrier: 'var(--warning)' };
                      const bgMap = { supplier: 'rgba(0, 230, 118, 0.02)', buyer: 'rgba(0, 136, 255, 0.02)', carrier: 'rgba(255, 179, 0, 0.02)' };
                      const badgeMap = { supplier: 'badge-success', buyer: 'badge-primary', carrier: 'badge-warning' };
                      const labelMap = { supplier: 'Original Supplier', buyer: 'Buyer / Importer', carrier: 'Carrier / Logistics Partner' };
                      const accentColor = colorMap[role];
 
                      return (
                        <div key={role} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: `4px solid ${accentColor}`, background: bgMap[role] }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={`badge ${badgeMap[role]}`}>{labelMap[role]}</span>
                            <strong style={{ fontSize: '1rem', color: accentColor }}>Grade {stats.grade}</strong>
                          </div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{stats.name}</h4>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{stats.addr.slice(0, 14)}...{stats.addr.slice(-5)}</span>
                          <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.25rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span>Trade Credit Rating:</span>
                              <strong>{stats.rawScore}/100</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span>Lifetime Settled Volume:</span>
                              <strong>${stats.settledVolume.toLocaleString()}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span>Successfully Settled Escrows:</span>
                              <strong>{stats.completedCount} / {stats.totalCount} escrows</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span>Cold-Chain Compliance Rate:</span>
                              <strong>{stats.complianceRate}%{stats.totalViolations > 0 ? ` (${stats.totalViolations} thermal excursions)` : ''}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{role === 'buyer' ? 'On-time cargo receipt:' : role === 'carrier' ? 'On-time port arrival:' : 'PO loan repayment rate:'}</span>
                              <strong style={{ color: 'var(--success)' }}>{role === 'supplier' ? `${stats.poRepayRate}%` : `${stats.onTimeRate}%`}</strong>
                            </div>
                          </div>

                          <button 
                            onClick={() => handleExportVc(role)}
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.75rem', padding: '0.4rem', width: '100%', marginTop: '0.25rem' }}
                          >
                            <Download size={12} /> Export Verifiable Credential (VC)
                          </button>
                        </div>
                      );
                    })}

                  </div>
                </div>

                 {/* Cargo NFT Certificate View */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Immutable Shipment Digital Passport (ERC-721 NFT)</h3>
                  <p style={{ fontSize: '0.8rem' }}>Access immutable maritime insurance records, historical telemetry charts, and chronological time logs.</p>
                </div>

                {selectedShipmentId === null ? (
                  <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    <ScanQrCode size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>No Cargo Shipment Selected</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      Please select a cargo shipment from the registry to view its ERC-721 physical-asset passport token details & transit telemetry logs.
                    </p>
                    <button onClick={() => setActiveTab('escrows')} className="btn btn-secondary">
                      Go to Cargo Registry
                    </button>
                  </div>
                ) : (
                  (() => {
                    const current = shipments.find(s => s.id === selectedShipmentId);
                    if (!current) return <p>Shipment records not found.</p>;

                    const isIceRuined = current.temperature > 8.0;
                    
                    return (
                      <div className="grid-cols-2">
                        
                        {/* NFT Passport Card */}
                        <div className="glass-panel glass-panel-accent" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(0, 210, 255, 0.25)' }}>
                          
                          {/* NFT Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Compass size={18} style={{ color: 'var(--secondary)' }} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>LOGISTICS DIGITAL PASS PUMP (NFT)</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOKEN ID #{current.passportTokenId}</span>
                          </div>

                          {/* Beautiful QR Code Simulation */}
                          <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', width: '150px', height: '150px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(#000 35%, transparent 35%), radial-gradient(#000 35%, transparent 35%)', backgroundSize: '12px 12px', backgroundPosition: '0 0, 6px 6px', position: 'relative' }}>
                              <div style={{ position: 'absolute', top: 0, left: 0, width: '32px', height: '32px', border: '4px solid #000', background: '#fff' }}></div>
                              <div style={{ position: 'absolute', top: 0, right: 0, width: '32px', height: '32px', border: '4px solid #000', background: '#fff' }}></div>
                              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '32px', height: '32px', border: '4px solid #000', background: '#fff' }}></div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Logistics Digital Twin Passport</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Asset registered under <strong>FRTX-PASS</strong> contract identifier on Arc.
                            </p>
                          </div>

                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Port of Departure:</span>
                              <strong>{current.departurePort}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Port of Destination:</span>
                              <strong>{current.destinationPort}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Shipment Status:</span>
                              <strong className={current.status === 'Completed' ? 'color-success' : 'color-primary'} style={{
                                color: current.status === 'Completed' ? 'var(--success)' : 'var(--primary)'
                              }}>
                                {current.status === 'Created' ? 'Escrow Secured' :
                                 current.status === 'In Transit' ? 'In Transit' :
                                 current.status === 'Arrived' ? 'Arrived at Port' :
                                 current.status === 'Customs Cleared' ? 'Customs Cleared' :
                                 current.status === 'Completed' ? 'Delivery Completed' : current.status}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Immutable Timeline Logs */}
                        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} style={{ color: 'var(--primary)' }} /> Immutable Vessel Telemetry Ledger
                          </h3>

                          {isIceRuined && (
                            <div style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.2)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', gap: '0.5rem' }}>
                              <Thermometer size={16} />
                              <div>
                                <strong>THERMAL EXCURSION WARNING DETECTED:</strong>
                                <span style={{ display: 'block', fontSize: '0.7rem' }}>
                                  Cold storage temperature spiked to {current.temperature}°C (Exceeding agreed 8.0°C threshold). Smart contract has logged the breach for automated transit insurance adjusters.
                                </span>
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '280px', paddingRight: '0.25rem' }}>
                            {current.history.map((h, i) => (
                              <div key={i} style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '0.75rem', position: 'relative', paddingBottom: '0.25rem' }}>
                                <div style={{ position: 'absolute', left: '-5px', top: '2px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                                <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                  {new Date(h.timestamp).toLocaleString()}
                                </span>
                                <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>
                                  {h.status === 'Departure Milestone (IoT Signed)' ? 'Departure Milestone (Verified IoT Telemetry)' :
                                   h.status === 'Singapore Checkpoint (IoT Signed)' ? 'Singapore Hub Checkpoint (Verified IoT Telemetry)' :
                                   h.status === 'Arrived at Destination (IoT Signed)' ? 'Destination Port Arrival (Verified IoT Telemetry)' :
                                   h.status === 'Customs Cleared (IoT Signed)' ? 'Customs Clearance Completed (Verified IoT Telemetry)' : h.status}
                                </span>
                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                  Location: {h.location} | Temp: {h.temperature}°C
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* Cryptographic W3C VC Exporter Modal */}
            {showVcModal && vcModalData && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--success)', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.05rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileCode size={18} /> Cryptographically Signed Trade Credential (W3C JSON-LD Standard)
                    </h3>
                    <button 
                      onClick={() => setShowVcModal(false)} 
                      className="btn btn-secondary btn-icon" 
                      style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    >
                      &times;
                    </button>
                  </div>
                  
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    This secure proof document certifies historical shipping reliability and trade performance. It can be instantly submitted to global trade financiers to secure low-interest capital lines.
                  </p>

                  <pre style={{ background: '#04060b', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflow: 'auto', maxHeight: '350px' }}>
                    {JSON.stringify(vcModalData, null, 2)}
                  </pre>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(vcModalData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `freightx-vc-${vcModalData.credentialSubject.legalName.replace(/\s+/g, '-').toLowerCase()}.json`;
                        a.click();
                        showToast('Verifiable credential downloaded successfully!', 'success');
                      }}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                    >
                      <Download size={14} /> Download Trade Credential (.json)
                    </button>
                    <button 
                      onClick={() => setShowVcModal(false)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* TAB CONTENT: ADVANCED FEATURES */}
            {activeTab === 'advanced' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem' }}>Advanced Trade Expansion Engine</h2>
                  <p style={{ fontSize: '0.8rem' }}>Explore three corporate expansion modules: Secp256k1 IoT Sensor Gateway, USYC Treasury Sweeps, and Circle CCTP Cross-Chain liquidity rails.</p>
                </div>

                {/* Feature 1: IoT Device Gateway */}
                <div className="glass-panel" style={{ borderLeft: '3px solid var(--primary)' }}>
                  <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Activity size={18} style={{ color: 'var(--primary)' }} /> Cryptographic Hardware IoT Sensor Gateway
                  </h3>
                  <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Bind a hardware IoT device wallet address to the cargo container. Periodic telemetry reports are cryptographically signed by the device&apos;s hardware enclave key (ECDSA). The smart contract performs standard <code>ecrecover</code> validation to verify authentic telemetry, neutralizing spoofing risks.
                  </p>

                  {selectedShipmentId !== null && currentShipment ? (
                    <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>Register IoT Telemetry Device</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cargo #{selectedShipmentId} — Status: {
                            currentShipment.status === 'Created' ? 'Escrow Secured' :
                            currentShipment.status === 'In Transit' ? 'In Transit' :
                            currentShipment.status === 'Arrived' ? 'Arrived at Port' :
                            currentShipment.status === 'Customs Cleared' ? 'Customs Cleared' :
                            currentShipment.status === 'Completed' ? 'Delivery Completed' : currentShipment.status
                          }</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Connected Device Address: <strong style={{ color: currentShipment.iotGateway && currentShipment.iotGateway !== '0x0000000000000000000000000000000000000000' ? 'var(--success)' : 'var(--text-muted)' }}>
                              {currentShipment.iotGateway && currentShipment.iotGateway !== '0x0000000000000000000000000000000000000000' ? `${currentShipment.iotGateway.slice(0,10)}...` : 'None bound'}
                            </strong>
                          </div>
                          <button
                            disabled={loading || currentShipment.status !== 'Created'}
                            className="btn btn-primary"
                            style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%', marginTop: '0.5rem' }}
                            onClick={async () => {
                              if (!wallet) return;
                              setLoading(true);
                              const gateway = wallet.address;
                              logTerminal(`Registering hardware IoT sensor device: ${gateway} for cargo #${selectedShipmentId}`);
                              if (appMode === 'local') {
                                const updated = shipments.map(s => s.id === selectedShipmentId ? { ...s, iotGateway: gateway } : s);
                                setShipments(updated);
                                saveLocalShipments(updated);
                                showToast('IoT sensor device successfully bound (Local Sandbox mode)!', 'success');
                                logTerminal(`Bound device telemetry listener (Local): ${gateway}`);
                              } else if (contracts) {
                                try {
                                  const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
                                  await setIotGatewayOnchain(signer, contracts, selectedShipmentId, gateway, (s) => { logTerminal(s); });
                                  showToast('IoT hardware signature successfully registered on-chain!', 'success');
                                  await refreshShipmentsList('live', contracts, wallet);
                                } catch (err) { logTerminal(`Hardware device registration failed: ${err instanceof Error ? err.message : String(err)}`); showToast('Failed to register IoT telemetry device.', 'error'); }
                              }
                              setLoading(false);
                            }}
                          >
                            Register Sandbox Key as Active IoT Sensor
                          </button>
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--secondary)' }}>Live Sensor Telemetry Metrics</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Core Ambient Temp:</span><strong style={{ color: currentShipment.temperature > 8 ? 'var(--danger)' : 'var(--success)' }}>{currentShipment.temperature}°C</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Relative Humidity:</span><strong>{currentShipment.humidity || 0}%</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Thermal Breach Alarms:</span><strong style={{ color: (currentShipment.temperatureViolations || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>{currentShipment.temperatureViolations || 0} times</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Signature Algorithm:</span><span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>ECDSA secp256k1</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Cryptographic Transmission Panel */}
                    {currentShipment.iotGateway && currentShipment.iotGateway !== '0x0000000000000000000000000000000000000000' && (
                      <div style={{ marginTop: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <ShieldCheck size={16} /> Simulate Secure Hardware Key Signatures (ECDSA)
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                          Simulate secure hardware encryption. We sign cargo telemetry metrics with the device&apos;s private key, generating cryptographic proof that is parsed on-chain by public keys for zero-trust delivery verification.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Simulated Route Checkpoint</label>
                            <select 
                              className="form-control" 
                              style={{ fontSize: '0.8rem', padding: '0.4rem', background: '#04060a', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px' }}
                              value={iotMilestone}
                              onChange={(e) => setIotMilestone(e.target.value as 'departure' | 'singapore' | 'arrival' | 'customs')}
                            >
                              <option value="departure" disabled={currentShipment.status !== 'Created'}>1. Confirm Port Departure</option>
                              <option value="singapore" disabled={currentShipment.status !== 'In Transit' || currentShipment.releasedSupplierAmount > 0}>2. Arrived Singapore Hub (Triggers 30% release)</option>
                              <option value="arrival" disabled={currentShipment.status !== 'In Transit' || (currentShipment.releasedSupplierAmount === 0 && !currentShipment.hasPOLoan)}>3. Arrived Destination Port</option>
                              <option value="customs" disabled={currentShipment.status !== 'Arrived'}>4. Customs Cleared & Storage Timers On</option>
                            </select>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Simulated Temperature (°C)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="range" 
                                min="-10" 
                                max="20" 
                                step="0.5" 
                                value={iotTemp} 
                                onChange={(e) => setIotTemp(e.target.value)} 
                                style={{ flex: 1, accentColor: parseFloat(iotTemp) > 8 ? 'var(--danger)' : 'var(--success)' }}
                              />
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '45px', textAlign: 'right' }}>{iotTemp}°C</span>
                            </div>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Simulated Humidity (%)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="range" 
                                min="20" 
                                max="95" 
                                step="1" 
                                value={iotHumidity} 
                                onChange={(e) => setIotHumidity(parseInt(e.target.value))} 
                                style={{ flex: 1 }}
                              />
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '35px', textAlign: 'right' }}>{iotHumidity}%</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                          <button
                            disabled={loading || currentShipment.status === 'Completed' || currentShipment.status === 'Cancelled'}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                            onClick={async () => {
                              setLoading(true);
                              const ts = Math.floor(Date.now() / 1000);
                              const temp = parseFloat(iotTemp);
                              logTerminal(`Generating ECDSA hardware keyspace signature for route milestone "${iotMilestone}"...`);
                              
                              if (appMode === 'local') {
                                logTerminal(`[ECDSA SIGNATURE] Generating hardware-attested signature from device wallet: ${currentShipment.iotGateway}`);
                                logTerminal(`Payload: ShipmentId=${selectedShipmentId}, Milestone=${iotMilestone}, Temp=${temp}°C, Humidity=${iotHumidity}%, Timestamp=${ts}`);
                                logTerminal(`[SOLIDITY ecrecover PASS] Signature verified. Recovered Signer: ${currentShipment.iotGateway} (MATCHES BOUND HARDWARE DEVICE)`);
                                
                                const updatedHistory = [...currentShipment.history];
                                let newStatus = currentShipment.status;
                                let newLocation = currentShipment.location;
                                let releasedSupplier = currentShipment.releasedSupplierAmount;
                                let arrivedTs = currentShipment.arrivedTimestamp;
                                let customsTs = currentShipment.customClearanceTimestamp;
                                let violations = currentShipment.temperatureViolations || 0;
                                let tempPenalty = currentShipment.temperaturePenalty || 0;
 
                                if (temp > 8.0) {
                                  violations += 1;
                                  tempPenalty = violations * 0.05 * currentShipment.cargoValue;
                                }
 
                                if (iotMilestone === 'departure') {
                                  newStatus = 'In Transit';
                                  newLocation = currentShipment.departurePort;
                                  updatedHistory.push({ timestamp: Date.now(), status: 'Departure Milestone (Verified IoT Telemetry)', location: newLocation, temperature: temp });
                                } else if (iotMilestone === 'singapore') {
                                  if (!currentShipment.hasPOLoan) {
                                    releasedSupplier = currentShipment.cargoValue * 0.3;
                                  }
                                  updatedHistory.push({ timestamp: Date.now(), status: 'Singapore Hub Checkpoint (Verified IoT Telemetry)', location: 'Singapore Transshipment Hub', temperature: temp });
                                } else if (iotMilestone === 'arrival') {
                                  newStatus = 'Arrived';
                                  newLocation = currentShipment.destinationPort;
                                  arrivedTs = Date.now();
                                  updatedHistory.push({ timestamp: Date.now(), status: 'Destination Port Arrival (Verified IoT Telemetry)', location: newLocation, temperature: temp });
                                } else if (iotMilestone === 'customs') {
                                  newStatus = 'Customs Cleared';
                                  customsTs = Date.now();
                                  updatedHistory.push({ timestamp: Date.now(), status: 'Customs Clearance Completed (Verified IoT Telemetry)', location: currentShipment.destinationPort, temperature: temp });
                                }
 
                                const updatedShipment = {
                                  ...currentShipment,
                                  status: newStatus,
                                  location: newLocation,
                                  releasedSupplierAmount: releasedSupplier,
                                  arrivedTimestamp: arrivedTs,
                                  customClearanceTimestamp: customsTs,
                                  temperature: temp,
                                  humidity: iotHumidity,
                                  temperatureViolations: violations,
                                  temperaturePenalty: tempPenalty,
                                  history: updatedHistory
                                };
 
                                const updatedList = shipments.map(s => s.id === selectedShipmentId ? updatedShipment : s);
                                setShipments(updatedList);
                                saveLocalShipments(updatedList);
                                showToast('Simulated secure routing update verified successfully (Local)!', 'success');
                              } else {
                                // Live mode
                                if (!contracts || !wallet) {
                                  showToast('Sandbox keypair not initialized.', 'error');
                                  setLoading(false);
                                  return;
                                }
                                try {
                                  // 1. Sign payload
                                  let signature = '';
                                  if (signerType === 'web3') {
                                    if (!browserWalletClient || !connectedAddress) {
                                      showToast('Web3 browser wallet not connected.', 'error');
                                      setLoading(false);
                                      return;
                                    }
                                    signature = await signIoTPayloadWithWalletClient(
                                      browserWalletClient,
                                      connectedAddress,
                                      selectedShipmentId,
                                      iotMilestone,
                                      temp,
                                      iotHumidity,
                                      ts
                                    );
                                  } else {
                                    signature = await signIoTPayloadOnchain(
                                      wallet.privateKey,
                                      selectedShipmentId,
                                      iotMilestone,
                                      temp,
                                      iotHumidity,
                                      ts
                                    );
                                  }
 
                                  logTerminal(`ECDSA cryptographically signed proof: ${signature.slice(0, 30)}...`);
                                  logTerminal(`Transmitting verified proof packet to on-chain token contracts...`);
 
                                  const txSigner = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
                                  const txHash = await triggerMilestoneWithIoTSignatureOnchain(
                                    txSigner,
                                    contracts,
                                    selectedShipmentId,
                                    iotMilestone,
                                    temp,
                                    iotHumidity,
                                    ts,
                                    signature,
                                    (s) => logTerminal(s)
                                  );
 
                                  showToast(`Route milestone ${iotMilestone.toUpperCase()} successfully updated and verified on-chain!`, 'success');
                                  logTerminal(`Transaction receipt hash: ${txHash}`);
                                  
                                  await refreshShipmentsList('live', contracts, wallet);
                                } catch (err) {
                                  const errMsg = err instanceof Error ? err.message : String(err);
                                  logTerminal(`IoT telemetry transmission failed: ${errMsg}`);
                                  showToast('Hardware signature failed to verify on-chain.', 'error');
                                }
                              }
                              setLoading(false);
                            }}
                          >
                            <Send size={14} /> Sign ECDSA Proof & Transmit Telemetry
                          </button>
                        </div>
                      </div>
                    )}
                    </>
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Please select a cargo shipment from the registry to interface with the hardware sensor emulator.</p>
                    </div>
                  )}
                </div>

                {/* Feature 2: USYC Yield Vault */}
                <div className="glass-panel" style={{ borderLeft: '3px solid var(--success)' }}>
                  <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <TrendingUp size={18} style={{ color: 'var(--success)' }} /> USYC Automated Yield Sweep Vault (ERC-4626)
                  </h3>
                  <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Sweeps idle escrow collateral into institutional-grade USYC US Treasury Bills to capture a stable 5% APY yield. Accrued yield builds automatically during shipment transit and is returned to the buyer upon successful cargo receipt.
                  </p>

                  {selectedShipmentId !== null && currentShipment ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--success)' }}>Yield Sweep Controls</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Active Escrow Balance: {(currentShipment.cargoValue + currentShipment.shippingFee - currentShipment.releasedSupplierAmount).toLocaleString()} {currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC'}</div>
                          <div style={{ fontSize: '0.7rem', color: currentShipment.usycWrapped ? 'var(--success)' : 'var(--text-muted)' }}>Yield Sweep Status: {currentShipment.usycWrapped ? '✓ Active Yielding' : '✗ Inactive'}</div>
                          <button
                            disabled={loading || currentShipment.usycWrapped || currentShipment.status !== 'Created'}
                            className="btn btn-success"
                            style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%', marginTop: '0.25rem' }}
                            onClick={async () => {
                              if (!wallet) return;
                              setLoading(true);
                              if (appMode === 'local') {
                                const updated = shipments.map(s => s.id === selectedShipmentId ? { ...s, usycWrapped: true, usycShares: s.cargoValue + s.shippingFee - s.releasedSupplierAmount } : s);
                                setShipments(updated);
                                saveLocalShipments(updated);
                                showToast('Collateral successfully swept into USYC Yield Fund (Local)!', 'success');
                                logTerminal(`USYC Yield Sweep (Local): Successfully deposited collateral ${currentShipment.cargoValue + currentShipment.shippingFee}`);
                              } else if (contracts) {
                                try {
                                  const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
                                  await wrapEscrowInUSYCOnchain(signer, contracts, selectedShipmentId, (s) => { logTerminal(s); });
                                  showToast('Collateral successfully swept into USYC Yield Vault on-chain!', 'success');
                                  await refreshShipmentsList('live', contracts, wallet);
                                } catch (err) { logTerminal(`Yield vault sweep failed: ${err instanceof Error ? err.message : String(err)}`); showToast('Failed to sweep collateral to yield vault.', 'error'); }
                              }
                              setLoading(false);
                            }}
                          >
                            <TrendingUp size={14} /> Sweep Escrow Collateral to USYC Yield Vault
                          </button>
                          <button
                            disabled={loading || !currentShipment.usycWrapped}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%' }}
                            onClick={async () => {
                              if (!wallet) return;
                              setLoading(true);
                              if (appMode === 'local') {
                                const elapsed = (Date.now() - (currentShipment.createdTimestamp || Date.now())) / 1000;
                                const principal = currentShipment.cargoValue + currentShipment.shippingFee;
                                const yieldAmt = parseFloat((principal * 0.05 * elapsed / (365 * 24 * 3600)).toFixed(6));
                                const updated = shipments.map(s => s.id === selectedShipmentId ? { ...s, usycWrapped: false, usycShares: 0, yieldEarned: yieldAmt } : s);
                                setShipments(updated);
                                saveLocalShipments(updated);
                                showToast(`Successfully redeemed USYC yield sweep! Net yield accrued: ${yieldAmt}`, 'success');
                                logTerminal(`Yield Sweep Redemption (Local): Principal released, yield realized = ${yieldAmt}`);
                              } else if (contracts) {
                                try {
                                  const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
                                  await redeemUSYCOnchain(signer, contracts, selectedShipmentId, (s) => { logTerminal(s); });
                                  showToast('Successfully redeemed yield-bearing shares on-chain!', 'success');
                                  await refreshShipmentsList('live', contracts, wallet);
                                } catch (err) { logTerminal(`Yield sweep redemption failed: ${err instanceof Error ? err.message : String(err)}`); showToast('Failed to redeem yield-bearing shares.', 'error'); }
                              }
                              setLoading(false);
                            }}
                          >
                            Redeem Escrow Collateral & Claim Yield
                          </button>
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--success)' }}>Treasury Yield Analytics</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Expected Treasury APY:</span><strong style={{ color: 'var(--success)' }}>5.00% APY</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Yield Fund Shares:</span><strong>{currentShipment.usycShares || 0} shares</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Net Yield Accrued:</span><strong style={{ color: 'var(--success)' }}>{currentShipment.yieldEarned || 0} {currentShipment.token === EURC_ADDRESS ? 'EURC' : 'USDC'}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Underlying Fund:</span><span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Hashnote USYC</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>ERC Standard Specification:</span><span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>ERC-4626</span></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Please select a cargo shipment from the registry to sweep collateral into the Treasury Yield Vault.</p>
                    </div>
                  )}
                </div>

                {/* Feature 3: CCTP Cross-Chain Bridge */}
                <div className="glass-panel" style={{ borderLeft: '3px solid var(--secondary)' }}>
                  <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Send size={18} style={{ color: 'var(--secondary)' }} /> Cross-Chain Escrow Funding (Circle CCTP)
                  </h3>
                  <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Sponsors, importers, and lenders on public EVM networks (Arbitrum, Avalanche, Mainnet) can instantly fund FreightX escrows using Circle&apos;s Cross-Chain Transfer Protocol (CCTP). CCTP burns origin-chain USDC and mints native gas-stable USDC on Arc with 1:1 parity and sub-second finality.
                  </p>

                  {selectedShipmentId !== null && currentShipment ? (
                    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--secondary)' }}>CCTP Cross-Chain Bridge Terminal</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>SOURCE BLOCKCHAIN</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--secondary)' }}>Arbitrum L2</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Domain ID: 3</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>BRIDGE STATUS</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: currentShipment.cctpSourceDomain ? 'var(--success)' : 'var(--warning)' }}>{currentShipment.cctpSourceDomain ? 'USDC Minted' : 'Pending Bridge'}</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>DESTINATION BLOCKCHAIN</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>Arc Testnet</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Domain ID: 9</div>
                        </div>
                      </div>
                      <button
                        disabled={loading || !!currentShipment.cctpSourceDomain}
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.6rem', width: '100%' }}
                        onClick={async () => {
                          if (!wallet) return;
                          setLoading(true);
                          const fakeTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
                          const amount = currentShipment.cargoValue + currentShipment.shippingFee;
                          logTerminal(`[CCTP Bridge] Initiating cross-chain deposit from Arbitrum (Domain 3)...`);
                          logTerminal(`[CCTP Bridge] Burning source USDC: TxHash ${fakeTxHash.slice(0,18)}... Amount: ${amount} USDC`);
                          await new Promise(r => setTimeout(r, 800));
                          logTerminal(`[CCTP Bridge] Querying Circle Iris API oracle for burn attestation...`);
                          await new Promise(r => setTimeout(r, 1200));
                          logTerminal(`[CCTP Bridge] Attestation received. Relaying mint command payload to Arc TokenMessenger...`);
                          if (appMode === 'local') {
                            await new Promise(r => setTimeout(r, 600));
                            const updated = shipments.map(s => s.id === selectedShipmentId ? { ...s, cctpSourceDomain: 3, cctpSourceTxHash: fakeTxHash } : s);
                            setShipments(updated);
                            saveLocalShipments(updated);
                            logTerminal(`[CCTP Bridge] Native USDC successfully minted on Arc. Cargo escrow #${selectedShipmentId} funded.`);
                            showToast('Cross-chain escrow funding successfully completed via CCTP (Local)!', 'success');
                          } else if (contracts) {
                            try {
                              const signer = signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey;
                              await recordCCTPFundingOnchain(signer, contracts, selectedShipmentId, 3, fakeTxHash, amount, (s) => { logTerminal(s); });
                              showToast('Cross-chain escrow funding successfully completed via CCTP on-chain!', 'success');
                              await refreshShipmentsList('live', contracts, wallet);
                            } catch (err) { logTerminal(`CCTP cross-chain funding record failed: ${err instanceof Error ? err.message : String(err)}`); showToast('Failed to register CCTP cross-chain funding.', 'error'); }
                          }
                          setLoading(false);
                        }}
                      >
                        <Send size={14} /> Execute CCTP Cross-Chain Transfer (Arbitrum → Arc)
                      </button>
                      {currentShipment.cctpSourceTxHash && currentShipment.cctpSourceTxHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                        <div style={{ marginTop: '0.75rem', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}><span style={{ color: 'var(--text-secondary)' }}>Source Domain ID:</span><strong>{currentShipment.cctpSourceDomain} (Arbitrum)</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Source Burn TxHash:</span><strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{currentShipment.cctpSourceTxHash.slice(0,24)}...</strong></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Please select a cargo shipment from the registry to simulate CCTP cross-chain funding.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <TerminalLog logs={terminalLogs} />

          </main>
        </div>

      </div>
    </div>
    </ErrorBoundary>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingSkeleton />;
  }

  return <Dashboard />;
}


