import dataset from '../mock/dataset.json';
import scenarios from '../mock/scenarios.json';
export { dataset };
const reply = (status, data, error = null) => ({ contractVersion: '0.1.0', dataKind: 'mock', status, data, error });
const ok = data => reply('ok', data);
const empty = reason => reply('empty', { items: [], reason });
const fail = code => reply('error', null, { code, message: code, retryable: true });
const scenario = id => scenarios.scenarios.find(item => item.id === id).response;
export function distanceM(a, b) {
  const rad = n => n * Math.PI / 180;
  const dlat = rad(b.latitude - a.latitude), dlon = rad(b.longitude - a.longitude);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const checks = new Map();
export const mockApi = {
  async listPreferences() { return ok({ eras: dataset.eras, kContents: dataset.kContents }); },
  async listSpots({ districtCodes = [], eraId = null } = {}) {
    return ok({ items: dataset.spots.filter(s => s.status === 'published' && (!districtCodes.length || districtCodes.includes(s.districtCode))).map(s => ({ ...s, availableEraIds: [...new Set(dataset.newspaperEditions.filter(e => e.spotId === s.id && e.status === 'published').flatMap(e => e.eraIds))] })).filter(s => !eraId || s.availableEraIds.includes(eraId)) });
  },
  async checkLocation(position) {
    if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude) || Math.abs(position.latitude) > 90 || Math.abs(position.longitude) > 180 || !Number.isFinite(position.accuracyM) || position.accuracyM < 0 || position.accuracyM > 20) return fail('LOCATION_UNCERTAIN');
    const spot = dataset.spots.find(s => s.status === 'published' && Number.isFinite(s.serviceRadiusM) && distanceM(position, s) <= s.serviceRadiusM);
    if (!spot) return fail('OUTSIDE_SPOT');
    const checkId = `mock:check:${checks.size + 1}`;
    checks.set(checkId, spot.id);
    return ok({ checkId, spotId: spot.id, mode: 'current_location_only', reason: 'photo_not_used', validUntil: null });
  },
  async selectEdition({ checkId, spotId, eraId, kContentId, language }) {
    if (checks.get(checkId) !== spotId) return fail('LOCATION_UNCERTAIN');
    const content = dataset.kContents.find(c => c.id === kContentId);
    if (content && eraId && !content.settingEraIds.includes(eraId)) return empty('NO_EDITION_FOR_ERA');
    const published = dataset.newspaperEditions.filter(e => e.spotId === spotId && e.status === 'published');
    const candidates = published.filter(e => (!eraId || e.eraIds.includes(eraId)) && (!content || content.settingEraIds.some(id => e.eraIds.includes(id))));
    if (!candidates.length) return empty('NO_EDITION_FOR_ERA');
    const items = candidates.filter(e => e.language === language);
    return items.length ? ok({ edition: items[Math.floor(Math.random() * items.length)] }) : empty('NO_EDITION_FOR_LANGUAGE');
  },
  async getEdition(id) { const edition = dataset.newspaperEditions.find(e => e.id === id && e.status === 'published'); return edition ? ok({ edition }) : empty('EDITION_NOT_FOUND'); },
  async listNearbyPlaces() { return ok({ restaurants: dataset.restaurants, touristPlaces: dataset.touristPlaces, accessibilityRecords: dataset.accessibilityRecords }); },
  async recommendCourse({ requiredAccessNeeds = [] }, options = {}) {
    if (options.failChat) return scenario('chat-unavailable');
    if (requiredAccessNeeds.length) return scenario('no-accessible-restaurant');
    return scenario('course-ok');
  }
};
