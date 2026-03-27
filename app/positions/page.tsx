import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Positions | UniV3 LP Strategy Lab',
  description: 'Monitor and manage your live Uniswap V3 LP positions in real-time.',
};

// Mock positions data
const positions = [
  {
    id: '1',
    pool: { token0: 'WETH', token1: 'USDC', fee: 0.05 },
    range: { lower: 3100, upper: 3800, current: 3457 },
    status: 'in-range',
    value: 12500,
    unclaimedFees: 245,
    pnl: 850,
    pnlPercent: 7.3,
    distanceToLower: 10.3,
    distanceToUpper: 9.9,
  },
  {
    id: '2',
    pool: { token0: 'WBTC', token1: 'WETH', fee: 0.3 },
    range: { lower: 14.5, upper: 16.2, current: 16.8 },
    status: 'out-of-range',
    value: 8200,
    unclaimedFees: 120,
    pnl: -180,
    pnlPercent: -2.1,
    distanceToLower: -15.9,
    distanceToUpper: 3.7,
  },
  {
    id: '3',
    pool: { token0: 'LINK', token1: 'WETH', fee: 0.3 },
    range: { lower: 0.0025, upper: 0.0032, current: 0.0029 },
    status: 'near-boundary',
    value: 5400,
    unclaimedFees: 85,
    pnl: 320,
    pnlPercent: 6.3,
    distanceToLower: 13.8,
    distanceToUpper: 10.3,
  },
];

