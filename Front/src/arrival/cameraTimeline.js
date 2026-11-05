export function landingView(phase, progress = 1) {
  const p = Math.max(0, Math.min(1, progress));
  const distance = phase === 'pullback' ? 1 + .65 * p * p : phase === 'landed' ? 1.65 : 1;
  return { distance, tilt: 0 };
}
