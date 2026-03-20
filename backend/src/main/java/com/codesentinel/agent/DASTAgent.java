package com.codesentinel.agent;

import org.springframework.ai.ollama.api.OllamaApi;

public class DASTAgent extends BaseAgent {

    public DASTAgent(OllamaApi ollamaApi, String model) {
        super("dast_scanner", model,
              "Dynamic Application Security Testing — simulates runtime attacks based on code structure.",
              ollamaApi);
    }

    @Override
    public String buildPrompt(String code, String language) {
        return """
                You are a DAST (Dynamic Application Security Testing) expert.
                You cannot execute the code, but SIMULATE what a DAST scanner would find at runtime.

                Analyse this %s code for:
                1. HTTP endpoints — what parameters are exposed and validated?
                2. Authentication flows — are tokens/sessions properly validated?
                3. Business logic flaws — can operations be bypassed or repeated?
                4. Input validation at runtime — what happens with malformed input?
                5. Error handling — do exceptions leak sensitive info?
                6. Rate limiting — are endpoints protected against brute force?
                7. Memory/resource exhaustion — unbound loops or allocations?

                Respond in this exact JSON format:
                {
                  "severity": "low|medium|high|critical",
                  "attack_surface": ["<exposed surface>"],
                  "dynamic_findings": [
                    {
                      "id": "DAST-001",
                      "attack_vector": "<how to attack>",
                      "endpoint_or_function": "<target>",
                      "severity": "info|low|medium|high|critical",
                      "title": "<title>",
                      "test_payload": "<example malicious input>",
                      "expected_impact": "<what happens>",
                      "remediation": "<fix>"
                    }
                  ],
                  "fuzzing_summary": "<what fuzzing would uncover>",
                  "runtime_score": <0-100>,
                  "summary": "<overall dynamic security assessment>"
                }

                CODE TO ANALYSE (%s):
                ```
                %s
                ```
                Return ONLY the JSON.
                """.formatted(language, language, code);
    }
}
