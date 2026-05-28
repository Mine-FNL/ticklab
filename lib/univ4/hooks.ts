/**
 * Uniswap V4 Hook Registry & Taxonomy
 * 
 * V4 hooks are smart contracts that attach to pools and intercept
 * lifecycle events: before/after swap, before/after add/remove liquidity,
 * before initialize, etc.
 * 
 * This registry catalogs known hooks with their LP-relevant behaviors:
 * - Fee adjustments (dynamic fees, fee sharing, rebates)
 * - Liquidity mechanics (lockups, staking, rewards)
 * - Flow control (MEV capture, batch auctions, order flow)
 * - Risk management (stop-loss, hedging, insurance)
 */

export type HookCategory = 
  | 'fee'           // Fee-related hooks
  | 'liquidity'     // Liquidity mechanics
  | 'flow'          // Order flow / MEV
  | 'yield'         // Yield enhancement / staking
  | 'risk'          // Risk management
  | 'access'        // Access control / KYC
  | 'custom';       // Custom / experimental

export type HookLifecycle =
  | 'beforeInitialize'
  | 'afterInitialize'
  | 'beforeAddLiquidity'
  | 'afterAddLiquidity'
  | 'beforeRemoveLiquidity'
  | 'afterRemoveLiquidity'
  | 'beforeSwap'
  | 'afterSwap'
  | 'beforeDonate'
  | 'afterDonate'
  | 'beforeSwapReturnDelta'
  | 'afterSwapReturnDelta'
  | 'afterAddLiquidityReturnDelta'
  | 'afterRemoveLiquidityReturnDelta';

export interface HookBehavior {
  // Fee model
  feeAdjustment: 'none' | 'dynamic' | 'override' | 'share' | 'rebate';
  baseFeeBips?: number;           // If override, the new fee
  additionalFeeBips?: number;     // If dynamic, extra fee added
  hookShareBips?: number;         // If share, % of fees taken by hook (out of 10000)
  
  // Gas overhead per swap (in gwei equivalent, approximated)
  gasOverheadPerSwap: number;
  
  // Flow effects
  flowMultiplier: number;         // >1 means captures MORE flow than standard
  
  // Liquidity constraints
  minPositionValueUSD?: number;
  lockupPeriodDays?: number;
  requiresStaking?: boolean;
  stakingToken?: string;
  
  // Return delta behavior
  takesFromInput?: boolean;       // Hook takes a portion of swap input
  givesToOutput?: boolean;        // Hook gives extra to swap output
  
  // Risk profile
  auditStatus: 'audited' | 'partial' | 'unaudited' | 'experimental';
  tvlInHookUSD?: number;
  
  // Description for UI
  description: string;
  lpImpact: string;               // Plain language impact on LP
}

export interface RegisteredHook {
  address: string;
  name: string;
  category: HookCategory;
  chains: number[];
  behaviors: HookBehavior;
  creator?: string;
  githubUrl?: string;
  docsUrl?: string;
}

// ============================================================================
// Known Hook Registry
// ============================================================================

