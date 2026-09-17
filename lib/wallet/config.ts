/**
 * Wallet Configuration
 * 
 * RainbowKit and wagmi configuration.
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, arbitrum, base, optimism, polygon } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Ticklab',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [mainnet, arbitrum, base, optimism, polygon],
  ssr: true,
});

// Chain configuration helpers
export const SUPPORTED_CHAIN_IDS = [1, 42161, 8453, 10, 137];

export function isSupportedChain(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

export function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'Ethereum',
    42161: 'Arbitrum',
    8453: 'Base',
    10: 'Optimism',
    137: 'Polygon',
  };
  return names[chainId] || 'Unknown';
}

export function getChainCurrency(chainId: number): string {
  const currencies: Record<number, string> = {
    1: 'ETH',
    42161: 'ETH',
    8453: 'ETH',
    10: 'ETH',
    137: 'MATIC',
  };
  return currencies[chainId] || 'ETH';
}
