/**
 * Export Module
 * 
 * Handles exporting strategy data, simulations, and backtests to various formats.
 * Supports CSV, JSON, and PDF report generation.
 */

import { SavedStrategy, Simulation, Backtest } from './store';

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'csv' | 'json' | 'pdf';

export interface ExportOptions {
  filename?: string;
  includeSimulation?: boolean;
  includeBacktest?: boolean;
  dateFormat?: string;
}

export interface CSVRow {
  [key: string]: string | number | boolean | null;
}

// ============================================================================
// CSV Export
// ============================================================================

/**
 * Convert data to CSV format
 * 
 * @param data - Array of objects to convert
 * @returns CSV string
 */
export function toCSV(data: CSVRow[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  
  // Escape special characters in values
  const escapeValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    // Escape quotes and wrap in quotes if contains special chars
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => escapeValue(row[h])).join(',')
    ),
  ];

  return rows.join('\n');
}

/**
 * Download data as CSV file
 * 
 * @param data - Data to export
 * @param filename - Output filename
 */
export function downloadCSV(data: CSVRow[], filename: string): void {
  if (typeof window === 'undefined') {
    throw new Error('downloadCSV must be called in browser context');
  }

  const csv = toCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
}

/**
 * Export strategy to CSV
 * 
 * @param strategy - Strategy to export
 * @param options - Export options
 */
export function exportStrategyToCSV(
  strategy: SavedStrategy,
  options: ExportOptions = {}
): void {
  const filename = options.filename || `strategy_${strategy.id}`;
  
  const data: CSVRow[] = [
    {
      'Strategy ID': strategy.id,
      'Name': strategy.name,
      'Created At': new Date(strategy.createdAt).toISOString(),
      'Chain ID': strategy.pool.chainId,
      'Pool Address': strategy.pool.address,
      'Token 0': strategy.pool.token0.symbol,
      'Token 1': strategy.pool.token1.symbol,
      'Fee Tier': `${(strategy.pool.fee / 10000).toFixed(2)}%`,
      'Deposit Amount': strategy.depositAmount,
      'Deposit Token': strategy.depositToken,
      'Lower Tick': strategy.lowerTick,
      'Upper Tick': strategy.upperTick,
      'Price Range Min': strategy.pool.token0.decimals !== strategy.pool.token1.decimals
        ? (1.0001 ** strategy.lowerTick * 10 ** (strategy.pool.token1.decimals - strategy.pool.token0.decimals)).toFixed(6)
        : (1.0001 ** strategy.lowerTick).toFixed(6),
      'Price Range Max': strategy.pool.token0.decimals !== strategy.pool.token1.decimals
        ? (1.0001 ** strategy.upperTick * 10 ** (strategy.pool.token1.decimals - strategy.pool.token0.decimals)).toFixed(6)
        : (1.0001 ** strategy.upperTick).toFixed(6),
      'Horizon (Days)': strategy.horizonDays,
      'Rebalance Mode': strategy.rebalanceMode,
      'Gas Cost (Gwei)': strategy.gasCostGwei,
    },
  ];

  downloadCSV(data, filename);
}

/**
 * Export simulation results to CSV
 * 
 * @param simulation - Simulation to export
 * @param options - Export options
 */
export function exportSimulationToCSV(
  simulation: Simulation,
  options: ExportOptions = {}
): void {
  const filename = options.filename || `simulation_${simulation.id}`;
  
  // Export daily data
  const data: CSVRow[] = simulation.results.dailyData.map((day, index) => ({
    'Day': index + 1,
    'Date': day.date,
    'Price': day.price.toFixed(6),
    'Daily Fees': day.fees,
    'Daily IL': day.il,
    'Cumulative Fees': simulation.results.dailyData
      .slice(0, index + 1)
      .reduce((sum, d) => sum + parseFloat(d.fees), 0)
      .toFixed(6),
  }));

  // Add summary row
  data.push({
    'Day': 'SUMMARY',
    'Date': '',
    'Price': '',
    'Daily Fees': simulation.results.estimatedFees,
    'Daily IL': simulation.results.estimatedIL,
    'Cumulative Fees': simulation.results.totalReturn,
  });

  downloadCSV(data, filename);
}

