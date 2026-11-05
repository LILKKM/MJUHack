package com.example.hack.kto;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class RestKtoClient implements KtoClient {

    private final KtoProperties props;
    private final JsonMapper json;
    private final RestClient http = RestClient.create();
    private final AtomicInteger calls = new AtomicInteger();

    public RestKtoClient(KtoProperties props, JsonMapper json) {
        this.props = props;
        this.json = json;
    }

    @Override
    public Page areaBasedList(String lDongRegnCd, String lDongSignguCd, int pageNo, int numOfRows) {
        JsonNode body = call("areaBasedList2", Map.of(
                "lDongRegnCd", lDongRegnCd,
                "lDongSignguCd", lDongSignguCd,
                "arrange", "A",
                "pageNo", String.valueOf(pageNo),
                "numOfRows", String.valueOf(numOfRows)));
        return new Page(items(body), body.path("totalCount").asInt(0));
    }

    @Override
    public Optional<JsonNode> detailWithTour(String contentId) {
        List<JsonNode> items = items(call("detailWithTour2", Map.of("contentId", contentId)));
        return items.isEmpty() ? Optional.empty() : Optional.of(items.get(0));
    }

    @Override
    public int callCount() {
        return calls.get();
    }

    private JsonNode call(String operation, Map<String, String> params) {
        if (!props.hasKey()) {
            throw new KtoException("KTO_SERVICE_KEY 환경변수가 없습니다. 공공데이터포털의 Decoding 키를 설정하세요.");
        }
        if (calls.get() >= props.maxCalls()) {
            throw new KtoException("호출 한도(kto.max-calls=" + props.maxCalls() + ")에 도달해 중단합니다. 내일 이어서 실행하세요.");
        }
        // data.go.kr 키에는 +, /, = 가 들어 있어 직접 한 번만 인코딩한다.
        UriComponentsBuilder b = UriComponentsBuilder.fromUriString(props.baseUrl()).path("/" + operation)
                .queryParam("serviceKey", URLEncoder.encode(props.serviceKey().trim(), StandardCharsets.UTF_8))
                .queryParam("MobileOS", "ETC")
                .queryParam("MobileApp", URLEncoder.encode(props.mobileApp(), StandardCharsets.UTF_8))
                .queryParam("_type", "json");
        params.forEach((k, v) -> b.queryParam(k, URLEncoder.encode(v, StandardCharsets.UTF_8)));
        URI uri = b.build(true).toUri();

        calls.incrementAndGet();
        String text = http.get().uri(uri).retrieve().body(String.class);
        if (text == null || !text.trim().startsWith("{")) {
            // 키 오류 등은 _type=json 이어도 XML 로 온다
            throw new KtoException(operation + " 응답이 JSON 이 아닙니다: " + abbreviate(text));
        }
        JsonNode root = json.readTree(text);
        JsonNode header = root.path("response").path("header");
        String code = header.path("resultCode").asString("");
        if (!"0000".equals(code)) {
            throw new KtoException(operation + " 오류 " + code + ": " + header.path("resultMsg").asString(""));
        }
        return root.path("response").path("body");
    }

    /** body.items.item 은 배열, 단일 객체, 또는 빈 문자열("")일 수 있다. */
    static List<JsonNode> items(JsonNode body) {
        JsonNode item = body.path("items").path("item");
        List<JsonNode> result = new ArrayList<>();
        if (item.isArray()) {
            item.forEach(result::add);
        } else if (item.isObject()) {
            result.add(item);
        }
        return result;
    }

    private static String abbreviate(String s) {
        if (s == null) {
            return "(빈 응답)";
        }
        String oneLine = s.replaceAll("\\s+", " ").trim();
        return oneLine.length() > 200 ? oneLine.substring(0, 200) + "…" : oneLine;
    }
}
