from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
INDEX = HERE / "index.html"
AUDIO = HERE / "payintent_score.wav"
DEFAULT_OUTPUT = HERE / "payintent_ad_walkthrough.mp4"


def find_ffmpeg() -> Path:
    configured = os.environ.get("FFMPEG_BINARY")
    if configured and Path(configured).is_file():
        return Path(configured)
    discovered = shutil.which("ffmpeg")
    if discovered:
        return Path(discovered)
    try:
        import imageio_ffmpeg

        bundled = Path(imageio_ffmpeg.get_ffmpeg_exe())
        if bundled.is_file():
            return bundled
    except ImportError:
        pass
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    candidates = [
        local_app_data / "ms-playwright" / "ffmpeg-1013" / "ffmpeg-win64.exe",
        local_app_data / "ms-playwright" / "ffmpeg-1011" / "ffmpeg-win64.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("FFmpeg was not found. Set FFMPEG_BINARY to an ffmpeg executable.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render the deterministic PayIntent HyperFrames film.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--fps", type=int, default=60)
    parser.add_argument("--duration", type=float, default=44.0)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--start-frame", type=int, default=0)
    parser.add_argument("--frame-count", type=int, default=None)
    parser.add_argument("--crf", type=int, default=18)
    return parser.parse_args()


def encoder_for(ffmpeg: Path) -> str:
    probe = subprocess.run(
        [str(ffmpeg), "-hide_banner", "-encoders"],
        check=True,
        capture_output=True,
        text=True,
        errors="replace",
    )
    return "libx264" if "libx264" in probe.stdout else "mpeg4"


def render(args: argparse.Namespace) -> None:
    if not INDEX.is_file():
        raise FileNotFoundError(INDEX)
    if not AUDIO.is_file():
        raise FileNotFoundError(f"Missing {AUDIO}. Run make_audio.py first.")

    ffmpeg = find_ffmpeg()
    encoder = encoder_for(ffmpeg)
    total_frames = int(round(args.duration * args.fps))
    first_frame = max(0, args.start_frame)
    frame_count = args.frame_count or (total_frames - first_frame)
    frame_count = min(frame_count, total_frames - first_frame)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    video_options = ["-c:v", encoder]
    if encoder == "libx264":
        video_options += ["-preset", "medium", "-crf", str(args.crf)]
    else:
        video_options += ["-q:v", "2"]

    command = [
        str(ffmpeg), "-y", "-hide_banner", "-loglevel", "warning",
        "-f", "image2pipe", "-vcodec", "png", "-framerate", str(args.fps), "-i", "-",
        "-i", str(AUDIO),
        *video_options,
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest", str(args.output),
    ]

    print(f"Rendering {frame_count} frames at {args.fps} fps with {encoder}")
    print(f"FFmpeg: {ffmpeg}")
    started = time.perf_counter()
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--disable-gpu-vsync"])
            page = browser.new_page(
                viewport={"width": args.width, "height": args.height},
                device_scale_factor=1,
            )
            page.goto(INDEX.as_uri(), wait_until="load")
            page.wait_for_function("window.__VIDEO_READY__ === true")
            metadata = page.evaluate("window.PAYINTENT_VIDEO")
            print(
                "Scene metadata: "
                f"{metadata['vertices']} morph vertices, "
                f"{metadata['particles']} particles, "
                f"{metadata['blurSamples']}x sub-frame blur"
            )

            for local_index in range(frame_count):
                frame_index = first_frame + local_index
                page.evaluate(
                    "([frame, fps]) => window.renderFrame(frame, fps)",
                    [frame_index, args.fps],
                )
                frame = page.screenshot(type="png", animations="disabled")
                process.stdin.write(frame)
                if local_index % max(1, args.fps * 2) == 0 or local_index + 1 == frame_count:
                    elapsed = max(time.perf_counter() - started, 0.001)
                    rate = (local_index + 1) / elapsed
                    remaining = (frame_count - local_index - 1) / max(rate, 0.001)
                    percent = (local_index + 1) / frame_count * 100.0
                    print(f"{percent:6.2f}%  frame {frame_index:04d}  {rate:5.1f} fps  ETA {remaining:5.1f}s")
            browser.close()
    except Exception:
        process.kill()
        raise
    finally:
        if process.stdin and not process.stdin.closed:
            process.stdin.close()

    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"FFmpeg exited with code {return_code}")
    elapsed = time.perf_counter() - started
    print(f"Wrote {args.output} in {elapsed:.1f}s")


if __name__ == "__main__":
    try:
        render(parse_args())
    except KeyboardInterrupt:
        print("Render interrupted.", file=sys.stderr)
        raise SystemExit(130)
