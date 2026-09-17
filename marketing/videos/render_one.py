#!/usr/bin/env python3
"""Render a single video HTML to MP4 + GIF."""
import asyncio
import os
import subprocess
import sys
from pathlib import Path

from playwright.async_api import async_playwright

slug = sys.argv[1]
fname = sys.argv[2]
duration = int(sys.argv[3])

HERE = Path(__file__).parent.resolve()
SRC = HERE / "source"
OUT = HERE
src = SRC / fname
out_mp4 = OUT / f"{slug}.mp4"
out_gif = OUT / f"{slug}.gif"
webm = OUT / f"{slug}-tmp.webm"
palette = OUT / f"{slug}-tmp.png"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=str(OUT),
            record_video_size={"width": 1280, "height": 720},
        )
        page = await ctx.new_page()
        await page.goto(f"file://{src}", wait_until="domcontentloaded")
        await page.wait_for_timeout(500)
        await page.wait_for_timeout(duration * 1000)
        video_path = await page.video.path()
        await ctx.close()
        await browser.close()

    src_webm = Path(video_path)
    src_webm.rename(webm)
    print(f"webm: {webm.stat().st_size} bytes")

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(webm),
         "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart",
         "-preset", "veryfast", "-crf", "20", str(out_mp4)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(f"mp4: {out_mp4.stat().st_size} bytes")

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(out_mp4),
         "-vf", "fps=12,scale=960:-1:flags=lanczos,palettegen", str(palette)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(out_mp4), "-i", str(palette),
         "-filter_complex", "fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse",
         str(out_gif)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(f"gif: {out_gif.stat().st_size} bytes")

    os.remove(webm)
    os.remove(palette)

asyncio.run(main())
