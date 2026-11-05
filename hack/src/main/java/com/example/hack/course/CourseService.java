package com.example.hack.course;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.hack.common.ApiException;
import com.example.hack.common.GeoUtils;
import com.example.hack.course.CourseDtos.CourseRequest;
import com.example.hack.course.CourseDtos.CourseResponse;
import com.example.hack.course.CourseDtos.Excluded;
import com.example.hack.course.CourseDtos.Start;
import com.example.hack.course.CourseDtos.Stop;
import com.example.hack.course.CourseDtos.StopSpot;
import com.example.hack.reference.ReferenceDtos.Requirement;
import com.example.hack.reference.ReferenceDtos.UserTypeResponse;
import com.example.hack.reference.ReferenceRepository;
import com.example.hack.session.SessionDtos.SessionResponse;
import com.example.hack.session.SessionService;
import com.example.hack.spot.SpotDtos.AccessibilityItem;
import com.example.hack.spot.SpotDtos.CrossLinkResponse;
import com.example.hack.spot.SpotRepository;
import com.example.hack.spot.SpotRepository.SpotRow;

import tools.jackson.databind.json.JsonMapper;

/**
 * Builds a course from user conditions, following the planning doc:
 * filter by era → drop spots whose required accessibility is confirmed UNAVAILABLE →
 * group by distance from the start → order the visit (greedy nearest neighbour).
 * Distances are straight-line; no travel time or route accessibility is claimed.
 */
@Service
public class CourseService {

    static final int DEFAULT_STOPS = 4;
    static final int MIN_STOPS = 3;
    static final int MAX_STOPS = 5;
    /** Rough minutes per stop used only to turn a time budget into a stop count. */
    static final int MINUTES_PER_STOP = 40;
    /** How much a satisfied accessibility preference may outweigh distance (km per point). */
    static final double PREFERENCE_KM = 0.2;
    /** Bonus for a spot that continues a cross-period link already in the course. */
    static final double CROSS_LINK_KM = 0.5;

    static final String ROUTE_WARNING = "장소 사이 이동 경로의 접근성은 확인되지 않았습니다. 이동 전 별도로 확인하세요.";
    static final String DISTANCE_NOTE = "거리는 직선거리이며 실제 이동 거리·시간과 다릅니다.";

    private final SpotRepository spots;
    private final ReferenceRepository reference;
    private final SessionService sessions;
    private final JdbcClient jdbc;
    private final JsonMapper json;

    public CourseService(SpotRepository spots, ReferenceRepository reference, SessionService sessions,
            JdbcClient jdbc, JsonMapper json) {
        this.spots = spots;
        this.reference = reference;
        this.sessions = sessions;
        this.jdbc = jdbc;
        this.json = json;
    }

    private record Origin(double lat, double lng, String label) {
    }

    private record Candidate(SpotRow spot, List<String> unknownRequired, List<String> partialRequired,
            double preferenceScore, List<String> crossLinkIds, List<String> evidence) {
    }

    @Transactional
    public CourseResponse create(CourseRequest req) {
        SessionResponse session = req.sessionId() == null ? null : sessions.get(req.sessionId());

        // ---- 1. resolve conditions (request first, then session state) ----
        List<String> userTypes = req.userTypes() != null ? dedupe(req.userTypes())
                : session != null ? session.userTypes() : List.of();
        if (reference.findExistingUserTypeCodes(userTypes).size() != userTypes.size()) {
            throw ApiException.badRequest("알 수 없는 userTypes 값이 있습니다: " + userTypes);
        }
        List<String> eraIds = resolveEras(req, session);
        Origin origin = resolveOrigin(req.start(), session);
        int stopCount = resolveStopCount(req.stopCount(),
                req.timeBudgetMin() != null ? req.timeBudgetMin() : session != null ? session.timeBudgetMin() : null);

        Reqs reqs = requirements(userTypes);
        Map<String, Requirement> required = reqs.required();
        Map<String, String> typeNames = reqs.typeNames();

        // ---- 2. filter candidates ----
        List<SpotRow> inEra = spots.findRowsByEras(eraIds);
        List<String> ids = inEra.stream().map(SpotRow::id).toList();
        Map<String, List<AccessibilityItem>> access = spots.accessibilityBySpot(ids);
        Map<String, List<String>> crossLinks = spots.crossLinkIdsBySpot(ids);

        List<Candidate> candidates = new ArrayList<>();
        List<Excluded> excluded = new ArrayList<>();
        int missingCoords = 0;
        for (SpotRow s : inEra) {
            String blocked = blockedReason(reqs, access.getOrDefault(s.id(), List.of()));
            if (blocked != null) {
                excluded.add(new Excluded(s.id(), s.name(), blocked));
                continue;
            }
            if (!s.hasCoords()) {
                missingCoords++;
                continue;
            }
            candidates.add(evaluate(s, reqs, access.getOrDefault(s.id(), List.of()),
                    crossLinks.getOrDefault(s.id(), List.of())));
        }
        if (candidates.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "NO_CANDIDATES",
                    "조건을 만족하는 장소가 없습니다. 시대나 이용자 조건을 바꿔 보세요.");
        }

