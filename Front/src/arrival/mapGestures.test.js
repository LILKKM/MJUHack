import { useRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import useMapGestures, { unprojectPoint } from './mapGestures';

const identity = { m11: 1, m12: 0, m14: 0, m21: 0, m22: 1, m24: 0, m41: 0, m42: 0, m44: 1 };

test('projected cursor positions recover the map plane at the final camera tilt, including perspective', () => {
  const angle = 52 * Math.PI / 180, scale = 1 / 1.65;
  const matrix = { ...identity, m11: scale, m22: Math.cos(angle) * scale, m24: -Math.sin(angle) * scale / 1600 };
  for (const [x, y] of [[120, -90], [-300, 260], [0, 0]]) {
    const w = 1 + matrix.m24 * y;
    const result = unprojectPoint({ x: 300 + scale * x / w, y: 400 + scale * Math.cos(angle) * y / w }, { x: 300, y: 400 }, matrix);
    expect(result.x).toBeCloseTo(x, 7); expect(result.y).toBeCloseTo(y, 7);
  }
});

test('mouse and touch drag, pinch, cancellation, buttons and disabled animation phases use the same map safely', () => {
  const oldMatrix = window.DOMMatrixReadOnly, oldPointer = window.PointerEvent;
  window.DOMMatrixReadOnly = function() { Object.assign(this, identity); };
  window.PointerEvent = class extends MouseEvent { constructor(type, options) { super(type, options); Object.defineProperty(this, 'pointerId', { value: options.pointerId }); } };
  const map = { stop: jest.fn(), getZoom: () => 17, getSize: () => ({ width: 600, height: 800 }),
    getProjection: () => ({ fromOffsetToCoord: point => point }), setCenter: jest.fn(), setZoom: jest.fn(), panBy: jest.fn() };
  const maps = { Point: function(x, y) { this.x = x; this.y = y; } };
  function Harness({ enabled }) {
    const host = useRef(null), mapRef = useRef(map), mapsRef = useRef(maps);
    useMapGestures(host, mapRef, mapsRef, enabled, 'ready', 12, 20);
    return <div className="arrival"><div className="arrival-ground"><div ref={host} data-testid="host" tabIndex={0}><button>핀</button></div></div></div>;
  }
  const { getByTestId, getByRole, rerender, unmount } = render(<Harness enabled />);
  const host = getByTestId('host'), captured = new Set();
  host.setPointerCapture = id => captured.add(id); host.hasPointerCapture = id => captured.has(id); host.releasePointerCapture = id => captured.delete(id);
  const down = (id, x, y, target = host) => fireEvent.pointerDown(target, { pointerId: id, button: 0, clientX: x, clientY: y });
  const move = (id, x, y) => fireEvent.pointerMove(host, { pointerId: id, clientX: x, clientY: y });
  down(1, 100, 100); move(1, 180, 140);
  expect(map.setCenter).toHaveBeenLastCalledWith({ x: 220, y: 360 });
  fireEvent.pointerCancel(host, { pointerId: 1 });
  expect(captured.size).toBe(0); expect(host.dataset.dragging).toBeUndefined();
  down(2, 100, 100); down(3, 200, 100); move(3, 300, 100);
  expect(map.setZoom).toHaveBeenLastCalledWith(18);
  fireEvent.pointerUp(host, { pointerId: 3 }); fireEvent.pointerUp(host, { pointerId: 2 });
  const previous = map.setCenter.mock.calls.length;
  down(4, 100, 100, getByRole('button')); move(4, 200, 100);
  expect(map.setCenter).toHaveBeenCalledTimes(previous);
  fireEvent.keyDown(host, { key: '+' }); expect(map.setZoom).toHaveBeenLastCalledWith(18);
  fireEvent.keyDown(host, { key: '-' }); expect(map.setZoom).toHaveBeenLastCalledWith(16);
  rerender(<Harness enabled={false} />); down(5, 100, 100); move(5, 200, 100);
  expect(map.setCenter).toHaveBeenCalledTimes(previous);
  unmount(); window.DOMMatrixReadOnly = oldMatrix; window.PointerEvent = oldPointer;
});
