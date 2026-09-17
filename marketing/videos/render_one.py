#!/usr/bin/env python3
"""Render one v2 video (with audio)."""
import asyncio
import subprocess
import sys
from pathlib import Path

from playwright.async_api import async_playwright

slug = sys.argv[1]
fname = sys.argv[2]
mp3_name = sys.argv[3]
total = int(sys.argv[4])

HERE = Path(__file__).parent.resolve()
SRC = HERE / "source"
OUT = HERE
src = SRC / fname
mp3 = OUT / mp3_name

W, H = 1600, 900

async def main():
    async with async_playwright() as p:
        print(f"[{slug}] recording {total}s …")
        webm = OUT / f"{slug}-tmp.webm"
        if webm.exists():
            webm.unlink()
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": W, "height": H},
            record_video_dir=str(OUT),
            record_video_size={"width": W, "height": H},
        )
        page = await ctx.new_page()
        await page.goto(f"file://{src}", wait_until="domcontentloaded")
        await page.wait_for_timeout(300)
        await page.wait_for_timeout(total * 1000)
        video_path = await page.video.path()
        await ctx.close()
        await browser.close()
        Path(video_path).rename(webm)

    mp4_silent = OUT / f"{slug}-silent.mp4"
    mp4_final = OUT / f"{slug}.mp4"
    gif = OUT / f"{slug}.gif"

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(webm),
         "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart",
         "-preset", "slow", "-crf", "18", str(mp4_silent)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(mp4_silent), "-i", str(mp3),
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-map", "0:v", "-map", "1:a",
         "-movflags", "+faststart", str(mp4_final)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    palette = OUT / f"{slug}-palette.png"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(mp4_final),
         "-vf", "fps=12,scale=1280:-1:flags=lanczos,palettegen", str(palette)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(mp4_final), "-i", str(palette),
         "-filter_complex", "fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse",
         str(gif)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(f"[{slug}] mp4: {mp4_final.stat().st_size} bytes")
    print(f"[{slug}] gif: {gif.stat().st_size} bytes")
    webm.unlink(missing_ok=True)
    mp4_silent.unlink(missing_ok=True)
    palette.unlink(missing_ok=True)

asyncio.run(main())
