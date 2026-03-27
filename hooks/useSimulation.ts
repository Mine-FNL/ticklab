/**
 * useSimulation Hook
 * 
 * Runs and manages simulations.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { SimulationResult, SimulationRequest, ScenarioPoint } from '@/types';
import { runDeterministicScenario } from '@/lib/simulation/deterministic';
import { estimateFees } from '@/lib/univ3/fees';
import { calculateIL } from '@/lib/univ3/il';
import { calculatePositionEntry } from '@/lib/univ3/position';
import { tickToPrice, getRangeStatus } from '@/lib/univ3/math';

/**
 * Run a simulation
 * @param params - Simulation parameters
 * @returns Simulation result
 */
async function runSimulation(
  params: SimulationRequest & { currentPrice: number; token0Decimals: number; token1Decimals: number }
): Promise<SimulationResult> {
  const {
    poolAddress,
    depositAmount,
    depositToken,
    lowerTick,
    upperTick,
    horizonDays,
    dailyVolumeUSD,
    feeTier,
    currentLiquidity,
    currentPrice,
    token0Decimals,
    token1Decimals,
  } = params;

  // Convert ticks to prices
  const lowerPrice = tickToPrice(lowerTick);
  const upperPrice = tickToPrice(upperTick);

  // Calculate entry amounts
  const entryResult = calculatePositionEntry({
    depositAmount: parseFloat(depositAmount),
    depositToken,
    currentPrice,
    lowerPrice,
    upperPrice,
    token0Decimals,
    token1Decimals,
  });

  // Run deterministic scenario
  const scenarioGrid = runDeterministicScenario({
    entryPrice: currentPrice,
    token0Decimals,
    token1Decimals,
    lowerPrice,
    upperPrice,
    depositAmount: parseFloat(depositAmount),
    depositToken,
    dailyVolumeUSD,
    feeTier,
    liquidityShare: Number(entryResult.liquidity) / Number(currentLiquidity),
    horizonDays,
    gasCostGwei: params.gasCostGwei,
    rebalanceCount: 0,
  }, {
    min: currentPrice * 0.1,
    max: currentPrice * 4,
    steps: 50,
  });

  // Estimate fees
  const feeEstimates = estimateFees({
    currentLiquidity,
    activeLiquidityInRange: currentLiquidity,
    feeTier,
    dailyVolumeUSD,
    volumeScenario: params.volumeScenario || 'base',
    customVolumeMultiplier: params.customVolumeMultiplier,
    positionLiquidity: entryResult.liquidity,
    timeInRange: getTimeInRange(scenarioGrid),
    horizonDays,
  });

  // Calculate summary metrics
  const avgIL = calculateAverageIL(scenarioGrid);
  const avgNetReturn = scenarioGrid.reduce((sum, s) => sum + s.excessReturnVsHODL, 0) / scenarioGrid.length;

  return {
    scenarioGrid,
    feeEstimates,
    summary: {
      estimatedFeesMin: feeEstimates.min,
      estimatedFeesMax: feeEstimates.max,
      estimatedIL: avgIL,
      netReturnVsHODL: avgNetReturn,
      timeInRange: getTimeInRange(scenarioGrid),
    },
  };
}

/**
 * Calculate average IL from scenario grid
 */
function calculateAverageIL(scenarioGrid: ScenarioPoint[]): number {
  const ilValues = scenarioGrid.map((s) => s.divergenceLoss);
  return ilValues.reduce((sum, il) => sum + il, 0) / ilValues.length;
}

/**
 * Calculate time in range from scenario grid
 */
function getTimeInRange(scenarioGrid: ScenarioPoint[]): number {
  const inRangeCount = scenarioGrid.filter((s) => s.inRange).length;
  return inRangeCount / scenarioGrid.length;
}

/**
 * Hook to run a simulation
 * @returns Mutation result
 */
export function useSimulation() {
  return useMutation({
    mutationFn: runSimulation,
  });
}

/**
 * Hook to fetch a cached simulation result
 * @param simulationId - Simulation ID
 * @returns Query result
 */
export function useSimulationResult(simulationId: string | null) {
  return useQuery({
    queryKey: ['simulation', simulationId],
    queryFn: async () => {
      // Fetch from API or database
      const response = await fetch(`/api/simulations/${simulationId}`);
      if (!response.ok) throw new Error('Failed to fetch simulation');
      return response.json() as Promise<SimulationResult>;
    },
    enabled: !!simulationId,
    staleTime: Infinity,
  });
}

// Simulation request type
interface SimulationRequest {
  poolAddress: string;
  depositAmount: string;
  depositToken: 'token0' | 'token1' | 'usd';
  lowerTick: number;
  upperTick: number;
  horizonDays: number;
  dailyVolumeUSD: number;
  feeTier: number;
  currentLiquidity: bigint;
  gasCostGwei: number;
  volumeScenario?: 'low' | 'base' | 'high' | 'custom';
  customVolumeMultiplier?: number;
}
