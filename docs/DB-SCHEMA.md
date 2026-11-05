# DB 스키마 v0.1

MySQL 8.4 · Flyway 마이그레이션 · 원본 SQL: `hack/src/main/resources/db/migration/`

| 파일 | 내용 |
| --- | --- |
| `V1__init_schema.sql` | 테이블 생성 |
| `V2__seed_reference_data.sql` | 시기 3, 구 4, 작품 5, 접근성 항목 11, 이용자 유형 5와 유형별 확인 항목 |
| `V3__seed_spots.sql` | **자동 생성.** `docs/seobuk4_history_pins.xlsx` → 장소 58, 출처 75, 시기 연결 8(장소 매핑 25) |

## 관계도

```
era ─┬─< spot >── district            k_content >─< era   (k_content_era)
     │    │
     │    ├──< spot_source
     │    ├──< spot_accessibility >── accessibility_feature >─< user_type  (user_type_requirement)
     │    ├──< spot_article
     │    └──< cross_link_spot >── cross_link
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
| `spot_accessibility` | 장소 × 항목 접근성 | 상태 `AVAILABLE/PARTIAL/UNAVAILABLE/UNKNOWN` + 원문 + 출처. **아직 비어 있음** (전처리 필요) |
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
