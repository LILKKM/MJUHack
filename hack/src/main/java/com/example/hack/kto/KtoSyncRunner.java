package com.example.hack.kto;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

/**
 * 실행 인자 {@code --kto.sync=단계[,단계]} 가 있으면 수집을 하고 프로그램을 끝낸다.
 *
 * <pre>
 * ./gradlew bootRun --args="--spring.main.web-application-type=none --kto.sync=all"
 * </pre>
 *
 * 단계: places, match, barrier-free, apply, all (= 네 단계 순서대로). refresh 를 붙이면 받은 상세도 다시 받는다.
 */
@Component
public class KtoSyncRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(KtoSyncRunner.class);

    private final KtoSyncService sync;
    private final KtoClient client;
    private final ConfigurableApplicationContext context;

    public KtoSyncRunner(KtoSyncService sync, KtoClient client, ConfigurableApplicationContext context) {
        this.sync = sync;
        this.client = client;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> values = args.getOptionValues("kto.sync");
        if (values == null || values.isEmpty()) {
            return;
        }
        List<String> steps = values.stream().flatMap(v -> List.of(v.split(",")).stream()).map(String::trim).toList();
        boolean all = steps.contains("all");
        int exit = 0;
        try {
            if (all || steps.contains("places")) {
                sync.syncPlaces();
            }
            if (all || steps.contains("match")) {
                sync.matchSpots();
            }
            if (all || steps.contains("barrier-free")) {
                sync.fetchBarrierFree(steps.contains("refresh"));
            }
            if (all || steps.contains("apply")) {
                sync.applyBarrierFree();
            }
        } catch (KtoException e) {
            log.error("[kto] 중단: {}", e.getMessage());
            exit = 1;
        } finally {
            log.info("[kto] 이번 실행 API 호출 {}건", client.callCount());
        }
        final int code = exit;
        System.exit(SpringApplication.exit(context, () -> code));
    }
}