export const HOOK_REGISTRY: Record<string, RegisteredHook> = {
  // ==========================================================================
  // FEE CATEGORY
  // ==========================================================================
  
  'dynamic_fee_volatility': {
    address: '0x0000000000000000000000000000000000000000', // Generic / example
    name: 'Dynamic Volatility Fee',
    category: 'fee',
    chains: [1, 8453, 42161],
    behaviors: {
      feeAdjustment: 'dynamic',
      additionalFeeBips: 500, // Can add up to 0.05% extra
      gasOverheadPerSwap: 8000,
      flowMultiplier: 1.0,
      description: 'Increases swap fees during high volatility periods. Protects LPs from impermanent loss risk.',
      lpImpact: 'Higher fees during volatile periods = better LP protection, but slightly lower volume.',
      auditStatus: 'audited',
    },
  },

  'fee_rebate_stakers': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Staker Fee Rebate',
    category: 'fee',
    chains: [1, 8453],
    behaviors: {
      feeAdjustment: 'rebate',
      hookShareBips: 1000, // 10% of fees go to rebate pool
      gasOverheadPerSwap: 5000,
      flowMultiplier: 1.02, // Slight flow increase from rebate attractiveness
      requiresStaking: true,
      description: 'A portion of swap fees are distributed as rebates to staked LPs.',
      lpImpact: 'Lower raw APR, but staking rewards can exceed standard fees. Best for long-term holders.',
      auditStatus: 'audited',
    },
  },

  'tiered_fee': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Tiered Trading Fee',
    category: 'fee',
    chains: [1, 42161, 8453],
    behaviors: {
      feeAdjustment: 'override',
      baseFeeBips: 5000, // 0.5% default, can be adjusted
      gasOverheadPerSwap: 3000,
      flowMultiplier: 0.95, // Slightly lower flow due to higher fees
      description: 'Replaces static fee with a tiered model based on trade size.',
      lpImpact: 'Whales pay more, retail pays less. LP fee income depends on trade size distribution.',
      auditStatus: 'partial',
    },
  },

  // ==========================================================================
  // LIQUIDITY CATEGORY
  // ==========================================================================

  'liquidity_lock': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Liquidity Lock',
    category: 'liquidity',
    chains: [1, 8453, 42161, 137],
    behaviors: {
      feeAdjustment: 'none',
      gasOverheadPerSwap: 2000,
      flowMultiplier: 1.0,
      lockupPeriodDays: 30,
      description: 'Requires LP positions to be locked for a minimum period. Reduces mercenary liquidity.',
      lpImpact: 'Commitment required, but less dilution from rotating capital = more stable fee share.',
      auditStatus: 'audited',
    },
  },

  'concentrated_rewards': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Concentrated Rewards',
    category: 'liquidity',
    chains: [1, 8453],
    behaviors: {
      feeAdjustment: 'share',
      hookShareBips: 500, // 5% to reward program
      gasOverheadPerSwap: 4000,
      flowMultiplier: 1.05,
      requiresStaking: true,
      description: 'Rewards are distributed based on how concentrated your liquidity is relative to price.',
      lpImpact: 'Tighter ranges earn disproportionately more rewards. Incentivizes active management.',
      auditStatus: 'audited',
    },
  },

  // ==========================================================================
  // FLOW CATEGORY
  // ==========================================================================

  'mev_capture': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'MEV Capture Hook',
    category: 'flow',
    chains: [1, 42161],
    behaviors: {
      feeAdjustment: 'dynamic',
      additionalFeeBips: 200, // Small dynamic fee
      gasOverheadPerSwap: 15000,
      flowMultiplier: 1.15, // Captures MEV backflow
      description: 'Captures MEV that would otherwise go to searchers and redistributes to LPs.',
      lpImpact: 'Significantly higher effective fees from MEV capture. Best on high-MEV pairs like ETH/USDC.',
      auditStatus: 'partial',
    },
  },

  'batch_auction': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Batch Auction Swap',
    category: 'flow',
    chains: [1, 8453],
    behaviors: {
      feeAdjustment: 'override',
      baseFeeBips: 1000, // 0.1% batch fee
      gasOverheadPerSwap: 25000,
      flowMultiplier: 0.9, // Some flow goes to direct swaps instead
      description: 'Batches swaps and runs periodic auctions. Reduces slippage, changes flow timing.',
      lpImpact: 'Fees are lumpy (batch settlements) rather than smooth. Lower frequency, larger size.',
      auditStatus: 'experimental',
    },
  },

  'order_flow_auction': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Order Flow Auction (OFA)',
    category: 'flow',
    chains: [1, 42161, 8453],
    behaviors: {
      feeAdjustment: 'share',
      hookShareBips: 300, // 3% to OFA participants
      gasOverheadPerSwap: 12000,
      flowMultiplier: 1.1,
      description: 'Auctions order flow to market makers. LPs get a cut of the auction revenue.',
      lpImpact: 'Additional revenue stream beyond swap fees. Revenue scales with flow quality, not just volume.',
      auditStatus: 'experimental',
    },
  },

  // ==========================================================================
  // YIELD CATEGORY
  // ==========================================================================

  'auto_compound': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Auto-Compound Fees',
    category: 'yield',
    chains: [1, 8453, 42161, 10, 137],
    behaviors: {
      feeAdjustment: 'none',
      gasOverheadPerSwap: 5000,
      flowMultiplier: 1.0,
      description: 'Automatically collects and reinvests fees into the position.',
      lpImpact: 'Eliminates manual compounding gas costs. Effective APY is higher due to continuous reinvestment.',
      auditStatus: 'audited',
    },
  },

  'double_dip_yield': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Double-Dip Yield',
    category: 'yield',
    chains: [8453, 42161],
    behaviors: {
      feeAdjustment: 'share',
      hookShareBips: 200,
      gasOverheadPerSwap: 8000,
      flowMultiplier: 1.03,
      requiresStaking: true,
      description: 'LP tokens are automatically staked in a yield farm while earning swap fees.',
      lpImpact: 'Two revenue streams: swap fees + farming rewards. Hook takes a small cut for automation.',
      auditStatus: 'partial',
    },
  },

  // ==========================================================================
  // RISK CATEGORY
  // ==========================================================================

  'stop_loss': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Stop-Loss Liquidity',
    category: 'risk',
    chains: [1, 42161],
    behaviors: {
      feeAdjustment: 'none',
      gasOverheadPerSwap: 10000,
      flowMultiplier: 0.98, // Slight flow reduction from protective behavior
      description: 'Automatically removes liquidity when price hits predefined stop levels.',
      lpImpact: 'Limits IL exposure but may exit during temporary dips. Gas cost for removal events.',
      auditStatus: 'experimental',
    },
  },

  'il_insurance': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'IL Insurance Pool',
    category: 'risk',
    chains: [1, 8453],
    behaviors: {
      feeAdjustment: 'share',
      hookShareBips: 1500, // 15% to insurance fund
      gasOverheadPerSwap: 6000,
      flowMultiplier: 1.02,
      description: 'A portion of fees fund an insurance pool that compensates LPs for impermanent loss.',
      lpImpact: 'Lower raw fees, but IL protection can make net returns higher for volatile pairs.',
      auditStatus: 'unaudited',
    },
  },

  // ==========================================================================
  // ACCESS CATEGORY
  // ==========================================================================

  'kyc_gated': {
    address: '0x0000000000000000000000000000000000000000',
    name: 'KYC-Gated Pool',
    category: 'access',
    chains: [1],
    behaviors: {
      feeAdjustment: 'override',
      baseFeeBips: 500, // Lower fees for compliance costs
      gasOverheadPerSwap: 10000,
      flowMultiplier: 0.7, // Significantly restricted flow
      description: 'Only KYC-verified addresses can swap or provide liquidity.',
      lpImpact: 'Much lower volume and flow. Only viable for institutional-targeted pools.',
      auditStatus: 'audited',
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getHooksByCategory(category: HookCategory): RegisteredHook[] {
  return Object.values(HOOK_REGISTRY).filter(h => h.category === category);
}

export function getHooksForChain(chainId: number): RegisteredHook[] {
  return Object.values(HOOK_REGISTRY).filter(h => h.chains.includes(chainId));
}

export function getHookByAddress(address: string): RegisteredHook | undefined {
  return Object.values(HOOK_REGISTRY).find(
    h => h.address.toLowerCase() === address.toLowerCase()
  );
}

export function getHookByName(name: string): RegisteredHook | undefined {
  return Object.values(HOOK_REGISTRY).find(
    h => h.name.toLowerCase() === name.toLowerCase()
  );
}

export function getAllHookCategories(): HookCategory[] {
  return ['fee', 'liquidity', 'flow', 'yield', 'risk', 'access', 'custom'];
}

/**
 * Calculate the net LP APR for a given hook configuration.
 * This is the main decision-making function for hook selection.
 */
export function calculateHookLPScore(params: {
  baseAPR: number;            // APR without hooks
  hookId: string;
  pairVolatility: number;     // Annualized volatility
  estimatedDailySwaps: number;
  positionLockupDays?: number;
  isStaking?: boolean;
}): {
  netAPR: number;
  riskScore: number;          // 0-100, lower is safer
  complexityScore: number;    // 0-100, lower is simpler
  recommendation: string;
} {
  const hook = HOOK_REGISTRY[params.hookId];
  if (!hook) {
    return {
      netAPR: params.baseAPR,
      riskScore: 50,
      complexityScore: 50,
      recommendation: 'Unknown hook - use with caution',
    };
  }

  const b = hook.behaviors;
  let netAPR = params.baseAPR;

  // Apply fee adjustments
  if (b.feeAdjustment === 'dynamic' && b.additionalFeeBips) {
    // Dynamic fees add more in volatile conditions
    const volMultiplier = 1 + params.pairVolatility * 0.5;
    netAPR *= (1 + (b.additionalFeeBips / 1_000_000) * volMultiplier * 10);
  } else if (b.feeAdjustment === 'share' && b.hookShareBips) {
    netAPR *= (1 - b.hookShareBips / 10_000);
  } else if (b.feeAdjustment === 'override' && b.baseFeeBips) {
    netAPR = netAPR * (b.baseFeeBips / 3000); // Scale relative to standard 0.3%
  }

  // Flow multiplier effect
  netAPR *= b.flowMultiplier;

  // Staking bonus
  if (b.requiresStaking && params.isStaking) {
    netAPR *= 1.15; // 15% boost for staking
  } else if (b.requiresStaking && !params.isStaking) {
    netAPR *= 0.85; // Penalty for not staking
  }

  // Gas cost impact
  const dailyGasCost = (b.gasOverheadPerSwap * params.estimatedDailySwaps * 20) / 1e9; // Approx gwei to ETH, then rough USD
  const gasAPRImpact = -(dailyGasCost * 365) / 1000 * 100; // Rough APR pts on $1k position
  netAPR += gasAPRImpact / 100;

  // Risk scoring
  let riskScore = 50;
  if (b.auditStatus === 'audited') riskScore -= 20;
  if (b.auditStatus === 'unaudited') riskScore += 25;
  if (b.auditStatus === 'experimental') riskScore += 35;
  if (b.lockupPeriodDays && params.positionLockupDays && params.positionLockupDays < b.lockupPeriodDays) {
    riskScore += 15; // Lockup mismatch risk
  }
  riskScore = Math.max(0, Math.min(100, riskScore));

  // Complexity scoring
  let complexityScore = 30;
  if (b.requiresStaking) complexityScore += 15;
  if (b.feeAdjustment !== 'none') complexityScore += 10;
  if (b.lockupPeriodDays) complexityScore += 10;
  if (hook.category === 'risk') complexityScore += 15;
  complexityScore = Math.max(0, Math.min(100, complexityScore));

  // Generate recommendation
  let recommendation: string;
  if (netAPR > params.baseAPR * 1.2 && riskScore < 50) {
    recommendation = `Strong candidate. ${hook.name} boosts estimated APR by ${((netAPR / params.baseAPR - 1) * 100).toFixed(0)}% with manageable risk.`;
  } else if (netAPR > params.baseAPR && riskScore < 60) {
    recommendation = `Moderate candidate. Slight APR improvement but factor in ${hook.category}-specific risks.`;
  } else if (riskScore > 70) {
    recommendation = `High risk. Only use with small test positions until more battle-tested.`;
  } else {
    recommendation = `Neutral. No clear advantage over standard V3/V4 pool for this configuration.`;
  }

  return {
    netAPR: Math.max(0, netAPR),
    riskScore,
    complexityScore,
    recommendation,
  };
}

/**
 * Recommend hooks for a given strategy profile.
 */
export function recommendHooks(params: {
  pairSymbol: string;
  volatility: number;
  baseAPR: number;
  chainId: number;
  riskTolerance: 'low' | 'medium' | 'high';
  timeHorizonDays: number;
}): Array<{ hookId: string; hook: RegisteredHook; score: ReturnType<typeof calculateHookLPScore> }> {
  const candidates = getHooksForChain(params.chainId);
  
  const scored = candidates.map(hook => {
    const hookId = Object.entries(HOOK_REGISTRY).find(([, v]) => v === hook)?.[0] || '';
    const score = calculateHookLPScore({
      baseAPR: params.baseAPR,
      hookId,
      pairVolatility: params.volatility,
      estimatedDailySwaps: 50, // rough estimate
      positionLockupDays: params.timeHorizonDays,
    });
    return { hookId, hook, score };
  });

  // Filter by risk tolerance
  const maxRisk = params.riskTolerance === 'low' ? 50 : params.riskTolerance === 'medium' ? 70 : 100;
  
  return scored
    .filter(s => s.score.riskScore <= maxRisk)
    .sort((a, b) => b.score.netAPR - a.score.netAPR)
    .slice(0, 5);
}
