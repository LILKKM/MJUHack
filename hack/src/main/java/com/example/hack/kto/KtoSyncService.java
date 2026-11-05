package com.example.hack.kto;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.hack.kto.BarrierFreeNormalizer.Item;
import com.example.hack.kto.SpotMatcher.Candidate;
import com.example.hack.kto.SpotMatcher.Place;
import com.example.hack.kto.SpotMatcher.Result;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 관광공사 무장애 정보 수집 단계.
 * <ol>
 *   <li>{@link #syncPlaces()} 4개 구 무장애 관광정보 목록 → kto_place</li>
 *   <li>{@link #matchSpots()} 우리 장소와 관광공사 콘텐츠 자동 연결 (확실한 것만)</li>
 *   <li>{@link #fetchBarrierFree(boolean)} 연결된 콘텐츠의 무장애 상세 원본 → kto_barrier_free</li>
 *   <li>{@link #applyBarrierFree()} 원본을 접근성 상태로 바꿔 spot_accessibility 에 반영 (API 호출 없음)</li>
 * </ol>
 */
@Service
public class KtoSyncService {

    private static final Logger log = LoggerFactory.getLogger(KtoSyncService.class);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final int PAGE_SIZE = 100;

    private final KtoClient client;
    private final KtoProperties props;
    private final JdbcClient jdbc;
    private final JsonMapper json;

    public KtoSyncService(KtoClient client, KtoProperties props, JdbcClient jdbc, JsonMapper json) {
        this.client = client;
        this.props = props;
        this.jdbc = jdbc;
        this.json = json;
    }

    public record MatchReport(String spotId, String spotName, String ktoContentId, String ktoTitle,
            boolean coordsFilled, List<Candidate> candidates) {
    }

    // ---- 1. 목록 ------------------------------------------------------------------------------------

    @Transactional
    public int syncPlaces() {
        int saved = 0;
        for (Map.Entry<String, String> e : props.signguDistricts().entrySet()) {
            String signgu = e.getKey();
            int page = 1;
            int fetched = 0;
            while (true) {
                KtoClient.Page p = client.areaBasedList(props.lDongRegnCd(), signgu, page, PAGE_SIZE);
                for (JsonNode item : p.items()) {
                    upsertPlace(item, signgu);
                    saved++;
                }
                fetched += p.items().size();
                if (p.items().isEmpty() || fetched >= p.totalCount()) {
                    break;
                }
                page++;
            }
            log.info("[kto] 목록 {}({}): {}건", e.getValue(), signgu, fetched);
        }
        return saved;
    }

    private void upsertPlace(JsonNode item, String signgu) {
        String contentId = text(item, "contentid");
        if (contentId == null) {
            return;
        }
        jdbc.sql("""
                INSERT INTO kto_place (content_id, content_type_id, title, addr1, addr2, latitude, longitude, tel,
                                       l_dong_signgu_cd, raw, fetched_at)
                VALUES (:id, :type, :title, :addr1, :addr2, :lat, :lng, :tel, :signgu, :raw, :now)
                ON DUPLICATE KEY UPDATE content_type_id = VALUES(content_type_id), title = VALUES(title),
                    addr1 = VALUES(addr1), addr2 = VALUES(addr2), latitude = VALUES(latitude),
                    longitude = VALUES(longitude), tel = VALUES(tel), l_dong_signgu_cd = VALUES(l_dong_signgu_cd),
                    raw = VALUES(raw), fetched_at = VALUES(fetched_at)
                """)
                .param("id", contentId)
                .param("type", text(item, "contenttypeid"))
                .param("title", Optional.ofNullable(text(item, "title")).orElse(contentId))
                .param("addr1", text(item, "addr1"))
                .param("addr2", text(item, "addr2"))
                .param("lat", decimal(item, "mapy"))
                .param("lng", decimal(item, "mapx"))
                .param("tel", text(item, "tel"))
                .param("signgu", Optional.ofNullable(text(item, "lDongSignguCd")).orElse(signgu))
                .param("raw", json.writeValueAsString(item))
                .param("now", now())
                .update();
    }

    // ---- 2. 장소 연결 ----------------------------------------------------------------------------------

    @Transactional
    public List<MatchReport> matchSpots() {
        Map<String, String> signguToDistrict = props.signguDistricts();
        List<Place> ktoPlaces = jdbc.sql(
                        "SELECT content_id, title, l_dong_signgu_cd, latitude, longitude, content_type_id FROM kto_place")
                .query((rs, i) -> new Place(rs.getString("content_id"), rs.getString("title"),
                        signguToDistrict.get(rs.getString("l_dong_signgu_cd")),
                        toDouble(rs.getBigDecimal("latitude")), toDouble(rs.getBigDecimal("longitude")),
                        rs.getString("content_type_id")))
                .list();
        if (ktoPlaces.isEmpty()) {
            log.warn("[kto] kto_place 가 비어 있습니다. 먼저 places 단계를 실행하세요.");
            return List.of();
        }
        List<Place> spots = jdbc.sql("""
                SELECT id, name, district_id, latitude, longitude FROM spot WHERE kto_content_id IS NULL ORDER BY id
                """)
                .query((rs, i) -> new Place(rs.getString("id"), rs.getString("name"), rs.getString("district_id"),
                        toDouble(rs.getBigDecimal("latitude")), toDouble(rs.getBigDecimal("longitude"))))
                .list();

        java.util.Set<String> taken = new java.util.HashSet<>(jdbc.sql(
                "SELECT kto_content_id FROM spot WHERE kto_content_id IS NOT NULL").query(String.class).list());
        Map<String, Result> raw = new java.util.LinkedHashMap<>();
        spots.forEach(s -> raw.put(s.id(), SpotMatcher.match(s, ktoPlaces)));
        Map<String, Result> results = SpotMatcher.resolveConflicts(raw, taken);

        List<MatchReport> reports = new ArrayList<>();
        for (Place spot : spots) {
            Result r = results.get(spot.id());
            if (r.match() != null) {
                Place k = r.match().kto();
                boolean fillCoords = !spot.hasCoords() && k.hasCoords();
                jdbc.sql("UPDATE spot SET kto_content_id = ?, kto_match_status = 'AUTO' WHERE id = ?")
                        .params(k.id(), spot.id()).update();
                if (fillCoords) {
                    jdbc.sql("UPDATE spot SET latitude = ?, longitude = ?, coord_status = 'KTO' WHERE id = ?")
                            .params(k.lat(), k.lng(), spot.id()).update();
                }
                reports.add(new MatchReport(spot.id(), spot.name(), k.id(), k.name(), fillCoords, List.of()));
                log.info("[kto] 연결 {} {} → {} {}{}", spot.id(), spot.name(), k.id(), k.name(),
                        fillCoords ? " (좌표 채움)" : "");
            } else {
                reports.add(new MatchReport(spot.id(), spot.name(), null, null, false, r.candidates()));
                if (!r.candidates().isEmpty()) {
                    log.info("[kto] 확인 필요 {} {} 후보: {}", spot.id(), spot.name(), r.candidates().stream()
                            .map(c -> c.kto().id() + " " + c.kto().name() + " (" + c.kind()
                                    + (c.distanceKm() == null ? "" : String.format(", %.2fkm", c.distanceKm())) + ")")
                            .toList());
                }
            }
        }
        long linked = reports.stream().filter(m -> m.ktoContentId() != null).count();
        long review = reports.stream().filter(m -> m.ktoContentId() == null && !m.candidates().isEmpty()).count();
        log.info("[kto] 자동 연결 {}곳, 확인 필요 {}곳, 후보 없음 {}곳", linked, review, reports.size() - linked - review);
        return reports;
    }

    // ---- 3. 무장애 상세 원본 ------------------------------------------------------------------------------

    /** @param refresh true 면 이미 받은 콘텐츠도 다시 받는다 (호출 수 주의) */
    public int fetchBarrierFree(boolean refresh) {
        List<String> ids = jdbc.sql("""
                SELECT DISTINCT s.kto_content_id FROM spot s
                WHERE s.kto_content_id IS NOT NULL
                """ + (refresh ? "" : " AND s.kto_content_id NOT IN (SELECT content_id FROM kto_barrier_free)")
                + " ORDER BY s.kto_content_id")
                .query(String.class).list();
        int withData = 0;
        for (String id : ids) {
            Optional<JsonNode> detail = client.detailWithTour(id);
            jdbc.sql("""
                    INSERT INTO kto_barrier_free (content_id, raw, fetched_at) VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE raw = VALUES(raw), fetched_at = VALUES(fetched_at)
                    """)
                    .params(id, detail.map(json::writeValueAsString).orElse(null), now())
                    .update();
            if (detail.isPresent()) {
                withData++;
            }
        }
        log.info("[kto] 무장애 상세 {}건 조회, 데이터 있음 {}건", ids.size(), withData);
        return ids.size();
    }

    // ---- 4. 접근성 반영 -----------------------------------------------------------------------------------

    /**
     * kto_barrier_free 원본을 spot_accessibility 로 옮긴다.
     * 팀·현장 확인 값(provider≠KTO)은 덮어쓰지 않고, 상세가 없는 장소의 기존 값은 지우지 않는다.
     */
    @Transactional
    public int applyBarrierFree() {
        record Row(String spotId, String contentId, String raw, Timestamp fetchedAt) {
        }
        List<Row> rows = jdbc.sql("""
                SELECT s.id, b.content_id, b.raw, b.fetched_at
                FROM spot s JOIN kto_barrier_free b ON b.content_id = s.kto_content_id
                """)
                .query((rs, i) -> new Row(rs.getString("id"), rs.getString("content_id"), rs.getString("raw"),
                        rs.getTimestamp("fetched_at")))
                .list();
        int inserted = 0;
        for (Row r : rows) {
            // 관광공사에 상세가 없으면 기존 값(엑셀 메모에서 옮긴 V5 행 등)을 그대로 둔다
            if (r.raw() == null) {
                continue;
            }
            jdbc.sql("DELETE FROM spot_accessibility WHERE spot_id = ? AND provider = 'KTO'").param(r.spotId()).update();
            LocalDate checked = r.fetchedAt().toLocalDateTime().toLocalDate();
            for (Item item : BarrierFreeNormalizer.normalize(json.readTree(r.raw()))) {
                inserted += jdbc.sql("""
                        INSERT IGNORE INTO spot_accessibility
                            (spot_id, feature_code, status, raw_text, provider, source_url, checked_at)
                        VALUES (?, ?, ?, ?, 'KTO', ?, ?)
                        """)
                        .params(r.spotId(), item.featureCode(), item.status(), item.rawText(),
                                "https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=" + r.contentId(), checked)
                        .update();
            }
        }
        log.info("[kto] 접근성 반영: 장소 {}곳, {}행", rows.size(), inserted);
        return inserted;
    }

    // ---- helpers --------------------------------------------------------------------------------------

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        String s = v.asString("").trim();
        return s.isEmpty() ? null : s;
    }

    private static BigDecimal decimal(JsonNode n, String field) {
        String s = text(n, field);
        if (s == null) {
            return null;
        }
        try {
            BigDecimal d = new BigDecimal(s);
            return d.signum() == 0 ? null : d;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Double toDouble(BigDecimal d) {
        return d == null ? null : d.doubleValue();
    }

    private static Timestamp now() {
        return Timestamp.valueOf(LocalDateTime.now(SEOUL));
    }
}
