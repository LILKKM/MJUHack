-- 코스 응답 전체(정렬·제외 사유·경고)를 생성 시점 그대로 다시 보여주기 위한 스냅샷
ALTER TABLE course
    ADD COLUMN snapshot JSON NULL COMMENT 'POST /api/courses 응답 원본';
