import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchPosition } from '@/lib/data/rpc';
import { fetchPoolState } from '@/lib/data/rpc';
import { getAmountsForLiquidity, tickToSqrtPriceX96 } from '@/lib/univ3/math';

const paramsSchema = z.object({
  id: z.string(),
});

const querySchema = z.object({
  chainId: z.number().int().positive().default(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = paramsSchema.parse({ id: params.id });
    
    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse({
      chainId: parseInt(searchParams.get('chainId') || '1'),
    });

    // Fetch position
    const position = await fetchPosition(query.chainId, id);

    // Fetch current pool state
    const poolState = await fetchPoolState(query.chainId, position.pool.address);

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

    const token0Amount = Number(amount0) / 10 ** position.pool.token0.decimals;
    const token1Amount = Number(amount1) / 10 ** position.pool.token1.decimals;

    // Calculate values (would need price data)
    const token0ValueUSD = token0Amount * poolState.token0Price;
    const token1ValueUSD = token1Amount;
    const totalValueUSD = token0ValueUSD + token1ValueUSD;

    // Calculate unclaimed fees
    const unclaimedFees0 = Number(position.tokensOwed0) / 10 ** position.pool.token0.decimals;
    const unclaimedFees1 = Number(position.tokensOwed1) / 10 ** position.pool.token1.decimals;
    const unclaimedFeesUSD = unclaimedFees0 * poolState.token0Price + unclaimedFees1;

    return NextResponse.json({
      position: {
        id: position.id,
        chainId: position.chainId,
        pool: position.pool,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        liquidity: position.liquidity.toString(),
      },
      currentValue: {
        token0Amount,
        token1Amount,
        token0ValueUSD,
        token1ValueUSD,
        totalValueUSD,
      },
      unclaimedFees: {
        token0: unclaimedFees0,
        token1: unclaimedFees1,
        usd: unclaimedFeesUSD,
      },
      poolState: {
        tick: poolState.tick,
        price: poolState.token0Price,
        inRange: poolState.tick >= position.tickLower && poolState.tick < position.tickUpper,
      },
      scenarios: {}, // Would run scenario analysis
    });
  } catch (error) {
    console.error('Position analytics error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch position analytics', message: (error as Error).message },
      { status: 500 }
    );
  }
}
