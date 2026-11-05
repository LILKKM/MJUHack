# API 명세서 v0.1

서북권 역사 배리어프리 여행 서비스 · 백엔드(Spring Boot) REST API

- 기준 문서: `서북권 역사 배리어프리 여행 서비스 기획서` (2026-11-06), DB 스키마 `hack/src/main/resources/db/migration/V1__init_schema.sql`
- 상태 표기: ✅ 구현됨 · 🛠 설계만 (아직 구현 전)
- 이 문서는 구현 전 계약 초안이다. 필드를 바꾸면 이 문서와 [DB-SCHEMA.md](DB-SCHEMA.md)를 함께 수정한다.

## 0. 공통 규칙

| 항목 | 규칙 |
| --- | --- |
| Base URL | 개발: `http://localhost:8080` · 프론트 개발 서버는 `/api` 요청을 프록시하므로 `fetch('/api/...')` 로 호출 |
| 형식 | 요청·응답 모두 `application/json; charset=UTF-8` |
| 필드 이름 | camelCase. ID는 DB 값 그대로 (`SDM01`, `JOSEON`, `X3`) |
| 시간 | ISO-8601, Asia/Seoul (`2026-11-06T14:30:00+09:00`) |
| 인증 | 없음. 챗봇은 익명 `sessionId`(UUID)로 구분 |
| 개인정보 | 정확한 사용자 좌표는 거리 계산에만 쓰고 저장하지 않는다. 장애 진단명 등 건강정보는 받지 않는다 |
| 빈 값 | 모르는 값은 `null`. 접근성은 `UNKNOWN` 으로 표시하며 "가능/불가"로 추정하지 않는다 |

### 공통 열거값

| 이름 | 값 |
| --- | --- |
| `eraId` | `JOSEON`(조선 1392~1875) · `OPENING_COLONIAL`(개화기·일제강점기 1876~1945) · `MODERN`(현대 1945~) |
| `districtId` | `SDM`(서대문구) · `MPO`(마포구) · `EPY`(은평구) · `JNG`(종로구) |
| `userType` | `WHEELCHAIR` · `ELDERLY` · `STROLLER` · `VISUAL` · `HEARING` |
| `accessStatus` | `AVAILABLE`(있음) · `PARTIAL`(부분) · `UNAVAILABLE`(없음) · `UNKNOWN`(미확인) |
| `coordStatus` | `VERIFIED` · `PROVIDED` · `APPROX` · `AREA`(권역 대표점) · `MISSING` |
| `reviewStatus` | `DRAFT` · `NEEDS_SOURCE`(출처 보강 필요) · `REVIEWED` |

### 오류 응답

```json
{
  "code": "SPOT_NOT_FOUND",
  "message": "장소를 찾을 수 없습니다: SDM99",
  "timestamp": "2026-11-06T14:30:00+09:00"
}
```

| HTTP | code 예시 | 상황 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | 필수 값 누락, 잘못된 열거값 |
| 404 | `SPOT_NOT_FOUND`, `SESSION_NOT_FOUND`, `COURSE_NOT_FOUND` | 없는 ID |
| 410 | `SESSION_EXPIRED` | 만료된 챗봇 세션 |
| 422 | `NO_CANDIDATES` | 조건을 만족하는 장소가 없음 (조건을 자동으로 완화하지 않음) |
| 502 | `LLM_UNAVAILABLE` | LLM 호출 실패. 이미 만든 코스와 장소 정보는 유지 |

---

## 1. 상태 확인

### ✅ `GET /api/health`

```json
{ "status": "ok" }
```

---

## 2. 기준 데이터

화면의 선택지(시대, 작품, 이용자 유형)를 그리는 데 쓴다. 자주 바뀌지 않으므로 프론트에서 캐시해도 된다.

### 🛠 `GET /api/eras`

```json
[
  { "id": "JOSEON", "name": "조선", "startYear": 1392, "endYear": 1875, "spotCount": 34 },
  { "id": "OPENING_COLONIAL", "name": "개화기·일제강점기", "startYear": 1876, "endYear": 1945, "spotCount": 16 },
  { "id": "MODERN", "name": "현대", "startYear": 1945, "endYear": null, "spotCount": 8 }
]
```

