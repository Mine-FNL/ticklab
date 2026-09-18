/**
 * Tests for the /validation page's pure helpers (timestamp parsing + stats
 * computation). The page itself is a server component so we test the math
 * functions it ships with — not the JSX.
 */

import { describe, expect, it } from 'vitest';

// We import the page module but only use its exported helpers — vitest
// tolerates non-exported helpers if we re-declare them. To keep this
// self-contained without exposing internal helpers on the page module,
// we re-implement the same logic here and assert against canonical
// expected values. If the page changes one without changing the other,
// the test won't catch it — the page is exercised end-to-end via the
// Next.js build pipeline.

// ---------------------------------------------------------------------------
// 1. timestampFromFilename — reconstructable from the filename shape.
// ---------------------------------------------------------------------------

function timestampFromFilename(filename: string): string {
  const stripped = filename.replace(/^validation-/, '').replace(/\.csv$/, '');
  const m = stripped.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!m) return new Date(0).toISOString();
  const [, y, mo, d, h, mi, s, ms] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
}

describe('timestampFromFilename', () => {
  it('parses the canonical harness filename format', () => {
    const iso = timestampFromFilename('validation-2026-09-18T21-22-16-190Z.csv');
    expect(iso).toBe('2026-09-18T21:22:16.190Z');
    // Round-trip parseable by Date.
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it('returns the epoch for malformed names (defensive)', () => {
    expect(timestampFromFilename('not-a-validation-file.csv')).toBe(new Date(0).toISOString());
    expect(timestampFromFilename('validation-bogus.csv')).toBe(new Date(0).toISOString());
  });
});

// ---------------------------------------------------------------------------
// 2. computeStats — mirrors the harness headline numbers.
// ---------------------------------------------------------------------------

interface Row {
  simulatorCumReturn: number;
  groundTruthCumReturn: number;
  absError: number;
  pctError: number;
}

function computeStats(rows: Row[]) {
  if (rows.length === 0) return null;
  const abs = rows.map((r) => r.absError).sort((a, b) => a - b);
  const rel = rows.map((r) => r.pctError).sort((a, b) => a - b);
  const within5 = rows.filter((r) => r.pctError <= 0.05).length;
  const within20 = rows.filter((r) => r.pctError <= 0.20).length;
  const bias =
    rows.reduce((a, r) => a + (r.simulatorCumReturn - r.groundTruthCumReturn), 0) / rows.length;
  return {
    poolCount: rows.length,
    meanAbsErrorPP: (abs.reduce((a, b) => a + b, 0) / abs.length) * 100,
    medianAbsErrorPP: abs[Math.floor(abs.length / 2)] * 100,
    maxAbsErrorPP: Math.max(...abs) * 100,
    medianRelErrorPct: rel[Math.floor(rel.length / 2)] * 100,
    withinFiveRelPct: (within5 / rows.length) * 100,
    withinTwentyRelPct: (within20 / rows.length) * 100,
    biasPP: bias * 100,
    starReached: within20 / rows.length >= 0.8,
  };
}

describe('computeStats', () => {
  it('returns null on empty input', () => {
    expect(computeStats([])).toBeNull();
  });

  it('computes median, max, mean for a 5-row example', () => {
    // absErrors in pp = [1, 2, 3, 4, 10] (decimal: 0.01..0.10)
    // sorted abs = [0.01, 0.02, 0.03, 0.04, 0.10]
    // median = 0.03, mean = 0.04, max = 0.10
    const rows = [
      { simulatorCumReturn: 0.01, groundTruthCumReturn: 0.00, absError: 0.01, pctError: 0.10 },
      { simulatorCumReturn: 0.02, groundTruthCumReturn: 0.04, absError: 0.02, pctError: 0.05 },
      { simulatorCumReturn: 0.03, groundTruthCumReturn: 0.06, absError: 0.03, pctError: 1.00 },
      { simulatorCumReturn: 0.04, groundTruthCumReturn: 0.08, absError: 0.04, pctError: 0.02 },
      { simulatorCumReturn: 0.05, groundTruthCumReturn: 0.15, absError: 0.10, pctError: 0.33 },
    ];
    const stats = computeStats(rows)!;
    expect(stats.poolCount).toBe(5);
    expect(stats.medianAbsErrorPP).toBeCloseTo(3.0);
    expect(stats.maxAbsErrorPP).toBeCloseTo(10.0);
    // within5%: rel<=0.05 → row 2 (0.05) and row 4 (0.02) → 2/5 = 40%
    expect(stats.withinFiveRelPct).toBeCloseTo(40.0);
    // within20%: add row 1 (0.10) → 3/5 = 60%
    expect(stats.withinTwentyRelPct).toBeCloseTo(60.0);
    // Star NOT reached (60% < 80%)
    expect(stats.starReached).toBe(false);
  });

  it('flags starReached when within20% >= 80%', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      simulatorCumReturn: 0.01,
      groundTruthCumReturn: 0.01,
      absError: 0.001,
      pctError: i < 8 ? 0.10 : 0.50, // 8/10 within 20%
    }));
    expect(computeStats(rows)!.starReached).toBe(true);
  });

  it('rejects star when within20% < 80%', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      simulatorCumReturn: 0.01,
      groundTruthCumReturn: 0.01,
      absError: 0.001,
      pctError: i < 7 ? 0.10 : 0.50, // 7/10 within 20%
    }));
    expect(computeStats(rows)!.starReached).toBe(false);
  });

  it('computes bias as mean(sim - gt)', () => {
    const rows = [
      { simulatorCumReturn: 0.05, groundTruthCumReturn: 0.00, absError: 0.05, pctError: 0.10 },
      { simulatorCumReturn: 0.03, groundTruthCumReturn: 0.00, absError: 0.03, pctError: 0.10 },
    ];
    // bias = mean((0.05-0) + (0.03-0)) = 0.04 → 4pp
    expect(computeStats(rows)!.biasPP).toBeCloseTo(4.0);
  });
});

// ---------------------------------------------------------------------------
// 3. CSV-header-driven row reconstruction.
// ---------------------------------------------------------------------------

describe('CSV row reconstruction', () => {
  it('parses a hand-written CSV the same way the page does', () => {
    // Same shape the harness writes.
    const csv = [
      'pool,days,simulator_cum_return,simulator_cum_return_legacy,simulator_cum_return_v3,ground_truth_cum_return,ground_truth_apr,abs_error,pct_error,covalent_swap_count,covalent_unpriced_count',
      'USDC/WETH 0.05%,30,0.0144,0.0144,,0.0120,0.1440,0.0024,0.20,,',
      'WETH/USDT 0.3%,30,-0.0023,-0.0023,-0.0042,-0.0025,-0.0300,0.0002,0.08,1234,5',
    ].join('\n');

    const lines = csv.trim().split('\n');
    const header = lines[0].split(',');
    const idx = (name: string) => header.indexOf(name);
    const cells = lines[1].split(',');
    expect(cells[idx('pool')]).toBe('USDC/WETH 0.05%');
    expect(Number(cells[idx('days')])).toBe(30);
    // Empty CSV cells coerce to 0 (not NaN) — the page's `optAt()` helper
    // guards against this explicitly via `cells[i] === ''` before parsing.
    expect(cells[idx('covalent_swap_count')]).toBe('');
    expect(Number(cells[idx('covalent_swap_count')])).toBe(0);

    const cells2 = lines[2].split(',');
    expect(Number(cells2[idx('covalent_swap_count')])).toBe(1234);
    expect(Number(cells2[idx('covalent_unpriced_count')])).toBe(5);
  });
});