import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
jest.mock('./arrival/CloudCanvas', () => {
  const React = require('react');
  return function Clouds({ opening, onCleared }) { React.useEffect(() => { if (opening) onCleared(); }, [opening, onCleared]); return null; };
});
jest.mock('./arrival/HeroCanvas', () => {
  const React = require('react');
  return function Model({ onReady }) { React.useEffect(onReady, [onReady]); return null; };
});
const originalEnvironment = process.env.NODE_ENV;
beforeEach(() => {
  process.env.NODE_ENV = 'development'; jest.useFakeTimers();
  window.scrollTo = jest.fn();
  window.history.replaceState(null, '', '/');
  global.fetch = jest.fn(() => Promise.reject(new Error('SVG unavailable')));
});
afterEach(() => { process.env.NODE_ENV = originalEnvironment; jest.useRealTimers(); });
async function enterApp() {
  render(<App />);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  await act(async () => {});
  act(() => jest.advanceTimersByTime(2800));
  for (const duration of [1100, 600, 500, 400, 700, 1800]) act(() => jest.advanceTimersByTime(duration));
  fireEvent.click(screen.getByRole('button', { name: '장소 목록 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '장소 검색 펼치기' }));
  fireEvent.click(screen.getByText('개발 도구'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '가상 신문 시연 열기' })); });
}
test('permission-free entry unlocks a demo edition without a photo and SVG failure preserves text', async () => {
  await enterApp();
  expect(screen.getByRole('button', { name: '이 장소의 신문 펼치기' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '이 장소의 신문 펼치기' }));
  await screen.findByRole('heading', { name: /시연 시대 .*에서 온 신문/ });
  expect(await screen.findByText(/신문 그림을 불러오지 못했습니다/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '동등 텍스트' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '시대', exact: true }), { target: { value: 'mock:era:unavailable' } });
  expect(await screen.findByText(/이 시대의 게시 신문이 있는 거점이 없습니다/)).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '동등 텍스트' })).not.toBeInTheDocument();
});
test('accessibility condition remains selected after empty recommendation and location error relocks', async () => {
  await enterApp();
  fireEvent.click(screen.getByLabelText('휠체어 출입 확인 필수'));
  fireEvent.click(screen.getByRole('button', { name: '시연 방문 순서 추천' }));
  expect(await screen.findByText(/필수 접근성 조건을 확인한 음식점 후보가 없습니다/)).toBeInTheDocument();
  expect(screen.getByLabelText('휠체어 출입 확인 필수')).toBeChecked();
  fireEvent.change(screen.getByLabelText('위치 상태'), { target: { value: 'location-uncertain' } });
  fireEvent.click(screen.getByRole('button', { name: '시연 위치 사용' }));
  await screen.findByText(/위치 오차가 20m 이하여야 합니다/);
  expect(screen.getByRole('button', { name: '이 장소의 신문 펼치기' })).toBeDisabled();
});
