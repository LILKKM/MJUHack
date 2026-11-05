package com.example.hack.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.errors.AnthropicException;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.example.hack.common.ApiException;

/** 공식 SDK 호출. 키가 없어도 서버는 뜨고, 챗봇을 부를 때만 안내 오류를 낸다. */
@Component
public class AnthropicClaudeGateway implements ClaudeGateway {

    private static final Logger log = LoggerFactory.getLogger(AnthropicClaudeGateway.class);

    private volatile AnthropicClient client;

    @Override
    public Message create(MessageCreateParams params) {
        try {
            return client().messages().create(params);
        } catch (UnauthorizedException | PermissionDeniedException e) {
            throw notConfigured();
        } catch (RateLimitException e) {
            log.warn("Claude rate limited: {}", e.getMessage());
            throw unavailable("요청이 많아 잠시 응답할 수 없습니다. 조금 뒤 다시 시도해 주세요.");
        } catch (AnthropicServiceException e) {
            log.error("Claude API error {}: {}", e.statusCode(), e.getMessage());
            throw unavailable("AI 응답을 받지 못했습니다. 코스와 장소 정보는 그대로 볼 수 있습니다.");
        } catch (AnthropicIoException e) {
            log.error("Claude connection error: {}", e.getMessage());
            throw unavailable("AI 서버에 연결하지 못했습니다. 코스와 장소 정보는 그대로 볼 수 있습니다.");
        } catch (AnthropicException e) {
            log.error("Claude client error: {}", e.getMessage());
            throw notConfigured();
        }
    }

    private AnthropicClient client() {
        if (client == null) {
            synchronized (this) {
                if (client == null) {
                    client = AnthropicOkHttpClient.fromEnv();
                }
            }
        }
        return client;
    }

    private static ApiException notConfigured() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "LLM_NOT_CONFIGURED",
                "Claude API 키가 설정되지 않았습니다. 환경변수 ANTHROPIC_API_KEY 를 확인하세요.");
    }

    private static ApiException unavailable(String message) {
        return new ApiException(HttpStatus.BAD_GATEWAY, "LLM_UNAVAILABLE", message);
    }
}
