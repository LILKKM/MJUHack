package com.example.hack.spot;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.example.hack.spot.SpotDtos.AccessibilityItem;
import com.example.hack.spot.SpotDtos.Article;
import com.example.hack.spot.SpotDtos.CrossLinkResponse;
import com.example.hack.spot.SpotDtos.CrossLinkSpot;
import com.example.hack.spot.SpotDtos.Source;
import com.example.hack.spot.SpotDtos.SpotDetail;
import com.example.hack.spot.SpotDtos.SpotSummary;

@Repository
public class SpotRepository {

    /** Minimal spot data used by the course engine. */
    public record SpotRow(String id, String name, String eraId, BigDecimal latitude, BigDecimal longitude,
            String accessibilityNote) {

        public boolean hasCoords() {
            return latitude != null && longitude != null;
        }
    }

    private final JdbcClient jdbc;

    public SpotRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<SpotSummary> search(List<String> eraIds, String districtId, boolean hasCoords) {
        StringBuilder sql = new StringBuilder("""
                SELECT s.id, s.name, s.district_id, s.era_id, s.category, s.latitude, s.longitude, s.coord_status,
                       s.story_short, s.review_status,
                       EXISTS (SELECT 1 FROM spot_article a WHERE a.spot_id = s.id AND a.status = 'PUBLISHED') AS has_article
                FROM spot s WHERE 1 = 1
                """);
        Map<String, Object> params = new HashMap<>();
        if (eraIds != null) {
            if (eraIds.isEmpty()) {
                return List.of();
            }
            sql.append(" AND s.era_id IN (:eraIds)");
            params.put("eraIds", eraIds);
        }
        if (districtId != null) {
            sql.append(" AND s.district_id = :districtId");
            params.put("districtId", districtId);
        }
        if (hasCoords) {
            sql.append(" AND s.latitude IS NOT NULL");
        }
        sql.append(" ORDER BY s.id");

        List<SpotSummary> rows = jdbc.sql(sql.toString()).params(params)
                .query((rs, i) -> new SpotSummary(
                        rs.getString("id"), rs.getString("name"), rs.getString("district_id"), rs.getString("era_id"),
                        rs.getString("category"), rs.getBigDecimal("latitude"), rs.getBigDecimal("longitude"),
                        rs.getString("coord_status"), rs.getString("story_short"), new ArrayList<>(),
                        rs.getBoolean("has_article"), rs.getString("review_status")))
                .list();

        Map<String, List<String>> links = crossLinkIdsBySpot(rows.stream().map(SpotSummary::id).toList());
        rows.forEach(r -> r.crossLinkIds().addAll(links.getOrDefault(r.id(), List.of())));
        return rows;
    }

    public Optional<SpotDetail> findDetail(String spotId) {
        Optional<SpotDetail> base = jdbc.sql("""
                SELECT s.*, d.name AS district_name
                FROM spot s JOIN district d ON d.id = s.district_id
                WHERE s.id = ?
                """)
                .param(spotId)
                .query((rs, i) -> new SpotDetail(
                        rs.getString("id"), rs.getString("name"), rs.getString("district_id"),
                        rs.getString("district_name"), rs.getString("era_id"), rs.getString("era_detail"),
                        rs.getString("year_label"), rs.getString("category"), rs.getString("address"),
                        rs.getBigDecimal("latitude"), rs.getBigDecimal("longitude"), rs.getString("coord_status"),
                        rs.getString("story_short"), rs.getString("hidden_fact"), rs.getString("kto_content_id"),
                        rs.getString("accessibility_note"),
                        new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>(),
                        rs.getString("review_status"), rs.getString("verify_note")))
                .optional();
        base.ifPresent(d -> {
            d.accessibility().addAll(accessibilityBySpot(List.of(spotId)).getOrDefault(spotId, List.of()));
            d.sources().addAll(jdbc.sql("SELECT url, label FROM spot_source WHERE spot_id = ? ORDER BY sort_order")
                    .param(spotId).query((rs, i) -> new Source(rs.getString("url"), rs.getString("label"))).list());
            d.crossLinks().addAll(findCrossLinks(spotId));
            d.articles().addAll(findPublishedArticles(spotId, "ko"));
        });
        return base;
    }

    public boolean exists(String spotId) {
        return jdbc.sql("SELECT COUNT(*) FROM spot WHERE id = ?").param(spotId).query(Integer.class).single() > 0;
    }

