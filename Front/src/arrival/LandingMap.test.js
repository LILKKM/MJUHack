import { act, render, screen, waitFor } from '@testing-library/react';
import LandingMap from './LandingMap';
import { loadNaverMaps } from '../api/naverMaps';
jest.mock('../api/naverMaps', () => ({ loadNaverMaps: jest.fn() }));
const originalId = process.env.REACT_APP_NAVER_MAP_CLIENT_ID;
let maps, destroy, registerControl;
beforeEach(() => {
  process.env.REACT_APP_NAVER_MAP_CLIENT_ID = 'test-public-id';
  destroy = jest.fn(); registerControl = jest.fn();
  window.ResizeObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() }));
  class Control {
    constructor() { this.element = document.createElement('div'); this.element.textContent = 'SDK attribution'; }
    setMap() { registerControl(); throw new Error('Do not move map-owned controls.'); }
    getElement() { return this.element; }
  }
  maps = {
    MapTypeRegistry: function(types) { Object.assign(this, types); },
    NaverStyleMapTypeOptions: { getNormalMap: jest.fn(options => options) },
    LatLng: function(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; }, Size: function() {}, Point: function() {},
    Polygon: jest.fn(() => ({ setMap: jest.fn() })),
    Map: jest.fn(() => ({ setSize: jest.fn(), setOptions: jest.fn(), panTo: jest.fn(), destroy })),
    Marker: jest.fn(() => ({ setMap: jest.fn(), setPosition: jest.fn() })),
    Event: { addListener: jest.fn(), removeListener: jest.fn() }, LogoControl: Control
  };
  loadNaverMaps.mockResolvedValue(maps);
});
afterEach(() => { if (originalId === undefined) delete process.env.REACT_APP_NAVER_MAP_CLIENT_ID; else process.env.REACT_APP_NAVER_MAP_CLIENT_ID = originalId; });
test('landing, exploring and GPS updates keep the same map and avatar anchor, with safe attribution cleanup', async () => {
  const ready = jest.fn(), anchor = { current: null }, controls = { current: null };
  const first = { latitude: 37.57, longitude: 126.98 };
  const { container, rerender, unmount } = render(<LandingMap position={first} phase="preparing" onReady={ready} anchorRef={anchor} mapControlRef={controls}/>);
  await act(async () => {});
  expect(screen.getAllByText('© NAVER Corp.')).toHaveLength(1);
  expect(screen.queryByText('© OpenStreetMap')).not.toBeInTheDocument();
  const host = container.querySelector('.naver-map'), anchorNode = anchor.current;
  expect(ready).toHaveBeenCalledTimes(1);
  rerender(<LandingMap position={first} phase="landed" onReady={ready} anchorRef={anchor} mapControlRef={controls}/>);
  rerender(<LandingMap position={{ latitude: 37.571, longitude: 126.981 }} phase="landed" onReady={ready} anchorRef={anchor} mapControlRef={controls}/>);
  expect(container.querySelector('.naver-map')).toBe(host);
  expect(anchor.current).toBe(anchorNode);
  expect(maps.Map).toHaveBeenCalledTimes(1);
  expect(maps.Marker).toHaveBeenCalledTimes(5);
  const avatarIndex = maps.Marker.mock.calls.findIndex(([options]) => options.icon.content.hasAttribute('data-avatar-anchor'));
  await waitFor(() => expect(maps.Marker.mock.results[avatarIndex].value.setPosition).toHaveBeenLastCalledWith({ latitude: 37.571, longitude: 126.981 }));
  expect(destroy).not.toHaveBeenCalled();
  expect(container.querySelector('.arrival-ground .arrival-map-attribution')).toBeNull();
  expect(() => unmount()).not.toThrow(); expect(registerControl).not.toHaveBeenCalled(); expect(destroy).toHaveBeenCalledTimes(1);
});
