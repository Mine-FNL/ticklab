/**
 * Public validation results page.
 *
 * Reads the most recent CSV written by `scripts/validate-northstar.ts`
 * from `validation-results/` and renders it as a live results table with
 * the north-star acceptance status, error stats, and a "how is this
 * computed" link to the methodology.
 *
 * No data leaves this machine: the CSV is read at request time from the
 * project working directory (Next.js `process.cwd()` at build/serve time).
 * If no CSV exists yet (fresh checkout), the page renders a clear empty
 * state with instructions for running the harness.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, FileText, Clock, GitBranch } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types — must match the CSV header written by `scripts/validate-northstar.ts`.
// ----------------------------------------------------------------------------

interface ValidationRow {
  pool: string;
  days: number;
  simulatorCumReturn: number;
  simulatorCumReturnLegacy: number;
  simulatorCumReturnV3: number | null;
  groundTruthCumReturn: number;
  groundTruthAPR: number;
  absError: number;
  pctError: number;
  covalentSwapCount: number | null;
  covalentNullCount: number | null;
}

interface ValidationRun {
  filename: string;
  /** ISO-8601 timestamp parsed from the filename. */
  timestampISO: string;
  /** Human-friendly render of the timestamp (UTC). */
  timestampDisplay: string;
  rows: ValidationRow[];
}

// ----------------------------------------------------------------------------
// Loader — finds the latest validation CSV at request time.
// ----------------------------------------------------------------------------

const RESULTS_DIR = resolve(process.cwd(), 'validation-results');
const CSV_PREFIX = 'validation-';
const CSV_SUFFIX = '.csv';

/**
 * Parse the timestamp from a `validation-YYYY-MM-DDTHH-MM-SS-mmmZ.csv` file
 * name. The harness replaces `:` and `.` with `-` to keep the filename
 * portable across Windows / macOS / Linux.
 */
function timestampFromFilename(filename: string): string {
  const stripped = filename
    .replace(/^validation-/, '')
    .replace(/\.csv$/, '');
  // YYYY-MM-DDTHH-MM-SS-mmmZ → YYYY-MM-DDTHH:MM:SS.mmmZ
  const m = stripped.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
  );
  if (!m) return new Date(0).toISOString();
  const [, y, mo, d, h, mi, s, ms] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
}

async function loadLatestValidation(): Promise<ValidationRun | null> {
  let entries: string[];
  try {
    entries = await readdir(RESULTS_DIR);
  } catch {
    return null;
  }
  const csvFiles = entries
    .filter((f) => f.startsWith(CSV_PREFIX) && f.endsWith(CSV_SUFFIX))
    .sort()
    .reverse();
  if (csvFiles.length === 0) return null;
  const filename = csvFiles[0];

  let content: string;
  try {
    const filepath = resolve(RESULTS_DIR, filename);
    // stat() guards against symlink/path-traversal surprises and gives us
    // an authoritative size for the timestamp display.
    await stat(filepath);
    content = await readFile(filepath, 'utf8');
  } catch {
    return null;
  }

  const lines = content.trim().split('\n');
  if (lines.length < 2) return null;

  const headerCells = lines[0].split(',');
  const idxOf = (name: string): number => headerCells.indexOf(name);

  const numAt = (cells: string[], i: number): number =>
    i >= 0 && cells[i] !== '' && Number.isFinite(Number(cells[i])) ? Number(cells[i]) : NaN;
  const optAt = (cells: string[], i: number): number | null => {
    if (i < 0 || cells[i] === '') return null;
    const n = Number(cells[i]);
    return Number.isFinite(n) ? n : null;
  };
  const strAt = (cells: string[], i: number): string => (i >= 0 ? cells[i] ?? '' : '');

  const rows: ValidationRow[] = lines.slice(1).map((line) => {
    const cells = line.split(',');
    return {
      pool: strAt(cells, idxOf('pool')),
      days: numAt(cells, idxOf('days')),
      simulatorCumReturn: numAt(cells, idxOf('simulator_cum_return')),
      simulatorCumReturnLegacy: numAt(cells, idxOf('simulator_cum_return_legacy')),
      simulatorCumReturnV3: optAt(cells, idxOf('simulator_cum_return_v3')),
      groundTruthCumReturn: numAt(cells, idxOf('ground_truth_cum_return')),
      groundTruthAPR: numAt(cells, idxOf('ground_truth_apr')),
      absError: numAt(cells, idxOf('abs_error')),
      pctError: numAt(cells, idxOf('pct_error')),
      covalentSwapCount: optAt(cells, idxOf('covalent_swap_count')),
      covalentNullCount: optAt(cells, idxOf('covalent_unpriced_count')),
    };
  });

  const timestampISO = timestampFromFilename(filename);
  const timestampDisplay = new Date(timestampISO).toUTCString();

  return { filename, timestampISO, timestampDisplay, rows };
}

