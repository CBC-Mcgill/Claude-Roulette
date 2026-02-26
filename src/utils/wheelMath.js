// European roulette pocket order (0-36)
export const EUROPEAN_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const TOTAL_POCKETS = 37;

// Red pocket numbers in European roulette
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

/**
 * Returns the color for a given pocket number.
 * 0 = green, red numbers = brand orange, rest = dark brown
 */
export function getPocketColor(number) {
  if (number === 0) return '#5a8a6a';
  if (RED_NUMBERS.has(number)) return '#da7756';
  return '#bd5d3a';
}

/**
 * Returns the angle (in radians) per segment.
 */
export function getSegmentAngle(totalSegments) {
  if (totalSegments <= 1) return 2 * Math.PI;
  return (2 * Math.PI) / totalSegments;
}

/**
 * Normalizes an angle to the [0, 2*PI) range.
 */
export function normalizeAngle(angle) {
  const twoPi = 2 * Math.PI;
  return ((angle % twoPi) + twoPi) % twoPi;
}

/**
 * Fisher-Yates shuffle (returns new array).
 */
export function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Place each name exactly once in a random pocket. Remaining pockets are empty ('').
 * Returns an array of length totalPockets.
 */
export function distributeNames(names, totalPockets = TOTAL_POCKETS) {
  if (!names || names.length === 0) return Array(totalPockets).fill('');

  const slots = Array(totalPockets).fill('');
  const indices = shuffleArray(Array.from({ length: totalPockets }, (_, i) => i));
  const count = Math.min(names.length, totalPockets);
  for (let i = 0; i < count; i++) {
    slots[indices[i]] = names[i];
  }
  return slots;
}

/**
 * Get ball position on a circular track.
 */
export function getBallPosition(centerX, centerY, trackRadius, angle) {
  return {
    x: centerX + Math.cos(angle) * trackRadius,
    y: centerY + Math.sin(angle) * trackRadius,
  };
}

/**
 * Linear interpolation.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ============================================================
// Physics Engine
// ============================================================

export const PHYSICS_CONFIG = {
  // Wheel
  wheelFriction: -0.12,           // rad/s² (slow deceleration)
  wheelInitialSpeed: 2.5,         // rad/s (constant for now)

  // Ball on track (counter-clockwise, high initial speed)
  ballInitialSpeedMin: 10.0,      // rad/s
  ballInitialSpeedMax: 14.0,      // rad/s
  ballTrackFriction: -1.2,        // rad/s² (ball decelerates on track)
  ballCriticalVelocity: 3.0,      // rad/s — below this, ball leaves track

  // Ball dropping (spiraling inward)
  ballRadialAccel: -100.0,        // px/s² inward (toward center) — slower spiral for drama
  ballRadialDrag: -2.5,           // damping factor on radial velocity
  deflectorRestitution: 0.6,      // energy retained on deflector hit
  deflectorCount: 8,

  // Ball in pocket
  inPocketFriction: 0.25,         // exponential decay base for relative velocity (lower = slower settle)
  fretRestitution: 0.45,          // energy retained on fret bounce
  settleAngularThreshold: 0.1,    // rad/s
  settleRadialThreshold: 0.5,     // px/s

};

/**
 * Create initial physics state for a spin.
 */
export function createPhysicsState(wheelAngle0, ballAngle0, ballVelocity, ballTrackR, pocketR) {
  return {
    wheel: {
      angle: wheelAngle0,
      velocity: PHYSICS_CONFIG.wheelInitialSpeed,
    },
    ball: {
      state: 'on_track',        // 'on_track' | 'dropping' | 'in_pocket' | 'settled'
      angle: ballAngle0,
      velocity: ballVelocity,   // angular velocity (negative = counter-clockwise)
      radius: ballTrackR,
      radialVelocity: 0,
      trackR: ballTrackR,
      pocketR: pocketR,
    },
  };
}

/**
 * Update wheel physics: constant friction deceleration, minimum speed 0.05.
 */
export function updateWheelPhysics(wheel, dt) {
  wheel.velocity += PHYSICS_CONFIG.wheelFriction * dt;
  if (wheel.velocity < 0.05) wheel.velocity = 0.05;
  wheel.angle += wheel.velocity * dt;
}

/**
 * Update ball on outer track: friction deceleration.
 * Returns true if ball should leave track.
 */
export function updateBallOnTrack(ball, dt) {
  // Ball moves counter-clockwise (negative velocity)
  // Friction opposes motion, so adds positive acceleration
  const friction = -PHYSICS_CONFIG.ballTrackFriction; // positive value to slow negative velocity
  ball.velocity += friction * dt;
  if (ball.velocity > -PHYSICS_CONFIG.ballCriticalVelocity) {
    // Ball has slowed enough to leave track
    ball.state = 'dropping';
    ball.radialVelocity = 0;
    return true;
  }
  ball.angle += ball.velocity * dt;
  return false;
}

/**
 * Update ball dropping from track into pocket zone.
 * Spirals inward, checks deflector collisions.
 */
