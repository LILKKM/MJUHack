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
