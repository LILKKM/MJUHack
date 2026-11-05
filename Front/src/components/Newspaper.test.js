import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Newspaper from './Newspaper';
import { dataset } from '../api/mock';
test('SVG title and source support keyboard activation while equivalent text remains available', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"><title id="mock-paper-title">Mock</title><text>Title</text><g id="mock-paper-illustration"><text>Image</text></g><g id="mock-paper-source"><text>Source</text></g></svg>') }));
  render(<Newspaper edition={dataset.newspaperEditions[0]} sources={dataset.sources} forceFailure={false} />);
  const title = await screen.findByRole('button', { name: '신문 제목 설명 펼치기' });
  expect(title).toHaveAttribute('tabindex', '0');
  fireEvent.keyDown(title, { key: 'Enter' });
  expect(screen.getByRole('status')).toHaveTextContent(dataset.newspaperEditions[0].accessibleText);
  fireEvent.keyDown(screen.getByRole('button', { name: '신문 출처 확인' }), { key: ' ' });
  await waitFor(() => expect(document.activeElement).toHaveTextContent('출처와 제작 정보'));
});