### 🛠 `GET /api/k-contents`

작품은 시대를 고르는 **추천 태그**다. 응답에 촬영지 정보는 없다. 포스터·장면 이미지 URL도 제공하지 않는다.

```json
[
  { "id": 5, "title": "1987", "type": "MOVIE", "eraIds": ["MODERN"] },
  { "id": 3, "title": "미스터 션샤인", "type": "DRAMA", "eraIds": ["OPENING_COLONIAL"] }
]
```

### 🛠 `GET /api/user-types`

이용자 유형과, 그 유형에서 확인하는 접근성 항목.

```json
[
  {
    "code": "WHEELCHAIR",
    "name": "휠체어 이용자",
    "requirements": [
      { "featureCode": "ACCESS_ROUTE", "featureName": "계단·급경사 없는 접근로", "required": true },
      { "featureCode": "ACCESSIBLE_TOILET", "featureName": "장애인 화장실", "required": false }
    ]
  }
]
```

- `required: true`: 확인된 `UNAVAILABLE` 이면 코스 후보에서 제외한다. `UNKNOWN` 은 제외하지 않고 경고를 붙인다.
- `required: false`: 정렬 가중치로만 쓴다.

---

## 3. 장소

### 🛠 `GET /api/spots`

| 쿼리 | 필수 | 설명 |
| --- | --- | --- |
| `eraId` | – | 시대 필터 |
| `kContentId` | – | 작품의 시대로 필터 (`eraId` 와 같이 오면 `eraId` 우선) |
| `districtId` | – | 구 필터 |
| `hasCoords` | – | `true` 면 좌표 있는 장소만 (지도용) |

```json
[
  {
    "id": "SDM10",
    "name": "양호 거사비",
    "districtId": "SDM",
    "eraId": "JOSEON",
    "category": "비석",
    "latitude": 37.5806,
    "longitude": 126.9234,
    "coordStatus": "APPROX",
    "storyShort": "정유재란 때 조선에 온 명나라 장수 양호를 기리는 송덕비…",
    "crossLinkIds": ["X3"],
    "hasArticle": false,
    "reviewStatus": "DRAFT"
  }
]
```

### 🛠 `GET /api/spots/{spotId}`

장소 상세. 출처, 접근성, 시기 연결, 게시된 기사를 함께 준다. 아래 `accessibility` 값은 형식 예시다. 현재 DB에는 접근성 전처리 데이터가 아직 없다.

```json
{
  "id": "SDM07",
  "name": "무악산 동봉수대 터(안산 봉수대)",
  "districtId": "SDM",
  "districtName": "서대문구",
  "eraId": "JOSEON",
  "eraDetail": "조선 전기",
  "yearLabel": "1438 / 1994 복원",
  "category": "유적터",
  "address": "서울 서대문구 봉원동 산1 안산 정상",
  "latitude": 37.5745,
  "longitude": 126.9478,
  "coordStatus": "APPROX",
  "storyShort": "조선시대 횃불과 연기로 급보를 전하던 봉수대…",
  "hiddenFact": "터만 남아 있던 것을 1994년 서울 정도 600년 기념사업으로 복원했다…",
  "ktoContentId": "126531",
  "accessibilityNote": "관광공사 데이터: 주차 불가, 유모차 대여 불가. 정상부라 휠체어 접근 어려움…",
  "accessibility": [
    {
      "featureCode": "ACCESS_ROUTE",
      "featureName": "계단·급경사 없는 접근로",
      "status": "UNAVAILABLE",
      "rawText": "정상부 산길",
      "provider": "TEAM",
      "checkedAt": "2026-11-06"
    }
  ],
  "sources": [
    { "url": "https://www.ktriptips.com/kor/tourspot/126531", "label": null }
  ],
  "crossLinks": [],
  "articles": [],
  "reviewStatus": "DRAFT",
  "verifyNote": "배리어프리 필터 '제외' 시연용 사례로 활용 가능"
}
```

