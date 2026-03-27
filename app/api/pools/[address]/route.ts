import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPoolByAddress, getPoolMetricsData } from '@/lib/data/pools';
import { fetchPoolState } from '@/lib/data/rpc';
import { DataWarning } from '@/types';

const paramsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const querySchema = z.object({
  chainId: z.number().int().positive().default(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = paramsSchema.parse({ address: params.address });
    
    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse({
      chainId: parseInt(searchParams.get('chainId') || '1'),
    });

    // Fetch pool data
    const [pool, state] = await Promise.all([
      getPoolByAddress(query.chainId, address),
      fetchPoolState(query.chainId, address).catch(() => null),
    ]);

    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found', suggestion: 'Check the pool address or try a different chain.' },
        { status: 404 }
      );
    }

    // Fetch metrics
    const metrics = await getPoolMetricsData(query.chainId, address);

    // Generate warnings
    const warnings: DataWarning[] = [];

    if (!state || state.liquidity === 0n) {
      warnings.push({
        type: 'low_liquidity',
        severity: 'critical',
        message: 'This pool has no active liquidity.',
        recommendation: 'Do not deposit into this pool.',
      });
    }

    if (metrics && metrics.volumeUSD24h < 1000) {
      warnings.push({
        type: 'sparse_data',
        severity: 'warning',
        message: 'This pool has low trading volume.',
        recommendation: 'Fee earnings may be minimal.',
      });
    }

    return NextResponse.json({
      pool: {
        ...pool,
        currentTick: state?.tick ?? pool.currentTick,
        currentSqrtPriceX96: state?.sqrtPriceX96.toString() ?? pool.currentSqrtPriceX96,
        currentLiquidity: state?.liquidity.toString() ?? pool.currentLiquidity,
      },
      currentState: state,
      metrics,
      warnings,
    });
  } catch (error) {
    console.error('Pool details error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch pool details', 
        message: (error as Error).message,
        suggestion: 'Try again or check the pool address.'
      },
      { status: 500 }
    );
  }
}
