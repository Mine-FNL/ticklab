import Link from "next/link";

export default function Home() {
  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              UniV3 LP
              <span style={{ color: '#10b981' }}> Strategy Lab</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#888] max-w-2xl mx-auto">
              Research terminal for Uniswap V3 concentrated liquidity strategies.
              Model positions, backtest performance, and optimize your LP returns.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/strategy"
                className="btn btn-primary px-6 py-3 text-sm font-semibold"
              >
                Start Building
              </Link>
              <Link
                href="/pools"
                className="btn btn-secondary px-6 py-3 text-sm font-semibold"
              >
                View Pools →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="px-6 pb-8 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Chains', value: '5+' },
              { label: 'Data', value: 'Real-time' },
              { label: 'Pricing', value: 'Free' },
              { label: 'API Keys', value: 'None needed' },
            ].map((stat) => (
              <div key={stat.label} className="card card-body text-center py-5">
                <div className="metric-value text-lg">{stat.value}</div>
                <div className="metric-label mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="px-6 pb-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-white mb-4">Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { title: 'Strategy Builder', href: '/strategy', desc: 'Create custom LP positions with precise tick ranges' },
              { title: 'Backtest', href: '/backtest', desc: 'Replay strategies against historical pool data' },
              { title: 'Swaps Analytics', href: '/swaps', desc: 'Swap volume and trading pair analytics' },
              { title: 'Pools', href: '/pools', desc: 'Browse and analyze Uniswap V3 pools' },
              { title: 'TVL', href: '/tvl', desc: 'Total value locked across chains' },
              { title: 'Liquidity', href: '/liquidity', desc: 'Liquidity distribution and utilization' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="card card-body hover:border-[#3a3a3a] transition-colors group"
              >
                <h3 className="text-sm font-medium text-white group-hover:text-[#10b981] transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-[#888] mt-1 leading-relaxed">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="card card-body py-10 text-center">
            <h2 className="text-xl font-semibold text-white">
              Ready to optimize your LP strategy?
            </h2>
            <p className="text-sm text-[#888] mt-2 max-w-md mx-auto">
              Start building and backtesting strategies. No wallet connection required for simulation.
            </p>
            <Link href="/strategy" className="btn btn-primary mt-6 inline-block">
              Get Started →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
