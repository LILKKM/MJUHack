import { useEffect, useRef, useState } from 'react';
import { ARRIVAL_TIMING, ROBE_COLORS } from './heroConfig';
export function canvasAnchor(point, bounds) {
  return point ? { x: point.left + point.width / 2 - bounds.left, y: point.top + point.height / 2 - bounds.top } : null;
}
export default function HeroCanvas({ phase, paused, reduced, onReady, onCamera, anchorRef, hasPosition = true }) {
  const canvas=useRef(null), renderer=useRef(null);
  const [ready,setReady]=useState(false), [failed,setFailed]=useState(false);
  const color=ROBE_COLORS[0].color;
  const controls=useRef({phase,paused,reduced,color,hasPosition});
  useEffect(()=>{controls.current={phase,paused,reduced,color,hasPosition};},[phase,paused,reduced,color,hasPosition]);
  useEffect(()=>{
    let active=true, frame, previous, lastPhase, elapsed=0, time=0;
    setReady(false); setFailed(false);
    const loaded=()=>{if(active){setReady(true);onReady();}};
    const failed=()=>{if(active){setFailed(true);onReady();}};
    import('./heroScene').then(({createHeroScene})=>{
      if(!active)return;
      renderer.current=createHeroScene(canvas.current,onCamera,{onLoad:loaded,onError:failed});
      const draw=now=>{
        const dt=previous?Math.min((now-previous)/1000,.05):0; previous=now;
        const current=controls.current;
        if(lastPhase!==current.phase){elapsed=0;lastPhase=current.phase;}
        if(!current.paused&&!document.hidden){elapsed+=dt;if(!current.reduced)time+=dt;}
        const duration=ARRIVAL_TIMING[current.phase]||ARRIVAL_TIMING.recoil;
        const progress=current.reduced?1:Math.min(1,elapsed*1000/duration);
        const point=anchorRef?.current?.getBoundingClientRect();
        const anchor=canvasAnchor(point,canvas.current.getBoundingClientRect());
        if(!document.hidden&&canvas.current.clientWidth)renderer.current.render({...current,progress,time,anchor,dt:current.paused?0:dt});
        frame=requestAnimationFrame(draw);
      };
      frame=requestAnimationFrame(draw);
    }).catch(failed);
    return()=>{active=false;cancelAnimationFrame(frame);renderer.current?.dispose();renderer.current=null;};
  },[onReady,onCamera,anchorRef]);
  return <div className={`hero-scene ${ready?'is-ready':''} ${failed?'is-failed':''}`}>
    <canvas ref={canvas} className="hero-canvas" role="img" aria-label="근두운을 탄 홍길동 3D"/>
    {failed&&<p className="arrival-sr-only" role="alert">이 기기에서 3D를 표시하지 못했습니다. 위치 화면으로 계속할 수 있습니다.</p>}
  </div>;
}
