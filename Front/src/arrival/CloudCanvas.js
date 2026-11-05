import { useEffect, useRef, useState } from 'react';
import { createCloudRenderer } from './cloudRenderer';
import { ARRIVAL_TIMING } from './heroConfig';
export default function CloudCanvas({ opening, paused, reduced, showcase = 0, onCleared }) {
  const canvas = useRef(null), controls = useRef({ opening, paused, reduced, showcase, onCleared });
  const [fallback, setFallback] = useState(false);
  useEffect(() => { controls.current = { opening, paused, reduced, showcase, onCleared }; }, [opening, paused, reduced, showcase, onCleared]);
  useEffect(() => { if (fallback && opening && reduced && !paused) onCleared?.(); }, [fallback, opening, reduced, paused, onCleared]);
  useEffect(() => {
    let renderer, frame, previous, windTime = 0, progress = 0, lastRender = 0, lastStamp = '', flight = controls.current.showcase, cleared = false;
    const lost = event => { event.preventDefault(); setFallback(true); cancelAnimationFrame(frame); };
    try { renderer = createCloudRenderer(canvas.current); }
    catch { setFallback(true); return; }
    const node = canvas.current;
    node.addEventListener('webglcontextlost', lost);
    const draw = now => {
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
      previous = now;
      const { opening: isOpening, paused: isPaused, reduced: isReduced } = controls.current;
      if (!document.hidden) {
        if (!isPaused && !isReduced && progress < 1) windTime += dt;
        if (isOpening && !isPaused) progress = isReduced ? 1 : Math.min(1, progress + dt * 1000 / ARRIVAL_TIMING.cloudClearing);
        if (!isPaused) flight += (controls.current.showcase - flight) * (1 - Math.exp(-dt * 3));
        if (Math.abs(controls.current.showcase - flight) < .001) flight = controls.current.showcase;
        const stamp = `${windTime}:${progress}:${flight}:${node.clientWidth}:${node.clientHeight}`;
        if (now - lastRender >= 32 && stamp !== lastStamp) {
          renderer.render({ time: windTime, open: progress * progress * (3 - 2 * progress), showcase: flight });
          lastRender = now; lastStamp = stamp;
          if (isOpening && progress === 1 && !cleared) {
            cleared = true;
            controls.current.onCleared?.();
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); node.removeEventListener('webglcontextlost', lost); renderer.dispose(); };
  }, []);
  return <div className={`cloud-volume ${opening ? 'is-opening' : ''} ${fallback ? 'is-fallback' : ''}`} aria-hidden="true" onAnimationEnd={event => { if (fallback && opening && event.animationName === 'fallback-far') onCleared?.(); }}>
    <canvas ref={canvas} className="cloud-canvas" />
    {fallback && <><div className="fallback-cloud cloud-far" /><div className="fallback-cloud cloud-middle" /><div className="fallback-cloud cloud-near" /></>}
  </div>;
}
