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
        attachFileLog();
        log.info("[kto] 시작: {}", steps);
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
        } catch (RuntimeException e) {
            log.error("[kto] 중단(예상하지 못한 오류): {}", e.toString(), e);
            exit = 1;
        } finally {
            log.info("[kto] 이번 실행 API 호출 {}건. 로그 파일: {}", client.callCount(), LOG_FILE);
        }
        final int code = exit;
        System.exit(SpringApplication.exit(context, () -> code));
    }

    /** 수집 로그를 콘솔과 함께 hack/build/kto-sync.log 에도 남긴다 (실행할 때마다 새로 씀). */
    static final String LOG_FILE = "build/kto-sync.log";

    private static void attachFileLog() {
        if (!(LoggerFactory.getILoggerFactory() instanceof ch.qos.logback.classic.LoggerContext ctx)) {
            return;
        }
        var encoder = new ch.qos.logback.classic.encoder.PatternLayoutEncoder();
        encoder.setContext(ctx);
        encoder.setPattern("%d{HH:mm:ss.SSS} %-5level %msg%n");
        encoder.setCharset(java.nio.charset.StandardCharsets.UTF_8);
        encoder.start();
        var appender = new ch.qos.logback.core.FileAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.setContext(ctx);
        appender.setName("kto-sync-file");
        appender.setFile(LOG_FILE);
        appender.setAppend(false);
        appender.setEncoder(encoder);
        appender.start();
        ctx.getLogger("com.example.hack.kto").addAppender(appender);
    }
}
