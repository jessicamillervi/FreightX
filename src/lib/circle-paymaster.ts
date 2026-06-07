import { type Address } from 'viem';

export const CIRCLE_PAYMASTER_ADDRESS: Address = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';

export interface PaymasterConfig {
  address: Address;
  sponsorGas: boolean;
  surchargePercent: number;
}

/**
 * Returns the default configuration for the Circle Paymaster on Arc Testnet.
 */
export const getPaymasterConfig = (): PaymasterConfig => {
  return {
    address: CIRCLE_PAYMASTER_ADDRESS,
    sponsorGas: true,
    surchargePercent: 10,
  };
};

/**
 * Encodes standard Paymaster user operation parameter overrides.
 */
export function buildPaymasterUserOpParams() {
  return {
    paymaster: CIRCLE_PAYMASTER_ADDRESS,
    paymasterData: '0x' as `0x${string}`,
  };
}
