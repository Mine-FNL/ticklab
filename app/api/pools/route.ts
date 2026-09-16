import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTopPools, getPoolsByToken, searchPools } from '@/lib/data/pools';
import { apiConfig } from '@/lib/api/handler';

export const { dynamic, runtime } = apiConfig();

const requestSchema = z.object({
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  search: z.string().optional(),
  chainId: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = requestSchema.parse({
      token: searchParams.get('token') || undefined,
      search: searchParams.get('search') || undefined,
      chainId: parseInt(searchParams.get('chainId') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    });

    let pools;
    
    if (params.token) {
      // Get pools for specific token
      pools = await getPoolsByToken(params.chainId, params.token);
    } else if (params.search) {
      // Search pools by symbol
      pools = await searchPools(params.chainId, params.search);
    } else {
      // Get top pools
      pools = await getTopPools(params.chainId);
    }

    // Limit results
    pools = pools.slice(0, params.limit);

    return NextResponse.json({
      pools,
      count: pools.length,
      chainId: params.chainId,
      sortOptions: ['tvl', 'volume', 'apr', 'feeTier'],
    });
  } catch (error) {
    console.error('Pool discovery error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch pools', 
        message: (error as Error).message,
        suggestion: 'Try again or select a different chain.'
      },
      { status: 500 }
    );
  }
}
