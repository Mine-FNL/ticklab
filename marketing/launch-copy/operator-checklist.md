# Ticklab — Operator Checklist (post-deploy)

**Purpose:** All autonomous engineering work is complete and pushed to
GitHub. These are the only remaining items that require human action —
listed in dependency order so each step unlocks the next.

**Repo on GitHub:** https://github.com/Mine-FNL/ticklab
**Direct production URL (working today):** https://univ3-strategy-iqwf90bvh-0xbingbongs-projects.vercel.app
**Clean domain (currently 404, fixed by step 2):** https://univ3-strategy-lab.vercel.app

---

## [ ] 1. Disable Vercel Deployment Protection (1 minute, dashboard-only)

This is the **single blocker** behind the 404 on `univ3-strategy-lab.vercel.app`.
Vercel is currently requiring SSO for every new deployment. Disable it once.

**Steps:**
1. Open https://vercel.com/0xbingbongs-projects/univ3-strategy-lab/settings/deployment-protection
2. Sign in as `0xbingbong69` (Google or GitHub).
3. Under "Protection", select **Disabled** (or alternatively "All deployments except Preview" if you want previews gated — production deploys in this session are already public-on-push via `--prod`).
4. Click **Save**.

**Verify:** After saving, Vercel may take 30–60 seconds to propagate. Refresh
the page; the green "Protection is on" badge should be gone.

---

## [ ] 2. Re-alias the clean domain (15 seconds, CLI)

Once step 1 is done, run:

```bash
cd /Users/gg/.minimax-agent/projects/univ3-strategy-lab
vercel alias univ3-strategy-iqwf90bvh-0xbingbongs-projects.vercel.app univ3-strategy-lab.vercel.app
```

**Verify:**
```bash
curl -sS -L -o /dev/null -w "%{http_code} %{size_download}B\n" https://univ3-strategy-lab.vercel.app/pricing
curl -sS -L -o /dev/null -w "%{http_code} %{size_download}B\n" https://univ3-strategy-lab.vercel.app/validation
```

Expected: `200 340xxxB` for both. If you get `404` or `107B`, step 1 didn't
propagate — wait 60 seconds and retry.

---

## [ ] 3. Set the Covalent API key (3 minutes)

This unlocks per-swap historical data for the 3 pools (ENS, SUSHI, PEPE)
that aren't in DeFi Llama. The harness jumps from 15/18 to 18/18 pools
and the north-star metric on those three becomes per-swap accurate.

**Steps:**
1. Open https://goldrush.dev/ → **Sign up free** (no credit card, no paid
   tier required for the free 100k credits/month we'll use).
2. Once signed in, copy the API key from the dashboard — it'll look like
   `ckey_xxxxxxxxxxxxxxxxxxxxxxxx`.
