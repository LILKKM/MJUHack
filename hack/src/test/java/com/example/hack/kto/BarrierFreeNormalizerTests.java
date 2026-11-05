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

    /** 2026-11-06 실제 수집 원문에서 가져온 사례 */
    @Test
    void classifiesRealKtoTexts() {
        assertThat(BarrierFreeNormalizer.classify(
                "출입구까지 단차가 없어 휠체어 이용 가능하나 흙구간 및 휠체어 접근이 불가한 구간 있음")).isEqualTo("PARTIAL");
        assertThat(BarrierFreeNormalizer.classify(
                "야외 관람로는 단차가 없고 평탄해서 이동하기 좋으나 형무소 건물 내부의 전시관은 모두 입구에 계단이 있어서"))
                .isEqualTo("PARTIAL");
        assertThat(BarrierFreeNormalizer.classify("1층 진입로에 계단이 있으나 휠체어리프트 있어 집입 가능함")).isEqualTo("PARTIAL");
        assertThat(BarrierFreeNormalizer.classify(
                "수유실 있음(홍화문 우측, 평소에 잠겨 있어서 이용시 안내소에 요청해야 함)")).isEqualTo("PARTIAL");
        assertThat(BarrierFreeNormalizer.classify("주 출입구까지 평탄한 길")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("접근로 이용이 쉬움")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("음성안내어플 제공")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("출입구까지 턱이 없어 휠체어 접근 가능함")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("주출입구 무단차관람객 도움벨이 설치되어 있음")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("장애인주차장 3면 보유")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("주차장이 공사 중(2027년까지)")).isEqualTo("UNAVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("장애인 화장실(재궁, 영녕전, 전사청 앞)")).isEqualTo("AVAILABLE");
        assertThat(BarrierFreeNormalizer.classify("일부구간 경사로가 설치되어 있음")).isEqualTo("PARTIAL");
        assertThat(BarrierFreeNormalizer.classify("전각에 경사로가 설치되어 있으나 일부구간 접근 어려움")).isEqualTo("PARTIAL");
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
