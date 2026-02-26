import { useState, useRef, useCallback, useEffect } from 'react';
import { lerp, PHYSICS_CONFIG } from '../utils/wheelMath';

export const AUDIO_CONFIG = {
  noiseBufferSeconds: 2,
  noiseChannels: 1,

  // LFO (tremolo — creates the rhythmic click texture)
  lfoFreqMin: 2,          // Hz at slowest ball speed
  lfoFreqMax: 27,         // Hz at max ball speed (~14 rad/s)
  lfoDepth: 0.35,         // tremoloGain base = 0.5, swings ±0.35 → range [0.15, 0.85]

  // Rolling bandpass filter
  filterFreqMin: 600,     // Hz at low speed
  filterFreqMax: 2500,    // Hz at high speed (bright, crunchy)
  filterQMin: 3,
  filterQMax: 6,

  // Rolling envelope gain per physics state
  rollingOnTrackMin: 0.4,
  rollingOnTrackMax: 0.9,
  rollingDroppingMin: 0.3,
  rollingDroppingMax: 0.7,
  // In-pocket uses relative velocity (ball vs wheel), different filter character
  rollingInPocketMin: 0.3,
  rollingInPocketMax: 0.65,
  rollingInPocketFilterFreqMin: 300,  // hollow/wooden at slow relative speed
  rollingInPocketFilterFreqMax: 700,  // still lower/darker than outer track
  rollingInPocketLfoMax: 10,          // slower click rhythm
  maxRelVelocity: 4,                  // rad/s — typical max relative vel entering pocket
  rollingSettleRampMs: 150,
  gainSmoothTime: 0.04,   // seconds (setTargetAtTime time constant)

  maxBallVelocity: PHYSICS_CONFIG.ballInitialSpeedMax, // rad/s — sourced from PHYSICS_CONFIG

  // Deflector hit: sharp metallic tick
  deflectorFilterFreq: 2500,
  deflectorFilterQ: 12,
  deflectorGain: 0.6,
  deflectorDurationMs: 20,

  // Fret bounce: hollow plastic clack
  fretFilterFreq: 900,
  fretFilterQ: 8,
  fretGain: 0.35,
  fretDurationMs: 35,

  // Settle thud: low sine thump + short click on landing
  settleThumpFreq: 120,
  settleThumpGain: 0.4,
  settleThumpMs: 200,
  settleClickFilterFreq: 1200,
  settleClickFilterQ: 10,
  settleClickGain: 0.5,
  settleClickMs: 10,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Fill an AudioBuffer with pink noise using Paul Kellet's 7-filter approximation. */
function fillPinkNoise(buffer) {
  let b0, b1, b2, b3, b4, b5, b6;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0;
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616  * b5 - w * 0.0168980;
      b6 = w * 0.115926; // Fix 5: assign b6 BEFORE it is used in the output sum
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    }
  }
}

