/**
 * Pure-function portfolio risk analytics.
 *
 * ─── Conventions ─────────────────────────────────────────────────────────────
 * Returns are SIMPLE returns:   r_t = (p_t − p_{t−1}) / p_{t−1}
 *
 *   • This matches the convention already used by `lib/simulation/backtest.ts`
 *     (`calculateSharpeRatio`, line 620) and the simple P&L the harness
 *     emits, so callers can feed `backtestResult.equityCurve` straight in
 *     without retraining their intuition about the numbers.
 *   • For the math layer, simple and log returns are close for small
 *     |r_t| (<5%) but log returns are additive (good for multi-period
 *     compounding) while simple returns are easier to read. Since this
 *     module is mostly consumed by humans via dashboards, we choose the
 *     simpler mental model.
 *
 * Sample standard deviation uses Bessel's correction (divide by n−1).
 * This is the industry default for realized-return statistics; it
 * corresponds to the unbiased estimator of the population variance.
 *
 * All "loss" / "risk" magnitudes (VaR, CVaR, drawdown, ulcer index) are
 * reported as POSITIVE numbers — a VaR of 0.05 means "you can expect to
 * lose about 5% on a bad day". Ratios that are sign-aware (Sharpe,
 * Sortino, Calmar, Burke) keep the sign of the underlying return.
 *
 * Annualization: returns compound geometrically (1+R)^(N)−1;
 * volatility scales by sqrt(N). Default factor 252 (US equity trading
 * days). Crypto / 24-7 callers should pass 365.
 *
 * ─── Edge case policy ──────────────────────────────────────────────────────
 *   • length < 2  → ratios = 0, std-based metrics = 0, ratios that need
 *     variance = NaN so callers can branch on Number.isNaN. We never
 *     throw — analytics are meant to be safe-to-call on tiny curves.
 *   • zero variance → Sharpe / Sortino / Calmar / Burke = 0 (not Infinity,
 *     not NaN). Industry dashboards explode on Infinity.
 *   • 100% drawdown (ruin) → maxDrawdownStart=0, recoveryIndex=null.
 *
 * ─── Why these extras ───────────────────────────────────────────────────────
 * In addition to the eight required metrics we ship two "A16Z-grade"
 * extras that are easy to verify by hand:
 *
 *   • Ulcer Index  — RMS of drawdown percentages. Captures the *duration*
 *     of being underwater (unlike max drawdown which only captures the
 *     worst single dip). Classic measure used by Martin/Pring; one-line
 *     formula: sqrt(mean(drawdown_t^2)).
 *   • Burke Ratio  — annualizedReturn / UlcerIndex. The intuitive
 *     generalization of Calmar: penalises long, painful drawdowns more
 *     than a single V-shaped dip.
 *
 * ─── Determinism ────────────────────────────────────────────────────────────
 * Pure: no I/O, no Date.now, no Math.random. Same input → same output.
 * Tests rely on this; please don't sneak in entropy.
 */

import type { DrawdownResult, EquityPoint, RiskReport } from './risk-types';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Convert an equity curve into simple returns.
 *
 * Accepts either a plain `number[]` OR an array of `{lpValue: number}`
 * (the shape emitted by `lib/simulation/backtest.ts`). The wider
 * signature lets callers pipe either form into the analytics layer
 * without an intermediate `.map(p => p.lpValue)` call.
 *
 * Returns are simple: r_t = (p_t − p_{t−1}) / p_{t−1}.
 *
 *   • Drops samples where the previous value is ≤ 0 (would divide by zero
 *     or invert sign of otherwise-real losses). Bad data should not poison
 *     downstream analytics.
 *   • Drops NaN / Infinity samples on either side.
 *   • Returns [] when fewer than 2 usable points remain.
 */