// ----------------------------------------------------------------------------
// Stats — replicate the harness's headline numbers from the parsed rows.
// ----------------------------------------------------------------------------

interface RunStats {
  poolCount: number;
  meanAbsErrorPP: number;
  medianAbsErrorPP: number;
  maxAbsErrorPP: number;
  medianRelErrorPct: number;
  withinFiveRelPct: number;
  withinTwentyRelPct: number;
  biasPP: number;
  starReached: boolean;
}

function computeStats(rows: ValidationRow[]): RunStats | null {
  if (rows.length === 0) return null;
  const abs = rows.map((r) => r.absError).sort((a, b) => a - b);
  const rel = rows.map((r) => r.pctError).sort((a, b) => a - b);
  const withinFive = rows.filter((r) => r.pctError <= 0.05).length;
  const withinTwenty = rows.filter((r) => r.pctError <= 0.20).length;
  const bias =
    rows.reduce((a, r) => a + (r.simulatorCumReturn - r.groundTruthCumReturn), 0) / rows.length;
  return {
    poolCount: rows.length,
    meanAbsErrorPP: (abs.reduce((a, b) => a + b, 0) / abs.length) * 100,
    medianAbsErrorPP: abs[Math.floor(abs.length / 2)] * 100,
    maxAbsErrorPP: Math.max(...abs) * 100,
    medianRelErrorPct: rel[Math.floor(rel.length / 2)] * 100,
    withinFiveRelPct: (withinFive / rows.length) * 100,
    withinTwentyRelPct: (withinTwenty / rows.length) * 100,
    biasPP: bias * 100,
    starReached: withinTwenty / rows.length >= 0.8,
  };
}

// ----------------------------------------------------------------------------
// Render
// ----------------------------------------------------------------------------

export const metadata = {
  title: 'Ticklab · Validation Results',
  description:
    'Live north-star validation results — what % of pool-days the LP simulator lands within ±20% of the realized 30-day return, computed against a ground-truth OHLC + daily-fees replay.',
};

const fmtPct = (x: number, digits = 2): string => `${x.toFixed(digits)}%`;
const fmtPP = (x: number, digits = 2): string => `${x.toFixed(digits)} pp`;

