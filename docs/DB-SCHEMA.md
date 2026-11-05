# DB 스키마 v0.5

MySQL 8.4 · Flyway 마이그레이션 · 원본 SQL: `hack/src/main/resources/db/migration/`

| 파일 | 내용 |
| --- | --- |
| `V1__init_schema.sql` | 테이블 생성 |
| `V2__seed_reference_data.sql` | 시기 3, 구 4, 작품 5, 접근성 항목 11, 이용자 유형 5와 유형별 확인 항목 |
| `V3__seed_spots.sql` | **자동 생성.** `docs/seobuk4_history_pins.xlsx` → 장소 58, 출처 75, 시기 연결 8(장소 매핑 25) |
| `V4__course_snapshot.sql` | `course.snapshot`(JSON): 코스 응답을 생성 당시 그대로 다시 보여주기 위한 원본 |
| `V5__seed_accessibility_from_notes.sql` | 엑셀 접근성 메모 중 근거가 있는 4행 (안산 봉수대 접근로·주차·유모차, 북한산성 접근로) |
| `V6__kto_barrier_free.sql` | 관광공사 원본 테이블 `kto_place`·`kto_barrier_free`, `spot.kto_match_status`, 좌표 상태 `KTO`, 접근성 항목 `ENTRANCE`(출입구)·`GUIDE_DOG`(보조견) |
| `V7__manual_kto_links.sql` | 자동 연결이 애매했던 장소의 수동 연결 (창덕궁 → `창덕궁과 후원`) |
| `V8__seed_kto_barrier_free.sql` | **자동 생성.** 수집한 관광공사 데이터 (목록 307, 상세 25, 자동 연결 21, 좌표 4, 접근성 116행). 팀원은 키 없이 받는다 |

## 관계도

```
era ─┬─< spot >── district            k_content >─< era   (k_content_era)
     │    │
     │    ├──< spot_source
     │    ├──< spot_accessibility >── accessibility_feature >─< user_type  (user_type_requirement)
     │    ├──< spot_article
     │    ├──< cross_link_spot >── cross_link
     │    └── kto_content_id → kto_place ── kto_barrier_free   (관광공사 원본)
     │
chat_session ──< chat_message
     │  ├──< chat_session_user_type >── user_type
     │  └──< course ──< course_stop >── spot
     └── current_course_id → course
```

## 테이블 요약

| 테이블 | 역할 | 비고 |
| --- | --- | --- |
| `era` | 시기 | `JOSEON`, `OPENING_COLONIAL`, `MODERN` |
| `district` | 구 | 장소 ID 접두어와 같음 (`SDM` …) |
| `k_content`, `k_content_era` | 작품 → 시대 추천 태그 | 촬영지 관계는 저장하지 않음 |
| `spot` | 역사 장소 | xlsx `장소` 시트. `era_id` 는 xlsx `period`, 원문 `era`/`year` 는 `era_detail`/`year_label` |
| `spot_source` | 장소 출처 | xlsx `source_1`, `source_2`. URL이 아니면 `label` |
| `cross_link`, `cross_link_spot` | 시기를 넘는 연결 | xlsx `시기를 넘는 연결` 시트 |
| `accessibility_feature` | 접근성 항목 | 휠체어 접근로, 엘리베이터, 장애인 화장실, 유모차, 점자블록 등 |
| `user_type`, `user_type_requirement` | 이용자 유형별 확인 항목 | `required=TRUE` 는 확인된 '없음'이면 제외. 초기값은 팀 논의로 조정 |
| `spot_accessibility` | 장소 × 항목 접근성 | 상태 `AVAILABLE/PARTIAL/UNAVAILABLE/UNKNOWN` + 원문 + 출처. `provider=KTO` 행은 관광공사 수집으로 채워짐 (아래 절차). 팀·현장 확인 행(`TEAM`, `FIELD_CHECK`)은 수집이 덮어쓰지 않음 |
| `kto_place` | 관광공사 무장애 관광정보 목록 원본 | 4개 구. 목록 API item 을 `raw` 에 그대로 보관 |
| `kto_barrier_free` | 관광공사 무장애 상세 원본 | `raw` 가 NULL 이면 관광공사에 데이터 없음 |
| `spot_article` | 뉴스형 재구성 기사 + 카툰 | 이미지가 있으면 `image_alt` 필수. **아직 비어 있음** |
| `chat_session`, `chat_session_user_type` | 익명 챗봇 세션 상태 | `expires_at` 이후 삭제. 정확한 좌표는 저장하지 않음 |
| `chat_message` | 대화 기록 | `USER/ASSISTANT/TOOL` |
| `course`, `course_stop` | 생성된 코스 | 수정 요청마다 새 코스 행, 세션은 `current_course_id` 로 최신을 가리킴 |

