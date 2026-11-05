package com.example.hack.chat;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Claude 호출 설정. API 키는 여기 없다: SDK 가 환경변수 ANTHROPIC_API_KEY 에서 읽는다. */
@ConfigurationProperties(prefix = "claude")
public record ClaudeProperties(String model, String effort, long maxTokens, int maxToolRounds, int historyMessages) {
}
