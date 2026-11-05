package com.example.hack.kto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.example.hack.kto.BarrierFreeNormalizer.Item;

import tools.jackson.databind.json.JsonMapper;

class BarrierFreeNormalizerTests {

    @Test
    void classifiesFreeText() {
        assertThat(BarrierFreeNormalizer.classify("장애인 화장실 있음(1층 매표소 옆)")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("장애인 전용 주차구역 2면")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("Y")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("휠체어 대여 가능(매표소)")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("경사로 있으나 경사가 다소 급함")).isEqualTo("PARTIAL");
        assertThat(BarrierFreeNormalizer.classify("일부 구간 이용 가능")).isEqualTo("PARTIAL");
        assertThat(BarrierFreeNormalizer.classify("없음")).isEqualTo("UNAVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("N")).isEqualTo("UNAVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("휠체어 대여 불가")).isEqualTo("UNAVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("출입구 단차 없음")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("주출입구까지 턱이 없음")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("관리사무소에 확인")).isEqualTo("UNKNOWN");
    }

    @Test
    void mapsFieldsSkipsBlanksAndKeepsBetterStatus() {
        JsonMapper json = JsonMapper.builder().build();
        List<Item> items = BarrierFreeNormalizer.normalize(json.readTree("""
                {"contentid":"1","parking":"장애인 전용 주차구역 있음","restroom":"",
                 "exit":"<br>출입구 단차 없음","signguide":"없음","videoguide":"자막 안내 있음",
                 "elevator":null}
                """));
        assertThat(items).extracting(Item::featureCode)
                .containsExactly("PARKING", "ENTRANCE", "SUBTITLE_GUIDE");
        assertThat(items.get(1).rawText()).isEqualTo("출입구 단차 없음");
        assertThat(items.get(2).status()).isEqualTo("AVAILABLE");
        assertThat(items.get(2).rawText()).isEqualTo("없음 / 자막 안내 있음");
    }
}
