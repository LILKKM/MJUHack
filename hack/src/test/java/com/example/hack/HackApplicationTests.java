package com.example.hack;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class HackApplicationTests {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void contextLoads() {
    }

    @Test
    void flywaySeedsSpotsAndCrossLinks() {
        assertThat(count("spot")).isEqualTo(58);
        assertThat(count("era")).isEqualTo(3);
        assertThat(count("cross_link")).isEqualTo(8);
        assertThat(count("cross_link_spot")).isEqualTo(25);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM spot WHERE era_id = 'JOSEON'", Integer.class)).isEqualTo(34);
    }

    @Test
    void flywaySeedsCollectedKtoData() {
        assertThat(count("kto_place")).isEqualTo(307);
        assertThat(count("kto_barrier_free")).isEqualTo(25);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM spot_accessibility WHERE provider = 'KTO'", Integer.class)).isEqualTo(116);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM spot WHERE kto_content_id IS NOT NULL", Integer.class)).isEqualTo(25);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM spot WHERE coord_status = 'KTO'", Integer.class)).isEqualTo(4);
        // 수집되지 않은 안산 봉수대의 V5 행과 팀 판단 행도 그대로 있다
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM spot_accessibility WHERE spot_id = 'SDM07'", Integer.class)).isEqualTo(3);
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }
}