/**
 * Export backtest results to CSV
 * 
 * @param backtest - Backtest to export
 * @param options - Export options
 */
export function exportBacktestToCSV(
  backtest: Backtest,
  options: ExportOptions = {}
): void {
  const filename = options.filename || `backtest_${backtest.id}`;
  
  // Export daily data
  const data: CSVRow[] = backtest.results.dailyData.map((day, index) => ({
    'Day': index + 1,
    'Date': day.date,
    'Price': day.price.toFixed(6),
    'Daily Fees': day.fees,
    'Daily IL': day.il,
    'Position Value': day.positionValue,
  }));

  // Add summary rows
  data.push(
    {},
    {
      'Day': 'METRICS',
      'Date': '',
      'Price': '',
      'Daily Fees': '',
      'Daily IL': '',
      'Position Value': '',
    },
    {
      'Day': 'Total Fees',
      'Date': backtest.results.totalFees,
      'Price': '',
      'Daily Fees': '',
      'Daily IL': '',
      'Position Value': '',
    },
    {
      'Day': 'Total IL',
      'Date': backtest.results.totalIL,
      'Price': '',
      'Daily Fees': '',
      'Daily IL': '',
      'Position Value': '',
    },
    {
      'Day': 'Net Return',
      'Date': backtest.results.netReturn,
      'Price': '',
      'Daily Fees': '',
      'Daily IL': '',
      'Position Value': '',
    },
    {
      'Day': 'APR',
      'Date': `${backtest.results.apr.toFixed(2)}%`,
      'Price': '',
      'Daily Fees': '',
      'Daily IL': '',
      'Position Value': '',
    },
    {
      'Day': 'Max Drawdown',
      'Date': `${backtest.results.maxDrawdown.toFixed(2)}%`,
      'Price': '',
      'Daily Fees': '',
      'Daily IL': '',
      'Position Value': '',
    },
    {
      'Day': 'Sharpe Ratio',
      'Date': backtest.results.sharpeRatio.toFixed(4),
      'Price': '',
      'Daily Fees': '',
      'Daily IL': '',
      'Position Value': '',
    }
  );

  downloadCSV(data, filename);
}

// ============================================================================
// JSON Export
// ============================================================================

/**
 * Export data as JSON file
 * 
 * @param data - Data to export
 * @param filename - Output filename
 * @param pretty - Whether to pretty-print JSON
 */
export function downloadJSON(
  data: unknown,
  filename: string,
  pretty: boolean = true
): void {
  if (typeof window === 'undefined') {
    throw new Error('downloadJSON must be called in browser context');
  }

  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
}

/**
 * Export complete strategy package (strategy + simulation + backtest)
 * 
 * @param strategy - Strategy to export
 * @param options - Export options
 */
export function exportStrategyPackage(
  strategy: SavedStrategy,
  options: ExportOptions = {}
): void {
  const filename = options.filename || `strategy_package_${strategy.id}`;
  
  const packageData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    strategy: {
      id: strategy.id,
      name: strategy.name,
      createdAt: strategy.createdAt,
      pool: strategy.pool,
      depositAmount: strategy.depositAmount,
      depositToken: strategy.depositToken,
      lowerTick: strategy.lowerTick,
      upperTick: strategy.upperTick,
      horizonDays: strategy.horizonDays,
      rebalanceMode: strategy.rebalanceMode,
      gasCostGwei: strategy.gasCostGwei,
    },
    simulation: options.includeSimulation !== false ? strategy.simulation : undefined,
    backtest: options.includeBacktest !== false ? strategy.backtest : undefined,
  };

  downloadJSON(packageData, filename);
}

// ============================================================================
// PDF Report Generation
// ============================================================================

export interface PDFReportData {
  strategy: SavedStrategy;
  simulation?: Simulation;
  backtest?: Backtest;
  generatedAt: string;
}

/**
 * Generate PDF report data structure
 * Note: Actual PDF generation requires a library like jsPDF or puppeteer
 * 
 * @param strategy - Strategy for the report
 * @param simulation - Optional simulation data
 * @param backtest - Optional backtest data
 * @returns Report data structure
 */
