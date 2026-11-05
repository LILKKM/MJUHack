import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { districts, eras } from '../data/places';
import { containsPoint } from '../data/mapArea';
import AccessibilityBadge from '../accessibility/AccessibilityBadge';
import VisitSimulation from '../newspaper/VisitSimulation';
import './world.css';

export default function WorldControls({ entryRef, places, selectedId, onSelect, filters, onFilter, position, demo, tracking, status, onTrack, onStop, mapControlRef, onMoveDemo, onDemo, onRestart, onSimulate, onChat }) {
  const [panel, setPanel] = useState(false), [searchOpen, setSearchOpen] = useState(false), [accessibilityId, setAccessibilityId] = useState(null);
  const searchButton = useRef(null), searchFirst = useRef(null), listViewport = useRef(null), panelRef = useRef(null);
  useEffect(() => { if (panel) (searchOpen ? searchFirst : searchButton).current?.focus(); }, [panel, searchOpen]);
  useLayoutEffect(() => {
    const node = listViewport.current;
    if (!panel || !node || searchOpen) return;
    node.scrollTop = 0;
    const rows = [...node.querySelectorAll('.world-place-list > li')].slice(0, 6);
    const labels = rows.map(row => row.querySelector('.world-place-select span'));
    const resize = () => {
      const style = getComputedStyle(node);
      const available = node.getBoundingClientRect().height - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0);
      const minimums = rows.map((row, index) => {
        const button = getComputedStyle(row.querySelector('.world-place-select')), border = getComputedStyle(row);
        return Math.max(row.querySelector('.accessibility-trigger') ? 44 : 24, labels[index].getBoundingClientRect().height + parseFloat(button.paddingTop || 0) + parseFloat(button.paddingBottom || 0)) + parseFloat(border.borderBottomWidth || 0);
      });
      if (rows.length < 6) {
        node.style.setProperty('--place-row-height', `${Math.max(24, available / 5.5)}px`);
        return;
      }
      let low = 24, high = Math.max(24, available);
      for (let step = 0; step < 20; step += 1) {
        const middle = (low + high) / 2;
        const total = minimums.reduce((height, minimum, index) => height + Math.max(minimum, middle) * (index === 5 ? .5 : 1), 0);
        if (total > available) high = middle; else low = middle;
      }
      node.style.setProperty('--place-row-height', `${low}px`);
    };
    resize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(node); labels.forEach(label => observer.observe(label));
    return () => observer.disconnect();
  }, [panel, searchOpen, places]);
  const swipe = useRef(null), swiped = useRef(false);
  const showPanel = panel;
  const close = useCallback(() => { setPanel(false); setSearchOpen(false); setAccessibilityId(null); onSelect(null); entryRef?.current?.focus({ preventScroll: true }); }, [onSelect, entryRef]);
  useEffect(() => {
    if (!panel) return;
    const outside = event => {
      if (panelRef.current?.contains(event.target) || entryRef?.current?.contains(event.target) || event.target.closest?.('.accessibility-detail')) return;
      close();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [panel, close, entryRef]);
  function open() { setAccessibilityId(null); onSelect(null); setSearchOpen(false); setPanel(true); }
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
      onKeyDown={event => { if (event.key === 'ArrowUp') { event.preventDefault(); open(); } if (event.key === 'ArrowDown') { event.preventDefault(); close(); } }}>장소 목록</button><button className="world-chat-button" onClick={() => { setPanel(false); onChat?.(); }}>주변 추천받기</button></nav>
    <button className="world-recenter" aria-label="홍길동 위치로 돌아가기" disabled={!position || !containsPoint(position)} title={!position ? '위치를 확인하면 사용할 수 있어요.' : !containsPoint(position) ? '현재 위치가 탐색 영역 밖입니다.' : '홍길동 위치로 돌아가기'} onClick={() => { setPanel(false); setSearchOpen(false); onSelect(null); mapControlRef.current?.center(position); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg></button>
    {showPanel && <aside ref={panelRef} id="world-places-panel" className={`world-places-panel ${searchOpen ? 'is-search-open' : ''}`} aria-label="서울 장소 목록" onKeyDown={event => { if (event.key !== 'Escape') return; event.stopPropagation(); if (searchOpen) { setSearchOpen(false); searchButton.current?.focus(); } else close(); }}>
      <div className="world-panel-heading"><h2>장소</h2><button ref={searchButton} className="world-search-toggle" aria-label={searchOpen ? '장소 검색 접기' : '장소 검색 펼치기'} aria-expanded={searchOpen} aria-controls="world-search-fields" onClick={() => setSearchOpen(value => !value)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></button></div>
      <div ref={listViewport} className="world-panel-body scroll-without-bar" tabIndex={0} aria-label="장소 목록 스크롤">
      <p className="arrival-sr-only" role="status">{places.length}개 장소{filters.districtId || filters.eraId || filters.query ? ' · 검색 조건 적용됨' : ''}</p>
      {searchOpen && <div id="world-search-fields">
      <div className="world-filters"><label>지역<select ref={searchFirst} value={filters.districtId} onChange={event => onFilter({ ...filters, districtId: event.target.value })}><option value="">전체 지역</option>{Object.entries(districts).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>시대<select value={filters.eraId} onChange={event => onFilter({ ...filters, eraId: event.target.value })}><option value="">전체 시대</option>{Object.entries(eras).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>장소 검색<input type="search" value={filters.query} onChange={event => onFilter({ ...filters, query: event.target.value })}/></label></div>
      </div>}
      <ul className="world-place-list">{places.map(place => <li key={place.id}><button className="world-place-select" data-place-id={place.id} aria-pressed={selectedId === place.id} onClick={() => { setPanel(false); onSelect(place.id); }}><span>{place.name}</span></button><AccessibilityBadge place={place} expanded={accessibilityId === place.id} onToggle={open => setAccessibilityId(open ? place.id : null)}/></li>)}</ul>
      {!places.length && <p className="world-list-empty" role="status">조건에 맞는 장소가 없습니다.</p>}
      {searchOpen && <div className="world-panel-settings"><details className="world-location-settings"><summary>위치 설정</summary>{status && <p role="status">{status}</p>}<button onClick={onTrack}>{demo || !position ? '실제 GPS로 전환' : tracking ? '위치 다시 확인' : 'GPS 추적 시작'}</button>{tracking && <button onClick={onStop}>추적 멈추기</button>}</details>
      {process.env.NODE_ENV === 'development' && <details className="world-developer-options"><summary>개발 도구</summary><button onClick={onDemo}>가상 신문 시연 열기</button><button onClick={onRestart}>진입 연출 다시 보기</button><button onClick={() => mapControlRef.current?.area()}>전체 영역</button>
        {demo && <div className="world-demo-movement"><span>가상 위치 이동</span><div><button aria-label="가상 위치 서쪽 이동" onClick={() => onMoveDemo(-30, 0)}>←</button><button aria-label="가상 위치 북쪽 이동" onClick={() => onMoveDemo(0, 30)}>↑</button><button aria-label="가상 위치 남쪽 이동" onClick={() => onMoveDemo(0, -30)}>↓</button><button aria-label="가상 위치 동쪽 이동" onClick={() => onMoveDemo(30, 0)}>→</button></div><small>개발 시연 · 실제 GPS 아님</small></div>}
        {onSimulate && <VisitSimulation onSimulate={value => { setPanel(false); onSimulate(value); }}/>}
      </details>}
      </div>}
      </div>
    </aside>}
  </div>;
}
