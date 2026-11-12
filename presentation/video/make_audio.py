from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 48_000
BPM = 120
BEAT_SECONDS = 60.0 / BPM
DURATION_SECONDS = 44.0
DROP_BEAT = 8
DROP_TIME = DROP_BEAT * BEAT_SECONDS
OUTPUT = Path(__file__).with_name("payintent_score.wav")
RNG = np.random.default_rng(20261112)


def envelope(length: int, attack: float, decay: float, sustain: float = 0.0) -> np.ndarray:
    attack_samples = max(1, int(attack * SAMPLE_RATE))
    decay_samples = max(1, length - attack_samples)
    attack_curve = np.linspace(0.0, 1.0, attack_samples, endpoint=False)
    decay_curve = np.linspace(1.0, sustain, decay_samples, endpoint=True)
    return np.concatenate((attack_curve, decay_curve))[:length]


def add_kick(track: np.ndarray, time_seconds: float, gain: float = 1.0) -> None:
    length = int(0.42 * SAMPLE_RATE)
    start = int(time_seconds * SAMPLE_RATE)
    end = min(len(track), start + length)
    if end <= start:
        return
    t = np.arange(end - start) / SAMPLE_RATE
    frequency = 44.0 + 118.0 * np.exp(-t * 31.0)
    phase = 2.0 * np.pi * np.cumsum(frequency) / SAMPLE_RATE
    body = np.sin(phase) * np.exp(-t * 10.5)
    click = RNG.normal(0.0, 1.0, len(t)) * np.exp(-t * 72.0) * 0.16
    track[start:end] += (body + click) * gain


def add_snare(track: np.ndarray, time_seconds: float, gain: float = 0.65) -> None:
    length = int(0.28 * SAMPLE_RATE)
    start = int(time_seconds * SAMPLE_RATE)
    end = min(len(track), start + length)
    if end <= start:
        return
    t = np.arange(end - start) / SAMPLE_RATE
    noise = RNG.normal(0.0, 1.0, len(t))
    tone = np.sin(2.0 * np.pi * 185.0 * t)
    shaped = (noise * 0.78 + tone * 0.22) * np.exp(-t * 18.0)
    track[start:end] += shaped * gain


def add_hat(track: np.ndarray, time_seconds: float, gain: float = 0.18, open_hat: bool = False) -> None:
    duration = 0.22 if open_hat else 0.065
    length = int(duration * SAMPLE_RATE)
    start = int(time_seconds * SAMPLE_RATE)
    end = min(len(track), start + length)
    if end <= start:
        return
    t = np.arange(end - start) / SAMPLE_RATE
    noise = RNG.normal(0.0, 1.0, len(t))
    high_passed = np.concatenate(([0.0], np.diff(noise)))
    decay = 18.0 if open_hat else 55.0
    track[start:end] += high_passed * np.exp(-t * decay) * gain


def saw(phase: np.ndarray) -> np.ndarray:
    return 2.0 * ((phase / (2.0 * np.pi)) % 1.0) - 1.0


def add_supersaw(
    track: np.ndarray,
    time_seconds: float,
    duration: float,
    midi_notes: tuple[int, ...],
    gain: float,
) -> None:
    start = int(time_seconds * SAMPLE_RATE)
    end = min(len(track), start + int(duration * SAMPLE_RATE))
    if end <= start:
        return
    t = np.arange(end - start) / SAMPLE_RATE
    chord = np.zeros_like(t)
    detunes = (-0.018, -0.011, -0.005, 0.0, 0.005, 0.011, 0.018)
    for note in midi_notes:
        base_frequency = 440.0 * (2.0 ** ((note - 69) / 12.0))
        voice = np.zeros_like(t)
        for detune in detunes:
            frequency = base_frequency * (1.0 + detune)
            phase = 2.0 * np.pi * frequency * t
            voice += saw(phase) / len(detunes)
        chord += voice / len(midi_notes)
    fade_in = np.clip(t / 0.035, 0.0, 1.0)
    fade_out = np.clip((duration - t) / 0.18, 0.0, 1.0)
    track[start:end] += chord * fade_in * fade_out * gain


def add_sub_bass(track: np.ndarray, time_seconds: float, duration: float, midi_note: int, gain: float) -> None:
    start = int(time_seconds * SAMPLE_RATE)
    end = min(len(track), start + int(duration * SAMPLE_RATE))
    if end <= start:
        return
    t = np.arange(end - start) / SAMPLE_RATE
    frequency = 440.0 * (2.0 ** ((midi_note - 69) / 12.0))
    signal = np.sin(2.0 * np.pi * frequency * t)
    signal += 0.18 * np.sin(2.0 * np.pi * frequency * 2.0 * t)
    track[start:end] += signal * envelope(len(t), 0.012, duration - 0.012, 0.15) * gain


