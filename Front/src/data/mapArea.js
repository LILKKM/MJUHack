import boundaries from './seoulDistricts.json';

export const districtAreas = boundaries.features.map(({ properties, geometry }) => ({ ...properties, ring: geometry.coordinates[0] }));
export const boundarySource = boundaries.source;
export const AREA_MIN_ZOOM = 11;
export const AREA_MAX_ZOOM = 20;
const vertices = districtAreas.flatMap(area => area.ring);
export const areaBounds = {
  west: Math.min(...vertices.map(point => point[0])), east: Math.max(...vertices.map(point => point[0])),
  south: Math.min(...vertices.map(point => point[1])), north: Math.max(...vertices.map(point => point[1]))
};
const longitudeScale = Math.cos(37.6 * Math.PI / 180);

function nearestOnEdge(point, a, b) {
  const x = (b[0] - a[0]) * longitudeScale, y = b[1] - a[1];
  const length = x * x + y * y;
  const t = length ? Math.max(0, Math.min(1, ((point.longitude - a[0]) * longitudeScale * x + (point.latitude - a[1]) * y) / length)) : 0;
  const longitude = a[0] + (b[0] - a[0]) * t, latitude = a[1] + (b[1] - a[1]) * t;
  return { latitude, longitude, distance: ((point.longitude - longitude) * longitudeScale) ** 2 + (point.latitude - latitude) ** 2 };
}

export function containsPoint(point) {
  return districtAreas.some(({ ring }) => {
    let inside = false;
    for (let i = 1; i < ring.length; i += 1) {
      const a = ring[i - 1], b = ring[i];
      if (nearestOnEdge(point, a, b).distance < 1e-18) return true;
      if ((a[1] > point.latitude) !== (b[1] > point.latitude)
        && point.longitude < (b[0] - a[0]) * (point.latitude - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  });
}

export function clampToArea(point) {
  if (containsPoint(point)) return point;
  let nearest = { distance: Infinity };
  districtAreas.forEach(({ ring }) => {
    for (let i = 1; i < ring.length; i += 1) {
      const candidate = nearestOnEdge(point, ring[i - 1], ring[i]);
      if (candidate.distance < nearest.distance) nearest = candidate;
    }
  });
  return { latitude: nearest.latitude, longitude: nearest.longitude };
}
