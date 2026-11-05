import { areaBounds, clampToArea, containsPoint, districtAreas } from './mapArea';

test('the four published district geometries contain local landmarks and exclude other districts inside their bounding rectangle', () => {
  expect(districtAreas.map(area => area.name)).toEqual(['서대문구', '종로구', '마포구', '은평구']);
  for (const point of [{ latitude: 37.579617, longitude: 126.977041 }, { latitude: 37.5999, longitude: 126.9291 }, { latitude: 37.5669, longitude: 126.9015 }, { latitude: 37.5791, longitude: 126.9368 }]) expect(containsPoint(point)).toBe(true);
  const jung = { latitude: 37.564, longitude: 126.998 };
  expect(jung.latitude).toBeGreaterThan(areaBounds.south);
  expect(jung.longitude).toBeLessThan(areaBounds.east);
  expect(containsPoint(jung)).toBe(false);
  expect(containsPoint(clampToArea(jung))).toBe(true);
});

test('clamping preserves allowed locations, includes boundary edges, and stops every outside direction without changing GPS data', () => {
  const inside = { latitude: 37.579617, longitude: 126.977041 };
  expect(clampToArea(inside)).toBe(inside);
  districtAreas.forEach(area => area.ring.forEach(([longitude, latitude]) => expect(containsPoint({ latitude, longitude })).toBe(true)));
  for (const latitude of [37.3, 37.5, 37.56, 37.64, 37.8]) for (const longitude of [126.5, 126.85, 126.98, 127.1, 127.5]) {
    const input = Object.freeze({ latitude, longitude });
    expect(containsPoint(clampToArea(input))).toBe(true);
    expect(input).toEqual({ latitude, longitude });
  }
});
