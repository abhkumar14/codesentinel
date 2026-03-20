package com.codesentinel.agent;

import com.codesentinel.model.AgentResult;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.api.OllamaApi;

import java.util.List;
import java.util.stream.Collectors;

public class SummarizerAgent extends BaseAgent {

    public SummarizerAgent(OllamaApi ollamaApi, String model) {
        super("summarizer", model,
                "Synthesises all parallel agent findings into a coherent, prioritised summary.",
                ollamaApi);
    }

    @Override
    public String buildPrompt(String code, String language) {
        return ""; // not used directly
    }

    @Override
    public AgentResult runWithContext(String code, String language, List<AgentResult> findings) {
        String findingsText = findings.stream()
                .map(f -> "=== " + f.getAgent().toUpperCase() + " ===\n" + f.getResult())
                .collect(Collectors.joining("\n\n"));

        String prompt = """
                You are a lead security architect and principal engineer.
                Synthesise these agent findings for %s code into a coherent, prioritised summary.

                AGENT FINDINGS:
                %s

                Respond in this exact JSON format:
                {
                  "overall_risk": "low|medium|high|critical",
                  "confidence": "low|medium|high",
                  "top_5_critical_issues": [
                    {
                      "rank": 1,
                      "title": "<title>",
                      "confirmed_by": ["<agent1>"],
                      "impact": "<impact>",
                      "urgency": "immediate|this_sprint|this_quarter|backlog"
                    }
                  ],
                  "risk_matrix": {
                    "syntax":       {"score": 80, "issues_count": 0},
                    "security_sast":{"score": 50, "issues_count": 3},
                    "security_dast":{"score": 60, "issues_count": 2},
                    "pentest":      {"score": 40, "issues_count": 2},
                    "style":        {"score": 70, "issues_count": 1},
                    "dependencies": {"score": 90, "issues_count": 0}
                  },
                  "cross_agent_patterns": ["<pattern>"],
                  "overall_score": 65,
                  "synthesis_narrative": "<2-3 paragraph assessment>"
                }
                Return ONLY the JSON.
                """.formatted(language, findingsText);

        StringBuilder sb = new StringBuilder();
        try {
            ChatClient.create(buildChatModel(0.2, 4096))
                    .prompt().user(prompt)
                    .stream().content()
                    .toIterable().forEach(sb::append);
            return AgentResult.builder()
                    .agent(name).model(model)
                    .result(sb.toString().trim()).status("complete").build();
        } catch (Exception e) {
            return AgentResult.builder()
                    .agent(name).model(model)
                    .result("Error: " + e.getMessage()).status("error").build();
        }
    }
}
