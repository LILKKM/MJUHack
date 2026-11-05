package com.example.hack.kto;

import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 한국관광공사 무장애 여행정보 API 설정.
 *
 * @param serviceKey      공공데이터포털 서비스 키 (Decoding 키). 환경변수 KTO_SERVICE_KEY 로 넣는다.
 * @param baseUrl         KorWithService2 기본 주소
 * @param mobileApp       MobileApp 파라미터 (서비스명)
 * @param maxCalls        한 번 실행할 때 쓸 최대 호출 수 (개발계정 하루 1,000건)
 * @param lDongRegnCd     법정동 시도 코드 (서울 11)
 * @param signguDistricts 법정동 시군구 코드 → 내부 구 ID
 */
@ConfigurationProperties(prefix = "kto")
public record KtoProperties(
        String serviceKey,
        String baseUrl,
        String mobileApp,
        int maxCalls,
        String lDongRegnCd,
        Map<String, String> signguDistricts) {

    public boolean hasKey() {
        return serviceKey != null && !serviceKey.isBlank();
    }
}
