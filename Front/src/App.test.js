import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ status: 'ok' }) })
  );
});

test('shows backend status', async () => {
  render(<App />);
  expect(await screen.findByText(/백엔드 상태: ok/)).toBeInTheDocument();
});
