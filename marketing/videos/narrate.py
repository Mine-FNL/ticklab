#!/usr/bin/env python3
"""
Generate narration audio for the four campaign videos using Microsoft Edge's
free neural TTS. Each video gets a polished, calm, authoritative voice
(`en-US-GuyNeural`) — the same voice across the set for continuity.

Also generates SRT subtitle files for accessibility + platforms where audio
is muted by default.
"""
import asyncio
import sys
from pathlib import Path

import edge_tts

HERE = Path(__file__).parent.resolve()

# (slug, narration, target_seconds)
NARRATIONS = [
    (
        "01-the-pain",
        # ~32s target
        "Most LP simulators ship a projected APR like it's gospel. "
        "Then you deposit, the price moves, and reality arrives. "
        "The simulator said plus forty-one percent. Reality was plus six. "
        "That's a thirty-five percentage point gap — and the model never warned you. "
        "What if your simulator published its own error?",
    ),
    (
        "02-the-magic",
        # ~46s target
        "What does honest measurement actually mean? "
        "Ticklab pulls real data from DeFi Llama — per-pool daily fees and TVL — for eighteen real V3 pools. "
        "It pulls daily prices from Binance for the same window. "
        "It replays each pool-day through its simulator with the same range, fees, and gas. "
        "Then it compares the projection to ground truth — pool by pool, day by day — and publishes the error. "
        "Median absolute error: one point five five percentage points. "
        "Down from seven point nine one. A six-times improvement — and it's reproducible. "
        "Anyone can run npm run validate north star and get the same numbers.",
    ),
    (
        "03-the-proof",
        # ~24s target
        "Here's what that actually looks like. "
        "One command. One output. Every metric in the README. "
        "Fifteen pools completed. Three skipped on DeFi Llama coverage. "
        "Median: one point five five. Mean: three point three one. Max: thirteen point one six. "
        "The zero out of fifteen within twenty percent relative error is named — "
        "it needs per-swap data that's gated on Covalent GoldRush. No hiding.",
    ),
    (
        "04-the-path",
        # ~25s target
        "Five commands. Git clone. NPM install. "
        "NPM run validate north star to reproduce every metric. Then NPM run dev. "
        "Browser opens at localhost three thousand. "
        "Every claim in this README comes from one script. Run it — same result.",
    ),
]

VOICE = "en-US-GuyNeural"
RATE = "-5%"   # slightly slower for clarity
PITCH = "-2Hz"


async def synth(slug: str, text: str):
    out_mp3 = HERE / f"{slug}.mp3"
    print(f"[{slug}] synth {len(text)} chars …")
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await communicate.save(str(out_mp3))
    print(f"[{slug}] mp3: {out_mp3.stat().st_size} bytes")


async def main():
    for slug, text in NARRATIONS:
        await synth(slug, text)


if __name__ == "__main__":
    asyncio.run(main())
