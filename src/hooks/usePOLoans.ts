import { useAppContext } from '@/contexts/AppContext';

export function usePOLoans() {
  const {
    poLoans,
    setPoLoans,
    poProgress,
    setPoProgress,
    refreshPOLoansList,
    appMode
  } = useAppContext();

  return {
    poLoans,
    setPoLoans,
    poProgress,
    setPoProgress,
    refreshPOLoansList,
    appMode
  };
}
