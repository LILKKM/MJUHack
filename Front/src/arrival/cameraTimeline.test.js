import { landingView } from './cameraTimeline';
import { NEXT_PHASE } from './heroConfig';
test('pullback accelerates while holding its landing angle', () => {
  const start=landingView('pullback',0), middle=landingView('pullback',.5), end=landingView('pullback',1);
  expect(start.tilt).toBe(0); expect(middle.tilt).toBe(start.tilt); expect(end.tilt).toBe(start.tilt);
  expect(middle.distance-start.distance).toBeLessThan(end.distance-middle.distance);
});
test('landing and exploration stay overhead without an extra tilt phase', () => {
  for (const phase of ['falling','impact','pullback','landed']) expect(landingView(phase,.5).tilt).toBe(0);
  expect(landingView('landed')).toEqual(landingView('pullback',1));
  expect(NEXT_PHASE.pullback).toBe('landed');
});
