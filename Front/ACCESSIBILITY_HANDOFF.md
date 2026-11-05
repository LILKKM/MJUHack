# 접근성 배지·메시지 카드 헤더 인계 — 2026-11-06

프런트 worktree Front/ 안에서만 변경했다. 기존 미커밋 디자인·지도·홍길동·잠금·신문/TTS·백엔드 작업을 보존했다. push/PR/배포 없음.

변경: src/accessibility/AccessibilityBadge.js·accessibility.css·place-badges.json 및 테스트, src/assets/accessibility/{wheelchair.svg,info.svg,LICENSE.txt}, WorldControls/VisitOverlays 및 관련 CSS·테스트, DESIGN.md/design-system/tokens.json.

카드 제목은 모든 장소에서 X와 같은 헤더 행에 놓인다. 카드 글씨 크기·72%/최대280px 정사각형은 유지한다. 접근성 배지는 X 바로 왼쪽과 목록 제목 옆의 별도 버튼이며 중첩 button을 사용하지 않는다. 18px Phosphor SVG는 원본 파일을 CSS mask로 표시하며44px 조작영역을 갖는다. MIT 파일을 동봉했다.

매핑은 통합관리 handoff/design/accessibility-icons/place-badges.json 22행을 그대로 사용한다. sourceId 정확 조인: 민트 휠체어8, 살구 정보14. 미확인35와 밤섬 일반출입제한1에는 배지를 붙이지 않는다. 접근성 전체/현장 도로/핀20m 도달 인증을 주장하지 않는다. 원문 detail을 그대로 표시하며 영어 UI는 영어 기능 라벨과 'Source information (Korean)'으로 한국어 원문을 식별한다. 한국어 밖 검토되지 않은 안내를 번역·추가하지 않았다. 대규모 카탈로그/assessment 전체는 번들링하지 않았다.

클릭/터치/Enter로 펼침, 펼친 영역 초점과 내부 스크롤, Escape로 닫고 아이콘 초점 복귀를 제공한다. 목록에서 badge/안내 클릭은 장소 선택으로 전파되지 않는다. 카드 X와도 독립이며 신문 잠금/20m·accuracy 판정에 접근하지 않는다. 44px 높이와 긴 제목을 우선하므로 작은 목록/배지가 많은 검색 결과에서 보이는 행 수는 기존5.5보다 줄 수 있다.

최신 사용자 후속: 토스트 상하4px·반경8px. 장소 목록 버튼의 남색/베이지와 나머지 기존 UI 크기는 보존한다.

검증:25 suites/82 tests PASS. 정확ID8/14·비대상 배지 없음·영어 라벨/한국어 원문·클릭 전파·잠금/닫기 독립·Escape 초점 확인. 실제 브라우저에서 목록22개, 안내 열림, 카드 Enter→영역 초점→Escape→아이콘→Tab→X, 신문 잠금 유지 확인.320px에서 제목/18px 아이콘/44px 버튼/X 겹침0,390px 제목과X 세로중심 동일 확인. 토스트 computed 상하4px/반경8px 확인. 임시viewport 복원.

Plan/Design: 기준 문서·최신 소스·ID매핑 확인. Build: 기존 React/CSS와 공통 컴포넌트 재사용. Test: 단위/통합·빌드·실제 브라우저. 해당 how/architect/cross-validation-skill 등의 전용 스킬은 현재 설치 카탈로그에 없어 직접 코드 검토·검증으로 대체했다. Deploy N/A. 실기기 스크린리더/현장 접근성/백엔드 대화는 미검증이다.

후속 사용자 수정: 안내 라벨/본문9pt로 축소하고 body portal의 fixed 말풍선을 아이콘 위에 배치했다. 지도 프레임 안으로 가로 위치를 제한하고 창 resize/scroll 시 다시 계산한다. 카드/목록 내부를 가리지 않도록 기존 inline/absolute 패널 배치를 대체했다. 스크롤 안내 배경/그림자/블러는 제거하고 흰 글씨·화살표만 유지한다. 이 후속 수정에는 테스트/빌드를 추가 실행하지 않았다.
