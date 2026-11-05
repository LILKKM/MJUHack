import { useEffect, useRef, useState } from 'react';
import { createNarration } from './narration';

const messages = {
  ko: { play: '기사 읽어주기', stop: '낭독 정지', restart: '처음부터 다시 읽기', unsupported: '이 브라우저는 음성 읽기를 지원하지 않아요.', 'loading-voices': '음성을 준비하고 있어요.', 'no-voice': '이 기기에 한국어 음성이 없어요.', error: '음성을 재생하지 못했어요. 다시 시도해 주세요.' },
  en: { play: 'Read article aloud', stop: 'Stop reading', restart: 'Read again from the start', unsupported: 'This browser does not support speech.', 'loading-voices': 'Loading voices…', 'no-voice': 'No English voice is available on this device.', error: 'Speech could not play. Please try again.' },
};

export default function NarrationControls({ article, language }) {
  const controller = useRef(null), [state, setState] = useState('loading-voices');
  const copy = messages[language];
  useEffect(() => {
    controller.current = createNarration({ engine: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance, article, language, onState: setState });
    return () => controller.current.dispose();
  }, [article, language]);
  const unavailable = ['unsupported', 'loading-voices', 'no-voice'].includes(state);
  return <div className="newspaper-narration" data-narration-state={state}>
    <button className="newspaper-speaker" disabled={unavailable} onClick={() => state === 'speaking' ? controller.current.stop() : controller.current.play()} aria-label={state === 'speaking' ? copy.stop : state === 'finished' || state === 'stopped' ? copy.restart : copy.play}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{state === 'speaking' ? <path d="M6 6h12v12H6z"/> : <><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/></>}</svg>
    </button>
    {state === 'speaking' && <button className="newspaper-restart" onClick={() => controller.current.play()} aria-label={copy.restart}>↺</button>}
    <span className={copy[state] ? '' : 'arrival-sr-only'} role="status">{copy[state] || (state === 'speaking' ? (language === 'ko' ? '낭독 중' : 'Reading aloud') : '')}</span>
  </div>;
}
