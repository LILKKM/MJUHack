import { createMapAreaLayer } from './mapAreaLayer';
import { containsPoint } from '../data/mapArea';

test('boundary overlays let input through, clamp centres to the four polygons, and clean up with the map', () => {
  let center = { latitude: 37.564, longitude: 126.998 }, callback;
  const overlays = [];
  const maps = {
    LatLng: function(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; }, Size: function() {}, Point: function() {},
    Polygon: jest.fn(options => { const overlay = { options, setMap: jest.fn() }; overlays.push(overlay); return overlay; }),
    Marker: jest.fn(options => { const overlay = { options, setMap: jest.fn() }; overlays.push(overlay); return overlay; }),
    Event: { addListener: jest.fn((_, event, listener) => { callback = listener; return event; }), removeListener: jest.fn() }
  };
  const map = { getCenter: () => ({ lat: () => center.latitude, lng: () => center.longitude }), setCenter: jest.fn(point => { center = point; callback(); }) };
  const layer = createMapAreaLayer(maps, map);
  expect(maps.Polygon.mock.calls.every(([options]) => options.clickable === false)).toBe(true);
  expect(maps.Marker.mock.calls.map(([options]) => options.icon.content.dataset.districtLabel)).toEqual(['SDM', 'JNG', 'MPO', 'EPY']);
  callback();
  expect(map.setCenter).toHaveBeenCalledTimes(1);
  expect(containsPoint(center)).toBe(true);
  callback(); expect(map.setCenter).toHaveBeenCalledTimes(1);
  layer.destroy();
  expect(maps.Event.removeListener).toHaveBeenCalledWith('center_changed');
  expect(overlays.every(overlay => overlay.setMap.mock.calls.some(([next]) => next === null))).toBe(true);
});
