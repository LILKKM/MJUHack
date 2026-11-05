package com.example.hack.session;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.hack.common.ApiException;
import com.example.hack.reference.ReferenceRepository;
import com.example.hack.session.SessionDtos.SessionRequest;
import com.example.hack.session.SessionDtos.SessionResponse;
import com.example.hack.spot.SpotRepository;

/**
 * Anonymous chatbot session state. Sessions expire {@link #TTL} after the last change and are then deleted
 * together with their messages and courses. Exact user coordinates are never stored here.
 */
@Service
public class SessionService {

    static final Duration TTL = Duration.ofHours(24);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Logger log = LoggerFactory.getLogger(SessionService.class);

    private final JdbcClient jdbc;
    private final ReferenceRepository reference;
    private final SpotRepository spots;

    public SessionService(JdbcClient jdbc, ReferenceRepository reference, SpotRepository spots) {
        this.jdbc = jdbc;
        this.reference = reference;
        this.spots = spots;
    }

    @Transactional
    public SessionResponse create(SessionRequest req) {
        String id = UUID.randomUUID().toString();
        jdbc.sql("INSERT INTO chat_session (id, expires_at) VALUES (?, ?)")
                .params(id, Timestamp.valueOf(LocalDateTime.now(SEOUL).plus(TTL)))
                .update();
        if (req != null) {
            apply(id, req);
        }
        return get(id);
    }

    @Transactional
    public SessionResponse update(String id, SessionRequest req) {
        requireActive(id);
        if (req != null) {
            apply(id, req);
        }
        touch(id);
        return get(id);
    }

    public SessionResponse get(String id) {
        requireActive(id);
        List<String> types = jdbc.sql("""
                SELECT st.user_type_code FROM chat_session_user_type st WHERE st.session_id = ?
                ORDER BY FIELD(st.user_type_code, 'WHEELCHAIR', 'ELDERLY', 'STROLLER', 'VISUAL', 'HEARING')
                """).param(id).query(String.class).list();
        return jdbc.sql("SELECT * FROM chat_session WHERE id = ?").param(id)
                .query((rs, i) -> new SessionResponse(
                        rs.getString("id"), types, rs.getString("era_id"),
                        (Long) rs.getObject("k_content_id", Long.class), rs.getString("start_spot_id"),
                        rs.getString("start_label"), (Integer) rs.getObject("time_budget_min", Integer.class),
                        (Long) rs.getObject("current_course_id", Long.class),
                        rs.getTimestamp("expires_at").toLocalDateTime().atZone(SEOUL).toOffsetDateTime()))
                .single();
    }

    /** Throws 404 if the session does not exist and 410 if it has expired. */
    public void requireActive(String id) {
        Timestamp expires = jdbc.sql("SELECT expires_at FROM chat_session WHERE id = ?").param(id)
                .query(Timestamp.class).optional()
                .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND", "세션을 찾을 수 없습니다: " + id));
        if (expires.toLocalDateTime().isBefore(LocalDateTime.now(SEOUL))) {
            throw new ApiException(HttpStatus.GONE, "SESSION_EXPIRED", "만료된 세션입니다. 새 세션을 만들어 주세요.");
        }
    }

    /** Points the session at its newest course and extends its lifetime. */
    public void setCurrentCourse(String id, long courseId) {
        jdbc.sql("UPDATE chat_session SET current_course_id = ? WHERE id = ?").params(courseId, id).update();
        touch(id);
    }

    @Scheduled(fixedDelay = 60 * 60 * 1000, initialDelay = 60 * 1000)
    public void deleteExpired() {
        int deleted = jdbc.sql("DELETE FROM chat_session WHERE expires_at < ?")
                .param(Timestamp.valueOf(LocalDateTime.now(SEOUL))).update();
        if (deleted > 0) {
            log.info("Deleted {} expired chat sessions", deleted);
        }
    }

    private void touch(String id) {
        jdbc.sql("UPDATE chat_session SET expires_at = ? WHERE id = ?")
                .params(Timestamp.valueOf(LocalDateTime.now(SEOUL).plus(TTL)), id).update();
    }

    private void apply(String id, SessionRequest req) {
        if (req.userTypes() != null) {
            List<String> types = new ArrayList<>(new LinkedHashSet<>(req.userTypes()));
            List<String> known = reference.findExistingUserTypeCodes(types);
            if (known.size() != types.size()) {
                throw ApiException.badRequest("알 수 없는 userTypes 값이 있습니다: " + types);
            }
            jdbc.sql("DELETE FROM chat_session_user_type WHERE session_id = ?").param(id).update();
            for (String t : types) {
                jdbc.sql("INSERT INTO chat_session_user_type (session_id, user_type_code) VALUES (?, ?)")
                        .params(id, t).update();
            }
        }
        String eraId = req.eraId();
        if (req.kContentId() != null) {
            List<String> eras = reference.findEraIdsOfKContent(req.kContentId())
                    .orElseThrow(() -> ApiException.badRequest("알 수 없는 kContentId: " + req.kContentId()));
            jdbc.sql("UPDATE chat_session SET k_content_id = ? WHERE id = ?").params(req.kContentId(), id).update();
            if (eraId == null && eras.size() == 1) {
                eraId = eras.get(0);
            }
        }
        if (eraId != null) {
            if (!reference.eraExists(eraId)) {
                throw ApiException.badRequest("알 수 없는 eraId: " + eraId);
            }
            jdbc.sql("UPDATE chat_session SET era_id = ? WHERE id = ?").params(eraId, id).update();
        }
        if (req.startSpotId() != null) {
            if (!spots.exists(req.startSpotId())) {
                throw ApiException.badRequest("알 수 없는 startSpotId: " + req.startSpotId());
            }
            jdbc.sql("UPDATE chat_session SET start_spot_id = ? WHERE id = ?").params(req.startSpotId(), id).update();
        }
        if (req.startLabel() != null) {
            jdbc.sql("UPDATE chat_session SET start_label = ? WHERE id = ?").params(req.startLabel(), id).update();
        }
        if (req.timeBudgetMin() != null) {
            if (req.timeBudgetMin() <= 0 || req.timeBudgetMin() > 24 * 60) {
                throw ApiException.badRequest("timeBudgetMin 은 1~1440 사이여야 합니다.");
            }
            jdbc.sql("UPDATE chat_session SET time_budget_min = ? WHERE id = ?").params(req.timeBudgetMin(), id).update();
        }
    }
}
