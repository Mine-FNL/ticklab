/**
 * Pre-deposit red-flag checklist for LP strategies.
 *
 * Encodes industry failure modes (slippage, hook risk, dead pools, OOR risk,
 * LP concentration, oversized positions) as typed rules. Designed to run as a
 * pure function on a `ChecklistInput` snapshot — no I/O, no side effects.
 *
 * Scoring starts at 100. Each `warn` deducts 10; each `block` deducts 30.
 * Block items always force an overall `no-go` verdict regardless of score.
 *
 * Design choices:
 *   - Items are sorted by severity in the output (block → warn → info → pass)
 *     so a UI can render the most critical findings first.
 *   - Every verdict carries `evidence` with the raw numbers used, so a
 *     downstream tool can render a "why" tooltip and tests can assert
 *     specific values.
 *   - Thresholds are encoded as named constants at the top of the file so
 *     they can be reviewed/tuned in one place.
 */

export type CheckSeverity = 'pass' | 'info' | 'warn' | 'block';

export interface ChecklistItem {
  id: string;
  label: string;
  severity: CheckSeverity;
  message: string;
  suggestion?: string;
  evidence?: Record<string, unknown>;
}

export interface ChecklistInput {
  chainId: number;
  poolAddress: `0x${string}`;
  poolTvlUsd: number;
  poolVolume24hUsd: number;
  feeTierBips: number;
  estimatedEntrySizeUsd: number;
  estimatedEntrySlippagePct: number;
  hookAddress?: `0x${string}`;
  hookAuditStatus?: 'audited' | 'partial' | 'unaudited' | 'experimental' | 'unknown';
  hookTvlUsd?: number;
  token0Symbol: string;
  token1Symbol: string;
  isStablePair: boolean;
  historicalDepegEvents?: number;
  expectedOutOfRangeProbability: number;
  liquidityConcentrationPct?: number;
}

export interface ChecklistResult {
  overall: 'go' | 'caution' | 'no-go';
  score: number;
  items: ChecklistItem[];
  blockedReasons: string[];
  warnedReasons: string[];
}

/* -------------------------------------------------------------------------- */
/* Threshold constants — single source of truth.                                */
/* -------------------------------------------------------------------------- */

/** Entry slippage thresholds (percent). */
const SLIPPAGE_WARN_PCT = 2;
const SLIPPAGE_BLOCK_PCT = 5;

/** Pool TVL floor (USD). Below this the pool is illiquid. */
const TVL_FLOOR_USD = 100_000;
/** Hook TVL floor (USD). */
const HOOK_TVL_FLOOR_USD = 100_000;

/** Volume/TVL daily turnover floor (decimal, 0.005 = 0.5%/day). */
const VOLUME_TVL_FLOOR = 0.005;

/** Fee tier sanity cap for stable pairs (bps). 100 bps = 0.01%. */
const STABLE_FEE_TIER_BPS_CAP = 100;

/** Out-of-range probability thresholds (probability 0..1). */
const OOR_WARN = 0.5;
const OOR_BLOCK = 0.8;

/** LP concentration thresholds (percent of pool owned by top LP). */
const CONCENTRATION_WARN_PCT = 80;
const CONCENTRATION_BLOCK_PCT = 95;

/** Position size relative to pool TVL (fraction). */
const POS_SIZE_WARN_FRAC = 0.1;
const POS_SIZE_BLOCK_FRAC = 0.3;

/** Score deductions. */
const WARN_DEDUCTION = 10;
const BLOCK_DEDUCTION = 30;

/** Verdict boundaries. */
const GO_MIN_SCORE = 80;
const CAUTION_MIN_SCORE = 50;

/** Industry statistic surfaced in the hook-audit message. */
const MALICIOUS_HOOK_STATISTIC =
  '54% of deployed V4 hooks are outright malicious per 0x analysis, 2026';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

function severityRank(s: CheckSeverity): number {
  switch (s) {
    case 'block':
      return 0;
    case 'warn':
      return 1;
    case 'info':
      return 2;
    case 'pass':
      return 3;
  }
}

