export const ROBE_COLORS = [
  { name: '남색', color: '#254e78' }, { name: '청록', color: '#287a83' },
  { name: '적색', color: '#973c36' }, { name: '아이보리', color: '#e4d9bd' }
];
export const ARRIVAL_TIMING = { revealing: 2600, flying: 1000, departing: 480, following: 360, cloudClearing: 3200, falling: 280, impact: 580, pullback: 1600, recoil: 580 };

export const NEXT_PHASE = { revealing: 'flying', flying: 'departing', departing: 'following', following: 'preparing', falling: 'impact', impact: 'pullback', pullback: 'landed' };
