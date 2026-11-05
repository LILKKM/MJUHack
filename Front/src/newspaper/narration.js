export function articleChunks(article, maximum = 220) {
  const chunks = [];
  for (const paragraph of [article.headline, ...article.paragraphs]) {
    let remaining = paragraph.trim();
    while (remaining.length > maximum) {
      const boundary = Math.max(remaining.lastIndexOf('. ', maximum), remaining.lastIndexOf(' ', maximum));
      const end = boundary > maximum / 2 ? boundary + 1 : maximum;
      chunks.push(remaining.slice(0, end).trim());
      remaining = remaining.slice(end).trim();
    }
    if (remaining) chunks.push(remaining);
  }
  return chunks;
}

export function createNarration({ engine, Utterance, article, language, onState }) {
  let version = 0, disposed = false, speaking = false, voice, voiceTimer;
  const supported = !!Utterance && ['getVoices', 'speak', 'cancel', 'addEventListener', 'removeEventListener'].every(name => typeof engine?.[name] === 'function');
  const chunks = articleChunks(article);
  const update = state => { if (!disposed) onState(state); };
  function loadVoices() {
    if (!supported || disposed) return;
    clearTimeout(voiceTimer);
    let matches;
    try { matches = engine.getVoices().filter(item => item.lang.toLowerCase().split('-')[0] === language); }
    catch { update('unsupported'); return; }
    if (speaking) return;
    voice = matches.find(item => item.default) || matches[0];
    if (voice) update('ready');
    else {
      update('loading-voices');
      voiceTimer = setTimeout(() => update('no-voice'), 3000);
    }
  }
  function stop(state = 'stopped') {
    version += 1; speaking = false;
    if (supported) engine.cancel();
    update(state);
  }
  function play() {
    if (!supported || disposed || !voice || !chunks.length) return;
    stop();
    const current = version, selectedVoice = voice;
    speaking = true; update('speaking');
    function speak(index) {
      if (disposed || current !== version) return;
      if (index === chunks.length) { speaking = false; update('finished'); return; }
      const utterance = new Utterance(chunks[index]);
      utterance.lang = selectedVoice.lang; utterance.voice = selectedVoice;
      let settled = false;
      utterance.onend = () => { if (!settled) { settled = true; speak(index + 1); } };
      utterance.onerror = event => {
        if (settled || disposed || current !== version) return;
        settled = true;
        stop(event.error === 'canceled' || event.error === 'interrupted' ? 'stopped' : 'error');
      };
      try { engine.speak(utterance); } catch { stop('error'); }
    }
    speak(0);
  }
  if (supported) { engine.addEventListener('voiceschanged', loadVoices); loadVoices(); }
  else update('unsupported');
  return {
    play, stop,
    dispose() {
      disposed = true; version += 1; clearTimeout(voiceTimer);
      if (supported) { engine.removeEventListener('voiceschanged', loadVoices); engine.cancel(); }
    },
  };
}