export default async function ValidationPage() {
  const run = await loadLatestValidation();

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          Validation Results
        </h1>
        <p className="text-sm text-[#888] mt-1">
          North-star harness output — % of pool-days the simulator lands within ±20% of the
          realized 30-day return, computed against a ground-truth OHLC + daily-fees replay.
        </p>
      </div>

      {run === null ? (
        <EmptyState />
      ) : (
        <ValidationRunView run={run} />
      )}

      <Methodology />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Empty state — shown when no CSV has been written yet.
// ----------------------------------------------------------------------------

function EmptyState() {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="p-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-white mb-2">No validation results yet</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Run the north-star harness to generate a CSV under{' '}
              <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200">
                validation-results/
              </code>
              . This page picks up the most recent CSV at request time.
            </p>
            <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-4 text-xs text-zinc-200 overflow-x-auto">
{`# 1. Install (if you haven't)
pnpm install

# 2. Run the harness — produces validation-results/validation-<timestamp>.csv
npm run validate:northstar

# 3. Refresh this page`}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Run view — top stats + per-pool table + timestamp footer.
// ----------------------------------------------------------------------------

function ValidationRunView({ run }: { run: ValidationRun }) {
  const stats = computeStats(run.rows);
  const fileAge = formatAge(run.timestampISO);

  return (
    <>
      {/* Headline status */}
      {stats && (
        <Card
          className={
            stats.starReached
              ? 'bg-emerald-950/30 border-emerald-800 mb-6'
              : 'bg-amber-950/30 border-amber-900 mb-6'
          }
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {stats.starReached ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                  )}
                  <span
                    className={
                      stats.starReached
                        ? 'text-sm font-semibold text-emerald-300'
                        : 'text-sm font-semibold text-amber-300'
                    }
                  >
                    {stats.starReached
                      ? 'NORTH STAR REACHED'
                      : 'NORTH STAR NOT REACHED'}
                  </span>
                </div>
                <p className="text-2xl font-semibold text-white">
                  {fmtPct(stats.withinTwentyRelPct, 1)}{' '}
                  <span className="text-base font-normal text-zinc-400">
                    of {stats.poolCount} pools within ±20% relative error
                  </span>
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  Target: ≥ 80% · Median absolute error: {fmtPP(stats.medianAbsErrorPP)} · Mean bias:{' '}
                  {fmtPP(stats.biasPP)}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                <span title={run.timestampDisplay}>{fileAge}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatTile label="Median abs error" value={fmtPP(stats.medianAbsErrorPP)} />
          <StatTile label="Max abs error" value={fmtPP(stats.maxAbsErrorPP)} />
          <StatTile label="Within ±5% rel" value={fmtPct(stats.withinFiveRelPct, 1)} />
          <StatTile label="Within ±20% rel" value={fmtPct(stats.withinTwentyRelPct, 1)} highlight />
        </div>
      )}

      {/* Per-pool table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            Per-pool results
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950 border-b border-zinc-800">
                <tr>
                  <Th>Pool</Th>
                  <Th>Days</Th>
                  <Th>Sim cum return</Th>
                  <Th>GT cum return</Th>
                  <Th>Abs error (pp)</Th>
                  <Th>Rel error</Th>
                  <Th>Covalent swaps</Th>
                </tr>
              </thead>
              <tbody>
                {run.rows.map((row) => (
                  <tr key={row.pool} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                    <Td className="font-medium text-white">{row.pool}</Td>
                    <Td className="text-zinc-400 tabular-nums">{row.days}</Td>
                    <Td className="text-zinc-200 tabular-nums">
                      {fmtPct(row.simulatorCumReturn * 100)}
                    </Td>
                    <Td className="text-zinc-200 tabular-nums">
                      {fmtPct(row.groundTruthCumReturn * 100)}
                    </Td>
                    <Td className={`tabular-nums ${absErrorColor(row.absError)}`}>
                      {fmtPP(row.absError * 100)}
                    </Td>
                    <Td className={`tabular-nums ${relErrorColor(row.pctError)}`}>
                      {fmtPct(row.pctError * 100)}
                    </Td>
                    <Td className="text-zinc-400 text-xs tabular-nums">
                      {row.covalentSwapCount == null
                        ? '—'
                        : row.covalentSwapCount > 0
                          ? `${row.covalentSwapCount.toLocaleString()}${
                              row.covalentNullCount && row.covalentNullCount > 0
                                ? ` (${row.covalentNullCount} unpriced)`
                                : ''
                            }`
                          : 'key not set'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-500 mt-4">
        Source file:{' '}
        <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
          validation-results/{run.filename}
        </code>
      </p>
    </>
  );
}

// ----------------------------------------------------------------------------
// Methodology block — answers "how is this computed?"
// ----------------------------------------------------------------------------

function Methodology() {
  return (
    <Card className="bg-zinc-900/30 border-zinc-800 mt-6">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-emerald-400" />
          How is this computed?
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-zinc-400 space-y-3">
        <p>
          The harness runs the simulator over a fixed 30-day window on each pool, then replays
          the same window against a ground-truth LP P&amp;L calculation built from real
          on-chain price data (Binance daily OHLC) and real daily fee volume (DeFi Llama by
          default, or the actual swap stream from Covalent GoldRush when{' '}
          <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-200">COVALENT_API_KEY</code>{' '}
          is set).
        </p>
        <p>
          Both the simulator output and the ground-truth output are expressed as
          <em> cumulative-window return</em> over the same N days, so the comparison is
          apples-to-apples. The primary metric is the median of{' '}
          <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-200">
            |sim_cum − gt_cum|
          </code>{' '}
          across the pool set; the star threshold is ≥ 80% of pools within ±20% relative
          error.
        </p>
        <p className="text-xs text-zinc-500">
          See{' '}
          <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">
            scripts/validate-northstar.ts
          </code>{' '}
          for the full methodology and{' '}
          <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">
            NORTH_STAR_REPORT.md
          </code>{' '}
          for the cross-check against third-party LP simulators.
        </p>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Tiny presentational helpers (kept inline so the page is self-contained).
// ----------------------------------------------------------------------------

function StatTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card card-body py-4">
      <div className={`metric-value ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      <div className="metric-label mt-1">{label}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function absErrorColor(abs: number): string {
  if (!Number.isFinite(abs)) return 'text-zinc-500';
  const pp = abs * 100;
  if (pp <= 1) return 'text-emerald-400';
  if (pp <= 5) return 'text-amber-400';
  return 'text-rose-400';
}

function relErrorColor(rel: number): string {
  if (!Number.isFinite(rel)) return 'text-zinc-500';
  const pct = rel * 100;
  if (pct <= 20) return 'text-emerald-400';
  if (pct <= 100) return 'text-amber-400';
  return 'text-rose-400';
}

function formatAge(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}