export function simpleReturns(
  equityCurve: ReadonlyArray<{ lpValue: number } | number>,
): number[] {
  const out: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevRaw = equityCurve[i - 1];
    const currRaw = equityCurve[i];
    const prev = typeof prevRaw === 'number' ? prevRaw : prevRaw?.lpValue;
    const curr = typeof currRaw === 'number' ? currRaw : currRaw?.lpValue;
    if (prev === undefined || curr === undefined) continue;
    if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
    if (prev <= 0) continue; // can't normalize to a return
    out.push(curr / prev - 1);
  }
  return out;
}

/**
 * Sample mean (arithmetic). Returns NaN for an empty input.
 */
function mean(values: ReadonlyArray<number>): number {
  if (values.length === 0) return NaN;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/**
 * Sample standard deviation with Bessel's correction (n−1 in the
 * denominator). Returns 0 for length-0 and length-1 inputs (a single
 * observation has no spread), NaN never reaches this function.
 *
 * Float-noise floor: values below `STDDEV_EPSILON` are coerced to 0 so
 * downstream ratios (Sharpe / Sortino / Calmar) don't blow up to 1e15
 * on flat-ish series due to IEEE-754 rounding (e.g. `0.10 * 4 = 0.4`
 * is actually `0.4000000000000001` — close enough for humans, hostile
 * to ratios).
 */
export const STDDEV_EPSILON = 1e-12;

export function sampleStddev(values: ReadonlyArray<number>): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let ss = 0;
  for (const v of values) {
    const d = v - m;
    ss += d * d;
  }
  const std = Math.sqrt(ss / (values.length - 1));
  return std < STDDEV_EPSILON ? 0 : std;
}

/**
 * Sample standard deviation of the *downside* — only returns strictly
 * below the target (default 0). Used by Sortino.
 *
 * Convention (matches Sortino & Price 1994 and CFA Institute):
 *
 *     ddev = sqrt( sum_i ( min(r_i − target, 0) )^2  /  N )
 *
 * We divide by the *total* observation count N (not by the count of
 * below-target observations). Positive returns contribute nothing to
 * the numerator but still "pad" the denominator, which keeps the
 * metric comparable across strategies that differ only in their
 * upside/downside mix. This is the formulation you'll see in
 * PerformanceAnalytics (R), Riskfolio-Lib, and most quant textbooks.
 *
 * Returns 0 when no observation is below the target.
 */
function downsideDeviation(
  values: ReadonlyArray<number>,
  target: number = 0,
): number {
  if (values.length < 2) return 0;
  let ss = 0;
  for (const v of values) {
    if (v < target) {
      const d = v - target;
      ss += d * d;
    }
  }
  const ddev = Math.sqrt(ss / values.length);
  return ddev < STDDEV_EPSILON ? 0 : ddev;
}

/**
 * Linear-interpolation quantile. We use the same convention as NumPy's
 * default ('linear') and Excel's PERCENTILE.INC: the k-th sample sits at
 * index k/(N+1). This keeps VaR monotonic in the input and avoids the
 * discontinuity of the 'lower' / 'higher' variants.
 */
