/**
 * Confidence-bands engine.
 *
 * Turns a sequence of per-window outcomes (e.g. weekly APRs from a backtest)
 * into a percentile-based confidence band so an LP can tell whether a
 * `totalReturn: 0.15` projection is a tight +15% or a noisy −50%…+80%.
 *
 * Design choices:
 *   - Pure functions, no I/O. The caller wires the engine to the network.
 *   - Percentiles use the "type 7" linear-interpolation method — the numpy
 *     default — so results match `numpy.percentile(arr, p)` exactly.
 *   - For `n < 30` windows we additionally run a nonparametric bootstrap on
 *     the standard-deviation estimator to mitigate small-sample bias.
 *     Percentiles themselves are always read from the sample (the empirical
 *     CDF is already the natural nonparametric bootstrap of the underlying
 *     distribution, so resampling the values produces the same type-7
 *     percentiles without adding Monte-Carlo noise). For `n >= 30` the
 *     sample is large enough that no resampling is performed.
 *   - When `seed` is provided we drive the PRNG with a tiny mulberry32 so
 *     results are reproducible across runs and platforms; otherwise
 *     `Math.random` is used.
 *
 * The engine deliberately knows nothing about Uniswap — it consumes generic
 * `number` arrays — so it can be reused for any sequence-of-outcomes
 * statistic (IL, fees, total return, drawdown, …).
 */

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface ConfidenceBands {
  /** Sample size (number of windows). */
  n: number;
  /** Point estimate (mean of window outcomes). */
  mean: number;
  /** Standard deviation of window outcomes. */
  stdDev: number;
  /** 5th percentile of window outcomes (type-7 linear interpolation). */
  p5: number;
  /** 25th percentile of window outcomes. */
  p25: number;
  /** 50th percentile (median) of window outcomes. */
  p50: number;
  /** 75th percentile of window outcomes. */
  p75: number;
  /** 95th percentile of window outcomes. */
  p95: number;
  /** Fraction of windows with negative outcome (`count(w < 0) / n`). */
  probabilityOfLoss: number;
  /** Most-negative single-window outcome — the worst observed drawdown
   *  given only per-window totals. (Intra-window drawdown would require
   *  the underlying daily series and is out of scope here.) */
  worstDrawdown: number;
  /** Maximum observed window outcome. */
  bestWindow: number;
  /** Minimum observed window outcome. */
  worstWindow: number;
  /** 90% interval `[p5, p95]`. */
  ci90: [number, number];
  /** 50% (interquartile) interval `[p25, p75]`. */
  ci50: [number, number];
}

