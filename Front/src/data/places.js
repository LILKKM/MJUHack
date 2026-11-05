import selectedPlaces from './selectedPlaces.json';

export const districts = { SDM: '서대문구', JNG: '종로구', MPO: '마포구', EPY: '은평구' };
export const eras = { JOSEON: '조선', OPENING_COLONIAL: '개화기·일제강점기', MODERN: '현대' };
const districtIds = { '11410': 'SDM', '11110': 'JNG', '11440': 'MPO', '11380': 'EPY' };
const eraIds = { '조선': 'JOSEON', '개화기·일제강점기': 'OPENING_COLONIAL', '현대': 'MODERN' };
const coordinateStatuses = { approx: 'APPROX', user_xlsx: 'PROVIDED', user_xlsx_area: 'AREA', missing: 'MISSING' };
export const coordinateLabels = { APPROX: '대략 위치', PROVIDED: '입력 좌표', AREA: '구역 대표 좌표', MISSING: '위치 미확인' };

export function hasCoordinates(place) {
  return typeof place.latitude === 'number' && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90
    && typeof place.longitude === 'number' && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180;
}

export const places = selectedPlaces.map(place => ({
  id: place.sourceId,
  name: place.name,
  districtId: districtIds[place.districtCode],
  eraId: eraIds[place.raw.period],
  eraDetail: place.raw.era,
  category: place.raw.category,
  latitude: place.latitude,
  longitude: place.longitude,
  coordStatus: coordinateStatuses[place.coordinateStatus],
  address: place.raw.address,
  storyShort: place.raw.story_short,
  verifyNote: place.raw.verify_note,
  accessibilityNote: place.raw.accessibility_note,
  accessibilityStatus: 'UNKNOWN',
  sources: [place.raw.source_1, place.raw.source_2].filter(url => /^https?:\/\//.test(url)),
  reviewStatus: 'DRAFT',
  serviceRadiusM: place.serviceRadiusM
}));

export function filterPlaces({ districtId = '', eraId = '', query = '' } = {}) {
  const text = query.trim().toLocaleLowerCase();
  return places.filter(place => (!districtId || place.districtId === districtId)
    && (!eraId || place.eraId === eraId)
    && (!text || `${place.name} ${place.id} ${place.address}`.toLocaleLowerCase().includes(text)));
}
