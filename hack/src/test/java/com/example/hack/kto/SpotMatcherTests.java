package com.example.hack.kto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.example.hack.kto.SpotMatcher.Kind;
import com.example.hack.kto.SpotMatcher.Place;
import com.example.hack.kto.SpotMatcher.Result;

class SpotMatcherTests {

    static final Place PRISON = new Place("K1", "서대문형무소역사관", "SDM", 37.5745, 126.9561);
    static final Place GATE = new Place("K2", "독립문", "SDM", 37.5724, 126.9596);
    static final Place PALACE = new Place("K3", "경복궁", "JNG", 37.5796, 126.9770);

    @Test
    void sameNameWithinDistanceIsLinked() {
        Result r = SpotMatcher.match(new Place("SDM09", "서대문형무소역사관", "SDM", 37.5746, 126.9556),
                List.of(PRISON, GATE, PALACE));
        assertThat(r.match().kto().id()).isEqualTo("K1");
        assertThat(r.match().kind()).isEqualTo(Kind.SAME_NAME);
    }

    @Test
    void containedNameNeedsToBeClose() {
        Result near = SpotMatcher.match(new Place("SDM05", "독립문·영은문 주초", "SDM", 37.5725, 126.9595), List.of(GATE));
        assertThat(near.match().kto().id()).isEqualTo("K2");

        Result far = SpotMatcher.match(new Place("X", "독립문·영은문 주초", "SDM", 37.60, 126.90), List.of(GATE));
        assertThat(far.match()).isNull();
        assertThat(far.candidates()).hasSize(1);
    }

    @Test
    void spotWithoutCoordsLinksOnlyOnExactNameInSameDistrict() {
        Result r = SpotMatcher.match(new Place("JNG12", "경복궁", "JNG", null, null), List.of(PALACE));
        assertThat(r.match().kto().id()).isEqualTo("K3");

        Result other = SpotMatcher.match(new Place("Y", "경복궁", "SDM", null, null), List.of(PALACE));
        assertThat(other.match()).isNull();
    }

    @Test
    void ambiguousContainsIsNotLinked() {
        Place a = new Place("A1", "진관사", "EPY", 37.6380, 126.9460);
        Place b = new Place("A2", "진관사 템플스테이", "EPY", 37.6381, 126.9461);
        Result r = SpotMatcher.match(new Place("EPY07", "진관사", "EPY", 37.6380, 126.9460), List.of(a, b));
        // 같은 이름이 하나 있으면 그것을 고른다
        assertThat(r.match().kto().id()).isEqualTo("A1");

        // '진관사 태극기 비'는 이름 포함으로 '진관사'에 붙을 수 있지만…
        Result r2 = SpotMatcher.match(new Place("EPY08", "진관사 태극기 비", "EPY", 37.6380, 126.9460), List.of(a, b));
        assertThat(r2.match().kind()).isEqualTo(Kind.CONTAINS);

        // …같은 이름으로 '진관사'를 가져간 장소가 있으면 자동 연결을 취소하고 후보로 돌린다
        var resolved = SpotMatcher.resolveConflicts(
                new java.util.LinkedHashMap<>(java.util.Map.of("EPY07", r, "EPY08", r2)), java.util.Set.of());
        assertThat(resolved.get("EPY07").match().kto().id()).isEqualTo("A1");
        assertThat(resolved.get("EPY08").match()).isNull();
        assertThat(resolved.get("EPY08").candidates().get(0).kto().id()).isEqualTo("A1");

        // 수동 연결된 콘텐츠도 포함 관계로는 가져가지 못한다
        var manual = SpotMatcher.resolveConflicts(java.util.Map.of("EPY08", r2), java.util.Set.of("A1"));
        assertThat(manual.get("EPY08").match()).isNull();
    }
}
