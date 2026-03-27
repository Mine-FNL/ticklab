import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare Strategies | UniV3 LP Strategy Lab',
  description: 'Compare multiple Uniswap V3 LP strategies side-by-side.',
};

// Mock saved strategies
const savedStrategies = [
  { id: '1', name: 'Conservative WETH/USDC', pool: 'WETH/USDC 0.05%', range: '±5%', created: '2024-01-15' },
  { id: '2', name: 'Aggressive WBTC/WETH', pool: 'WBTC/WETH 0.30%', range: '±15%', created: '2024-01-20' },
  { id: '3', name: 'Balanced LINK/ETH', pool: 'LINK/WETH 0.30%', range: '±10%', created: '2024-01-25' },
];

// Mock comparison data
const comparisonData = {
  strategyA: {
    name: 'Conservative WETH/USDC',
    pool: 'WETH/USDC 0.05%',
    deposit: 10000,
    range: '±5%',
    horizon: '30 days',
    estReturn: { min: 8.5, max: 12.3 },
    timeInRange: 75,
    rebalanceFreq: 'Weekly',
    riskScore: 'Low',
    maxIL: -1.5,
  },
  strategyB: {
    name: 'Aggressive WETH/USDC',
    pool: 'WETH/USDC 0.30%',
    deposit: 10000,
    range: '±25%',
    horizon: '30 days',
    estReturn: { min: 5.2, max: 18.5 },
    timeInRange: 92,
    rebalanceFreq: 'Monthly',
    riskScore: 'High',
    maxIL: -4.2,
  },
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export default function ComparePage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Compare Strategies</h1>
            <p className="text-[var(--muted-foreground)]">
              Side-by-side comparison of LP strategies
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Strategy
            </button>
          </div>
        </div>

        {/* Strategy Selectors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="pool-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <span className="text-blue-400 font-bold">A</span>
              </div>
              <h3 className="font-semibold">Strategy A</h3>
            </div>
            <select className="input-field mb-4">
              <option>Select a strategy...</option>
              {savedStrategies.map((s) => (
                <option key={s.id} value={s.id} selected={s.id === '1'}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="p-4 bg-[var(--secondary)] rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">W</div>
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">U</div>
                </div>
                <div>
                  <div className="font-medium">{comparisonData.strategyA.pool}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">{comparisonData.strategyA.range} range</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pool-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-bold">B</span>
              </div>
              <h3 className="font-semibold">Strategy B</h3>
            </div>
            <select className="input-field mb-4">
              <option>Select a strategy...</option>
              {savedStrategies.map((s) => (
                <option key={s.id} value={s.id} selected={s.id === '2'}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="p-4 bg-[var(--secondary)] rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs">B</div>
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">W</div>
                </div>
                <div>
                  <div className="font-medium">{comparisonData.strategyB.pool}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">{comparisonData.strategyB.range} range</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="pool-card mb-8">
          <h3 className="font-semibold mb-6">Detailed Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-4 text-[var(--muted-foreground)] font-medium">Metric</th>
                  <th className="text-center p-4 text-blue-400 font-medium">Strategy A</th>
                  <th className="text-center p-4 text-emerald-400 font-medium">Strategy B</th>
                  <th className="text-center p-4 text-[var(--muted-foreground)] font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { metric: 'Deposit Amount', a: formatCurrency(comparisonData.strategyA.deposit), b: formatCurrency(comparisonData.strategyB.deposit), diff: '$0', highlight: false },
                  { metric: 'Price Range', a: comparisonData.strategyA.range, b: comparisonData.strategyB.range, diff: '±20%', highlight: true },
                  { metric: 'Time Horizon', a: comparisonData.strategyA.horizon, b: comparisonData.strategyB.horizon, diff: 'Same', highlight: false },
                  { metric: 'Est. Return (Min)', a: `${comparisonData.strategyA.estReturn.min}%`, b: `${comparisonData.strategyB.estReturn.min}%`, diff: `${(comparisonData.strategyA.estReturn.min - comparisonData.strategyB.estReturn.min).toFixed(1)}%`, highlight: true, better: 'a' },
                  { metric: 'Est. Return (Max)', a: `${comparisonData.strategyA.estReturn.max}%`, b: `${comparisonData.strategyB.estReturn.max}%`, diff: `${(comparisonData.strategyB.estReturn.max - comparisonData.strategyA.estReturn.max).toFixed(1)}%`, highlight: true, better: 'b' },
                  { metric: 'Time in Range', a: `${comparisonData.strategyA.timeInRange}%`, b: `${comparisonData.strategyB.timeInRange}%`, diff: `+${comparisonData.strategyB.timeInRange - comparisonData.strategyA.timeInRange}%`, highlight: true, better: 'b' },
                  { metric: 'Rebalance Frequency', a: comparisonData.strategyA.rebalanceFreq, b: comparisonData.strategyB.rebalanceFreq, diff: '-', highlight: false },
                  { metric: 'Risk Score', a: comparisonData.strategyA.riskScore, b: comparisonData.strategyB.riskScore, diff: 'Higher', highlight: true },
                  { metric: 'Max Impermanent Loss', a: formatPercent(comparisonData.strategyA.maxIL), b: formatPercent(comparisonData.strategyB.maxIL), diff: `${(comparisonData.strategyA.maxIL - comparisonData.strategyB.maxIL).toFixed(1)}%`, highlight: true, better: 'a' },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--secondary)]/50">
                    <td className="p-4 font-medium">{row.metric}</td>
                    <td className={`p-4 text-center ${row.better === 'a' ? 'text-blue-400 font-semibold' : ''}`}>{row.a}</td>
                    <td className={`p-4 text-center ${row.better === 'b' ? 'text-emerald-400 font-semibold' : ''}`}>{row.b}</td>
                    <td className={`p-4 text-center ${row.highlight ? 'font-medium' : 'text-[var(--muted-foreground)]'}`}>
                      {row.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comparison Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* LP vs HODL Overlay */}
          <div className="pool-card">
            <h3 className="font-semibold mb-4">LP vs HODL Comparison</h3>
            <div className="h-64 bg-[var(--secondary)] rounded-lg p-4 relative">
              <svg className="w-full h-full" viewBox="0 0 400 200">
                {/* Grid lines */}
                {[0, 50, 100, 150, 200].map((y) => (
                  <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="var(--border)" strokeWidth="1" />
                ))}
                
                {/* Strategy A - Blue */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points="0,140 50,120 100,100 150,90 200,85 250,95 300,110 350,130 400,150"
                />
                
                {/* Strategy B - Emerald */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  points="0,150 50,130 100,110 150,100 200,95 250,80 300,70 350,85 400,100"
                />
                
                {/* Legend */}
                <text x="280" y="30" fill="#3b82f6" fontSize="12">Strategy A</text>
                <text x="280" y="50" fill="#10b981" fontSize="12">Strategy B</text>
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

          {/* Fee Estimates Comparison */}
          <div className="pool-card">
            <h3 className="font-semibold mb-4">Fee Estimates by Scenario</h3>
            <div className="h-64 bg-[var(--secondary)] rounded-lg p-4">
              <div className="flex items-end justify-around h-full gap-4">
                {[
                  { label: 'Low Vol', a: 180, b: 220 },
                  { label: 'Base', a: 350, b: 420 },
                  { label: 'High Vol', a: 520, b: 680 },
                ].map((scenario, i) => (
                  <div key={i} className="flex flex-col items-center flex-1">
                    <div className="flex items-end gap-2 w-full justify-center mb-2">
                      <div 
                        className="w-8 bg-blue-500/70 rounded-t"
                        style={{ height: `${(scenario.a / 800) * 150}px` }}
                      />
                      <div 
                        className="w-8 bg-emerald-500/70 rounded-t"
                        style={{ height: `${(scenario.b / 800) * 150}px` }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium">{scenario.label}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        A: ${scenario.a} / B: ${scenario.b}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500/70 rounded" />
                <span>Strategy A</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-500/70 rounded" />
                <span>Strategy B</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk/Reward Scatter Plot */}
        <div className="pool-card mb-8">
          <h3 className="font-semibold mb-4">Risk vs Reward Analysis</h3>
          <div className="h-80 bg-[var(--secondary)] rounded-lg p-4 relative">
            <svg className="w-full h-full" viewBox="0 0 600 300">
              {/* Grid lines */}
              {[0, 75, 150, 225, 300].map((y) => (
                <line key={y} x1="50" y1={y} x2="600" y2={y} stroke="var(--border)" strokeWidth="1" />
              ))}
              {[50, 162, 275, 387, 500].map((x) => (
                <line key={x} x1={x} y1="0" x2={x} y2="300" stroke="var(--border)" strokeWidth="1" />
              ))}
              
              {/* Axes labels */}
              <text x="300" y="295" textAnchor="middle" fill="var(--muted-foreground)" fontSize="12">Risk (Max IL %)</text>
              <text x="20" y="150" textAnchor="middle" fill="var(--muted-foreground)" fontSize="12" transform="rotate(-90 20 150)">Return %</text>
              
              {/* Strategy A point */}
              <circle cx="200" cy="100" r="10" fill="#3b82f6" stroke="var(--background)" strokeWidth="2" />
              <text x="200" y="80" textAnchor="middle" fill="#3b82f6" fontSize="12">Strategy A</text>
              
              {/* Strategy B point */}
              <circle cx="400" cy="60" r="10" fill="#10b981" stroke="var(--background)" strokeWidth="2" />
              <text x="400" y="40" textAnchor="middle" fill="#10b981" fontSize="12">Strategy B</text>
              
              {/* Efficient frontier curve */}
              <path
                d="M 100 200 Q 250 100 500 50"
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                strokeDasharray="5,5"
                opacity="0.5"
              />
            </svg>
          </div>
          <div className="mt-4 text-sm text-[var(--muted-foreground)]">
            <p>X-axis: Maximum Impermanent Loss (Risk) | Y-axis: Expected Return</p>
            <p className="mt-1">The efficient frontier (dashed line) represents optimal risk/return combinations.</p>
          </div>
        </div>

        {/* Key Insights */}
        <div className="pool-card mb-8">
          <h3 className="font-semibold mb-4">Key Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-blue-400">Strategy A Advantage</span>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                Lower maximum IL (-1.5% vs -4.2%) provides better downside protection in volatile markets.
              </p>
            </div>
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="font-medium text-emerald-400">Strategy B Advantage</span>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                Higher time in range (92% vs 75%) and better upside potential (18.5% max return).
              </p>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium text-amber-400">Considerations</span>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                Strategy B requires more active monitoring due to higher risk profile.
              </p>
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="flex flex-wrap gap-4">
          <button className="btn-primary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF Report
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV Data
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
