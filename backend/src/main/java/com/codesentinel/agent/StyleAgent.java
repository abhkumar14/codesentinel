package com.codesentinel.agent;

import org.springframework.ai.ollama.api.OllamaApi;

public class StyleAgent extends BaseAgent {

    public StyleAgent(OllamaApi ollamaApi, String model) {
        super("style_linter", model,
              "Checks code style, naming conventions, complexity, and maintainability.",
              ollamaApi);
    }

    @Override
    public String buildPrompt(String code, String language) {
        return """
                You are a senior software engineer and code quality expert specialising in %s.
                Analyse this code for style, readability, and maintainability.

                CHECK FOR:
                1. Naming conventions (variables, functions, classes)
                2. Function/method length (> 30 lines is a smell)
                3. Cyclomatic complexity (deeply nested conditions)
                4. DRY violations (repeated logic)
                5. SOLID principle violations
                6. Magic numbers/strings (should be named constants)
                7. Comment quality (missing, outdated, or redundant)
                8. Dead code (unused imports, variables, functions)
                9. Error handling patterns (swallowed exceptions)
                10. God functions / God classes

                Respond in this exact JSON format:
                {
                  "severity": "low|medium|high",
                  "maintainability_index": <0-100>,
                  "cyclomatic_complexity": <number>,
                  "issues": [
                    {
                      "line": <int or null>,
                      "rule": "<rule name>",
                      "severity": "info|warning|error",
                      "message": "<description>",
                      "before": "<problematic snippet>",
                      "after": "<suggested improvement>"
                    }
                  ],
                  "metrics": {
                    "lines_of_code": <int>,
                    "comment_ratio": "<percentage>",
                    "avg_function_length": <int>,
                    "duplication_percentage": "<percentage>"
                  },
                  "summary": "<overall assessment>",
                  "top_recommendations": ["<top 3-5 improvements>"]
                }

                CODE TO ANALYSE (%s):
                ```
                %s
                ```
                Return ONLY the JSON.
                """.formatted(language, language, code);
    }
}