## xlsx 값 변환 규칙

| xlsx | DB |
| --- | --- |
| `period` 조선 / 개화기·일제강점기 / 현대 | `era_id` JOSEON / OPENING_COLONIAL / MODERN |
| `coord_status` approx / user_xlsx / user_xlsx_area / missing | `APPROX` / `PROVIDED` / `AREA` / `MISSING` (좌표가 비면 항상 `MISSING`) |
| `source_1` = `엑셀 제공 목록(사용자)` | `review_status = NEEDS_SOURCE` (17곳), 나머지는 `DRAFT` |
| `dist_from_mju_km` | 저장하지 않음. 좌표로 서버에서 계산 |
| `cross_ids` | 저장하지 않음. `cross_link_spot` 으로 대체 |

## 엑셀이 바뀌었을 때

```powershell
cd hack
powershell -ExecutionPolicy Bypass -File scripts/xlsx-to-seed.ps1
```

이미 V3가 적용된 DB는 Flyway 체크섬이 맞지 않아 기동에 실패한다. 개발 중에는 로컬 DB를 초기화한다.

```bash
docker compose down -v && docker compose up -d
```

공유 DB나 배포 DB가 생긴 뒤에는 V3를 고치지 말고 `V4__...sql` 로 변경분을 추가한다.

## 관광공사 무장애 정보 수집

한국관광공사 「무장애 여행 정보」 OpenAPI (`KorWithService2`)를 **서버 실행 중이 아니라 별도 명령으로 한 번** 받아 DB에 저장한다. 개발계정은 하루 1,000건 제한이 있어서, 한 번 실행에 최대 900건(`kto.max-calls`)까지만 부른다.

### 준비

1. 공공데이터포털에서 「한국관광공사_무장애 여행 정보_GW」 활용신청 → 서비스 키 발급 (TourAPI 국문 키와 별개)
2. **Decoding 키**를 환경변수로 넣는다. 저장소에 커밋하지 않는다.

   ```powershell
   $env:KTO_SERVICE_KEY = "발급받은 Decoding 키"
   ```

### 실행

```bash
cd hack
./gradlew bootRun --args="--spring.main.web-application-type=none --kto.sync=all"
```

`all` 은 아래 네 단계를 순서대로 실행한다. 단계를 골라 쓸 수도 있다 (`--kto.sync=match,apply`).

| 단계 | 하는 일 | API 호출 |
| --- | --- | --- |
| `places` | `areaBasedList2` 로 4개 구(법정동 시군구 110·410·440·380) 무장애 관광정보 목록 → `kto_place` | 구마다 100건당 1회 |
| `match` | 우리 장소와 관광공사 콘텐츠를 이름·거리로 자동 연결. 좌표가 없던 장소는 관광공사 좌표로 채움(`coord_status=KTO`) | 없음 |
| `barrier-free` | 연결된 콘텐츠마다 `detailWithTour2` 무장애 상세 → `kto_barrier_free`. 이미 받은 것은 건너뜀 (`refresh` 를 붙이면 다시 받음) | 콘텐츠당 1회 |
| `apply` | 원본 텍스트를 상태로 바꿔 `spot_accessibility` 에 반영 | 없음 |

규칙을 고친 뒤에는 `--kto.sync=apply` 만 다시 돌리면 API 호출 없이 반영된다.

### 자동 연결 규칙 (`SpotMatcher`)

괄호·공백·구두점을 지운 이름으로 비교하며, 같은 구 안에서만 찾는다.

