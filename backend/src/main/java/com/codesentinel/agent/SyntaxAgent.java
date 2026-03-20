package com.codesentinel.agent;

import org.springframework.ai.ollama.api.OllamaApi;

public class SyntaxAgent extends BaseAgent {

    public SyntaxAgent(OllamaApi ollamaApi, String model) {
        super("syntax_checker", model,
              "Detects syntax errors, undefined variables, type mismatches, and AST-level issues.",
              ollamaApi);
    }

    @Override
    public String buildPrompt(String code, String language) {
        return """
                You are an expert %s compiler and static syntax analyser.
                Analyse the following code ONLY for syntax and structural issues:
                - Syntax errors (missing brackets, wrong indentation, bad tokens)
                - Undefined or shadowed variables
                - Type annotation mismatches
                - Unreachable code
                - Infinite loops / missing return statements

                Respond in this exact JSON format:
                {
                  "severity": "low|medium|high|critical",
                  "issues": [
                    {"line": <int>, "type": "<type>", "message": "<desc>", "suggestion": "<fix>"}
                  ],
                  "summary": "<one paragraph>",
                  "score": <0-100>
                }

                CODE TO ANALYSE (%s):
                ```
                %s
                ```
                Return ONLY the JSON. No markdown, no preamble.
                """.formatted(language, language, code);
    }
}
