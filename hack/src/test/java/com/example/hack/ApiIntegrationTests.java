package com.example.hack;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ApiIntegrationTests {

    @Autowired
    MockMvc mvc;

    @Test
    void referenceData() throws Exception {
        mvc.perform(get("/api/eras"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].id").value("JOSEON"))
                .andExpect(jsonPath("$[0].spotCount").value(25));
        mvc.perform(get("/api/k-contents"))
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[?(@.title == '1987')].eraIds[0]").value("MODERN"));
        mvc.perform(get("/api/user-types"))
                .andExpect(jsonPath("$[0].code").value("WHEELCHAIR"))
                .andExpect(jsonPath("$[0].requirements[0].featureCode").value("ACCESS_ROUTE"))
                .andExpect(jsonPath("$[0].requirements[0].required").value(true));
    }

    @Test
    void spotsFilteredByKContentEra() throws Exception {
        mvc.perform(get("/api/spots").param("kContentId", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[*].eraId", everyItem(is("MODERN"))));
        // 은평구는 관광공사(V8)·OpenStreetMap(V9) 좌표로 채운 4곳이 남아 있다
        mvc.perform(get("/api/spots").param("districtId", "EPY").param("hasCoords", "true"))
                .andExpect(jsonPath("$[*].id", is(java.util.List.of("EPY02", "EPY06", "EPY07", "EPY08"))))
                .andExpect(jsonPath("$[1].coordStatus").value("KTO"));
    }

    @Test
    void spotDetailIncludesAccessibilitySourcesAndLinks() throws Exception {
        mvc.perform(get("/api/spots/SDM07"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.districtName").value("서대문구"))
                .andExpect(jsonPath("$.accessibility", hasSize(3)))
                .andExpect(jsonPath("$.accessibility[0].featureCode").value("ACCESS_ROUTE"))
                .andExpect(jsonPath("$.accessibility[0].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.sources", hasSize(2)));
        mvc.perform(get("/api/spots/SDM10"))
                .andExpect(jsonPath("$.crossLinks[0].id").value("X3"))
                .andExpect(jsonPath("$.crossLinks[0].spots", hasSize(3)));
        mvc.perform(get("/api/spots/NOPE"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SPOT_NOT_FOUND"));
    }

    @Test
    void startSpotIsAlwaysFirstEvenIfAnotherSpotHasBonus() throws Exception {
        // 임시정부기념관(0.19km)은 음성 안내 가산점이 있지만, 출발지 서대문형무소역사관이 먼저다
        mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON).content("""
                {"userTypes":["VISUAL"],"eraId":"OPENING_COLONIAL","start":{"spotId":"SDM09"}}
                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stops[0].spot.id").value("SDM09"))
                .andExpect(jsonPath("$.stops[0].distanceFromPrevKm").value(0.0));
    }

    @Test
    void visualUserSeesPreferredFeatureEvidence() throws Exception {
        // 시각장애인 유형은 필수 항목이 없어도 음성 안내 근거를 메모로 받아야 한다
        mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON).content("""
                {"userTypes":["VISUAL"],"eraId":"JOSEON","start":{"spotId":"JNG23"},"stopCount":3}
                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stops[0].spot.id").value("JNG23"))
                .andExpect(jsonPath("$.stops[0].accessMemo").value(org.hamcrest.Matchers.containsString("음성 안내")));
    }

    @Test
    void newsArticlesAreServedAndRemovedSpotsAreGone() throws Exception {
        mvc.perform(get("/api/spots/SDM01"))
                .andExpect(jsonPath("$.articles", hasSize(1)))
                .andExpect(jsonPath("$.articles[0].eventDate").value("1991년 5월 15일 · 서울"))
                .andExpect(jsonPath("$.articles[0].headline").value("고 강경대 군 영결식, 노제는 끝내 무산"))
                .andExpect(jsonPath("$.articles[0].reconstructed").value(true));
        mvc.perform(get("/api/spots/SDM01/articles")).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/spots").param("eraId", "MODERN"))
                .andExpect(jsonPath("$[*].hasArticle", everyItem(is(true))));
        // 삭제한 장소와, 장소가 모두 사라진 연결은 조회되지 않는다
        mvc.perform(get("/api/spots/EPY04")).andExpect(status().isNotFound());
        mvc.perform(get("/api/cross-links/X8")).andExpect(status().isNotFound());
    }

    @Test
    void crossLinks() throws Exception {
        mvc.perform(get("/api/cross-links")).andExpect(jsonPath("$", hasSize(7)));
        mvc.perform(get("/api/cross-links").param("spotId", "SDM09"))
                .andExpect(jsonPath("$[*].id", is(java.util.List.of("X4", "X5"))));
        mvc.perform(get("/api/cross-links/X2")).andExpect(jsonPath("$.spots", hasSize(3)));
    }

    @Test
    void wheelchairCourseExcludesMountainBeacon() throws Exception {
        mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON).content("""
                {"userTypes":["WHEELCHAIR"],"eraId":"JOSEON","start":{"spotId":"SDM10"},"stopCount":4}
                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").doesNotExist())
                .andExpect(jsonPath("$.stops", hasSize(4)))
                .andExpect(jsonPath("$.stops[0].spot.id").value("SDM10"))
                .andExpect(jsonPath("$.stops[0].distanceFromPrevKm").value(0.0))
                .andExpect(jsonPath("$.stops[0].unknownFeatures[0]").value("ACCESS_ROUTE"))
                .andExpect(jsonPath("$.stops[0].crossLinkId").value("X3"))
                .andExpect(jsonPath("$.stops[*].spot.id", not(hasItem("SDM07"))))
                .andExpect(jsonPath("$.excluded[*].spotId", org.hamcrest.Matchers.containsInAnyOrder("SDM07", "EPY02")))
                .andExpect(jsonPath("$.warnings[0]").value(notNullValue()));

        // without wheelchair needs the beacon is not excluded
        mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON).content("""
                {"userTypes":[],"eraId":"JOSEON","start":{"latitude":37.5745,"longitude":126.9478}}
                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stops[0].spot.id").value("SDM07"))
                .andExpect(jsonPath("$.excluded", hasSize(0)));
    }

    @Test
    void sessionStoresStateAndCurrentCourse() throws Exception {
        String created = mvc.perform(post("/api/chat/sessions").contentType(MediaType.APPLICATION_JSON).content("""
                {"userTypes":["STROLLER","ELDERLY"],"kContentId":5,"startSpotId":"SDM01","startLabel":"명지대 학생회관"}
                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.eraId").value("MODERN"))
                .andExpect(jsonPath("$.userTypes", is(java.util.List.of("ELDERLY", "STROLLER"))))
                .andReturn().getResponse().getContentAsString();
        String sessionId = JsonPath.read(created, "$.id");

        String course = mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"" + sessionId + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(notNullValue()))
                .andExpect(jsonPath("$.eraIds[0]").value("MODERN"))
                .andExpect(jsonPath("$.startLabel").value("명지대 학생회관"))
                .andExpect(jsonPath("$.reason").value(org.hamcrest.Matchers.containsString("「1987」")))
                .andReturn().getResponse().getContentAsString();
        Integer courseId = JsonPath.read(course, "$.id");

        mvc.perform(get("/api/chat/sessions/" + sessionId))
                .andExpect(jsonPath("$.currentCourseId").value(courseId));
        mvc.perform(get("/api/courses/" + courseId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(courseId))
                .andExpect(jsonPath("$.stops[0].spot.id").value((String) JsonPath.read(course, "$.stops[0].spot.id")));

        mvc.perform(patch("/api/chat/sessions/" + sessionId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userTypes\":[\"WHEELCHAIR\"],\"timeBudgetMin\":200}"))
                .andExpect(jsonPath("$.userTypes", is(java.util.List.of("WHEELCHAIR"))))
                .andExpect(jsonPath("$.timeBudgetMin").value(200))
                .andExpect(jsonPath("$.eraId").value("MODERN"));
    }

    @Test
    void errors() throws Exception {
        mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"start\":{\"spotId\":\"SDM10\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eraId\":\"JOSEON\",\"start\":{\"spotId\":\"EPY01\"}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eraId\":\"JOSEON\",\"userTypes\":[\"ROBOT\"],\"start\":{\"spotId\":\"SDM10\"}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/chat/sessions/00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
        mvc.perform(get("/api/courses/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
    }
}