| 경우 | 자동 연결 조건 |
| --- | --- |
| 이름이 같음 | 둘 다 좌표가 있으면 1km 이내. 좌표가 없으면 이름만으로 연결 |
| 한쪽 이름이 다른 쪽을 포함 (3글자 이상) | 300m 이내. 단, 그 콘텐츠를 다른 장소가 이미 쓰고 있거나 여러 장소가 노리면 연결하지 않음 (예: '진관사 태극기 비' → '진관사') |
| 후보가 둘 이상이거나 조건 밖 | 연결하지 않고 로그에 `확인 필요` 후보로 출력 → 사람이 `spot.kto_content_id` 를 직접 넣고 `kto_match_status='MANUAL'` |

### 텍스트 → 상태 규칙 (`BarrierFreeNormalizer`)

| 관광공사 필드 | 접근성 항목 |
| --- | --- |
| `route` | `ACCESS_ROUTE` |
| `parking` | `PARKING` |
| `wheelchair` | `WHEELCHAIR_RENTAL` |
| `exit` | `ENTRANCE` |
| `elevator` | `ELEVATOR` |
| `restroom` | `ACCESSIBLE_TOILET` |
| `braileblock` | `BRAILLE_BLOCK` |
| `helpdog` | `GUIDE_DOG` |
| `audioguide` | `AUDIO_GUIDE` |
| `signguide`, `videoguide` | `SUBTITLE_GUIDE` (둘 중 좋은 쪽) |
| `stroller` | `STROLLER` |
| `lactationroom` | `NURSING_ROOM` |

판정 순서는 다음과 같다.
1. 조건·일부 표현("일부", "~으나", "~지만", "가능하나", "다소", "협소", "문의", "요청해야", "잠겨", "계단이 있") → 부분(`PARTIAL`)
2. "단차/턱/계단 없음"은 좋은 뜻으로 보고 지운 뒤, 부정과 긍정 표현이 함께 있으면 → 부분(`PARTIAL`)
3. 부정만("없음·불가·미설치·어려움·공사 중·N") → 없음(`UNAVAILABLE`)
4. 긍정만("있음·가능·비치·설치·대여 가능·N면·제공·평탄·쉬움·완만·무단차·Y") → 있음(`AVAILABLE`)
5. 그 밖 → `UNKNOWN` (원문 보존)

규칙은 2026-11-06 실제 수집 원문 114행으로 검증했다. 시설명 뒤에 위치만 적은 문장("장애인 화장실(재궁, 영녕전 앞)")은 있음으로 본다 (`BarrierFreeNormalizerTests.classifiesRealKtoTexts`).

**빈 값은 행을 만들지 않는다** (= 미확인). 기획서 원칙에 따라 "정보 없음"을 "없음"으로 바꾸지 않는다.

실행 로그는 콘솔과 함께 `hack/build/kto-sync.log` 에도 남는다.

### 2026-11-06 첫 수집 결과

- 목록: 종로 178 · 서대문 31 · 마포 56 · 은평 42건 (API 호출 28건)
- 연결: 자동 21곳(종묘 포함) + 수동 4곳. 좌표가 없던 4곳(은평역사한옥박물관, 진관사, 임시정부기념관, 독립관)은 관광공사 좌표로 채움
- 무장애 상세가 있는 곳 22곳 → 접근성 114행 (있음 106 · 부분 7 · 없음 1 · 미확인 0), V5 행 2개를 합쳐 시드에는 116행. `route`(접근로)는 17곳에 있음
- 확인 필요로 남은 곳: 진관사 태극기 비, 연세대 스팀슨관 등(SDM11), 한양도성, 북촌 일대 표석들. 표석·비석류는 관광공사 데이터에 없어 현장 확인이 필요하다
- 종묘·창덕궁은 연결 후 `--kto.sync=barrier-free,apply` 로 상세를 받았다 (호출 2건). 누적 호출 30건

### 수집 데이터 공유

수집 결과는 `V8__seed_kto_barrier_free.sql` 로 저장소에 들어 있어 **팀원은 API 키 없이** `bootRun` 만 하면 같은 데이터를 받는다. 다시 수집했다면 새 버전으로 내보낸다 (적용된 파일은 고치지 않는다).

```bash
bash hack/scripts/export-kto-seed.sh V9
```

출처 표기: 한국관광공사 무장애 여행 정보 OpenAPI (공공데이터포털).
