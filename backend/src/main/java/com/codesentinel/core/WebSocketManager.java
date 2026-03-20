package com.codesentinel.core;

import com.codesentinel.model.PipelineEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * WebSocketManager — keeps a registry of open sessions per pipeline session ID
 * and broadcasts PipelineEvent objects to all connected clients.
 */
@Slf4j
@Component
public class WebSocketManager {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // sessionId → list of WebSocket connections
    private final Map<String, CopyOnWriteArrayList<WebSocketSession>> connections =
            new ConcurrentHashMap<>();

    public void register(String sessionId, WebSocketSession ws) {
        connections.computeIfAbsent(sessionId, k -> new CopyOnWriteArrayList<>()).add(ws);
        log.debug("WS registered: sessionId={} wsId={}", sessionId, ws.getId());
    }

    public void deregister(String sessionId, WebSocketSession ws) {
        List<WebSocketSession> list = connections.get(sessionId);
        if (list != null) {
            list.remove(ws);
            if (list.isEmpty()) connections.remove(sessionId);
        }
    }

    public void broadcast(String sessionId, PipelineEvent event) {
        List<WebSocketSession> sessions = connections.get(sessionId);
        if (sessions == null || sessions.isEmpty()) return;

        String payload;
        try {
            payload = objectMapper.writeValueAsString(event);
        } catch (Exception e) {
            log.error("Failed to serialise event: {}", e.getMessage());
            return;
        }

        List<WebSocketSession> dead = new java.util.ArrayList<>();
        for (WebSocketSession ws : sessions) {
            if (ws.isOpen()) {
                try {
                    synchronized (ws) {
                        ws.sendMessage(new TextMessage(payload));
                    }
                } catch (IOException e) {
                    log.warn("Failed to send to WS {}: {}", ws.getId(), e.getMessage());
                    dead.add(ws);
                }
            } else {
                dead.add(ws);
            }
        }
        dead.forEach(ws -> deregister(sessionId, ws));
    }
}
