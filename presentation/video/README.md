# PayIntent presentation film

This 44-second, 60 fps film opens as an ad and transitions into a product walkthrough. It is designed for the PayPal AI Hackathon submission video and stays below the official three-minute limit.

## Generate

```powershell
python presentation/video/make_audio.py
python presentation/video/render.py
```

The renderer uses Playwright Chromium for deterministic frames and FFmpeg for the final MP4. `index.html` exposes `window.renderFrame(frameIndex, fps)` and keeps animation synchronized to 120 BPM.

## Structure

- 0–4s: payment ambiguity problem
- 4–10s: PayIntent promise
- 10–18s: natural-language payment request
- 18–26s: focused clarification
- 26–35s: exact invoice review and PayPal Sandbox draft
- 35–41s: deterministic rules, human approval and audit trail
- 41–44s: final brand statement

The score is synthesized locally: kick, seven-voice supersaws, snare, hats, sub bass, sidechain ducking and a 0.10-second silence before the drop.
