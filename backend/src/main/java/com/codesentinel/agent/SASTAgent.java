package com.codesentinel.agent;

import org.springframework.ai.ollama.api.OllamaApi;

public class SASTAgent extends BaseAgent {

    public SASTAgent(OllamaApi ollamaApi, String model) {
        super("sast_scanner", model,
              "Static Application Security Testing — finds vulnerabilities in source code without execution.",
              ollamaApi);
    }

    @Override
    public String buildPrompt(String code, String language) {
        return """
                You are a senior application security engineer specialising in SAST (Static Application Security Testing).
                Perform a comprehensive static security analysis of the following %s code.

                Check for ALL of the following vulnerability classes:
                1. Injection flaws (SQL, NoSQL, Command, LDAP injection)
                2. Broken authentication (hardcoded credentials, weak session management)
                3. Sensitive data exposure (API keys, passwords, PII in logs)
                4. XML External Entities (XXE)
                5. Broken Access Control (missing authz checks)
                6. Security misconfiguration (debug modes, default creds)
                7. Cross-Site Scripting (XSS)
                8. Insecure Deserialization
                9. Using components with known vulnerabilities
                10. Insufficient logging and monitoring
                11. Server-Side Request Forgery (SSRF)
                12. Cryptographic failures (weak algorithms, improper key management)
                13. Race conditions and TOCTOU vulnerabilities
                14. Path traversal

                Respond in this exact JSON format:
                {
                  "severity": "low|medium|high|critical",
                  "cve_relevant": ["CVE-XXXX-XXXX"],
                  "owasp_categories": ["A01:2021"],
                  "vulnerabilities": [
                    {
                      "id": "SAST-001",
                      "line": <int or null>,
                      "cwe": "<CWE-ID>",
                      "owasp": "<category>",
                      "severity": "info|low|medium|high|critical",
                      "title": "<short title>",
                      "description": "<detailed description>",
                      "exploit_scenario": "<how attacker exploits this>",
                      "remediation": "<specific fix>"
                    }
                  ],
                  "secure_coding_score": <0-100>,
                  "summary": "<comprehensive paragraph>",
                  "positive_findings": ["<things done well>"]
                }

                CODE TO ANALYSE (%s):
                ```
                %s
                ```
                Return ONLY the JSON.
                """.formatted(language, language, code);
    }
}
