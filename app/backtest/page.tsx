import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Historical Backtest | UniV3 LP Strategy Lab',
  description: 'Backtest your Uniswap V3 LP strategy against historical market data.',
};

// Mock backtest results
const backtestResults = {
  totalReturn: 18.5,
  hodlComparison: 15.2,
  totalFees: 2450,
  realizedIL: -320,
  gasCosts: 180,
  netReturn: 1950,
  rebalanceCount: 4,
  timeInRange: 82,
};

// Mock equity curve data points
const equityData = [
  { date: 'Jan 1', lp: 10000, hodl: 10000, fees: 0 },
  { date: 'Jan 8', lp: 10250, hodl: 10200, fees: 120 },
  { date: 'Jan 15', lp: 10400, hodl: 10350, fees: 280 },
  { date: 'Jan 22', lp: 10100, hodl: 10500, fees: 350 },
  { date: 'Jan 29', lp: 10600, hodl: 10400, fees: 520 },
  { date: 'Feb 5', lp: 10850, hodl: 10600, fees: 780 },
  { date: 'Feb 12', lp: 10700, hodl: 10750, fees: 920 },
  { date: 'Feb 19', lp: 11000, hodl: 10800, fees: 1150 },
  { date: 'Feb 26', lp: 11200, hodl: 10950, fees: 1420 },
  { date: 'Mar 5', lp: 11100, hodl: 11100, fees: 1680 },
  { date: 'Mar 12', lp: 11450, hodl: 11200, fees: 1950 },
  { date: 'Mar 19', lp: 11600, hodl: 11350, fees: 2200 },
  { date: 'Mar 26', lp: 11950, hodl: 11500, fees: 2450 },
];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export default function BacktestPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Historical Backtest</h1>
            <p className="text-[var(--muted-foreground)]">
              Test your strategy against real market data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-primary">Backtest Ready</span>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="pool-card mb-8">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="font-semibold text-lg">Backtest Configuration</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Pool Selector */}
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-2">Pool</label>
              <select className="input-field">
                <option>WETH/USDC 0.05%</option>
                <option>WETH/USDC 0.30%</option>
                <option>WBTC/WETH 0.30%</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-2">Date Range</label>
              <select className="input-field">
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option selected>Last 180 days</option>
                <option>Last 365 days</option>
                <option>Custom range</option>
              </select>
            </div>

            {/* Strategy Parameters */}
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-2">Strategy</label>
              <select className="input-field">
                <option>Use current strategy</option>
                <option>Load saved strategy</option>
                <option>Create new</option>
              </select>
            </div>

            {/* Gas Cost */}
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-2">Gas Cost (Gwei)</label>
              <input type="number" defaultValue="25" className="input-field" />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button className="btn-primary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Backtest
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-6">Backtest Results</h2>
          
          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="pool-card text-center">
              <div className="text-sm text-[var(--muted-foreground)] mb-1">Total Return</div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatPercent(backtestResults.totalReturn)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">${backtestResults.netReturn.toLocaleString()}</div>
            </div>
            <div className="pool-card text-center">
              <div className="text-sm text-[var(--muted-foreground)] mb-1">vs HODL</div>
              <div className="text-2xl font-bold text-emerald-400">
                +{formatPercent(backtestResults.totalReturn - backtestResults.hodlComparison)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Outperformance</div>
            </div>
            <div className="pool-card text-center">
              <div className="text-sm text-[var(--muted-foreground)] mb-1">Total Fees</div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(backtestResults.totalFees)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Earned</div>
            </div>
            <div className="pool-card text-center">
              <div className="text-sm text-[var(--muted-foreground)] mb-1">Rebalances</div>
              <div className="text-2xl font-bold text-blue-400">
                {backtestResults.rebalanceCount}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Triggered</div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="pool-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Realized IL</span>
                <span className="text-red-400 font-medium">{formatCurrency(backtestResults.realizedIL)}</span>
              </div>
            </div>
            <div className="pool-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Gas Costs</span>
                <span className="text-red-400 font-medium">{formatCurrency(backtestResults.gasCosts)}</span>
              </div>
            </div>
            <div className="pool-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Time in Range</span>
                <span className="text-emerald-400 font-medium">{backtestResults.timeInRange}%</span>
              </div>
            </div>
            <div className="pool-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Net P&L</span>
                <span className="text-emerald-400 font-medium">{formatCurrency(backtestResults.netReturn)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Equity Curve Chart */}
        <div className="pool-card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Equity Curve</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[var(--muted-foreground)]">LP Value</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-[var(--muted-foreground)]">HODL Value</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-[var(--muted-foreground)]">Fees</span>
              </div>
            </div>
          </div>
          <div className="h-80 bg-[var(--secondary)] rounded-lg p-4 relative">
            <svg className="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 75, 150, 225, 300].map((y) => (
                <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="var(--border)" strokeWidth="1" />
              ))}
              
              {/* LP Value line */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                points={equityData.map((d, i) => `${(i / (equityData.length - 1)) * 800},${300 - ((d.lp - 9500) / 3000) * 300}`).join(' ')}
              />
              
              {/* HODL Value line */}
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points={equityData.map((d, i) => `${(i / (equityData.length - 1)) * 800},${300 - ((d.hodl - 9500) / 3000) * 300}`).join(' ')}
              />
              
              {/* Rebalance markers */}
              {[3, 6, 9].map((i) => (
                <circle
                  key={i}
                  cx={(i / (equityData.length - 1)) * 800}
                  cy={300 - ((equityData[i].lp - 9500) / 3000) * 300}
                  r="6"
                  fill="#f59e0b"
                  stroke="var(--background)"
                  strokeWidth="2"
                />
              ))}
            </svg>
            
            {/* X-axis labels */}
            <div className="absolute bottom-2 left-4 right-4 flex justify-between text-xs text-[var(--muted-foreground)]">
              {equityData.filter((_, i) => i % 3 === 0).map((d, i) => (
                <span key={i}>{d.date}</span>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Rebalance points
            </span>
          </div>
        </div>

        {/* Drawdown Chart */}
        <div className="pool-card mb-8">
          <h3 className="font-semibold mb-4">Drawdown from Peak</h3>
          <div className="h-48 bg-[var(--secondary)] rounded-lg p-4 relative">
            <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
              {/* Zero line */}
              <line x1="0" y1="20" x2="800" y2="20" stroke="var(--muted-foreground)" strokeWidth="1" />
              
              {/* Drawdown area */}
              <polygon
                fill="rgba(244, 63, 94, 0.2)"
                stroke="#f43f5e"
                strokeWidth="2"
                points="0,20 50,20 100,40 150,60 200,50 250,80 300,100 350,90 400,70 450,60 500,80 550,100 600,90 650,70 700,50 750,40 800,20 800,200 0,200"
              />
            </svg>
            
            <div className="absolute top-2 right-4 text-right">
              <div className="text-sm text-[var(--muted-foreground)]">Max Drawdown</div>
              <div className="text-xl font-bold text-red-400">-8.5%</div>
            </div>
          </div>
        </div>

        {/* Period Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="pool-card">
            <h3 className="font-semibold mb-4">Period Analysis</h3>
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-emerald-400 font-medium">Best Window</span>
                  <span className="text-emerald-400">+12.5%</span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">Feb 5 - Feb 26 (21 days)</div>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-400 font-medium">Worst Window</span>
                  <span className="text-red-400">-3.2%</span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">Jan 22 - Feb 5 (14 days)</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[var(--secondary)] rounded-lg text-center">
                  <div className="text-2xl font-bold text-emerald-400">82%</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Time in Range</div>
                </div>
                <div className="p-3 bg-[var(--secondary)] rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-400">18%</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Time Out of Range</div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Decomposition */}
          <div className="pool-card">
            <h3 className="font-semibold mb-4">Performance Decomposition</h3>
            <div className="space-y-4">
              {[
                { label: 'Fee Income', value: 2450, color: 'bg-emerald-500', percent: 125 },
                { label: 'Impermanent Loss', value: -320, color: 'bg-red-500', percent: -16 },
                { label: 'Gas Costs', value: -180, color: 'bg-orange-500', percent: -9 },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{item.label}</span>
                    <span className={`text-sm font-medium ${item.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {item.value >= 0 ? '+' : ''}{formatCurrency(item.value)}
                    </span>
                  </div>
                  <div className="h-4 bg-[var(--secondary)] rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} transition-all duration-500`}
                      style={{ width: `${Math.abs(item.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t border-[var(--border)] pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Net Return</span>
                  <span className="text-emerald-400 font-bold text-lg">
                    +{formatCurrency(backtestResults.netReturn)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Breakdown Table */}
        <div className="pool-card mb-8">
          <h3 className="font-semibold mb-4">Monthly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Start Value</th>
                  <th>End Value</th>
                  <th>Return</th>
                  <th>Fees</th>
                  <th>Rebalances</th>
                  <th>Time in Range</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { month: 'January', start: 10000, end: 10600, return: 6.0, fees: 520, rebalances: 1, timeInRange: 85 },
                  { month: 'February', start: 10600, end: 11100, return: 4.7, fees: 680, rebalances: 2, timeInRange: 78 },
                  { month: 'March', start: 11100, end: 11950, return: 7.7, fees: 1250, rebalances: 1, timeInRange: 83 },
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="font-medium">{row.month}</td>
                    <td>{formatCurrency(row.start)}</td>
                    <td>{formatCurrency(row.end)}</td>
                    <td className="text-emerald-400">+{row.return}%</td>
                    <td className="text-emerald-400">+{formatCurrency(row.fees)}</td>
                    <td>{row.rebalances}</td>
                    <td>{row.timeInRange}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <button className="btn-primary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Save Backtest
          </button>
          <a href="/compare" className="btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Compare with Another
          </a>
        </div>
      </div>
    </div>
  );
}
