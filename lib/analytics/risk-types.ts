/**
 * Public type surface for `lib/analytics/risk`.
 *
 * Conventions (documented once here so callers don't have to dig):
 *   - "Returns" are SIMPLE returns:  r_t = (p_t − p_{t−1}) / p_{t−1}
 *     This matches the existing harness (`backtest.ts` `dailyReturn`) so
 *     callers can pipe `backtestResult.equityCurve` straight in.
 *   - "Volatility" / "Drawdown" / "VaR" are all expressed as positive
 *     magnitudes. VaR95 = 0.05 means "in the worst 5% of days, you lose
 *     about 5%". Sortino / Sharpe are sign-preserving — negative returns
 *     produce negative ratios.
 *   - "Sample stddev" uses Bessel's correction (divide by n−1). This is
 *     the industry standard for realized-return statistics.
 *   - All rate/time inputs are *annual* and *daily*; callers pick the
 *     `annualizationFactor` (default 252 for equity trading days; 365 for
 *     crypto-24/7).
 */

/** A single point on an equity curve. */
export interface EquityPoint {
  /** Unix epoch milliseconds or seconds — used only for ordering / output. */
  timestamp: number;
  /** Mark-to-market portfolio value (USD-equivalent). */
  lpValue: number;
}

/** Output of {@link maxDrawdown}. */
export interface DrawdownResult {
  /** 0.15 = 15% drawdown. Always >= 0. */
  maxDrawdownPct: number;
  /** Index of the peak that begins the worst drawdown. */
  maxDrawdownStart: number;
  /** Index of the trough that ends the worst drawdown. */
  maxDrawdownEnd: number;
  /** First index after the trough where value >= peak value, or null. */
  recoveryIndex: number | null;
}

/** Aggregate risk analytics for a backtest equity curve. */
export interface RiskReport {
  // ---- core returns ----
  /** Total return over the curve: (end / start) − 1. */
  totalReturn: number;
  /**
   * Annualized total return:
   * (1 + totalReturn)^(annualizationFactor / N) − 1.
   * `null` when N ≤ 0 (no data) or the curve has been wiped out
   * (base ≤ 0, geometric annualization is undefined). The pure
   * `computeRiskReport` returns `NaN` in those cases; the API route
   * replaces it with `null` so JSON consumers can branch on it.
   */
  annualizedReturn: number | null;

  // ---- volatility ----
  /** Annualized standard deviation of daily returns (sqrt(N) scaling). */
  annualizedVolatility: number;

  // ---- risk-adjusted ratios ----
  /** Sharpe = (meanExcess / vol) × sqrt(annualizationFactor). 0 if vol=0. */
  sharpeRatio: number;
  /** Sortino uses downside-only deviation. 0 if downside dev = 0. */
  sortinoRatio: number;
  /** Calmar = annualizedReturn / |maxDrawdown|. 0 if drawdown = 0. */
  calmarRatio: number;

  // ---- drawdown ----
  /** Worst peak-to-trough, as a positive decimal. */
  maxDrawdown: number;

  // ---- tail risk ----
  /** Historical 95% VaR — positive loss magnitude. */
  valueAtRisk95: number;
  /** Historical 99% VaR — positive loss magnitude. */
  valueAtRisk99: number;
  /** Conditional VaR (Expected Shortfall) at 95%. */
  conditionalVaR95: number;
  /** Conditional VaR (Expected Shortfall) at 99%. */
  conditionalVaR99: number;

  // ---- extras (A16Z-grade) ----
  /**
   * Ulcer Index — RMS of percentage drawdowns over the curve.
   * Captures both depth *and* duration of underwater periods.
   * 0 for a monotonically rising curve.
   */
  ulcerIndex: number;
  /** Burke Ratio = annualizedReturn / UlcerIndex. 0 when UI = 0. */
  burkeRatio: number;

  // ---- meta ----
  /** Number of daily-return samples used (equityCurve.length − 1). */
  sampleSize: number;
  /** The annualization factor that was actually applied. */
  annualizationFactor: number;
  /** Risk-free rate the caller supplied (echoed for the UI). */
  riskFreeRate: number;
}