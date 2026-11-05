-- 한국관광공사 무장애 여행정보(KorWithService2) 수집 결과
-- 수집은 서버 실행 중이 아니라 별도 명령(--kto.sync=...)으로 한 번 한다. 하루 호출 한도(개발계정 1,000건) 때문.

CREATE TABLE kto_place (
    content_id       VARCHAR(20)     NOT NULL,
    content_type_id  VARCHAR(5)      NULL COMMENT '12 관광지, 14 문화시설, 39 음식점 등',
    title            VARCHAR(200)    NOT NULL,
    addr1            VARCHAR(255)    NULL,
    addr2            VARCHAR(255)    NULL,
    latitude         DECIMAL(10, 8)  NULL COMMENT 'mapy',
    longitude        DECIMAL(11, 8)  NULL COMMENT 'mapx',
    tel              VARCHAR(100)    NULL,
    l_dong_signgu_cd VARCHAR(10)     NULL,
    raw              JSON            NOT NULL COMMENT '목록 API 응답 원본 item',
    fetched_at       DATETIME(6)     NOT NULL,
    PRIMARY KEY (content_id),
    KEY idx_kto_place_signgu (l_dong_signgu_cd)
) COMMENT '관광공사 무장애 관광정보 목록 (서북권 4개 구)';

CREATE TABLE kto_barrier_free (
    content_id  VARCHAR(20)  NOT NULL,
    raw         JSON         NULL COMMENT 'detailWithTour2 응답 원본 item. 데이터가 없으면 NULL',
    fetched_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (content_id)
) COMMENT '관광공사 무장애 상세 원본';

-- 장소 ↔ 관광공사 콘텐츠 연결 방식
ALTER TABLE spot
    ADD COLUMN kto_match_status VARCHAR(10) NULL COMMENT 'MANUAL(팀 입력) | AUTO(이름·위치 자동 일치)' AFTER kto_content_id;
UPDATE spot SET kto_match_status = 'MANUAL' WHERE kto_content_id IS NOT NULL;

-- 좌표가 비어 있던 장소를 관광공사 좌표로 채운 경우를 구분
ALTER TABLE spot DROP CHECK ck_spot_coord_status;
ALTER TABLE spot ADD CONSTRAINT ck_spot_coord_status
    CHECK (coord_status IN ('VERIFIED', 'PROVIDED', 'APPROX', 'AREA', 'KTO', 'MISSING'));

-- 관광공사 항목에 맞춰 접근성 항목 추가
INSERT INTO accessibility_feature (code, name, sort_order) VALUES
    ('ENTRANCE',  '출입구 단차 없음', 12),
    ('GUIDE_DOG', '보조견 동반',      13);

INSERT INTO user_type_requirement (user_type_code, feature_code, required) VALUES
    ('WHEELCHAIR', 'ENTRANCE',  FALSE),
    ('STROLLER',   'ENTRANCE',  FALSE),
    ('VISUAL',     'GUIDE_DOG', FALSE);
