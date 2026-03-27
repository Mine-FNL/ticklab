/**
 * Subgraph Data Fetching
 * 
 * This module handles data fetching from TheGraph subgraphs.
 */

import { GraphQLClient, gql } from 'graphql-request';
import { Token, Pool, PoolSnapshot } from '@/types';
import { SUBGRAPH_URLS } from '@/lib/constants';

/**
 * Get subgraph client for a chain
 * @param chainId - Chain ID
 * @returns GraphQL client
 */
export function getSubgraphClient(chainId: number): GraphQLClient {
  const url = SUBGRAPH_URLS[chainId];
  if (!url) {
    throw new Error(`No subgraph URL for chain ${chainId}`);
  }
  return new GraphQLClient(url);
}

// GraphQL queries
const POOLS_BY_TOKEN_QUERY = gql`
  query PoolsByToken($token: String!) {
    pools(
      where: {
        or: [
          { token0: $token }
          { token1: $token }
        ]
      }
      orderBy: totalValueLockedUSD
      orderDirection: desc
      first: 100
    ) {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      tick
      sqrtPriceX96
      liquidity
      totalValueLockedUSD
      volumeUSD
      feesUSD
      txCount
    }
  }
`;

const POOL_QUERY = gql`
  query Pool($id: ID!) {
    pool(id: $id) {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      tick
      sqrtPriceX96
      liquidity
      totalValueLockedUSD
      volumeUSD
      feesUSD
      txCount
      createdAtTimestamp
    }
  }
`;

const POOL_DAY_DATA_QUERY = gql`
  query PoolDayData($pool: String!, $startTime: Int!, $endTime: Int!) {
    poolDayDatas(
      where: {
        pool: $pool
        date_gte: $startTime
        date_lte: $endTime
      }
      orderBy: date
      orderDirection: asc
    ) {
      date
      tick
      sqrtPriceX96
      liquidity
      volumeUSD
      feesUSD
      tvlUSD
      token0Price
      token1Price
    }
  }
`;

const TOP_POOLS_QUERY = gql`
  query TopPools($first: Int!) {
    pools(
      orderBy: totalValueLockedUSD
      orderDirection: desc
      first: $first
    ) {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      tick
      sqrtPriceX96
      liquidity
      totalValueLockedUSD
      volumeUSD
      feesUSD
    }
  }
`;

const TOKEN_QUERY = gql`
  query Token($id: ID!) {
    token(id: $id) {
      id
      symbol
      name
      decimals
      volumeUSD
      txCount
    }
  }
`;

/**
 * Query pools by token address
 * @param chainId - Chain ID
 * @param tokenAddress - Token address
 * @returns Array of pools
 */
export async function queryPoolsByToken(
  chainId: number,
  tokenAddress: string
): Promise<Pool[]> {
  const client = getSubgraphClient(chainId);

  try {
    const data = await client.request<{ pools: any[] }>(
      POOLS_BY_TOKEN_QUERY,
      { token: tokenAddress.toLowerCase() }
    );

    return data.pools.map((pool) => ({
      chainId,
      address: pool.id,
      token0: {
        chainId,
        address: pool.token0.id,
        symbol: pool.token0.symbol,
        name: pool.token0.name,
        decimals: parseInt(pool.token0.decimals),
        verified: true,
      },
      token1: {
        chainId,
        address: pool.token1.id,
        symbol: pool.token1.symbol,
        name: pool.token1.name,
        decimals: parseInt(pool.token1.decimals),
        verified: true,
      },
      feeTier: parseInt(pool.feeTier),
      tickSpacing: parseInt(pool.feeTier) === 100 ? 1 :
        parseInt(pool.feeTier) === 500 ? 10 :
        parseInt(pool.feeTier) === 3000 ? 60 : 200,
      currentTick: parseInt(pool.tick),
      currentSqrtPriceX96: pool.sqrtPriceX96,
      currentLiquidity: pool.liquidity,
    }));
  } catch (error) {
    console.error('Failed to query pools by token:', error);
    return [];
  }
}

/**
 * Query pool details
 * @param chainId - Chain ID
 * @param poolAddress - Pool address
 * @returns Pool details
 */
export async function queryPool(
  chainId: number,
  poolAddress: string
): Promise<Pool | null> {
  const client = getSubgraphClient(chainId);

  try {
    const data = await client.request<{ pool: any }>(
      POOL_QUERY,
      { id: poolAddress.toLowerCase() }
    );

    if (!data.pool) return null;

    return {
      chainId,
      address: data.pool.id,
      token0: {
        chainId,
        address: data.pool.token0.id,
        symbol: data.pool.token0.symbol,
        name: data.pool.token0.name,
        decimals: parseInt(data.pool.token0.decimals),
        verified: true,
      },
      token1: {
        chainId,
        address: data.pool.token1.id,
        symbol: data.pool.token1.symbol,
        name: data.pool.token1.name,
        decimals: parseInt(data.pool.token1.decimals),
        verified: true,
      },
      feeTier: parseInt(data.pool.feeTier),
      tickSpacing: parseInt(data.pool.feeTier) === 100 ? 1 :
        parseInt(data.pool.feeTier) === 500 ? 10 :
        parseInt(data.pool.feeTier) === 3000 ? 60 : 200,
      currentTick: parseInt(data.pool.tick),
      currentSqrtPriceX96: data.pool.sqrtPriceX96,
      currentLiquidity: data.pool.liquidity,
    };
  } catch (error) {
    console.error('Failed to query pool:', error);
    return null;
  }
}

