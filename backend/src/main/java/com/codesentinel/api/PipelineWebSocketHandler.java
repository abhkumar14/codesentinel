package com.codesentinel.api;

import com.codesentinel.core.WebSocketManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * PipelineWebSocketHandler — each client connects to /ws/{sessionId}.
 * The session ID is embedded in the URI path.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PipelineWebSocketHandler extends TextWebSocketHandler {

    private final WebSocketManager wsManager;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String sessionId = extractSessionId(session);
        wsManager.register(sessionId, session);
        log.debug("WS connected: sessionId={} wsId={}", sessionId, session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = extractSessionId(session);
        wsManager.deregister(sessionId, session);
        log.debug("WS closed: sessionId={} status={}", sessionId, status);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Keep-alive pings — no action needed
    }

    private String extractSessionId(WebSocketSession session) {
        // URI: /ws/{sessionId}
        String path = session.getUri().getPath();
        return path.substring(path.lastIndexOf('/') + 1);
    }
}
