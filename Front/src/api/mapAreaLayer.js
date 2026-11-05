import { clampToArea, districtAreas } from '../data/mapArea';

export function createMapAreaLayer(maps, map) {
  const toPath = ring => ring.map(([longitude, latitude]) => new maps.LatLng(latitude, longitude));
  const rings = districtAreas.map(area => toPath(area.ring));
  const overlays = [new maps.Polygon({ map, paths: [toPath([[125, 36], [129, 36], [129, 39], [125, 39], [125, 36]]), ...rings.map(ring => [...ring].reverse())],
    strokeWeight: 0, fillColor: '#747c7a', fillOpacity: .34, clickable: false, zIndex: -3 })];
  districtAreas.forEach((area, index) => {
    overlays.push(new maps.Polygon({ map, paths: [rings[index]], strokeColor: '#24364B', strokeWeight: 4, strokeOpacity: .85,
      fillColor: '#8FCBAD', fillOpacity: .035, clickable: false, zIndex: -2 }));
    const center = {
      latitude: area.ring.reduce((sum, point) => sum + point[1], 0) / area.ring.length,
      longitude: area.ring.reduce((sum, point) => sum + point[0], 0) / area.ring.length
    };
    const label = document.createElement('span');
    label.className = 'district-map-label'; label.dataset.districtLabel = area.id; label.textContent = area.name;
    overlays.push(new maps.Marker({ map, position: new maps.LatLng(center.latitude, center.longitude),
      icon: { content: label, size: new maps.Size(100, 40), anchor: new maps.Point(50, 20) }, zIndex: -1 }));
  });
  let correcting = false;
  const constrain = () => {
    if (correcting) return;
    const center = map.getCenter(), point = { latitude: center.lat(), longitude: center.lng() };
    const allowed = clampToArea(point);
    if (allowed === point) return;
    correcting = true;
    map.setCenter(new maps.LatLng(allowed.latitude, allowed.longitude));
    correcting = false;
  };
  const listener = maps.Event.addListener(map, 'center_changed', constrain);
  return { destroy() { maps.Event.removeListener(listener); overlays.forEach(overlay => overlay.setMap(null)); } };
}
