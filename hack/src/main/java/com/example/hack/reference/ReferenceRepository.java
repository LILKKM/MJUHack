package com.example.hack.reference;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.example.hack.reference.ReferenceDtos.EraResponse;
import com.example.hack.reference.ReferenceDtos.KContentResponse;
import com.example.hack.reference.ReferenceDtos.Requirement;
import com.example.hack.reference.ReferenceDtos.UserTypeResponse;

@Repository
public class ReferenceRepository {

    private final JdbcClient jdbc;

    public ReferenceRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<EraResponse> findEras() {
        return jdbc.sql("""
                SELECT e.id, e.name, e.start_year, e.end_year, COUNT(s.id) AS spot_count
                FROM era e LEFT JOIN spot s ON s.era_id = e.id
                GROUP BY e.id, e.name, e.start_year, e.end_year, e.sort_order
                ORDER BY e.sort_order
                """)
                .query((rs, i) -> new EraResponse(
                        rs.getString("id"), rs.getString("name"),
                        rs.getInt("start_year"), (Integer) rs.getObject("end_year", Integer.class),
                        rs.getInt("spot_count")))
                .list();
    }

    public boolean eraExists(String eraId) {
        return jdbc.sql("SELECT COUNT(*) FROM era WHERE id = ?").param(eraId).query(Integer.class).single() > 0;
    }

    public List<KContentResponse> findKContents() {
        Map<Long, KContentResponse> byId = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT k.id, k.title, k.type, ke.era_id
                FROM k_content k LEFT JOIN k_content_era ke ON ke.k_content_id = k.id
                LEFT JOIN era e ON e.id = ke.era_id
                ORDER BY e.sort_order, k.id
                """)
                .query(rs -> {
                    long id = rs.getLong("id");
                    String title = rs.getString("title");
                    String type = rs.getString("type");
                    KContentResponse k = byId.computeIfAbsent(id, key -> new KContentResponse(key, title, type, new ArrayList<>()));
                    String era = rs.getString("era_id");
                    if (era != null) {
                        k.eraIds().add(era);
                    }
                });
        return List.copyOf(byId.values());
    }

    /** Eras a K-content is tagged with; empty if the content does not exist. */
    public Optional<List<String>> findEraIdsOfKContent(long kContentId) {
        int exists = jdbc.sql("SELECT COUNT(*) FROM k_content WHERE id = ?").param(kContentId).query(Integer.class).single();
        if (exists == 0) {
            return Optional.empty();
        }
        return Optional.of(jdbc.sql("SELECT era_id FROM k_content_era WHERE k_content_id = ?")
                .param(kContentId).query(String.class).list());
    }

    public List<UserTypeResponse> findUserTypes() {
        Map<String, UserTypeResponse> byCode = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT u.code, u.name, r.feature_code, f.name AS feature_name, r.required
                FROM user_type u
                LEFT JOIN user_type_requirement r ON r.user_type_code = u.code
                LEFT JOIN accessibility_feature f ON f.code = r.feature_code
                ORDER BY FIELD(u.code, 'WHEELCHAIR', 'ELDERLY', 'STROLLER', 'VISUAL', 'HEARING'), r.required DESC, f.sort_order
                """)
                .query(rs -> {
                    String code = rs.getString("code");
                    String name = rs.getString("name");
                    UserTypeResponse u = byCode.computeIfAbsent(code, c -> new UserTypeResponse(c, name, new ArrayList<>()));
                    String feature = rs.getString("feature_code");
                    if (feature != null) {
                        u.requirements().add(new Requirement(feature, rs.getString("feature_name"), rs.getBoolean("required")));
                    }
                });
        return List.copyOf(byCode.values());
    }

    public List<String> findExistingUserTypeCodes(List<String> codes) {
        if (codes.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("SELECT code FROM user_type WHERE code IN (:codes)").param("codes", codes)
                .query(String.class).list();
    }
}
