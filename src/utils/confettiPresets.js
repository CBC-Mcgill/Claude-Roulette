import confetti from 'canvas-confetti';

const BRAND_COLORS = ['#da7756', '#bd5d3a', '#e8956e', '#faf9f5', '#eeece2'];

export function fireWinnerConfetti() {
  const defaults = {
    colors: BRAND_COLORS,
    zIndex: 9999,
  };

  // Burst from left
  confetti({
    ...defaults,
    particleCount: 80,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.6 },
  });

  // Burst from right
  confetti({
    ...defaults,
    particleCount: 80,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.6 },
  });

  // Center burst
  confetti({
    ...defaults,
    particleCount: 100,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    startVelocity: 45,
  });
}