    public List<Article> findPublishedArticles(String spotId, String language) {
        return jdbc.sql("""
                SELECT id, spot_id, language, headline, body, event_date, image_url, image_alt
                FROM spot_article WHERE spot_id = ? AND language = ? AND status = 'PUBLISHED' ORDER BY id
                """)
                .params(spotId, language)
                .query((rs, i) -> new Article(rs.getLong("id"), rs.getString("spot_id"), rs.getString("language"),
                        rs.getString("headline"), rs.getString("body"), rs.getString("event_date"),
                        rs.getString("image_url"), rs.getString("image_alt"), true))
                .list();
    }

    // ---- cross links ----------------------------------------------------------------------------

    /** All cross links, or only those containing {@code spotId} when it is not null. */
    public List<CrossLinkResponse> findCrossLinks(String spotId) {
        String filter = spotId == null ? "" :
                " WHERE l.id IN (SELECT cross_link_id FROM cross_link_spot WHERE spot_id = :spotId)";
        Map<String, CrossLinkResponse> byId = new LinkedHashMap<>();
        var query = jdbc.sql("""
                SELECT l.id, l.title, l.era_flow, l.story, s.id AS spot_id, s.name AS spot_name, s.era_id
                FROM cross_link l
                JOIN cross_link_spot ls ON ls.cross_link_id = l.id
                JOIN spot s ON s.id = ls.spot_id
                """ + filter + " ORDER BY l.id, ls.sort_order");
        if (spotId != null) {
            query = query.param("spotId", spotId);
        }
        query.query(rs -> {
            String id = rs.getString("id");
            String title = rs.getString("title");
            String flow = rs.getString("era_flow");
            String story = rs.getString("story");
            byId.computeIfAbsent(id, k -> new CrossLinkResponse(k, title, flow, story, new ArrayList<>()))
                    .spots().add(new CrossLinkSpot(rs.getString("spot_id"), rs.getString("spot_name"), rs.getString("era_id")));
        });
        return List.copyOf(byId.values());
    }

    public Optional<CrossLinkResponse> findCrossLink(String crossLinkId) {
        return findCrossLinks(null).stream().filter(l -> l.id().equals(crossLinkId)).findFirst();
    }

    // ---- course engine helpers ------------------------------------------------------------------

    public List<SpotRow> findRowsByEras(Collection<String> eraIds) {
        if (eraIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("""
                SELECT id, name, era_id, latitude, longitude, accessibility_note
                FROM spot WHERE era_id IN (:eraIds) ORDER BY id
                """)
                .param("eraIds", eraIds)
                .query((rs, i) -> new SpotRow(rs.getString("id"), rs.getString("name"), rs.getString("era_id"),
                        rs.getBigDecimal("latitude"), rs.getBigDecimal("longitude"), rs.getString("accessibility_note")))
                .list();
    }

    public Optional<SpotRow> findRow(String spotId) {
        return jdbc.sql("SELECT id, name, era_id, latitude, longitude, accessibility_note FROM spot WHERE id = ?")
                .param(spotId)
                .query((rs, i) -> new SpotRow(rs.getString("id"), rs.getString("name"), rs.getString("era_id"),
                        rs.getBigDecimal("latitude"), rs.getBigDecimal("longitude"), rs.getString("accessibility_note")))
                .optional();
    }

    public Map<String, List<AccessibilityItem>> accessibilityBySpot(Collection<String> spotIds) {
        Map<String, List<AccessibilityItem>> result = new HashMap<>();
        if (spotIds.isEmpty()) {
            return result;
        }
        jdbc.sql("""
                SELECT a.spot_id, a.feature_code, f.name AS feature_name, a.status, a.raw_text, a.provider,
                       a.source_url, a.checked_at
                FROM spot_accessibility a JOIN accessibility_feature f ON f.code = a.feature_code
                WHERE a.spot_id IN (:ids) ORDER BY f.sort_order
                """)
                .param("ids", spotIds)
                .query(rs -> {
                    java.sql.Date checked = rs.getDate("checked_at");
                    result.computeIfAbsent(rs.getString("spot_id"), k -> new ArrayList<>()).add(new AccessibilityItem(
                            rs.getString("feature_code"), rs.getString("feature_name"), rs.getString("status"),
                            rs.getString("raw_text"), rs.getString("provider"), rs.getString("source_url"),
                            checked == null ? null : checked.toLocalDate()));
                });
        return result;
    }

    public Map<String, List<String>> crossLinkIdsBySpot(Collection<String> spotIds) {
        Map<String, List<String>> result = new HashMap<>();
        if (spotIds.isEmpty()) {
            return result;
        }
        jdbc.sql("SELECT spot_id, cross_link_id FROM cross_link_spot WHERE spot_id IN (:ids) ORDER BY cross_link_id")
                .param("ids", spotIds)
                .query(rs -> {
                    result.computeIfAbsent(rs.getString("spot_id"), k -> new ArrayList<>()).add(rs.getString("cross_link_id"));
                });
        return result;
    }
}
