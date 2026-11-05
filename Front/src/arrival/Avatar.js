export default function Avatar() {
  return <div className="arrival-avatar" aria-label="내 위치 아바타" role="img">
    <div className="avatar-motion-trail" />
    <svg viewBox="0 0 100 130" aria-hidden="true">
      <defs><linearGradient id="arrival-coat" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e1a358" /><stop offset="1" stopColor="#9e5432" /></linearGradient></defs>
      <path d="M50 126 34 100h32Z" fill="#243d48" />
      <path d="m34 87-5 21 16 4 5-24m4-1 6 25 16-5-8-24" fill="#29424c" />
      <path d="m27 53-12 27 13 7 12-19m30-15 15 27-12 7-14-20" fill="#b16a3c" stroke="#71452f" strokeWidth="2" />
      <path d="M30 55q20-18 40 0l5 37q-24 16-50 0Z" fill="url(#arrival-coat)" stroke="#704a33" strokeWidth="2" />
      <path d="M49 55v44m-19-22 12 4m18-1 12-4" fill="none" stroke="#f0c78b" strokeWidth="3" />
      <rect x="34" y="44" width="32" height="16" rx="6" fill="#30535d" />
      <ellipse cx="50" cy="33" rx="19" ry="21" fill="#e9bd92" stroke="#604b3b" strokeWidth="2" />
      <path d="M30 31q-3-28 20-27 25 0 21 27l-8-8-29 1Z" fill="#29434c" />
      <path d="M25 24q27-11 51 0l-2 8q-27-7-48 0Z" fill="#476874" />
      <path d="M41 36v2m18-2v2" stroke="#483e34" strokeWidth="3" strokeLinecap="round" />
      <path d="M45 46q5 4 10-1" fill="none" stroke="#a7634d" strokeWidth="2" strokeLinecap="round" />
      <path d="m31 61 8 7m23-8 8 7" stroke="#2f4850" strokeWidth="5" />
    </svg>
  </div>;
}