/**
 * Query pool historical day data
 * @param chainId - Chain ID
 * @param poolAddress - Pool address
 * @param startTime - Start timestamp
 * @param endTime - End timestamp
 * @returns Array of daily snapshots
 */
export async function queryPoolDayData(
  chainId: number,
  poolAddress: string,
  startTime: number,
  endTime: number
): Promise<PoolSnapshot[]> {
  const client = getSubgraphClient(chainId);

  try {
    const data = await client.request<{ poolDayDatas: any[] }>(
      POOL_DAY_DATA_QUERY,
      {
        pool: poolAddress.toLowerCase(),
        startTime,
        endTime,
      }
    );

    return data.poolDayDatas.map((day) => ({
      timestamp: day.date * 1000,
      blockNumber: 0, // Not provided by subgraph
      tick: parseInt(day.tick),
      sqrtPriceX96: day.sqrtPriceX96,
      liquidity: day.liquidity,
      token0Price: parseFloat(day.token0Price),
      token1Price: parseFloat(day.token1Price),
      volumeUSD24h: parseFloat(day.volumeUSD),
      feesUSD24h: parseFloat(day.feesUSD),
      tvlUSD: parseFloat(day.tvlUSD),
      dataConfidence: 1.0,
    }));
  } catch (error) {
    console.error('Failed to query pool day data:', error);
    return [];
  }
}

/**
 * Query top pools by TVL
 * @param chainId - Chain ID
 * @param limit - Number of pools to return
 * @returns Array of pools
 */
export async function queryTopPools(
  chainId: number,
  limit: number = 100
): Promise<Pool[]> {
  const client = getSubgraphClient(chainId);

  try {
    const data = await client.request<{ pools: any[] }>(
      TOP_POOLS_QUERY,
      { first: limit }
    );

    return data.pools.map((pool) => ({
      chainId,
      address: pool.id,
      token0: {
        chainId,
        address: pool.token0.id,
        symbol: pool.token0.symbol,
        name: pool.token0.name,
        decimals: parseInt(pool.token0.decimals),
        verified: true,
      },
      token1: {
        chainId,
        address: pool.token1.id,
        symbol: pool.token1.symbol,
        name: pool.token1.name,
        decimals: parseInt(pool.token1.decimals),
        verified: true,
      },
      feeTier: parseInt(pool.feeTier),
      tickSpacing: parseInt(pool.feeTier) === 100 ? 1 :
        parseInt(pool.feeTier) === 500 ? 10 :
        parseInt(pool.feeTier) === 3000 ? 60 : 200,
      currentTick: parseInt(pool.tick),
      currentSqrtPriceX96: pool.sqrtPriceX96,
      currentLiquidity: pool.liquidity,
    }));
  } catch (error) {
    console.error('Failed to query top pools:', error);
    return [];
  }
}

/**
 * Query token details
 * @param chainId - Chain ID
 * @param tokenAddress - Token address
 * @returns Token details
 */
export async function queryToken(
  chainId: number,
  tokenAddress: string
): Promise<Token | null> {
  const client = getSubgraphClient(chainId);

  try {
    const data = await client.request<{ token: any }>(
      TOKEN_QUERY,
      { id: tokenAddress.toLowerCase() }
    );

    if (!data.token) return null;

    return {
      chainId,
      address: data.token.id,
      symbol: data.token.symbol,
      name: data.token.name,
      decimals: parseInt(data.token.decimals),
      verified: true,
    };
  } catch (error) {
    console.error('Failed to query token:', error);
    return null;
  }
}

/**
 * Calculate pool metrics from historical data
 * @param snapshots - Array of pool snapshots
 * @returns Calculated metrics
 */
export function calculatePoolMetrics(snapshots: PoolSnapshot[]) {
  if (snapshots.length === 0) {
    return {
      avgVolume: 0,
      avgFees: 0,
      avgLiquidity: 0,
      priceVolatility: 0,
    };
  }

  const volumes = snapshots.map((s) => s.volumeUSD24h || 0);
  const fees = snapshots.map((s) => s.feesUSD24h || 0);
  const liquidities = snapshots.map((s) => s.tvlUSD || 0);
  const prices = snapshots.map((s) => s.token0Price);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  // Calculate volatility
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  const volatility = Math.sqrt(avg(returns.map((r) => r * r))) * Math.sqrt(365);

  return {
    avgVolume: avg(volumes),
    avgFees: avg(fees),
    avgLiquidity: avg(liquidities),
    priceVolatility: volatility,
  };
}
