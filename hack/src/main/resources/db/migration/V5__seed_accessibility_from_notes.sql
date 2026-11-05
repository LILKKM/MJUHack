-- xlsx accessibility_note 중 근거(관광공사 데이터 인용 또는 명확한 지형 설명)가 있는 항목만 옮긴다.
-- 나머지 장소는 관광공사 무장애 API 수집·전처리 후 채운다.

INSERT INTO spot_accessibility (spot_id, feature_code, status, raw_text, provider, source_url, checked_at) VALUES
    ('SDM07', 'ACCESS_ROUTE', 'UNAVAILABLE', '정상부라 휠체어 접근 어려움', 'TEAM', 'https://www.ktriptips.com/kor/tourspot/126531', '2026-11-06'),
    ('SDM07', 'PARKING',      'UNAVAILABLE', '관광공사 데이터: 주차 불가',   'KTO',  'https://www.ktriptips.com/kor/tourspot/126531', '2026-11-06'),
    ('SDM07', 'STROLLER',     'UNAVAILABLE', '관광공사 데이터: 유모차 대여 불가', 'KTO', 'https://www.ktriptips.com/kor/tourspot/126531', '2026-11-06'),
    ('EPY02', 'ACCESS_ROUTE', 'UNAVAILABLE', '산지 — 접근 어려움', 'TEAM', NULL, '2026-11-06');