def add_riser(track: np.ndarray, start_time: float, duration: float, gain: float = 0.16) -> None:
    start = int(start_time * SAMPLE_RATE)
    end = min(len(track), start + int(duration * SAMPLE_RATE))
    if end <= start:
        return
    t = np.arange(end - start) / SAMPLE_RATE
    phase = 2.0 * np.pi * (120.0 * t + 440.0 * (t**2) / max(duration, 0.001))
    noise = RNG.normal(0.0, 1.0, len(t))
    signal = np.sin(phase) * 0.35 + np.concatenate(([0.0], np.diff(noise))) * 0.18
    track[start:end] += signal * np.linspace(0.0, 1.0, len(t)) ** 2 * gain


def sidechain_envelope(total_samples: int, kick_times: list[float]) -> np.ndarray:
    duck = np.ones(total_samples, dtype=np.float64)
    release_samples = int(0.24 * SAMPLE_RATE)
    curve = 0.30 + 0.70 * (1.0 - np.exp(-np.linspace(0.0, 5.0, release_samples)))
    for kick_time in kick_times:
        start = int(kick_time * SAMPLE_RATE)
        end = min(total_samples, start + release_samples)
        if end > start:
            duck[start:end] = np.minimum(duck[start:end], curve[: end - start])
    return duck


def build_score() -> np.ndarray:
    total_samples = int(DURATION_SECONDS * SAMPLE_RATE)
    drums = np.zeros(total_samples, dtype=np.float64)
    harmonic = np.zeros(total_samples, dtype=np.float64)
    bass = np.zeros(total_samples, dtype=np.float64)
    fx = np.zeros(total_samples, dtype=np.float64)
    kick_times: list[float] = []

    add_riser(fx, 1.0, DROP_TIME - 1.1, 0.30)

    total_beats = int(DURATION_SECONDS / BEAT_SECONDS)
    progression = [
        ((45, 52, 57, 61), 33),  # A minor add9
        ((41, 48, 52, 57), 29),  # F major add6
        ((36, 43, 48, 52), 24),  # C major
        ((43, 50, 55, 59), 31),  # G major
    ]

    for beat in range(total_beats):
        time_seconds = beat * BEAT_SECONDS
        after_drop = beat >= DROP_BEAT
        if after_drop:
            kick_times.append(time_seconds)
            add_kick(drums, time_seconds, 0.92 if beat % 8 else 1.08)
            if beat % 4 in (1, 3):
                add_snare(drums, time_seconds, 0.58)
            add_hat(drums, time_seconds, 0.11, open_hat=False)
            add_hat(drums, time_seconds + BEAT_SECONDS / 2.0, 0.16, open_hat=beat % 4 == 3)
        elif beat % 2 == 0:
            add_hat(drums, time_seconds, 0.055, open_hat=False)

        if beat % 8 == 0:
            section = (beat // 8) % len(progression)
            chord, root = progression[section]
            chord_gain = 0.18 if beat < DROP_BEAT else 0.31
            add_supersaw(harmonic, time_seconds, BEAT_SECONDS * 8.0, chord, chord_gain)
            if after_drop:
                add_sub_bass(bass, time_seconds, BEAT_SECONDS * 8.0, root, 0.39)

    duck = sidechain_envelope(total_samples, kick_times)
    harmonic *= duck
    bass *= duck
    mix = drums * 0.68 + harmonic * 0.72 + bass * 0.58 + fx

    # A full 0.10 second vacuum immediately before the drop.
    silence_start = int((DROP_TIME - 0.10) * SAMPLE_RATE)
    silence_end = int(DROP_TIME * SAMPLE_RATE)
    mix[silence_start:silence_end] = 0.0

    # Gentle master saturation and a deterministic fade at both ends.
    mix = np.tanh(mix * 1.18)
    fade_samples = int(0.18 * SAMPLE_RATE)
    mix[:fade_samples] *= np.linspace(0.0, 1.0, fade_samples)
    mix[-fade_samples:] *= np.linspace(1.0, 0.0, fade_samples)
    peak = max(float(np.max(np.abs(mix))), 1e-9)
    mix = mix / peak * 0.91
    return np.stack((mix, mix), axis=1)


def write_wave(stereo: np.ndarray, destination: Path) -> None:
    pcm = np.int16(np.clip(stereo, -1.0, 1.0) * 32767)
    with wave.open(str(destination), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())


if __name__ == "__main__":
    score = build_score()
    write_wave(score, OUTPUT)
    print(f"Wrote {OUTPUT} ({DURATION_SECONDS:.1f}s, {BPM} BPM, {SAMPLE_RATE} Hz stereo)")
