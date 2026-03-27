import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-institutional">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              UniV3 LP
              <span className="gradient-text"> Strategy Lab</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-400 max-w-2xl mx-auto">
              Advanced liquidity provision strategy simulation and analysis for Uniswap V3. 
              Model positions, backtest strategies, and optimize your LP returns.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/strategy"
                className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all"
              >
                Start Building
              </Link>
              <Link
                href="/explore"
                className="text-sm font-semibold leading-6 text-white hover:text-zinc-300 transition-colors"
              >
                Explore Pools <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Everything you need to optimize LP strategies
            </h2>
          </div>
          <div className="mx-auto mt-16 max-w-7xl">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="relative rounded-2xl border border-zinc-800 bg-institutional-card p-8 hover:border-zinc-700 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">Strategy Builder</h3>
                <p className="mt-2 text-zinc-400">
                  Model custom LP positions with precise tick ranges and deposit amounts.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="relative rounded-2xl border border-zinc-800 bg-institutional-card p-8 hover:border-zinc-700 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">Historical Backtesting</h3>
                <p className="mt-2 text-zinc-400">
                  Replay strategies against historical pool data to see how they would have performed.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="relative rounded-2xl border border-zinc-800 bg-institutional-card p-8 hover:border-zinc-700 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">Fee Estimation</h3>
                <p className="mt-2 text-zinc-400">
                  Calculate expected fees based on volume, liquidity, and position sizing.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="relative rounded-2xl border border-zinc-800 bg-institutional-card p-8 hover:border-zinc-700 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">IL Analysis</h3>
                <p className="mt-2 text-zinc-400">
                  Understand impermanent loss scenarios and compare LP vs HODL returns.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="relative rounded-2xl border border-zinc-800 bg-institutional-card p-8 hover:border-zinc-700 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">Position Tracking</h3>
                <p className="mt-2 text-zinc-400">
                  Import and monitor live positions with real-time performance metrics.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="relative rounded-2xl border border-zinc-800 bg-institutional-card p-8 hover:border-zinc-700 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">Strategy Library</h3>
                <p className="mt-2 text-zinc-400">
                  Save, compare, and share strategies with the community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative rounded-3xl bg-zinc-900 px-6 py-16 sm:px-16 sm:py-24 lg:flex lg:items-center lg:justify-between lg:px-20">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to optimize your LP strategy?
              </h2>
              <p className="mt-6 text-lg text-zinc-400 max-w-xl">
                Start building and backtesting strategies today. No wallet connection required for simulation.
              </p>
            </div>
            <div className="mt-10 flex items-center gap-x-6 lg:mt-0 lg:flex-shrink-0">
              <Link
                href="/strategy"
                className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-12 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-zinc-500 text-sm">
            © 2024 UniV3 LP Strategy Lab. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/explore" className="text-zinc-500 hover:text-white text-sm transition-colors">
              Explore
            </Link>
            <Link href="/strategy" className="text-zinc-500 hover:text-white text-sm transition-colors">
              Strategy
            </Link>
            <Link href="/library" className="text-zinc-500 hover:text-white text-sm transition-colors">
              Library
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
