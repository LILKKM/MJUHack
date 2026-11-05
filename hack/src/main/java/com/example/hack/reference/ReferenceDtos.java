package com.example.hack.reference;

import java.util.List;

public final class ReferenceDtos {

    private ReferenceDtos() {
    }

    public record EraResponse(String id, String name, int startYear, Integer endYear, int spotCount) {
    }

    public record KContentResponse(long id, String title, String type, List<String> eraIds) {
    }

    public record Requirement(String featureCode, String featureName, boolean required) {
    }

    public record UserTypeResponse(String code, String name, List<Requirement> requirements) {
    }
}