export interface ConfidenceConfig {
  /** Number of bootstrap resamples (default 1000, range 1..10000). */
  bootstrapSamples?: number;
  /** Percentiles to validate and report bounds for (default `[5,25,50,75,95]`).
   *  Output `ConfidenceBands` always exposes the fixed p5/p25/p50/p75/p95
   *  fields; this array is accepted so callers can document the requested
   *  interval and is validated for sorted-ascending order + [0,100] range. */
  percentiles?: number[];
  /** Random seed for deterministic tests (omit → `Math.random`). */
  seed?: number;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Type-7 linear-interpolation percentile (numpy default).
 *
 *   q = (n - 1) * (p / 100)
 *   if q is integer: return sorted[q]
 *   else: lerp(sorted[floor(q)], sorted[ceil(q)], q - floor(q))
 */
function percentileLinear(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sortedAsc[0];
  if (p <= 0) return sortedAsc[0];
  if (p >= 100) return sortedAsc[n - 1];
  const q = (n - 1) * (p / 100);
  const lo = Math.floor(q);
  const hi = Math.ceil(q);
  if (lo === hi) return sortedAsc[lo];
  const frac = q - lo;
  return sortedAsc[lo] + frac * (sortedAsc[hi] - sortedAsc[lo]);
}

/**
 * Build a reproducible PRNG. When `seed` is undefined we fall back to
 * `Math.random`; otherwise we use a small mulberry32 implementation that
 * is deterministic across JS runtimes.
 */
function makeRng(seed: number | undefined): () => number {
  if (seed === undefined) {
    return Math.random;
  }
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Compute confidence bands from a series of per-window outcomes (e.g. APRs).
 *
 * For `n < 30` the standard-deviation estimate is refined with a nonparametric
 * bootstrap; for `n >= 30` the sample is large enough that we report the
 * sample standard deviation directly. Percentiles are always read from the
 * sample using the type-7 linear-interpolation method.
 *
 * Throws if `windowOutcomes.length < 5` — the caller should either fall back
 * to a point estimate or request more history.
 */
export function computeConfidenceBands(
  windowOutcomes: number[],
  config?: ConfidenceConfig
): ConfidenceBands {
  if (!Array.isArray(windowOutcomes)) {
    throw new Error('Invalid windowOutcomes: expected an array of numbers');
  }
  if (windowOutcomes.length < 5) {
    throw new Error(
      'Invalid input: need at least 5 windows for meaningful confidence bands'
    );
  }
  for (let i = 0; i < windowOutcomes.length; i++) {
    const v = windowOutcomes[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(
        `Invalid windowOutcomes[${i}]: expected a finite number, got ${String(v)}`
      );
    }
  }

  const cfg = config ?? {};
  const bootstrapSamples = cfg.bootstrapSamples ?? 1000;
  if (
    !Number.isInteger(bootstrapSamples) ||
    bootstrapSamples < 1 ||
    bootstrapSamples > 10000
  ) {
    throw new Error('Invalid bootstrapSamples: must be an integer in [1, 10000]');
  }

  const percentiles = cfg.percentiles ?? [5, 25, 50, 75, 95];
  if (!Array.isArray(percentiles) || percentiles.length === 0) {
    throw new Error('Invalid percentiles: must be a non-empty array');
  }
  for (let i = 0; i < percentiles.length; i++) {
    const v = percentiles[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Invalid percentiles[${i}]: expected a finite number`);
    }
    if (v < 0 || v > 100) {
      throw new Error(`Invalid percentiles[${i}]: must be in [0, 100]`);
    }
    if (i > 0 && v <= percentiles[i - 1]) {
      throw new Error('Invalid percentiles: must be sorted strictly ascending');
    }
  }

  const n = windowOutcomes.length;

  // ---- point estimate (mean) ----
  let sum = 0;
  for (let i = 0; i < n; i++) sum += windowOutcomes[i];
  const mean = sum / n;

  // ---- sample standard deviation (n-1 denominator, Bessel-corrected) ----
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const d = windowOutcomes[i] - mean;
    ss += d * d;
  }
  const sampleStdDev = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;

  // ---- bootstrap stdDev for small n ----
  // We resample with replacement `bootstrapSamples` times, compute the
  // sample stddev of each resample, and take the median. This is a
  // robust small-sample variance estimator (BCa-lite) that converges to
  // the sample stddev as n grows.
  let stdDev: number = sampleStdDev;
  if (n < 30) {
    const rng = makeRng(cfg.seed);
    const stds: number[] = new Array(bootstrapSamples);
    for (let b = 0; b < bootstrapSamples; b++) {
      const resample = new Array<number>(n);
      let rsum = 0;
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(rng() * n);
        const v = windowOutcomes[idx];
        resample[i] = v;
        rsum += v;
      }
      const rmean = rsum / n;
      let rss = 0;
      for (let i = 0; i < n; i++) {
        const d = resample[i] - rmean;
        rss += d * d;
      }
      stds[b] = n > 1 ? Math.sqrt(rss / (n - 1)) : 0;
    }
    stds.sort((a, b) => a - b);
    stdDev = percentileLinear(stds, 50);
  }

  // ---- percentiles (always sample-based, type-7) ----
  const sorted = windowOutcomes.slice().sort((a, b) => a - b);
  const p5 = percentileLinear(sorted, 5);
  const p25 = percentileLinear(sorted, 25);
  const p50 = percentileLinear(sorted, 50);
  const p75 = percentileLinear(sorted, 75);
  const p95 = percentileLinear(sorted, 95);

  // ---- tail / extremes ----
  let negatives = 0;
  let best = sorted[0];
  let worst = sorted[0];
  for (let i = 0; i < n; i++) {
    const v = windowOutcomes[i];
    if (v < 0) negatives++;
    if (v > best) best = v;
    if (v < worst) worst = v;
  }
  const probabilityOfLoss = negatives / n;

  return {
    n,
    mean,
    stdDev,
    p5,
    p25,
    p50,
    p75,
    p95,
    probabilityOfLoss,
    worstDrawdown: worst,
    bestWindow: best,
    worstWindow: worst,
    ci90: [p5, p95],
    ci50: [p25, p75],
  };
}

/**
 * Slice a longer series into overlapping / non-overlapping windows of
 * `windowSize` elements, advancing by `stride` elements between windows.
 *
 * Defaults: `stride = windowSize` (non-overlapping).
 *
 * Throws when `windowSize <= 0` or `stride <= 0`. Throws when
 * `minWindows` is supplied and the resulting window count is below the
 * minimum.
 */
export function rollingWindows<T>(
  series: T[],
  windowSize: number,
  options?: { stride?: number; minWindows?: number }
): T[][] {
  if (!Number.isInteger(windowSize) || windowSize <= 0) {
    throw new Error('Invalid windowSize: must be a positive integer');
  }
  const stride = options?.stride ?? windowSize;
  if (!Number.isInteger(stride) || stride <= 0) {
    throw new Error('Invalid stride: must be a positive integer');
  }
  const minWindows = options?.minWindows ?? 0;
  if (!Number.isInteger(minWindows) || minWindows < 0) {
    throw new Error('Invalid minWindows: must be a non-negative integer');
  }

  const out: T[][] = [];
  for (let start = 0; start + windowSize <= series.length; start += stride) {
    out.push(series.slice(start, start + windowSize));
  }
  if (minWindows > 0 && out.length < minWindows) {
    throw new Error(
      `rollingWindows produced ${out.length} windows; need at least ${minWindows}`
    );
  }
  return out;
}

/**
 * Convert a daily-return series into per-window compounded returns. Each
 * window's outcome is `product(1 + r_i) - 1`, the geometric return over
 * that window.
 *
 * Defaults: `stride = windowSize` (non-overlapping windows).
 */
export function compoundWindowReturns(
  dailyReturns: number[],
  windowSize: number,
  options?: { stride?: number }
): number[] {
  if (!Number.isInteger(windowSize) || windowSize <= 0) {
    throw new Error('Invalid windowSize: must be a positive integer');
  }
  const stride = options?.stride ?? windowSize;
  if (!Number.isInteger(stride) || stride <= 0) {
    throw new Error('Invalid stride: must be a positive integer');
  }
  if (!Array.isArray(dailyReturns)) {
    throw new Error('Invalid dailyReturns: expected an array of numbers');
  }

  const out: number[] = [];
  for (let start = 0; start + windowSize <= dailyReturns.length; start += stride) {
    let product = 1;
    for (let i = start; i < start + windowSize; i++) {
      product *= 1 + dailyReturns[i];
    }
    out.push(product - 1);
  }
  return out;
}