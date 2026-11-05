import { canvasAnchor } from './HeroCanvas';
test('the centred phone frame keeps the GPS avatar in canvas coordinates, including off-screen positions', () => {
  expect(canvasAnchor({ left: 500, top: 200, width: 1, height: 1 }, { left: 360, top: 100 })).toEqual({ x: 140.5, y: 100.5 });
  expect(canvasAnchor({ left: 300, top: 50, width: 1, height: 1 }, { left: 360, top: 100 })).toEqual({ x: -59.5, y: -49.5 });
  expect(canvasAnchor(null, { left: 360, top: 100 })).toBeNull();
});
