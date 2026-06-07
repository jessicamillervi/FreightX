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
    browserWalletClient
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
    browserWalletClient
  };
}
