import { fireEvent, render, screen } from '@testing-library/react';
import WorldControls from './WorldControls';
import { places } from '../data/places';

function show() {
  return render(<WorldControls entryRef={{current:null}} places={places} onSelect={()=>{}} filters={{districtId:'',eraId:'',query:''}} onFilter={()=>{}} demo mapControlRef={{current:null}}/>);
}
test('the centred masthead has no floating map controls and the bottom handle keeps all 58 places accessible', () => {
  const {container}=show();
  expect(container.querySelector('.world-header button')).toBeNull();
  expect(screen.queryByRole('button',{name:'지도 확대'})).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('button',{name:'장소 목록 열기'}),{key:'ArrowUp'});
  expect(container.querySelectorAll('[data-place-id]')).toHaveLength(58);
  fireEvent.keyDown(screen.getByRole('button',{name:'장소 목록 닫기'}),{key:'ArrowDown'});
  expect(screen.queryByRole('complementary',{name:'서울 장소 목록'})).not.toBeInTheDocument();
});
test('swiping the handle opens and closes the list without a synthetic click undoing the gesture', () => {
  const previous=window.PointerEvent;
  window.PointerEvent=class extends MouseEvent { constructor(type,options){super(type,options);Object.defineProperty(this,'pointerId',{value:options.pointerId});} };
  show();
  const handle=screen.getByRole('button',{name:'장소 목록 열기'});
  handle.setPointerCapture=jest.fn();handle.hasPointerCapture=()=>true;handle.releasePointerCapture=jest.fn();
  fireEvent.pointerDown(handle,{clientY:600,pointerId:1});fireEvent.pointerUp(handle,{clientY:520,pointerId:1});fireEvent.click(handle,{detail:1});
  expect(screen.getByRole('complementary',{name:'서울 장소 목록'})).toBeInTheDocument();
  fireEvent.pointerDown(handle,{clientY:300,pointerId:2});fireEvent.pointerUp(handle,{clientY:380,pointerId:2});fireEvent.click(handle,{detail:1});
  expect(screen.queryByRole('complementary',{name:'서울 장소 목록'})).not.toBeInTheDocument();
  window.PointerEvent=previous;
});

test('default list contains only place names; search disclosure exposes filters and Escape restores its trigger', () => {
  const onFilter=jest.fn(),onSelect=jest.fn();
  const {container}=render(<WorldControls places={places} onSelect={onSelect} filters={{districtId:'',eraId:'',query:''}} onFilter={onFilter} entryRef={{current:null}} mapControlRef={{current:null}}/>);
  fireEvent.click(screen.getByRole('button',{name:'장소 목록 열기'}));
  expect(screen.getByRole('heading',{name:'장소',exact:true})).toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('지역')).not.toBeInTheDocument();
  expect(container.querySelector('[data-place-id="SDM01"]')).toHaveTextContent(places.find(p=>p.id==='SDM01').name);
  expect(container.querySelector('[data-place-id="SDM01"]').querySelector('small')).toBeNull();
  expect(screen.queryByText(/SDM01/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'장소 검색 펼치기'}));
  expect(screen.getByRole('combobox',{name:'지역'})).toHaveFocus();
  fireEvent.change(screen.getByRole('searchbox',{name:'장소 검색'}),{target:{value:'경복궁'}});
  expect(onFilter).toHaveBeenLastCalledWith({districtId:'',eraId:'',query:'경복궁'});
  container.querySelector('.world-panel-body').scrollTop=100;
  fireEvent.keyDown(screen.getByRole('searchbox'),{key:'Escape'});
  expect(container.querySelector('.world-panel-body').scrollTop).toBe(0);
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'장소 검색 펼치기'})).toHaveFocus();
  fireEvent.click(container.querySelector('[data-place-id="SDM01"]'));
  expect(onSelect).toHaveBeenLastCalledWith('SDM01');
  expect(screen.queryByRole('complementary',{name:'서울 장소 목록'})).not.toBeInTheDocument();
});

test('recenter uses the latest avatar position, closes the list and never requests a different GPS fix', () => {
  const center=jest.fn(),track=jest.fn(),select=jest.fn();
  const first={latitude:37.57,longitude:126.98},next={latitude:37.571,longitude:126.981};
  const props={entryRef:{current:null},places,onSelect:select,filters:{districtId:'',eraId:'',query:''},onFilter:()=>{},mapControlRef:{current:{center}},onTrack:track};
  const {rerender}=render(<WorldControls {...props} position={first}/>);
  fireEvent.click(screen.getByRole('button',{name:'장소 목록 열기'}));
  rerender(<WorldControls {...props} position={next}/>);
  fireEvent.click(screen.getByRole('button',{name:'홍길동 위치로 돌아가기'}));
  expect(center).toHaveBeenCalledWith(next);expect(select).toHaveBeenLastCalledWith(null);expect(track).not.toHaveBeenCalled();
  expect(screen.queryByRole('complementary',{name:'서울 장소 목록'})).not.toBeInTheDocument();
  rerender(<WorldControls {...props} position={null}/>);expect(screen.getByRole('button',{name:'홍길동 위치로 돌아가기'})).toBeDisabled();
});

test('list accessibility buttons are siblings and disclose conditions without selecting a place', () => {
  const select = jest.fn();
  const { container } = render(<WorldControls places={places} onSelect={select} filters={{districtId:'',eraId:'',query:''}} onFilter={()=>{}} entryRef={{current:null}} mapControlRef={{current:null}}/>);
  fireEvent.click(screen.getByRole('button', { name:'장소 목록 열기' })); select.mockClear();
  expect(container.querySelectorAll('[data-accessibility-source]')).toHaveLength(22);
  expect(container.querySelector('button button')).toBeNull();
  const badge = container.querySelector('[data-accessibility-source="JNG12"]');
  fireEvent.click(badge);
  expect(screen.getByRole('region', { name:/경복궁:/ })).toHaveTextContent('공식 경사로 관람동선');
  expect(select).not.toHaveBeenCalled();
  expect(screen.getByRole('complementary')).toBeInTheDocument();
  fireEvent.keyDown(badge, {key:'Escape'});
  expect(screen.getByRole('complementary')).toBeInTheDocument();
  expect(badge).toHaveFocus();
  fireEvent.click(container.querySelector('[data-place-id="JNG12"]'));
  expect(select).toHaveBeenCalledWith('JNG12');
});
