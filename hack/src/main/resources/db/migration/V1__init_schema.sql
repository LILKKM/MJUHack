-- 서북권 역사 배리어프리 여행 서비스 - 초기 스키마
-- 기준: docs/서북권 역사 배리어프리 여행 서비스 기획서, docs/seobuk4_history_pins.xlsx
--
-- 원칙
--  * 작품(k_content)은 시대를 고르는 추천 태그일 뿐, 촬영지 관계를 저장하지 않는다.
--  * 접근성은 항목별 한 행. 근거가 없으면 행이 없거나 UNKNOWN 이다. 빈 값을 '가능/불가'로 단정하지 않는다.
--  * 챗봇 상태는 익명 세션 단위로만 저장하고 expires_at 이후 삭제한다. 정확한 사용자 좌표는 저장하지 않는다.

-- ---------------------------------------------------------------------------
-- 기준 데이터
-- ---------------------------------------------------------------------------

CREATE TABLE era (
    id          VARCHAR(20)  NOT NULL,
    name        VARCHAR(50)  NOT NULL,
    start_year  SMALLINT     NOT NULL,
    end_year    SMALLINT     NULL COMMENT 'NULL = 현재까지',
    sort_order  TINYINT      NOT NULL,
    PRIMARY KEY (id)
) COMMENT '시기 (조선 / 개화기·일제강점기 / 현대)';

CREATE TABLE district (
    id    VARCHAR(5)   NOT NULL COMMENT '장소 ID 접두어 (SDM, MPO, EPY, JNG)',
    name  VARCHAR(20)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_district_name (name)
) COMMENT '서비스 대상 구';

CREATE TABLE k_content (
    id      BIGINT        NOT NULL AUTO_INCREMENT,
    title   VARCHAR(100)  NOT NULL,
    type    VARCHAR(10)   NOT NULL COMMENT 'MOVIE | DRAMA',
    note    VARCHAR(255)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_k_content_title (title),
    CONSTRAINT ck_k_content_type CHECK (type IN ('MOVIE', 'DRAMA'))
) COMMENT 'K-드라마·영화. 시대 추천 태그 용도이며 촬영지 정보가 아님';

CREATE TABLE k_content_era (
    k_content_id  BIGINT       NOT NULL,
    era_id        VARCHAR(20)  NOT NULL,
    PRIMARY KEY (k_content_id, era_id),
    CONSTRAINT fk_kce_content FOREIGN KEY (k_content_id) REFERENCES k_content (id) ON DELETE CASCADE,
    CONSTRAINT fk_kce_era     FOREIGN KEY (era_id)       REFERENCES era (id)
) COMMENT '작품이 다루는 시대';

-- ---------------------------------------------------------------------------
-- 장소
-- ---------------------------------------------------------------------------

CREATE TABLE spot (
    id                  VARCHAR(10)    NOT NULL COMMENT '예: SDM01',
    district_id         VARCHAR(5)     NOT NULL,
    era_id              VARCHAR(20)    NOT NULL COMMENT '코스 필터용 시기 (xlsx period)',
    name                VARCHAR(100)   NOT NULL,
    category            VARCHAR(50)    NULL,
    era_detail          VARCHAR(50)    NULL COMMENT '세부 시대 원문 (xlsx era, 예: 조선 후기)',
    year_label          VARCHAR(50)    NULL COMMENT '연도 원문 (xlsx year, 예: 1598(원비)/1835(재건))',
    address             VARCHAR(255)   NULL,
    latitude            DECIMAL(10, 8) NULL,
    longitude           DECIMAL(11, 8) NULL,
    coord_status        VARCHAR(20)    NOT NULL DEFAULT 'MISSING' COMMENT 'VERIFIED(현장·지도 확인) | PROVIDED(팀 제공 목록) | APPROX(추정) | AREA(권역 대표점) | MISSING',
    story_short         TEXT           NULL COMMENT '한 줄 소개',
    hidden_fact         TEXT           NULL COMMENT '숨은 이야기',
    kto_content_id      VARCHAR(20)    NULL COMMENT '한국관광공사 TourAPI contentId',
    accessibility_note  TEXT           NULL COMMENT '접근성 메모 원문 (전처리 전)',
    verify_note         TEXT           NULL COMMENT '검증 메모',
    review_status       VARCHAR(20)    NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT | NEEDS_SOURCE | REVIEWED',
    created_at          DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_spot_era (era_id),
    KEY idx_spot_district (district_id),
    CONSTRAINT fk_spot_district FOREIGN KEY (district_id) REFERENCES district (id),
    CONSTRAINT fk_spot_era      FOREIGN KEY (era_id)      REFERENCES era (id),
    CONSTRAINT ck_spot_coord_status  CHECK (coord_status IN ('VERIFIED', 'PROVIDED', 'APPROX', 'AREA', 'MISSING')),
    CONSTRAINT ck_spot_review_status CHECK (review_status IN ('DRAFT', 'NEEDS_SOURCE', 'REVIEWED')),
    CONSTRAINT ck_spot_coords CHECK ((latitude IS NULL) = (longitude IS NULL))
) COMMENT '역사 장소 (58곳)';

