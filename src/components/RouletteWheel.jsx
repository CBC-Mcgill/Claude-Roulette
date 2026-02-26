import { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  EUROPEAN_ORDER,
  TOTAL_POCKETS,
  getPocketColor,
  getSegmentAngle,
  normalizeAngle,
  distributeNames,
  getBallPosition,
  createPhysicsState,
  updateWheelPhysics,
  updateBallOnTrack,
  updateBallDropping,
  updateBallInPocket,
  randomBallVelocity,
  getPocketAtBall,
} from '../utils/wheelMath';
import useRouletteSounds from '../hooks/useRouletteSounds';
import SoundToggle from './SoundToggle';
import './RouletteWheel.css';

const MIN_CANVAS_SIZE = 200;
const MAX_CANVAS_SIZE = 700;

const NUM_DEFLECTORS = 8;

// Safety timeout: force-settle after 22 seconds (extended for slower physics)
const MAX_SPIN_DURATION = 22000;

// Distinct color palette for names
const NAME_COLORS = [
  '#da7756', '#5a8a6a', '#4a90d9', '#d4a843',
  '#9b59b6', '#2ecc71', '#e74c3c', '#1abc9c',
  '#f39c12', '#8e44ad', '#3498db', '#e67e22',
  '#c0392b', '#16a085', '#2980b9', '#d35400',
  '#27ae60', '#7f8c8d', '#c76b4a', '#6c5ce7',
];

