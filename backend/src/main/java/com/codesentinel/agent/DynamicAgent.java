package com.codesentinel.agent;

import org.springframework.ai.ollama.api.OllamaApi;

/**
 * DynamicAgent — instantiated from registry config at runtime.
 * Uses a user-supplied prompt template with {code} and {language} placeholders.
 */
public class DynamicAgent extends BaseAgent {

    private final String promptTemplate;

    public DynamicAgent(String name, String promptTemplate, String model,
                        String description, OllamaApi ollamaApi) {
        super(name, model, description, ollamaApi);
        this.promptTemplate = promptTemplate;
    }

    @Override
    public String buildPrompt(String code, String language) {
        return promptTemplate
                .replace("{code}", code)
                .replace("{language}", language);
    }
}
