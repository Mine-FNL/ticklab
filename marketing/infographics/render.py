#!/usr/bin/env python3
"""
Render the two infographics (architecture + validation-snapshot) to 1600x900
PNGs that get committed alongside the HTML sources.

Usage:
    python3 marketing/infographics/render.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
RENDERS = [
    ("architecture.html", "architecture.png", 1600, 900),
    ("validation-snapshot.html", "validation-snapshot.png", 1600, 900),
]


async def render_one(p, html: str, out_png: str, w: int, h: int) -> None:
    browser = await p.chromium.launch()
    ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
    page = await ctx.new_page()
    await page.goto(f"file://{html}", wait_until="load")
    # Give CSS a beat to settle.
    await page.wait_for_timeout(250)
    await page.screenshot(path=out_png, full_page=False, type="png")
    await browser.close()


async def main() -> int:
    async with async_playwright() as pw:
        for src, dst, w, h in RENDERS:
            src_path = (ROOT / src).resolve()
            dst_path = (ROOT / dst).resolve()
            print(f"Rendering {src} → {dst} @ {w}x{h} (2x DPR)")
            await render_one(pw, str(src_path), str(dst_path), w, h)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))