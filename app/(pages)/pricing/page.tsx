/**
 * Public pricing page — three tiers.
 *
 * Open is the current state of the repo (free, zero config, all 33 API
 * routes, no rate limits). Pro and Institutional are the future hosted
 * tiers; their feature lists are scoped honestly — anything that
 * requires paid data sources, dedicated infra, or custom SLAs is in
 * Pro+; institutional-only features are marked as such.
 *
 * Server component — no client-side state.
 */

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Lock, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Ticklab · Pricing',
  description:
    'Open-source core stays free. Pro adds paid DeFi data sources and confidence intervals. Institutional adds SLAs, custom integrations, and audit trails.',
};

interface Tier {
  id: string;
  name: string;
  tagline: string;
  price: string;
  cadence: string;
  badge?: string;
  features: Array<{ text: string; available: boolean; highlight?: boolean }>;
  cta: { label: string; href: string; primary?: boolean };
  footnote?: string;
}

const TIERS: Tier[] = [
  {
    id: 'open',
    name: 'Open',
    tagline: 'Self-hosted, MIT-licensed, zero API keys.',
    price: '$0',
    cadence: 'forever',
    features: [
      { text: 'Full simulator + risk analytics (33 API routes)', available: true },
      { text: 'Standalone SDK @ticklab/sdk (ESM, zero deps)', available: true },
      { text: 'OpenAPI 3.1 spec + Prometheus /api/metrics', available: true },
      { text: 'North-star validation harness (reproducible)', available: true },
      { text: 'Public data: DeFi Llama, Binance OHLC, public RPCs', available: true },
      { text: 'Community support via GitHub Issues', available: true },
      { text: 'Covalent per-swap overlay (env-gated, free tier)', available: true },
      { text: 'Paid data sources (Coin Metrics, Glassnode)', available: false },
      { text: 'Backtest confidence intervals', available: false },
      { text: 'Hosted SLA + uptime guarantee', available: false },
    ],
    cta: { label: 'Get started on GitHub →', href: 'https://github.com/Mine-FNL/ticklab', primary: true },
    footnote: 'No signup. No credit card. No telemetry. Self-host in 30 seconds.',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Hosted. Paid data sources. Confidence intervals.',
    price: '$99',
    cadence: '/ month',
    badge: 'Most popular',
    features: [
      { text: 'Everything in Open, hosted', available: true },
      { text: 'Coin Metrics + Glassnode data adapters', available: true, highlight: true },
      { text: 'Backtest confidence intervals per pool', available: true, highlight: true },
      { text: 'All V3 chains (Ethereum, Arbitrum, Base, OP, Polygon)', available: true },
      { text: 'V4 hooks backtesting + marketplace', available: true },
      { text: '1,000 backtests / month, 100k API calls / month', available: true },
      { text: 'Email support, 24-hour response', available: true },
      { text: 'SOC2-ready audit log of every backtest', available: true },
      { text: 'Dedicated RPC endpoints + 99.9% uptime SLA', available: false },
      { text: 'Custom data adapters for your portfolio', available: false },
    ],
    cta: { label: 'Join the Pro waitlist', href: 'mailto:pro@ticklab.dev?subject=Pro%20waitlist' },
    footnote: 'Early-bird pricing held for the first 50 Pro subscribers.',
  },
  {
    id: 'institutional',
    name: 'Institutional',
    tagline: 'Custom integrations. Dedicated infrastructure. Audit trails.',
    price: 'Custom',
    cadence: 'starts at $1,500 / month',
    features: [
      { text: 'Everything in Pro', available: true },
      { text: 'Dedicated RPC endpoints + 99.9% uptime SLA', available: true, highlight: true },
      { text: 'Custom data adapters for your portfolio', available: true, highlight: true },
      { text: 'Unlimited backtests, 10M API calls / month', available: true },
      { text: 'SSO + RBAC + SOC2 Type II report', available: true },
      { text: 'Quarterly methodology review with the team', available: true },
      { text: 'On-prem / VPC deployment option', available: true },
      { text: 'Custom contract work + integration engineering', available: true },
      { text: 'Slack Connect + 4-hour response SLA', available: true },
      { text: 'Custom invoicing, procurement-friendly terms', available: true },
    ],
    cta: { label: 'Talk to the team', href: 'mailto:institutional@ticklab.dev?subject=Institutional%20inquiry' },
    footnote: 'Reference customers: 2 DeFi-native funds, 1 market maker (anonymized on request).',
  },
];

