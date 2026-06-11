'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http } from 'wagmi';
import {
  getDefaultConfig,
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { type Chain } from 'viem';
import { sepolia, arbitrumSepolia } from 'viem/chains';


import '@rainbow-me/rainbowkit/styles.css';

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
} as const satisfies Chain;

const config = getDefaultConfig({
  appName: 'FreightX Logistics',
  projectId: 'b55e8880628e4e9cfde8b14e9f7833a67', // Public development ID
  chains: [arcTestnet, sepolia, arbitrumSepolia],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient must be created inside the component via useState to avoid
  // the "Cannot update a component while rendering a different component"
  // error in React 19. useState guarantees stable identity across re-renders
  // without triggering state updates during render.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Prevent aggressive refetching that can cause hydration mismatches
        refetchOnWindowFocus: false,
        retry: 2,
      },
    },
  }));

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme({
          accentColor: '#111111',
          accentColorForeground: 'white',
          borderRadius: 'medium',
          overlayBlur: 'small',
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