export function updateBallDropping(ball, dt, wheelAngle) {
  const cfg = PHYSICS_CONFIG;

  // Angular: apply drag to slow the ball toward zero (velocity is negative)
  // Multiply by a factor slightly less than 1 to bring it toward zero
  ball.velocity *= Math.pow(0.6, dt);
  ball.angle += ball.velocity * dt;

  // Radial motion: accelerate inward
  ball.radialVelocity += cfg.ballRadialAccel * dt;
  ball.radialVelocity += ball.radialVelocity * cfg.ballRadialDrag * dt;
  ball.radius += ball.radialVelocity * dt;

  // Deflector collisions (deflectors are on the ball track)
  let hitDeflector = false;
  const deflectorR = ball.trackR;
  const deflectorZone = ball.trackR * 0.06;
  if (ball.radius > deflectorR - deflectorZone && ball.radius < deflectorR + deflectorZone) {
    for (let i = 0; i < cfg.deflectorCount; i++) {
      const deflAngle = (i / cfg.deflectorCount) * 2 * Math.PI;
      const angleDiff = Math.abs(normalizeAngle(ball.angle) - normalizeAngle(deflAngle));
      const minDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
      if (minDiff < 0.08) {
        // Hit a deflector — bounce radially and deflect angularly
        ball.radialVelocity *= -cfg.deflectorRestitution;
        ball.velocity *= cfg.deflectorRestitution;
        ball.radius = deflectorR - deflectorZone - 1;
        hitDeflector = true;
        break;
      }
    }
  }

  // Check if ball has reached pocket zone
  if (ball.radius <= ball.pocketR + (ball.trackR - ball.pocketR) * 0.15) {
    ball.state = 'in_pocket';
    ball.radius = ball.pocketR;
    ball.radialVelocity = 0;
    return { reachedPocket: true, deflectorHit: hitDeflector };
  }

  return { reachedPocket: false, deflectorHit: hitDeflector };
}

/**
 * Update ball bouncing inside pockets off frets.
 * wheelVelocity is needed to compute motion relative to the spinning wheel.
 * Returns true if ball has settled.
 */
export function updateBallInPocket(ball, dt, wheelAngle, wheelVelocity, segAngle) {
  const cfg = PHYSICS_CONFIG;

  // Relative velocity: how fast the ball moves vs the wheel
  let relVel = ball.velocity - wheelVelocity;

  // Apply friction to the relative velocity (drag the ball toward wheel speed)
  relVel *= Math.pow(cfg.inPocketFriction, dt);

  // Write back absolute velocity
  ball.velocity = wheelVelocity + relVel;
  ball.angle += ball.velocity * dt;

  // Check fret collisions in wheel-relative coords (offset by -PI/2 to match rendering)
  const ballRelAngle = normalizeAngle(ball.angle - wheelAngle + Math.PI / 2);
  const pocketIndex = Math.floor(ballRelAngle / segAngle);
  const pocketStart = pocketIndex * segAngle;
  const pocketEnd = pocketStart + segAngle;
  const distToLowFret = ballRelAngle - pocketStart;
  const distToHighFret = pocketEnd - ballRelAngle;
  const fretThreshold = 0.02;

  let hitFret = false;
  let fretHitVelocity = 0;
  if (distToLowFret < fretThreshold && relVel < 0) {
    fretHitVelocity = Math.abs(relVel);   // capture before bounce
    relVel *= -cfg.fretRestitution;
    ball.velocity = wheelVelocity + relVel;
    hitFret = true;
  } else if (distToHighFret < fretThreshold && relVel > 0) {
    fretHitVelocity = Math.abs(relVel);   // capture before bounce
    relVel *= -cfg.fretRestitution;
    ball.velocity = wheelVelocity + relVel;
    hitFret = true;
  }

  // Settle when relative velocity is small enough
  if (Math.abs(relVel) < cfg.settleAngularThreshold) {
    ball.state = 'settled';
    // Snap to pocket center, lock to wheel (undo the PI/2 offset back to world coords)
    const midAngle = pocketStart + segAngle / 2 - Math.PI / 2;
    ball.angle = wheelAngle + midAngle;
    ball.velocity = wheelVelocity;
    return { settled: true, fretHit: hitFret, fretHitVelocity };
  }

  return { settled: false, fretHit: hitFret, fretHitVelocity };
}

/**
 * Generate a random initial ball velocity (counter-clockwise).
 */
export function randomBallVelocity() {
  const { ballInitialSpeedMin, ballInitialSpeedMax } = PHYSICS_CONFIG;
  const speed = ballInitialSpeedMin + Math.random() * (ballInitialSpeedMax - ballInitialSpeedMin);
  return -speed; // negative = counter-clockwise
}

/**
 * Determine which pocket the ball is in, given its angle and the wheel angle.
 * Accounts for the -PI/2 rendering offset (pockets start at top of wheel).
 * Returns the pocket index (0-based).
 */
export function getPocketAtBall(ballAngle, wheelAngle, segAngle) {
  const relAngle = normalizeAngle(ballAngle - wheelAngle + Math.PI / 2);
  return Math.floor(relAngle / segAngle) % TOTAL_POCKETS;
}
