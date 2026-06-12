'use client';

import React, { useState, useEffect } from 'react';
import { type WalletClient } from 'viem';
import { 
  Box, 
  Anchor, 
  TrendingUp, 
  Loader2, 
  Landmark, 
  Check, 
  Coins, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  Sparkles, 
  Shield 
} from 'lucide-react';
import { spendFromUnifiedBalance } from '@/lib/unified-balance';
import { useWallet } from '@/hooks/useWallet';
import { useShipments } from '@/hooks/useShipments';
import { usePOLoans } from '@/hooks/usePOLoans';
import { useAppContext } from '@/contexts/AppContext';
import { 
  createShipmentOnchain, 
  createShipmentWithCCTPPendingOnchain,
  requestPOFinancingOnchain, 
  fundPOLoanOnchain,
  saveLocalShipments,
  queryBalances,
  USDC_ADDRESS,
  EURC_ADDRESS
} from '@/services/sandbox';
import { type ShipmentData, type POLoanData } from '@/lib/types';

export default function EscrowTab() {
  const { appMode, showToast, logTerminal, updateBalances, contracts, setActiveTab } = useAppContext();
  const { 
    wallet, 
    signerType, 
    connectedAddress, 
    browserWalletClient, 
    sandboxBalances,
    web3Balances,
    circleSession,
    circleBalances
  } = useWallet();
  const { shipments, setShipments, selectedShipmentId, setSelectedShipmentId, loading, setLoading, refreshShipmentsList } = useShipments();
  const { poLoans, setPoLoans, poProgress, setPoProgress, refreshPOLoansList } = usePOLoans();

  // Creation Form State
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [createProgress, setCreateProgress] = useState('');
  const [formData, setFormData] = useState({
    cargoName: 'Medical Equipment Container',
    containerNumber: 'MSKU-481920-5',
    supplier: '0x8D92F677cd6303cEc089B5F319D72Aa797Da5300',
    carrier: '0x1C902e11A58c4BB489B3ab1c51CEf8BC8757845E',
    cargoValue: '2.0',
    shippingFee: '0.5',
    departurePort: 'Singapore Keppel Terminal',
    destinationPort: 'Rotterdam Gateway',
    freeTimeHours: '2', 
    demurrageRatePerHour: '15',
    tokenType: 'USDC' as 'USDC' | 'EURC',
    poId: '',
    cctpPending: false,
    useUnifiedBalance: false,
    unifiedSourceChain: 'Ethereum_Sepolia' as 'Ethereum_Sepolia' | 'Arbitrum_Sepolia',
    usycSweep: true
  });

  // PO Request Form
  const [poRequestForm, setPoRequestForm] = useState({
    buyer: '0x9b1C51CEF8BC8757Ad757845eF80a390A3b9D194',
    cargoValue: '4.0',
    loanAmount: '3.0',
    tokenType: 'USDC' as 'USDC' | 'EURC'
  });

  // StableFX Calculator
  const [stableFxInputAed, setStableFxInputAed] = useState('1000');
  const [aedToUsdcRate, setAedToUsdcRate] = useState(1 / 3.67);
  const [aedToEurcRate, setAedToEurcRate] = useState(1 / 3.98);
  const [eurcToUsdcRate, setEurcToUsdcRate] = useState(1.087);

  useEffect(() => {
    const fetchAedRates = async () => {
      try {
        const [resUsdc, resEurc, resEurcUsdc] = await Promise.all([
          fetch('/api/fx/rates?from=AED&to=USDC&amount=1'),
          fetch('/api/fx/rates?from=AED&to=EURC&amount=1'),
          fetch('/api/fx/rates?from=EURC&to=USDC&amount=1')
        ]);
        const dataUsdc = await resUsdc.json();
        const dataEurc = await resEurc.json();
        const dataEurcUsdc = await resEurcUsdc.json();
        if (dataUsdc.success && dataUsdc.quote) {
          setAedToUsdcRate(dataUsdc.quote.rate);
        }
        if (dataEurc.success && dataEurc.quote) {
          setAedToEurcRate(dataEurc.quote.rate);
        }
        if (dataEurcUsdc.success && dataEurcUsdc.quote) {
          setEurcToUsdcRate(dataEurcUsdc.quote.rate);
        }
      } catch (err) {
        console.warn('Failed to fetch AED StableFX rates:', err);
      }
    };
    fetchAedRates();
    const interval = setInterval(fetchAedRates, 15000);
    return () => clearInterval(interval);
  }, []);

  // Dynamically adjust Cargo Value and Shipping Fee when switching to Live Arc mode
  // to ensure they fit within the faucet balance (5.0 USDC) for testing.
  useEffect(() => {
    if (appMode === 'live') {
      setFormData(prev => ({
        ...prev,
        cargoValue: '2',
        shippingFee: '0.5',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        cargoValue: '500',
        shippingFee: '80',
      }));
    }
  }, [appMode]);

  const convertedUsdc = parseFloat(stableFxInputAed) * aedToUsdcRate;
  const convertedEurc = parseFloat(stableFxInputAed) * aedToEurcRate;

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    setLoading(true);
    setCreateProgress('Preparing cargo escrow...');
    logTerminal('Creating cargo escrow shipment...');

    const val = parseFloat(formData.cargoValue);
    const fee = parseFloat(formData.shippingFee);
    const rate = parseFloat(formData.demurrageRatePerHour);
    const freeTime = parseInt(formData.freeTimeHours);
    const tokenAddr = formData.tokenType === 'EURC' ? EURC_ADDRESS : USDC_ADDRESS;
    const poIdNum = formData.poId !== '' ? parseInt(formData.poId) : 999999;

    if (appMode === 'local') {
      setCreateProgress('Securing capital vault...');
      
      setTimeout(() => {
        setCreateProgress('Registering Cargo Twin NFT (Minting ERC-721)...');
        
        setTimeout(() => {
          setCreateProgress('Activating Telemetry Sensor...');
          
          setTimeout(() => {
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

            const activeFxRate = formData.tokenType === 'EURC' ? aedToEurcRate : aedToUsdcRate;

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
              temperature: 4.2, 
              location: formData.departurePort,
              history: [
                { timestamp: Date.now(), status: 'Created', location: formData.departurePort, temperature: 4.2 }
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
              hasPOLoan: hasPOLoan,
              lockedFxRate: activeFxRate,
              // Custom properties
              cargoName: formData.cargoName,
              containerNumber: formData.containerNumber,
              usycWrapped: formData.usycSweep
            } as any;

            const updated = [newShipment, ...shipments];
            setShipments(updated);
            saveLocalShipments(updated);
            setSelectedShipmentId(newId);
            logTerminal(`Local Shipment #${newId} Escrow created. Deposited ${val + fee} ${formData.tokenType}. Locked FX: 1 AED = ${activeFxRate.toFixed(4)} ${formData.tokenType}`);
            showToast('Local Cargo Escrow Created!', 'success');
            setIsCreatingShipment(false);
            setCreateProgress('');
            setFormData({
              ...formData,
              poId: ''
            });
            setLoading(false);
            setWizardStep(1);
          }, 850);
        }, 850);
      }, 850);
    } else {
      // Live on-chain
      if (!contracts) {
        showToast('Please deploy sandbox contracts first!', 'error');
        setLoading(false);
        setIsCreatingShipment(false);
        return;
      }

      // Auto-fund active wallet if it lacks gas or tokens
      const activeUserAddress = signerType === 'web3' && connectedAddress ? connectedAddress : 
                               signerType === 'circle' && circleSession?.address ? circleSession.address : 
                               wallet?.address;

      if (activeUserAddress) {
        setCreateProgress('Checking wallet balances...');
        let gasVal = 0;
        let tokenVal = 0;
        try {
          const realTimeBal = await queryBalances(activeUserAddress as `0x${string}`);
          gasVal = parseFloat(realTimeBal.nativeGas);
          tokenVal = parseFloat(formData.tokenType === 'EURC' ? realTimeBal.eurcToken : realTimeBal.usdcToken);
          logTerminal(`Real-time wallet balance: Gas = ${gasVal} USDC, Token = ${tokenVal} ${formData.tokenType}`);
        } catch (balErr) {
          console.error("Error querying real-time balance:", balErr);
          const currentBalances = signerType === 'web3' ? web3Balances : 
                                  signerType === 'circle' ? circleBalances : 
                                  sandboxBalances;
          gasVal = parseFloat(currentBalances?.nativeGas || '0');
          tokenVal = parseFloat(formData.tokenType === 'EURC' ? currentBalances?.eurcToken || '0' : currentBalances?.usdcToken || '0');
        }
        
        if (gasVal < 0.05 || tokenVal < (val + fee)) {
          logTerminal(`[Auto-Funding] Low balance for ${activeUserAddress.slice(0, 10)}... (Gas: ${gasVal} USDC, Token: ${tokenVal} ${formData.tokenType}). Requesting faucet auto-boost...`);
          setCreateProgress('Auto-funding wallet...');
          
          try {
            const res = await fetch('/api/faucet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: activeUserAddress })
            });
            const data = await res.json();
            if (res.ok && !data.error) {
              logTerminal(`[Auto-Funding Success] Gas Tx: ${data.gasTxHash.slice(0, 15)}... ERC20 Tx: ${data.erc20TxHash.slice(0, 15)}...`);
              showToast('Auto-funded wallet with gas and tokens!', 'success');
              // Wait 1.5 seconds for blockchain state propagation
              await new Promise(r => setTimeout(r, 1500));
              // Refresh balances
              await updateBalances(activeUserAddress, signerType);
            } else {
              logTerminal(`[Auto-Funding Failed] ${data.error || 'Server faucet error'}`);
              throw new Error(`Auto-funding failed: ${data.error || 'Server faucet error'}`);
            }
          } catch (faucetErr) {
            console.error('Auto-funding error:', faucetErr);
            throw faucetErr;
          }
        }
      }

      const activeFxRate = formData.tokenType === 'EURC' ? aedToEurcRate : aedToUsdcRate;

      if (formData.cctpPending) {
        try {
          const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient :
                          signerType === 'circle' && circleSession ? circleSession :
                          wallet.privateKey) as any;
          const { shipmentId, txHash } = await createShipmentWithCCTPPendingOnchain(
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
              token: tokenAddr as `0x${string}`
            },
            (status) => {
              setCreateProgress(status);
              logTerminal(status);
            }
          );

          // Pre-sync metadata to backend with locked rate
          await fetch('/api/shipments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${wallet.address}`
            },
            body: JSON.stringify({
              id: shipmentId,
              buyer: signerType === 'web3' && connectedAddress ? connectedAddress : wallet.address,
              supplier: formData.supplier,
              carrier: formData.carrier,
              cargoValue: val,
              shippingFee: fee,
              releasedSupplierAmount: 0,
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
              passportTokenId: 0,
              temperature: 4.2,
              location: formData.departurePort,
              history: [
                { timestamp: Date.now(), status: 'Created', location: formData.departurePort, temperature: 4.2 }
              ],
              createdTimestamp: Date.now(),
              token: tokenAddr,
              txHash,
              onChain: true,
              lockedFxRate: activeFxRate,
              cctpSourceDomain: 3
            })
          }).catch(err => console.error('Failed to pre-sync metadata:', err));

          showToast(`Onchain Shipment #${shipmentId} Created (Pending CCTP)!`, 'success');
          logTerminal(`Tx Confirmed: ${txHash.slice(0, 15)}... Pending CCTP Funding: ${val + fee} ${formData.tokenType}`);

          await updateBalances(wallet.address, 'sandbox');
          if (connectedAddress) await updateBalances(connectedAddress, 'web3');
          await refreshShipmentsList('live', contracts, wallet);
          setSelectedShipmentId(shipmentId);
          
          setIsCreatingShipment(false);
          setWizardStep(1);
          setCreateProgress('');
          setFormData({
            ...formData,
            poId: '',
            cctpPending: false
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logTerminal(`Onchain creation failed: ${errMsg}`);
          
          const isGasOrTokenErr = errMsg.includes('gas') || 
                                  errMsg.includes('balance') || 
                                  errMsg.includes('USDC') ||
                                  errMsg.includes('transfer') ||
                                  errMsg.includes('revert') ||
                                  errMsg.includes('allowance') ||
                                  errMsg.includes('funder') ||
                                  errMsg.includes('Fund your address') ||
                                  errMsg.includes('HTTP request failed') ||
                                  errMsg.includes('Failed to fetch');

          if (isGasOrTokenErr) {
            logTerminal(`[Auto-Fallback] Local sandbox wallet is unfunded or testnet RPC is congested. Falling back to premium Simulated Mode...`);
            
            const newId = shipments.length > 0 ? Math.max(...shipments.map(s => s.id)) + 1 : 101;
            const val = parseFloat(formData.cargoValue);
            const fee = parseFloat(formData.shippingFee);
            const rate = parseFloat(formData.demurrageRatePerHour);
            const freeTime = parseInt(formData.freeTimeHours);
            const tokenAddr = formData.tokenType === 'EURC' ? EURC_ADDRESS : USDC_ADDRESS;

            const newShipment: ShipmentData = {
              id: newId,
              buyer: signerType === 'web3' && connectedAddress ? connectedAddress : wallet.address,
              supplier: formData.supplier,
              carrier: formData.carrier,
              cargoValue: val,
              shippingFee: fee,
              releasedSupplierAmount: 0,
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
              passportTokenId: newId * 100,
              temperature: 4.2,
              location: formData.departurePort,
              history: [
                { timestamp: Date.now(), status: 'Created', location: formData.departurePort, temperature: 4.2 }
              ],
              createdTimestamp: Date.now(),
              yieldEarned: 0,
              temperatureViolations: 0,
              temperaturePenalty: 0,
              beneficiary: formData.supplier,
              factoringPrice: 0,
              factoringActive: false,
              token: tokenAddr,
              lockedFxRate: activeFxRate,
              cctpSourceDomain: 3
            };

            const updated = [newShipment, ...shipments];
            setShipments(updated);
            saveLocalShipments(updated);
            setSelectedShipmentId(newId);

            logTerminal(`[Simulated CCTP Shipment] Local cargo escrow created! ID: ${newId}. (CORS/Gas Fallback)`);
            showToast(`CCTP onchain creation failed. Simulated shipment #${newId} created!`, 'warning');
            
            setIsCreatingShipment(false);
            setWizardStep(1);
            setCreateProgress('');
            setFormData({
              ...formData,
              poId: '',
              cctpPending: false
            });
          } else {
            showToast('Creation failed.', 'error');
            setIsCreatingShipment(false);
            setWizardStep(1);
            setCreateProgress('');
          }
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        if (formData.useUnifiedBalance) {
          setCreateProgress('Spending from Unified Balance...');
          logTerminal(`Spending ${(val + fee)} USDC from Unified Balance on ${formData.unifiedSourceChain} to Arc Testnet...`);
          const recipient = signerType === 'web3' && connectedAddress ? connectedAddress : wallet.address;
          const spendRes = await spendFromUnifiedBalance(
            formData.unifiedSourceChain,
            'Arc_Testnet',
            recipient,
            (val + fee).toString(),
            signerType,
            wallet,
            browserWalletClient
          );
          if (!spendRes.success) {
            throw new Error(`Unified Balance spend failed: ${spendRes.error}`);
          }
          logTerminal(`[Unified Balance Spend Success] Tx: ${spendRes.txHash}`);
          setCreateProgress('Unified Balance spend confirmed. Creating shipment escrow...');
          await new Promise(r => setTimeout(r, 2000));
        }

        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient :
                        signerType === 'circle' && circleSession ? circleSession :
                        wallet.privateKey) as any;
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

        // Pre-sync metadata to backend with locked rate
        await fetch('/api/shipments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${wallet.address}`
          },
          body: JSON.stringify({
            id: shipmentId,
            buyer: signerType === 'web3' && connectedAddress ? connectedAddress : wallet.address,
            supplier: formData.supplier,
            carrier: formData.carrier,
            cargoValue: val,
            shippingFee: fee,
            releasedSupplierAmount: 0,
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
            passportTokenId: 0,
            temperature: 4.2,
            location: formData.departurePort,
            history: [
              { timestamp: Date.now(), status: 'Created', location: formData.departurePort, temperature: 4.2 }
            ],
            createdTimestamp: Date.now(),
            token: tokenAddr,
            txHash,
            onChain: true,
            lockedFxRate: activeFxRate
          })
        }).catch(err => console.error('Failed to pre-sync metadata:', err));

        showToast(`Onchain Shipment #${shipmentId} Created!`, 'success');
        logTerminal(`Tx Confirmed: ${txHash.slice(0, 15)}... (GTV: ${val + fee} ${formData.tokenType})`);
        
        await updateBalances(wallet.address, 'sandbox');
        if (connectedAddress) await updateBalances(connectedAddress, 'web3');
        await refreshShipmentsList('live', contracts, wallet);
        await refreshPOLoansList('live', contracts);
        setSelectedShipmentId(shipmentId);
        
        setIsCreatingShipment(false);
        setWizardStep(1);
        setCreateProgress('');
        setFormData({
          ...formData,
          poId: '',
          cctpPending: false,
          useUnifiedBalance: false
        });
      } catch (err) {
        console.error("=== FREIGHTX ONCHAIN ESCROW CREATION ERROR ===");
        console.error(err);
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Onchain creation failed: ${errMsg}`);
        
        const isGasOrTokenErr = errMsg.includes('gas') || 
                                errMsg.includes('balance') || 
                                errMsg.includes('USDC') ||
                                errMsg.includes('transfer') ||
                                errMsg.includes('revert') ||
                                errMsg.includes('allowance') ||
                                errMsg.includes('funder') ||
                                errMsg.includes('Fund your address') ||
                                errMsg.includes('HTTP request failed') ||
                                errMsg.includes('Failed to fetch');

        if (isGasOrTokenErr) {
          logTerminal(`[Auto-Fallback] Local sandbox wallet is unfunded or testnet RPC is congested. Falling back to premium Simulated Mode...`);
          
          const newId = shipments.length > 0 ? Math.max(...shipments.map(s => s.id)) + 1 : 101;
          const val = parseFloat(formData.cargoValue);
          const fee = parseFloat(formData.shippingFee);
          const rate = parseFloat(formData.demurrageRatePerHour);
          const freeTime = parseInt(formData.freeTimeHours);
          const hasPOLoan = formData.poId !== '';
          const poIdNum = hasPOLoan ? parseInt(formData.poId) : undefined;
          const tokenAddr = formData.tokenType === 'EURC' ? EURC_ADDRESS : USDC_ADDRESS;

          const newShipment: ShipmentData = {
            id: newId,
            buyer: signerType === 'web3' && connectedAddress ? connectedAddress : wallet.address,
            supplier: formData.supplier,
            carrier: formData.carrier,
            cargoValue: val,
            shippingFee: fee,
            releasedSupplierAmount: 0,
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
            passportTokenId: newId * 100,
            temperature: 4.2,
            location: formData.departurePort,
            history: [
              { timestamp: Date.now(), status: 'Created', location: formData.departurePort, temperature: 4.2 }
            ],
            createdTimestamp: Date.now(),
            yieldEarned: 0,
            temperatureViolations: 0,
            temperaturePenalty: 0,
            beneficiary: formData.supplier,
            factoringPrice: 0,
            factoringActive: false,
            token: tokenAddr,
            poId: hasPOLoan ? poIdNum : undefined,
            hasPOLoan: hasPOLoan,
            lockedFxRate: activeFxRate
          };

          // Handle local PO repayment waterfall
          if (formData.poId !== '') {
            const po = poLoans.find(p => p.id === poIdNum);
            if (po) {
              po.repaid = true;
              newShipment.releasedSupplierAmount = po.repaymentAmount;
              logTerminal(`[PO REPAYMENT WATERFALL] PO Loan #${poIdNum} Repayment amount (${po.repaymentAmount} ${formData.tokenType}) sent directly to Investor.`);
            }
          }

          const updated = [newShipment, ...shipments];
          setShipments(updated);
          saveLocalShipments(updated);
          setSelectedShipmentId(newId);

          logTerminal(`[Simulated Shipment] Local cargo escrow created successfully! ID: ${newId}. (CORS/Gas Fallback)`);
          showToast(`Onchain creation failed. Simulated shipment #${newId} created!`, 'warning');
          
          setIsCreatingShipment(false);
          setWizardStep(1);
          setCreateProgress('');
          setFormData({
            ...formData,
            poId: '',
            cctpPending: false,
            useUnifiedBalance: false
          });
        } else {
          showToast('Token transfer or creation failed. Fund your address.', 'error');
          setIsCreatingShipment(false);
          setWizardStep(1);
          setCreateProgress('');
        }
      } finally {
        setLoading(false);
      }
    }
  };

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
        buyer: '0x9b1C51CEF8BC8757Ad757845eF80a390A3b9D194',
        cargoValue: '4.0',
        loanAmount: '3.0',
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

      // Auto-fund active wallet if it lacks gas
      const activeUserAddress = signerType === 'web3' && connectedAddress ? connectedAddress : 
                               signerType === 'circle' && circleSession?.address ? circleSession.address : 
                               wallet?.address;

      if (activeUserAddress) {
        setPoProgress('Checking wallet balances...');
        let gasVal = 0;
        try {
          const realTimeBal = await queryBalances(activeUserAddress as `0x${string}`);
          gasVal = parseFloat(realTimeBal.nativeGas);
          logTerminal(`Real-time wallet balance (PO Request): Gas = ${gasVal} USDC`);
        } catch (balErr) {
          console.error("Error querying real-time balance:", balErr);
          const currentBalances = signerType === 'web3' ? web3Balances : 
                                  signerType === 'circle' ? circleBalances : 
                                  sandboxBalances;
          gasVal = parseFloat(currentBalances?.nativeGas || '0');
        }
        
        if (gasVal < 0.05) {
          logTerminal(`[Auto-Funding] Low gas balance (${gasVal} USDC) for ${activeUserAddress.slice(0, 10)}... Requesting faucet auto-boost...`);
          setPoProgress('Auto-funding wallet...');
          
          try {
            const res = await fetch('/api/faucet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: activeUserAddress })
            });
            const data = await res.json();
            if (res.ok && !data.error) {
              logTerminal(`[Auto-Funding Success] Gas Tx: ${data.gasTxHash.slice(0, 15)}...`);
              showToast('Auto-funded wallet with gas!', 'success');
              await new Promise(r => setTimeout(r, 1500));
              await updateBalances(activeUserAddress, signerType);
            } else {
              logTerminal(`[Auto-Funding Failed] ${data.error || 'Server faucet error'}`);
              throw new Error(`Auto-funding failed: ${data.error || 'Server faucet error'}`);
            }
          } catch (faucetErr) {
            console.error('Auto-funding error:', faucetErr);
            throw faucetErr;
          }
        }
      }

      try {
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient :
                        signerType === 'circle' && circleSession ? circleSession :
                        wallet.privateKey) as any;
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
          buyer: '0x9b1C51CEF8BC8757Ad757845eF80a390A3b9D194',
          cargoValue: '4.0',
          loanAmount: '3.0',
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
      if (!contracts) {
        setLoading(false);
        setPoProgress('');
        return;
      }

      // Auto-fund active wallet if it lacks gas or tokens
      const activeUserAddress = signerType === 'web3' && connectedAddress ? connectedAddress : 
                               signerType === 'circle' && circleSession?.address ? circleSession.address : 
                               wallet?.address;

      if (activeUserAddress) {
        setPoProgress('Checking wallet balances...');
        let gasVal = 0;
        let tokenVal = 0;
        try {
          const realTimeBal = await queryBalances(activeUserAddress as `0x${string}`);
          gasVal = parseFloat(realTimeBal.nativeGas);
          tokenVal = parseFloat(loan.token === EURC_ADDRESS ? realTimeBal.eurcToken : realTimeBal.usdcToken);
          logTerminal(`Real-time wallet balance (Fund PO): Gas = ${gasVal} USDC, Token = ${tokenVal} ${loan.token === EURC_ADDRESS ? 'EURC' : 'USDC'}`);
        } catch (balErr) {
          console.error("Error querying real-time balance:", balErr);
          const currentBalances = signerType === 'web3' ? web3Balances : 
                                  signerType === 'circle' ? circleBalances : 
                                  sandboxBalances;
          gasVal = parseFloat(currentBalances?.nativeGas || '0');
          tokenVal = parseFloat(loan.token === EURC_ADDRESS ? currentBalances?.eurcToken || '0' : currentBalances?.usdcToken || '0');
        }
        
        if (gasVal < 0.05 || tokenVal < loan.loanRequested) {
          logTerminal(`[Auto-Funding] Low balance for ${activeUserAddress.slice(0, 10)}... (Gas: ${gasVal} USDC, Token: ${tokenVal}). Requesting faucet auto-boost...`);
          setPoProgress('Auto-funding wallet...');
          
          try {
            const res = await fetch('/api/faucet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: activeUserAddress })
            });
            const data = await res.json();
            if (res.ok && !data.error) {
              logTerminal(`[Auto-Funding Success] Gas Tx: ${data.gasTxHash.slice(0, 15)}... ERC20 Tx: ${data.erc20TxHash.slice(0, 15)}...`);
              showToast('Auto-funded wallet with gas and tokens!', 'success');
              await new Promise(r => setTimeout(r, 1500));
              await updateBalances(activeUserAddress, signerType);
            } else {
              logTerminal(`[Auto-Funding Failed] ${data.error || 'Server faucet error'}`);
              throw new Error(`Auto-funding failed: ${data.error || 'Server faucet error'}`);
            }
          } catch (faucetErr) {
            console.error('Auto-funding error:', faucetErr);
            throw faucetErr;
          }
        }
      }

      try {
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient :
                        signerType === 'circle' && circleSession ? circleSession :
                        wallet.privateKey) as any;
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
        await updateBalances(wallet.address, 'sandbox');
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

  const CARRIERS = [
    { name: 'Maersk Line', address: '0x1C902e11A58c4BB489B3ab1c51CEf8BC8757845E' },
    { name: 'MSC Logistics', address: '0x8888888888888888888888888888888888888888' },
    { name: 'Hapag-Lloyd', address: '0x9999999999999999999999999999999999999999' },
    { name: 'Evergreen Marine', address: '0x7777777777777777777777777777777777777777' }
  ];

  const getLoadingStepStatus = (index: number) => {
    if (!loading) return 'pending';
    const progressLower = createProgress.toLowerCase();
    
    if (index === 1) {
      if (progressLower.includes('nft') || progressLower.includes('minter') || progressLower.includes('sensor') || progressLower.includes('telemetry') || progressLower.includes('synced') || progressLower.includes('success') || progressLower.includes('create')) {
        return 'completed';
      }
      return 'active';
    }
    if (index === 2) {
      if (progressLower.includes('nft') || progressLower.includes('minter')) {
        return 'active';
      }
      if (progressLower.includes('sensor') || progressLower.includes('telemetry') || progressLower.includes('synced') || progressLower.includes('success')) {
        return 'completed';
      }
      return 'pending';
    }
    if (index === 3) {
      if (progressLower.includes('sensor') || progressLower.includes('telemetry')) {
        return 'active';
      }
      if (progressLower.includes('synced') || progressLower.includes('success')) {
        return 'completed';
      }
      return 'pending';
    }
    return 'pending';
  };

  const [showPOSection, setShowPOSection] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header with Create Button */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Escrow Shipments</h2>
          <p className="section-subtitle">Secure cargo payment vaults with automated milestone releases.</p>
        </div>
        
        {!isCreatingShipment && (
          <button onClick={() => setIsCreatingShipment(true)} className="btn btn-primary">
            <Box size={16} /> Create Escrow
          </button>
        )}
      </div>

      {/* StableFX Live conversion and Create Escrow form side-by-side */}
      {isCreatingShipment && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 10, 12, 0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '680px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-premium)',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh',
            position: 'relative'
          }}>
            
            {/* Custom Loading State Overlay */}
            {loading && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(10, 10, 12, 0.95)',
                zIndex: 1100,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px',
                textAlign: 'center'
              }}>
                <div style={{
                  padding: '24px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  maxWidth: '400px',
                  width: '100%',
                  boxShadow: 'var(--shadow-premium)'
                }}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Deploying Cargo Escrow Vault
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Initializing secure multi-sig smart contract ledger...
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', marginBottom: '24px' }}>
                    {/* Step 1: Securing capital vault */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: getLoadingStepStatus(1) === 'completed' ? 'rgba(74, 222, 128, 0.1)' : getLoadingStepStatus(1) === 'active' ? 'rgba(0, 136, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: getLoadingStepStatus(1) === 'completed' ? '#4ade80' : getLoadingStepStatus(1) === 'active' ? 'var(--primary)' : 'var(--text-muted)',
                        border: '1px solid',
                        borderColor: getLoadingStepStatus(1) === 'completed' ? 'rgba(74, 222, 128, 0.3)' : getLoadingStepStatus(1) === 'active' ? 'var(--primary)' : 'var(--border)'
                      }}>
                        {getLoadingStepStatus(1) === 'completed' ? <Check size={14} /> : getLoadingStepStatus(1) === 'active' ? <Loader2 size={14} className="animate-spin" /> : <div style={{width: 6, height: 6, borderRadius: '50%', background: 'currentColor'}} />}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: getLoadingStepStatus(1) === 'active' ? 600 : 500, color: getLoadingStepStatus(1) === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        Securing capital vault...
                      </span>
                    </div>
                    
                    {/* Step 2: Registering Cargo Twin NFT */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: getLoadingStepStatus(2) === 'completed' ? 'rgba(74, 222, 128, 0.1)' : getLoadingStepStatus(2) === 'active' ? 'rgba(0, 136, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: getLoadingStepStatus(2) === 'completed' ? '#4ade80' : getLoadingStepStatus(2) === 'active' ? 'var(--primary)' : 'var(--text-muted)',
                        border: '1px solid',
                        borderColor: getLoadingStepStatus(2) === 'completed' ? 'rgba(74, 222, 128, 0.3)' : getLoadingStepStatus(2) === 'active' ? 'var(--primary)' : 'var(--border)'
                      }}>
                        {getLoadingStepStatus(2) === 'completed' ? <Check size={14} /> : getLoadingStepStatus(2) === 'active' ? <Loader2 size={14} className="animate-spin" /> : <div style={{width: 6, height: 6, borderRadius: '50%', background: 'currentColor'}} />}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: getLoadingStepStatus(2) === 'active' ? 600 : 500, color: getLoadingStepStatus(2) === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        Registering Cargo Twin NFT...
                      </span>
                    </div>

                    {/* Step 3: Activating Telemetry Sensor */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: getLoadingStepStatus(3) === 'completed' ? 'rgba(74, 222, 128, 0.1)' : getLoadingStepStatus(3) === 'active' ? 'rgba(0, 136, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: getLoadingStepStatus(3) === 'completed' ? '#4ade80' : getLoadingStepStatus(3) === 'active' ? 'var(--primary)' : 'var(--text-muted)',
                        border: '1px solid',
                        borderColor: getLoadingStepStatus(3) === 'completed' ? 'rgba(74, 222, 128, 0.3)' : getLoadingStepStatus(3) === 'active' ? 'var(--primary)' : 'var(--border)'
                      }}>
                        {getLoadingStepStatus(3) === 'completed' ? <Check size={14} /> : getLoadingStepStatus(3) === 'active' ? <Loader2 size={14} className="animate-spin" /> : <div style={{width: 6, height: 6, borderRadius: '50%', background: 'currentColor'}} />}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: getLoadingStepStatus(3) === 'active' ? 600 : 500, color: getLoadingStepStatus(3) === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        Activating Telemetry Sensor...
                      </span>
                    </div>
                  </div>

                  {/* Dev details dropdown */}
                  <details style={{ width: '100%', textAlign: 'left', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none' }}>Developer Details</summary>
                    <div style={{ marginTop: '8px', padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', wordBreak: 'break-all', maxHeight: '100px', overflowY: 'auto' }}>
                      <div>Status: {createProgress || 'Initializing transaction ledger...'}</div>
                    </div>
                  </details>
                </div>
              </div>
            )}

            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: 'var(--primary)' }} /> One-Click Voyage Booking
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Configure cargo identity, transit financials, and collateral parameters.
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsCreatingShipment(false);
                  setWizardStep(1);
                }} 
                className="btn btn-secondary btn-icon" 
                style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                &times;
              </button>
            </div>

            {/* Stepper Header */}
            <div style={{
              padding: '12px 24px',
              background: 'rgba(0,0,0,0.05)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              fontWeight: 600
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: wizardStep === 1 ? 'var(--primary)' : 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', width: '18px', height: '18px', borderRadius: '50%', background: wizardStep === 1 ? 'var(--primary)' : 'var(--border)', color: wizardStep === 1 ? '#fff' : 'var(--text-muted)', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>1</span>
                Shipment Identity
              </div>
              <div style={{ height: '1px', flex: 1, background: 'var(--border)', margin: '0 12px' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: wizardStep === 2 ? 'var(--primary)' : 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', width: '18px', height: '18px', borderRadius: '50%', background: wizardStep === 2 ? 'var(--primary)' : 'var(--border)', color: wizardStep === 2 ? '#fff' : 'var(--text-muted)', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>2</span>
                Financials & Yield
              </div>
              <div style={{ height: '1px', flex: 1, background: 'var(--border)', margin: '0 12px' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: wizardStep === 3 ? 'var(--primary)' : 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', width: '18px', height: '18px', borderRadius: '50%', background: wizardStep === 3 ? 'var(--primary)' : 'var(--border)', color: wizardStep === 3 ? '#fff' : 'var(--text-muted)', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>3</span>
                Linked PO & Confirm
              </div>
            </div>

            {/* Modal Wizard Body */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div style={{
                display: 'flex',
                width: '300%',
                transform: `translateX(-${(wizardStep - 1) * 33.33}%)`,
                transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                {/* Step 1: Shipment Identity */}
                <div style={{ width: '33.33%', flexShrink: 0, paddingRight: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="grid-cols-2">
                      <div className="form-group">
                        <label className="form-label">Cargo Commodity Name</label>
                        <input 
                          className="form-input"
                          placeholder="e.g. Frozen Food, Medical Supplies"
                          value={formData.cargoName}
                          onChange={(e) => setFormData({...formData, cargoName: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Container Serial ID</label>
                        <input 
                          className="form-input"
                          placeholder="e.g. MSKU-402941-0"
                          value={formData.containerNumber}
                          onChange={(e) => setFormData({...formData, containerNumber: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Carrier & Logistics Partner</label>
                      <select 
                        className="form-input"
                        value={formData.carrier}
                        onChange={(e) => setFormData({...formData, carrier: e.target.value})}
                      >
                        {CARRIERS.map(c => (
                          <option key={c.address} value={c.address}>
                            {c.name} ({c.address.slice(0, 10)}...)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid-cols-2">
                      <div className="form-group">
                        <label className="form-label">Port of Departure</label>
                        <input 
                          className="form-input"
                          placeholder="Departure Terminal"
                          value={formData.departurePort}
                          onChange={(e) => setFormData({...formData, departurePort: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Port of Destination</label>
                        <input 
                          className="form-input"
                          placeholder="Arrival Gateway"
                          value={formData.destinationPort}
                          onChange={(e) => setFormData({...formData, destinationPort: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Supplier Beneficiary Wallet Address</label>
                      <input 
                        className="form-input"
                        placeholder="0x..."
                        value={formData.supplier}
                        onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                        required
                        disabled={formData.poId !== ''}
                      />
                      {formData.poId !== '' && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Locked by active pre-shipment PO loan contract.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 2: Financials & Yield */}
                <div style={{ width: '33.33%', flexShrink: 0, paddingRight: '12px', paddingLeft: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Cargo Value</label>
                        <input 
                          type="number"
                          step="any"
                          className="form-input"
                          value={formData.cargoValue}
                          onChange={(e) => setFormData({...formData, cargoValue: e.target.value})}
                          required
                          disabled={formData.poId !== ''}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Logistics Fee</label>
                        <input 
                          type="number"
                          step="any"
                          className="form-input"
                          value={formData.shippingFee}
                          onChange={(e) => setFormData({...formData, shippingFee: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Currency</label>
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
                        <label className="form-label">Free Time (Hours)</label>
                        <input 
                          type="number"
                          className="form-input"
                          value={formData.freeTimeHours}
                          onChange={(e) => setFormData({...formData, freeTimeHours: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Demurrage Rate/Hour</label>
                        <input 
                          type="number"
                          className="form-input"
                          value={formData.demurrageRatePerHour}
                          onChange={(e) => setFormData({...formData, demurrageRatePerHour: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    {/* Integrated StableFX Converter */}
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed var(--border)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <TrendingUp size={12} /> StableFX AED Dirham Converter
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Oracle: 1 AED = {formData.tokenType === 'EURC' ? aedToEurcRate.toFixed(4) : aedToUsdcRate.toFixed(4)} {formData.tokenType}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="number"
                          placeholder="AED invoice amount"
                          className="form-input"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                          value={stableFxInputAed}
                          onChange={(e) => setStableFxInputAed(e.target.value)}
                        />
                        <button 
                          type="button" 
                          onClick={() => {
                            const converted = parseFloat(stableFxInputAed) * (formData.tokenType === 'EURC' ? aedToEurcRate : aedToUsdcRate);
                            setFormData({...formData, cargoValue: converted.toFixed(2)});
                            showToast(`Applied converted AED value to ${formData.tokenType} value field.`, 'success');
                          }}
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          Convert & Apply
                        </button>
                      </div>
                    </div>

                    {/* Visual Yield Sweep Toggle */}
                    <div style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: '12px',
                      marginTop: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} htmlFor="usycSweepToggle">
                            <Shield size={14} style={{ color: '#4ade80' }} /> Sweep locked capital to yield vault
                          </label>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                            Earn ~5.2% APY in USYC during voyage transit
                          </span>
                        </div>
                        <input 
                          type="checkbox"
                          id="usycSweepToggle"
                          checked={formData.usycSweep}
                          onChange={(e) => setFormData({...formData, usycSweep: e.target.checked})}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </div>
                      
                      {formData.usycSweep && (
                        <div style={{
                          background: 'rgba(74, 222, 128, 0.03)',
                          border: '1px solid rgba(74, 222, 128, 0.15)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          marginTop: '10px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          animation: 'slideDown 0.2s ease-out'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#4ade80',
                            marginTop: '4px',
                            boxShadow: '0 0 8px #4ade80'
                          }} />
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                            <strong>USYC sweep active.</strong> Double-duty asset utilization enabled. Locked cash is collateralized into tokenized treasury bills, accruing real interest. Upon cargo customs clearance, net yield is automatically paid back.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 3: Linked Purchase Order & Confirm */}
                <div style={{ width: '33.33%', flexShrink: 0, paddingLeft: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Linked PO Selector */}
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Coins size={14} style={{ color: '#4ade80' }} /> Link Funded Purchase Order Loan (Optional)
                      </label>
                      <select 
                        className="form-input"
                        value={formData.poId}
                        onChange={(e) => {
                          const selectedPoId = e.target.value;
                          if (selectedPoId === '') {
                            setFormData({
                              ...formData,
                              poId: '',
                              supplier: '0x8D92F677cd6303cEc089B5F319D72Aa797Da5300',
                              cargoValue: '2.0',
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
                              showToast(`Linked PO Loan #${selectedPoId}. Counterparty and Value fields auto-populated.`, 'success');
                            }
                          }
                        }}
                      >
                        <option value="">-- No Linked PO financing --</option>
                        {poLoans.filter(p => p.funded && !p.repaid && p.buyer.toLowerCase() === (signerType === 'web3' && connectedAddress ? connectedAddress.toLowerCase() : wallet?.address?.toLowerCase())).map(p => (
                          <option key={p.id} value={p.id}>
                            PO #{p.id} (Supplier: {p.supplier.slice(0, 8)}..., Value: {p.cargoValue} {p.token === EURC_ADDRESS ? 'EURC' : 'USDC'})
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        Auto-repays loan principal and 5% flat interest to funder directly from deposit pool upon settlement.
                      </span>
                    </div>

                    {/* Booking Voyage Summary Card */}
                    <div style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '16px'
                    }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                        Voyage Summary Recap
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Cargo Identity:</span>
                          <div style={{ fontWeight: 600, marginTop: '2px' }}>{formData.cargoName}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Container Number:</span>
                          <div style={{ fontWeight: 600, marginTop: '2px' }}>{formData.containerNumber}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Trade Route:</span>
                          <div style={{ fontWeight: 600, marginTop: '2px' }}>{formData.departurePort} &rarr; {formData.destinationPort}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Carrier Agent:</span>
                          <div style={{ fontWeight: 600, marginTop: '2px' }}>
                            {CARRIERS.find(c => c.address === formData.carrier)?.name || 'Custom Carrier'}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Total Secured deposit:</span>
                          <div style={{ fontWeight: 700, color: 'var(--primary)', marginTop: '2px', fontSize: '12px' }}>
                            {(parseFloat(formData.cargoValue) + parseFloat(formData.shippingFee)).toFixed(2)} {formData.tokenType}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Yield Sweeping status:</span>
                          <div style={{ fontWeight: 600, color: formData.usycSweep ? '#4ade80' : 'var(--text-muted)', marginTop: '2px' }}>
                            {formData.usycSweep ? 'USYC Yield Sweep Active (5.2%)' : 'Disabled'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Mode Network Options */}
                    {appMode === 'live' && (
                      <div style={{
                        background: 'rgba(0,0,0,0.1)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox"
                            id="cctpPending"
                            checked={formData.cctpPending}
                            onChange={(e) => setFormData({...formData, cctpPending: e.target.checked, useUnifiedBalance: false})}
                            disabled={formData.poId !== ''}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor="cctpPending" style={{ fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                            CCTP Cross-Chain Funding (Deposit from Sepolia/Arbitrum)
                          </label>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          <input 
                            type="checkbox"
                            id="useUnifiedBalance"
                            checked={formData.useUnifiedBalance}
                            onChange={(e) => setFormData({...formData, useUnifiedBalance: e.target.checked, cctpPending: false})}
                            disabled={formData.poId !== '' || formData.tokenType === 'EURC'}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor="useUnifiedBalance" style={{ fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                            Fund Escrow with App Kit Unified Balance (USDC only)
                          </label>
                        </div>
                        
                        {formData.useUnifiedBalance && (
                          <div style={{ paddingLeft: '20px', marginTop: '6px' }}>
                            <select
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                              value={formData.unifiedSourceChain}
                              onChange={(e) => setFormData({...formData, unifiedSourceChain: e.target.value as any})}
                            >
                              <option value="Ethereum_Sepolia">Ethereum Sepolia</option>
                              <option value="Arbitrum_Sepolia">Arbitrum Sepolia</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Wizard Footer Controls */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div>
                {wizardStep > 1 ? (
                  <button 
                    type="button" 
                    onClick={() => setWizardStep(prev => prev - 1)} 
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsCreatingShipment(false);
                      setWizardStep(1);
                    }} 
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div>
                {wizardStep < 3 ? (
                  <button 
                    type="button" 
                    onClick={() => {
                      if (wizardStep === 1) {
                        if (!formData.cargoName.trim() || !formData.containerNumber.trim() || !formData.supplier.trim() || !formData.departurePort.trim() || !formData.destinationPort.trim()) {
                          showToast('Please fill out all identity and route fields.', 'warning');
                          return;
                        }
                      }
                      setWizardStep(prev => prev + 1);
                    }} 
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleCreateShipment} 
                    disabled={loading} 
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Landmark size={14} /> Lock Collateral & Open Escrow
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Shipments List */}
      <div>
        {loading && shipments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <Loader2 className="animate-spin-slow" size={28} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '14px' }}>Loading shipments...</p>
          </div>
        ) : shipments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <Anchor size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>No Escrow Shipments</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Create a cargo escrow to get started.
            </p>
            <button onClick={() => setIsCreatingShipment(true)} className="btn btn-primary">
              Create Escrow
            </button>
          </div>
        ) : (
          <div>
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
                          background: selectedShipmentId === s.id ? 'var(--primary-soft)' : 'transparent' 
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
                          {s.lockedFxRate && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--success)', marginTop: '2px', fontWeight: 'bold' }}>
                              Locked FX: 1 AED = {s.lockedFxRate.toFixed(4)} {symbol}
                            </div>
                          )}
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
                            {s.status !== 'Completed' && s.status !== 'Cancelled' && (
                              <button 
                                onClick={() => {
                                  setSelectedShipmentId(s.id);
                                  setActiveTab('disputes');
                                }}
                                className="btn btn-secondary animate-pulse" 
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderColor: 'rgba(255,23,68,0.2)', color: 'var(--danger)' }}
                              >
                                Raise Dispute
                              </button>
                            )}
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

      {/* PO Financing Section — Progressive Disclosure */}
      <div className="glass-panel">
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowPOSection(!showPOSection)}
        >
          <div>
            <h3 className="section-title" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins size={18} style={{ color: 'var(--success)' }} /> Purchase Order Financing
            </h3>
            <p className="section-subtitle" style={{ marginTop: '4px' }}>Pre-shipment working capital with auto-repayment on escrow deposit.</p>
          </div>
          <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }}>
            {showPOSection ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {showPOSection && <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
          
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

        </div>}
      </div>

    </div>
  );
}
