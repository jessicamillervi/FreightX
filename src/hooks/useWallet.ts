import { useAppContext } from '@/contexts/AppContext';

export function useWallet() {
  const {
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
    updateBalances,
    isRefreshingBalances,
    contracts,
    deploying,
    deployStatus,
    handleDeployContracts,
    handleResetContracts,
    connectedAddress,
    isConnected,
    browserWalletClient,
    unifiedBalance,
    unifiedBreakdown,
    updateUnifiedBalance
  } = useAppContext();

  return {
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
    updateBalances,
    isRefreshingBalances,
    contracts,
    deploying,
    deployStatus,
    handleDeployContracts,
    handleResetContracts,
    connectedAddress,
    isConnected,
    browserWalletClient,
    unifiedBalance,
    unifiedBreakdown,
    updateUnifiedBalance
  };
}
