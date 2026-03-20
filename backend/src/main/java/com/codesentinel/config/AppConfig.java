package com.codesentinel.config;

import com.codesentinel.api.PipelineWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.util.concurrent.Executor;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class AppConfig implements WebSocketConfigurer {

    private final PipelineWebSocketHandler pipelineWebSocketHandler;

    // ── WebSocket ─────────────────────────────────────────────────────────────

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(pipelineWebSocketHandler, "/ws/*")
                .setAllowedOriginPatterns("http://localhost:*");
    }

    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(512 * 1024);   // 512 KB
        container.setMaxBinaryMessageBufferSize(512 * 1024);
        container.setMaxSessionIdleTimeout(300_000L);         // 5 min
        return container;
    }

    // ── Async executor (for @Async pipeline runs) ──────────────────────────────

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("pipeline-");
        executor.initialize();
        return executor;
    }
}
