/**
 * Checklist engine tests.
 *
 * Coverage:
 *   1. Each rule individually (warn + block where applicable).
 *   2. Score / overall verdict math.
 *   3. Block items always force `no-go` regardless of score.
 *   4. runChecklist is pure (same input → same output).
 *   5. The API route's Zod schema rejects nonsense inputs.
 */

import { describe, it, expect } from 'vitest';
import {
  runChecklist,
  ChecklistInput,
} from '../lib/simulation/checklist';
import { checklistInputSchema } from '../lib/simulation/checklist';

/* -------------------------------------------------------------------------- */
/* Test fixtures                                                              */
/* -------------------------------------------------------------------------- */

const POOL = '0x1234567890123456789012345678901234567890' as const;
const HOOK = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;

function baseInput(overrides: Partial<ChecklistInput> = {}): ChecklistInput {
  return {
    chainId: 1,
    poolAddress: POOL,
    poolTvlUsd: 5_000_000,
    poolVolume24hUsd: 500_000,
    feeTierBips: 3000,
    estimatedEntrySizeUsd: 50_000,
    estimatedEntrySlippagePct: 0.5,
    token0Symbol: 'WETH',
    token1Symbol: 'USDC',
    isStablePair: false,
    expectedOutOfRangeProbability: 0.1,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Per-rule tests                                                              */
/* -------------------------------------------------------------------------- */

describe('rule: entry_slippage', () => {
  it('warns at >2% slippage', () => {
    const r = runChecklist(baseInput({ estimatedEntrySlippagePct: 2.1 }));
    const item = r.items.find((i) => i.id === 'entry_slippage');
    expect(item?.severity).toBe('warn');
    expect(item?.message).toMatch(/2\.10%/);
  });

  it('blocks at >5% slippage', () => {
    const r = runChecklist(baseInput({ estimatedEntrySlippagePct: 5.1 }));
    const item = r.items.find((i) => i.id === 'entry_slippage');
    expect(item?.severity).toBe('block');
    expect(r.overall).toBe('no-go');
    expect(r.blockedReasons).toContain('entry_slippage');
  });

  it('passes at <=2% slippage', () => {
    const r = runChecklist(baseInput({ estimatedEntrySlippagePct: 2 }));
    expect(r.items.find((i) => i.id === 'entry_slippage')?.severity).toBe('pass');
  });
});

describe('rule: tvl_minimum', () => {
  it('warns when TVL below $100k floor', () => {
    const r = runChecklist(baseInput({ poolTvlUsd: 50_000 }));
    const item = r.items.find((i) => i.id === 'tvl_minimum');
    expect(item?.severity).toBe('warn');
    expect(item?.message).toMatch(/\$100,000/);
  });

  it('blocks when TVL < 10× entry size', () => {
    // entry $50k → TVL < $500k → block
    const r = runChecklist(baseInput({ poolTvlUsd: 400_000 }));
    const item = r.items.find((i) => i.id === 'tvl_minimum');
    expect(item?.severity).toBe('block');
    expect(r.blockedReasons).toContain('tvl_minimum');
  });

  it('passes when TVL comfortably deep', () => {
    const r = runChecklist(baseInput({ poolTvlUsd: 5_000_000 })); // 100× entry
    expect(r.items.find((i) => i.id === 'tvl_minimum')?.severity).toBe('pass');
  });
});

describe('rule: volume_to_tvl', () => {
  it('warns when turnover below 0.5%/day', () => {
    // TVL $5M, volume $10k → 0.2% turnover
    const r = runChecklist(baseInput({ poolTvlUsd: 5_000_000, poolVolume24hUsd: 10_000 }));
    const item = r.items.find((i) => i.id === 'volume_to_tvl');
    expect(item?.severity).toBe('warn');
    expect(item?.message).toMatch(/dead/i);
  });

  it('passes when turnover is healthy', () => {
    const r = runChecklist(baseInput({ poolTvlUsd: 5_000_000, poolVolume24hUsd: 500_000 }));
    expect(r.items.find((i) => i.id === 'volume_to_tvl')?.severity).toBe('pass');
  });
});

describe('rule: hook_audit', () => {
  it('does not appear when no hookAddress', () => {
    const r = runChecklist(baseInput());
    expect(r.items.find((i) => i.id === 'hook_audit')).toBeUndefined();
  });

  it('blocks when unaudited', () => {
    const r = runChecklist(baseInput({ hookAddress: HOOK, hookAuditStatus: 'unaudited' }));
    const item = r.items.find((i) => i.id === 'hook_audit');
    expect(item?.severity).toBe('block');
    expect(item?.message).toMatch(/54%/);
  });

  it('blocks when unknown', () => {
    const r = runChecklist(baseInput({ hookAddress: HOOK, hookAuditStatus: 'unknown' }));
    expect(r.items.find((i) => i.id === 'hook_audit')?.severity).toBe('block');
  });

  it('blocks when experimental', () => {
    const r = runChecklist(baseInput({ hookAddress: HOOK, hookAuditStatus: 'experimental' }));
    expect(r.items.find((i) => i.id === 'hook_audit')?.severity).toBe('block');
  });

  it('warns when partial', () => {
    const r = runChecklist(baseInput({ hookAddress: HOOK, hookAuditStatus: 'partial' }));
    const item = r.items.find((i) => i.id === 'hook_audit');
    expect(item?.severity).toBe('warn');
    expect(item?.message).toMatch(/54%/);
  });

  it('passes when audited', () => {
    const r = runChecklist(baseInput({ hookAddress: HOOK, hookAuditStatus: 'audited' }));
    expect(r.items.find((i) => i.id === 'hook_audit')?.severity).toBe('pass');
  });
});

describe('rule: hook_tvl', () => {
  it('blocks when hook TVL < $100k', () => {
    const r = runChecklist(baseInput({
      hookAddress: HOOK,
      hookAuditStatus: 'audited',
      hookTvlUsd: 50_000,
    }));
    const item = r.items.find((i) => i.id === 'hook_tvl');
    expect(item?.severity).toBe('block');
    expect(item?.message).toMatch(/\$100,000/);
  });

  it('passes when hook TVL is healthy', () => {
    const r = runChecklist(baseInput({
      hookAddress: HOOK,
      hookAuditStatus: 'audited',
      hookTvlUsd: 250_000,
    }));
    expect(r.items.find((i) => i.id === 'hook_tvl')?.severity).toBe('pass');
  });

  it('does not appear when hookTvlUsd is undefined', () => {
    const r = runChecklist(baseInput({ hookAddress: HOOK, hookAuditStatus: 'audited' }));
    expect(r.items.find((i) => i.id === 'hook_tvl')).toBeUndefined();
  });
});

describe('rule: stable_depeg_history', () => {
  it('does not appear for non-stable pairs', () => {
    const r = runChecklist(baseInput({ historicalDepegEvents: 2 }));
    expect(r.items.find((i) => i.id === 'stable_depeg_history')).toBeUndefined();
  });

  it('warns when stable pair has depeg history', () => {
    const r = runChecklist(baseInput({
      isStablePair: true,
      token0Symbol: 'USDC',
      token1Symbol: 'USDT',
      historicalDepegEvents: 2,
    }));
    const item = r.items.find((i) => i.id === 'stable_depeg_history');
    expect(item?.severity).toBe('warn');
    expect(item?.message).toMatch(/depeg/i);
  });

  it('passes when stable pair has no depeg history', () => {
    const r = runChecklist(baseInput({ isStablePair: true, historicalDepegEvents: 0 }));
    expect(r.items.find((i) => i.id === 'stable_depeg_history')?.severity).toBe('pass');
  });
});

describe('rule: out_of_range_risk', () => {
  it('warns at >0.5 probability', () => {
    const r = runChecklist(baseInput({ expectedOutOfRangeProbability: 0.6 }));
    expect(r.items.find((i) => i.id === 'out_of_range_risk')?.severity).toBe('warn');
  });

  it('blocks at >0.8 probability', () => {
    const r = runChecklist(baseInput({ expectedOutOfRangeProbability: 0.9 }));
    const item = r.items.find((i) => i.id === 'out_of_range_risk');
    expect(item?.severity).toBe('block');
    expect(item?.suggestion).toMatch(/range/i);
  });

  it('passes at <=0.5 probability', () => {
    const r = runChecklist(baseInput({ expectedOutOfRangeProbability: 0.4 }));
    expect(r.items.find((i) => i.id === 'out_of_range_risk')?.severity).toBe('pass');
  });
});

describe('rule: fee_tier_extreme', () => {
  it('warns for stable pair with fee tier > 100 bps', () => {
    const r = runChecklist(baseInput({ isStablePair: true, feeTierBips: 500 }));
    const item = r.items.find((i) => i.id === 'fee_tier_extreme');
    expect(item?.severity).toBe('warn');
  });

  it('passes for stable pair with fee tier <= 100 bps', () => {
    const r = runChecklist(baseInput({ isStablePair: true, feeTierBips: 100 }));
    expect(r.items.find((i) => i.id === 'fee_tier_extreme')?.severity).toBe('pass');
  });

  it('returns info for non-stable pair regardless of fee tier', () => {
    const r = runChecklist(baseInput({ isStablePair: false, feeTierBips: 3000 }));
    expect(r.items.find((i) => i.id === 'fee_tier_extreme')?.severity).toBe('info');
  });
});

describe('rule: liquidity_concentration', () => {
  it('does not appear when undefined', () => {
    const r = runChecklist(baseInput());
    expect(r.items.find((i) => i.id === 'liquidity_concentration')).toBeUndefined();
  });

  it('warns at >80% concentration', () => {
    const r = runChecklist(baseInput({ liquidityConcentrationPct: 85 }));
    const item = r.items.find((i) => i.id === 'liquidity_concentration');
    expect(item?.severity).toBe('warn');
    expect(item?.message).toMatch(/85/);
  });

  it('blocks at >95% concentration', () => {
    const r = runChecklist(baseInput({ liquidityConcentrationPct: 97 }));
    const item = r.items.find((i) => i.id === 'liquidity_concentration');
    expect(item?.severity).toBe('block');
    expect(item?.message).toMatch(/crash/i);
  });

  it('passes at <=80% concentration', () => {
    const r = runChecklist(baseInput({ liquidityConcentrationPct: 50 }));
    expect(r.items.find((i) => i.id === 'liquidity_concentration')?.severity).toBe('pass');
  });
});

describe('rule: position_size_vs_tvl', () => {
  it('warns at >10% of pool TVL', () => {
    // entry $50k → pool $400k → 12.5%
    const r = runChecklist(baseInput({ estimatedEntrySizeUsd: 50_000, poolTvlUsd: 400_000 }));
    const item = r.items.find((i) => i.id === 'position_size_vs_tvl');
    expect(item?.severity).toBe('warn');
  });

  it('blocks at >30% of pool TVL', () => {
    // entry $50k → pool $100k → 50%
    const r = runChecklist(baseInput({ estimatedEntrySizeUsd: 50_000, poolTvlUsd: 100_000 }));
    const item = r.items.find((i) => i.id === 'position_size_vs_tvl');
    expect(item?.severity).toBe('block');
  });

  it('passes at <=10% of pool TVL', () => {
    // entry $50k → pool $5M → 1%
    const r = runChecklist(baseInput({ estimatedEntrySizeUsd: 50_000, poolTvlUsd: 5_000_000 }));
    expect(r.items.find((i) => i.id === 'position_size_vs_tvl')?.severity).toBe('pass');
  });
});

/* -------------------------------------------------------------------------- */
/* Score / overall math                                                        */
/* -------------------------------------------------------------------------- */

describe('overall score math', () => {
  it('perfect input → score 100, overall go', () => {
    const r = runChecklist(baseInput());
    expect(r.score).toBe(100);
    expect(r.overall).toBe('go');
    expect(r.blockedReasons).toHaveLength(0);
    expect(r.warnedReasons).toHaveLength(0);
  });

  it('one warn → score 90, overall still go', () => {
    // slippage 2.1% → exactly one warn
    const r = runChecklist(baseInput({ estimatedEntrySlippagePct: 2.1 }));
    expect(r.score).toBe(90);
    expect(r.overall).toBe('go');
    expect(r.warnedReasons).toEqual(['entry_slippage']);
  });

  it('one block → score 70, overall no-go (block forces)', () => {
    // slippage 5.1% → exactly one block
    const r = runChecklist(baseInput({ estimatedEntrySlippagePct: 5.1 }));
    expect(r.score).toBe(70);
    expect(r.overall).toBe('no-go');
    expect(r.blockedReasons).toEqual(['entry_slippage']);
  });

  it('block items always force no-go even when score would otherwise be go', () => {
    // audited hook + bad slippage → block on entry_slippage alone
    const r = runChecklist(baseInput({
      estimatedEntrySlippagePct: 10,
      hookAddress: HOOK,
      hookAuditStatus: 'audited',
      hookTvlUsd: 1_000_000,
    }));
    expect(r.score).toBe(70);
    expect(r.overall).toBe('no-go');
  });

  it('multiple warns accumulate to caution', () => {
    // 3 warns → 100 − 30 = 70 → caution
    const r = runChecklist(baseInput({
      estimatedEntrySlippagePct: 3,        // warn
      poolVolume24hUsd: 10_000,            // warn (turnover ~0.2% with 5M TVL)
      expectedOutOfRangeProbability: 0.6,  // warn
    }));
    expect(r.score).toBe(70);
    expect(r.overall).toBe('caution');
    expect(r.warnedReasons).toHaveLength(3);
  });

  it('score is clamped at 0', () => {
    // 4 blocks = -120 → clamped to 0
    const r = runChecklist(baseInput({
      estimatedEntrySlippagePct: 10,       // block
      poolTvlUsd: 100_000,                 // block (TVL < 10× entry = $500k)
      hookAddress: HOOK,
      hookAuditStatus: 'unaudited',        // block
      liquidityConcentrationPct: 97,      // block
    }));
    expect(r.score).toBe(0);
    expect(r.overall).toBe('no-go');
  });
});

/* -------------------------------------------------------------------------- */
/* Items are sorted by severity                                                */
/* -------------------------------------------------------------------------- */

describe('item ordering', () => {
  it('items array is sorted block → warn → info → pass', () => {
    const r = runChecklist(baseInput({
      estimatedEntrySlippagePct: 6,        // block
      isStablePair: true,
      feeTierBips: 500,                    // warn
    }));
    const severities = r.items.map((i) => i.severity);
    const rankOf = (s: string) =>
      ['block', 'warn', 'info', 'pass'].indexOf(s);
    for (let i = 1; i < severities.length; i++) {
      expect(rankOf(severities[i])).toBeGreaterThanOrEqual(
        rankOf(severities[i - 1]),
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Purity                                                                      */
/* -------------------------------------------------------------------------- */

describe('purity', () => {
  it('same input → same output (deep equal)', () => {
    const input = baseInput({ hookAddress: HOOK, hookAuditStatus: 'audited' });
    const a = runChecklist(input);
    const b = runChecklist(input);
    expect(a).toEqual(b);
  });

  it('mutating the input after a call does not affect results', () => {
    const input: ChecklistInput = baseInput();
    const a = runChecklist(input);
    input.estimatedEntrySlippagePct = 99;
    expect(a.score).toBe(100);
    // fresh call sees mutation
    expect(runChecklist(input).overall).toBe('no-go');
  });
});

/* -------------------------------------------------------------------------- */
/* Zod schema on the API route                                                 */
/* -------------------------------------------------------------------------- */

describe('checklist input schema (Zod)', () => {
  const valid = {
    chainId: '1',
    poolAddress: POOL,
    poolTvlUsd: '5000000',
    poolVolume24hUsd: '500000',
    feeTierBips: '3000',
    estimatedEntrySizeUsd: '50000',
    estimatedEntrySlippagePct: '0.5',
    token0Symbol: 'WETH',
    token1Symbol: 'USDC',
    isStablePair: false,
    expectedOutOfRangeProbability: '0.1',
  };

  it('accepts a well-formed body', () => {
    const parsed = checklistInputSchema.parse(valid);
    expect(parsed.chainId).toBe(1);
    expect(parsed.poolTvlUsd).toBe(5_000_000);
  });

  it('rejects an invalid pool address', () => {
    expect(() =>
      checklistInputSchema.parse({ ...valid, poolAddress: 'not-an-address' }),
    ).toThrow();
  });

  it('rejects an invalid hook address', () => {
    expect(() =>
      checklistInputSchema.parse({
        ...valid,
        hookAddress: '0xZZZZ',
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.poolTvlUsd;
    expect(() => checklistInputSchema.parse(rest)).toThrow();
  });

  it('rejects negative numerics', () => {
    expect(() =>
      checklistInputSchema.parse({ ...valid, poolTvlUsd: '-1' }),
    ).toThrow();
    expect(() =>
      checklistInputSchema.parse({ ...valid, estimatedEntrySizeUsd: '-100' }),
    ).toThrow();
  });

  it('rejects invalid hookAuditStatus', () => {
    expect(() =>
      checklistInputSchema.parse({
        ...valid,
        hookAuditStatus: 'totally-fine-honest',
      }),
    ).toThrow();
  });

  it('accepts an optional hookAddress with the regex shape', () => {
    const parsed = checklistInputSchema.parse({
      ...valid,
      hookAddress: HOOK,
      hookAuditStatus: 'audited',
      hookTvlUsd: '250000',
    });
    expect(parsed.hookAddress).toBe(HOOK);
    expect(parsed.hookTvlUsd).toBe(250_000);
  });
});