export function generatePDFReportData(
  strategy: SavedStrategy,
  simulation?: Simulation,
  backtest?: Backtest
): PDFReportData {
  return {
    strategy,
    simulation,
    backtest,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate HTML content for PDF report
 * This can be used with html2pdf or similar libraries
 * 
 * @param data - Report data
 * @returns HTML string
 */
export function generateReportHTML(data: PDFReportData): string {
  const { strategy, simulation, backtest } = data;
  
  const priceRangeMin = strategy.pool.token0.decimals !== strategy.pool.token1.decimals
    ? (1.0001 ** strategy.lowerTick * 10 ** (strategy.pool.token1.decimals - strategy.pool.token0.decimals)).toFixed(6)
    : (1.0001 ** strategy.lowerTick).toFixed(6);
    
  const priceRangeMax = strategy.pool.token0.decimals !== strategy.pool.token1.decimals
    ? (1.0001 ** strategy.upperTick * 10 ** (strategy.pool.token1.decimals - strategy.pool.token0.decimals)).toFixed(6)
    : (1.0001 ** strategy.upperTick).toFixed(6);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>UniV3 Strategy Report - ${strategy.name || 'Untitled'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #7C3AED; border-bottom: 2px solid #7C3AED; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 24px; font-weight: bold; color: #7C3AED; }
    .metric-label { font-size: 12px; color: #666; }
    .positive { color: #10B981; }
    .negative { color: #EF4444; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>UniV3 LP Strategy Report</h1>
  
  <h2>Strategy Overview</h2>
  <table>
    <tr><th>Property</th><th>Value</th></tr>
    <tr><td>Name</td><td>${strategy.name || 'Untitled'}</td></tr>
    <tr><td>Pool</td><td>${strategy.pool.token0.symbol}/${strategy.pool.token1.symbol} (${(strategy.pool.fee / 10000).toFixed(2)}%)</td></tr>
    <tr><td>Deposit Amount</td><td>${strategy.depositAmount} ${strategy.depositToken}</td></tr>
    <tr><td>Price Range</td><td>${priceRangeMin} - ${priceRangeMax}</td></tr>
    <tr><td>Horizon</td><td>${strategy.horizonDays} days</td></tr>
    <tr><td>Rebalance Mode</td><td>${strategy.rebalanceMode}</td></tr>
  </table>

  ${simulation ? `
  <h2>Simulation Results</h2>
  <div class="metrics">
    <div class="metric">
      <div class="metric-value ${parseFloat(simulation.results.totalReturn) >= 0 ? 'positive' : 'negative'}">${parseFloat(simulation.results.totalReturn) >= 0 ? '+' : ''}${simulation.results.totalReturn}</div>
      <div class="metric-label">Total Return</div>
    </div>
    <div class="metric">
      <div class="metric-value">${simulation.results.apr.toFixed(2)}%</div>
      <div class="metric-label">Estimated APR</div>
    </div>
    <div class="metric">
      <div class="metric-value">${simulation.results.estimatedFees}</div>
      <div class="metric-label">Est. Fees</div>
    </div>
  </div>
  ` : ''}

  ${backtest ? `
  <h2>Backtest Results</h2>
  <div class="metrics">
    <div class="metric">
      <div class="metric-value ${parseFloat(backtest.results.netReturn) >= 0 ? 'positive' : 'negative'}">${parseFloat(backtest.results.netReturn) >= 0 ? '+' : ''}${backtest.results.netReturn}</div>
      <div class="metric-label">Net Return</div>
    </div>
    <div class="metric">
      <div class="metric-value">${backtest.results.apr.toFixed(2)}%</div>
      <div class="metric-label">APR</div>
    </div>
    <div class="metric">
      <div class="metric-value">${backtest.results.sharpeRatio.toFixed(2)}</div>
      <div class="metric-label">Sharpe Ratio</div>
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by UniV3 LP Strategy Lab on ${new Date(data.generatedAt).toLocaleString()}</p>
    <p>Disclaimer: This report is for informational purposes only and does not constitute financial advice.</p>
  </div>
</body>
</html>
  `;
}

// ============================================================================
// Batch Export
// ============================================================================

/**
 * Export multiple strategies
 * 
 * @param strategies - Array of strategies to export
 * @param format - Export format
 * @param options - Export options
 */
export function exportMultipleStrategies(
  strategies: SavedStrategy[],
  format: ExportFormat = 'json',
  options: ExportOptions = {}
): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = options.filename || `strategies_export_${timestamp}`;

  switch (format) {
    case 'csv':
      const csvData: CSVRow[] = strategies.map((s) => ({
        ID: s.id,
        Name: s.name,
        'Created At': new Date(s.createdAt).toISOString(),
        Chain: s.pool.chainId,
        Pool: `${s.pool.token0.symbol}/${s.pool.token1.symbol}`,
        'Fee Tier': `${(s.pool.fee / 10000).toFixed(2)}%`,
        'Deposit Amount': s.depositAmount,
        'Lower Tick': s.lowerTick,
        'Upper Tick': s.upperTick,
        Horizon: s.horizonDays,
        Rebalance: s.rebalanceMode,
      }));
      downloadCSV(csvData, filename);
      break;

    case 'json':
      downloadJSON(
        {
          exportedAt: new Date().toISOString(),
          count: strategies.length,
          strategies: strategies.map((s) => ({
            id: s.id,
            name: s.name,
            createdAt: s.createdAt,
            pool: s.pool,
            params: {
              depositAmount: s.depositAmount,
              depositToken: s.depositToken,
              lowerTick: s.lowerTick,
              upperTick: s.upperTick,
              horizonDays: s.horizonDays,
              rebalanceMode: s.rebalanceMode,
              gasCostGwei: s.gasCostGwei,
            },
          })),
        },
        filename
      );
      break;

    case 'pdf':
      // PDF export would require additional library
      console.warn('PDF export for multiple strategies requires jsPDF or similar library');
      break;

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// ============================================================================
// Clipboard Export
// ============================================================================

/**
 * Copy strategy data to clipboard as formatted text
 * 
 * @param strategy - Strategy to copy
 */
export async function copyStrategyToClipboard(strategy: SavedStrategy): Promise<void> {
  const text = `
UniV3 LP Strategy: ${strategy.name || 'Untitled'}
Pool: ${strategy.pool.token0.symbol}/${strategy.pool.token1.symbol} (${(strategy.pool.fee / 10000).toFixed(2)}%)
Deposit: ${strategy.depositAmount} ${strategy.depositToken}
Range: Ticks ${strategy.lowerTick} to ${strategy.upperTick}
Horizon: ${strategy.horizonDays} days
Rebalance: ${strategy.rebalanceMode}
  `.trim();

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Failed to copy strategy to clipboard');
  }
}

// ============================================================================
// Backtest CSV Export
// ============================================================================

import type { BacktestResult } from './backtest'

export function exportBacktestToCSV(result: BacktestResult): string {
  const headers = [
    'Date',
    'Price',
    'LP Value',
    'HODL Value',
    'Fees Cumulative',
    'IL Cumulative',
    'Net Return %',
    'In Range',
    'Rebalanced'
  ]

  const rows = result.dailyData.map(d => [
    new Date(d.date).toISOString().split('T')[0],
    d.price.toFixed(6),
    d.lpValue.toFixed(2),
    d.hodlValue.toFixed(2),
    d.feesCumulative.toFixed(2),
    d.ilCumulative.toFixed(2),
    d.netReturn.toFixed(2),
    d.inRange ? 'Yes' : 'No',
    d.rebalanced ? 'Yes' : 'No'
  ])

  // Summary rows
  const summaryRows = [
    [],
    ['Summary'],
    ['Total Fees', result.totalFees.toFixed(2)],
    ['Total IL', result.totalIL.toFixed(2)],
    ['Net Return', result.netReturn.toFixed(2) + '%'],
    ['HODL Return', result.hodlReturn.toFixed(2) + '%'],
    ['Time In Range', (result.timeInRangePercent * 100).toFixed(1) + '%'],
    ['Rebalances', result.rebalanceCount.toString()],
  ]

  return [
    headers.join(','),
    ...rows.map(r => r.join(',')),
    ...summaryRows.map(r => r.join(','))
  ].join('\n')
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