        // ---- 3 + 4. pick and order: greedy nearest neighbour with preference / cross-link bonus ----
        List<Candidate> chosen = new ArrayList<>();
        Set<String> chosenLinks = new HashSet<>();
        double curLat = origin.lat();
        double curLng = origin.lng();
        List<Candidate> pool = new ArrayList<>(candidates);
        List<Double> legs = new ArrayList<>();
        while (chosen.size() < stopCount && !pool.isEmpty()) {
            final double lat = curLat;
            final double lng = curLng;
            Candidate next = pool.stream().min(Comparator.comparingDouble((Candidate c) -> {
                double d = dist(lat, lng, c.spot());
                boolean continuesLink = c.crossLinkIds().stream().anyMatch(chosenLinks::contains);
                return d - PREFERENCE_KM * c.preferenceScore() - (continuesLink ? CROSS_LINK_KM : 0);
            }).thenComparing(c -> c.spot().id())).orElseThrow();
            legs.add(dist(lat, lng, next.spot()));
            chosen.add(next);
            pool.remove(next);
            chosenLinks.addAll(next.crossLinkIds());
            curLat = next.spot().latitude().doubleValue();
            curLng = next.spot().longitude().doubleValue();
        }

        // ---- build response ----
        Map<String, CrossLinkResponse> linkById = spots.findCrossLinks(null).stream()
                .collect(Collectors.toMap(CrossLinkResponse::id, l -> l));
        List<Stop> stops = new ArrayList<>();
        List<String> usedLinks = new ArrayList<>();
        for (int i = 0; i < chosen.size(); i++) {
            Candidate c = chosen.get(i);
            String crossLinkId = pickCrossEraLink(c, linkById);
            if (crossLinkId != null && !usedLinks.contains(crossLinkId)) {
                usedLinks.add(crossLinkId);
            }
            SpotRow s = c.spot();
            stops.add(new Stop(i + 1, new StopSpot(s.id(), s.name(), s.eraId(), s.latitude(), s.longitude()),
                    GeoUtils.round2(legs.get(i)), accessMemo(s, c, required), c.unknownRequired(), crossLinkId));
        }

        List<String> warnings = baseWarnings(chosen);
        if (chosen.size() < stopCount) {
            warnings.add("조건에 맞는 장소가 " + chosen.size() + "곳뿐이라 요청한 " + stopCount + "곳보다 적습니다.");
        }
        if (missingCoords > 0) {
            warnings.add("좌표가 아직 없는 장소 " + missingCoords + "곳은 후보에서 빠졌습니다.");
        }

        String reason = buildReason(eraIds, userTypes, typeNames, origin.label(), chosen.size(), excluded.size(),
                usedLinks, linkById, req, session);
        CourseResponse response = new CourseResponse(null, eraIds, userTypes, origin.label(), reason, stops,
                excluded, warnings);

