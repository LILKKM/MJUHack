import { useEffect, useRef, useState } from 'react';
export default function Newspaper({ edition, sources, forceFailure }) {
  const host = useRef(null), sourcePanel = useRef(null);
  const [state, setState] = useState('loading'), [attempt, setAttempt] = useState(0), [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading'); setRevealed(false);
    host.current.replaceChildren();
    (async () => {
      try {
        if (forceFailure) throw new Error('SVG_LOAD_FAILED');
        // Only bundled, reviewed asset paths are loaded. External/server SVG needs a sanitizer at the adapter boundary.
        if (edition.svgAssetPath !== 'assets/newspaper-demo.svg') throw new Error('UNAPPROVED_SVG');
        const response = await fetch(`${process.env.PUBLIC_URL}/${edition.svgAssetPath}`, { signal: controller.signal });
        if (!response.ok) throw new Error('SVG_LOAD_FAILED');
        const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
        if (controller.signal.aborted) return;
        const svg = doc.documentElement;
        if (svg.nodeName !== 'svg' || doc.querySelector('script, foreignObject, parsererror')) throw new Error('INVALID_SVG');
        svg.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attr => { if (/^on/i.test(attr.name) || /href$/i.test(attr.name)) node.removeAttribute(attr.name); }));
        svg.setAttribute('role', 'group');
        svg.setAttribute('aria-label', edition.headline);
        const activate = item => item.action === 'open_sources' ? sourcePanel.current.focus() : setRevealed(v => !v);
        edition.interactionManifest.elements.forEach(item => {
          let el = svg.querySelector(`[id="${item.id}"]`);
          if (!el) return;
          // SVG title is metadata; attach its action to the visible masthead text.
          if (el.tagName === 'title') el = svg.querySelector('text');
          if (item.action === 'none') return;
          el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
          el.setAttribute('aria-label', item.action === 'open_sources' ? '신문 출처 확인' : `${item.role === 'title' ? '신문 제목' : '삽화'} 설명 펼치기`);
          el.addEventListener('click', () => activate(item));
          el.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); activate(item); } });
        });
        host.current.replaceChildren(svg);
        setState('ready');
      } catch (error) { if (!controller.signal.aborted) setState('error'); }
    })();
    return () => controller.abort();
  }, [edition, forceFailure, attempt]);
  return <article className="newspaper">
    <h2>{edition.headline}</h2><p>{edition.lead}</p><p className="caption">콘텐츠 발행일 {edition.publishedAt?.slice(0, 10) || '미확인'} / 사건 시점은 동등 텍스트에서 확인해 주세요.</p>
    <div className="paper-layout"><div>
      {state === 'loading' && <p role="status">신문 자산을 불러오는 중…</p>}
      {state === 'error' && <div role="alert"><p>신문 그림을 불러오지 못했습니다. 기사와 출처는 아래에서 읽을 수 있습니다.</p><button onClick={() => setAttempt(v => v + 1)}>신문 자산 다시 시도</button></div>}
      <div ref={host} className={`svg-paper ${revealed ? 'revealed' : ''}`} />
      <p className="caption">{edition.aiIllustrationLabel}</p>
      {revealed && <p role="status">{edition.accessibleText}</p>}
    </div><div className="article-text"><h3>동등 텍스트</h3><p>{edition.accessibleText}</p>{edition.body.map((p, i) => <p key={i}>{p}</p>)}
      <div ref={sourcePanel} tabIndex="-1" className="sources"><h3>출처와 제작 정보</h3>{sources.filter(s => edition.sourceIds.includes(s.id)).map(s => <p key={s.id}>{s.title}<br />제공: {s.provider}<br />확인일: {s.checkedAt.slice(0, 10)}<br />사용 범위: {s.usageScope}<br />가상 출처이며 실제 사료 링크가 아닙니다.</p>)}<p>콘텐츠 {edition.contentVersion} / 템플릿 {edition.templateVersion}</p></div>
    </div></div>
  </article>;
}
