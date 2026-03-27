/**
 * Token Resolution - ANY ERC20 Token Support
 * 
 * This module allows users to input ANY valid ERC20 token address
 * and resolves its metadata (name, symbol, decimals) via on-chain RPC calls.
 * NO predefined token list - works with any token.
 */

import { createPublicClient, http, Address, isAddress } from 'viem';
import { mainnet, arbitrum, base, optimism, polygon } from 'wagmi/chains';
import { ERC20_ABI, PUBLIC_RPC_URLS, COINGECKO_API, CACHE_TTL } from '@/lib/constants';

// Chain configuration mapping
const chainConfigs: Record<number, typeof mainnet> = {
  1: mainnet,
  42161: arbitrum,
  8453: base,
  10: optimism,
  137: polygon,
};

export interface ResolvedToken {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl?: string;
  priceUSD?: number;
  verified: boolean;
}

// Cache for resolved tokens
const tokenCache = new Map<string, { data: ResolvedToken; timestamp: number }>();

/**
 * Get public client for a chain
 */
function getPublicClient(chainId: number) {
  const chain = chainConfigs[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const rpcUrl = PUBLIC_RPC_URLS[chainId]?.[0] || 'https://eth.llamarpc.com';
  
  return createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 10000 }),
  });
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Resolve token metadata from on-chain contract
 * Works with ANY valid ERC20 token
 * 
 * @param chainId - Chain ID
 * @param tokenAddress - Token contract address
 * @returns Resolved token metadata
 * @throws Error if address invalid or contract doesn't implement ERC20
 */
export async function resolveToken(
  chainId: number,
  tokenAddress: string
): Promise<ResolvedToken> {
  // Validate address format
  if (!isValidAddress(tokenAddress)) {
    throw new Error(`Invalid Ethereum address: ${tokenAddress}`);
  }

  const normalizedAddress = tokenAddress.toLowerCase();
  const cacheKey = `${chainId}:${normalizedAddress}`;
  
  // Check cache
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL.TOKEN_METADATA) {
    return cached.data;
  }

  const client = getPublicClient(chainId);

  try {
    // Fetch token metadata from contract
    const [nameResult, symbolResult, decimalsResult] = await Promise.all([
      client.readContract({
        address: normalizedAddress as Address,
        abi: ERC20_ABI,
        functionName: 'name',
      }).catch(() => null),
      client.readContract({
        address: normalizedAddress as Address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }).catch(() => null),
      client.readContract({
        address: normalizedAddress as Address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }).catch(() => null),
    ]);

    // Check if token implements ERC20
    if (symbolResult === null && decimalsResult === null) {
      throw new Error(`Address ${tokenAddress} is not a valid ERC20 token`);
    }

    const token: ResolvedToken = {
      address: normalizedAddress,
      chainId,
      name: (nameResult as string) || 'Unknown Token',
      symbol: (symbolResult as string) || '???',
      decimals: (decimalsResult as number) ?? 18,
      verified: true,
    };

    // Try to fetch price from CoinGecko
    try {
      const price = await fetchTokenPriceFromCoinGecko(chainId, normalizedAddress);
      token.priceUSD = price;
    } catch {
      // Price fetch failed, token still valid
    }

    // Cache the result
    tokenCache.set(cacheKey, { data: token, timestamp: Date.now() });

    return token;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to resolve token ${tokenAddress}: ${error}`);
  }
}

/**
 * Try to fetch token price from CoinGecko
 * Uses platform-specific token lists
 * 
 * @param chainId - Chain ID
 * @param tokenAddress - Token address
 * @returns Price in USD or undefined
 */
async function fetchTokenPriceFromCoinGecko(
  chainId: number,
  tokenAddress: string
): Promise<number | undefined> {
  const platformId = COINGECKO_API.PLATFORM_IDS[chainId];
  if (!platformId) return undefined;

  try {
    const url = `${COINGECKO_API.BASE_URL}/simple/token_price/${platformId}?contract_addresses=${tokenAddress}&vs_currencies=usd`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json();
    return data[tokenAddress.toLowerCase()]?.usd;
  } catch {
    return undefined;
  }
}

/**
 * Calculate token price from Uniswap V3 pool
 * Fallback when CoinGecko doesn't have the token
 * 
 * @param chainId - Chain ID
 * @param tokenAddress - Token address to price
 * @param quoteTokenAddress - Quote token address (USDC, WETH, etc.)
 * @returns Price in terms of quote token
 */
export async function calculateTokenPriceFromPool(
  chainId: number,
  tokenAddress: string,
  quoteTokenAddress: string
): Promise<number | undefined> {
  const { getPoolFromFactory, fetchPoolState } = await import('./rpc');
  
  // Try different fee tiers
  const feeTiers = [3000, 500, 10000, 100];
  
  for (const fee of feeTiers) {
    try {
      const poolAddress = await getPoolFromFactory(chainId, tokenAddress, quoteTokenAddress, fee);
      if (!poolAddress) continue;

      const state = await fetchPoolState(chainId, poolAddress);
      
      // Calculate price from sqrtPriceX96
      // price = (sqrtPriceX96 / 2^96)^2
      const sqrtPrice = Number(state.sqrtPriceX96) / 2 ** 96;
      const price = sqrtPrice * sqrtPrice;
      
      return price;
    } catch {
      continue;
    }
  }
  
  return undefined;
}

/**
 * Batch resolve multiple tokens
 * Useful for resolving both tokens in a pool at once
 * 
 * @param chainId - Chain ID
 * @param addresses - Array of token addresses
 * @returns Array of resolved tokens
 */
export async function resolveTokens(
  chainId: number,
  addresses: string[]
): Promise<ResolvedToken[]> {
  return Promise.all(
    addresses.map(addr => resolveToken(chainId, addr))
  );
}

/**
 * Get token logo URL
 * Tries multiple sources: CoinGecko, Trust Wallet, etc.
 * 
 * @param chainId - Chain ID
 * @param tokenAddress - Token address
 * @returns Logo URL or undefined
 */
export function getTokenLogoUrl(
  chainId: number,
  tokenAddress: string
): string | undefined {
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // Map chain IDs to Trust Wallet chain names
  const chainNames: Record<number, string> = {
    1: 'ethereum',
    42161: 'arbitrum',
    8453: 'base',
    10: 'optimism',
    137: 'polygon',
  };
  
  const chainName = chainNames[chainId];
  if (!chainName) return undefined;
  
  // Trust Wallet assets
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${normalizedAddress}/logo.png`;
}

/**
 * Clear token cache
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}

/**
 * Check if a token is likely a valid ERC20
 * Quick check without full resolution
 * 
 * @param address - Token address
 * @returns True if valid address format
 */
export function isLikelyToken(address: string): boolean {
  return isValidAddress(address);
}