/** Create a short white-noise AudioBuffer (for collision transients). */
function makeNoiseBurst(ctx, durationSecs) {
  const length = Math.ceil(ctx.sampleRate * durationSecs);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Fire the one-shot settle thud: a low sine thump + a short click. */
// Fix 4: accept pre-allocated settleClickBuf instead of calling makeNoiseBurst
function fireSettleThud(ctx, masterGain, settleClickBuf) {
  const cfg = AUDIO_CONFIG;
  const now = ctx.currentTime;

  // Low resonant thump (sine oscillator)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = cfg.settleThumpFreq;
  oscGain.gain.setValueAtTime(cfg.settleThumpGain, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + cfg.settleThumpMs / 1000);
  osc.connect(oscGain);
  oscGain.connect(masterGain);
  osc.start(now);
  osc.stop(now + cfg.settleThumpMs / 1000 + 0.01);

  // Short hard click (noise burst through resonant filter)
  const clickDur = cfg.settleClickMs / 1000;
  const clickSrc = ctx.createBufferSource();
  clickSrc.buffer = settleClickBuf; // Fix 4: use pre-allocated buffer
  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = 'bandpass';
  clickFilter.frequency.value = cfg.settleClickFilterFreq;
  clickFilter.Q.value = cfg.settleClickFilterQ;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(cfg.settleClickGain, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + clickDur);
  clickSrc.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(masterGain);
  clickSrc.start(now);
  clickSrc.stop(now + clickDur + 0.005);
}

export default function useRouletteSounds() {
  const [isMuted, setIsMuted] = useState(() =>
    localStorage.getItem('claude-roulette-sound') === 'muted'
  );

  // Fix 1: keep isMuted in a ref so ensureContext can read it without closing over state
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted; // keep in sync on every render (no useEffect needed)

  const ctxRef          = useRef(null);
  const masterGainRef   = useRef(null);
  const rollingGainRef  = useRef(null);
  const tremoloGainRef  = useRef(null);
  const filterRef       = useRef(null);
  const lfoRef          = useRef(null);
  // Fix 2: store noiseSource so it can be stopped on unmount
  const noiseSourceRef  = useRef(null);
  // Fix 4: pre-allocated noise buffers
  const deflectorBufRef    = useRef(null);
  const fretBufRef         = useRef(null);
  const settleClickBufRef  = useRef(null);
  const settledRef      = useRef(false); // prevents thud firing on every settled frame

  // Fix 1: dep array is [] — isMuted is read via isMutedRef instead of closure
  const ensureContext = useCallback(() => {
    if (ctxRef.current) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;

    // masterGain → destination
    const masterGain = ctx.createGain();
    masterGain.gain.value = isMutedRef.current ? 0 : 1; // Fix 1: use ref
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // rollingGain → masterGain  (overall spin envelope)
    const rollingGain = ctx.createGain();
    rollingGain.gain.value = 0;
    rollingGain.connect(masterGain);
    rollingGainRef.current = rollingGain;

    // tremoloGain → rollingGain  (LFO amplitude modulation)
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.5; // base; LFO adds ±lfoDepth
    tremoloGain.connect(rollingGain);
    tremoloGainRef.current = tremoloGain;

    // bandpassFilter → tremoloGain
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = AUDIO_CONFIG.filterFreqMin;
    filter.Q.value = AUDIO_CONFIG.filterQMin;
    filter.connect(tremoloGain);
    filterRef.current = filter;

    // Pink noise source → filter (looping)
    const noiseBuffer = ctx.createBuffer(
      AUDIO_CONFIG.noiseChannels,
      ctx.sampleRate * AUDIO_CONFIG.noiseBufferSeconds,
      ctx.sampleRate
    );
    fillPinkNoise(noiseBuffer);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.connect(filter);
    noiseSource.start();
    noiseSourceRef.current = noiseSource; // Fix 2: store for cleanup

    // LFO → lfoDepthGain → tremoloGain.gain (AudioParam)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = AUDIO_CONFIG.lfoFreqMin;
    const lfoDepthGain = ctx.createGain();
    lfoDepthGain.gain.value = AUDIO_CONFIG.lfoDepth;
    lfo.connect(lfoDepthGain);
    lfoDepthGain.connect(tremoloGain.gain);
    lfo.start();
    lfoRef.current = lfo;

    // Fix 4: pre-allocate noise burst buffers to avoid per-call GC pressure
    const cfg = AUDIO_CONFIG;
    deflectorBufRef.current   = makeNoiseBurst(ctx, cfg.deflectorDurationMs / 1000);
    fretBufRef.current        = makeNoiseBurst(ctx, cfg.fretDurationMs / 1000);
    settleClickBufRef.current = makeNoiseBurst(ctx, cfg.settleClickMs / 1000);
  }, []); // Fix 1: empty dep array — no longer closes over isMuted state

  // Fix 2: close AudioContext and stop nodes on unmount
  useEffect(() => {
    return () => {
      if (noiseSourceRef.current) {
        try { noiseSourceRef.current.stop(); } catch (_) {}
      }
      if (lfoRef.current) {
        try { lfoRef.current.stop(); } catch (_) {}
      }
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
    };
  }, []); // run cleanup on unmount only

  const updateAudio = useCallback((physState) => {
    ensureContext();
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    // Fix 8: guard against ensureContext throwing before populating refs
    if (!lfoRef.current) return;

    const ball = physState.ball;
    const cfg  = AUDIO_CONFIG;

    if (ball.state === 'settled') {
      if (!settledRef.current) {
        settledRef.current = true;
        const ramp = cfg.rollingSettleRampMs / 1000;
        rollingGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, ramp / 3);
        // Fix 4: pass pre-allocated settleClickBuf; Fix 6: removed dead settleTimerRef block
        fireSettleThud(ctx, masterGainRef.current, settleClickBufRef.current);
      }
      return;
    }

    // Reset for next spin
    // Fix 6: removed dead settleTimerRef clearTimeout block
    if (settledRef.current) settledRef.current = false;

    const speedNorm = clamp(Math.abs(ball.velocity) / cfg.maxBallVelocity, 0, 1);

    // Each state controls its own filter, LFO, and gain — in_pocket uses relative velocity
    let targetGain;
    switch (ball.state) {
      case 'on_track': {
        lfoRef.current.frequency.value    = lerp(cfg.lfoFreqMin,    cfg.lfoFreqMax,    speedNorm);
        filterRef.current.frequency.value = lerp(cfg.filterFreqMin, cfg.filterFreqMax, speedNorm);
        filterRef.current.Q.value         = lerp(cfg.filterQMin,    cfg.filterQMax,    speedNorm);
        targetGain = lerp(cfg.rollingOnTrackMin, cfg.rollingOnTrackMax, speedNorm);
        break;
      }
      case 'dropping': {
        lfoRef.current.frequency.value    = lerp(cfg.lfoFreqMin,    cfg.lfoFreqMax,    speedNorm);
        filterRef.current.frequency.value = lerp(cfg.filterFreqMin, cfg.filterFreqMax, speedNorm);
        filterRef.current.Q.value         = lerp(cfg.filterQMin,    cfg.filterQMax,    speedNorm);
        targetGain = lerp(cfg.rollingDroppingMin, cfg.rollingDroppingMax, speedNorm);
        break;
      }
      case 'in_pocket': {
        // Use relative velocity so the rolling sound reflects actual motion within the pocket,
        // not the wheel spin. ball.velocity ≈ wheelVelocity when deeply settled, so
        // relVel → 0 and sound fades naturally.
        const relVel  = Math.abs(ball.velocity - physState.wheel.velocity);
        const relNorm = clamp(relVel / cfg.maxRelVelocity, 0, 1);
        lfoRef.current.frequency.value    = lerp(cfg.lfoFreqMin, cfg.rollingInPocketLfoMax, relNorm);
        filterRef.current.frequency.value = lerp(cfg.rollingInPocketFilterFreqMin, cfg.rollingInPocketFilterFreqMax, relNorm);
        filterRef.current.Q.value         = lerp(cfg.filterQMin, cfg.filterQMax, relNorm);
        targetGain = lerp(cfg.rollingInPocketMin, cfg.rollingInPocketMax, relNorm);
        break;
      }
      default:
        targetGain = 0;
    }
    rollingGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, cfg.gainSmoothTime);
  }, [ensureContext]);

  const triggerCollision = useCallback((type) => {
    ensureContext();
    const ctx = ctxRef.current;
    if (!ctx || !masterGainRef.current) return;
    // Fix 3: resume suspended context instead of silently dropping collision sounds
    if (ctx.state === 'suspended') ctx.resume();

    const cfg          = AUDIO_CONFIG;
    const isDeflector  = type === 'deflector';
    const durationSecs = (isDeflector ? cfg.deflectorDurationMs : cfg.fretDurationMs) / 1000;
    const filterFreq   = isDeflector ? cfg.deflectorFilterFreq  : cfg.fretFilterFreq;
    const filterQ      = isDeflector ? cfg.deflectorFilterQ     : cfg.fretFilterQ;
    const peakGain     = isDeflector ? cfg.deflectorGain        : cfg.fretGain;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    // Fix 4: use pre-allocated buffer instead of allocating a fresh one per call
    src.buffer = isDeflector ? deflectorBufRef.current : fretBufRef.current;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSecs);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);
    src.start(now);
    src.stop(now + durationSecs + 0.005);
  }, [ensureContext]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('claude-roulette-sound', next ? 'muted' : 'unmuted');
      if (masterGainRef.current) masterGainRef.current.gain.value = next ? 0 : 1;
      return next;
    });
  }, []);

  return { updateAudio, triggerCollision, isMuted, toggleMute };
}
