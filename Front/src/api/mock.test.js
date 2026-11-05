import { mockApi } from './mock';
const position = { latitude: 37.57, longitude: 126.98, accuracyM: 20, photoGps: null };
test('location boundary accepts 20m and rejects greater uncertainty or outside coordinates', async () => {
  expect((await mockApi.checkLocation(position)).status).toBe('ok');
  expect((await mockApi.checkLocation({ ...position, accuracyM: 20.1 })).error.code).toBe('LOCATION_UNCERTAIN');
  expect((await mockApi.checkLocation({ ...position, latitude: 37.6 })).error.code).toBe('OUTSIDE_SPOT');
});
test('edition selection enforces location, era, language and content without fallback', async () => {
  const check = (await mockApi.checkLocation(position)).data;
  const request = { ...check, eraId: 'mock:era:b', language: 'ko' };
  expect((await mockApi.selectEdition({ ...request, checkId: 'invalid' })).status).toBe('error');
  expect((await mockApi.selectEdition(request)).data.edition.id).toBe('mock:edition:b');
  expect((await mockApi.selectEdition({ ...request, eraId: 'mock:era:unavailable' })).data.reason).toBe('NO_EDITION_FOR_ERA');
  expect((await mockApi.selectEdition({ ...request, language: 'en' })).data.reason).toBe('NO_EDITION_FOR_LANGUAGE');
  expect((await mockApi.selectEdition({ ...request, kContentId: 'mock:kcontent:a' })).status).toBe('empty');
});
test('unknown restaurant accessibility cannot satisfy mandatory needs', async () => {
  expect((await mockApi.recommendCourse({ requiredAccessNeeds: ['wheelchair_entry'] })).data.reason).toBe('NO_ACCESSIBLE_CANDIDATES');
  expect((await mockApi.recommendCourse({})).data.stopIds).toHaveLength(2);
  expect((await mockApi.recommendCourse({}, { failChat: true })).error.code).toBe('CHAT_UNAVAILABLE');
});
