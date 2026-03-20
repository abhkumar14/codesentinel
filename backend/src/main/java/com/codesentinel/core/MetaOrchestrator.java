package com.codesentinel.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class MetaOrchestrator {

    private final OllamaApi ollamaApi;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final String META_MODEL = "llama3";

    public String detectLanguage(String code) {
        String prompt = """
                Identify the programming language of this code snippet.
                Return ONLY a single lowercase word (e.g. python, javascript, java, go, rust).
                No explanation.

                CODE:
                ```
                %s
                ```
                """.formatted(code.substring(0, Math.min(code.length(), 500)));
        try {
            String response = ChatClient.create(buildModel(META_MODEL, 64)).prompt().user(prompt).call().content();
            String lang = response == null ? "" : response.trim().toLowerCase().split("\\s+")[0];
            log.debug("Detected language: {}", lang);
            return lang.isEmpty() ? "unknown" : lang;
        } catch (Exception e) {
            log.warn("Language detection failed: {} — defaulting to 'unknown'", e.getMessage());
            return "unknown";
        }
    }

    public List<String> decideAgents(String code, String language, List<String> availableAgents) {
        String agentList = String.join(", ", availableAgents);
        String prompt = """
                You are a meta-orchestration agent for a code review system.
                Given this %s code snippet, decide which specialised review agents should run.

                AVAILABLE AGENTS: %s

                GUIDELINES:
                - Always include: syntax_checker, style_linter
                - Include sast_scanner if any user input, DB queries, file ops, or network calls exist
                - Include dast_scanner if web endpoints, APIs, or form handlers exist
                - Include pentest_agent if authentication, sensitive data, or admin features exist
                - Include dependency_auditor if there are imports
                - Always include: summarizer, human_reviewer, report_generator

                CODE (first 800 chars):
                ```
                %s
                ```

                Return ONLY a JSON array of agent names: ["agent1", "agent2", ...]
                """.formatted(language, agentList, code.substring(0, Math.min(code.length(), 800)));
        try {
            String response = ChatClient.create(buildModel(META_MODEL, 512)).prompt().user(prompt).call().content();
            if (response == null)
                return availableAgents;
            int start = response.indexOf('[');
            int end = response.lastIndexOf(']') + 1;
            if (start >= 0 && end > start) {
                String[] selected = objectMapper.readValue(response.substring(start, end), String[].class);
                List<String> validated = Arrays.stream(selected).filter(availableAgents::contains).toList();
                if (!validated.isEmpty()) {
                    log.debug("Meta-agent selected {} agents: {}", validated.size(), validated);
                    return validated;
                }
            }
        } catch (Exception e) {
            log.warn("Meta-agent decision failed: {} — running all agents", e.getMessage());
        }
        return availableAgents;
    }

    // ── Correct Spring AI M1 API ──────────────────────────────────────────────
    private OllamaChatModel buildModel(String model, int numPredict) {
        OllamaOptions options = OllamaOptions.create().withModel(model).withTemperature(0.1f)
                .withNumPredict(numPredict);
        return new OllamaChatModel(ollamaApi, options);
    }
}
