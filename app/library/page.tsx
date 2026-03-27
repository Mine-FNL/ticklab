import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Strategy Library | UniV3 LP Strategy Lab',
  description: 'Manage your saved Uniswap V3 LP strategies.',
};

// Mock saved strategies data
const savedStrategies = [
  {
    id: '1',
    name: 'Conservative WETH/USDC',
    pool: { token0: 'WETH', token1: 'USDC', fee: 0.05 },
    range: '±5%',
    deposit: 10000,
    horizon: '30 days',
    estApr: { min: 8.5, max: 12.3 },
    created: '2024-01-15',
    tags: ['conservative', 'eth-stable'],
    lastRun: '2024-01-20',
  },
  {
    id: '2',
    name: 'Aggressive WBTC/WETH',
    pool: { token0: 'WBTC', token1: 'WETH', fee: 0.3 },
    range: '±15%',
    deposit: 15000,
    horizon: '60 days',
    estApr: { min: 12.2, max: 22.5 },
    created: '2024-01-18',
    tags: ['aggressive', 'crypto-pair'],
    lastRun: '2024-01-22',
  },
  {
    id: '3',
    name: 'Balanced LINK/ETH',
    pool: { token0: 'LINK', token1: 'WETH', fee: 0.3 },
    range: '±10%',
    deposit: 5000,
    horizon: '30 days',
    estApr: { min: 10.5, max: 18.2 },
    created: '2024-01-22',
    tags: ['balanced', 'altcoin'],
    lastRun: '2024-01-25',
  },
  {
    id: '4',
    name: 'Wide Range UNI/ETH',
    pool: { token0: 'UNI', token1: 'WETH', fee: 0.3 },
    range: '±25%',
    deposit: 8000,
    horizon: '90 days',
    estApr: { min: 6.8, max: 15.5 },
    created: '2024-01-25',
    tags: ['wide-range', 'governance'],
    lastRun: '2024-01-28',
  },
  {
    id: '5',
    name: 'Tight USDC/USDT',
    pool: { token0: 'USDC', token1: 'USDT', fee: 0.01 },
    range: '±0.5%',
    deposit: 25000,
    horizon: '30 days',
    estApr: { min: 3.5, max: 6.2 },
    created: '2024-01-28',
    tags: ['stable-pair', 'low-risk'],
    lastRun: '2024-02-01',
  },
  {
    id: '6',
    name: 'Medium ARB/ETH',
    pool: { token0: 'ARB', token1: 'WETH', fee: 0.05 },
    range: '±12%',
    deposit: 12000,
    horizon: '45 days',
    estApr: { min: 14.2, max: 28.5 },
    created: '2024-02-01',
    tags: ['l2', 'medium-risk'],
    lastRun: '2024-02-05',
  },
];

// Available tags
const availableTags = [
  'conservative', 'aggressive', 'balanced', 'wide-range', 'tight-range',
  'eth-stable', 'crypto-pair', 'altcoin', 'stable-pair', 'governance', 'l2',
  'low-risk', 'medium-risk', 'high-risk',
];

// Available chains
const chains = ['All Chains', 'Ethereum', 'Arbitrum', 'Base', 'Optimism', 'Polygon'];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

export default function LibraryPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Strategy Library</h1>
            <p className="text-[var(--muted-foreground)]">
              Manage and organize your saved strategies
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-primary">{savedStrategies.length} Strategies</span>
            <a href="/strategy" className="btn-primary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Strategy
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="pool-card mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-2">Search</label>
              <div className="relative">
                <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Search strategies..."
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Chain Filter */}
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-2">Chain</label>
              <select className="input-field">
                {chains.map((chain) => (
                  <option key={chain} value={chain.toLowerCase().replace(' ', '-')}>
                    {chain}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-2">Created</label>
              <select className="input-field">
                <option>All Time</option>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-2">Sort By</label>
              <select className="input-field">
                <option>Recently Created</option>
                <option>Highest APR</option>
                <option>Largest Deposit</option>
                <option>Last Run</option>
              </select>
            </div>
          </div>

          {/* Tags Filter */}
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <label className="block text-sm text-[var(--muted-foreground)] mb-2">Filter by Tags</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  className="px-3 py-1.5 text-sm rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Strategy Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {savedStrategies.map((strategy) => (
            <div key={strategy.id} className="pool-card card-hover flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{strategy.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <span>Created {strategy.created}</span>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs border-2 border-[var(--card)]">
                    {strategy.pool.token0[0]}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-xs border-2 border-[var(--card)]">
                    {strategy.pool.token1[0]}
                  </div>
                </div>
              </div>

              {/* Pool Info */}
              <div className="flex items-center gap-2 mb-4">
                <span className="badge badge-secondary">{strategy.pool.fee}% Fee</span>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {strategy.pool.token0}/{strategy.pool.token1}
                </span>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-[var(--secondary)] rounded-lg">
                  <div className="text-xs text-[var(--muted-foreground)]">Deposit</div>
                  <div className="font-semibold">{formatCurrency(strategy.deposit)}</div>
                </div>
                <div className="p-3 bg-[var(--secondary)] rounded-lg">
                  <div className="text-xs text-[var(--muted-foreground)]">Range</div>
                  <div className="font-semibold">{strategy.range}</div>
                </div>
                <div className="p-3 bg-[var(--secondary)] rounded-lg">
                  <div className="text-xs text-[var(--muted-foreground)]">Horizon</div>
                  <div className="font-semibold">{strategy.horizon}</div>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="text-xs text-emerald-400">Est. APR</div>
                  <div className="font-semibold text-emerald-400">
                    {strategy.estApr.min}% - {strategy.estApr.max}%
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {strategy.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 rounded bg-[var(--secondary)] text-[var(--muted-foreground)]">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Last Run */}
              <div className="text-xs text-[var(--muted-foreground)] mb-4">
                Last run: {strategy.lastRun}
              </div>

              {/* Actions */}
              <div className="mt-auto pt-4 border-t border-[var(--border)] flex items-center gap-2">
                <a 
                  href={`/strategy?id=${strategy.id}`}
                  className="flex-1 btn-secondary text-sm py-2 text-center"
                >
                  Load
                </a>
                <a 
                  href={`/results?strategy=${strategy.id}`}
                  className="flex-1 btn-primary text-sm py-2 text-center"
                >
                  Run
                </a>
                <button className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--muted)] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-red-500/20 hover:text-red-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bulk Actions */}
        <div className="pool-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-[var(--border)] bg-[var(--secondary)]" />
                <span className="text-sm">Select All</span>
              </label>
              <span className="text-sm text-[var(--muted-foreground)]">0 selected</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-secondary text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Compare Selected
              </button>
              <button className="btn-secondary text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
              <button className="btn-secondary text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-8">
          <div className="text-sm text-[var(--muted-foreground)]">
            Showing 1-{savedStrategies.length} of {savedStrategies.length} strategies
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50" disabled>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-medium">1</button>
            <button className="px-4 py-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">2</button>
            <button className="px-4 py-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">3</button>
            <button className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Empty State (hidden by default) */}
        {false && (
          <div className="pool-card text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--secondary)] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No Saved Strategies</h3>
            <p className="text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
              You haven't saved any strategies yet. Create and save strategies to build your library.
            </p>
            <a href="/strategy" className="btn-primary inline-flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Strategy
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
