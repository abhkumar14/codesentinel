package com.codesentinel.agent;

import com.codesentinel.model.AgentResult;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaOptions;
import reactor.core.publisher.Flux;

import java.util.List;

@Slf4j
@Getter
public abstract class BaseAgent {

    protected final String name;
    protected final String model;
    protected final String description;
    protected final OllamaApi ollamaApi;

    protected BaseAgent(String name, String model, String description, OllamaApi ollamaApi) {
        this.name = name;
        this.model = model;
        this.description = description;
        this.ollamaApi = ollamaApi;
    }

    public abstract String buildPrompt(String code, String language);

    protected OllamaChatModel buildChatModel(double temperature, int numPredict) {
        OllamaOptions options = OllamaOptions.create().withModel(model).withTemperature((float) temperature)
                .withNumPredict(numPredict);
        return new OllamaChatModel(ollamaApi, options);
    }

    /** Stream tokens — used by parallel agents for real-time WebSocket output. */
    public Flux<String> streamRun(String code, String language) {
        String prompt = buildPrompt(code, language);
        log.debug("[{}] Starting stream with model={}", name, model);
        return ChatClient.create(buildChatModel(0.2, 4096)).prompt().user(prompt).stream().content()
                .doOnError(e -> log.error("[{}] Stream error: {}", name, e.getMessage()));
    }

    /** Blocking run — collects full response (used for sequential agents). */
    public AgentResult run(String code, String language) {
        StringBuilder sb = new StringBuilder();
        try {
            streamRun(code, language).toIterable().forEach(sb::append);
            return AgentResult.builder().agent(name).model(model).result(sb.toString().trim()).status("complete")
                    .build();
        } catch (Exception e) {
            log.error("[{}] Run error: {}", name, e.getMessage());
            return AgentResult.builder().agent(name).model(model).result("Error: " + e.getMessage()).status("error")
                    .build();
        }
    }

    /** Sequential agents override this to use prior pipeline findings. */
    public AgentResult runWithContext(String code, String language, List<AgentResult> findings) {
        StringBuilder prior = new StringBuilder();
        for (AgentResult f : findings) {
            prior.append("\n\n=== ").append(f.getAgent().toUpperCase()).append(" ===\n").append(f.getResult());
        }
        String enriched = code + "\n\n--- PRIOR AGENT FINDINGS ---" + prior;
        return run(enriched, language);
    }
}
