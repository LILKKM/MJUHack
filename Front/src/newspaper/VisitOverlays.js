import { useEffect, useState } from 'react';
import { districts } from '../data/places';
import { visitMessages } from './visit';
import NewspaperSheet from './NewspaperSheet';
import './newspaper.css';

export function VisitToast({ toast, onDone, reduced }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    setLeaving(false);
    const enter = reduced ? 80 : 180, exit = reduced ? 80 : 220;
    const leave = setTimeout(() => setLeaving(true), enter + 2400);
    const finish = setTimeout(onDone, enter + 2400 + exit);
    return () => { clearTimeout(leave); clearTimeout(finish); };
  }, [toast.id, onDone, reduced]);
  return <div className={`visit-toast ${leaving ? 'is-leaving' : ''} ${reduced ? 'is-reduced' : ''}`} role="status" aria-live="polite" aria-atomic="true">{toast.message}</div>;
}

export default function VisitOverlays({ reader, onTrack, reduced, onChat }) {
  const { place, opened, record, language, simulation, gate, toast } = reader;
  const korean = language === 'ko';
  return <>
    {place && !opened && <section className="world-place-card" aria-label={korean ? '선택 장소' : 'Selected place'} data-selected-place={place.id} lang={language}>
      <button className="place-card-close" onClick={reader.clear} aria-label={korean ? '장소 카드 닫기' : 'Close place card'}>×</button>
      <small>{districts[place.districtId]}</small><h2>{place.name}</h2><p className="place-card-address">{place.address}</p>
      <p className="place-card-visit">{gate.allowed ? (korean ? '이 장소의 신문을 읽을 수 있어요.' : 'You can read the newspaper here.') : visitMessages[language][gate.reason]}</p>
      {gate.reason !== 'outside' && !gate.allowed && <p className="place-card-radius">{korean ? '현장에서 20m 이내에 도착하면 열립니다.' : 'Available within 20m of this place.'}</p>}
      {gate.allowed && record && <button className="place-card-action" onClick={reader.openPaper}>{korean ? '신문 펼치기' : 'Open newspaper'}</button>}
      {!simulation && ['demo', 'missing', 'stale', 'denied', 'accuracy'].includes(gate.reason) && <button className="place-card-action" onClick={onTrack}>{korean ? '현재 위치 확인' : 'Check my location'}</button>}
      {simulation && <small className="place-card-simulation">{korean ? '개발 시뮬레이션 · 실제 GPS 아님' : 'Development simulation · not real GPS'}</small>}
    </section>}
    {opened && record && <NewspaperSheet key={place.id} record={record} initialLanguage={language} simulation={!!simulation} onClose={reader.closePaper} onChat={onChat}/>}
    {toast && <VisitToast key={toast.id} toast={toast} onDone={reader.dismissToast} reduced={reduced}/>}
  </>;
}
