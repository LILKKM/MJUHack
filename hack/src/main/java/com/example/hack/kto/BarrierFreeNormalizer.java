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

    // "단차 없음"처럼 '없음'이 좋은 뜻인 표현. 부정어 검사 전에 지운다.
    private static final Pattern GOOD_NEGATION = Pattern.compile("(단차|문턱|턱|계단|장애물)\\s*(이|가)?\\s*없(음|고|어|으며|는|다)?");
    // 조건이 붙거나 일부만 되는 표현
    private static final Pattern PARTIAL = Pattern.compile(
            "일부|부분|있으나|있지만|으나|지만|(가능|이용)하나|다소|협소|좁|급경사|경사.{0,6}(급|심)|문의|요청\\s*시|요청해야"
                    + "|사전\\s*(예약|요청)|제한적|불편|잠겨|계단이?\\s*있");
    private static final Pattern NEGATIVE = Pattern.compile(
            "^\\s*(n|no|x)\\s*$|없음|없습니다|없다|없어|불가|미설치|미운영|미비치|어려움|어렵|안\\s*됨|미보유|해당\\s*없|공사\\s*중|폐쇄");
    private static final Pattern POSITIVE = Pattern.compile(
            "^\\s*(y|yes|o)\\s*$|있음|있습니다|있다|있어|가능|비치|설치|운영|대여\\s*가능|대여가능|구비|보유|완비|전용"
                    + "|\\d+\\s*(면|대|개|곳|실|석)|무료|지원|동반|제공|평탄|쉬움|쉽|원활|용이|완만|무단차");

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

    /**
     * 1. 조건·일부 표현이 있으면 PARTIAL
     * 2. ('단차 없음' 같은 좋은 뜻을 지운 뒤) 부정 표현과 긍정 표현이 함께 있으면 PARTIAL
     * 3. 부정만 있으면 UNAVAILABLE, 긍정만 있으면 AVAILABLE, 둘 다 없으면 UNKNOWN
     */
    static String classify(String text) {
        String t = text.toLowerCase();
        if (PARTIAL.matcher(t).find()) {
            return "PARTIAL";
        }
        boolean goodNegation = GOOD_NEGATION.matcher(t).find();
        String rest = GOOD_NEGATION.matcher(t).replaceAll(" ");
        boolean negative = NEGATIVE.matcher(rest).find();
        boolean positive = goodNegation || POSITIVE.matcher(rest).find();
        if (negative && positive) {
            return "PARTIAL";
        }
        if (negative) {
            return "UNAVAILABLE";
        }
        if (positive) {
            return "AVAILABLE";
        }
        // "장애인 화장실(재궁, 영녕전, 전사청 앞)"처럼 시설명 뒤에 위치만 적은 경우는 '있음'으로 본다
        return LOCATION_LIST.matcher(t).matches() ? "AVAILABLE" : "UNKNOWN";
    }

    private static final Pattern LOCATION_LIST = Pattern.compile("^[^()]{1,20}\\([^)]+\\)\\s*$");

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
