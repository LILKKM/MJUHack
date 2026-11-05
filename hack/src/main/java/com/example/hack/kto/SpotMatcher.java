package com.example.hack.kto;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import com.example.hack.common.GeoUtils;

/**
 * 우리 장소(spot)와 관광공사 콘텐츠를 이름·위치로 맞춘다.
 * 확실한 경우(후보가 정확히 하나)만 자동 연결하고, 나머지는 사람이 확인하도록 후보만 돌려준다.
 */
public final class SpotMatcher {

    /** 이름이 같을 때 허용하는 최대 거리 */
    static final double SAME_NAME_MAX_KM = 1.0;
    /** 이름이 서로 포함 관계일 때 허용하는 최대 거리 */
    static final double CONTAINS_MAX_KM = 0.3;
    /** 포함 관계로 볼 최소 글자 수 (예: '서촌' 같은 짧은 이름 오연결 방지) */
    static final int CONTAINS_MIN_LENGTH = 3;

    private SpotMatcher() {
    }

    /** @param contentTypeId 관광공사 콘텐츠 타입 (우리 장소는 null) */
    public record Place(String id, String name, String districtId, Double lat, Double lng, String contentTypeId) {

        public Place(String id, String name, String districtId, Double lat, Double lng) {
            this(id, name, districtId, lat, lng, null);
        }

        boolean hasCoords() {
            return lat != null && lng != null;
        }

        /** 이름이 달라도 '근처 후보'로 보여줄 만한 유형: 관광지(12), 문화시설(14), 레포츠(28). 식당·쇼핑·숙박은 제외 */
        boolean isSightseeing() {
            return contentTypeId == null || Set.of("12", "14", "28").contains(contentTypeId);
        }
    }

    public enum Kind { SAME_NAME, CONTAINS, NEARBY }

    public record Candidate(Place kto, Kind kind, Double distanceKm) {
    }

    /** @param match 자동 연결할 콘텐츠 (확실할 때만), candidates 사람이 확인할 후보 */
    public record Result(Candidate match, List<Candidate> candidates) {
    }

    public static Result match(Place spot, List<Place> ktoPlaces) {
        String spotName = normalize(spot.name());
        List<Candidate> strong = new ArrayList<>();
        List<Candidate> weak = new ArrayList<>();
        for (Place k : ktoPlaces) {
            if (spot.districtId() != null && k.districtId() != null && !spot.districtId().equals(k.districtId())) {
                continue;
            }
            Double d = spot.hasCoords() && k.hasCoords()
                    ? GeoUtils.distanceKm(spot.lat(), spot.lng(), k.lat(), k.lng()) : null;
            String ktoName = normalize(k.name());
            if (ktoName.isEmpty()) {
                continue;
            }
            if (ktoName.equals(spotName)) {
                if (d == null || d <= SAME_NAME_MAX_KM) {
                    strong.add(new Candidate(k, Kind.SAME_NAME, d));
                } else {
                    weak.add(new Candidate(k, Kind.SAME_NAME, d));
                }
            } else if (contains(spotName, ktoName)) {
                if (d != null && d <= CONTAINS_MAX_KM) {
                    strong.add(new Candidate(k, Kind.CONTAINS, d));
                } else {
                    weak.add(new Candidate(k, Kind.CONTAINS, d));
                }
            } else if (d != null && d <= 0.15 && k.isSightseeing()) {
                weak.add(new Candidate(k, Kind.NEARBY, d));
            }
        }
        // 같은 이름이 하나라도 있으면 그것만 본다
        List<Candidate> sameName = strong.stream().filter(c -> c.kind() == Kind.SAME_NAME).toList();
        List<Candidate> decisive = sameName.isEmpty() ? strong : sameName;

        Comparator<Candidate> byDistance = Comparator.comparing(c -> c.distanceKm() == null ? 99 : c.distanceKm());
        if (decisive.size() == 1) {
            return new Result(decisive.get(0), List.of());
        }
        List<Candidate> all = new ArrayList<>(strong);
        all.addAll(weak);
        all.sort(byDistance);
        return new Result(null, all.stream().limit(5).toList());
    }

    /**
     * 같은 관광공사 콘텐츠를 여러 장소가 가져가지 않게 정리한다.
     * 이름 포함(CONTAINS)으로 붙은 연결은, 그 콘텐츠가 이미 다른 장소에 쓰이거나(수동 연결·같은 이름 연결)
     * 다른 장소도 포함 관계로 노리면 자동 연결을 취소하고 후보로 돌린다.
     * 예: '진관사 태극기 비'가 '진관사' 콘텐츠를 가져가지 않도록.
     *
     * @param results  spotId → 매칭 결과
     * @param taken    이미 장소에 연결된 콘텐츠 ID (수동 연결)
     */
    public static java.util.Map<String, Result> resolveConflicts(java.util.Map<String, Result> results,
            java.util.Set<String> taken) {
        java.util.Set<String> used = new java.util.HashSet<>(taken);
        java.util.Map<String, Integer> containsCount = new java.util.HashMap<>();
        results.values().forEach(r -> {
            if (r.match() != null && r.match().kind() == Kind.SAME_NAME) {
                used.add(r.match().kto().id());
            } else if (r.match() != null) {
                containsCount.merge(r.match().kto().id(), 1, Integer::sum);
            }
        });
        java.util.Map<String, Result> out = new java.util.LinkedHashMap<>();
        results.forEach((spotId, r) -> {
            if (r.match() != null && r.match().kind() != Kind.SAME_NAME) {
                String id = r.match().kto().id();
                if (used.contains(id) || containsCount.get(id) > 1) {
                    List<Candidate> c = new ArrayList<>(r.candidates());
                    c.add(0, r.match());
                    out.put(spotId, new Result(null, c));
                    return;
                }
            }
            out.put(spotId, r);
        });
        return out;
    }

    /**
     * 괄호·대괄호 안 설명, 공백, 구두점을 지운다.
     * 예: "독립문·영은문 주초" → "독립문영은문주초", "종묘 [유네스코 세계유산]" → "종묘"
     */
    static String normalize(String name) {
        if (name == null) {
            return "";
        }
        return name.replaceAll("\\([^)]*\\)", "")
                .replaceAll("\\[[^\\]]*\\]", "")
                .replaceAll("[\\s·ㆍ,./\\-_'\"「」]", "")
                .toLowerCase();
    }

    private static boolean contains(String a, String b) {
        String shorter = a.length() <= b.length() ? a : b;
        String longer = Objects.equals(shorter, a) ? b : a;
        return shorter.length() >= CONTAINS_MIN_LENGTH && longer.contains(shorter);
    }
}