function quantile(values: ReadonlyArray<number>, q: number): number {
  if (values.length === 0) return NaN;
  if (values.length === 1) return values[0]!;
  if (q <= 0) return Math.min(...values);
  if (q >= 1) return Math.max(...values);

  const sorted = [...values].sort((a, b) => a - b);
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

// ---------------------------------------------------------------------------
// Public metrics
// ---------------------------------------------------------------------------

/**
 * Historical-simulation Value-at-Risk.
 *
 * VaR(α) is the worst loss that is not exceeded with probability α.
 * We expose it as a POSITIVE magnitude:
 *
 *     VaR(0.95) = −quantile(returns, 1 − 0.95) = −quantile(returns, 0.05)
 *
 *   • returns = []  → NaN (caller can branch).
 *   • confidenceLevel outside (0,1) → clamped to (eps, 1-eps) to avoid
 *     ±Infinity.
 */
export function valueAtRisk(
  returns: ReadonlyArray<number>,
  confidenceLevel: number = 0.95,
): number {
  if (returns.length === 0) return NaN;
  const cl = Math.min(1 - 1e-9, Math.max(1e-9, confidenceLevel));
  const tail = 1 - cl;
  const q = quantile(returns, tail);
  // Normalize -0 to +0 so callers' `expect(...).toBe(0)` works on a flat
  // (zero-loss) curve. Otherwise the `-` operator produces -0 which is
  // `Object.is` distinct from +0.
  const loss = -q;
  return loss === 0 ? 0 : loss;
}

/**
 * Conditional VaR / Expected Shortfall.
 *
 * Average of all returns that fall below the VaR cutoff. Exposed as a
 * POSITIVE loss magnitude (i.e. it is ≥ valueAtRisk).
 *
 *   • returns = []  → NaN.
 *   • If fewer than 1 observation falls in the tail (small samples), we
 *     fall back to the worst single observation. This guarantees a
 *     well-defined number for short backtests without lying about
 *     sample size.
 */
export function conditionalVaR(
  returns: ReadonlyArray<number>,
  confidenceLevel: number = 0.95,
): number {
  if (returns.length === 0) return NaN;
  const cl = Math.min(1 - 1e-9, Math.max(1e-9, confidenceLevel));
  const tail = 1 - cl;
  const cutoff = quantile(returns, tail);
  const tailReturns = returns.filter((r) => r <= cutoff);
  let loss: number;
  if (tailReturns.length === 0) {
    loss = -cutoff;
  } else {
    loss = -mean(tailReturns);
  }
  return loss === 0 ? 0 : loss;
}

/**
 * Sharpe ratio, annualised:
 *
 *   sharpe = ((mean(r) − rf_per_period) × sqrt(annualizationFactor)) / stddev(r)
 *
 * where `riskFreeRate` is the *annual* risk-free rate and we convert it
 * to a per-period rate by dividing by the annualization factor. This
 * matches how the caller's intuition works ("rf=0.05 with 252 days →
 * rf_per_period ≈ 0.000198").
 *
 *   • length < 2  → 0 (no signal in a single observation).
 *   • stddev = 0  → 0 (we deliberately suppress Infinity).
 */
export function sharpeRatio(
  returns: ReadonlyArray<number>,
  riskFreeRate: number = 0,
  annualizationFactor: number = 252,
): number {
  if (returns.length < 2) return 0;
  if (annualizationFactor <= 0) return 0;
  const std = sampleStddev(returns);
  if (std === 0) return 0;
  const rfPerPeriod = riskFreeRate / annualizationFactor;
  const excess = mean(returns) - rfPerPeriod;
  return (excess * Math.sqrt(annualizationFactor)) / std;
}

/**
 * Sortino ratio, annualised. Same shape as Sharpe but uses the
 * downside-only deviation. Returns 0 (not Infinity) when the downside
 * deviation collapses (i.e. no losing periods).
 */
export function sortinoRatio(
  returns: ReadonlyArray<number>,
  riskFreeRate: number = 0,
  annualizationFactor: number = 252,
): number {
  if (returns.length < 2) return 0;
  if (annualizationFactor <= 0) return 0;
  const ddev = downsideDeviation(returns, 0);
  if (ddev === 0) return 0;
  const rfPerPeriod = riskFreeRate / annualizationFactor;
  const excess = mean(returns) - rfPerPeriod;
  return (excess * Math.sqrt(annualizationFactor)) / ddev;
}

/**
 * Largest peak-to-trough decline in the equity curve.
 *
 * Returns BOTH the magnitude and the indices, so the UI can highlight
 * the worst drawdown period on the chart.
 *
 *   • length = 0  → magnitude 0, indices 0/0, recovery null.
 *   • 100% drawdown (ruin, value hits 0) → magnitude 1.0, start at the
 *     highest preceding peak, recovery null until value returns to peak.
 *   • If the curve is monotonically rising, magnitude = 0, recovery = the
 *     final index (peak never breached).
 */
export function maxDrawdown(equityCurve: ReadonlyArray<number>): DrawdownResult {
  const n = equityCurve.length;
  if (n === 0) {
    return { maxDrawdownPct: 0, maxDrawdownStart: 0, maxDrawdownEnd: 0, recoveryIndex: null };
  }
  if (n === 1) {
    return { maxDrawdownPct: 0, maxDrawdownStart: 0, maxDrawdownEnd: 0, recoveryIndex: 0 };
  }

  let peakIdx = 0;
  let peakVal = equityCurve[0]!;
  let bestDD = 0;
  let bestStart = 0;
  let bestEnd = 0;

  for (let i = 0; i < n; i++) {
    const v = equityCurve[i]!;
    if (v > peakVal) {
      peakVal = v;
      peakIdx = i;
    }
    if (peakVal > 0) {
      const dd = (peakVal - v) / peakVal;
      if (dd > bestDD) {
        bestDD = dd;
        bestStart = peakIdx;
        bestEnd = i;
      }
    }
  }

  // Recovery: first index after the trough whose value >= peak value.
  // Special case: when there's no drawdown at all (bestDD === 0), the
  // "peak" is whatever the final value is — by definition the curve is
  // already there. Report the last index so the UI can highlight "at
  // peak" rather than "still underwater".
  let recoveryIndex: number | null;
  if (bestDD === 0) {
    recoveryIndex = n - 1;
  } else {
    recoveryIndex = null;
    const peakTarget = equityCurve[bestStart]!;
    for (let i = bestEnd + 1; i < n; i++) {
      if (equityCurve[i]! >= peakTarget) {
        recoveryIndex = i;
        break;
      }
    }
  }

  return {
    maxDrawdownPct: bestDD,
    maxDrawdownStart: bestStart,
    maxDrawdownEnd: bestEnd,
    recoveryIndex,
  };
}

/**
 * Calmar ratio:
 *
 *     calmar = annualizedReturn / |maxDrawdownPct|
 *
 *   • We take |maxDrawdown| so a negative `maxDrawdownPct` (which we
 *     never emit but callers may) doesn't flip the sign.
 *   • 0 when drawdown is 0 — there's no pain to compare return against.
 */
export function calmarRatio(
  returns: ReadonlyArray<number>,
  maxDrawdownPct: number,
  annualizationFactor: number = 252,
): number {
  if (returns.length < 2) return 0;
  if (annualizationFactor <= 0) return 0;
  const dd = Math.abs(maxDrawdownPct);
  if (dd === 0) return 0;
  const totalReturn = cumReturnFromReturns(returns);
  const ann = annualizeReturn(totalReturn, returns.length, annualizationFactor);
  if (!Number.isFinite(ann)) return 0;
  return ann / dd;
}

/**
 * Annualised volatility:  dailyStd × sqrt(annualizationFactor).
 *
 *   • length < 2 → 0.
 */
export function annualizedVolatility(
  returns: ReadonlyArray<number>,
  annualizationFactor: number = 252,
): number {
  if (returns.length < 2) return 0;
  if (annualizationFactor <= 0) return 0;
  return sampleStddev(returns) * Math.sqrt(annualizationFactor);
}

// ---------------------------------------------------------------------------
// Ulcer Index + Burke Ratio (A16Z-grade extras)
// ---------------------------------------------------------------------------

/**
 * Ulcer Index — root-mean-square of the percentage drawdowns over the
 * equity curve.
 *
 *     UI = sqrt(mean_t ( dd_t^2 ))   where dd_t = (peak_t − v_t) / peak_t
 *
 * Captures both *how deep* and *how long* the equity spent underwater.
 * For a monotonically-rising curve, UI = 0.
 */
export function ulcerIndex(equityCurve: ReadonlyArray<number>): number {
  const n = equityCurve.length;
  if (n < 2) return 0;
  let peak = equityCurve[0]!;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const v = equityCurve[i]!;
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      ss += dd * dd;
    }
  }
  return Math.sqrt(ss / n);
}

