import { act, render, screen } from '@testing-library/react';
import PlacesMap from './PlacesMap';
import { loadNaverMaps } from '../api/naverMaps';
import { places, hasCoordinates } from '../data/places';

jest.mock('../api/naverMaps', () => ({ loadNaverMaps: jest.fn() }));
let maps, map, created, resize, disconnect;
const previousId = process.env.REACT_APP_NAVER_MAP_CLIENT_ID;
beforeEach(() => {
  process.env.REACT_APP_NAVER_MAP_CLIENT_ID = 'test-public-id';
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(420);
  created = []; disconnect = jest.fn();
  window.ResizeObserver = jest.fn(callback => { resize = callback; return { observe: jest.fn(), disconnect }; });
  maps = {
    MapTypeRegistry: function(types) { Object.assign(this, types); },
    NaverStyleMapTypeOptions: { getNormalMap: jest.fn(options => options) },
    LatLng: function(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; },
    Polygon: jest.fn(() => ({ setMap: jest.fn() })),
    Size: function(width, height) { this.width = width; this.height = height; },
    Point: function(x, y) { this.x = x; this.y = y; },
    Map: jest.fn().mockImplementation(() => { map = { fitBounds: jest.fn(), panTo: jest.fn(), setSize: jest.fn(), destroy: jest.fn() }; return map; }),
    Marker: jest.fn().mockImplementation(options => { const marker = { options, setMap: jest.fn(), setPosition: jest.fn(), setZIndex: jest.fn() }; created.push(marker); return marker; }),
    Event: { addListener: jest.fn((target, event, callback) => ({ target, event, callback })), removeListener: jest.fn() }
  };
  loadNaverMaps.mockResolvedValue(maps);
});
afterEach(() => { jest.restoreAllMocks(); if (previousId === undefined) delete process.env.REACT_APP_NAVER_MAP_CLIENT_ID; else process.env.REACT_APP_NAVER_MAP_CLIENT_ID = previousId; });

test('one map owns all coordinate pins; selection, position, resize and filtering update it without rebuilding or resetting bounds', async () => {
  const select = jest.fn(), position = { latitude: 37.57, longitude: 126.98 };
  const { container, rerender, unmount } = render(<PlacesMap places={places} onSelect={select} position={position} />);
  await screen.findByText(/40개 장소 핀/);
  expect(maps.Map).toHaveBeenCalledTimes(1);
  expect(maps.NaverStyleMapTypeOptions.getNormalMap).toHaveBeenCalledWith({ overlayType: 'bg.ol' });
  expect(created).toHaveLength(45);
  expect(maps.Polygon).toHaveBeenCalledTimes(5);
  expect(maps.Map.mock.calls[0][1]).toMatchObject({ minZoom: 11, maxZoom: 20 });
  const historical = created.filter(marker => marker.options.icon.content.dataset.historyPin);
  expect(historical.every(marker => marker.options.icon.content.textContent === '' && marker.options.icon.content.querySelector('img').getAttribute('src').endsWith('/assets/map-pin-mint.png'))).toBe(true);
  expect(historical.every(marker => marker.options.icon.anchor.x === 36 && marker.options.icon.anchor.y === 64)).toBe(true);
  expect(historical.map(marker => marker.options.position)).toEqual(places.filter(hasCoordinates).map(place => ({ latitude: place.latitude, longitude: place.longitude })));
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  const selected = places.find(place => place.id === 'JNG12');
  rerender(<PlacesMap places={places} selectedId="JNG12" onSelect={select} position={position} />);
  expect(maps.Map).toHaveBeenCalledTimes(1);
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  expect(map.panTo).toHaveBeenLastCalledWith({ latitude: selected.latitude, longitude: selected.longitude });
  const click = maps.Event.addListener.mock.results.map(result => result.value).find(listener => listener.target.options?.title === selected.name);
  act(() => click.callback()); expect(select).toHaveBeenCalledWith('JNG12');
  Object.defineProperty(container.querySelector('.map-viewport'), 'clientWidth', { configurable: true, value: 480 });
  Object.defineProperty(container.querySelector('.map-viewport'), 'clientHeight', { configurable: true, value: 320 });
  act(() => resize()); expect(map.setSize).toHaveBeenCalledWith({ width: 480, height: 320 });
  rerender(<PlacesMap places={[selected]} selectedId="JNG12" onSelect={select} position={{ latitude: 37.58, longitude: 126.97 }} />);
  expect(maps.Map).toHaveBeenCalledTimes(1);
  expect(created).toHaveLength(46);
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  expect(historical.filter(marker => marker.setMap.mock.calls.some(([next]) => next === null))).toHaveLength(39);
  unmount(); expect(map.destroy).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1);
  expect(created.every(marker => marker.setMap.mock.calls.some(([next]) => next === null))).toBe(true);
  expect(maps.Polygon.mock.results.every(({ value }) => value.setMap.mock.calls.some(([next]) => next === null))).toBe(true);
});

test('SDK failure remains a failure and offers retry without fake pins', async () => {
  loadNaverMaps.mockRejectedValue(new Error('MAP_AUTH_FAILED'));
  const { container } = render(<PlacesMap places={places} onSelect={() => {}} />);
  expect(await screen.findByText('네이버 지도 연결에 실패했습니다.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '지도 다시 연결' })).toBeEnabled();
  expect(container.firstChild).toHaveAttribute('data-history-marker-count', '0');
  expect(maps.Marker).not.toHaveBeenCalled();
});
