import { useAppContext } from '@/contexts/AppContext';

export function useTerminal() {
  const {
    terminalLogs,
    logTerminal,
    toasts,
    showToast
  } = useAppContext();

  return {
    terminalLogs,
    logTerminal,
    toasts,
    showToast
  };
}
