package com.example.hack.chat;

import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;

/** Claude 호출 한 번. 테스트에서는 가짜 응답으로 바꾼다. */
public interface ClaudeGateway {

    Message create(MessageCreateParams params);
}
