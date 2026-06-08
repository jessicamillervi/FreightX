'use client';

import React, { useState, useEffect } from 'react';
import { type WalletClient } from 'viem';
import { Box, Anchor, TrendingUp, Loader2, Landmark, Check, Coins } from 'lucide-react';
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
  USDC_ADDRESS,
  EURC_ADDRESS
} from '@/services/sandbox';
import { type ShipmentData, type POLoanData } from '@/lib/types';

export default function EscrowTab() {
  const { appMode, showToast, logTerminal, updateBalances, contracts, setActiveTab } = useAppContext();
  const { wallet, signerType, connectedAddress, browserWalletClient } = useWallet();
  const { shipments, setShipments, selectedShipmentId, setSelectedShipmentId, loading, setLoading, refreshShipmentsList } = useShipments();
  const { poLoans, setPoLoans, poProgress, setPoProgress, refreshPOLoansList } = usePOLoans();

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
    freeTimeHours: '2', 
    demurrageRatePerHour: '15',
    tokenType: 'USDC' as 'USDC' | 'EURC',
    poId: '',
    cctpPending: false,
    useUnifiedBalance: false,
    unifiedSourceChain: 'Ethereum_Sepolia' as 'Ethereum_Sepolia' | 'Arbitrum_Sepolia'
  });

  // PO Request Form
  const [poRequestForm, setPoRequestForm] = useState({
    buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
    cargoValue: '1000',
    loanAmount: '800',
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
        lockedFxRate: activeFxRate
      };

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
    } else {
      // Live on-chain
      if (!contracts) {
        showToast('Please deploy sandbox contracts first!', 'error');
        setLoading(false);
        setIsCreatingShipment(false);
        return;
      }

      const activeFxRate = formData.tokenType === 'EURC' ? aedToEurcRate : aedToUsdcRate;

      if (formData.cctpPending) {
        try {
          const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
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
          setCreateProgress('');
          setFormData({
            ...formData,
            poId: '',
            cctpPending: false
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logTerminal(`Onchain creation failed: ${errMsg}`);
          showToast('Creation failed.', 'error');
          setIsCreatingShipment(false);
          setCreateProgress('');
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

        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
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
        setCreateProgress('');
        setFormData({
          ...formData,
          poId: '',
          cctpPending: false,
          useUnifiedBalance: false
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logTerminal(`Onchain creation failed: ${errMsg}`);
        showToast('Token transfer or creation failed. Fund your address.', 'error');
        setIsCreatingShipment(false);
        setCreateProgress('');
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
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
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
      try {
        const signer = (signerType === 'web3' && browserWalletClient ? browserWalletClient : wallet.privateKey) as string | WalletClient;
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

  return (
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

              <div className="form-group" style={{ display: appMode === 'live' ? 'flex' : 'none', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <input 
                  type="checkbox"
                  id="cctpPending"
                  checked={formData.cctpPending}
                  onChange={(e) => setFormData({...formData, cctpPending: e.target.checked, useUnifiedBalance: false})}
                  disabled={formData.poId !== ''}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <label htmlFor="cctpPending" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Enable CCTP Cross-Chain Funding (Deposit from Sepolia/Arbitrum)
                </label>
              </div>

              <div className="form-group" style={{ display: appMode === 'live' ? 'block' : 'none', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="checkbox"
                    id="useUnifiedBalance"
                    checked={formData.useUnifiedBalance}
                    onChange={(e) => setFormData({...formData, useUnifiedBalance: e.target.checked, cctpPending: false})}
                    disabled={formData.poId !== '' || formData.tokenType === 'EURC'}
                    style={{ width: 'auto', cursor: 'pointer' }}
                  />
                  <label htmlFor="useUnifiedBalance" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Fund Escrow with App Kit Unified Balance (USDC only)
                  </label>
                </div>
                {formData.useUnifiedBalance && (
                  <div style={{ paddingLeft: '1.25rem' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Unified Balance Source Chain</label>
                    <select
                      className="form-input"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', width: '200px' }}
                      value={formData.unifiedSourceChain}
                      onChange={(e) => setFormData({...formData, unifiedSourceChain: e.target.value as 'Ethereum_Sepolia' | 'Arbitrum_Sepolia'})}
                    >
                      <option value="Ethereum_Sepolia">Ethereum Sepolia</option>
                      <option value="Arbitrum_Sepolia">Arbitrum Sepolia</option>
                    </select>
                  </div>
                )}
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
                <strong>{eurcToUsdcRate.toFixed(4)} USDC</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>AED / USDC Oracle Rate:</span>
                <strong>{aedToUsdcRate.toFixed(4)} USDC</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>AED / EURC Oracle Rate:</span>
                <strong>{aedToEurcRate.toFixed(4)} EURC</strong>
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
  );
}
