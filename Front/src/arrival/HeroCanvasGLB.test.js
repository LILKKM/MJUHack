import { act, render, waitFor } from '@testing-library/react';
import HeroCanvas from './HeroCanvas';
import { createHeroScene } from './heroScene';
jest.mock('./heroScene', () => ({ createHeroScene: jest.fn() }));
let callbacks, dispose;
beforeEach(() => {
  dispose = jest.fn();
  createHeroScene.mockImplementation((canvas, camera, options) => {
    callbacks = options;
    return { render: jest.fn(), dispose };
  });
});
test('the arrival stays unready until the GLB loads', async () => {
  const onReady = jest.fn();
  const view = render(<HeroCanvas phase="clouds" onReady={onReady}/>);
  await waitFor(() => expect(createHeroScene).toHaveBeenCalled());
  expect(onReady).not.toHaveBeenCalled();
  act(() => callbacks.onLoad());
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(view.container.firstChild).toHaveClass('is-ready');
  view.unmount(); expect(dispose).toHaveBeenCalledTimes(1);
});
test('GLB failure allows continuing and late callbacks are ignored after unmount', async () => {
  const onReady = jest.fn();
  const view = render(<HeroCanvas phase="clouds" onReady={onReady}/>);
  await waitFor(() => expect(createHeroScene).toHaveBeenCalled());
  act(() => callbacks.onError(new Error('missing GLB')));
  expect(view.container.firstChild).toHaveClass('is-failed');
  expect(onReady).toHaveBeenCalledTimes(1);
  view.unmount();
  act(() => { callbacks.onLoad(); callbacks.onError(); });
  expect(onReady).toHaveBeenCalledTimes(1);
});