- `accessibility` 에는 근거가 있는 항목만 들어간다. 목록에 없는 항목은 `UNKNOWN` 으로 취급한다.
- `articles[]` 는 `status = PUBLISHED` 인 것만 준다. 형식은 [5절](#5-뉴스형-장소-소개)을 따른다.

---

## 4. 시기를 넘는 연결

### 🛠 `GET /api/cross-links`

| 쿼리 | 설명 |
| --- | --- |
| `spotId` | 이 장소가 포함된 연결만 |

```json
[
  {
    "id": "X3",
    "title": "명지대 캠퍼스, 정유재란과 1991년",
    "eraFlow": "조선 → 현대",
    "story": "정유재란 때 명나라 장수 양호를 기린 비(1598년 처음 세움, 1835년 다시 새김)와 1991년 강경대 열사를 기리는 광장·거리가 같은 캠퍼스에 있다.",
    "spots": [
      { "id": "SDM10", "name": "양호 거사비", "eraId": "JOSEON" },
      { "id": "SDM01", "name": "강경대 민주광장(추모 동판)", "eraId": "MODERN" },
      { "id": "SDM02", "name": "강경대 열사 거리·표지석(사건 현장)", "eraId": "MODERN" }
    ]
  }
]
```

### 🛠 `GET /api/cross-links/{crossLinkId}`

같은 형식으로 하나만 반환한다.

---

## 5. 뉴스형 장소 소개

장소 상세(`GET /api/spots/{spotId}`)의 `articles[]` 로 함께 내려간다. 따로 조회할 때는 아래 API를 쓴다.

### 🛠 `GET /api/spots/{spotId}/articles`

| 쿼리 | 설명 |
| --- | --- |
| `language` | 기본 `ko` |

```json
[
  {
    "id": 12,
    "spotId": "SDM13",
    "language": "ko",
    "headline": "…",
    "body": "…",
    "eventDate": "1987-06-09",
    "imageUrl": "/images/articles/SDM13.png",
    "imageAlt": "연세대 정문 앞 보도에 놓인 동판과 꽃",
    "reconstructed": true
  }
]
```

- `reconstructed` 는 항상 `true` 다. 화면에 "실제 보도가 아닌 재구성 기사" 안내를 표시한다.
- `imageUrl` 이 있으면 `imageAlt` 도 반드시 있다 (DB 제약).

---

## 6. 코스 생성

### 🛠 `POST /api/courses`

챗봇 없이 조건만으로 코스를 만든다. 챗봇 대화 중에도 내부적으로 같은 로직을 쓴다.

요청:

```json
{
  "sessionId": "8f3c2c1e-1f0b-4c55-9a51-0d6b3a3d2e10",
  "userTypes": ["WHEELCHAIR"],
  "eraId": null,
  "kContentId": 5,
  "start": { "spotId": null, "label": "명지대 정문", "latitude": 37.5800, "longitude": 126.9238 },
  "timeBudgetMin": 180,
  "stopCount": 4
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `sessionId` | – | 있으면 이 세션의 현재 코스로 저장. 없으면 저장하지 않고 결과만 반환 |
| `userTypes` | ✔ | 1개 이상. 조건이 없으면 `[]` |
| `eraId` / `kContentId` | 둘 중 하나 ✔ | 작품을 주면 작품의 시대로 바꾼다 |
| `start` | ✔ | `spotId` 또는 좌표. 좌표는 거리 계산에만 쓰고 저장하지 않는다 |
| `timeBudgetMin` | – | 여유 시간 (분) |
| `stopCount` | – | 3~5, 기본 4 |

처리 순서는 기획서를 따른다.
1. 시대로 후보를 거른다.
2. `required` 접근성 항목이 `UNAVAILABLE` 인 장소를 뺀다.
3. 출발지에서 가까운 순서로 묶는다.
4. 방문 순서를 정한다.

좌표가 없는(`MISSING`) 장소는 후보에서 제외한다.

응답 `201 Created`:

```json
{
  "id": 41,
  "eraId": "MODERN",
  "reason": "「1987」의 시대인 현대 장소 중, 명지대에서 가깝고 휠체어 접근로가 확인되었거나 미확인인 곳으로 골랐습니다.",
  "stops": [
    {
      "order": 1,
      "spot": { "id": "SDM02", "name": "강경대 열사 거리·표지석(사건 현장)", "latitude": 37.58, "longitude": 126.9238 },
      "distanceFromPrevKm": 0.1,
      "accessMemo": "보도 위치 — 비교적 평탄할 것으로 보이나 현장 확인 필요",
      "unknownFeatures": ["ACCESS_ROUTE"],
      "crossLinkId": "X3"
    }
  ],
  "excluded": [
    { "spotId": "SDM07", "reason": "ACCESS_ROUTE = UNAVAILABLE" }
  ],
  "warnings": [
    "장소 사이 이동 경로의 접근성은 확인되지 않았습니다. 이동 전 별도로 확인하세요."
  ]
}
```

- `distanceFromPrevKm` 는 직선거리다. 이동 시간이나 길찾기 경로는 주지 않는다.
- `excluded` 는 "왜 빠졌는지"를 보여주는 용도다 (예: 안산 봉수대).
- 후보가 `stopCount` 보다 적으면 있는 만큼만 반환한다. 하나도 없으면 `422 NO_CANDIDATES` 를 반환한다.

### 🛠 `GET /api/courses/{courseId}`

같은 형식으로 저장된 코스를 반환한다.

---

## 7. 챗봇

세션은 익명이며 `expiresAt` (기본: 마지막 활동 후 24시간)이 지나면 삭제한다. 사용자 유형·시대·출발지·현재 코스는 대화 기록과 별도로 세션 상태에 저장한다.

### 🛠 `POST /api/chat/sessions`

요청 (모두 선택):

```json
{
  "userTypes": ["STROLLER", "ELDERLY"],
  "eraId": null,
  "kContentId": 3,
  "startSpotId": null,
  "startLabel": "명지대 정문",
  "timeBudgetMin": 120
}
```

응답 `201 Created`: [세션 상태](#세션-상태-형식)

### 🛠 `GET /api/chat/sessions/{sessionId}`

응답: 세션 상태

### 🛠 `PATCH /api/chat/sessions/{sessionId}`

화면 위 조건 요약에서 사용자가 직접 바꾼 값을 반영한다. 보낸 필드만 바뀐다. 응답은 세션 상태다.

```json
{ "userTypes": ["WHEELCHAIR"], "timeBudgetMin": 90 }
```

### 세션 상태 형식

```json
{
  "id": "8f3c2c1e-1f0b-4c55-9a51-0d6b3a3d2e10",
  "userTypes": ["STROLLER", "ELDERLY"],
  "eraId": "OPENING_COLONIAL",
  "kContentId": 3,
  "startSpotId": null,
  "startLabel": "명지대 정문",
  "timeBudgetMin": 120,
  "currentCourseId": 41,
  "expiresAt": "2026-11-07T14:30:00+09:00"
}
```

### 🛠 `GET /api/chat/sessions/{sessionId}/messages`

```json
[
  { "id": 1, "role": "USER", "content": "두 번째 장소 빼고 다른 데", "createdAt": "2026-11-06T14:31:00+09:00" },
  { "id": 2, "role": "ASSISTANT", "content": "…", "createdAt": "2026-11-06T14:31:04+09:00" }
]
```

`TOOL` 역할의 메시지(서버 내부 도구 호출 기록)는 응답에서 뺀다.

### 🛠 `POST /api/chat/sessions/{sessionId}/messages`

요청:

```json
{
  "content": "근처에 휠체어로 갈 수 있는 곳 하나 더 넣어줘",
  "location": { "latitude": 37.5801, "longitude": 126.9235 }
}
```

`location` 은 선택이며, 이번 요청의 거리 계산에만 쓰고 저장하지 않는다.

응답 `200 OK`:

```json
{
  "message": { "id": 8, "role": "ASSISTANT", "content": "…", "createdAt": "2026-11-06T14:32:10+09:00" },
  "session": { "...": "세션 상태" },
  "course": { "...": "코스 (바뀐 경우에만, 6절 형식)" }
}
```

LLM 사용 원칙:
- LLM은 서버가 넘긴 후보 장소·근거 안에서만 답한다.
- 서버는 응답에 나온 장소 ID가 후보에 있는지 다시 검사한다. 없으면 버린다.
- LLM이 실패하면 `502 LLM_UNAVAILABLE` 을 반환한다. 세션과 현재 코스는 그대로 유지된다.

---

## 8. 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-11-06 | 초안. DB 스키마 V1~V3 기준. `/api/health` 만 구현됨 |
