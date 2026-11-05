import { useState } from 'react';
import { hasCoordinates, places } from '../data/places';

export default function VisitSimulation({ onSimulate }) {
  const [placeId, setPlaceId] = useState('JNG09'), [metres, setMetres] = useState('20.1'), [language, setLanguage] = useState('ko');
  const [accuracy, setAccuracy] = useState('10'), [condition, setCondition] = useState('fresh');
  return <fieldset className="visit-simulation"><legend>방문 판정 시뮬레이션</legend><p>실제 GPS와 아바타 위치는 바뀌지 않습니다.</p>
    <label>시뮬레이션 장소<select value={placeId} onChange={event => setPlaceId(event.target.value)}>{places.filter(hasCoordinates).map(place => <option key={place.id} value={place.id}>{place.id} · {place.name}</option>)}</select></label>
    <label>시뮬레이션 거리<select value={metres} onChange={event => setMetres(event.target.value)}>{['19.9', '20', '20.1', '100'].map(value => <option key={value} value={value}>{value}m</option>)}</select></label>
    <label>시뮬레이션 정확도<select value={accuracy} onChange={event => setAccuracy(event.target.value)}><option value="10">10m</option><option value="20">20m</option><option value="21">21m</option></select></label>
    <label>시뮬레이션 위치 상태<select value={condition} onChange={event => setCondition(event.target.value)}><option value="fresh">새 위치</option><option value="stale">오래된 위치</option><option value="missing">위치 없음</option><option value="denied">권한 거부</option></select></label>
    <label>시뮬레이션 언어<select value={language} onChange={event => setLanguage(event.target.value)}><option value="ko">한국어</option><option value="en">English</option></select></label>
    <button onClick={() => onSimulate({ placeId, metres: Number(metres), accuracyM: Number(accuracy), condition, language })}>시뮬레이션 실행</button>
  </fieldset>;
}
