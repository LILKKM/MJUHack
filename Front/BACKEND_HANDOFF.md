# 프론트 인계 · 2026-11-06

사용자 결정: 프론트 코드를 push하고 실행/실제 챗봇 연결은 백엔드 담당자가 이어서 진행한다.

## 실행과 연결

- `npm ci`, `npm start` → localhost:3000. `src/setupProxy.js`가 개발 중 `/api`만 **127.0.0.1:8080** Spring으로 전달한다. 새 패키지 의존성 없음.
- 다른 Spring 주소를 쓰면 `.env.local`의 `REACT_APP_API_BASE_URL`에 공개 origin을 설정하고 프론트 재시작. 배포에서는 같은 origin의 `/api` 역방향 프록시 또는 명시적 origin/CORS 설정 필요. 이 개발 프록시는 production build 서버에 포함되지 않는다.
- Maps 공개 ID와 발행 Style ID는 `.env.example`을 참고해 각 환경에 설정한다. 기존 `.env.local`은 커밋하지 않는다. Claude 키·DB 비밀정보는 서버 환경에만 둔다.
- `src/chat/api.js`: `POST /api/chat/sessions`에 `{startSpotId,startLabel}` → `{id}`. 이어서 `POST /api/chat/sessions/{id}/messages`에 `{content}` → `{message:{content}}`. 현재 저장소 Spring SessionDtos/ChatDtos/Controller와 대조했다. 위치 원본·사진·프론트 비밀키를 보내지 않는다.
- 주변 추천받기와 신문 안의 동일 버튼은 실제 API 어댑터를 쓰는 대화창을 연다. 성공 응답만 표시하고 대화 세션을 유지한다. 실패하면 입력을 보존하고 재전송한다. 기존 가상 신문 추천은 개발 도구 안의 별도 mock 회귀 흐름이다.

## 구현/검증

- 기존 디자인 토큰(크림/민트/남색/살구·느좋체/Abhaya·홀수pt), 검은 Chomsky 제호. 헤더 아래 검은 이중선.
- 하단 한 행의 라운드 `장소 목록`/`주변 추천받기`. 아이콘 없음. 목록58곳/원본40좌표/좌표 없는18곳을 보존한다. 기존 손잡이·서울시 날짜 라벨·추가 OSM 문구·중복 제공자 표시는 제거하고 네이버 제공자 한 줄을 유지한다.
- v3 GLB(12,525,596bytes)로 교체. 비동기 모델 로드 완료 후 준비, 실패 경로, 정지/reduced·Landing→Idle·GPU 자원 정리 포함. 기존 스크롤/1초 응시/선행 낙하/지도 낙하의 phase/카메라/시간을 유지했다. 기존 절차형 모델은 복구용으로 남긴다.
- 20m/accuracy20m/클라이언트30초 관측·언어·신문116SVG/동등 본문·브라우저TTS를 연결했다. 원본 자산과 미게시/역사·번역 미검토 상태를 보존한다. 프론트 게이트는 서버 인증/URL 비공개 처리가 아니다.
- 전체 **24 suites /71 tests PASS**, production build 성공(main.fe38ae40.js/main.c404c1b7.css), 소스 diff --check 통과(원본 라이선스의 CRLF/공백은 그대로 보존). GLB 교체 전 기준은20 suites/60tests.
- 실제 인앱브라우저에서 v3 CloudFlight/정면 응시·지도 착지, 이중선/두 버튼/목록58곳, 챗봇 진입·실제 `/api` 요청 실패와 입력 보존을 확인했다. `scrollIntoView`가 Promise를 돌려주는 브라우저에서 effect cleanup 오류가 나던 문제를 수정하고 회귀 검증했다.

## 백엔드 담당자가 이어서 확인

현재 로컬 Spring8080·MySQL3307/3306이 실행 중이지 않고 Claude 서버 키도 설정되어 있지 않아 **실제 LLM 답변은 미검증**이다. 요청을 fake 성공으로 대체하지 않는다. 현재 서버와 DB를 정상 실행하고 서버 키를 설정한 다음 위 경로로 실제 대화를 검증한다. Spring/DB/DDL은 이번 작업에서 수정하지 않았다.

서버는 방문20m/accuracy20m/관측 신선도와 게시본 필터를 별도로 보장해야 한다. 신문 자산은 미게시 미리보기이며 역사 고증/영문 감수, 현장 GPS, 물리 휴대폰 터치·음성 청취, 모바일 GLB 성능은 후속 검증이다. 원본 모델의 옷자락 흰 얼룩/찢어진 단, 옆에서 얇은 바람 꼬리는 모델 제작 쪽의 알려진 문제다. GLB 캐릭터 외부 공개/배포 사용 허락은 제작 인계의 확인 항목을 유지한다.

## 자산

로컬에서 이미 검증한116SVG는 `public/assets/newspapers`에 포함하며 각 파일은 약7MB다. 루트 `assets/history-newspapers/v2/newspapers`와 동일 바이트이므로 Git blob은 중복 저장하지 않는다. ZIP/미리보기/중간 제작물은 Front에 복사하지 않았다. 신문을 열 때 선택 언어 한 파일만 지연 로딩한다. 원본 서체/라이선스 고지는 `public/assets/fonts`에 있다. 자산 검토 상태·좌표 overlay는 자동 승격하지 않는다.
