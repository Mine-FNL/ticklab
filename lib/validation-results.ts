/**
 * Loader for the most recent north-star validation CSV. Shared between the
 * /validation page and any home-page widget that wants to surface the live
 * numbers (the home page uses this for the "Live Validation" callout).
 *
 * Reads at request time from `validation-results/validation-<ts>.csv`. Safe
 * to call from server components — no I/O happens on the client.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const CSV_PREFIX = 'validation-';
const CSV_SUFFIX = '.csv';

export interface ValidationRow {
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

export interface ValidationRun {
  filename: string;
  /** ISO-8601 timestamp parsed from the filename. */
  timestampISO: string;
  /** Human-friendly render of the timestamp (UTC). */
  timestampDisplay: string;
  rows: ValidationRow[];
}

/**
 * Parse the timestamp from a `validation-YYYY-MM-DDTHH-MM-SS-mmmZ.csv` file
 * name. The harness replaces `:` and `.` with `-` to keep the filename
 * portable across Windows / macOS / Linux.
 */
function timestampFromFilename(filename: string): string {
  const stripped = filename.replace(/^validation-/, '').replace(/\.csv$/, '');
  const m = stripped.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
  );
  if (!m) return new Date(0).toISOString();
  const [, y, mo, d, h, mi, s, ms] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
}

export async function loadLatestValidation(): Promise<ValidationRun | null> {
  // Resolve at call time (not import time) so the loader respects cwd
  // changes and works correctly under test.
  const resultsDir = resolve(process.cwd(), 'validation-results');
  let entries: string[];
  try {
    entries = await readdir(resultsDir);
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
    const filepath = resolve(resultsDir, filename);
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

/**
 * Aggregate stats for a run. Mirrors the numbers the harness prints to
 * stdout so the live widget on the home page can show the same headline.
 */
export interface RunStats {
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

export function computeStats(rows: ValidationRow[]): RunStats | null {
  if (rows.length === 0) return null;
  const abs = rows.map((r) => r.absError).sort((a, b) => a - b);
  const rel = rows.map((r) => r.pctError).sort((a, b) => a - b);
  const within5 = rows.filter((r) => r.pctError <= 0.05).length;
  const within20 = rows.filter((r) => r.pctError <= 0.20).length;
  const bias =
    rows.reduce((a, r) => a + (r.simulatorCumReturn - r.groundTruthCumReturn), 0) /
    rows.length;
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

/**
 * Compact age string ("3m ago", "2h ago", "5d ago") for the live widget.
 */
export function formatAge(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}