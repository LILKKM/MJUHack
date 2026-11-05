package com.example.hack.chat;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.hack.chat.ChatDtos.ChatReply;
import com.example.hack.chat.ChatDtos.ChatRequest;
import com.example.hack.chat.ChatDtos.MessageResponse;
import com.example.hack.chat.ChatDtos.RecommendRequest;
import com.example.hack.common.ApiException;
import com.example.hack.session.SessionService;

@RestController
public class ChatController {

    private final ChatService chat;
    private final SessionService sessions;

    public ChatController(ChatService chat, SessionService sessions) {
        this.chat = chat;
        this.sessions = sessions;
    }

    @GetMapping("/api/chat/sessions/{sessionId}/messages")
    public List<MessageResponse> messages(@PathVariable String sessionId) {
        return chat.messages(sessionId);
    }

    @PostMapping("/api/chat/sessions/{sessionId}/messages")
    public ChatReply send(@PathVariable String sessionId, @RequestBody ChatRequest request) {
        return chat.send(sessionId, request.content(), request.location());
    }

    /** 자유 문장으로 받은 사용자 맥락으로 코스를 추천한다. 세션이 없으면 만든다. 이후 대화는 같은 세션으로 이어간다. */
    @PostMapping("/api/courses/recommend")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatReply recommend(@RequestBody RecommendRequest request) {
        if (request.context() == null || request.context().isBlank()) {
            throw ApiException.badRequest("context 에 조건을 적어 주세요.");
        }
        String sessionId = request.sessionId() != null ? request.sessionId() : sessions.create(null).id();
        return chat.send(sessionId, request.context(), request.location());
    }
}