/**
 * Burke Ratio = annualizedReturn / UlcerIndex.
 * Like Calmar but penalises long, shallow drawdowns harder than a single
 * deep V.
 */
export function burkeRatio(
  returns: ReadonlyArray<number>,
  ulcer: number,
  annualizationFactor: number = 252,
): number {
  if (returns.length < 2) return 0;
  if (annualizationFactor <= 0) return 0;
  if (ulcer === 0) return 0;
  const totalReturn = cumReturnFromReturns(returns);
  const ann = annualizeReturn(totalReturn, returns.length, annualizationFactor);
  if (!Number.isFinite(ann)) return 0;
  return ann / ulcer;
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Compound total return from a sequence of per-period simple returns:
 *
 *     (1 + r_1) × (1 + r_2) × ... − 1
 *
 * Robust to NaN / Infinity inputs (filtered out).
 */
function cumReturnFromReturns(returns: ReadonlyArray<number>): number {
  let product = 1;
  for (const r of returns) {
    if (!Number.isFinite(r)) continue;
    product *= 1 + r;
  }
  return product - 1;
}

/**
 * Annualize a total return using geometric (compound) scaling:
 *
 *     annualized = (1 + totalReturn)^(annualizationFactor / N) − 1
 *
 * Returns 0 when N ≤ 0 (no data — caller shouldn't compound an empty
 * series). Returns NaN only for a genuine ruin (1+R ≤ 0), where
 * geometric annualization is mathematically undefined.
 */
function annualizeReturn(
  totalReturn: number,
  n: number,
  annualizationFactor: number,
): number {
  if (n <= 0 || annualizationFactor <= 0) return 0;
  const base = 1 + totalReturn;
  if (base <= 0) return NaN;
  return Math.pow(base, annualizationFactor / n) - 1;
}

/**
 * The headline aggregator. Accepts either a plain number[] OR an array
 * of {timestamp, lpValue} objects (the shape emitted by
 * `lib/simulation/backtest.ts`). The plain-number overload exists so
 * callers who already converted their curve can skip the projection.
 *
 * The returned `RiskReport` is fully populated (no undefined fields).
 */
export function computeRiskReport(
  equityCurve: ReadonlyArray<EquityPoint> | ReadonlyArray<number>,
  riskFreeRate: number = 0,
  annualizationFactor: number = 252,
): RiskReport {
  // Normalise to a plain number[] for all downstream calculations.
  const values: number[] = Array.isArray(equityCurve)
    ? (typeof (equityCurve as ReadonlyArray<unknown>)[0] === 'number'
        ? (equityCurve as ReadonlyArray<number>).slice()
        : (equityCurve as ReadonlyArray<EquityPoint>).map((p) => p.lpValue))
    : [];

  const returns = simpleReturns(values);
  const dd = maxDrawdown(values);
  const ui = ulcerIndex(values);
  const vol = annualizedVolatility(returns, annualizationFactor);
  const sharpe = sharpeRatio(returns, riskFreeRate, annualizationFactor);
  const sortino = sortinoRatio(returns, riskFreeRate, annualizationFactor);
  const calmar = calmarRatio(returns, dd.maxDrawdownPct, annualizationFactor);
  const burke = burkeRatio(returns, ui, annualizationFactor);
  const totalReturn = cumReturnFromReturns(returns);
  const annualizedReturn = annualizeReturn(totalReturn, returns.length, annualizationFactor);

  return {
    totalReturn,
    annualizedReturn,
    annualizedVolatility: vol,
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    maxDrawdown: dd.maxDrawdownPct,
    calmarRatio: calmar,
    valueAtRisk95: valueAtRisk(returns, 0.95),
    valueAtRisk99: valueAtRisk(returns, 0.99),
    conditionalVaR95: conditionalVaR(returns, 0.95),
    conditionalVaR99: conditionalVaR(returns, 0.99),
    ulcerIndex: ui,
    burkeRatio: burke,
    sampleSize: returns.length,
    annualizationFactor,
    riskFreeRate,
  };
}