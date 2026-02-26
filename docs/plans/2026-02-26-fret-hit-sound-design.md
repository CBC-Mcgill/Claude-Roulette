# Design: Velocity-Scaled Fret Hit Sound

## Context

The roulette wheel already detects fret collisions in `updateBallInPocket` and triggers
`triggerCollision('fret')` each frame a bounce occurs. The sound is a fixed-volume
"hollow plastic clack" regardless of impact speed. Now that frets are styled as raised
metallic walls, the sound should feel physically connected — a light graze should be a
soft tick, a hard bounce a sharp metallic clink.

## Approach

Pass the relative velocity at impact from the physics engine through to the audio hook.
Scale gain and filter brightness proportionally. No physics behavior changes.

## Data Flow

```
updateBallInPocket()  →  { fretHit: true, fretHitVelocity: |relVel| }
        ↓
animate() in RouletteWheel.jsx
        ↓
triggerCollision('fret', fretHitVelocity)
        ↓
useRouletteSounds.js  →  velocity → gain + filterFreq
```

## File Changes

### `src/utils/wheelMath.js`

`updateBallInPocket` already holds `relVel = ball.velocity - wheelVelocity`. When a fret
hit is detected, add `fretHitVelocity: Math.abs(relVel)` to the return value alongside
`fretHit: true`. The settle return also needs `fretHitVelocity` (0 or the last hit value,
since settling may coincide with a final fret touch — passing the relVel at that moment
is fine).

### `src/components/RouletteWheel.jsx`

One-line change in the `animate` function:

```js
// Before
if (collision?.fretHit) triggerCollision('fret');

// After
if (collision?.fretHit) triggerCollision('fret', collision.fretHitVelocity);
```

### `src/hooks/useRouletteSounds.js`

1. Add to `AUDIO_CONFIG`:
   ```js
   fretGainMin: 0.08,        // gain at near-zero impact velocity
   fretFilterFreqMin: 700,   // Hz at soft hit (existing fretFilterFreq becomes the max)
   ```

2. `triggerCollision(type, velocity)` — add optional `velocity` param:
   - For deflector hits: `velocity` is unused (existing behavior unchanged)
   - For fret hits: normalize `velocity` against `maxRelVelocity` (already in config),
     then lerp gain from `fretGainMin` → `fretGain` and filter freq from
     `fretFilterFreqMin` → `fretFilterFreq`

## Scaling Formula

```js
const velNorm = clamp(velocity / cfg.maxRelVelocity, 0, 1);
const peakGain = lerp(cfg.fretGainMin, cfg.fretGain, velNorm);
const filterFreq = lerp(cfg.fretFilterFreqMin, cfg.fretFilterFreq, velNorm);
```

## Config Values

| Key | Value | Notes |
|-----|-------|-------|
| `fretGainMin` | 0.08 | Near-silent at grazing contact |
| `fretGain` | 0.35 | Existing max (hard hit) |
| `fretFilterFreqMin` | 700 Hz | Dull tick at low velocity |
| `fretFilterFreq` | 900 Hz | Existing — slightly metallic at high velocity |
| `maxRelVelocity` | 4 rad/s | Already in config — normalisation reference |

## Non-Goals

- No change to fret collision detection or bounce physics
- No new oscillator or resonance layer (that is Option C)
- Deflector sound is unchanged
