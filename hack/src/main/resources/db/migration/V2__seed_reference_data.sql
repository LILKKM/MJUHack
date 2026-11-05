-- 기준 데이터: 시기, 구, 작품 태그, 접근성 항목, 이용자 유형

INSERT INTO era (id, name, start_year, end_year, sort_order) VALUES
    ('JOSEON',           '조선',              1392, 1875, 1),
    ('OPENING_COLONIAL', '개화기·일제강점기', 1876, 1945, 2),
    ('MODERN',           '현대',              1945, NULL, 3);

INSERT INTO district (id, name) VALUES
    ('SDM', '서대문구'),
    ('MPO', '마포구'),
    ('EPY', '은평구'),
    ('JNG', '종로구');

-- 작품은 같은 시대·인물을 다룬 추천 태그. 촬영지라는 뜻이 아니며 포스터·장면 이미지는 쓰지 않는다.
INSERT INTO k_content (id, title, type) VALUES
    (1, '왕과 사는 남자', 'MOVIE'),
    (2, '킹덤',           'DRAMA'),
    (3, '미스터 션샤인',  'DRAMA'),
    (4, '암살',           'MOVIE'),
    (5, '1987',           'MOVIE');

INSERT INTO k_content_era (k_content_id, era_id) VALUES
    (1, 'JOSEON'),
    (2, 'JOSEON'),
    (3, 'OPENING_COLONIAL'),
    (4, 'OPENING_COLONIAL'),
    (5, 'MODERN');

INSERT INTO accessibility_feature (code, name, sort_order) VALUES
    ('ACCESS_ROUTE',      '계단·급경사 없는 접근로', 1),
    ('PARKING',           '장애인 주차',             2),
    ('WHEELCHAIR_RENTAL', '휠체어 대여',             3),
    ('ELEVATOR',          '엘리베이터',              4),
    ('ACCESSIBLE_TOILET', '장애인 화장실',           5),
    ('REST_AREA',         '벤치·쉼터',               6),
    ('STROLLER',          '유모차 대여·이동',        7),
    ('NURSING_ROOM',      '수유실',                  8),
    ('BRAILLE_BLOCK',     '점자블록',                9),
    ('AUDIO_GUIDE',       '음성 안내',               10),
    ('SUBTITLE_GUIDE',    '자막·수어 안내',          11);

INSERT INTO user_type (code, name) VALUES
    ('WHEELCHAIR', '휠체어 이용자'),
    ('ELDERLY',    '고령자·보행 약자'),
    ('STROLLER',   '영유아 동반(유모차)'),
    ('VISUAL',     '시각장애인'),
    ('HEARING',    '청각장애인');

-- required = TRUE  : 확인된 '불가'면 코스에서 제외 (미확인은 제외하지 않고 경고로 표시)
-- required = FALSE : 정렬 가중치
-- 초기값이며 팀 논의로 조정한다.
INSERT INTO user_type_requirement (user_type_code, feature_code, required) VALUES
    ('WHEELCHAIR', 'ACCESS_ROUTE',      TRUE),
    ('WHEELCHAIR', 'ELEVATOR',          FALSE),
    ('WHEELCHAIR', 'ACCESSIBLE_TOILET', FALSE),
    ('WHEELCHAIR', 'PARKING',           FALSE),
    ('ELDERLY',    'ACCESS_ROUTE',      FALSE),
    ('ELDERLY',    'REST_AREA',         FALSE),
    ('STROLLER',   'ACCESS_ROUTE',      TRUE),
    ('STROLLER',   'STROLLER',          FALSE),
    ('STROLLER',   'NURSING_ROOM',      FALSE),
    ('VISUAL',     'BRAILLE_BLOCK',     FALSE),
    ('VISUAL',     'AUDIO_GUIDE',       FALSE),
    ('HEARING',    'SUBTITLE_GUIDE',    FALSE);
