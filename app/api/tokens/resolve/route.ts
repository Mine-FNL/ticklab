import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchTokenMetadata, isValidERC20 } from '@/lib/data/rpc';
import { getPoolsByToken } from '@/lib/data/pools';
import { DataWarning } from '@/types';

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

    // Validate it's an ERC20 token
    const isValid = await isValidERC20(params.chainId, params.address);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid token address or not an ERC20 token' },
        { status: 400 }
      );
    }

    // Fetch token metadata from RPC
    const token = await fetchTokenMetadata(params.chainId, params.address);

    // Fetch pools for this token
    const pools = await getPoolsByToken(params.chainId, params.address);

    // Generate warnings
    const warnings: DataWarning[] = [];

    if (pools.length === 0) {
      warnings.push({
        type: 'sparse_data',
        severity: 'warning',
        message: 'No Uniswap V3 pools found for this token in our database.',
        recommendation: 'This token may not have sufficient liquidity on Uniswap V3.',
      });
    }

    const lowLiquidityPools = pools.filter(
      (p) => !p.currentLiquidity || BigInt(p.currentLiquidity) < BigInt('1000000000000000000')
    );
    
    if (lowLiquidityPools.length > 0) {
      warnings.push({
        type: 'low_liquidity',
        severity: 'info',
        message: `${lowLiquidityPools.length} pool(s) have low liquidity.`,
        recommendation: 'Consider pools with higher liquidity for better execution.',
      });
    }

    return NextResponse.json({
      token,
      pools,
      warnings,
    });
  } catch (error) {
    console.error('Token resolution error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to resolve token', 
        message: (error as Error).message,
        suggestion: 'Try again or check if the token exists on this chain.'
      },
      { status: 500 }
    );
  }
}
