package com.example.hack.course;

import java.math.BigDecimal;
import java.util.List;

public final class CourseDtos {

    private CourseDtos() {
    }

    /** Where the course starts. Either a spot ID or coordinates (coordinates are never stored). */
    public record Start(String spotId, String label, Double latitude, Double longitude) {
    }

    public record CourseRequest(
            String sessionId, List<String> userTypes, String eraId, Long kContentId,
            Start start, Integer timeBudgetMin, Integer stopCount) {
    }

    public record StopSpot(String id, String name, String eraId, BigDecimal latitude, BigDecimal longitude) {
    }

    public record Stop(
            int order, StopSpot spot, double distanceFromPrevKm, String accessMemo,
            List<String> unknownFeatures, String crossLinkId) {
    }

    public record Excluded(String spotId, String name, String reason) {
    }

    public record CourseResponse(
            Long id, List<String> eraIds, List<String> userTypes, String startLabel, String reason,
            List<Stop> stops, List<Excluded> excluded, List<String> warnings) {

        CourseResponse withId(long newId) {
            return new CourseResponse(newId, eraIds, userTypes, startLabel, reason, stops, excluded, warnings);
        }
    }
}