export default function RouletteWheel({ names, spinning, onSpinEnd, onSpin, theme }) {
  const { updateAudio, triggerCollision, isMuted, toggleMute } = useRouletteSounds();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const spinningRef = useRef(false);
  const wheelAngleRef = useRef(0);
  const sizeRef = useRef(400);
  const hoverCenterRef = useRef(false);
  const winningPocketRef = useRef(-1);
  const showWinHighlightRef = useRef(false);
  const prevPocketIdxRef = useRef(-1);

  // Memoize pocket layout: only reshuffles when names change
  const pocketNames = useMemo(() => {
    return distributeNames(names, TOTAL_POCKETS);
  }, [names]);

  // Assign a unique color to each distinct name
  const nameColorMap = useMemo(() => {
    const map = {};
    const unique = [...new Set(names)];
    unique.forEach((name, idx) => {
      map[name] = NAME_COLORS[idx % NAME_COLORS.length];
    });
    return map;
  }, [names]);

  const segmentAngle = getSegmentAngle(TOTAL_POCKETS);

  const draw = useCallback((wheelAngle, ballAngle, ballRadius, showBall, highlightPocket) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = sizeRef.current;
    const half = size / 2;
    const cx = half;
    const cy = half;

    // High-DPI setup
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const styles = getComputedStyle(document.documentElement);
    const colorCard = styles.getPropertyValue('--color-card').trim() || '#ffffff';
    const colorTextMuted = styles.getPropertyValue('--color-text-muted').trim() || '#b0aea5';

    // Radii
    const outerRadius = half - 2;
    const rimWidth = outerRadius * 0.08;
    const trackOuterR = outerRadius - rimWidth;
    const trackWidth = outerRadius * 0.06;
    const trackInnerR = trackOuterR - trackWidth;
    const pocketOuterR = trackInnerR - 2;
    const pocketInnerR = outerRadius * 0.28;
    const centerR = outerRadius * 0.22;
    const ballTrackR = (trackOuterR + trackInnerR) / 2;

    if (names.length === 0) {
      // Empty state
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = colorTextMuted + '22';
      ctx.fill();
      ctx.strokeStyle = colorTextMuted;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = colorTextMuted;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add names to spin!', cx, cy);
      return;
    }

    // === 1. Outer wooden rim ===
    const rimGrad = ctx.createRadialGradient(cx, cy, trackOuterR, cx, cy, outerRadius);
    rimGrad.addColorStop(0, '#6b4226');
    rimGrad.addColorStop(0.5, '#8b5e3c');
    rimGrad.addColorStop(1, '#5a3520');
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Rim inner edge highlight
    ctx.beginPath();
    ctx.arc(cx, cy, trackOuterR + 1, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,220,180,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // === 2. Ball track ===
    ctx.beginPath();
    ctx.arc(cx, cy, trackOuterR, 0, 2 * Math.PI);
    ctx.arc(cx, cy, trackInnerR, 0, 2 * Math.PI, true);
    ctx.closePath();
    const trackGrad = ctx.createRadialGradient(cx, cy, trackInnerR, cx, cy, trackOuterR);
    trackGrad.addColorStop(0, '#2a2a28');
    trackGrad.addColorStop(0.5, '#3a3a36');
    trackGrad.addColorStop(1, '#2a2a28');
    ctx.fillStyle = trackGrad;
    ctx.fill();

    // === 3. Diamond deflectors on the track ===
    for (let i = 0; i < NUM_DEFLECTORS; i++) {
      const deflAngle = (i / NUM_DEFLECTORS) * 2 * Math.PI;
      const dx = cx + Math.cos(deflAngle) * ballTrackR;
      const dy = cy + Math.sin(deflAngle) * ballTrackR;
      const dSize = outerRadius * 0.025;

      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(deflAngle + Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -dSize);
      ctx.lineTo(dSize * 0.6, 0);
      ctx.lineTo(0, dSize);
      ctx.lineTo(-dSize * 0.6, 0);
      ctx.closePath();
      ctx.fillStyle = '#c0c0c0';
      ctx.fill();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    }

    // === 4. Pockets (rotate with the wheel) ===
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelAngle);

    for (let i = 0; i < TOTAL_POCKETS; i++) {
      const pocketNum = EUROPEAN_ORDER[i];
      const startA = i * segmentAngle - Math.PI / 2;
      const endA = startA + segmentAngle;
      const bgColor = getPocketColor(pocketNum);

      // Pocket fill
      ctx.beginPath();
      ctx.arc(0, 0, pocketOuterR, startA, endA);
      ctx.arc(0, 0, pocketInnerR, endA, startA, true);
      ctx.closePath();
      ctx.fillStyle = bgColor;
      ctx.fill();

      // Highlight winning pocket
      if (highlightPocket === i) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.globalAlpha = 1;
        // Glow
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Fret wall (3D bevel: highlight + body + shadow)
      const halfFret = segmentAngle * 0.06;
      const fretLines = [
        { offset: -halfFret, color: '#e8e8d0', width: 1.5 }, // bright highlight
        { offset: 0,         color: '#a0a090', width: 2   }, // main body
        { offset: +halfFret, color: '#404038', width: 1.5 }, // dark shadow
      ];
      for (const { offset, color, width } of fretLines) {
        const a = startA + offset;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * pocketInnerR, Math.sin(a) * pocketInnerR);
        ctx.lineTo(Math.cos(a) * pocketOuterR, Math.sin(a) * pocketOuterR);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      }

      // Name label — text along the radial direction, reading outward from center
      const midAngle = startA + segmentAngle / 2;
      const pocketDepth = pocketOuterR - pocketInnerR;
      const fontSize = Math.max(6, Math.min(10, pocketDepth / 9));

      let displayName = pocketNames[i] || '';
      if (displayName) {
        ctx.save();
        ctx.rotate(midAngle);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';

        const maxTextWidth = pocketDepth - 22;
        // Truncate if needed
        let truncated = displayName;
        while (truncated.length > 1 && ctx.measureText(truncated).width > maxTextWidth) {
          truncated = truncated.slice(0, -1);
        }
        if (truncated.length < displayName.length) {
          truncated = truncated.slice(0, -1) + '\u2026';
        }

        const textR = (pocketOuterR + pocketInnerR) / 2;
        ctx.fillText(truncated, textR, 0);
        ctx.restore();
      }

      // Pocket number (small, near inner edge)
      ctx.save();
      ctx.rotate(midAngle);
      ctx.font = `${Math.max(5, fontSize - 2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(String(pocketNum), pocketInnerR + 10, 0);
      ctx.restore();
    }

    ctx.restore(); // end wheel rotation

    // === 5. Center hub (metallic) ===
    const hubGrad = ctx.createRadialGradient(
      cx - centerR * 0.3, cy - centerR * 0.3, 0,
      cx, cy, centerR
    );
    hubGrad.addColorStop(0, '#e8e8e0');
    hubGrad.addColorStop(0.4, '#c8c8b8');
    hubGrad.addColorStop(0.7, '#a0a090');
    hubGrad.addColorStop(1, '#787868');
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center hub inner decoration
    const innerHubR = centerR * 0.65;
    const innerGrad = ctx.createRadialGradient(
      cx - innerHubR * 0.2, cy - innerHubR * 0.2, 0,
      cx, cy, innerHubR
    );
    innerGrad.addColorStop(0, '#d4d4c8');
    innerGrad.addColorStop(1, '#a0a090');
    ctx.beginPath();
    ctx.arc(cx, cy, innerHubR, 0, 2 * Math.PI);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // "SPIN" text or logo in center
    ctx.fillStyle = hoverCenterRef.current ? '#da7756' : '#666';
    ctx.font = `bold ${centerR * 0.35}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', cx, cy);

    // === 6. Ball ===
    if (showBall) {
      const ballPos = getBallPosition(cx, cy, ballRadius, ballAngle);
      const ballSize = outerRadius * 0.03;

      // Ball shadow
      ctx.beginPath();
      ctx.arc(ballPos.x + 2, ballPos.y + 2, ballSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Ball
      const ballGrad = ctx.createRadialGradient(
        ballPos.x - ballSize * 0.3, ballPos.y - ballSize * 0.3, 0,
        ballPos.x, ballPos.y, ballSize
      );
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.7, '#e0e0e0');
      ballGrad.addColorStop(1, '#b0b0b0');
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballSize, 0, 2 * Math.PI);
      ctx.fillStyle = ballGrad;
      ctx.fill();
    }
  }, [names, pocketNames, nameColorMap, segmentAngle]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId = null;
    const observer = new ResizeObserver(() => {
      if (spinningRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const newSize = Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, Math.floor(Math.min(rect.width, rect.height))));
        sizeRef.current = newSize;
        draw(wheelAngleRef.current, 0, 0, false, -1);
      });
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [draw]);

  // Static draw when not spinning
  useEffect(() => {
    if (!spinningRef.current) {
      const hp = showWinHighlightRef.current ? winningPocketRef.current : -1;
      draw(wheelAngleRef.current, 0, 0, false, hp);
    }
  }, [names, theme, draw]);

  // Mouse tracking for center hub hover
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function isInCenter(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const dist = Math.sqrt(x * x + y * y);
      const centerR = (sizeRef.current / 2) * 0.22;
      return dist <= centerR;
    }

    function handleMove(e) {
      const inCenter = isInCenter(e);
      if (inCenter !== hoverCenterRef.current) {
        hoverCenterRef.current = inCenter;
        canvas.style.cursor = inCenter ? 'pointer' : 'default';
        if (!spinningRef.current) {
          const hp = showWinHighlightRef.current ? winningPocketRef.current : -1;
          draw(wheelAngleRef.current, 0, 0, false, hp);
        }
      }
    }

    function handleClick(e) {
      if (isInCenter(e) && !spinningRef.current && onSpin && names.length >= 2) {
        onSpin();
      }
    }

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [draw, onSpin, names]);

  // Physics-based spin animation
  useEffect(() => {
    if (!spinning) return;
    if (spinningRef.current) return;

    spinningRef.current = true;
    prevPocketIdxRef.current = -1;
    showWinHighlightRef.current = false;

    if (names.length < 2) {
      spinningRef.current = false;
      return;
    }

    // Compute radii
    const size = sizeRef.current;
    const half = size / 2;
    const outerRadius = half - 2;
    const rimWidth = outerRadius * 0.08;
    const trackOuterR = outerRadius - rimWidth;
    const trackWidth = outerRadius * 0.06;
    const trackInnerR = trackOuterR - trackWidth;
    const pocketOuterR = trackInnerR - 2;
    const pocketInnerR = outerRadius * 0.28;
    const ballTrackR = (trackOuterR + trackInnerR) / 2;
    const pocketR = (pocketOuterR + pocketInnerR) / 2;

    const initialWheelAngle = wheelAngleRef.current;
    const ballStartAngle = Math.random() * 2 * Math.PI;
    const ballVelocity = randomBallVelocity();

    // Create physics state — no rigging, pure physics
    const physState = createPhysicsState(
      initialWheelAngle, ballStartAngle, ballVelocity, ballTrackR, pocketR
    );

    const startTime = performance.now();
    let lastTime = startTime;

    function finishSpin(settledPocket) {
      // Snap ball to pocket center
      const pocketLocalAngle = settledPocket * segmentAngle + segmentAngle / 2 - Math.PI / 2;
      const finalBallAngle = physState.wheel.angle + pocketLocalAngle;

      wheelAngleRef.current = physState.wheel.angle;
      draw(physState.wheel.angle, finalBallAngle, pocketR, true, settledPocket);

      spinningRef.current = false;
      winningPocketRef.current = settledPocket;
      showWinHighlightRef.current = true;
      animFrameRef.current = null;

      // Check if the pocket has a name — if not, no winner (pass -1)
      const nameInPocket = pocketNames[settledPocket];
      if (nameInPocket) {
        const winnerIndex = names.indexOf(nameInPocket);
        onSpinEnd(winnerIndex);
      } else {
        onSpinEnd(-1);
      }
    }

    function animate(now) {
      let dt = (now - lastTime) / 1000;
      lastTime = now;

      // Clamp dt to avoid huge jumps (e.g., tab was backgrounded)
      if (dt > 0.05) dt = 0.05;

      const elapsed = now - startTime;

      // Safety timeout
      if (elapsed > MAX_SPIN_DURATION) {
        const pocket = getPocketAtBall(physState.ball.angle, physState.wheel.angle, segmentAngle);
        finishSpin(pocket);
        return;
      }

      // Update wheel
      updateWheelPhysics(physState.wheel, dt);

      // Update ball based on state
      let highlightPocket = -1;
      let collision = null;

      switch (physState.ball.state) {
        case 'on_track':
          updateBallOnTrack(physState.ball, dt);
          break;
        case 'dropping':
          collision = updateBallDropping(physState.ball, dt, physState.wheel.angle);
          break;
        case 'in_pocket':
          collision = updateBallInPocket(physState.ball, dt, physState.wheel.angle, physState.wheel.velocity, segmentAngle);
          break;
        case 'settled': {
          const pocket = getPocketAtBall(physState.ball.angle, physState.wheel.angle, segmentAngle);
          finishSpin(pocket);
          return;
        }
      }

      // Trigger collision sounds
      if (collision?.deflectorHit) triggerCollision('deflector');

      // Geometric fret-crossing sound (fires during dropping + in_pocket)
      const ballState = physState.ball.state;
      if (ballState === 'dropping' || ballState === 'in_pocket') {
        const relAngle = normalizeAngle(physState.ball.angle - physState.wheel.angle + Math.PI / 2);
        const curPocketIdx = Math.floor(relAngle / segmentAngle) % TOTAL_POCKETS;
        if (prevPocketIdxRef.current !== -1 && curPocketIdx !== prevPocketIdxRef.current) {
          const relSpeed = Math.abs(physState.ball.velocity - physState.wheel.velocity);
          triggerCollision('fret', relSpeed);
        }
        prevPocketIdxRef.current = curPocketIdx;
      } else {
        prevPocketIdxRef.current = -1;
      }

      // Update rolling audio each frame
      updateAudio(physState);

      // Draw current state
      wheelAngleRef.current = physState.wheel.angle;
      draw(
        physState.wheel.angle,
        physState.ball.angle,
        physState.ball.radius,
        true,
        highlightPocket
      );

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      spinningRef.current = false;
    };
  }, [spinning]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="roulette-wheel" ref={containerRef}>
      <canvas ref={canvasRef} className="roulette-wheel__canvas" />
      <SoundToggle isMuted={isMuted} onToggle={toggleMute} />
    </div>
  );
}
