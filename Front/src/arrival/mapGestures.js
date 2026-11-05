import { useEffect, useRef } from 'react';

// Invert the projected map plane so a drag follows the finger at the current tilt.
export function unprojectPoint(point, center, matrix) {
  const x = point.x - center.x, y = point.y - center.y;
  const a = matrix.m11 - x * matrix.m14, b = matrix.m21 - x * matrix.m24;
  const c = matrix.m12 - y * matrix.m14, d = matrix.m22 - y * matrix.m24;
  const u = x * matrix.m44 - matrix.m41, v = y * matrix.m44 - matrix.m42, determinant = a * d - b * c;
  return { x: (u * d - b * v) / determinant, y: (a * v - u * c) / determinant };
}

export default function useMapGestures(viewport, mapRef, mapsRef, enabled, state, minZoom, maxZoom) {
  const pointers = useRef(new Map());
  useEffect(() => {
    if (!enabled || state !== 'ready') return;
    const host = viewport.current, ground = host.closest('.arrival-ground'), view = host.closest('.arrival');
    if (!ground || !view) return;
    const map = mapRef.current, maps = mapsRef.current, touches = pointers.current;
    let previous, pinch;
    const measure = () => {
      const values = [...touches.values()];
      return { point: { x: values.reduce((sum, p) => sum + p.x, 0) / values.length, y: values.reduce((sum, p) => sum + p.y, 0) / values.length },
        distance: values.length === 2 ? Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) : 0 };
    };
    const rebase = () => { previous = measure(); pinch = { distance: previous.distance, zoom: map.getZoom() }; };
    const down = event => {
      if (event.button !== 0 || event.target.closest('button,a,input,select')) return;
      event.preventDefault(); event.stopPropagation();
      map.stop(); host.focus({ preventScroll: true });
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY }); host.setPointerCapture(event.pointerId);
      host.dataset.dragging = 'true'; rebase();
    };
    const move = event => {
      if (!touches.has(event.pointerId)) return;
      event.preventDefault(); event.stopPropagation();
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const current = measure(), rect = view.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const matrix = new DOMMatrixReadOnly(getComputedStyle(ground).transform);
      const from = unprojectPoint(previous.point, center, matrix), to = unprojectPoint(current.point, center, matrix);
      const projection = map.getProjection(), size = map.getSize();
      map.setCenter(projection.fromOffsetToCoord(new maps.Point(size.width / 2 + from.x - to.x, size.height / 2 + from.y - to.y)));
      if (pinch.distance && current.distance) map.setZoom(Math.max(minZoom, Math.min(maxZoom, Math.round(pinch.zoom + Math.log2(current.distance / pinch.distance)))));
      previous = current;
    };
    const up = event => {
      if (!touches.delete(event.pointerId)) return;
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      if (touches.size) rebase(); else { previous = null; delete host.dataset.dragging; }
    };
    const keyboard = event => {
      const offsets = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
      if (event.target !== host) return;
      if (['+', '=', '-'].includes(event.key)) {
        event.preventDefault(); map.setZoom(Math.max(minZoom, Math.min(maxZoom, map.getZoom() + (event.key === '-' ? -1 : 1)))); return;
      }
      if (!offsets[event.key]) return;
      event.preventDefault(); map.panBy(new maps.Point(...offsets[event.key]));
    };
    host.addEventListener('pointerdown', down, true); host.addEventListener('pointermove', move, true);
    host.addEventListener('pointerup', up, true); host.addEventListener('pointercancel', up, true);
    host.addEventListener('lostpointercapture', up, true); host.addEventListener('keydown', keyboard);
    return () => {
      host.removeEventListener('pointerdown', down, true); host.removeEventListener('pointermove', move, true);
      host.removeEventListener('pointerup', up, true); host.removeEventListener('pointercancel', up, true);
      host.removeEventListener('lostpointercapture', up, true); host.removeEventListener('keydown', keyboard);
      touches.forEach((_, id) => { if (host.hasPointerCapture(id)) host.releasePointerCapture(id); }); touches.clear(); delete host.dataset.dragging;
    };
  }, [viewport, mapRef, mapsRef, enabled, state, minZoom, maxZoom]);
}