// Mock alerts configuration
const alerts = [
  { id: '1', type: 'price-lower', enabled: true, threshold: 5 },
  { id: '2', type: 'price-upper', enabled: true, threshold: 5 },
  { id: '3', type: 'out-of-range', enabled: true },
  { id: '4', type: 'il-threshold', enabled: false, threshold: 10 },
  { id: '5', type: 'fee-target', enabled: true, threshold: 500 },
];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export default function PositionsPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Live Positions</h1>
            <p className="text-[var(--muted-foreground)]">
              Monitor and manage your active LP positions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-primary">{positions.length} Active</span>
            <button className="btn-primary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Import Position
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="pool-card mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--secondary)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold">Wallet Not Connected</div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  Connect your wallet to view and manage your positions
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select className="input-field w-auto">
                <option>Ethereum</option>
                <option>Arbitrum</option>
                <option>Base</option>
                <option>Optimism</option>
              </select>
              <button className="btn-primary">Connect Wallet</button>
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">Total Value</div>
            <div className="text-2xl font-bold">$26,100</div>
            <div className="text-xs text-emerald-400">+3 positions</div>
          </div>
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">Unclaimed Fees</div>
            <div className="text-2xl font-bold text-emerald-400">$450</div>
            <div className="text-xs text-[var(--muted-foreground)]">Across all positions</div>
          </div>
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">Total P&L</div>
            <div className="text-2xl font-bold text-emerald-400">+$990</div>
            <div className="text-xs text-emerald-400">+3.9%</div>
          </div>
          <div className="pool-card text-center">
            <div className="text-sm text-[var(--muted-foreground)] mb-1">In Range</div>
            <div className="text-2xl font-bold text-emerald-400">2/3</div>
            <div className="text-xs text-[var(--muted-foreground)]">Positions active</div>
          </div>
        </div>

        {/* Positions List */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-6">Your Positions</h2>
          <div className="space-y-4">
            {positions.map((position) => (
              <div key={position.id} className="pool-card card-hover">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Pool Info */}
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm border-2 border-[var(--card)]">
                        {position.pool.token0[0]}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-sm border-2 border-[var(--card)]">
                        {position.pool.token1[0]}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">
                        {position.pool.token0} / {position.pool.token1}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="badge badge-secondary">{position.pool.fee}% Fee</span>
                        <span className={`badge ${
                          position.status === 'in-range' ? 'badge-primary' :
                          position.status === 'out-of-range' ? 'badge-danger' :
                          'badge-warning'
                        }`}>
                          {position.status === 'in-range' ? 'In Range' :
                           position.status === 'out-of-range' ? 'Out of Range' :
                           'Near Boundary'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Position Stats */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 lg:gap-6">
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Value</div>
                      <div className="font-semibold">{formatCurrency(position.value)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Fees</div>
                      <div className="font-semibold text-emerald-400">+{formatCurrency(position.unclaimedFees)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">P&L</div>
                      <div className={`font-semibold ${position.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercent(position.pnlPercent)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Range</div>
                      <div className="font-semibold text-xs">{position.range.lower.toLocaleString()} - {position.range.upper.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">To Lower</div>
                      <div className={`font-semibold ${position.distanceToLower < 5 ? 'text-amber-400' : ''}`}>
                        {position.distanceToLower > 0 ? '+' : ''}{position.distanceToLower.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">To Upper</div>
                      <div className={`font-semibold ${position.distanceToUpper < 5 ? 'text-amber-400' : ''}`}>
                        +{position.distanceToUpper.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button className="btn-secondary text-sm py-2 px-3">
                      Details
                    </button>
                    <button className="btn-primary text-sm py-2 px-3">
                      Manage
                    </button>
                  </div>
                </div>

                {/* Range Visual */}
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <div className="relative h-8 bg-[var(--secondary)] rounded-lg overflow-hidden">
                    {/* Range bar */}
                    <div 
                      className="absolute top-1 bottom-1 bg-emerald-500/20 border border-emerald-500/50 rounded"
                      style={{ 
                        left: '20%',
                        right: '20%'
                      }}
                    />
                    {/* Current price marker */}
                    <div 
                      className={`absolute top-0 bottom-0 w-1 ${
                        position.status === 'in-range' ? 'bg-emerald-400' :
                        position.status === 'out-of-range' ? 'bg-red-400' :
                        'bg-amber-400'
                      }`}
                      style={{ 
                        left: position.status === 'out-of-range' ? '85%' : '50%'
                      }}
                    >
                      <div className={`absolute -top-6 -translate-x-1/2 text-xs px-2 py-0.5 rounded ${
                        position.status === 'in-range' ? 'bg-emerald-400 text-[var(--background)]' :
                        position.status === 'out-of-range' ? 'bg-red-400 text-white' :
                        'bg-amber-400 text-[var(--background)]'
                      }`}>
                        ${position.range.current.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-1">
                    <span>${position.range.lower.toLocaleString()}</span>
                    <span>${position.range.upper.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Position Detail Modal (Inline for demo) */}
        <div className="pool-card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg">Position Details: WETH/USDC</h3>
            <span className="badge badge-primary">In Range</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Token Composition */}
            <div>
              <h4 className="text-sm text-[var(--muted-foreground)] mb-3">Token Composition</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                      W
                    </div>
                    <span>WETH</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">1.85</div>
                    <div className="text-xs text-[var(--muted-foreground)]">$6,389</div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">
                      U
                    </div>
                    <span>USDC</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">5,866</div>
                    <div className="text-xs text-[var(--muted-foreground)]">$5,866</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fee Earnings */}
            <div>
              <h4 className="text-sm text-[var(--muted-foreground)] mb-3">Fee Earnings</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                  <span>Unclaimed WETH</span>
                  <span className="text-emerald-400 font-medium">0.035 WETH</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                  <span>Unclaimed USDC</span>
                  <span className="text-emerald-400 font-medium">124.5 USDC</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <span className="font-medium">Total Unclaimed</span>
                  <span className="text-emerald-400 font-bold">$245.00</span>
                </div>
              </div>
            </div>

            {/* Scenario Simulator */}
            <div>
              <h4 className="text-sm text-[var(--muted-foreground)] mb-3">What If Simulator</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">Price moves by</label>
                  <input 
                    type="range" 
                    min="-50" 
                    max="50" 
                    defaultValue="10"
                    className="range-slider mb-2"
                  />
                  <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                    <span>-50%</span>
                    <span className="text-emerald-400 font-medium">+10%</span>
                    <span>+50%</span>
                  </div>
                </div>
                <div className="p-3 bg-[var(--secondary)] rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Projected Value</span>
                    <span className="text-emerald-400 font-bold">$13,420</span>
                  </div>
                  <div className="text-xs text-emerald-400 mt-1">+7.4% vs current</div>
                </div>
              </div>
            </div>
          </div>

          {/* Rebalance Suggestions */}
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <h4 className="font-medium mb-4">Rebalance Suggestions</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="font-medium text-blue-400">Widen Range</span>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Consider widening to ±15% to reduce rebalance frequency
                </p>
              </div>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-emerald-400">Current Range OK</span>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Your position is well-positioned for current volatility
                </p>
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-medium text-amber-400">Claim Fees</span>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  You have $245 in unclaimed fees ready to collect
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Configuration */}
        <div className="pool-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg">Alert Configuration</h3>
            <button className="btn-secondary text-sm">Reset to Default</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: '1', label: 'Price approaching lower bound', desc: 'Alert when within X% of lower price', hasThreshold: true, defaultValue: 5 },
              { id: '2', label: 'Price approaching upper bound', desc: 'Alert when within X% of upper price', hasThreshold: true, defaultValue: 5 },
              { id: '3', label: 'Position out of range', desc: 'Alert when price exits your range', hasThreshold: false },
              { id: '4', label: 'IL threshold exceeded', desc: 'Alert when IL exceeds X%', hasThreshold: true, defaultValue: 10 },
              { id: '5', label: 'Fee capture below target', desc: 'Alert when fees fall below $X/day', hasThreshold: true, defaultValue: 50 },
            ].map((alert) => (
              <div key={alert.id} className="p-4 bg-[var(--secondary)] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{alert.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={alert.id !== '4'} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mb-3">{alert.desc}</p>
                {alert.hasThreshold && (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      defaultValue={alert.defaultValue}
                      className="input-field text-sm py-1 w-20"
                    />
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {alert.id === '5' ? '$/day' : '%'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button className="btn-primary">Save Alert Settings</button>
            <button className="btn-secondary">Test Notifications</button>
          </div>
        </div>
      </div>
    </div>
  );
}
