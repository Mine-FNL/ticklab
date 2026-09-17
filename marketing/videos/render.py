#!/usr/bin/env python3
"""
Render each marketing/videos/source/*.html into MP4 + GIF via Playwright + ffmpeg.

Each source file is an auto-playing 1280x720 HTML5 page with CSS animations
timed to play once on load. Playwright records the page rendering, and
ffmpeg converts the resulting webm to mp4 (h264) and gif.
"""
import asyncio
import os
import subprocess
import sys
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).parent.resolve()
SRC = HERE / "source"
OUT = HERE

# (slug, source_html, total_duration_seconds)
VIDEOS = [
    ("01-the-pain",   "01-the-pain.html",   32),
    ("02-the-magic",  "02-the-magic.html",  46),
    ("03-the-proof",  "03-the-proof.html",  24),
    ("04-the-path",   "04-the-path.html",   21),
]


async def record(p, slug: str, src: Path, duration: int):
    print(f"[{slug}] recording {duration}s …")
    out_mp4 = OUT / f"{slug}.mp4"
    out_gif = OUT / f"{slug}.gif"
    webm = OUT / f".{slug}.webm"
    if webm.exists():
        webm.unlink()

    browser = await p.chromium.launch()
    ctx = await browser.new_context(
        viewport={"width": 1280, "height": 720},
        record_video_dir=str(OUT),
        record_video_size={"width": 1280, "height": 720},
    )
    page = await ctx.new_page()
    url = f"file://{src}"
    await page.goto(url, wait_until="domcontentloaded")
    # Wait one extra frame to settle the CSS animation start.
    await page.wait_for_timeout(500)
    # Let the animation play to completion (the page is fully timed in CSS).
    await page.wait_for_timeout(duration * 1000)
    video_path = await page.video.path()
    await ctx.close()
    await browser.close()

    if not video_path:
        raise RuntimeError(f"playwright did not produce a video for {slug}")
    # playwright saves to a tmp file with a generated name — rename it.
    src_webm = Path(video_path)
    src_webm.rename(webm)
    print(f"[{slug}] webm: {webm.stat().st_size} bytes")

    # webm → mp4 (h264, yuv420p, faststart for streaming)
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(webm),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-preset", "veryfast", "-crf", "20",
            str(out_mp4),
        ],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(f"[{slug}] mp4: {out_mp4.stat().st_size} bytes")

    # mp4 → gif (palette-optimized, 12 fps to keep size manageable)
    # Two-pass for better palette: 1) generate palette, 2) apply it.
    palette = OUT / f".{slug}.palette.png"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(out_mp4),
         "-vf", "fps=12,scale=960:-1:flags=lanczos,palettegen",
         str(palette)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(out_mp4), "-i", str(palette),
         "-filter_complex", "fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse",
         str(out_gif)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(f"[{slug}] gif: {out_gif.stat().st_size} bytes")

    # Tidy up intermediate files.
    webm.unlink()
    palette.unlink()


async def main():
    async with async_playwright() as p:
        for slug, fname, dur in VIDEOS:
            await record(p, slug, SRC / fname, dur)


if __name__ == "__main__":
    asyncio.run(main())
