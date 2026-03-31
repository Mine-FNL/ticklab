import { NextRequest, NextResponse } from 'next/server';
import { backtestRequestSchema } from '@/lib/validation/schemas';
import { runBacktest } from '@/lib/simulation/backtest';
import { getPoolByAddress } from '@/lib/data/pools';
import { tickToPrice } from '@/lib/univ3/math';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = backtestRequestSchema.parse(body);

    // Fetch pool data
    const pool = await getPoolByAddress(params.chainId, params.poolAddress);
    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found', suggestion: 'Check the pool address or try a different chain.' },
        { status: 404 }
      );
    }

    // For backtest, we need historical data
    // Since we don't have historical data from free sources, we'll generate synthetic data
    // based on the pool's current metrics
    
    const startTime = new Date(params.startDate).getTime();
    const endTime = new Date(params.endDate).getTime();
    const days = Math.floor((endTime - startTime) / (24 * 60 * 60 * 1000));
    
    if (days <= 0) {
      return NextResponse.json(
        { error: 'Invalid date range', suggestion: 'End date must be after start date.' },
        { status: 400 }
      );
    }

    // Generate synthetic price history based on pool metrics
    // In a production app, you'd fetch real historical data from a paid source
    const priceHistory = [];
    const basePrice = 1; // Normalized price
    const volatility = 0.02; // 2% daily volatility
    
    let currentPrice = basePrice;
    for (let i = 0; i < days; i++) {
      const timestamp = startTime + i * 24 * 60 * 60 * 1000;
      // Random walk with mean reversion
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = currentPrice * (1 + change);
      
      // Mean reversion
      currentPrice = currentPrice * 0.99 + basePrice * 0.01;
      
      priceHistory.push({
        timestamp,
        price: currentPrice,
        volumeUSD: (pool.volumeUSD24h || 1000000) * (0.8 + Math.random() * 0.4),
      });
    }

    // Calculate lower and upper prices from ticks
    const lowerPrice = tickToPrice(params.lowerTick);
    const upperPrice = tickToPrice(params.upperTick);

    // Run backtest
    const backtestResult = runBacktest({
      priceHistory,
      entryTimestamp: priceHistory[0].timestamp,
      lowerPrice,
      upperPrice,
      depositAmount: parseFloat(params.depositAmount),
      depositToken: params.depositToken,
      rebalanceMode: params.rebalanceMode,
      rebalanceParams: params.rebalanceParams,
      gasCostGwei: params.gasCostGwei,
      gasUnitsPerRebalance: 250000,
      token0Decimals: pool.token0.decimals,
      token1Decimals: pool.token1.decimals,
      feeTier: pool.feeTier,
    });

    return NextResponse.json({
      backtestId: `bt_${Date.now()}`,
      results: backtestResult,
      warnings: [{
        type: 'sparse_data' as const,
        severity: 'info' as const,
        message: 'Backtest uses synthetic price data. For accurate backtesting, use a paid data provider.',
        recommendation: 'Consider using Dune Analytics or TheGraph for real historical data.',
      }],
    });
  } catch (error) {
    console.error('Backtest error:', error);
    
    return NextResponse.json(
      { 
        error: 'Backtest failed', 
        message: (error as Error).message,
        suggestion: 'Check your inputs and try again.'
      },
      { status: 500 }
    );
  }
}
