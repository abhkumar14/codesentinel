package com.codesentinel.agent;

import com.codesentinel.model.AgentResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.api.OllamaApi;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
public class ReportAgent extends BaseAgent {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final Map<String, String[]> SCORE_FIELD_MAP = Map.of(
      "syntax_checker", new String[] { "syntax", "score" },
      "sast_scanner", new String[] { "security", "secure_coding_score" },
      "dast_scanner", new String[] { "security", "runtime_score" },
      "pentest_agent", new String[] { "security", "pentest_score" },
      "style_linter", new String[] { "style", "maintainability_index" },
      "dependency_auditor", new String[] { "dependencies", "supply_chain_score" },
      "summarizer", new String[] { "overall", "overall_score" },
      "human_reviewer", new String[] { "testability", "testability_score" });

  public ReportAgent(OllamaApi ollamaApi, String model) {
    super("report_generator", model,
        "Generates a final structured, executive-ready report from all agent findings.",
        ollamaApi);
  }

  @Override
  public String buildPrompt(String code, String language) {
    return "";
  }

  @Override
  public AgentResult runWithContext(String code, String language, List<AgentResult> findings) {
    String findingsText = findings.stream()
        .filter(f -> !"report_generator".equals(f.getAgent()))
        .map(f -> "=== " + f.getAgent().toUpperCase() + " ===\n" + truncate(f.getResult(), 1500))
        .collect(Collectors.joining("\n\n"));

    String agentNames = findings.stream()
        .map(f -> "\"" + f.getAgent() + "\"")
        .collect(Collectors.joining(", ", "[", "]"));

    String prompt = buildReportPrompt(language, agentNames, findingsText);
    StringBuilder sb = new StringBuilder();

    try {
      ChatClient.create(buildChatModel(0.1, 3000))
          .prompt().user(prompt)
          .stream().content()
          .toIterable().forEach(sb::append);

      String result = repairAndEnrich(sb.toString().trim(), findings, language, agentNames);
      return AgentResult.builder().agent(name).model(model).result(result).status("complete").build();

    } catch (Exception e) {
      log.error("[report_generator] Error: {}", e.getMessage(), e);
      String fallback = buildFallbackReport(language, agentNames, findings, e.getMessage());
      return AgentResult.builder().agent(name).model(model).result(fallback).status("complete").build();
    }
  }

  private String buildReportPrompt(String language, String agentNames, String findingsText) {
    return """
        You are a technical report writer. Create a final code review report.

        IMPORTANT RULES:
        - Return ONLY raw JSON — no markdown fences, no preamble, no explanation
        - Every field is REQUIRED — use 0 for unknown numbers, empty arrays for unknown lists

        Agent findings:
        %s

        Return this EXACT JSON (fill with REAL values from findings):
        {
          "report_metadata": {
            "language": "%s",
            "lines_of_code": 0,
            "agents_run": %s,
            "overall_risk": "medium",
            "overall_score": 60
          },
          "executive_summary": "Brief summary of code quality and security posture.",
          "scorecard": {
            "syntax": 75,
            "security": 50,
            "style": 70,
            "dependencies": 80,
            "testability": 60,
            "overall": 67
          },
          "action_items": {
            "immediate": [{"id": "ACT-001", "title": "Fix critical issues", "owner": "developer", "effort": "days"}],
            "this_sprint": [],
            "backlog": []
          },
          "risk_register": [
            {"risk_id": "RISK-001", "title": "Security vulnerabilities", "likelihood": "high", "impact": "high", "rating": "critical", "mitigation": "Address SAST findings"}
          ],
          "compliance_notes": {
            "owasp_top_10": "Multiple OWASP Top 10 violations found",
            "gdpr_relevant": false,
            "pci_dss_relevant": false,
            "notes": ""
          },
          "positive_highlights": ["Code is functional"],
          "conclusion": "Address the identified issues prioritised by severity."
        }
        Return ONLY JSON. No markdown, no explanation.
        """
        .formatted(truncate(findingsText, 6000), language, agentNames);
  }

  private String repairAndEnrich(String raw, List<AgentResult> findings,
      String language, String agentNames) {
    JsonNode node = extractJson(raw);
    if (node == null || !node.isObject()) {
      log.warn("[report_generator] Unparseable JSON — using fallback");
      return buildFallbackReport(language, agentNames, findings, "LLM returned unparseable output");
    }

    ObjectNode obj = (ObjectNode) node;
    JsonNode sc = obj.get("scorecard");
    if (sc == null || !sc.isObject() || allZeroOrMissing(sc)) {
      obj.set("scorecard", buildFallbackScorecard(findings));
    } else {
      ObjectNode scObj = (ObjectNode) sc;
      for (String cat : List.of("syntax", "security", "style", "dependencies", "testability", "overall")) {
        if (!scObj.has(cat))
          scObj.put(cat, 0);
      }
    }

    if (!obj.has("executive_summary") || obj.get("executive_summary").asText().isBlank()) {
      obj.put("executive_summary", "Analysis complete. See scorecard and agent findings for details.");
    }

    try {
      return MAPPER.writeValueAsString(obj);
    } catch (Exception e) {
      return raw;
    }
  }

