package com.example.hack.kto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.example.hack.TestcontainersConfiguration;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 관광공사 API 대신 가짜 응답으로 수집 → 연결 → 접근성 반영 전체 흐름을 확인한다. */
@SpringBootTest
@Import({TestcontainersConfiguration.class, KtoSyncIntegrationTests.FakeKtoConfig.class})
class KtoSyncIntegrationTests {

    static final JsonMapper JSON = JsonMapper.builder().build();

    @TestConfiguration(proxyBeanMethods = false)
    static class FakeKtoConfig {
        @Bean
        @Primary
        FakeKtoClient fakeKtoClient() {
            return new FakeKtoClient();
        }
    }

    static class FakeKtoClient implements KtoClient {
        final AtomicInteger calls = new AtomicInteger();

        static final Map<String, String> LISTS = Map.of(
                "410", """
                        [{"contentid":"900001","contenttypeid":"14","title":"서대문형무소역사관","addr1":"서울특별시 서대문구 통일로 251",
                          "mapx":"126.9561","mapy":"37.5745","lDongSignguCd":"410"},
                         {"contentid":"900002","contenttypeid":"14","title":"국립대한민국임시정부기념관","addr1":"서울특별시 서대문구 통일로 279-1",
                          "mapx":"126.9580","mapy":"37.5760","lDongSignguCd":"410"}]
                        """,
                "110", """
                        {"contentid":"900003","contenttypeid":"12","title":"경복궁","mapx":"126.9770","mapy":"37.5796","lDongSignguCd":"110"}
                        """);

        static final Map<String, String> DETAILS = Map.of(
                "900001", """
                        {"contentid":"900001","parking":"장애인 전용 주차구역 있음","restroom":"장애인 화장실 있음",
                         "exit":"주출입구 단차 없음","elevator":"없음","wheelchair":"휠체어 대여 가능"}
                        """,
                "126531", """
                        {"contentid":"126531","parking":"주차 가능","stroller":"유모차 대여 가능"}
                        """);

        @Override
        public Page areaBasedList(String lDongRegnCd, String lDongSignguCd, int pageNo, int numOfRows) {
            calls.incrementAndGet();
            String body = pageNo == 1 ? LISTS.get(lDongSignguCd) : null;
            if (body == null) {
                return new Page(List.of(), 0);
            }
            JsonNode node = JSON.readTree(body);
            List<JsonNode> items = node.isArray() ? List.copyOf(node.valueStream().toList()) : List.of(node);
            return new Page(items, items.size());
        }

        @Override
        public Optional<JsonNode> detailWithTour(String contentId) {
            calls.incrementAndGet();
            return Optional.ofNullable(DETAILS.get(contentId)).map(JSON::readTree);
        }

        @Override
        public int callCount() {
            return calls.get();
        }
    }

    @Autowired
    KtoSyncService sync;

    @Autowired
    JdbcClient jdbc;

    /** V8 시드 데이터를 지워 수집 전 상태로 되돌린다. */
    @org.junit.jupiter.api.BeforeEach
    void resetToBeforeCollection() {
        jdbc.sql("DELETE FROM spot_accessibility WHERE provider = 'KTO'").update();
        jdbc.sql("DELETE FROM kto_barrier_free").update();
        jdbc.sql("DELETE FROM kto_place").update();
        jdbc.sql("UPDATE spot SET latitude = NULL, longitude = NULL, coord_status = 'MISSING' WHERE coord_status = 'KTO'").update();
        jdbc.sql("UPDATE spot SET kto_content_id = NULL, kto_match_status = NULL WHERE kto_match_status = 'AUTO' OR id = 'JNG23'").update();
    }

    /** 상세가 없는 장소는 apply 가 기존 행을 지우면 안 된다. */
    @Test
    void applyKeepsExistingRowsWhenKtoHasNoDetail() {
        jdbc.sql("""
                INSERT INTO spot_accessibility (spot_id, feature_code, status, raw_text, provider)
                VALUES ('MPO04', 'PARKING', 'AVAILABLE', '엑셀 메모', 'KTO')
                """).update();
        sync.fetchBarrierFree(false);   // MPO04(127307)은 가짜 응답에 상세가 없다
        sync.applyBarrierFree();
        assertThat(statuses("MPO04")).containsEntry("PARKING", "AVAILABLE");
    }

    @Test
    void fullPipeline() {
        assertThat(sync.syncPlaces()).isEqualTo(3);
        assertThat(count("SELECT COUNT(*) FROM kto_place")).isEqualTo(3);

        var reports = sync.matchSpots();
        assertThat(reports).filteredOn(r -> r.ktoContentId() != null)
                .extracting(KtoSyncService.MatchReport::spotId)
                .containsExactlyInAnyOrder("SDM09", "SDM03", "JNG12");
        // 좌표가 없던 임시정부기념관은 관광공사 좌표로 채워진다
        assertThat(jdbc.sql("SELECT coord_status FROM spot WHERE id = 'SDM03'").query(String.class).single())
                .isEqualTo("KTO");
        assertThat(jdbc.sql("SELECT kto_match_status FROM spot WHERE id = 'SDM07'").query(String.class).single())
                .isEqualTo("MANUAL");

        sync.fetchBarrierFree(false);
        assertThat(count("SELECT COUNT(*) FROM kto_barrier_free WHERE raw IS NOT NULL")).isEqualTo(2);
        assertThat(count("SELECT COUNT(*) FROM kto_barrier_free WHERE raw IS NULL")).isGreaterThan(0);

        sync.applyBarrierFree();
        Map<String, String> prison = statuses("SDM09");
        assertThat(prison).containsEntry("PARKING", "AVAILABLE")
                .containsEntry("ACCESSIBLE_TOILET", "AVAILABLE")
                .containsEntry("ENTRANCE", "AVAILABLE")
                .containsEntry("ELEVATOR", "UNAVAILABLE")
                .containsEntry("WHEELCHAIR_RENTAL", "AVAILABLE");

        // 안산 봉수대: 관광공사 값(provider=KTO)은 새로 받은 값으로 바뀌지만,
        // 팀이 판단한 접근로 '없음'(provider=TEAM)은 그대로 남는다
        Map<String, String> beacon = statuses("SDM07");
        assertThat(beacon).containsEntry("PARKING", "AVAILABLE")
                .containsEntry("STROLLER", "AVAILABLE")
                .containsEntry("ACCESS_ROUTE", "UNAVAILABLE");
        assertThat(jdbc.sql("SELECT provider FROM spot_accessibility WHERE spot_id = 'SDM07' AND feature_code = 'ACCESS_ROUTE'")
                .query(String.class).single()).isEqualTo("TEAM");

        // 다시 실행해도 같은 결과 (이미 받은 상세는 다시 부르지 않음)
        int before = count("SELECT COUNT(*) FROM spot_accessibility");
        sync.fetchBarrierFree(false);
        sync.applyBarrierFree();
        assertThat(count("SELECT COUNT(*) FROM spot_accessibility")).isEqualTo(before);
    }

    private int count(String sql) {
        return jdbc.sql(sql).query(Integer.class).single();
    }

    private Map<String, String> statuses(String spotId) {
        return jdbc.sql("SELECT feature_code, status FROM spot_accessibility WHERE spot_id = ?").param(spotId)
                .query((rs, i) -> Map.entry(rs.getString(1), rs.getString(2))).list().stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }
}
