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
 * Easing function: easeOutQuart
 */
export function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
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
  // Pick random unique pocket indices for the names
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

/**
 * Bounce easing for ball drop phase.
 */
export function easeOutBounce(t) {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    t -= 1.5 / 2.75;
    return 7.5625 * t * t + 0.75;
  } else if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75;
    return 7.5625 * t * t + 0.9375;
  } else {
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  }
}

/**
 * Ease-out cubic for smooth deceleration.
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
