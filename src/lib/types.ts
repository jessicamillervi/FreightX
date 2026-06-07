import { type Address } from 'viem';

export interface BlockchainContracts {
  passport: Address;
  escrow: Address;
  usdc: Address;
  eurc: Address;
  usyc: Address;
}

export interface ShipmentHistory {
  timestamp: number;
  status: string;
  location: string;
  temperature: number;
  txHash?: string;
}

export interface ShipmentData {
  id: number;
  buyer: string;
  supplier: string;
  carrier: string;
  cargoValue: number; // in USDC/EURC (6 decimals)
  shippingFee: number; // in USDC/EURC (6 decimals)
  releasedSupplierAmount: number;
  releasedCarrierAmount: number;
  departurePort: string;
  destinationPort: string;
  status: 'Created' | 'In Transit' | 'Arrived' | 'Customs Cleared' | 'Completed' | 'Cancelled';
  arrivedTimestamp: number;
  customClearanceTimestamp: number;
  pickupTimestamp: number;
  freeTimeHours: number;
  demurrageRatePerHour: number; // in USDC/EURC (6 decimals)
  demurragePenaltyPaid: number;
  passportTokenId: number;
  temperature: number; // Current temperature * 100
  location: string;
  history: ShipmentHistory[];
  onChain?: boolean;
  txHash?: string;
  createdTimestamp?: number;
  yieldEarned?: number;
  temperatureViolations?: number;
  temperaturePenalty?: number;
  beneficiary?: string;
  factoringPrice?: number;
  factoringActive?: boolean;
  token?: string; // USDC or EURC address
  poId?: number; // linked PO loan ID (if any)
  hasPOLoan?: boolean;
  iotGateway?: string;
  humidity?: number;
  usycWrapped?: boolean;
  usycShares?: number;
  cctpSourceDomain?: number;
  cctpSourceTxHash?: string;
}

export interface POLoanData {
  id: number;
  supplier: string;
  buyer: string;
  cargoValue: number;
  loanRequested: number;
  repaymentAmount: number;
  investor: string;
  funded: boolean;
  repaid: boolean;
  token: string;
}

export interface WalletInfo {
  privateKey: string;
  address: Address;
}

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface VCData {
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
