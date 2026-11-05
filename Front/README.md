최신 변경·실행/백엔드 연결은 [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md)를 먼저 읽는다. v3 GLB, 검은 이중선, 하단 두 버튼과 실제 챗 API 어댑터가 아래 과거 임시 모델/손잡이/챗봇 준비 기록을 대체한다.

# Seoul Times — 이어지는 서울 지도와 현장 신문

디자인 기준은 [DESIGN.md](DESIGN.md). 한지 크림 헤더 중앙의 `Seoul Times`는 검은 Chomsky 블랙레터다. 한글 UI는 느좋체400/700, 영어 UI·본문은 Abhaya Libre ExtraBold800이며 로컬 파일/라이선스를 포함한다. 모든 DOM UI font-size는9/11/13/15/19/23/29/37pt 토큰이다. 신문 원본 SVG의 조판은 바꾸지 않는다.

화면은5:12다. **스크롤 → 홍길동 등장 → 1초 정면 응시 → 먼저 뛰어내려 사라짐 → 시점이 뒤따름 → 같은 Naver 서울 지도 위 낙하**로 진행한다. BEGIN/내려가기/지도 둘러보기 CTA는 제거했다. 마우스 휠·위로 쓸기·아래 방향키/PageDown/Space로 시작한다. 기존 절차형 모델은 향후 사용자 모델 파일을 받으면 `src/arrival/hongGilDong.js` 경계에서 교체한다.

개발 모드는 사진·GPS 권한 없이 가상 위치를 준비한다. 실제 GPS는 하단 장소 목록의 위치 설정에서 전환한다. production은 스크롤 진입 시 실제 위치를 요청하고 거부/실패를 방문 성공으로 바꾸지 않는다. accuracy<=20m의 새로운 watchPosition만 수용하며 추적 멈춤·비활성·화면 이탈 시 clearWatch한다. 정확 사용자 좌표를 로그/URL/저장소에 남기지 않는다.

구름 걷힘3.2초와 **지도 낙하**0.34초는 동시에 시작하고 구름이 남아 있을 때 착지한다. 반동0.58초 → 탑뷰 각도 유지 이즈인 줌아웃1.6초 → 같은 지도 탐색이다. Escape로 일시정지하며 reduced-motion은1초 응시를 유지하고 큰 전환을 생략한다. 새 위치는450ms 보간하고 지도 앵커와 Three의 발 위치를 맞춘다. 카메라 영상 기반 AR은 아니다.

지도는 드래그/핀치/휠·방향키와+/-로 조작한다. 서대문·종로·마포·은평 실제 다각형 안으로 카메라 중심을 제한하며 네 구 경계/이름과 주변이 보이는34% 회색 음영을 표시한다. 하단 손잡이를 올리면58곳 목록이 열리고 위치 설정·개발 도구가 있다. 좌우 지도 버튼은 없다. 원본58 sourceId/40좌표/누락18을 보존하고 사용자 민트 PNG 핀을 쓴다. 선택은 아바타의 실제 위치를 바꾸지 않는다.

**20m 밖 핀 클릭은 작은 떠 있는 카드와 접근 안내**이며 목록이 자동으로 올라오지 않는다. 실제 GPS 거리<=20m, accuracy<=20m, 새 관측(클라이언트 UX 기본30초)에서 명시적으로 선택하면 신문이 열린다. 신문은 하단2/3 높이, 같은 지도 셰이드·그림자, 내부 스피커/언어/닫기와 아래 챗봇 준비 버튼을 제공한다. 반경 이탈·오래된 위치 등은 열람을 닫고 음성을 취소한다. 정적 파일 URL 접근 통제나 실제 Spring 방문 인증을 완료한 것은 아니다.

신문58곳/ko·en116SVG는 원본 그대로다. navigator.language가ko면한국어, 그 외에는영어이며 원본 제목·본문으로 브라우저 TTS를 제공한다. 음성은 명시적으로 재생/정지/다시 읽고, 언어 변경·닫기 시 취소한다. 파일/음성 실패에도 기사 전체를 읽는다. 현재 역사/번역 검토 중 미리보기이며 서버 게시본·챗봇 연결은 후속이다.

```sh
npm ci
npm start
CI=true npm test -- --watchAll=false --runInBand
npm run build
```

개발 실행은 `http://localhost:3000`. 원본 자산을 갱신할 때만 준비 스크립트를 실행한다. `--check`는 읽기 전용 전수 대조다.

```sh
python3 tools/prepare_newspapers.py --source-root /absolute/path/to/mju_hackathon
python3 tools/prepare_newspapers.py --source-root /absolute/path/to/mju_hackathon --check
```

SVG116개는 내장 이미지/폰트 때문에784,716,866bytes(약785MB)다. ZIP/미리보기/중간 제작물은 포함하지 않는다. 초기에 전부 로딩하지 않고 열람 허용 후 선택 언어 한 파일만 읽는다. 배포/파일 저장소는 별도 결정이 필요하다.

공개 Maps ID/발행 Style ID는 ignore된 `.env.local`의 `REACT_APP_NAVER_MAP_CLIENT_ID`/`REACT_APP_NAVER_MAP_STYLE_ID`로 주입한다. 비밀키는 프론트에 넣지 않는다. 발행한 `seoul times - history pins` GL 스타일은 기본 장소 이름·아이콘·지하철 표시를 숨기고 건물·도로·하천·녹지를 유지한다. 현재 건물은 평면이며 실제 높이로 솟는 건물은 구현하지 않았다.

개발 도구의 **방문 판정 시뮬레이션**은 거리/정확도/오류/ko·en을 별도 메모리 값으로 확인하며 실제 GPS·아바타를 바꾸지 않는다. 기존 가상 신문 시연은 mock 회귀 확인용으로 별도 유지한다. 현장 GPS·물리 휴대폰 터치·실제 음성 청취·Spring/LLM 연동은 미검증이다. 새 패키지 의존성은 없다.

실제 변경/검증/다음 의존성은 루트 `handoff/frontend/HANDOFF.md`, `SCROLL_ARRIVAL.md`, `NEWSPAPER_VISIT_TTS.md`, `HEADER_STYLE.md`, `MAP_AREA.md`, `MAP_STYLE.md`, `PIN_STYLE.md`를 따른다.
