import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AccessibilityBadge, { accessibilityFor } from './AccessibilityBadge';
import badges from './place-badges.json';
import { places } from '../data/places';

function Example({ id = 'JNG12', language = 'ko' }) {
  const [expanded, setExpanded] = useState(false);
  return <AccessibilityBadge place={places.find(place => place.id === id)} language={language} expanded={expanded} onToggle={setExpanded}/>;
}
test('only the 22 exact source IDs receive badges: eight entry and fourteen conditional', () => {
  expect(new Set(badges.records.map(item => item.sourceId)).size).toBe(22);
  expect(badges.records.filter(item => item.icon === 'wheelchair.svg')).toHaveLength(8);
  expect(badges.records.filter(item => item.icon === 'info.svg')).toHaveLength(14);
  expect(places.filter(place => accessibilityFor(place.id))).toHaveLength(22);
  expect(accessibilityFor('MPO05')).toBeUndefined();
  const { container } = render(<Example id="SDM01"/>);
  expect(container).toBeEmptyDOMElement();
});
test('click and keyboard disclose exact source conditions; Escape restores the icon without bubbling', () => {
  const parent = jest.fn();
  render(<div onClick={parent} onKeyDown={parent}><Example/></div>);
  const button = screen.getByRole('button', { name: '경복궁: 접근 조건 확인' });
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  const region = screen.getByRole('region');
  expect(region).toHaveTextContent(accessibilityFor('JNG12').detail);
  expect(parent).not.toHaveBeenCalled();
  fireEvent.keyDown(region, { key: 'Escape' });
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
  expect(parent).not.toHaveBeenCalled();
});
test('English labels identify the unmodified Korean source instead of inventing a translated claim', () => {
  render(<Example id="JNG14" language="en"/>);
  fireEvent.click(screen.getByRole('button', { name: '국립민속박물관: Wheelchair entry information' }));
  expect(screen.getByText('Source information (Korean)')).toBeInTheDocument();
  expect(screen.getByText(accessibilityFor('JNG14').detail)).toHaveAttribute('lang', 'ko');
});
