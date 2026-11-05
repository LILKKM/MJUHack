package com.example.hack.kto;

import java.util.List;
import java.util.Optional;

import tools.jackson.databind.JsonNode;

/** 관광공사 KorWithService2 호출. 테스트에서는 가짜 구현으로 바꾼다. */
public interface KtoClient {

    /** 한 페이지 결과. {@code items} 는 응답의 response.body.items.item 배열. */
    record Page(List<JsonNode> items, int totalCount) {
    }

    /** areaBasedList2: 법정동 시군구 코드로 무장애 관광정보 목록을 가져온다. */
    Page areaBasedList(String lDongRegnCd, String lDongSignguCd, int pageNo, int numOfRows);

    /** detailWithTour2: 무장애 상세. 데이터가 없으면 empty. */
    Optional<JsonNode> detailWithTour(String contentId);

    /** 이번 실행에서 호출한 횟수. */
    int callCount();
}
