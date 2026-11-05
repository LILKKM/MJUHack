import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import wheelchairIcon from '../assets/accessibility/wheelchair.svg';
import infoIcon from '../assets/accessibility/info.svg';
import badges from './place-badges.json';
import { newspaperLanguage } from '../newspaper/visit';
import './accessibility.css';

const bySourceId = new Map(badges.records.map(record => [record.sourceId, record]));
export function accessibilityFor(sourceId) { return bySourceId.get(sourceId); }

export default function AccessibilityBadge({ place, language = newspaperLanguage(), expanded, onToggle, variant = 'list' }) {
  const id = useId(), trigger = useRef(null), detail = useRef(null);
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    if (!expanded || !trigger.current) return;
    function positionAbove() {
      const bounds = trigger.current.getBoundingClientRect();
      const frame = trigger.current.closest('.arrival')?.getBoundingClientRect();
      const width = Math.min(260, (frame?.width || window.innerWidth) - 24);
      const left = Math.max((frame?.left || 0) + 12, Math.min(bounds.right - width, (frame?.right || window.innerWidth) - width - 12));
      setPosition({ left, width, bottom: window.innerHeight - bounds.top + 8, maxHeight: Math.max(64, Math.min(240, bounds.top - Math.max(0, frame?.top || 0) - 16)) });
    }
    positionAbove();
    window.addEventListener('resize', positionAbove);
    window.addEventListener('scroll', positionAbove, true);
    return () => { window.removeEventListener('resize', positionAbove); window.removeEventListener('scroll', positionAbove, true); };
  }, [expanded]);
  useEffect(() => { if (expanded) detail.current?.focus({ preventScroll: true }); }, [expanded]);
  const badge = accessibilityFor(place.id);
  if (!badge) return null;
  const korean = language === 'ko';
  const wheelchair = badge.icon === 'wheelchair.svg';
  const label = korean ? badge.label : wheelchair ? 'Wheelchair entry information' : 'Check access conditions';
  const icon = wheelchair ? wheelchairIcon : infoIcon;
  function escape(event) {
    if (event.key !== 'Escape' || !expanded) return;
    event.stopPropagation(); onToggle(false); trigger.current?.focus();
  }
  return <>
    <button ref={trigger} type="button" className={`accessibility-trigger accessibility-${variant}`} data-accessibility-source={place.id} aria-label={`${place.name}: ${label}`} aria-expanded={expanded} aria-controls={`${id}-detail`} onKeyDown={escape} onClick={event => { event.stopPropagation(); onToggle(!expanded); }}>
      <span className={wheelchair ? 'accessibility-mint' : 'accessibility-apricot'}><span className="accessibility-glyph" aria-hidden="true" style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}/></span>
    </button>
    {expanded && createPortal(<section style={position || { visibility: 'hidden' }} ref={detail} id={`${id}-detail`} className={`accessibility-detail accessibility-${variant}-detail scroll-without-bar`} aria-label={`${place.name}: ${label}`} tabIndex={0} onKeyDown={escape} onClick={event => event.stopPropagation()}>
      <strong>{label}</strong>
      {!korean && <small>Source information (Korean)</small>}
      {!wheelchair && <p lang="ko">휠체어 출입을 돕는 조건이 일부 확인된 곳입니다.</p>}
      <p lang="ko">{badge.detail}</p>
    </section>, document.body)}
  </>;
}
