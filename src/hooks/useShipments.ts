import { useAppContext } from '@/contexts/AppContext';

export function useShipments() {
  const {
    shipments,
    setShipments,
    selectedShipmentId,
    setSelectedShipmentId,
    loading,
    setLoading,
    refreshShipmentsList,
    appMode
  } = useAppContext();

  return {
    shipments,
    setShipments,
    selectedShipmentId,
    setSelectedShipmentId,
    loading,
    setLoading,
    refreshShipmentsList,
    appMode
  };
}
