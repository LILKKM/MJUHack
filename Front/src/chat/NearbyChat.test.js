import { fireEvent, render, screen } from '@testing-library/react';
import NearbyChat from './NearbyChat';
import { createChatSession, sendChatMessage } from './api';
jest.mock('./api',()=>({createChatSession:jest.fn(),sendChatMessage:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();Element.prototype.scrollIntoView=jest.fn(()=>Promise.resolve());});
test('explicit messages use the real API adapter and preserve session across followups',async()=>{
 createChatSession.mockResolvedValue('session-1');sendChatMessage.mockResolvedValue('서버에서 확인한 답변');
 render(<NearbyChat place={{id:'JNG09',name:'의금부 터'}} onClose={()=>{}}/>);
 expect(createChatSession).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('추천 요청'),{target:{value:'근처 카페 추천'}});fireEvent.click(screen.getByRole('button',{name:'보내기'}));
 expect(await screen.findByText('서버에서 확인한 답변')).toBeInTheDocument();
 expect(createChatSession).toHaveBeenCalledWith({id:'JNG09',name:'의금부 터'},expect.any(AbortSignal));
 expect(sendChatMessage).toHaveBeenCalledWith('session-1','근처 카페 추천',expect.any(AbortSignal));
 fireEvent.change(screen.getByLabelText('추천 요청'),{target:{value:'식당도'}});fireEvent.click(screen.getByRole('button',{name:'보내기'}));
 await screen.findByText('식당도');expect(createChatSession).toHaveBeenCalledTimes(1);
});
test('server failure preserves input and no simulated reply appears; Escape closes only chat',async()=>{
 createChatSession.mockRejectedValue(new Error('서버 연결 실패'));const close=jest.fn(),outer=jest.fn();
 render(<div onKeyDown={outer}><NearbyChat onClose={close}/></div>);
 fireEvent.change(screen.getByLabelText('추천 요청'),{target:{value:'카페'}});fireEvent.click(screen.getByRole('button',{name:'보내기'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('서버 연결 실패');expect(screen.getByLabelText('추천 요청')).toHaveValue('카페');
 fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});expect(close).toHaveBeenCalled();expect(outer).not.toHaveBeenCalled();
});
