package com.example.hack.kto;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import tools.jackson.databind.JsonNode;

/**
 * 관광공사 무장애 상세(detailWithTour2)의 자유 텍스트를 접근성 상태로 바꾼다.
 *
 * <p>빈 값은 행을 만들지 않는다 (= 미확인). "없음/있음"으로 추정하지 않는다.
 * 규칙으로 판단이 안 되는 문장은 UNKNOWN 으로 두고 원문을 남긴다.
 */
public final class BarrierFreeNormalizer {

    private BarrierFreeNormalizer() {
    }

    public record Item(String featureCode, String status, String rawText) {
    }

    /** 관광공사 필드 → 내부 접근성 항목. 같은 항목에 여러 필드가 오면 더 좋은 상태를 쓴다. */
    static final Map<String, String> FIELD_TO_FEATURE = new LinkedHashMap<>();

    static {
        FIELD_TO_FEATURE.put("route", "ACCESS_ROUTE");          // 접근로
        FIELD_TO_FEATURE.put("parking", "PARKING");
        FIELD_TO_FEATURE.put("wheelchair", "WHEELCHAIR_RENTAL");
        FIELD_TO_FEATURE.put("exit", "ENTRANCE");               // 출입구
        FIELD_TO_FEATURE.put("elevator", "ELEVATOR");
        FIELD_TO_FEATURE.put("restroom", "ACCESSIBLE_TOILET");
        FIELD_TO_FEATURE.put("braileblock", "BRAILLE_BLOCK");
        FIELD_TO_FEATURE.put("helpdog", "GUIDE_DOG");
        FIELD_TO_FEATURE.put("audioguide", "AUDIO_GUIDE");
        FIELD_TO_FEATURE.put("signguide", "SUBTITLE_GUIDE");    // 수어 안내
        FIELD_TO_FEATURE.put("videoguide", "SUBTITLE_GUIDE");   // 자막·영상 안내
        FIELD_TO_FEATURE.put("stroller", "STROLLER");
        FIELD_TO_FEATURE.put("lactationroom", "NURSING_ROOM");
    }

    // 순서가 중요하다: "단차 없음"은 좋은 뜻이므로 부정어 검사보다 먼저 본다.
    private static final Pattern GOOD_NEGATION = Pattern.compile("(단차|문턱|턱|계단|장애물)\\s*(이|가)?\\s*없");
    private static final Pattern PARTIAL = Pattern.compile("일부|부분|있으나|있지만|다소|협소|좁|급경사|경사.*(급|심)|문의|요청\\s*시|사전\\s*(예약|요청)|제한적|불편");
    private static final Pattern NEGATIVE = Pattern.compile("^\\s*(n|no|x)\\s*$|없음|없습니다|없다|불가|미설치|미운영|미비치|어려움|어렵|안\\s*됨|미보유|해당\\s*없");
    private static final Pattern POSITIVE = Pattern.compile("^\\s*(y|yes|o)\\s*$|있음|있습니다|있다|가능|비치|설치|운영|대여|구비|보유|완비|전용|\\d+\\s*(면|대|개|곳|실)|무료|지원|동반");

    public static List<Item> normalize(JsonNode detail) {
        Map<String, Item> byFeature = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : FIELD_TO_FEATURE.entrySet()) {
            JsonNode v = detail.get(e.getKey());
            if (v == null || v.isNull()) {
                continue;
            }
            String raw = clean(v.asString(""));
            if (raw.isEmpty()) {
                continue;
            }
            Item item = new Item(e.getValue(), classify(raw), raw);
            byFeature.merge(e.getValue(), item, BarrierFreeNormalizer::better);
        }
        return new ArrayList<>(byFeature.values());
    }

    static String classify(String text) {
        String t = text.toLowerCase();
        if (GOOD_NEGATION.matcher(t).find()) {
            return PARTIAL.matcher(t).find() ? "PARTIAL" : "AVAILABLE";
        }
        if (PARTIAL.matcher(t).find()) {
            return "PARTIAL";
        }
        if (NEGATIVE.matcher(t).find()) {
            return "UNAVAILABLE";
        }
        if (POSITIVE.matcher(t).find()) {
            return "AVAILABLE";
        }
        return "UNKNOWN";
    }

    private static Item better(Item a, Item b) {
        int ra = rank(a.status());
        int rb = rank(b.status());
        Item best = ra >= rb ? a : b;
        return new Item(best.featureCode(), best.status(), a.rawText() + " / " + b.rawText());
    }

    private static int rank(String status) {
        return switch (status) {
            case "AVAILABLE" -> 3;
            case "PARTIAL" -> 2;
            case "UNAVAILABLE" -> 1;
            default -> 0;
        };
    }

    /** 응답에 섞여 오는 HTML 태그·엔티티를 걷어낸다. */
    static String clean(String s) {
        return s.replaceAll("<[^>]+>", " ")
                .replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
                .replaceAll("\\s+", " ").trim();
    }
}