function sortBySeverity(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

/* -------------------------------------------------------------------------- */
/* Rules                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Rule 1 — entry_slippage.
 * Penalises pools where the user's entry will move price more than ~2%.
 */
function ruleEntrySlippage(input: ChecklistInput): ChecklistItem {
  const slippage = input.estimatedEntrySlippagePct;
  const evidence = { estimatedEntrySlippagePct: slippage };

  if (slippage > SLIPPAGE_BLOCK_PCT) {
    return {
      id: 'entry_slippage',
      label: 'Entry slippage',
      severity: 'block',
      message: `Estimated entry slippage is ${slippage.toFixed(2)}%, which exceeds the ${SLIPPAGE_BLOCK_PCT}% safety ceiling. The pool cannot absorb this trade without major price impact.`,
      suggestion: 'Reduce position size dramatically, or pick a deeper pool. Consider splitting the entry into a TWAP over multiple blocks.',
      evidence,
    };
  }
  if (slippage > SLIPPAGE_WARN_PCT) {
    return {
      id: 'entry_slippage',
      label: 'Entry slippage',
      severity: 'warn',
      message: `Estimated entry slippage is ${slippage.toFixed(2)}%, above the ${SLIPPAGE_WARN_PCT}% comfort threshold.`,
      suggestion: 'Reduce position size, or split the entry using a TWAP to reduce price impact.',
      evidence,
    };
  }
  return {
    id: 'entry_slippage',
    label: 'Entry slippage',
    severity: 'pass',
    message: `Entry slippage is ${slippage.toFixed(2)}%, within safe bounds.`,
    evidence,
  };
}

/**
 * Rule 2 — tvl_minimum.
 * A pool with too little TVL relative to the deposit cannot be exited cleanly.
 */
function ruleTvlMinimum(input: ChecklistInput): ChecklistItem {
  const tvl = input.poolTvlUsd;
  const size = input.estimatedEntrySizeUsd;
  const tvlRatio = tvl > 0 ? size / tvl : Number.POSITIVE_INFINITY;
  const evidence = {
    poolTvlUsd: tvl,
    estimatedEntrySizeUsd: size,
    sizeToTvlRatio: tvlRatio,
  };

  if (tvl < TVL_FLOOR_USD) {
    return {
      id: 'tvl_minimum',
      label: 'Pool TVL',
      severity: 'warn',
      message: `Pool TVL is $${tvl.toLocaleString()}, below the $${TVL_FLOOR_USD.toLocaleString()} floor — pool is too shallow to trade safely.`,
      suggestion: 'Pick a deeper pool with more than $100k TVL.',
      evidence,
    };
  }
  if (tvl < 10 * size) {
    return {
      id: 'tvl_minimum',
      label: 'Pool TVL',
      severity: 'block',
      message: `Pool TVL ($${tvl.toLocaleString()}) is less than 10× your entry ($${size.toLocaleString()}). Your position would be too large to exit without moving the market.`,
      suggestion: 'Either pick a deeper pool or reduce position size by ~10×.',
      evidence,
    };
  }
  return {
    id: 'tvl_minimum',
    label: 'Pool TVL',
    severity: 'pass',
    message: `Pool TVL is $${tvl.toLocaleString()} — comfortably above the 10× entry threshold.`,
    evidence,
  };
}

/**
 * Rule 3 — volume_to_tvl.
 * Daily turnover below 0.5% suggests the pool is effectively dead.
 */
function ruleVolumeToTvl(input: ChecklistInput): ChecklistItem {
  const turnover =
    input.poolTvlUsd > 0 ? input.poolVolume24hUsd / input.poolTvlUsd : 0;
  const evidence = {
    poolVolume24hUsd: input.poolVolume24hUsd,
    poolTvlUsd: input.poolTvlUsd,
    turnoverPct: turnover * 100,
  };

  if (turnover < VOLUME_TVL_FLOOR) {
    return {
      id: 'volume_to_tvl',
      label: 'Volume / TVL ratio',
      severity: 'warn',
      message: `24h volume is only ${(turnover * 100).toFixed(3)}% of TVL (floor ${(VOLUME_TVL_FLOOR * 100).toFixed(1)}%). Pool may be dead — fee APR will be near zero.`,
      suggestion: 'Verify there is genuine trading interest; consider a busier pool.',
      evidence,
    };
  }
  return {
    id: 'volume_to_tvl',
    label: 'Volume / TVL ratio',
    severity: 'pass',
    message: `24h turnover is ${(turnover * 100).toFixed(2)}% of TVL — pool is active.`,
    evidence,
  };
}

/**
 * Rule 4 — hook_audit.
 * Only fires when a hook address is present. Unaudited hooks are treated as
 * malicious by default — see the 0x industry statistic in the message.
 */
function ruleHookAudit(input: ChecklistInput): ChecklistItem | null {
  if (!input.hookAddress) return null;
  const status = input.hookAuditStatus ?? 'unknown';
  const evidence = { hookAddress: input.hookAddress, hookAuditStatus: status };

  if (status === 'audited') {
    return {
      id: 'hook_audit',
      label: 'Hook audit status',
      severity: 'pass',
      message: 'Hook has been audited by a reputable firm.',
      evidence,
    };
  }
  if (status === 'partial') {
    return {
      id: 'hook_audit',
      label: 'Hook audit status',
      severity: 'warn',
      message: `Hook is only partially audited. ${MALICIOUS_HOOK_STATISTIC}.`,
      suggestion: 'Review the audit scope; avoid hooks with un-audited code paths.',
      evidence,
    };
  }
  // unaudited | experimental | unknown
  return {
    id: 'hook_audit',
    label: 'Hook audit status',
    severity: 'block',
    message: `Hook audit status is "${status}". ${MALICIOUS_HOOK_STATISTIC}.`,
    suggestion: 'Do not deposit. Use only audited hooks from established teams.',
    evidence,
  };
}

/**
 * Rule 5 — hook_tvl.
 * Only fires when a hook address is present and hookTvlUsd is supplied.
 */
function ruleHookTvl(input: ChecklistInput): ChecklistItem | null {
  if (!input.hookAddress) return null;
  if (input.hookTvlUsd === undefined) return null;
  const tvl = input.hookTvlUsd;
  const evidence = { hookAddress: input.hookAddress, hookTvlUsd: tvl };

  if (tvl < HOOK_TVL_FLOOR_USD) {
    return {
      id: 'hook_tvl',
      label: 'Hook TVL',
      severity: 'block',
      message: `Hook TVL is $${tvl.toLocaleString()}, below the $${HOOK_TVL_FLOOR_USD.toLocaleString()} floor. Insufficient real usage to call this hook battle-tested.`,
      suggestion: 'Use a hook with at least $100k in proven TVL.',
      evidence,
    };
  }
  return {
    id: 'hook_tvl',
    label: 'Hook TVL',
    severity: 'pass',
    message: `Hook TVL is $${tvl.toLocaleString()} — sufficient real usage.`,
    evidence,
  };
}

/**
 * Rule 6 — stable_depeg_history.
 * Stablecoins that have depegged before are higher-risk.
 */
function ruleStableDepegHistory(input: ChecklistInput): ChecklistItem | null {
  if (!input.isStablePair) return null;
  const events = input.historicalDepegEvents ?? 0;
  const evidence = {
    token0Symbol: input.token0Symbol,
    token1Symbol: input.token1Symbol,
    historicalDepegEvents: events,
  };

  if (events > 0) {
    return {
      id: 'stable_depeg_history',
      label: 'Stable depeg history',
      severity: 'warn',
      message: `${events} prior depeg event(s) recorded for this stable pair. Even a brief depeg can wipe out LP value if the range straddles it.`,
      suggestion: 'Use a tighter range around 1.0, or pick stables without depeg history.',
      evidence,
    };
  }
  return {
    id: 'stable_depeg_history',
    label: 'Stable depeg history',
    severity: 'pass',
    message: 'No prior depeg events recorded for this stable pair.',
    evidence,
  };
}

/**
 * Rule 7 — out_of_range_risk.
 * If the position is likely to leave the active range within the horizon,
 * the LP earns nothing and pays IL on the rebalance.
 */
function ruleOutOfRangeRisk(input: ChecklistInput): ChecklistItem {
  const p = input.expectedOutOfRangeProbability;
  const evidence = { expectedOutOfRangeProbability: p };

  if (p > OOR_BLOCK) {
    return {
      id: 'out_of_range_risk',
      label: 'Out-of-range probability',
      severity: 'block',
      message: `Expected OOR probability is ${(p * 100).toFixed(1)}% (block threshold ${(OOR_BLOCK * 100).toFixed(0)}%). The position will almost certainly leave range.`,
      suggestion: 'Widen the range dramatically, or pick a less volatile pair.',
      evidence,
    };
  }
  if (p > OOR_WARN) {
    return {
      id: 'out_of_range_risk',
      label: 'Out-of-range probability',
      severity: 'warn',
      message: `Expected OOR probability is ${(p * 100).toFixed(1)}% — coin-flip chance the position goes out of range.`,
      suggestion: 'Consider widening the range to capture more price action.',
      evidence,
    };
  }
  return {
    id: 'out_of_range_risk',
    label: 'Out-of-range probability',
    severity: 'pass',
    message: `Expected OOR probability is ${(p * 100).toFixed(1)}% — well within safe bounds.`,
    evidence,
  };
}

/**
 * Rule 8 — fee_tier_extreme.
 * Stable pairs should use the 1bps or 5bps fee tier; anything higher is a
 * red flag because it implies the pool is being used for non-stable traffic.
 */
function ruleFeeTierExtreme(input: ChecklistInput): ChecklistItem {
  const evidence = {
    feeTierBips: input.feeTierBips,
    isStablePair: input.isStablePair,
  };

  if (!input.isStablePair) {
    return {
      id: 'fee_tier_extreme',
      label: 'Fee tier sanity',
      severity: 'info',
      message: `Fee tier is ${input.feeTierBips} bps — review against the pair's typical volatility.`,
      evidence,
    };
  }
  if (input.feeTierBips > STABLE_FEE_TIER_BPS_CAP) {
    return {
      id: 'fee_tier_extreme',
      label: 'Fee tier sanity',
      severity: 'warn',
      message: `Stable pair is using a ${input.feeTierBips} bps fee tier (>${STABLE_FEE_TIER_BPS_CAP} bps). The pool is likely not actually a stable pair.`,
      suggestion: 'Verify the pool composition; consider the 1bps (100) or 5bps (500) stable tier.',
      evidence,
    };
  }
  return {
    id: 'fee_tier_extreme',
    label: 'Fee tier sanity',
    severity: 'pass',
    message: `Stable pair uses ${input.feeTierBips} bps — appropriate.`,
    evidence,
  };
}

/**
 * Rule 9 — liquidity_concentration.
 * When a single LP owns most of the pool, their exit can crash it.
 */
function ruleLiquidityConcentration(input: ChecklistInput): ChecklistItem | null {
  if (input.liquidityConcentrationPct === undefined) return null;
  const pct = input.liquidityConcentrationPct;
  const evidence = { liquidityConcentrationPct: pct };

  if (pct > CONCENTRATION_BLOCK_PCT) {
    return {
      id: 'liquidity_concentration',
      label: 'LP concentration',
      severity: 'block',
      message: `Top LP owns ${pct.toFixed(1)}% of pool liquidity (>${CONCENTRATION_BLOCK_PCT}%). One exit could crash the pool.`,
      suggestion: 'Pick a pool with many LPs, or one with a known sticky LP.',
      evidence,
    };
  }
  if (pct > CONCENTRATION_WARN_PCT) {
    return {
      id: 'liquidity_concentration',
      label: 'LP concentration',
      severity: 'warn',
      message: `Top LP owns ${pct.toFixed(1)}% of pool liquidity (>${CONCENTRATION_WARN_PCT}%). Concentration risk is material.`,
      suggestion: 'Pick a more diversified pool if possible.',
      evidence,
    };
  }
  return {
    id: 'liquidity_concentration',
    label: 'LP concentration',
    severity: 'pass',
    message: `Top LP owns ${pct.toFixed(1)}% of pool liquidity — well diversified.`,
    evidence,
  };
}

/**
 * Rule 10 — position_size_vs_tvl.
 * A single LP owning >10% of the pool causes one-sided dump risk on entry/exit.
 */
function rulePositionSizeVsTvl(input: ChecklistInput): ChecklistItem {
  const ratio =
    input.poolTvlUsd > 0 ? input.estimatedEntrySizeUsd / input.poolTvlUsd : 0;
  const evidence = {
    estimatedEntrySizeUsd: input.estimatedEntrySizeUsd,
    poolTvlUsd: input.poolTvlUsd,
    sizeToTvlRatio: ratio,
  };

  if (ratio > POS_SIZE_BLOCK_FRAC) {
    return {
      id: 'position_size_vs_tvl',
      label: 'Position size vs pool',
      severity: 'block',
      message: `Your entry is ${(ratio * 100).toFixed(1)}% of pool TVL (>${(POS_SIZE_BLOCK_FRAC * 100).toFixed(0)}%). One-sided dump risk is severe.`,
      suggestion: 'Cut position size by 3×+ or pick a larger pool.',
      evidence,
    };
  }
  if (ratio > POS_SIZE_WARN_FRAC) {
    return {
      id: 'position_size_vs_tvl',
      label: 'Position size vs pool',
      severity: 'warn',
      message: `Your entry is ${(ratio * 100).toFixed(1)}% of pool TVL (>${(POS_SIZE_WARN_FRAC * 100).toFixed(0)}%). One-sided dump risk is real.`,
      suggestion: 'Consider trimming the position or picking a deeper pool.',
      evidence,
    };
  }
  return {
    id: 'position_size_vs_tvl',
    label: 'Position size vs pool',
    severity: 'pass',
    message: `Entry is ${(ratio * 100).toFixed(2)}% of pool TVL — well within safe bounds.`,
    evidence,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Run the full red-flag checklist against a snapshot of pool/position state.
 * Pure: no I/O, deterministic for a given input.
 */
export function runChecklist(input: ChecklistInput): ChecklistResult {
  const items: ChecklistItem[] = [
    ruleEntrySlippage(input),
    ruleTvlMinimum(input),
    ruleVolumeToTvl(input),
    // ruleHookAudit and ruleHookTvl may return null when no hook is set;
    // filter them out so we don't emit ghost "pass" rows.
    ...(ruleHookAudit(input) ? [ruleHookAudit(input) as ChecklistItem] : []),
    ...(ruleHookTvl(input) ? [ruleHookTvl(input) as ChecklistItem] : []),
    ...(ruleStableDepegHistory(input)
      ? [ruleStableDepegHistory(input) as ChecklistItem]
      : []),
    ruleOutOfRangeRisk(input),
    ruleFeeTierExtreme(input),
    ...(ruleLiquidityConcentration(input)
      ? [ruleLiquidityConcentration(input) as ChecklistItem]
      : []),
    rulePositionSizeVsTvl(input),
  ];

  let score = 100;
  const blockedReasons: string[] = [];
  const warnedReasons: string[] = [];

  for (const item of items) {
    if (item.severity === 'block') {
      score -= BLOCK_DEDUCTION;
      blockedReasons.push(item.id);
    } else if (item.severity === 'warn') {
      score -= WARN_DEDUCTION;
      warnedReasons.push(item.id);
    }
  }
  score = clampScore(score);

  const overall: ChecklistResult['overall'] = blockedReasons.length > 0
    ? 'no-go'
    : score >= GO_MIN_SCORE
      ? 'go'
      : score >= CAUTION_MIN_SCORE
        ? 'caution'
        : 'no-go';

  return {
    overall,
    score,
    items: sortBySeverity(items),
    blockedReasons,
    warnedReasons,
  };
}

// =============================================================================
// Zod schema (for HTTP request validation — kept here, not in route files,
// because Next.js App Router only allows a fixed set of named exports in
// route modules).
// =============================================================================

import { z } from 'zod';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Zod schema for HTTP request validation of `ChecklistInput`.
 * Lives here so multiple API routes and tests can import it without
 * tripping Next.js's strict Route-export rules.
 */
export const checklistInputSchema = z.object({
  chainId: z.coerce.number().int().nonnegative(),
  poolAddress: z.string().regex(ADDRESS_REGEX),
  poolTvlUsd: z.coerce.number().nonnegative(),
  poolVolume24hUsd: z.coerce.number().nonnegative(),
  feeTierBips: z.coerce.number().int().nonnegative(),
  estimatedEntrySizeUsd: z.coerce.number().nonnegative(),
  estimatedEntrySlippagePct: z.coerce.number().nonnegative(),
  hookAddress: z.string().regex(ADDRESS_REGEX).optional(),
  hookAuditStatus: z.enum(['audited', 'partial', 'unaudited', 'experimental', 'unknown']).optional(),
  hookTvlUsd: z.coerce.number().nonnegative().optional(),
  token0Symbol: z.string().min(1),
  token1Symbol: z.string().min(1),
  isStablePair: z.boolean(),
  historicalDepegEvents: z.coerce.number().int().nonnegative().optional(),
  expectedOutOfRangeProbability: z.coerce.number().min(0).max(1),
  liquidityConcentrationPct: z.coerce.number().nonnegative().optional(),
});