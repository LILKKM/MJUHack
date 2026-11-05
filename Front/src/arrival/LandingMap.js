import { useCallback, useRef, useState } from 'react';
import PlacesMap from '../components/PlacesMap';

export default function LandingMap({ position, demo = false, onReady, places = [], selectedId, onSelect = () => {}, phase = 'preparing', anchorRef, mapControlRef }) {
  const attribution = useRef(null);
  const [state, setState] = useState('waiting');
  const ready = useCallback(result => {
    setState(result.unavailable ? 'fallback' : 'ready');
    if (result.maps) attribution.current.replaceChildren(new result.maps.LogoControl().getElement());
    onReady(result);
  }, [onReady]);
  return <div className="arrival-map-layer" aria-label="서울 지도">
    <div className="arrival-ground">
      <PlacesMap world enabled={!!position || ['following', 'preparing', 'clearing', 'falling', 'impact', 'pullback', 'landed'].includes(phase)} interactive={phase === 'landed'} places={places} selectedId={selectedId} onSelect={onSelect} position={position} positionIsDemo={demo} anchorRef={anchorRef} mapControlRef={mapControlRef} onReady={ready} />
    </div>
    <div className="arrival-map-attribution"><div ref={attribution}/>{state === 'ready' && <span>© NAVER Corp.</span>}</div>
    {state === 'fallback' && <p className="arrival-map-note" role="status">네이버 지도 미연결 · 장소 목록을 이용할 수 있습니다.</p>}
  </div>;
}
