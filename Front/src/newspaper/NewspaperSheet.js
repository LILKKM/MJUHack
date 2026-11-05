import { useEffect, useRef, useState } from 'react';
import NarrationControls from './NarrationControls';

export default function NewspaperSheet({ record, initialLanguage, simulation, onClose, onChat }) {
  const [language, setLanguage] = useState(initialLanguage), [asset, setAsset] = useState({ state: 'loading' });
  const dialog = useRef(null), article = record[language];
  const korean = language === 'ko';
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true, objectUrl;
    setAsset({ state: 'loading' });
    async function load() {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL || ''}${article.asset}`, { signal: controller.signal });
        if (!response.ok) throw new Error('asset-unavailable');
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== article.bytes) throw new Error('asset-size');
        if (window.crypto?.subtle) {
          const hash = Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256', buffer)), value => value.toString(16).padStart(2, '0')).join('');
          if (hash !== article.sha256) throw new Error('asset-hash');
        }
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([buffer], { type: 'image/svg+xml' }));
        setAsset({ state: 'ready', url: objectUrl });
      } catch (error) { if (active && error.name !== 'AbortError') setAsset({ state: 'error' }); }
    }
    load();
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [article]);
  function keyboard(event) {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = dialog.current.querySelectorAll('button:not([disabled]),select,summary,a[href]');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div className="newspaper-overlay">
    <div className="newspaper-scrim" onClick={onClose} aria-hidden="true"/>
    <section ref={dialog} className="newspaper-sheet" role="dialog" aria-modal="true" aria-label={korean ? '역사 신문' : 'History newspaper'} tabIndex={-1} lang={language} onKeyDown={keyboard}>
      <div className="newspaper-toolbar">
        <NarrationControls key={`${record.spotId}-${language}`} article={article} language={language}/>
        <label><span className="arrival-sr-only">{korean ? '신문 언어' : 'Newspaper language'}</span><select value={language} onChange={event => setLanguage(event.target.value)}><option value="ko">한국어</option><option value="en">English</option></select></label>
        <button onClick={onClose} aria-label={korean ? '신문 닫기' : 'Close newspaper'}>×</button>
      </div>
      <div className="newspaper-scroll">
        {simulation && <p className="newspaper-preview-label">{korean ? '개발 시뮬레이션 · 실제 GPS 방문 아님' : 'Development simulation · not a real GPS visit'}</p>}
        <p className="newspaper-review-label">{korean ? '역사·번역 검토 중인 신문 미리보기' : 'Newspaper preview · historical and translation review pending'}</p>
        {asset.state === 'loading' && <p role="status">{korean ? '신문을 펼치고 있어요…' : 'Opening the newspaper…'}</p>}
        {asset.state === 'error' && <p role="alert">{korean ? '신문 이미지를 불러오지 못했어요. 기사 본문은 아래에서 읽을 수 있어요.' : 'The newspaper image could not load. You can still read the article below.'}</p>}
        {asset.state === 'ready' && <img className="newspaper-original" src={asset.url} width={article.width} height={article.height} alt={article.headline} onError={() => setAsset({ state: 'error' })}/>}
        <details className="newspaper-transcript" open={asset.state === 'error'}><summary>{korean ? '기사 본문 읽기' : 'Read article text'}</summary><article><p>{article.dateline}</p><h2>{article.headline}</h2>{article.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article></details>
        <footer className="newspaper-footer"><button disabled={!onChat} onClick={onChat}>{korean ? '주변 추천받기' : 'Get nearby recommendations'}</button></footer>
      </div>
    </section>
  </div>;
}