3. Export it for the harness locally:
   ```bash
   export COVALENT_API_KEY=ckey_xxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Add it to Vercel so the live harness (if you re-run it on Vercel) picks
   it up too:
   ```bash
   cd /Users/gg/.minimax-agent/projects/univ3-strategy-lab
   vercel env add COVALENT_API_KEY production
   # paste the key when prompted
   ```
5. Re-run the validation harness locally to confirm 18/18 pools:
   ```bash
   npm run validate:northstar
   ```
   Look for: `Pools with results: 18` (was 15). The new CSVs go into
   `validation-results/`. Commit and push:
   ```bash
   git add validation-results/
   git commit -m "chore: validation run with Covalent overlay (18/18 pools)"
   git push origin master
   ```
6. Trigger a fresh Vercel deploy so the live `/validation` page picks up
   the new CSV:
   ```bash
   vercel deploy --prod --yes
   ```

---

## [ ] 4. Post the campaign (90 minutes total)

All copy is **ready to copy-paste** from `marketing/launch-copy/` and
`marketing/articles/`. Recommended posting order:

### Day 1 (high-visibility, peak exposure)
- [ ] **Show HN** — `marketing/launch-copy/hackernews-show.md` (27 lines).
  Post between 8–10am ET Tuesday/Wednesday for max visibility.
  Rules: no link in the headline, respond to every comment in the first
  hour, don't delete/repost if it tanks.
- [ ] **r/ethfinance** — `marketing/launch-copy/reddit-r-ethfinance.md`.
  No cross-posting, no link-only post. Engage with the first 5 comments.
- [ ] **Twitter thread #1 (zero API keys)** —
  `marketing/launch-copy/twitter-thread-zero-api-keys.md` (tweet #1 only,
  then thread). Best days: Tuesday–Thursday 9am–12pm ET.

### Day 2 (deeper engagement)
- [ ] **r/defi** — `marketing/launch-copy/reddit-r-defi.md`.
- [ ] **Twitter thread #2 (results)** —
  `marketing/launch-copy/twitter-thread-results.md` (the 6× accuracy
  improvement story).
- [ ] **Twitter thread #3 (origin)** —
  `marketing/launch-copy/twitter-thread-origin.md` (the build story).
- [ ] **LinkedIn post** — `marketing/launch-copy/linkedin-post.md`.
  Best days: Tuesday–Thursday morning ET.

### Day 3 (long-tail + articles)
- [ ] **Twitter thread #4** — `marketing/launch-copy/twitter-thread.md`
  (general launch thread).
- [ ] **Article 1** — `marketing/articles/how-to-validate-an-lp-simulator.md`.
  Submit to: Bankless, Mirror, Substack (re-export to Markdown).
- [ ] **Article 2** — `marketing/articles/why-honest-measurement-matters.md`.
  Submit to: Messari Hub, The Defiant, The Block.
- [ ] **Product Hunt** — `marketing/launch-copy/producthunt-launch.md`.
  Schedule for Tuesday or Wednesday at 12:01am PT.
- [ ] **Email outreach** — `marketing/launch-copy/email-outreach.md` has
  two variants and `marketing/launch-copy/outreach-targets.md` has 24
  pre-vetted recipient emails across DeFi protocols and newsletters.

---

## [ ] 5. Investor outreach (only if raising)

The pre-seed is scoped at $400–800k in the investor one-pager. If that's
on the table, the path is:

- [ ] Send the investor one-pager (`marketing/one-pager/investor-one-pager.pdf`)
  to the founders list in `marketing/launch-copy/outreach-targets.md` (filter
  to the VC / fund partners).
- [ ] DM on Twitter to 5 DeFi-fund managers and 5 quant-fund CTOs. Hook
  = "the only V3 simulator with reproducible north-star validation;
  median abs err 1.55 pp on 15 pools; 0 API keys".
- [ ] Send the whitepaper (`marketing/whitepaper/ticklab-whitepaper.md`)
  as a follow-up attachment to anyone who replies.

---

## Status dashboard

| Item                                | Owner | Time   | Status |
|-------------------------------------|-------|--------|--------|
| 1. Disable Vercel Deployment Protection | human | 1 min  | pending |
| 2. Re-alias clean domain                | human | 15 sec | blocked on 1 |
| 3. Set Covalent API key                 | human | 3 min  | optional but closes a named limitation |
| 4. Post the campaign                    | human | 90 min | ready to copy-paste |
| 5. Investor outreach                    | human | varies | only if raising |

---

## What "done" looks like

After step 1, 2, and the campaign post:

- [ ] `https://univ3-strategy-lab.vercel.app/pricing` returns 200
- [ ] `https://univ3-strategy-lab.vercel.app/validation` returns 200 with "NORTH STAR" status card
- [ ] Home page (`/`) shows the live validation widget under the hero CTA
- [ ] Hacker News front page (within 4 hours of posting)
- [ ] First GitHub star (within 48 hours of HN front page)
- [ ] First 5 newsletter replies (within 1 week)

**If stars stall:** the primary lever is the HN post. Don't relaunch on
the same day — wait 7 days, then try the r/quant or r/algotrading angle
with a more methodological hook.

---

## Operator-friendly appendix

### Why is the alias broken?

Vercel has a project-level "Deployment Protection" setting. When enabled,
every new deployment serves a Vercel SSO login wall instead of the app.
Disabling it once (step 1) propagates to all future deploys permanently.

### Why was the GitHub repo created fresh instead of renamed?

The old `Mine-FNL/univ3-strategy-lab` repo didn't exist on GitHub — the
local git history referenced a remote that was never set up. Creating
`Mine-FNL/ticklab` directly is the cleanest path; the auto-redirect that
would have preserved old stars/forks only matters if the old repo was
publicly indexed, which it wasn't.

### Why are some pools skipping without Covalent?

ENS/WETH, SUSHI/WETH, and PEPE/WETH are not in DeFi Llama's pool index
(verified — they're absent from `/pools/Ethereum` even after a strict
project filter for `uniswap-v3`). Covalent GoldRush indexes on-chain
data exhaustively, so its swap endpoint covers them. With a Covalent key
the harness goes 18/18.

### What if step 3 (Covalent) is too much friction?

Without it: 15/18 pools validated, `npm run validate:northstar` still
green, all other features ship normally. The 3 skipped pools show up in
the `/validation` page with a clear "Covalent overlay available if you
set COVALENT_API_KEY" message instead of a hard fail. The README and
NORTH_STAR_REPORT.md are honest about this gap.