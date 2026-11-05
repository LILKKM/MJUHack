import { useRef, useState } from 'react';
import { coordinateLabels, districts, eras, hasCoordinates, places as allPlaces } from '../data/places';
import { containsPoint } from '../data/mapArea';
import VisitSimulation from '../newspaper/VisitSimulation';
import './world.css';

export default function WorldControls({ entryRef, places, selectedId, onSelect, filters, onFilter, position, demo, tracking, status, onTrack, onStop, mapControlRef, onMoveDemo, onDemo, onRestart, onSimulate, onChat }) {
  const [panel, setPanel] = useState(false);
  const swipe = useRef(null), swiped = useRef(false);
  const showPanel = panel;
  function close() { setPanel(false); onSelect(null); }
  function open() { onSelect(null); setPanel(true); }
  function endSwipe(event) {
    if (swipe.current === null) return;
    const distance = event.clientY - swipe.current; swipe.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    swiped.current = Math.abs(distance) > 28;
    if (distance < -28) open();
    if (distance > 28) close();
  }
  return <div className="world-controls">
    <header className="world-header paper-masthead"><strong className="brand-wordmark">Seoul Times</strong></header>
    <div className="arrival-sr-only" role="status">{status || (position && !containsPoint(position) ? '현재 위치가 탐색 영역 밖입니다.' : tracking ? 'GPS 위치를 따라가는 중' : position ? '마지막 확인 위치' : '위치 없이 둘러보는 중')}</div>
    <nav className="world-bottom-actions" aria-label="지도 탐색"><button ref={entryRef} className="world-list-button" aria-label={showPanel ? '장소 목록 닫기' : '장소 목록 열기'} aria-expanded={showPanel} aria-controls="world-places-panel"
      onPointerDown={event => { swiped.current = false; swipe.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerUp={endSwipe} onPointerCancel={() => { swipe.current = null; }}
      onClick={event => { if (swiped.current && event.detail !== 0) { swiped.current = false; return; } swiped.current = false; if (showPanel) close(); else open(); }}
      onKeyDown={event => { if (event.key === 'ArrowUp') { event.preventDefault(); open(); } if (event.key === 'ArrowDown') { event.preventDefault(); close(); } }}>{showPanel ? '장소 목록 닫기' : '장소 목록'}</button><button className="world-chat-button" onClick={() => { setPanel(false); onChat?.(); }}>주변 추천받기</button></nav>
    {showPanel && <aside id="world-places-panel" className="world-places-panel" aria-label="서울 장소 목록"><div className="world-panel-heading"><h2>장소 {allPlaces.length}</h2></div>
      <div className="world-filters"><label>지역<select value={filters.districtId} onChange={event => onFilter({ ...filters, districtId: event.target.value })}><option value="">전체 지역</option>{Object.entries(districts).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>시대<select value={filters.eraId} onChange={event => onFilter({ ...filters, eraId: event.target.value })}><option value="">전체 시대</option>{Object.entries(eras).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>장소 검색<input type="search" value={filters.query} onChange={event => onFilter({ ...filters, query: event.target.value })}/></label></div>
      <p className="world-count" role="status">{places.length}곳 · 좌표 {places.filter(hasCoordinates).length}곳 · 위치 미확인 {places.filter(place => !hasCoordinates(place)).length}곳</p>
      <ul className="world-place-list">{places.map(place => <li key={place.id}><button data-place-id={place.id} aria-pressed={selectedId === place.id} onClick={() => { setPanel(false); onSelect(place.id); }}><small>{place.id} · {coordinateLabels[place.coordStatus]}</small><strong>{place.name}</strong></button></li>)}</ul>
      {!places.length && <p role="status">조건에 맞는 장소가 없습니다.</p>}
      <details className="world-location-settings"><summary>위치 설정</summary>{status && <p role="status">{status}</p>}<button onClick={onTrack}>{demo || !position ? '실제 GPS로 전환' : tracking ? '위치 다시 확인' : 'GPS 추적 시작'}</button>{tracking && <button onClick={onStop}>추적 멈추기</button>}</details>
      {process.env.NODE_ENV === 'development' && <details className="world-developer-options"><summary>개발 도구</summary><button onClick={onDemo}>가상 신문 시연 열기</button><button onClick={onRestart}>진입 연출 다시 보기</button><button onClick={() => mapControlRef.current?.area()}>전체 영역</button>
        {demo && <div className="world-demo-movement"><span>가상 위치 이동</span><div><button aria-label="가상 위치 서쪽 이동" onClick={() => onMoveDemo(-30, 0)}>←</button><button aria-label="가상 위치 북쪽 이동" onClick={() => onMoveDemo(0, 30)}>↑</button><button aria-label="가상 위치 남쪽 이동" onClick={() => onMoveDemo(0, -30)}>↓</button><button aria-label="가상 위치 동쪽 이동" onClick={() => onMoveDemo(30, 0)}>→</button></div><small>개발 시연 · 실제 GPS 아님</small></div>}
        {onSimulate && <VisitSimulation onSimulate={value => { setPanel(false); onSimulate(value); }}/>}
      </details>}
    </aside>}
  </div>;
}
