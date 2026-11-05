import { act, fireEvent, render, screen } from '@testing-library/react';
import NewspaperSheet from './NewspaperSheet';

const record={spotId:'JNG09',ko:{headline:'한글 제목',paragraphs:['한글 기사 전체'],asset:'/assets/newspapers/ko/JNG09.svg',bytes:3,width:402,height:1000},en:{headline:'English headline',paragraphs:['Complete English article'],asset:'/assets/newspapers/en/JNG09.svg',bytes:3,width:402,height:1100}};
let engine, originalSpeech, originalUtterance;
beforeEach(()=>{
  originalSpeech=window.speechSynthesis;originalUtterance=window.SpeechSynthesisUtterance;
  engine={getVoices:()=>[{lang:'ko-KR'},{lang:'en-US'}],addEventListener:jest.fn(),removeEventListener:jest.fn(),speak:jest.fn(),cancel:jest.fn()};
  window.speechSynthesis=engine;window.SpeechSynthesisUtterance=function(text){this.text=text;};
  URL.createObjectURL=jest.fn(()=> 'blob:newspaper');URL.revokeObjectURL=jest.fn();
});
afterEach(()=>{window.speechSynthesis=originalSpeech;window.SpeechSynthesisUtterance=originalUtterance;jest.restoreAllMocks();});
test('only the selected asset loads; language changes cancel narration and stale fetches cannot replace it',async()=>{
  let resolveKorean;global.fetch=jest.fn(url=>url.includes('/ko/')?new Promise(resolve=>{resolveKorean=resolve;}):Promise.resolve({ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer}));
  const {unmount}=render(<NewspaperSheet record={record} initialLanguage="ko" simulation onClose={()=>{}}/>);
  expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][0]).toContain('/ko/JNG09.svg');expect(engine.speak).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'기사 읽어주기'}));expect(engine.speak.mock.calls[0][0].text).toBe('한글 제목');
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'en'}});
  expect(await screen.findByRole('img',{name:'English headline'})).toBeInTheDocument();expect(engine.cancel).toHaveBeenCalled();
  await act(async()=>resolveKorean({ok:true,arrayBuffer:async()=>new Uint8Array([4,5,6]).buffer}));
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);expect(screen.queryByRole('img',{name:'한글 제목'})).not.toBeInTheDocument();
  unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:newspaper');expect(engine.removeEventListener).toHaveBeenCalled();
});
test('a missing SVG keeps the full equivalent article readable and Escape closes without reaching the scene',async()=>{
  global.fetch=jest.fn(()=>Promise.resolve({ok:false}));const close=jest.fn(),parentKey=jest.fn();
  render(<div onKeyDown={parentKey}><NewspaperSheet record={record} initialLanguage="ko" onClose={close}/></div>);
  expect(await screen.findByRole('alert')).toHaveTextContent('신문 이미지를 불러오지 못했어요');expect(screen.getByText('한글 기사 전체')).toBeVisible();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});expect(close).toHaveBeenCalledTimes(1);expect(parentKey).not.toHaveBeenCalled();
});
