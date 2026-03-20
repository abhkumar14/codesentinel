package com.codesentinel.agent;

import org.springframework.ai.ollama.api.OllamaApi;

public class DependencyAgent extends BaseAgent {

    public DependencyAgent(OllamaApi ollamaApi, String model) {
        super("dependency_auditor", model,
              "Audits imports and dependencies for known vulnerabilities and supply-chain risks.",
              ollamaApi);
    }

    @Override
    public String buildPrompt(String code, String language) {
        return """
                You are a software supply-chain security expert.
                Analyse the imports, dependencies, and third-party library usage in this %s code.

                CHECK FOR:
                1. Known vulnerable library versions
                2. Deprecated or unmaintained packages
                3. Suspicious or unusual imports
                4. Unnecessary dependencies
                5. Typosquatting risks
                6. License compatibility issues
                7. Transitive dependency risks

                Respond in this exact JSON format:
                {
                  "dependencies_found": ["<package name>"],
                  "risk_level": "low|medium|high|critical",
                  "findings": [
                    {
                      "package": "<name>",
                      "version_specified": "<version or not pinned>",
                      "risk": "safe|low|medium|high|critical",
                      "issue": "<description>",
                      "cve": "<CVE if known>",
                      "recommendation": "<upgrade to X or replace with Y>"
                    }
                  ],
                  "missing_dependencies": ["<used but not imported>"],
                  "supply_chain_score": <0-100>,
                  "summary": "<overall dependency health>"
                }

                CODE TO ANALYSE (%s):
                ```
                %s
                ```
                Return ONLY the JSON.
                """.formatted(language, language, code);
    }
}