        if (session != null) {
            response = save(session.id(), eraIds, response);
        }
        return response;
    }

    /**
     * 세션의 현재 코스에서 장소를 빼거나 넣거나 바꿔 새 코스로 저장한다. 챗봇의 "두 번째 장소 빼고 다른 데"에 쓴다.
     * 추가하는 장소도 코스 생성과 같은 접근성 조건으로 검사한다.
     *
     * @param action   remove | add | replace
     * @param position 1부터 시작. add 에서 생략하면 맨 뒤
     */
    @Transactional
    public CourseResponse edit(String sessionId, String action, Integer position, String spotId) {
        SessionResponse session = sessions.get(sessionId);
        if (session.currentCourseId() == null) {
            throw ApiException.badRequest("수정할 현재 코스가 없습니다. 먼저 코스를 만들어 주세요.");
        }
        CourseResponse current = get(session.currentCourseId());
        List<String> ids = new ArrayList<>(current.stops().stream().map(s -> s.spot().id()).toList());

        boolean needsPosition = "remove".equals(action) || "replace".equals(action);
        if (needsPosition && (position == null || position < 1 || position > ids.size())) {
            throw ApiException.badRequest("position 은 1~" + ids.size() + " 사이여야 합니다.");
        }
        switch (action == null ? "" : action) {
            case "remove" -> ids.remove(position - 1);
            case "replace" -> ids.set(position - 1, requireSpotId(spotId));
            case "add" -> {
                int at = position == null ? ids.size() : position - 1;
                if (at < 0 || at > ids.size()) {
                    throw ApiException.badRequest("position 은 1~" + (ids.size() + 1) + " 사이여야 합니다.");
                }
                ids.add(at, requireSpotId(spotId));
            }
            default -> throw ApiException.badRequest("action 은 remove, add, replace 중 하나여야 합니다.");
        }
        if (ids.isEmpty()) {
            throw ApiException.badRequest("코스에는 장소가 최소 1곳 있어야 합니다.");
        }
        if (ids.size() > MAX_STOPS) {
            throw ApiException.badRequest("코스에는 장소를 최대 " + MAX_STOPS + "곳까지 넣을 수 있습니다.");
        }
        if (new HashSet<>(ids).size() != ids.size()) {
            throw ApiException.badRequest("이미 코스에 있는 장소입니다: " + spotId);
        }

        Reqs reqs = requirements(session.userTypes());
        Map<String, List<AccessibilityItem>> access = spots.accessibilityBySpot(ids);
        Map<String, List<String>> crossLinks = spots.crossLinkIdsBySpot(ids);
        Map<String, CrossLinkResponse> linkById = spots.findCrossLinks(null).stream()
                .collect(Collectors.toMap(CrossLinkResponse::id, l -> l));

        List<Stop> stops = new ArrayList<>();
        List<Candidate> chosen = new ArrayList<>();
        Set<String> eraIds = new LinkedHashSet<>(current.eraIds());
        SpotRow prev = session.startSpotId() == null ? null : spots.findRow(session.startSpotId()).orElse(null);
        for (int i = 0; i < ids.size(); i++) {
            String id = ids.get(i);
            SpotRow s = spots.findRow(id).orElseThrow(() -> ApiException.badRequest("알 수 없는 장소입니다: " + id));
            if (!s.hasCoords()) {
                throw ApiException.badRequest(s.name() + " 은(는) 좌표가 없어 코스에 넣을 수 없습니다.");
            }
            String blocked = blockedReason(reqs, access.getOrDefault(id, List.of()));
            if (blocked != null) {
                throw ApiException.badRequest(s.name() + " 은(는) 이용자 조건에 맞지 않습니다: " + blocked);
            }
            Candidate c = evaluate(s, reqs, access.getOrDefault(id, List.of()), crossLinks.getOrDefault(id, List.of()));
            Double distance = i == 0 && prev == null ? firstLegIfUnchanged(current, id)
                    : prev == null || !prev.hasCoords() ? null
                    : Double.valueOf(GeoUtils.round2(dist(prev.latitude().doubleValue(), prev.longitude().doubleValue(), s)));
            stops.add(new Stop(i + 1, new StopSpot(s.id(), s.name(), s.eraId(), s.latitude(), s.longitude()), distance,
                    accessMemo(s, c, reqs.required()), c.unknownRequired(), pickCrossEraLink(c, linkById)));
            chosen.add(c);
            eraIds.add(s.eraId());
            prev = s;
        }

        List<String> warnings = baseWarnings(chosen);
        String editNote = " 요청에 따라 코스를 수정했습니다.";
        String reason = current.reason() != null && current.reason().endsWith(editNote)
                ? current.reason() : current.reason() + editNote;
        CourseResponse edited = new CourseResponse(null, List.copyOf(eraIds), session.userTypes(), current.startLabel(),
                reason, stops, current.excluded(), warnings);
        return save(sessionId, edited.eraIds(), edited);
    }

    private String requireSpotId(String spotId) {
        if (spotId == null || spotId.isBlank()) {
            throw ApiException.badRequest("spot_id 가 필요합니다.");
        }
        return spotId;
    }

    /** 출발 좌표를 저장하지 않으므로, 첫 장소가 그대로일 때만 이전 거리를 유지한다. */
    private static Double firstLegIfUnchanged(CourseResponse current, String firstSpotId) {
        Stop first = current.stops().get(0);
        return first.spot().id().equals(firstSpotId) ? first.distanceFromPrevKm() : null;
    }

    private record Reqs(Map<String, Requirement> required, Map<String, Requirement> preferred,
            Map<String, String> typeNames) {
    }

    private Reqs requirements(List<String> userTypes) {
        Map<String, Requirement> required = new HashMap<>();
        Map<String, Requirement> preferred = new HashMap<>();
        Map<String, String> typeNames = new HashMap<>();
        for (UserTypeResponse t : reference.findUserTypes()) {
            typeNames.put(t.code(), t.name());
            if (!userTypes.contains(t.code())) {
                continue;
            }
            for (Requirement r : t.requirements()) {
                if (r.required()) {
                    required.put(r.featureCode(), r);
                    preferred.remove(r.featureCode());
                } else if (!required.containsKey(r.featureCode())) {
                    preferred.put(r.featureCode(), r);
                }
            }
        }
        return new Reqs(required, preferred, typeNames);
    }

    /** 필수 항목이 '없음'으로 확인되었으면 그 이유, 아니면 null. */
    private static String blockedReason(Reqs reqs, List<AccessibilityItem> items) {
        Map<String, AccessibilityItem> byFeature = items.stream()
                .collect(Collectors.toMap(AccessibilityItem::featureCode, a -> a));
        List<String> blocked = reqs.required().keySet().stream()
                .filter(f -> byFeature.containsKey(f) && "UNAVAILABLE".equals(byFeature.get(f).status()))
                .sorted().toList();
        if (blocked.isEmpty()) {
            return null;
        }
        return blocked.stream()
                .map(f -> reqs.required().get(f).featureName() + " 없음"
                        + (byFeature.get(f).rawText() == null ? "" : " (" + byFeature.get(f).rawText() + ")"))
                .collect(Collectors.joining(", "));
    }

    private static Candidate evaluate(SpotRow s, Reqs reqs, List<AccessibilityItem> items, List<String> links) {
        Map<String, Requirement> required = reqs.required();
        Map<String, AccessibilityItem> byFeature = items.stream()
                .collect(Collectors.toMap(AccessibilityItem::featureCode, a -> a));
        List<String> unknown = required.keySet().stream()
                .filter(f -> !byFeature.containsKey(f) || "UNKNOWN".equals(byFeature.get(f).status()))
                .sorted().toList();
        List<String> partial = required.keySet().stream()
                .filter(f -> byFeature.containsKey(f) && "PARTIAL".equals(byFeature.get(f).status()))
                .sorted().toList();
        double score = 0;
        for (String f : union(required.keySet(), reqs.preferred().keySet())) {
            AccessibilityItem a = byFeature.get(f);
            if (a != null && "AVAILABLE".equals(a.status())) {
                score += 1;
            } else if (a != null && "PARTIAL".equals(a.status())) {
                score += 0.5;
            }
        }
        // 필수 항목의 근거 원문 (예: "계단·급경사 없는 접근로: 출입구까지 경사로가 설치되어 있음")
        List<String> evidence = required.keySet().stream().sorted()
                .filter(f -> byFeature.containsKey(f) && byFeature.get(f).rawText() != null
                        && !"UNKNOWN".equals(byFeature.get(f).status()))
                .map(f -> required.get(f).featureName() + ": " + byFeature.get(f).rawText())
                .toList();
        return new Candidate(s, unknown, partial, score, links, evidence);
    }

    private static List<String> baseWarnings(List<Candidate> chosen) {
        List<String> warnings = new ArrayList<>();
        warnings.add(ROUTE_WARNING);
        warnings.add(DISTANCE_NOTE);
        long unknownStops = chosen.stream().filter(c -> !c.unknownRequired().isEmpty()).count();
        if (unknownStops > 0) {
            warnings.add(unknownStops + "곳은 필수 접근성 항목이 아직 확인되지 않았습니다. 방문 전 확인이 필요합니다.");
        }
        return warnings;
    }

    public CourseResponse get(long courseId) {
        String snapshot = jdbc.sql("SELECT snapshot FROM course WHERE id = ?").param(courseId)
                .query(String.class).optional()
                .orElseThrow(() -> ApiException.notFound("COURSE_NOT_FOUND", "코스를 찾을 수 없습니다: " + courseId));
        return json.readValue(snapshot, CourseResponse.class).withId(courseId);
    }

    // ---- helpers -----------------------------------------------------------------------------------

    private CourseResponse save(String sessionId, List<String> eraIds, CourseResponse response) {
        GeneratedKeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO course (session_id, era_id, reason, snapshot) VALUES (?, ?, ?, ?)")
                .params(sessionId, eraIds.size() == 1 ? eraIds.get(0) : null, response.reason(),
                        json.writeValueAsString(response))
                .update(keys);
        long id = keys.getKey().longValue();
        for (Stop s : response.stops()) {
            jdbc.sql("""
                    INSERT INTO course_stop (course_id, stop_order, spot_id, access_memo, cross_link_id)
                    VALUES (?, ?, ?, ?, ?)
                    """)
                    .params(id, s.order(), s.spot().id(), s.accessMemo(), s.crossLinkId())
                    .update();
        }
        sessions.setCurrentCourse(sessionId, id);
        return response.withId(id);
    }

    private List<String> resolveEras(CourseRequest req, SessionResponse session) {
        if (req.eraId() != null) {
            if (!reference.eraExists(req.eraId())) {
                throw ApiException.badRequest("알 수 없는 eraId: " + req.eraId());
            }
            return List.of(req.eraId());
        }
        if (req.kContentId() != null) {
            return reference.findEraIdsOfKContent(req.kContentId())
                    .orElseThrow(() -> ApiException.badRequest("알 수 없는 kContentId: " + req.kContentId()));
        }
        if (session != null && session.eraId() != null) {
            return List.of(session.eraId());
        }
        if (session != null && session.kContentId() != null) {
            return reference.findEraIdsOfKContent(session.kContentId()).orElse(List.of());
        }
        throw ApiException.badRequest("eraId 또는 kContentId 중 하나는 필요합니다.");
    }

    private Origin resolveOrigin(Start start, SessionResponse session) {
        String spotId = start != null ? start.spotId() : null;
        if (spotId == null && (start == null || start.latitude() == null) && session != null) {
            spotId = session.startSpotId();
        }
        String label = start != null && start.label() != null ? start.label()
                : session != null ? session.startLabel() : null;
        if (spotId != null) {
            final String id = spotId;
            SpotRow s = spots.findRow(id).orElseThrow(() -> ApiException.badRequest("알 수 없는 start.spotId: " + id));
            if (!s.hasCoords()) {
                throw ApiException.badRequest("출발 장소 " + id + " 의 좌표가 아직 없습니다. 좌표로 출발지를 보내 주세요.");
            }
            return new Origin(s.latitude().doubleValue(), s.longitude().doubleValue(), label != null ? label : s.name());
        }
        if (start != null && start.latitude() != null && start.longitude() != null) {
            double lat = start.latitude();
            double lng = start.longitude();
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                throw ApiException.badRequest("start 좌표 범위가 올바르지 않습니다.");
            }
            return new Origin(lat, lng, label != null ? label : "현재 위치");
        }
        throw ApiException.badRequest("start.spotId 또는 start.latitude/longitude 가 필요합니다.");
    }

    static int resolveStopCount(Integer stopCount, Integer timeBudgetMin) {
        if (stopCount != null) {
            if (stopCount < MIN_STOPS || stopCount > MAX_STOPS) {
                throw ApiException.badRequest("stopCount 는 " + MIN_STOPS + "~" + MAX_STOPS + " 사이여야 합니다.");
            }
            return stopCount;
        }
        if (timeBudgetMin != null) {
            return Math.max(MIN_STOPS, Math.min(MAX_STOPS, timeBudgetMin / MINUTES_PER_STOP));
        }
        return DEFAULT_STOPS;
    }

    /** A cross link of this spot that also contains a spot from another era (a jump between periods). */
    private static String pickCrossEraLink(Candidate c, Map<String, CrossLinkResponse> linkById) {
        return c.crossLinkIds().stream()
                .filter(id -> linkById.containsKey(id) && linkById.get(id).spots().stream()
                        .anyMatch(s -> !s.eraId().equals(c.spot().eraId())))
                .findFirst().orElse(null);
    }

    private static String accessMemo(SpotRow s, Candidate c, Map<String, Requirement> required) {
        List<String> parts = new ArrayList<>(c.evidence());
        // 엑셀 메모는 근거가 없을 때만 보여준다. '조회 대상' 같은 작업용 메모는 숨긴다.
        if (c.evidence().isEmpty() && s.accessibilityNote() != null && !s.accessibilityNote().contains("조회 대상")) {
            parts.add(s.accessibilityNote());
        }
        if (!c.partialRequired().isEmpty()) {
            parts.add("부분 제공: " + names(c.partialRequired(), required));
        }
        if (!c.unknownRequired().isEmpty()) {
            parts.add("미확인: " + names(c.unknownRequired(), required));
        }
        return parts.isEmpty() ? null : String.join(" / ", parts);
    }

    private static String names(List<String> codes, Map<String, Requirement> required) {
        return codes.stream().map(f -> required.get(f).featureName()).collect(Collectors.joining(", "));
    }

    private String buildReason(List<String> eraIds, List<String> userTypes, Map<String, String> typeNames,
            String startLabel, int chosen, int excludedCount, List<String> usedLinks,
            Map<String, CrossLinkResponse> linkById, CourseRequest req, SessionResponse session) {
        Map<String, String> eraNames = reference.findEras().stream()
                .collect(Collectors.toMap(e -> e.id(), e -> e.name()));
        String eras = eraIds.stream().map(eraNames::get).collect(Collectors.joining("·"));
        Long kContentId = req.eraId() == null && req.kContentId() != null ? req.kContentId()
                : req.eraId() == null && session != null ? session.kContentId() : null;
        String title = kContentId == null ? null : reference.findKContents().stream()
                .filter(k -> k.id() == kContentId).map(k -> k.title()).findFirst().orElse(null);

        StringBuilder sb = new StringBuilder();
        sb.append(title != null ? "「" + title + "」의 시대인 " + eras : eras).append(" 장소 중 ");
        sb.append(startLabel).append("에서 가까운 순서로 ").append(chosen).append("곳을 골랐습니다.");
        if (!userTypes.isEmpty()) {
            sb.append(" ").append(userTypes.stream().map(typeNames::get).collect(Collectors.joining("·")))
                    .append(" 조건을 적용했습니다.");
            sb.append(excludedCount > 0 ? " 필수 접근성 항목이 '없음'으로 확인된 " + excludedCount + "곳은 뺐습니다."
                    : " 필수 접근성 항목이 '없음'으로 확인되어 빠진 곳은 없습니다.");
        }
        for (String id : usedLinks) {
            sb.append(" '").append(linkById.get(id).title()).append("' 이야기로 다른 시대와 이어집니다.");
        }
        return sb.toString();
    }

    private static double dist(double lat, double lng, SpotRow s) {
        return GeoUtils.distanceKm(lat, lng, s.latitude().doubleValue(), s.longitude().doubleValue());
    }

    private static List<String> dedupe(List<String> values) {
        return new ArrayList<>(new LinkedHashSet<>(values));
    }

    private static Set<String> union(Set<String> a, Set<String> b) {
        Set<String> u = new HashSet<>(a);
        u.addAll(b);
        return u;
    }
}
