package com.example.hack.session;

import java.time.OffsetDateTime;
import java.util.List;

public final class SessionDtos {

    private SessionDtos() {
    }

    /** Body for POST (all optional) and PATCH (null = keep current value). */
    public record SessionRequest(
            List<String> userTypes, String eraId, Long kContentId,
            String startSpotId, String startLabel, Integer timeBudgetMin) {
    }

    public record SessionResponse(
            String id, List<String> userTypes, String eraId, Long kContentId,
            String startSpotId, String startLabel, Integer timeBudgetMin,
            Long currentCourseId, OffsetDateTime expiresAt) {
    }
}
