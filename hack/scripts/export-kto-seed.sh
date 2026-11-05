#!/usr/bin/env bash
# 로컬 Docker DB에 수집된 관광공사 무장애 데이터를 Flyway 시드 SQL로 내보낸다.
# 팀원이 API 키 없이도 같은 데이터를 받게 하기 위한 것이다.
#
# 사용법 (저장소 어디서든):  bash hack/scripts/export-kto-seed.sh [버전]
#   기본 버전 V8. 이미 적용된 파일은 고치지 말고 새 버전(V9 ...)으로 내보낸다.
#
# 다시 실행해도 안전하다: INSERT IGNORE + 비어 있는 값만 채우는 UPDATE.
set -euo pipefail

VERSION="${1:-V8}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src/main/resources/db/migration/${VERSION}__seed_kto_barrier_free.sql"
DB=(docker exec mjuhack-mysql)
AUTH=(-uhack -phack --default-character-set=utf8mb4)

dump() { # table [where]
  local args=(--no-create-info --skip-triggers --compact --complete-insert --insert-ignore
              --no-tablespaces --skip-extended-insert --order-by-primary)
  [ -n "${2:-}" ] && args+=("--where=$2")
  MSYS_NO_PATHCONV=1 "${DB[@]}" mysqldump "${AUTH[@]}" "${args[@]}" hack "$1" 2>/dev/null
}

query() {
  MSYS_NO_PATHCONV=1 "${DB[@]}" mysql "${AUTH[@]}" -N -r hack -e "$1" 2>/dev/null
}

{
  echo "-- 자동 생성 파일: scripts/export-kto-seed.sh. 직접 수정하지 말 것."
  echo "-- 출처: 한국관광공사 무장애 여행 정보 OpenAPI (KorWithService2), 공공데이터포털."
  echo "-- 수집일: $(query "SELECT DATE(MAX(fetched_at)) FROM kto_barrier_free")"
  echo
  echo "-- 관광공사 목록 원본"
  dump kto_place
  echo
  echo "-- 무장애 상세 원본"
  dump kto_barrier_free
  echo
  echo "-- 장소 ↔ 관광공사 콘텐츠 연결 (자동 연결 결과)"
  query "SELECT CONCAT('UPDATE spot SET kto_content_id = ''', kto_content_id, ''', kto_match_status = ''AUTO'' WHERE id = ''', id, ''' AND kto_content_id IS NULL;')
         FROM spot WHERE kto_match_status = 'AUTO' ORDER BY id"
  echo
  echo "-- 좌표가 비어 있던 장소를 관광공사 좌표로 채움"
  query "SELECT CONCAT('UPDATE spot SET latitude = ', latitude, ', longitude = ', longitude, ', coord_status = ''KTO'' WHERE id = ''', id, ''' AND latitude IS NULL;')
         FROM spot WHERE coord_status = 'KTO' ORDER BY id"
  echo
  echo "-- 접근성 (관광공사 원문을 판정한 결과)"
  dump spot_accessibility "provider = 'KTO'"
} > "$OUT"

# Windows 줄바꿈 제거
sed -i 's/\r$//' "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
count() { grep -c "$1" "$OUT" || true; }
echo "kto_place: $(count 'INTO `kto_place`')"
echo "kto_barrier_free: $(count 'INTO `kto_barrier_free`')"
echo "spot_accessibility: $(count 'INTO `spot_accessibility`')"
echo "links: $(count '^UPDATE spot SET kto_content_id')"
echo "coords: $(count '^UPDATE spot SET latitude')"