CREATE TABLE spot_source (
    id          BIGINT        NOT NULL AUTO_INCREMENT,
    spot_id     VARCHAR(10)   NOT NULL,
    sort_order  TINYINT       NOT NULL,
    url         VARCHAR(500)  NULL,
    label       VARCHAR(255)  NULL COMMENT 'URL이 아닌 출처 표기 (예: 엑셀 제공 목록)',
    PRIMARY KEY (id),
    UNIQUE KEY uk_spot_source_order (spot_id, sort_order),
    CONSTRAINT fk_spot_source_spot FOREIGN KEY (spot_id) REFERENCES spot (id) ON DELETE CASCADE,
    CONSTRAINT ck_spot_source_value CHECK (url IS NOT NULL OR label IS NOT NULL)
) COMMENT '장소 출처';

-- ---------------------------------------------------------------------------
-- 시기를 넘는 연결
-- ---------------------------------------------------------------------------

CREATE TABLE cross_link (
    id        VARCHAR(10)   NOT NULL COMMENT '예: X1',
    title     VARCHAR(100)  NOT NULL COMMENT '연결 고리',
    era_flow  VARCHAR(100)  NOT NULL COMMENT '시기 흐름 원문 (예: 조선 → 현대)',
    story     TEXT          NOT NULL COMMENT '겹치는 사건',
    PRIMARY KEY (id)
) COMMENT '같은 땅·사건·인물로 이어진 장소 묶음';

