import original from './selectedPlaces.json';
import { places, hasCoordinates, filterPlaces } from './places';

test('all source rows and IDs survive, with coordinates preserved exactly and missing values excluded from markers', () => {
  expect(places).toHaveLength(58);
  expect(new Set(places.map(place => place.id)).size).toBe(original.length);
  original.forEach(source => {
    const place = places.find(item => item.id === source.sourceId);
    expect(place.latitude).toBe(source.latitude);
    expect(place.longitude).toBe(source.longitude);
    expect(place.reviewStatus).toBe('DRAFT');
    expect(place.accessibilityStatus).toBe('UNKNOWN');
  });
  expect(places.filter(hasCoordinates)).toHaveLength(40);
  expect(places.filter(place => !hasCoordinates(place)).map(place => place.id)).toEqual(original.filter(place => !place.hasValidCoordinatePair).map(place => place.sourceId));
  expect(places.find(place => place.id === 'JNG12')).toMatchObject({ latitude: 37.579617, longitude: 126.977041 });
  [null, '', NaN, Infinity].forEach(latitude => expect(hasCoordinates({ latitude, longitude: 126.9 })).toBe(false));
});

test('filters preserve list-only places and expose empty combinations without substituting a place', () => {
  expect(filterPlaces({ districtId: 'EPY' })).toHaveLength(8);
  expect(filterPlaces({ districtId: 'EPY' }).filter(hasCoordinates)).toHaveLength(0);
  expect(filterPlaces({ districtId: 'SDM', eraId: 'MODERN' }).every(place => place.districtId === 'SDM' && place.eraId === 'MODERN')).toBe(true);
  expect(filterPlaces({ query: 'JNG12' }).map(place => place.id)).toEqual(['JNG12']);
  expect(filterPlaces({ query: '존재하지 않는 장소' })).toEqual([]);
});
