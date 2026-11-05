import { fireEvent, render, screen, within } from '@testing-library/react';
import HistoryExplorer from './HistoryExplorer';
const originalId = process.env.REACT_APP_NAVER_MAP_CLIENT_ID;
beforeEach(() => { delete process.env.REACT_APP_NAVER_MAP_CLIENT_ID; });
afterEach(() => { if (originalId === undefined) delete process.env.REACT_APP_NAVER_MAP_CLIENT_ID; else process.env.REACT_APP_NAVER_MAP_CLIENT_ID = originalId; });

test('all places remain selectable without a map, including missing-coordinate places; filtering clears old detail', () => {
  render(<HistoryExplorer onPosition={() => {}} onReplay={() => {}} onDemo={() => {}} />);
  const list = screen.getByRole('region', { name: '장소 목록' });
  expect(within(list).getAllByRole('button')).toHaveLength(58);
  fireEvent.click(within(list).getByRole('button', { name: /SDM03/ }));
  const detail = screen.getByRole('region', { name: '국립대한민국임시정부기념관' });
  expect(detail).toHaveAttribute('data-selected-place', 'SDM03');
  expect(within(detail).getByText(/지도에 임의 위치를 표시하지 않습니다/)).toBeInTheDocument();
  expect(within(detail).getByText('접근성: 미확인')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '지역' }), { target: { value: 'EPY' } });
  expect(within(list).getAllByRole('button')).toHaveLength(8);
  expect(screen.queryByRole('heading', { name: '국립대한민국임시정부기념관' })).not.toBeInTheDocument();
  expect(within(list).getByRole('status')).toHaveTextContent('8곳 · 지도 핀 0개');
  fireEvent.change(screen.getByRole('searchbox', { name: '장소 검색' }), { target: { value: '없는 장소' } });
  expect(within(list).queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByText(/조건에 맞는 장소가 없습니다/)).toBeInTheDocument();
});
