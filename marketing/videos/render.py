#!/usr/bin/env python3
"""
Render v2 of the campaign videos at 1600x900 with narration mixed in.

Each HTML source uses JS to drive the animation timing alongside the
narration. We:
  1. Record the page rendering via Playwright (Chromium)
  2. Convert webm → h264 mp4 at high quality (CRF 18)
  3. Mux in the MP3 narration at the correct start offset
  4. Export a GIF (no audio) at 12 fps, palette-optimized, 1280px wide

The video total duration is the narration length plus a 3-5s tail for
the final CTA / fade-out, so the last frame isn't cut off mid-animation.
"""
import asyncio
import os
import subprocess
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).parent.resolve()
SRC = HERE / "source"
OUT = HERE

# (slug, source_html, narration_mp3, total_seconds_for_video_tail)
VIDEOS = [
    ("01-the-pain",   "01-the-pain.html",   "01-the-pain.mp3",  28),
    ("02-the-magic",  "02-the-magic.html",  "02-the-magic.mp3", 48),
    ("03-the-proof",  "03-the-proof.html",  "03-the-proof.mp3", 38),
    ("04-the-path",   "04-the-path.html",   "04-the-path.mp3",  25),
]

W, H = 1600, 900
GIT_W = 1280


def get_audio_duration(mp3: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(mp3)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


async def record(p, slug: str, src: Path, total: int):
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
    print(f"[{slug}] webm: {webm.stat().st_size} bytes")
    return webm


def webm_to_mp4(webm: Path, mp4: Path):
    # Higher quality: CRF 18 (visually lossless), yuv420p, faststart
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(webm),
         "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart",
         "-preset", "slow", "-crf", "18",
         str(mp4)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def mux_audio(mp4_in: Path, mp4_out: Path, mp3: Path):
    # Mux audio starting at t=0 of the video (narration drives the timing).
    # Pad audio if video is longer.
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(mp4_in), "-i", str(mp3),
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-shortest" if False else "-map", "0:v", "-map", "1:a",
         "-movflags", "+faststart",
         str(mp4_out)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def to_gif(mp4: Path, gif: Path, width: int):
    palette = OUT / f"{gif.stem}-palette.png"
    # Two-pass for crisp GIFs.
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(mp4),
         "-vf", f"fps=12,scale={width}:-1:flags=lanczos,palettegen",
         str(palette)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(mp4), "-i", str(palette),
         "-filter_complex", f"fps=12,scale={width}:-1:flags=lanczos[x];[x][1:v]paletteuse",
         str(gif)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    palette.unlink(missing_ok=True)


async def main():
    async with async_playwright() as p:
        for slug, fname, mp3_name, total in VIDEOS:
            src = SRC / fname
            mp3 = OUT / mp3_name
            assert get_audio_duration(mp3) < total, (
                f"audio ({get_audio_duration(mp3):.1f}s) longer than video ({total}s)"
            )

            webm = await record(p, slug, src, total)
            mp4_silent = OUT / f"{slug}-silent.mp4"
            mp4_final  = OUT / f"{slug}.mp4"
            gif        = OUT / f"{slug}.gif"

            webm_to_mp4(webm, mp4_silent)
            print(f"[{slug}] silent mp4: {mp4_silent.stat().st_size} bytes")
            mux_audio(mp4_silent, mp4_final, mp3)
            print(f"[{slug}] final mp4 (with audio): {mp4_final.stat().st_size} bytes")
            mp4_silent.unlink()
            webm.unlink()

            to_gif(mp4_final, gif, GIT_W)
            print(f"[{slug}] gif: {gif.stat().st_size} bytes")


if __name__ == "__main__":
    asyncio.run(main())
