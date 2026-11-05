# MJUHack

서북권(서대문·마포·은평·종로) 역사 장소를 K-드라마·영화의 시대로 묶어, 이동이 불편한 사람도 다닐 수 있는 코스를 만들어 주는 여행 서비스.

## 구조

```
MJUHack/
├── Front/               React (Create React App) — 개발 서버 :3000, /api 요청을 :8080 으로 프록시
├── hack/                Spring Boot 4.1 · Java 17 · Gradle — API 서버 :8080
│   ├── src/main/resources/db/migration/   Flyway SQL (스키마 + 시드)
│   └── scripts/xlsx-to-seed.ps1           장소 엑셀 → 시드 SQL 생성
├── docs/                기획·명세 문서
└── docker-compose.yml   개발용 MySQL 8.4 (:3307)
```

## 실행

필요: Java 17, Node.js, Docker Desktop

1. DB 실행 (최초 1회 또는 PC 재시작 후)

   ```bash
   docker compose up -d
   ```

2. 백엔드 실행. 기동할 때 Flyway가 테이블과 시드 데이터를 자동으로 넣는다.

   ```bash
   cd hack && ./gradlew bootRun
   ```

3. 프론트 실행

   ```bash
   cd Front && npm install && npm start
   ```

`./gradlew build` 의 테스트는 Testcontainers로 임시 MySQL을 띄우므로 Docker가 켜져 있어야 한다.

DB 접속 정보는 기본값이 `localhost:3307 / hack / hack` 이다. 다른 DB를 쓰려면 환경변수 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` 를 설정한다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/API-SPEC.md](docs/API-SPEC.md) | REST API 명세 (구현 상태 표시) |
| [docs/DB-SCHEMA.md](docs/DB-SCHEMA.md) | 테이블 구조, 엑셀 → DB 변환 규칙 |
| [docs/seobuk4_history_pins.xlsx](docs/seobuk4_history_pins.xlsx) | 장소 58곳 · 시기 연결 8개 원본 데이터 |
| [docs/PRD.md](docs/PRD.md) | 제품 요구사항 초안 (이전 버전 기획 포함) |
