package com.example.hack.spot;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class SpotDtos {

    private SpotDtos() {
    }

    public record SpotSummary(
            String id, String name, String districtId, String eraId, String category,
            BigDecimal latitude, BigDecimal longitude, String coordStatus, String storyShort,
            List<String> crossLinkIds, boolean hasArticle, String reviewStatus) {
    }

    public record SpotDetail(
            String id, String name, String districtId, String districtName, String eraId,
            String eraDetail, String yearLabel, String category, String address,
            BigDecimal latitude, BigDecimal longitude, String coordStatus,
            String storyShort, String hiddenFact, String ktoContentId, String accessibilityNote,
            List<AccessibilityItem> accessibility, List<Source> sources, List<CrossLinkResponse> crossLinks,
            List<Article> articles, String reviewStatus, String verifyNote) {
    }

    public record AccessibilityItem(
            String featureCode, String featureName, String status, String rawText,
            String provider, String sourceUrl, LocalDate checkedAt) {
    }

    public record Source(String url, String label) {
    }

    public record CrossLinkSpot(String id, String name, String eraId) {
    }

    public record CrossLinkResponse(String id, String title, String eraFlow, String story, List<CrossLinkSpot> spots) {
    }

    public record Article(
            long id, String spotId, String language, String headline, String body, String eventDate,
            String imageUrl, String imageAlt, boolean reconstructed) {
    }
}
