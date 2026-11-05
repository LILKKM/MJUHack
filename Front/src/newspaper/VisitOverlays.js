import { useEffect, useState } from 'react';
import AccessibilityBadge from '../accessibility/AccessibilityBadge';
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

export default function VisitOverlays({ reader, reduced, onChat }) {
  const { place, opened, record, language, simulation, gate, toast } = reader;
  const korean = language === 'ko';
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  useEffect(() => setAccessibilityOpen(false), [place?.id, opened]);
  return <>
    {place && !opened && <section className="world-place-card" aria-label={korean ? '선택 장소' : 'Selected place'} data-selected-place={place.id} lang={language}>
      <header className="place-card-heading"><h2>{place.name}</h2><div className="place-card-tools"><AccessibilityBadge place={place} language={language} expanded={accessibilityOpen} onToggle={setAccessibilityOpen} variant="card"/><button className="place-card-close ui-close" onClick={reader.clear} aria-label={korean ? '장소 카드 닫기' : 'Close place card'}><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m2 2 8 8M10 2 2 10"/></svg></button></div></header>
      {place.descriptionKo && <p className="place-card-description" lang="ko">{place.descriptionKo}</p>}
      {gate.allowed && record && <button className="place-card-action" onClick={reader.openPaper}>{korean ? '신문 펼치기' : 'Open newspaper'}</button>}
    </section>}
    {opened && record && <NewspaperSheet key={place.id} record={record} initialLanguage={language} simulation={!!simulation} onClose={reader.closePaper} onChat={onChat}/>}
    {toast && <VisitToast key={toast.id} toast={toast} onDone={reader.dismissToast} reduced={reduced}/>}
  </>;
}
