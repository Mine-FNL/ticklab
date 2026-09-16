import Link from 'next/link';

/**
 * Friendly 404 page. Lives at the root of /app so it catches any unmatched
 * route without leaking framework defaults.
 */

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-widest text-emerald-400/80 font-mono mb-3">
          404
        </p>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
          Pool not found
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
          We couldn&apos;t locate that strategy, pool, or page. It may have been removed,
          or the URL is mistyped.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 text-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-emerald-400 transition-colors"
        >
          Back to lab
        </Link>
      </div>
    </div>
  );
}