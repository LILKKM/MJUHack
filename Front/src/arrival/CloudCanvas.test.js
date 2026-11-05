import { act, fireEvent, render } from '@testing-library/react';
import CloudCanvas from './CloudCanvas';
import { createCloudRenderer } from './cloudRenderer';
jest.mock('./cloudRenderer', () => ({ createCloudRenderer: jest.fn() }));
let renderCloud, dispose, nextFrame;
function frame(now) {
  const callback = nextFrame;
  act(() => callback(now));
}
beforeEach(() => {
  renderCloud = jest.fn(); dispose = jest.fn();
  createCloudRenderer.mockReturnValue({ render: renderCloud, dispose });
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { nextFrame = callback; return 1; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
test('clouds keep flowing without a pointer event and release the renderer on exit', () => {
  const { unmount } = render(<CloudCanvas opening={false} paused={false} reduced={false} />);
  frame(100); frame(150);
  const first = renderCloud.mock.calls[1][0];
  frame(200);
  expect(renderCloud.mock.calls[2][0].time).toBeGreaterThan(first.time);
  expect(renderCloud.mock.calls[2][0]).not.toHaveProperty('pointer');
  unmount(); expect(dispose).toHaveBeenCalledTimes(1);
});
test('cursor movement has no influence on the cloud renderer', () => {
  render(<CloudCanvas opening={false} paused={false} reduced={false} />);
  frame(100);
  fireEvent(window, new MouseEvent('pointermove', { clientX: 0, clientY: 0 }));
  frame(150);
  expect(renderCloud.mock.calls.at(-1)[0]).toMatchObject({ time: .05, open: 0 });
  fireEvent(window, new MouseEvent('pointermove', { clientX: 1000, clientY: 1000 }));
  frame(200);
  expect(renderCloud.mock.calls.at(-1)[0]).toMatchObject({ time: .1, open: 0 });
});
test('pause freezes the cloud flow and reduced-motion renders a still scene', () => {
  const { rerender } = render(<CloudCanvas opening={false} paused={false} reduced={false} />);
  frame(100); frame(150);
  const count = renderCloud.mock.calls.length;
  rerender(<CloudCanvas opening={false} paused={true} reduced={false} />);
  frame(200); frame(250);
  expect(renderCloud).toHaveBeenCalledTimes(count);
  rerender(<CloudCanvas opening={true} paused={false} reduced={true} />);
  frame(300);
  const still = renderCloud.mock.calls.at(-1)[0];
  expect(still.open).toBe(1);
  frame(350); expect(renderCloud.mock.calls.at(-1)[0].time).toBe(still.time);
});

test('clearing completes once at the end of its own timeline, before the map drop', () => {
  const cleared=jest.fn();
  render(<CloudCanvas opening={true} paused={false} reduced={false} onCleared={cleared}/>);
  frame(100);
  for(let now=150;now<=2000;now+=50)frame(now);
  expect(cleared).not.toHaveBeenCalled();
  expect(renderCloud.mock.calls.at(-1)[0].open).toBeLessThan(1);
  for(let now=2050;now<=3400;now+=50)frame(now);
  expect(cleared).toHaveBeenCalledTimes(1);
  expect(renderCloud.mock.calls.at(-1)[0].open).toBe(1);
  frame(3450);expect(cleared).toHaveBeenCalledTimes(1);
});

test('the CSS cloud fallback also finishes clearing, including reduced motion', () => {
  createCloudRenderer.mockImplementationOnce(()=>{throw new Error('No WebGL');});
  const cleared=jest.fn();
  const {container,rerender}=render(<CloudCanvas opening paused={false} reduced={false} onCleared={cleared}/>);
  const end=new Event('animationend',{bubbles:true}); Object.defineProperty(end,'animationName',{value:'fallback-far'});
  fireEvent(container.querySelector('.cloud-far'),end); expect(cleared).toHaveBeenCalledTimes(1);
  rerender(<CloudCanvas opening paused={false} reduced onCleared={cleared}/>);
  expect(cleared).toHaveBeenCalledTimes(2);
});
