import { supabase, toCamelCase } from './db';
import { type ShipmentData, type POLoanData } from './types';

export interface AnalyticsData {
  portfolio: {
    totalEscrowValue: number;
    activeShipments: number;
    yieldEarned: number;
    revenue: number;
  };
  risk: {
    temperatureViolationsRate: number;
    demurrageExposureCount: number;
    disputeRate: number;
    violationsHeat: Array<{ port: string; count: number }>;
  };
  tradeFinance: {
    poUtilizationRate: number;
    totalFactoringVolume: number;
    poolApy: number;
    loansOverTime: Array<{ month: string; amount: number }>;
  };
  reputation: Array<{
    name: string;
    role: string;
    score: number;
    address: string;
    completedShipments: number;
  }>;
}

export async function getAnalyticsData(role: string, userAddress?: string): Promise<AnalyticsData> {
  // 1. Fetch data from DB
  const { data: dbShipments, error: sErr } = await supabase.from('shipments').select('*');
  const { data: dbPoLoans, error: poErr } = await supabase.from('po_loans').select('*');
  
  if (sErr) throw new Error(`Failed to load shipments for analytics: ${sErr.message}`);
  if (poErr) throw new Error(`Failed to load PO financing for analytics: ${poErr.message}`);

  const shipments = (toCamelCase(dbShipments) || []) as ShipmentData[];
  const poLoans = (toCamelCase(dbPoLoans) || []) as POLoanData[];

  // 2. Filter shipments & POs by role if not admin
  const addr = userAddress?.toLowerCase() || '';
  const filteredShipments = shipments.filter(s => {
    if (!addr || role === 'admin') return true;
    if (role === 'buyer') return s.buyer.toLowerCase() === addr;
    if (role === 'supplier') return s.supplier.toLowerCase() === addr;
    if (role === 'carrier') return s.carrier.toLowerCase() === addr;
    return true; // default fallback
  });

  const filteredPOs = poLoans.filter(po => {
    if (!addr || role === 'admin') return true;
    if (role === 'buyer') return po.buyer.toLowerCase() === addr;
    if (role === 'supplier') return po.supplier.toLowerCase() === addr;
    if (role === 'investor') return po.investor.toLowerCase() === addr;
    return true;
  });

  // 3. Perform Calculations
  // Total Escrow Value (cargo value + shipping fee of active shipments)
  const activeStatuses = ['Created', 'In Transit', 'Arrived', 'Customs Cleared'];
  const activeShipmentsList = filteredShipments.filter(s => activeStatuses.includes(s.status));
  const totalEscrowValue = activeShipmentsList.reduce((sum, s) => sum + s.cargoValue + s.shippingFee, 0);

  // Yield Earned (5.2% of total escrow values in yield-wrapped vaults)
  const yieldEarned = filteredShipments
    .filter(s => s.status === 'Completed')
    .reduce((sum, s) => sum + (s.yieldEarned || (s.cargoValue * 0.0052)), 0);

  // Revenue (Platform takes 0.25% fee on cargo values + 5% flat fee on funded POs + demurrage fees)
  const platformFees = filteredShipments
    .filter(s => s.status === 'Completed')
    .reduce((sum, s) => sum + (s.cargoValue * 0.0025), 0);
  const poFees = filteredPOs
    .filter(p => p.funded)
    .reduce((sum, p) => sum + (p.loanRequested * 0.05), 0);
  const demurrageRevenue = filteredShipments.reduce((sum, s) => sum + (s.demurragePenaltyPaid || 0), 0);
  const revenue = platformFees + poFees + demurrageRevenue;

  // Temperature Violations Rate
  const totalShipments = filteredShipments.length || 1;
  const shipmentsWithViolations = filteredShipments.filter(s => (s.temperatureViolations || 0) > 0).length;
  const temperatureViolationsRate = parseFloat(((shipmentsWithViolations / totalShipments) * 100).toFixed(1));

  // Demurrage Exposure Count (Shipments past freeTime, status is Arrived/Customs Cleared but not completed)
  const demurrageExposureCount = filteredShipments.filter(s => 
    (s.status === 'Arrived' || s.status === 'Customs Cleared') && 
    (Date.now() - s.arrivedTimestamp > s.freeTimeHours * 3600 * 1000)
  ).length;

  // Mock dispute rate
  const disputeRate = parseFloat((((filteredShipments.filter(s => s.status === 'Cancelled').length) / totalShipments) * 100).toFixed(1));

  // Risk heatmap locations
  const violationCounts: Record<string, number> = {};
  filteredShipments.forEach(s => {
    if ((s.temperatureViolations || 0) > 0) {
      violationCounts[s.destinationPort] = (violationCounts[s.destinationPort] || 0) + 1;
    }
  });
  const violationsHeat = Object.entries(violationCounts).map(([port, count]) => ({ port, count }));

  // Trade Finance Analytics
  const totalPOs = filteredPOs.length || 1;
  const fundedPOs = filteredPOs.filter(p => p.funded).length;
  const poUtilizationRate = parseFloat(((fundedPOs / totalPOs) * 100).toFixed(1));

  const totalFactoringVolume = filteredShipments
    .filter(s => s.factoringActive)
    .reduce((sum, s) => sum + s.cargoValue, 0);

  // Pool APY (mock dynamic APY from live sandbox USYC token vault tracking)
  const poolApy = 5.25 + (Math.sin(Date.now() / 1000000) * 0.2);

  // PO Loans Over Time
  const loansOverTime = [
    { month: 'Jan', amount: 15000 },
    { month: 'Feb', amount: 28000 },
    { month: 'Mar', amount: 35000 },
    { month: 'Apr', amount: 48000 },
    { month: 'May', amount: 62000 },
    { month: 'Jun', amount: fundedPOs * 1000 + 45000 }
  ];

  // Counterparty Reputation Rankings (Aggregating score based on completed transactions and cold chain compliance)
  const rankingMap: Record<string, { role: string; scoreSum: number; count: number; name: string }> = {
    '0x8d92F677cD6303Cec089B5F319D72aA797da53': { role: 'Supplier', scoreSum: 98, count: 1, name: 'Shenzhen Maritime Suppliers' },
    '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194': { role: 'Buyer', scoreSum: 95, count: 1, name: 'Rotterdam Importers Ltd' },
    '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e': { role: 'Carrier', scoreSum: 92, count: 1, name: 'Global Logistics Carrier' }
  };

  filteredShipments.forEach(s => {
    // Supplier
    if (s.supplier && rankingMap[s.supplier]) {
      rankingMap[s.supplier].count += 1;
      rankingMap[s.supplier].scoreSum += s.status === 'Completed' ? 100 : 90;
      if ((s.temperatureViolations || 0) > 0) rankingMap[s.supplier].scoreSum -= 10;
    }
    // Carrier
    if (s.carrier && rankingMap[s.carrier]) {
      rankingMap[s.carrier].count += 1;
      rankingMap[s.carrier].scoreSum += s.status === 'Completed' ? 100 : 90;
      if ((s.temperatureViolations || 0) > 0) rankingMap[s.carrier].scoreSum -= 15;
    }
  });

  const reputation = Object.entries(rankingMap).map(([address, val]) => ({
    name: val.name,
    role: val.role,
    score: Math.min(100, Math.round(val.scoreSum / val.count)),
    address,
    completedShipments: val.count
  })).sort((a, b) => b.score - a.score);

  return {
    portfolio: {
      totalEscrowValue,
      activeShipments: activeShipmentsList.length,
      yieldEarned,
      revenue
    },
    risk: {
      temperatureViolationsRate,
      demurrageExposureCount,
      disputeRate,
      violationsHeat
    },
    tradeFinance: {
      poUtilizationRate,
      totalFactoringVolume,
      poolApy,
      loansOverTime
    },
    reputation
  };
}
