import { useCallback, useMemo, useRef, useState } from 'react';
import PlacesMap from './PlacesMap';
import { coordinateLabels, districts, eras, filterPlaces, hasCoordinates, places } from '../data/places';
import { requestPosition } from '../arrival/location';
import './HistoryExplorer.css';

export default function HistoryExplorer({ position, positionIsDemo, onPosition, onReplay, onDemo }) {
  const [districtId, setDistrictId] = useState(''), [eraId, setEraId] = useState(''), [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null), [locationState, setLocationState] = useState('');
  const list = useRef(null);
  const filtered = useMemo(() => filterPlaces({ districtId, eraId, query }), [districtId, eraId, query]);
  const selected = filtered.find(place => place.id === selectedId);
  const select = useCallback(id => {
    setSelectedId(id);
    const row = Array.from(list.current?.querySelectorAll('[data-place-id]') || []).find(node => node.dataset.placeId === id);
    if (row && list.current.clientHeight) {
      const offset = row.getBoundingClientRect().top - list.current.getBoundingClientRect().top;
      if (offset < 0 || offset + row.clientHeight > list.current.clientHeight) list.current.scrollTop += offset;
    }
  }, []);
  const markerCount = filtered.filter(hasCoordinates).length;
  function filter(update, value) { update(value); setSelectedId(null); }
  async function locate() {
    setLocationState('현재 위치를 확인하는 중…');
    try {
      const next = await requestPosition();
      onPosition(next, false);
      setLocationState(`현재 위치를 표시했습니다. 위치 오차 ${Math.round(next.accuracyM)}m. 방문 인증은 아직 연결되지 않았습니다.`);
    } catch (error) { setLocationState(error.message); }
  }
  return <>
    <a className="skip" href="#main">본문으로 건너뛰기</a>
    <header className="masthead history-masthead"><a href="#main" className="wordmark">seoul times</a><span>서울의 역사 지도</span><button onClick={onReplay}>진입 연출 다시 보기</button></header>
    <main id="main" className="history-explorer" tabIndex={-1}>
      <div className="history-heading"><div><p className="eyebrow">서대문 · 종로 · 마포 · 은평</p><h1>장소에 남은 시간</h1></div><button onClick={locate} disabled={locationState === '현재 위치를 확인하는 중…'}>현재 위치 확인</button></div>
      <p className="history-data-note">사용자 선정 장소 {places.length}곳 · 원본 좌표 {places.filter(hasCoordinates).length}곳 · 위치 미확인 {places.filter(place => !hasCoordinates(place)).length}곳. 장소·역사·좌표는 검토 전 자료입니다.</p>
      <p className="caption" role="status">{locationState || (position ? positionIsDemo ? '개발용 가상 위치가 표시됩니다. 실제 GPS·방문 인증이 아닙니다.' : '현재 위치를 표시합니다. 방문 인증은 아직 연결되지 않았습니다.' : '위치를 허용하지 않아도 전체 장소를 탐색할 수 있습니다.')}</p>
      <div className="history-filters"><label>지역<select value={districtId} onChange={event => filter(setDistrictId, event.target.value)}><option value="">전체 지역</option>{Object.entries(districts).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>역사 시대<select value={eraId} onChange={event => filter(setEraId, event.target.value)}><option value="">전체 시대</option>{Object.entries(eras).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="history-search">장소 검색<input type="search" value={query} onChange={event => filter(setQuery, event.target.value)} placeholder="장소명 또는 원본 ID" /></label></div>
      <div className="history-workspace"><section className="history-map-panel" aria-label="역사 장소 지도"><PlacesMap places={filtered} selectedId={selectedId} onSelect={select} position={position} positionIsDemo={positionIsDemo} /></section>
        <section className="history-list-panel" aria-labelledby="history-list-title"><div className="history-list-heading"><h2 id="history-list-title">장소 목록</h2><p role="status">{filtered.length}곳 · 지도 핀 {markerCount}개</p></div>
          {!filtered.length && <p className="history-empty" role="status">조건에 맞는 장소가 없습니다. 검색어나 필터를 바꿔 주세요.</p>}
          <ul ref={list} className="history-place-list">{filtered.map(place => <li key={place.id}><button data-place-id={place.id} aria-pressed={selectedId === place.id} onClick={() => select(place.id)}><span className="place-row-top"><small>{place.id} · {districts[place.districtId]}</small><small className={!hasCoordinates(place) ? 'coordinate-missing' : ''}>{coordinateLabels[place.coordStatus]}</small></span><strong>{place.name}</strong><span>{eras[place.eraId]} · {place.category}</span></button></li>)}</ul>
        </section></div>
      <section className="history-detail" aria-labelledby="history-detail-title" data-selected-place={selected?.id || ''}>
        {selected ? <><div className="history-detail-top"><div><p className="eyebrow">{selected.id} · {districts[selected.districtId]} · {selected.eraDetail}</p><h2 id="history-detail-title">{selected.name}</h2></div><span className="draft-label">검토 전</span></div><p>{selected.storyShort || '역사 소개가 아직 없습니다.'}</p><p className="caption">{selected.address || '주소 미확인'} · {coordinateLabels[selected.coordStatus]}{hasCoordinates(selected) ? ' / 원본 입력값, 위치 정확도 미검증' : ' / 지도에 임의 위치를 표시하지 않습니다.'}</p><p>접근성: 미확인</p>{selected.accessibilityNote && <p className="caption">입력 메모: {selected.accessibilityNote}</p>}{selected.verifyNote && <p className="caption">검토 메모: {selected.verifyNote}</p>}{!!selected.sources.length && <nav aria-label="선택 장소 출처">{selected.sources.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">입력 출처 {index + 1} ↗</a>)}</nav>}<p className="caption">게시된 완성 신문·방문 반경이 아직 연결되지 않았습니다.</p></> : <><h2 id="history-detail-title">지도 핀이나 목록에서 장소를 선택하세요.</h2><p>위치가 미확인인 장소도 목록에서 내용을 확인할 수 있습니다.</p></>}
      </section>
      <details className="history-demo"><summary>개발용 가상 시연</summary><p>기존 신문·접근성·추천 시연은 가상 데이터로 별도 확인합니다.</p><button onClick={onDemo}>가상 신문 시연 열기</button></details>
    </main><footer>엑셀 원본 기반 장소 탐색 · 역사·좌표·접근성 검토 전</footer>
  </>;
}
