import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Simulation Results | UniV3 LP Strategy Lab',
  description: 'View detailed simulation results for your Uniswap V3 LP strategy.',
};

// Mock results data
const results = {
  lpReturn: { min: 8.5, max: 15.2 },
  hodlReturn: 12.3,
  impermanentLoss: -2.1,
  netExcessReturn: 3.2,
  timeInRange: 85,
};

// Mock scenario data
const scenarioData = [
  { price: 2800, change: -19, lpValue: 9850, hodlValue: 9700, fees: 420, netReturn: 5.7 },
  { price: 3100, change: -10, lpValue: 10200, hodlValue: 10000, fees: 380, netReturn: 5.8 },
  { price: 3457, change: 0, lpValue: 10500, hodlValue: 10000, fees: 350, netReturn: 8.5 },
  { price: 3800, change: 10, lpValue: 10800, hodlValue: 11000, fees: 320, netReturn: 1.1 },
  { price: 4200, change: 22, lpValue: 11200, hodlValue: 12200, fees: 280, netReturn: -5.9 },
];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export default function ResultsPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Simulation Results</h1>
            <p className="text-[var(--muted-foreground)]">
              WETH/USDC 0.05% pool • 30-day horizon • ±10% range
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-primary">Simulation Complete</span>
            <span className="text-sm text-[var(--muted-foreground)]">Generated 2 minutes ago</span>
          </div>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">Est. LP Return</div>
            <div className="text-2xl font-bold text-emerald-400">
              {results.lpReturn.min}% - {results.lpReturn.max}%
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">Annualized</div>
          </div>
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">HODL Return</div>
            <div className="text-2xl font-bold text-blue-400">
              {formatPercent(results.hodlReturn)}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">If price unchanged</div>
          </div>
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">Impermanent Loss</div>
            <div className="text-2xl font-bold text-amber-400">
              {formatPercent(results.impermanentLoss)}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">Max estimated</div>
          </div>
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">Net Excess Return</div>
            <div className="text-2xl font-bold text-emerald-400">
              +{results.netExcessReturn}%
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">vs HODL</div>
          </div>
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">Time in Range</div>
            <div className="text-2xl font-bold text-emerald-400">
              {results.timeInRange}%
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">Estimated</div>
          </div>
        </div>

        {/* Main Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* LP vs HODL Chart */}
          <div className="pool-card">
            <h3 className="font-semibold mb-4">LP vs HODL by Terminal Price</h3>
            <div className="h-64 bg-[var(--secondary)] rounded-lg p-4 relative">
              {/* Chart placeholder */}
              <svg className="w-full h-full" viewBox="0 0 400 200">
                {/* Grid lines */}
                {[0, 50, 100, 150, 200].map((y) => (
                  <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="var(--border)" strokeWidth="1" />
                ))}
                {/* HODL line */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points="0,150 100,120 200,100 300,80 400,50"
                />
                {/* LP line */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  points="0,140 100,110 200,90 300,85 400,70"
                />
                {/* Current price marker */}
                <line x1="200" y1="0" x2="200" y2="200" stroke="#f59e0b" strokeWidth="1" strokeDasharray="5,5" />
                {/* Legend */}
                <text x="320" y="20" fill="#3b82f6" fontSize="12">HODL</text>
                <text x="320" y="40" fill="#10b981" fontSize="12">LP</text>
              </svg>
              <div className="absolute bottom-2 left-4 right-4 flex justify-between text-xs text-[var(--muted-foreground)]">
                <span>$2,800</span>
                <span>$3,100</span>
                <span className="text-amber-400">$3,457</span>
                <span>$3,800</span>
                <span>$4,200</span>
              </div>
            </div>
          </div>

          {/* IL by Price Move */}
          <div className="pool-card">
            <h3 className="font-semibold mb-4">Impermanent Loss by Price Move</h3>
            <div className="h-64 bg-[var(--secondary)] rounded-lg p-4 relative">
              <svg className="w-full h-full" viewBox="0 0 400 200">
                {/* Grid lines */}
                {[0, 50, 100, 150, 200].map((y) => (
                  <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="var(--border)" strokeWidth="1" />
                ))}
                {/* Zero line */}
                <line x1="0" y1="100" x2="400" y2="100" stroke="var(--muted-foreground)" strokeWidth="1" />
                {/* IL bars */}
                <rect x="20" y="120" width="50" height="30" fill="#f43f5e" opacity="0.7" rx="4" />
                <rect x="100" y="110" width="50" height="20" fill="#f43f5e" opacity="0.7" rx="4" />
                <rect x="180" y="100" width="50" height="5" fill="#10b981" opacity="0.7" rx="4" />
                <rect x="260" y="110" width="50" height="20" fill="#f43f5e" opacity="0.7" rx="4" />
                <rect x="340" y="140" width="50" height="50" fill="#f43f5e" opacity="0.7" rx="4" />
              </svg>
              <div className="absolute bottom-2 left-4 right-4 flex justify-between text-xs text-[var(--muted-foreground)]">
                <span>-20%</span>
                <span>-10%</span>
                <span>0%</span>
                <span>+10%</span>
                <span>+20%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fee Estimates Chart */}
        <div className="pool-card mb-8">
          <h3 className="font-semibold mb-4">Fee Estimates by Volume Scenario</h3>
          <div className="h-48 bg-[var(--secondary)] rounded-lg p-4">
            <div className="flex items-end justify-around h-full gap-4">
              {[
                { label: 'Low Vol', min: 150, max: 250, base: 200 },
                { label: 'Base', min: 300, max: 450, base: 375 },
                { label: 'High Vol', min: 500, max: 750, base: 625 },
                { label: 'Custom', min: 400, max: 600, base: 500 },
              ].map((scenario, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div className="relative w-full flex justify-center">
                    {/* Range bar */}
                    <div 
                      className="absolute w-16 bg-emerald-500/20 rounded-lg"
                      style={{ 
                        height: `${(scenario.max - scenario.min) / 5}px`,
                        bottom: `${scenario.min / 5}px`
                      }}
                    />
                    {/* Base marker */}
                    <div 
                      className="absolute w-20 h-1 bg-emerald-400 rounded"
                      style={{ bottom: `${scenario.base / 5}px` }}
                    />
                  </div>
                  <div className="mt-auto text-center">
                    <div className="text-sm font-medium">{scenario.label}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      ${scenario.min}-${scenario.max}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sensitivity Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Heatmap 1 */}
          <div className="pool-card">
            <h3 className="font-semibold mb-4">Net Return by Range Width & Price Move</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-[var(--muted-foreground)]">Range \ Price</th>
                    <th className="p-2 text-[var(--muted-foreground)]">-20%</th>
                    <th className="p-2 text-[var(--muted-foreground)]">-10%</th>
                    <th className="p-2 text-[var(--muted-foreground)]">0%</th>
                    <th className="p-2 text-[var(--muted-foreground)]">+10%</th>
                    <th className="p-2 text-[var(--muted-foreground)]">+20%</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { range: '±5%', values: [-2.1, 2.5, 8.5, 3.2, -4.8] },
                    { range: '±10%', values: [1.2, 4.8, 12.3, 6.5, -1.2] },
                    { range: '±25%', values: [3.5, 6.2, 10.8, 7.8, 2.1] },
                    { range: '±50%', values: [4.8, 7.1, 9.2, 8.1, 4.5] },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="p-2 font-medium">{row.range}</td>
                      {row.values.map((val, j) => (
                        <td key={j} className="p-2">
                          <span className={`px-2 py-1 rounded ${
                            val >= 8 ? 'bg-emerald-500/30 text-emerald-400' :
                            val >= 4 ? 'bg-emerald-500/20 text-emerald-300' :
                            val >= 0 ? 'bg-emerald-500/10 text-emerald-200' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {formatPercent(val)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Heatmap 2 */}
          <div className="pool-card">
            <h3 className="font-semibold mb-4">Net Return by Horizon & Volatility</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-[var(--muted-foreground)]">Horizon \ Vol</th>
                    <th className="p-2 text-[var(--muted-foreground)]">Low</th>
                    <th className="p-2 text-[var(--muted-foreground)]">Med</th>
                    <th className="p-2 text-[var(--muted-foreground)]">High</th>
                    <th className="p-2 text-[var(--muted-foreground)]">Extreme</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { horizon: '7 days', values: [3.2, 5.8, 8.5, 10.2] },
                    { horizon: '30 days', values: [4.5, 8.2, 12.3, 14.8] },
                    { horizon: '90 days', values: [5.8, 10.5, 15.2, 18.5] },
                    { horizon: '365 days', values: [6.2, 12.8, 18.5, 22.1] },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="p-2 font-medium">{row.horizon}</td>
                      {row.values.map((val, j) => (
                        <td key={j} className="p-2">
                          <span className={`px-2 py-1 rounded ${
                            val >= 15 ? 'bg-emerald-500/30 text-emerald-400' :
                            val >= 10 ? 'bg-emerald-500/20 text-emerald-300' :
                            val >= 5 ? 'bg-emerald-500/10 text-emerald-200' :
                            'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                          }`}>
                            {formatPercent(val)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Token Composition */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="pool-card">
            <h3 className="font-semibold mb-4">Ending Token Composition</h3>
            <div className="flex items-center gap-8">
              {/* Pie chart placeholder */}
              <div className="w-32 h-32 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="20" strokeDasharray="125.6 251.2" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="20" strokeDasharray="188.4 251.2" strokeDashoffset="-125.6" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-medium">50/50</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">WETH: 50%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm">USDC: 50%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pool-card">
            <h3 className="font-semibold mb-4">Composition at Different Prices</h3>
            <div className="space-y-3">
              {[
                { price: '$2,800', weth: '35%', usdc: '65%' },
                { price: '$3,457', weth: '50%', usdc: '50%' },
                { price: '$4,200', weth: '65%', usdc: '35%' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-[var(--secondary)] rounded-lg">
                  <span className="text-sm font-medium">{row.price}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-blue-400">{row.weth} WETH</span>
                    <span className="text-emerald-400">{row.usdc} USDC</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scenario Details Table */}
        <div className="pool-card mb-8">
          <h3 className="font-semibold mb-4">Scenario Details</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Terminal Price</th>
                  <th>Price Change</th>
                  <th>LP Value</th>
                  <th>HODL Value</th>
                  <th>Fees Earned</th>
                  <th>Net Return</th>
                  <th>vs HODL</th>
                </tr>
              </thead>
              <tbody>
                {scenarioData.map((row, i) => (
                  <tr key={i}>
                    <td className="font-medium">{formatCurrency(row.price)}</td>
                    <td className={row.change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatPercent(row.change)}
                    </td>
                    <td>{formatCurrency(row.lpValue)}</td>
                    <td>{formatCurrency(row.hodlValue)}</td>
                    <td className="text-emerald-400">+{formatCurrency(row.fees)}</td>
                    <td className={row.netReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatPercent(row.netReturn)}
                    </td>
                    <td className={row.netReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {row.netReturn >= 0 ? '✓' : '✗'} {formatPercent(row.netReturn - row.change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <a href="/strategy" className="btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Back to Strategy
          </a>
          <a href="/backtest" className="btn-primary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Backtest
          </a>
          <button className="btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Report
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Strategy
          </button>
        </div>
      </div>
    </div>
  );
}
