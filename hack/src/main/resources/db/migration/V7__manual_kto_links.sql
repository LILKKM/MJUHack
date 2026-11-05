-- 자동 연결이 애매했던 장소를 사람이 확인해 관광공사 콘텐츠에 연결한다.
-- (2026-11-06 --kto.sync=match 결과의 '확인 필요' 목록 기준)
-- 연결 후 무장애 상세는 --kto.sync=barrier-free,apply 로 받는다.

-- 창덕궁: 관광공사에 '창덕궁 인정문'·'창덕궁 낙선재'·'창덕궁과 후원'이 따로 있어 자동 연결되지 않음.
-- 궁 전체에 해당하는 '창덕궁과 후원 [유네스코 세계유산]'으로 연결.
UPDATE spot SET kto_content_id = '127642', kto_match_status = 'MANUAL'
WHERE id = 'JNG23' AND kto_content_id IS NULL;
