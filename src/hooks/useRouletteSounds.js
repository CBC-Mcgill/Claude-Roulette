import { useState, useRef, useCallback } from 'react';
import { lerp } from '../utils/wheelMath';

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
  rollingInPocketMin: 0.05,
  rollingInPocketMax: 0.25,
  rollingSettleRampMs: 150,
  gainSmoothTime: 0.04,   // seconds (setTargetAtTime time constant)

  maxBallVelocity: 14,    // rad/s (matches ballInitialSpeedMax in PHYSICS_CONFIG)

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
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
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
function fireSettleThud(ctx, masterGain) {
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
  clickSrc.buffer = makeNoiseBurst(ctx, clickDur);
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

  const ctxRef         = useRef(null);
  const masterGainRef  = useRef(null);
  const rollingGainRef = useRef(null);
  const tremoloGainRef = useRef(null);
  const filterRef      = useRef(null);
  const lfoRef         = useRef(null);
  const settleTimerRef = useRef(null);
  const settledRef     = useRef(false); // prevents thud firing on every settled frame

  const ensureContext = useCallback(() => {
    if (ctxRef.current) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;

    // masterGain → destination
    const masterGain = ctx.createGain();
    masterGain.gain.value = isMuted ? 0 : 1;
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
  }, [isMuted]);

  const updateAudio = useCallback((physState) => {
    ensureContext();
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const ball = physState.ball;
    const cfg  = AUDIO_CONFIG;

    if (ball.state === 'settled') {
      if (!settledRef.current) {
        settledRef.current = true;
        const ramp = cfg.rollingSettleRampMs / 1000;
        rollingGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, ramp / 3);
        fireSettleThud(ctx, masterGainRef.current);
        settleTimerRef.current = setTimeout(() => {
          settleTimerRef.current = null;
        }, cfg.rollingSettleRampMs + 100);
      }
      return;
    }

    // Reset for next spin
    if (settledRef.current) settledRef.current = false;
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }

    const speedNorm = clamp(Math.abs(ball.velocity) / cfg.maxBallVelocity, 0, 1);

    // LFO rate tracks ball speed → rhythmic click texture slows with ball
    lfoRef.current.frequency.value = lerp(cfg.lfoFreqMin, cfg.lfoFreqMax, speedNorm);

    // Filter brightness tracks speed
    filterRef.current.frequency.value = lerp(cfg.filterFreqMin, cfg.filterFreqMax, speedNorm);
    filterRef.current.Q.value         = lerp(cfg.filterQMin,    cfg.filterQMax,    speedNorm);

    // Rolling gain envelope per physics state
    let targetGain;
    switch (ball.state) {
      case 'on_track':
        targetGain = lerp(cfg.rollingOnTrackMin,  cfg.rollingOnTrackMax,  speedNorm);
        break;
      case 'dropping':
        targetGain = lerp(cfg.rollingDroppingMin, cfg.rollingDroppingMax, speedNorm);
        break;
      case 'in_pocket':
        targetGain = lerp(cfg.rollingInPocketMin, cfg.rollingInPocketMax, speedNorm);
        break;
      default:
        targetGain = 0;
    }
    rollingGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, cfg.gainSmoothTime);
  }, [ensureContext]);

  const triggerCollision = useCallback((type) => {
    ensureContext();
    const ctx = ctxRef.current;
    if (!ctx || !masterGainRef.current) return;
    if (ctx.state === 'suspended') return;

    const cfg          = AUDIO_CONFIG;
    const isDeflector  = type === 'deflector';
    const durationSecs = (isDeflector ? cfg.deflectorDurationMs : cfg.fretDurationMs) / 1000;
    const filterFreq   = isDeflector ? cfg.deflectorFilterFreq  : cfg.fretFilterFreq;
    const filterQ      = isDeflector ? cfg.deflectorFilterQ     : cfg.fretFilterQ;
    const peakGain     = isDeflector ? cfg.deflectorGain        : cfg.fretGain;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBurst(ctx, durationSecs);

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
