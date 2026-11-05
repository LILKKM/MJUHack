import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { dataset } from './api/mock';
import PlacesMap from './components/PlacesMap';
import Newspaper from './components/Newspaper';
import CloudArrival from './arrival/CloudArrival';
import './App.css';
const messages = {
  LOCATION_UNCERTAIN: '위치 오차가 20m 이하여야 합니다. 현재 위치를 다시 확인해 주세요.',
  OUTSIDE_SPOT: '지원 거점 밖입니다. 핀과 장소 목록을 확인해 주세요.',
  NO_EDITION_FOR_ERA: '선택한 시대의 게시 신문이 없습니다. 다른 시대를 직접 선택해 주세요.',
  NO_EDITION_FOR_LANGUAGE: '선택한 언어의 게시 신문이 없습니다.',
  NO_ACCESSIBLE_CANDIDATES: '필수 접근성 조건을 확인한 음식점 후보가 없습니다. 조건은 유지됩니다.',
  CHAT_UNAVAILABLE: '추천을 불러오지 못했습니다. 신문과 주변 장소는 계속 볼 수 있습니다. 다시 시도해 주세요.'
};
const districtNames = { '11110': '종로구', '11410': '서대문구', '11440': '마포구', '11380': '은평구' };
const accessNames = { available: '확인됨 (시연)', unavailable: '불가', unknown: '미확인' };
const initialEra = new URLSearchParams(window.location.search).get('era') || '';
function App() {
  const [demoMode, setDemoMode] = useState(false);
  const [era, setEra] = useState(initialEra), [content, setContent] = useState('');
  const [preferences, setPreferences] = useState(null), [spots, setSpots] = useState([]), [loadError, setLoadError] = useState(false), [reload, setReload] = useState(0);
  const [selected, setSelected] = useState('mock:spot:a'), [position, setPosition] = useState(null), [check, setCheck] = useState(null), [locationMessage, setLocationMessage] = useState('사진 없이 현재 위치만으로 진행할 수 있습니다.');
  const [edition, setEdition] = useState(null), [editionMessage, setEditionMessage] = useState('위치를 확인한 뒤 신문을 열어 주세요.');
  const [busy, setBusy] = useState(''), [photo, setPhoto] = useState(false), [scenario, setScenario] = useState('location-ok');
  const [nearby, setNearby] = useState(null), [needs, setNeeds] = useState(false), [question, setQuestion] = useState('주변에서 방문할 장소를 추천해 주세요.'), [course, setCourse] = useState(null), [chatMessage, setChatMessage] = useState('조건을 고르면 시연 방문 순서를 제안합니다.'), [failChat, setFailChat] = useState(false), [failSvg, setFailSvg] = useState(false);
  useEffect(() => {
    let active = true;
    setLoadError(false);
    Promise.all([api.listPreferences('ko'), api.listSpots({ eraId: era || null })]).then(([p, s]) => { if (active) { setPreferences(p.data); setSpots(s.data.items); } }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [era, reload]);
  useEffect(() => {
    const restore = () => { setEra(new URLSearchParams(window.location.search).get('era') || ''); setContent(''); setEdition(null); setCourse(null); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function changeEra(value, contentId = '') {
    setEra(value); setContent(contentId); setEdition(null); setCourse(null);
    setEditionMessage('시대가 바뀌었습니다. 이 시대의 신문을 다시 열어 주세요.');
    const url = new URL(window.location.href); value ? url.searchParams.set('era', value) : url.searchParams.delete('era'); url.searchParams.delete('edition'); window.history.replaceState(null, '', url);
  }
  const onSelect = useCallback(id => setSelected(id), []);
  const places = useMemo(() => [...spots, ...(nearby?.touristPlaces || []), ...(nearby?.restaurants || [])], [spots, nearby]);
  const selectedPlace = places.find(p => p.id === selected);
  const spot = spots.find(s => s.id === selected);
  async function locate(real = false, suppliedPosition = null) {
    setBusy('location'); setCheck(null); setEdition(null); setCourse(null); setNearby(null); setPosition(null);
    setEditionMessage('위치를 확인한 뒤 신문을 열어 주세요.');
    try {
      let p = suppliedPosition;
      if (p) {
        setPosition(p);
      } else if (real) {
        p = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('위치 기능을 지원하지 않습니다. 시연 위치를 이용할 수 있습니다.'));
          navigator.geolocation.getCurrentPosition(v => resolve({ latitude: v.coords.latitude, longitude: v.coords.longitude, accuracyM: v.coords.accuracy, observedAt: new Date(v.timestamp).toISOString(), photoGps: null }), error => reject(new Error(error.code === 1 ? '위치 권한이 거부되었습니다. 브라우저 설정에서 허용한 뒤 다시 시도해 주세요.' : '현재 위치를 얻지 못했습니다. 다시 시도해 주세요.')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        });
      } else {
        if (scenario === 'denied') throw new Error('위치 권한이 거부되었습니다. 브라우저 설정에서 허용한 뒤 다시 시도해 주세요.');
        p = { latitude: scenario === 'outside-spot' ? 37.6 : 37.57, longitude: scenario === 'outside-spot' ? 126.9 : 126.98, accuracyM: scenario === 'location-uncertain' ? 25 : 10, observedAt: new Date().toISOString(), photoGps: null };
      }
      setPosition(p);
      const result = await api.checkLocation(p);
      if (result.status !== 'ok') { setLocationMessage(messages[result.error.code]); return; }
      setPosition(p); setCheck(result.data); setSelected(result.data.spotId);
      const savedId = new URLSearchParams(window.location.search).get('edition');
      if (savedId) {
        const saved = await api.getEdition(savedId);
        if (saved.status === 'ok' && saved.data.edition.spotId === result.data.spotId && (!era || saved.data.edition.eraIds.includes(era))) setEdition(saved.data.edition);
      }
      setLocationMessage(`${real ? '브라우저 위치를 mock 판정했습니다' : '시연 위치 확인됨'}. 오차 ${Math.round(p.accuracyM)}m. 사진은 판정에 사용하지 않았습니다.`);
      const local = await api.listNearbyPlaces({ spotId: result.data.spotId, requiredAccessNeeds: [] }); setNearby(local.data);
    } catch (error) { setLocationMessage(error.message); } finally { setBusy(''); }
  }
  async function openPaper() {
    setBusy('edition'); setEdition(null);
    try {
      const result = await api.selectEdition({ checkId: check.checkId, spotId: spot.id, eraId: era || null, kContentId: content || null, language: 'ko' });
      if (result.status === 'ok') {
        setEdition(result.data.edition);
        const url = new URL(window.location.href); url.searchParams.set('edition', result.data.edition.id); window.history.replaceState(null, '', url);
      } else setEditionMessage(messages[result.error?.code || result.data.reason] || '신문을 찾지 못했습니다.');
    } catch { setEditionMessage('신문 요청에 실패했습니다. 다시 시도해 주세요.'); } finally { setBusy(''); }
  }
  async function recommend(event) {
    event.preventDefault(); setBusy('chat'); setCourse(null);
    try {
      const result = await api.recommendCourse({ spotId: check.spotId, eraId: era || null, requiredAccessNeeds: needs ? ['wheelchair_entry'] : [], preferences: [], question, conversationId: null }, { failChat });
      if (result.status === 'ok') { setCourse(result.data); setChatMessage(result.data.message); }
      else setChatMessage(messages[result.error?.code || result.data.reason]);
    } catch { setChatMessage(messages.CHAT_UNAVAILABLE); } finally { setBusy(''); }
  }
  const canOpen = check && spot && check.spotId === spot.id;
  return <>
    <div hidden={demoMode}><CloudArrival active={!demoMode} onLocated={p => setPosition(p)} onDemo={() => { setDemoMode(true); locate(); }} /></div>
    {demoMode && <div className="demo-app">
    <a className="skip" href="#demo-main">본문으로 건너뛰기</a>
    <header className="masthead paper-masthead"><a href="#demo-main" className="wordmark brand-wordmark">Seoul Times</a><span>가상 신문 시연</span><button onClick={() => setDemoMode(false)}>실제 장소 지도로 돌아가기</button><a href="#visit">방문 순서</a></header>
    <main id="demo-main" tabIndex="-1"><div className="intro"><h1>지금 서 있는 곳의<br />다른 시간을 읽다.</h1><p>시대를 고르고, 장소를 만나고, 그곳의 신문을 펼쳐 보세요.</p></div>
      <p className="demo-notice" role="status">Mock 시연 / 모든 장소·역사·작품·접근성은 가상입니다. 실제 방문 안내가 아닙니다.</p>
      <section className="preference" aria-labelledby="preference-title"><h2 id="preference-title">어느 시대를 만나볼까요?</h2>
        {loadError ? <div role="alert">선택 정보를 불러오지 못했습니다.<button onClick={() => setReload(v => v + 1)}>다시 불러오기</button></div> : !preferences ? <p role="status">시대와 작품을 불러오는 중…</p> : <div className="filter-row"><label>시대<select value={era} onChange={e => changeEra(e.target.value)}><option value="">모든 게시 시대</option>{preferences.eras.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}<option value="mock:era:unavailable">신문 없는 시대 (오류 시연)</option></select></label><label>K콘텐츠<select value={content} onChange={e => { const c = preferences.kContents.find(c => c.id === e.target.value); changeEra(c?.settingEraIds[0] || '', c?.id || ''); }}><option value="">직접 시대 선택</option>{preferences.kContents.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label><p className="caption">{content ? preferences.kContents.find(c => c.id === content)?.settingNote : '작품의 시대 배경으로 게시 신문을 고릅니다.'}</p></div>}
      </section>
      <div className="explore-grid"><section aria-labelledby="location-title"><h2 id="location-title">현재 위치에서 시작</h2><p>위치 오차 20m 이하에서 확인합니다.</p><div className="actions"><button className="primary" disabled={!!busy} onClick={() => locate(true)}>현재 위치 확인</button><button disabled={!!busy} onClick={() => locate()}>시연 위치 사용</button></div>
        <p className="status-message" role="status">{busy === 'location' ? '위치를 확인하는 중…' : locationMessage}</p>
        <label className="photo-label">사진 추가 (선택)<input type="file" accept="image/*" onChange={e => setPhoto(!!e.target.files?.length)} /></label><p className="caption">{photo ? '선택됨. 사진은 업로드·저장·EXIF 분석하지 않습니다. 현재 위치로 계속합니다.' : '사진 없이 진행 가능합니다. 사진 GPS 비교는 아직 연결되지 않았습니다.'}</p>
        <details className="demo-controls"><summary>시연 오류 설정</summary><label>위치 상태<select value={scenario} onChange={e => setScenario(e.target.value)}><option value="location-ok">정상 (오차 10m)</option><option value="location-uncertain">오차 초과 (25m)</option><option value="outside-spot">거점 밖</option><option value="denied">위치 권한 거부</option></select></label><label className="check"><input type="checkbox" checked={failSvg} onChange={e => setFailSvg(e.target.checked)} />SVG 실패</label><label className="check"><input type="checkbox" checked={failChat} onChange={e => setFailChat(e.target.checked)} />챗봇 실패</label></details>
      </section><section aria-labelledby="map-title"><h2 id="map-title">장소와 게시 신문</h2><PlacesMap places={places} selectedId={selected} onSelect={onSelect} position={position} positionIsDemo isMock />
        {!spots.length && preferences && <p role="status">이 시대의 게시 신문이 있는 거점이 없습니다. 시대를 다시 선택해 주세요.</p>}
        <ul className="place-list">{places.map((p, i) => <li key={p.id}><button aria-pressed={selected === p.id} onClick={() => setSelected(p.id)}><span>{i + 1}. {p.name}</span><small>{p.availableEraIds ? `${districtNames[p.districtCode]} / 게시 시대 ${p.availableEraIds.length}개` : p.category || '관광지'}</small></button></li>)}</ul>
        {selectedPlace && <p className="caption">선택: {selectedPlace.name}</p>}<button className="primary" disabled={!canOpen || !!busy} onClick={openPaper}>{busy === 'edition' ? '신문을 여는 중…' : '이 장소의 신문 펼치기'}</button><p className="caption">거점을 선택하고 현재 위치를 먼저 확인해 주세요. ko·반경 100m는 mock 값이며 제품 미확정입니다.</p>
      </section></div>
      <section className="paper-section" aria-label="역사 신문">{edition ? <Newspaper edition={edition} sources={dataset.sources} forceFailure={failSvg} /> : <div className="empty-paper"><h2>장소에서 만나는 한 장의 신문</h2><p role="status">{editionMessage}</p><p className="caption">검토된 완성본을 선택하는 흐름입니다. 방문 중 기사를 생성하지 않습니다.</p></div>}</section>
      <section id="visit" className="visit-grid"><div><h2>주변의 다음 장소</h2>{!nearby ? <p>위치를 확인하면 주변 음식점과 관광지가 나타납니다.</p> : [...nearby.restaurants, ...nearby.touristPlaces].map(p => {
        const access = nearby.accessibilityRecords.find(a => a.placeId === p.id);
        return <article className="local-place" key={p.id}><h3>{p.name}</h3><p>{p.category || '관광지'} / {p.address}</p><p>휠체어 출입: {accessNames[access?.features.find(f => f.key === 'wheelchair_entry')?.status || 'unknown']}</p><p className="caption">{p.storeId ? '가격·메뉴·영업시간·소상공인 여부 미확인' : '접근성 근거는 이 관광지에만 적용됩니다.'}<br />출처: 시연 자료 / 확인일 {access?.checkedAt.slice(0, 10) || '미확인'}</p></article>;
      })}</div><div><h2>함께 정하는 방문 순서</h2><p>조회한 후보와 접근성 정보로 순서를 제안합니다.</p><form onSubmit={recommend}><label className="check"><input type="checkbox" checked={needs} onChange={e => { setNeeds(e.target.checked); setCourse(null); setChatMessage('조건이 바뀌었습니다. 방문 순서를 다시 요청해 주세요.'); }} />휠체어 출입 확인 필수</label><label>궁금한 점<textarea value={question} onChange={e => setQuestion(e.target.value)} required rows="3" maxLength="500" /></label><button className="primary" disabled={!check || !!busy}>{busy === 'chat' ? '후보를 확인하는 중…' : '시연 방문 순서 추천'}</button></form><p role="status" className="status-message">{chatMessage}</p>{course && <><ol className="course-list">{course.stopIds.map((id, i) => <li key={id}><strong>{places.find(p => p.id === id)?.name || '이름 미확인'}</strong><p>{course.reasons[i]}</p></li>)}</ol><p>미확인: {course.unknownFields.join(', ')}</p><p className="caption">{course.warnings.join(' / ')}<br />출처: 시연 출처 (실제 사료 아님)</p></>}</div></section>
    </main><footer>서대문구 / 종로구 / 마포구 / 은평구<br />가상 신문·추천 시연 / 실백엔드·최종 신문 미연결</footer>
    </div>}
  </>;
}
export default App;