CREATE TABLE cross_link_spot (
    cross_link_id  VARCHAR(10)  NOT NULL,
    spot_id        VARCHAR(10)  NOT NULL,
    sort_order     TINYINT      NOT NULL,
    PRIMARY KEY (cross_link_id, spot_id),
    KEY idx_cls_spot (spot_id),
    CONSTRAINT fk_cls_link FOREIGN KEY (cross_link_id) REFERENCES cross_link (id) ON DELETE CASCADE,
    CONSTRAINT fk_cls_spot FOREIGN KEY (spot_id)       REFERENCES spot (id)       ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- 접근성
-- ---------------------------------------------------------------------------

CREATE TABLE accessibility_feature (
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(50)  NOT NULL,
    sort_order  TINYINT      NOT NULL,
    PRIMARY KEY (code)
) COMMENT '접근성 항목 (휠체어, 엘리베이터, 장애인 화장실 등)';

CREATE TABLE user_type (
    code  VARCHAR(20)  NOT NULL,
    name  VARCHAR(50)  NOT NULL,
    PRIMARY KEY (code)
) COMMENT '이용자 유형';

CREATE TABLE user_type_requirement (
    user_type_code  VARCHAR(20)  NOT NULL,
    feature_code    VARCHAR(30)  NOT NULL,
    required        BOOLEAN      NOT NULL COMMENT 'TRUE = 필수 조건(미충족 시 제외), FALSE = 선호(정렬 가중치)',
    PRIMARY KEY (user_type_code, feature_code),
    CONSTRAINT fk_utr_type    FOREIGN KEY (user_type_code) REFERENCES user_type (code),
    CONSTRAINT fk_utr_feature FOREIGN KEY (feature_code)   REFERENCES accessibility_feature (code)
) COMMENT '이용자 유형별로 확인할 접근성 항목';

CREATE TABLE spot_accessibility (
    spot_id       VARCHAR(10)   NOT NULL,
    feature_code  VARCHAR(30)   NOT NULL,
    status        VARCHAR(15)   NOT NULL COMMENT 'AVAILABLE | PARTIAL | UNAVAILABLE | UNKNOWN',
    raw_text      TEXT          NULL COMMENT '원문 (관광공사 응답 또는 현장 메모)',
    provider      VARCHAR(20)   NOT NULL COMMENT 'KTO | FIELD_CHECK | TEAM',
    source_url    VARCHAR(500)  NULL,
    checked_at    DATE          NULL,
    PRIMARY KEY (spot_id, feature_code),
    CONSTRAINT fk_sa_spot    FOREIGN KEY (spot_id)      REFERENCES spot (id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_feature FOREIGN KEY (feature_code) REFERENCES accessibility_feature (code),
    CONSTRAINT ck_sa_status   CHECK (status IN ('AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'UNKNOWN')),
    CONSTRAINT ck_sa_provider CHECK (provider IN ('KTO', 'FIELD_CHECK', 'TEAM'))
) COMMENT '장소별 접근성 (전처리 결과)';

-- ---------------------------------------------------------------------------
-- 뉴스형 장소 소개
-- ---------------------------------------------------------------------------

CREATE TABLE spot_article (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    spot_id        VARCHAR(10)   NOT NULL,
    language       VARCHAR(5)    NOT NULL DEFAULT 'ko',
    headline       VARCHAR(200)  NOT NULL,
    body           TEXT          NOT NULL,
    event_date     VARCHAR(50)   NULL COMMENT '재구성한 사건의 날짜 표기',
    image_url      VARCHAR(500)  NULL,
    image_alt      VARCHAR(500)  NULL COMMENT '화면 낭독용 대체 텍스트',
    status         VARCHAR(15)   NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT | PUBLISHED',
    created_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_article_spot (spot_id, status),
    CONSTRAINT fk_article_spot FOREIGN KEY (spot_id) REFERENCES spot (id) ON DELETE CASCADE,
    CONSTRAINT ck_article_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ck_article_alt    CHECK (image_url IS NULL OR image_alt IS NOT NULL)
) COMMENT '재구성 기사 + 카툰. 실제 보도가 아님을 화면에 표기';

-- ---------------------------------------------------------------------------
-- 챗봇 세션과 코스 (익명, 만료 후 삭제)
-- ---------------------------------------------------------------------------

CREATE TABLE chat_session (
    id                 CHAR(36)      NOT NULL COMMENT 'UUID',
    era_id             VARCHAR(20)   NULL,
    k_content_id       BIGINT        NULL,
    start_spot_id      VARCHAR(10)   NULL COMMENT '출발지를 장소로 고른 경우',
    start_label        VARCHAR(100)  NULL COMMENT '출발지 표시명 (예: 명지대 정문). 정확한 좌표는 저장하지 않음',
    time_budget_min    SMALLINT      NULL COMMENT '여유 시간(분)',
    current_course_id  BIGINT        NULL,
    created_at         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    expires_at         DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    KEY idx_chat_session_expires (expires_at),
    CONSTRAINT fk_cs_era        FOREIGN KEY (era_id)        REFERENCES era (id),
    CONSTRAINT fk_cs_k_content  FOREIGN KEY (k_content_id)  REFERENCES k_content (id),
    CONSTRAINT fk_cs_start_spot FOREIGN KEY (start_spot_id) REFERENCES spot (id)
) COMMENT '챗봇 세션 상태 (이용자 유형·시대·출발지·현재 코스)';

CREATE TABLE chat_session_user_type (
    session_id      CHAR(36)     NOT NULL,
    user_type_code  VARCHAR(20)  NOT NULL,
    PRIMARY KEY (session_id, user_type_code),
    CONSTRAINT fk_csut_session FOREIGN KEY (session_id)     REFERENCES chat_session (id) ON DELETE CASCADE,
    CONSTRAINT fk_csut_type    FOREIGN KEY (user_type_code) REFERENCES user_type (code)
) COMMENT '세션의 이용자 유형 (복수 가능: 고령자 + 유모차 등)';

CREATE TABLE chat_message (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    session_id  CHAR(36)     NOT NULL,
    role        VARCHAR(10)  NOT NULL COMMENT 'USER | ASSISTANT | TOOL',
    content     TEXT         NOT NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_chat_message_session (session_id, id),
    CONSTRAINT fk_cm_session FOREIGN KEY (session_id) REFERENCES chat_session (id) ON DELETE CASCADE,
    CONSTRAINT ck_cm_role CHECK (role IN ('USER', 'ASSISTANT', 'TOOL'))
);

CREATE TABLE course (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    session_id  CHAR(36)     NOT NULL,
    era_id      VARCHAR(20)  NULL,
    reason      TEXT         NULL COMMENT '코스를 고른 이유',
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_course_session (session_id),
    CONSTRAINT fk_course_session FOREIGN KEY (session_id) REFERENCES chat_session (id) ON DELETE CASCADE,
    CONSTRAINT fk_course_era     FOREIGN KEY (era_id)     REFERENCES era (id)
) COMMENT '생성된 코스 (수정 요청마다 새 버전)';

CREATE TABLE course_stop (
    course_id      BIGINT       NOT NULL,
    stop_order     TINYINT      NOT NULL,
    spot_id        VARCHAR(10)  NOT NULL,
    access_memo    TEXT         NULL COMMENT '장소별 접근성 메모 / 미확인 항목',
    cross_link_id  VARCHAR(10)  NULL COMMENT '다른 시대로 이어지는 연결을 제안한 경우',
    PRIMARY KEY (course_id, stop_order),
    UNIQUE KEY uk_course_stop_spot (course_id, spot_id),
    CONSTRAINT fk_stop_course     FOREIGN KEY (course_id)     REFERENCES course (id) ON DELETE CASCADE,
    CONSTRAINT fk_stop_spot       FOREIGN KEY (spot_id)       REFERENCES spot (id),
    CONSTRAINT fk_stop_cross_link FOREIGN KEY (cross_link_id) REFERENCES cross_link (id)
);

ALTER TABLE chat_session
    ADD CONSTRAINT fk_cs_current_course FOREIGN KEY (current_course_id) REFERENCES course (id) ON DELETE SET NULL;
