import Link from "next/link";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

import {
  computeStats,
  formatAge,
  loadLatestValidation,
} from "@/lib/validation-results";

export default async function Home() {
  const validationRun = await loadLatestValidation();
  const validationStats = validationRun ? computeStats(validationRun.rows) : null;
  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ticklab
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#888] max-w-2xl mx-auto">
              Production-grade backtest & risk analytics for concentrated-liquidity
              LP strategies — built on real on-chain data with no API keys required.
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

            {/* Live Validation Widget — surfaces the latest north-star
                metrics straight on the home page so visitors see the
                "alive" signal without needing to navigate to /validation. */}
            {validationStats && validationRun && (
              <div className="mt-10 inline-flex flex-col items-center gap-3">
                <Link
                  href="/validation"
                  className="group inline-flex items-center gap-3 px-5 py-3 bg-zinc-900/70 border border-zinc-800 hover:border-emerald-700 rounded-full text-sm transition-colors"
                  aria-label={`Live validation: ${validationStats.medianAbsErrorPP.toFixed(2)} pp median absolute error across ${validationStats.poolCount} pools, updated ${formatAge(validationRun.timestampISO)}`}
                >
                  {validationStats.starReached ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-zinc-300">
                    Live validation:{" "}
                    <span className="text-white font-semibold tabular-nums">
                      {validationStats.medianAbsErrorPP.toFixed(2)} pp
                    </span>{" "}
                    median abs err ·{" "}
                    <span className="text-white font-semibold tabular-nums">
                      {validationStats.poolCount}
                    </span>{" "}
                    pools ·{" "}
                    <span className="text-zinc-500 text-xs">
                      updated {formatAge(validationRun.timestampISO)}
                    </span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}
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
