import { type ShipmentData } from './types';

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const EURC_ADDRESS = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';
export const ARC_RPC_URL = 'https://rpc.testnet.arc.network';
export const LOCAL_STATE_KEY = 'freightx_local_shipments';
export const WALLET_KEY = 'freightx_sandbox_wallet';
export const CONTRACTS_KEY = 'freightx_deployed_contracts';
export const MODE_KEY = 'freightx_mode';

export const DEFAULT_MOCK_SHIPMENTS: ShipmentData[] = [
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
