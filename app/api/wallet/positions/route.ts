import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchUserPositions } from '@/lib/data/rpc';
import { fetchPoolState } from '@/lib/data/rpc';
import { getAmountsForLiquidity, tickToSqrtPriceX96 } from '@/lib/univ3/math';
import { apiConfig } from '@/lib/api/handler';
import { jsonResponse } from '@/lib/api/json';

export const { dynamic, runtime } = apiConfig();

const requestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive().default(1),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = requestSchema.parse({
      address: searchParams.get('address'),
      chainId: parseInt(searchParams.get('chainId') || '1'),
    });

    // Fetch positions from RPC
    const positions = await fetchUserPositions(params.chainId, params.address);

    // Calculate position values
    const positionsWithValues = await Promise.all(
      positions.map(async (position) => {
        try {
          // Fetch pool state
          const poolState = await fetchPoolState(params.chainId, position.pool!.address);
          
          // Calculate current amounts
          const sqrtPriceX96 = tickToSqrtPriceX96(poolState.tick);
          const sqrtLowerX96 = tickToSqrtPriceX96(position.tickLower);
          const sqrtUpperX96 = tickToSqrtPriceX96(position.tickUpper);

          const { amount0, amount1 } = getAmountsForLiquidity(
            position.liquidity,
            sqrtPriceX96,
            sqrtLowerX96,
            sqrtUpperX96
          );

          const token0Amount = Number(amount0) / 10 ** position.pool!.token0.decimals;
          const token1Amount = Number(amount1) / 10 ** position.pool!.token1.decimals;

          // Check if in range
          const inRange = poolState.tick >= position.tickLower && poolState.tick < position.tickUpper;

          return {
            ...position,
            currentAmounts: {
              token0: token0Amount,
              token1: token1Amount,
            },
            unclaimedFees: {
              token0: Number(position.tokensOwed0) / 10 ** position.pool!.token0.decimals,
              token1: Number(position.tokensOwed1) / 10 ** position.pool!.token1.decimals,
            },
            inRange,
            currentTick: poolState.tick,
          };
        } catch (error) {
          // Return position without values if fetch fails
          return {
            ...position,
            currentAmounts: null,
            unclaimedFees: null,
            inRange: null,
            currentTick: null,
          };
        }
      })
    );

    // Calculate summary
    const positionsInRange = positionsWithValues.filter((p) => p.inRange).length;

    return jsonResponse({
      positions: positionsWithValues,
      summary: {
        totalPositions: positions.length,
        positionsInRange,
        positionsOutOfRange: positions.length - positionsInRange,
      },
    });
  } catch (error) {
    console.error('Wallet positions error:', error);

    if (error instanceof z.ZodError) {
      return jsonResponse(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 },
      );
    }

    return jsonResponse(
      {
        error: 'Failed to fetch positions',
        message: (error as Error).message,
        suggestion: 'Make sure your wallet is connected to the correct chain.',
      },
      { status: 500 },
    );
  }
}