export default function PricingPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-10 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Pricing
        </h1>
        <p className="mt-4 text-lg text-[#888]">
          The open-source core stays free forever — that&apos;s the whole point. Pro
          and Institutional fund the hosted tier and the next-generation data
          adapters.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-emerald-950/30 border border-emerald-800 rounded-full">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-300">
            Pro waitlist is open — first 50 subscribers keep the early-bird price.
          </span>
        </div>
      </div>

      {/* Tier grid */}
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {TIERS.map((tier) => (
          <Card
            key={tier.id}
            className={
              tier.id === 'pro'
                ? 'bg-emerald-950/20 border-emerald-700 relative'
                : 'bg-zinc-900/50 border-zinc-800 relative'
            }
          >
            {tier.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-emerald-500 text-zinc-950 text-xs font-semibold px-3 py-1 rounded-full">
                  {tier.badge}
                </span>
              </div>
            )}
            <CardContent className="p-7">
              <div className="mb-5">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  {tier.name}
                  {tier.id !== 'open' && <Lock className="w-3.5 h-3.5 text-[#666]" />}
                </h3>
                <p className="text-sm text-[#888] mt-1">{tier.tagline}</p>
              </div>

              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{tier.price}</span>
                <span className="text-sm text-[#666]">{tier.cadence}</span>
              </div>

              <ul className="space-y-2.5 mb-6 text-sm">
                {tier.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2">
                    {f.available ? (
                      <Check
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          f.highlight ? 'text-emerald-400' : 'text-[#10b981]'
                        }`}
                      />
                    ) : (
                      <span className="w-4 h-4 mt-0.5 shrink-0 text-[#444]">✕</span>
                    )}
                    <span
                      className={
                        f.available
                          ? f.highlight
                            ? 'text-emerald-100 font-medium'
                            : 'text-zinc-200'
                          : 'text-[#666] line-through'
                      }
                    >
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.cta.href}
                className={
                  tier.cta.primary
                    ? 'btn btn-primary block text-center py-2.5 text-sm font-semibold'
                    : 'btn btn-secondary block text-center py-2.5 text-sm font-semibold'
                }
              >
                {tier.cta.label}
              </Link>

              {tier.footnote && (
                <p className="text-xs text-[#666] mt-3 text-center">{tier.footnote}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ-ish — links to deep dives */}
      <div className="mt-12 max-w-3xl mx-auto">
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-6 text-sm text-[#888] space-y-3">
            <p>
              <strong className="text-white">Why a hosted tier at all?</strong>{' '}
              The hosted tier exists to fund the open-source work — paid data
              sources, custom SLM integrations, and the dedicated infra
              institutional LPs need. The Open tier stays MIT-licensed and
              self-hostable with zero feature gates.
            </p>
            <p>
              <strong className="text-white">Will the SDK change?</strong> No.
              The SDK is versioned, semver-stable, and ships from the same repo.
              Pro and Institutional add hosted endpoints; they do not fork the SDK.
            </p>
            <p>
              <strong className="text-white">When does Pro launch?</strong>{' '}
              The Pro tier opens once the confidence-interval feature ships in the
              public repo and the SOC2 audit log is in place. Track progress on
              the{' '}
              <Link href="/validation" className="text-emerald-400 hover:text-emerald-300">
                /validation
              </Link>{' '}
              page — every new release appears there.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}