  private ObjectNode buildFallbackScorecard(List<AgentResult> findings) {
    Map<String, Integer> scores = new LinkedHashMap<>();
    for (AgentResult finding : findings) {
      String[] mapping = SCORE_FIELD_MAP.get(finding.getAgent());
      if (mapping == null)
        continue;
      JsonNode parsed = extractJson(finding.getResult());
      if (parsed == null)
        continue;
      JsonNode valNode = parsed.get(mapping[1]);
      if (valNode == null || valNode.isNull())
        continue;
      try {
        double num = valNode.asDouble();
        if ("testability_score".equals(mapping[1]))
          num = num * 10;
        scores.merge(mapping[0], (int) Math.min(100, Math.max(0, Math.round(num))), Math::max);
      } catch (Exception ignored) {
      }
    }
    if (!scores.isEmpty() && !scores.containsKey("overall")) {
      scores.put("overall", (int) scores.values().stream().mapToInt(Integer::intValue).average().orElse(0));
    }
    ObjectNode sc = MAPPER.createObjectNode();
    for (String cat : List.of("syntax", "security", "style", "dependencies", "testability", "overall")) {
      sc.put(cat, scores.getOrDefault(cat, 0));
    }
    return sc;
  }

  private String buildFallbackReport(String language, String agentNames,
      List<AgentResult> findings, String errorMsg) {
    ObjectNode report = MAPPER.createObjectNode();
    ObjectNode meta = MAPPER.createObjectNode();
    meta.put("language", language);
    meta.put("lines_of_code", 0);
    meta.put("overall_risk", "unknown");
    meta.put("overall_score", 0);
    report.set("report_metadata", meta);
    report.put("executive_summary", "Report generation issue: " + errorMsg + ". Scorecard derived from agent outputs.");
    report.set("scorecard", buildFallbackScorecard(findings));
    ObjectNode actions = MAPPER.createObjectNode();
    actions.set("immediate", MAPPER.createArrayNode());
    actions.set("this_sprint", MAPPER.createArrayNode());
    actions.set("backlog", MAPPER.createArrayNode());
    report.set("action_items", actions);
    report.set("risk_register", MAPPER.createArrayNode());
    ObjectNode compliance = MAPPER.createObjectNode();
    compliance.put("owasp_top_10", "");
    compliance.put("gdpr_relevant", false);
    compliance.put("pci_dss_relevant", false);
    compliance.put("notes", "");
    report.set("compliance_notes", compliance);
    report.set("positive_highlights", MAPPER.createArrayNode());
    report.put("conclusion", "Review individual agent findings above for detailed analysis.");
    try {
      return MAPPER.writeValueAsString(report);
    } catch (Exception e) {
      return "{\"error\":\"failed\"}";
    }
  }

  private JsonNode extractJson(String raw) {
    if (raw == null || raw.isBlank())
      return null;
    String s = raw.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
    int start = s.indexOf('{');
    if (start == -1)
      return null;
    int depth = 0, end = -1;
    for (int i = start; i < s.length(); i++) {
      char ch = s.charAt(i);
      if (ch == '{')
        depth++;
      else if (ch == '}') {
        depth--;
        if (depth == 0) {
          end = i;
          break;
        }
      }
    }
    String jsonStr = (end != -1) ? s.substring(start, end + 1) : s.substring(start);
    try {
      return MAPPER.readTree(jsonStr);
    } catch (Exception e) {
      try {
        long opens = jsonStr.chars().filter(c -> c == '{').count();
        long closes = jsonStr.chars().filter(c -> c == '}').count();
        return MAPPER.readTree(jsonStr + "}".repeat((int) Math.max(0, opens - closes)));
      } catch (Exception ignored) {
        return null;
      }
    }
  }

  private boolean allZeroOrMissing(JsonNode sc) {
    Iterator<JsonNode> vals = sc.elements();
    while (vals.hasNext()) {
      if (vals.next().asInt() != 0)
        return false;
    }
    return true;
  }

  private String truncate(String s, int max) {
    return (s == null || s.length() <= max) ? (s == null ? "" : s) : s.substring(0, max) + "...[truncated]";
  }
}
