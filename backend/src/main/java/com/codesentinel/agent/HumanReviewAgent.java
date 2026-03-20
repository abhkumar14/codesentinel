package com.codesentinel.agent;

import com.codesentinel.model.AgentResult;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.api.OllamaApi;

import java.util.List;

public class HumanReviewAgent extends BaseAgent {

        public HumanReviewAgent(OllamaApi ollamaApi, String model) {
                super("human_reviewer", model,
                                "Provides a senior engineer's comprehensive, opinionated code review.",
                                ollamaApi);
        }

        @Override
        public String buildPrompt(String code, String language) {
                return "";
        }

        @Override
        public AgentResult runWithContext(String code, String language, List<AgentResult> findings) {
                String securitySummary = findings.stream()
                                .filter(f -> "summarizer".equals(f.getAgent()))
                                .map(AgentResult::getResult)
                                .findFirst()
                                .orElse("No prior findings available");

                String prompt = """
                                You are a 15-year veteran senior engineer doing a thorough code review.
                                You are mentoring a junior-to-mid level engineer. Be human, opinionated, specific, and kind.

                                Previous automated analysis found:
                                %s

                                Now write YOUR review of this %s code:
                                ```
                                %s
                                ```

                                Respond in this JSON format:
                                {
                                  "verdict": "REQUEST_CHANGES|APPROVE_WITH_COMMENTS|APPROVE",
                                  "verdict_reason": "<one sentence>",
                                  "first_impressions": "<2-3 sentences, conversational>",
                                  "architecture_assessment": "<paragraph>",
                                  "praise": ["<specific genuine compliment>"],
                                  "critical_issues": [
                                    {
                                      "title": "<title>",
                                      "explanation": "<conversational explanation>",
                                      "line_reference": "<line or function>",
                                      "example_fix": "<code snippet>"
                                    }
                                  ],
                                  "significant_concerns": [
                                    {"title": "<title>", "explanation": "<explanation>", "priority": "high|medium"}
                                  ],
                                  "suggestions": ["<suggestion>"],
                                  "security_human_take": "<personal security assessment>",
                                  "testability_score": 5,
                                  "testability_comments": "<what tests are needed>",
                                  "mentoring_moment": {
                                    "topic": "<concept to learn>",
                                    "explanation": "<clear, kind explanation>",
                                    "resources": ["<book/docs>"]
                                  },
                                  "overall_human_score": 5,
                                  "closing_comment": "<encouraging closing remark>"
                                }
                                Return ONLY the JSON.
                                """
                                .formatted(
                                                securitySummary.substring(0, Math.min(securitySummary.length(), 2000)),
                                                language, code);

                StringBuilder sb = new StringBuilder();
                try {
                        ChatClient.create(buildChatModel(0.3, 4096))
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
