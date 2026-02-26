# Design: Realistic Casino Roulette Sound (Approach A)

**Date:** 2026-02-26
**Status:** Approved

---

## Problem

The current sound uses white noise through a bandpass filter (sounds like wind) and pure sine oscillators for collisions (sounds like test equipment). Real casino roulette has a distinctive rhythmic "click-rattle" that accelerates and decelerates with the ball.

## Approach: Amplitude-Modulated Pink Noise

The key acoustic insight: a roulette ball makes micro-impacts as it rolls, creating amplitude spikes at a rate proportional to its angular velocity. This produces the characteristic "rattling rhythm" that slows as the ball decelerates. Modelling this with an LFO whose frequency tracks `|ball.velocity|` captures the effect faithfully.

---

## Audio Graph

```
pinkNoise (looping buffer)
  → bandpassFilter  (freq: 600–2500 Hz, Q: 3–6, driven per frame)
  → tremoloGain     (base gain: 0.5, modulated by LFO ±0.35)
  → rollingGain     (envelope: 0 → active → 0, state-driven)
  → masterGain      (0 when muted, 1 when unmuted)
  → destination

LFO (OscillatorNode, sine)
  → lfoDepthGain    (gain = 0.35)
  → tremoloGain.gain (AudioParam)
```

**tremoloGain** oscillates between 0.15 and 0.85 — never fully silent, never fully loud. This matches the real sound: continuous hiss with rhythmic intensity spikes.

---

## Pink Noise Generation

Use Paul Kellet's algorithm (7-filter approximation) to fill the AudioBuffer with pink noise instead of white. Pink noise has a -3 dB/octave rolloff, making it warmer and more natural for physical materials.

---

## Per-Frame Updates (`updateAudio`)

Each animation frame:

| Parameter | Value |
|---|---|
| `lfo.frequency` | `speedNorm × 25 + 2` Hz (range: 2–27 Hz) |
| `filter.frequency` | `lerp(600, 2500, speedNorm)` Hz |
| `filter.Q` | `lerp(3, 6, speedNorm)` |

State-based `rollingGain` targets:

| State | Target gain |
|---|---|
| `on_track` | `lerp(0.4, 0.9, speedNorm)` — loud and bright |
| `dropping` | `lerp(0.3, 0.7, speedNorm)` — slightly reduced |
| `in_pocket` | `lerp(0.05, 0.25, speedNorm)` — muffled |
| `settled` | ramp to 0 over 150 ms, then fire settle thud |

---

## Collision Sounds (Noise Bursts, No Sine Tones)

Both collision types use a short white-noise burst through a resonant bandpass filter — not sine oscillators.

| Type | Filter freq | Q | Peak gain | Duration |
|---|---|---|---|---|
| Deflector hit | 2500 Hz | 12 | 0.6 | 20 ms |
| Fret bounce | 900 Hz | 8 | 0.35 | 35 ms |

---

## Settle Thud

Fired once when `ball.state` transitions to `settled`:
- **Low thump:** OscillatorNode (sine, 120 Hz), gain 0.4 → 0 over 200 ms
- **Hard click:** 10 ms noise burst, bandpass 1200 Hz, Q=10 — the ball physically landing

---

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useRouletteSounds.js` | Full rewrite of audio graph and synthesis |

No other files need changes — the hook's external API (`updateAudio`, `triggerCollision`, `isMuted`, `toggleMute`) stays identical.
