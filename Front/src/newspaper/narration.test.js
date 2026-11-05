import { articleChunks, createNarration } from './narration';

const article={headline:'Test headline',paragraphs:['First paragraph. '.repeat(30),'Second paragraph.']};
let engine, voices, states, Utterance;
beforeEach(()=>{
  jest.useFakeTimers();voices=[{lang:'ko-KR',name:'한국어'},{lang:'en-US',name:'English'}];states=[];
  engine={getVoices:jest.fn(()=>voices),speak:jest.fn(),cancel:jest.fn(),addEventListener:jest.fn(),removeEventListener:jest.fn()};
  Utterance=function(text){this.text=text;};
});
afterEach(()=>jest.useRealTimers());
function create(language='en'){return createNarration({engine,Utterance,article,language,onState:state=>states.push(state)});}
test('article chunks preserve headline and every paragraph, bound length and never use illustration metadata',()=>{
  const chunks=articleChunks(article);expect(chunks.every(text=>text.length<=220)).toBe(true);
  expect(chunks.join(' ').replace(/\s+/g,' ')).toBe([article.headline,...article.paragraphs].join(' ').replace(/\s+/g,' ').trim());
});
test('explicit play sequences all chunks in the selected language; stop invalidates late callbacks and restart cancels first',()=>{
  const controller=create('ko');expect(engine.speak).not.toHaveBeenCalled();
  controller.play();expect(engine.speak.mock.calls[0][0].lang).toBe('ko-KR');
  const first=engine.speak.mock.calls[0][0];first.onend();expect(engine.speak).toHaveBeenCalledTimes(2);
  controller.stop();engine.speak.mock.calls[1][0].onend();expect(engine.speak).toHaveBeenCalledTimes(2);
  controller.play();expect(engine.speak.mock.calls[2][0].text).toBe(article.headline);
  const current=engine.speak.mock.calls[2][0];controller.play();current.onend();expect(engine.speak).toHaveBeenCalledTimes(4);
  controller.dispose();engine.speak.mock.calls[3][0].onend();expect(engine.speak).toHaveBeenCalledTimes(4);
  expect(engine.cancel).toHaveBeenCalled();expect(engine.removeEventListener).toHaveBeenCalledWith('voiceschanged',expect.any(Function));
});
test('completed speech includes every chunk once and reports finished',()=>{
  const controller=create();controller.play();
  const chunks=articleChunks(article);
  for(let i=0;i<chunks.length;i++){expect(engine.speak.mock.calls[i][0].text).toBe(chunks[i]);engine.speak.mock.calls[i][0].onend();}
  expect(engine.speak).toHaveBeenCalledTimes(chunks.length);expect(states.at(-1)).toBe('finished');controller.dispose();
});
test('asynchronously loaded voices enable reading without auto playback and empty voices remain unavailable',()=>{
  voices=[];const controller=create();expect(states.at(-1)).toBe('loading-voices');controller.play();expect(engine.speak).not.toHaveBeenCalled();
  jest.advanceTimersByTime(3000);expect(states.at(-1)).toBe('no-voice');
  voices=[{lang:'en-GB'}];engine.addEventListener.mock.calls[0][1]();expect(states.at(-1)).toBe('ready');expect(engine.speak).not.toHaveBeenCalled();
  controller.play();expect(engine.speak.mock.calls[0][0].lang).toBe('en-GB');controller.dispose();
});
test('unsupported and speech errors do not create overlapping audio jobs',()=>{
  createNarration({article,language:'en',onState:state=>states.push(state)}).play();expect(states.at(-1)).toBe('unsupported');
  const controller=create();controller.play();engine.speak.mock.calls[0][0].onerror({error:'network'});expect(states.at(-1)).toBe('error');
  engine.speak.mock.calls[0][0].onend();expect(engine.speak).toHaveBeenCalledTimes(1);controller.dispose();
});
