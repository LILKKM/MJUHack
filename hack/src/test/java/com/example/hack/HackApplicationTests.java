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

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }
}
