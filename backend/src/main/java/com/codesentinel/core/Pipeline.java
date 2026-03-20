package com.codesentinel.core;

import com.codesentinel.agent.BaseAgent;
import com.codesentinel.model.AgentResult;
import com.codesentinel.model.FinalReport;
import com.codesentinel.model.PipelineEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Pipeline — UPDATED: added unitLabel overload for project scans. Drop-in
 * replacement for core/Pipeline.java
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Pipeline {

        private final AgentRegistry registry;
        private final WebSocketManager wsManager;
        private final MetaOrchestrator orchestrator;

        private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

        /** Convenience overload — used by single snippet analysis */
        @Async
        public void run(String code, String sessionId, List<String> requestedAgents) {
                run(code, sessionId, requestedAgents, "");
        }

        /** Full overload — used by both snippet and project scans */
        @Async
        public void run(String code, String sessionId, List<String> requestedAgents, String unitLabel) {
                try {
                        // ── 1. Language detection ─────────────────────────────────────────
                        broadcast(sessionId, PipelineEvent.pipelineStatus("detecting_language", unitLabel));
                        String language = orchestrator.detectLanguage(code);
                        broadcast(sessionId, PipelineEvent.pipelineStatus("language_detected", language));

                        // ── 2. Meta-agent agent selection ─────────────────────────────────
                        List<String> allAgentNames = registry.listAll().stream().filter(c -> c.isEnabled())
                                        .map(c -> c.getName()).collect(Collectors.toList());

                        List<String> selectedAgents = (requestedAgents != null && !requestedAgents.isEmpty())
                                        ? requestedAgents
                                        : orchestrator.decideAgents(code, language, allAgentNames);

                        broadcast(sessionId, PipelineEvent.pipelineStatus("agents_selected",
                                        String.join(", ", selectedAgents)));

                        // ── 3. Parallel phase ─────────────────────────────────────────────
                        List<BaseAgent> parallelAgents = registry.getAgentsByPhase("parallel").stream()
                                        .filter(a -> selectedAgents.contains(a.getName())).collect(Collectors.toList());

                        broadcast(sessionId, PipelineEvent.pipelineStatus("parallel_start",
                                        parallelAgents.size() + " agents"));

                        List<CompletableFuture<AgentResult>> futures = parallelAgents.stream()
                                        .map(agent -> CompletableFuture.supplyAsync(
                                                        () -> runAgentStreaming(agent, code, language, sessionId),
                                                        executor))
                                        .collect(Collectors.toList());

                        // ── 4. Barrier ────────────────────────────────────────────────────
                        List<AgentResult> parallelResults = futures.stream().map(CompletableFuture::join)
                                        .collect(Collectors.toList());

                        broadcast(sessionId, PipelineEvent.pipelineStatus("barrier_complete",
                                        parallelResults.size() + " finished"));

                        // ── 5. Sequential chain ───────────────────────────────────────────
                        List<AgentResult> allFindings = new ArrayList<>(parallelResults);

                        List<BaseAgent> sequentialAgents = registry.getAgentsByPhase("sequential").stream()
                                        .filter(a -> selectedAgents.contains(a.getName())).collect(Collectors.toList());

                        for (BaseAgent agent : sequentialAgents) {
                                broadcast(sessionId, PipelineEvent.agentStart(agent.getName(), "sequential"));
                                try {
                                        AgentResult result = agent.runWithContext(code, language, allFindings);
                                        allFindings.add(result);
                                        broadcast(sessionId, PipelineEvent.agentComplete(agent.getName(), result));
                                } catch (Exception e) {
                                        log.error("[{}] Sequential error: {}", agent.getName(), e.getMessage());
                                        AgentResult err = AgentResult.builder().agent(agent.getName())
                                                        .model(agent.getModel()).result("Error: " + e.getMessage())
                                                        .status("error").build();
                                        allFindings.add(err);
                                        broadcast(sessionId, PipelineEvent.agentError(agent.getName(), e.getMessage()));
                                }
                        }

                        // ── 6. Final report ───────────────────────────────────────────────
                        AgentResult finalReport = allFindings.stream()
                                        .filter(r -> "report_generator".equals(r.getAgent())).findFirst()
                                        .orElse(allFindings.get(allFindings.size() - 1));

                        FinalReport report = FinalReport.builder().language(language).selectedAgents(selectedAgents)
                                        .allFindings(allFindings).finalReport(finalReport).build();

                        broadcast(sessionId, PipelineEvent.pipelineComplete(report));
                        log.info("Pipeline complete — session={} unit={}", sessionId, unitLabel);

                } catch (Exception e) {
                        log.error("Pipeline failed: {}", e.getMessage(), e);
                        broadcast(sessionId, PipelineEvent.pipelineStatus("error", e.getMessage()));
                }
        }

        private AgentResult runAgentStreaming(BaseAgent agent, String code, String language, String sessionId) {
                broadcast(sessionId, PipelineEvent.agentStart(agent.getName(), "parallel"));
                StringBuilder fullOutput = new StringBuilder();
                try {
                        agent.streamRun(code, language).doOnNext(token -> {
                                fullOutput.append(token);
                                broadcast(sessionId, PipelineEvent.agentToken(agent.getName(), token));
                        }).blockLast();

                        AgentResult result = AgentResult.builder().agent(agent.getName()).model(agent.getModel())
                                        .result(fullOutput.toString().trim()).status("complete").build();
                        broadcast(sessionId, PipelineEvent.agentComplete(agent.getName(), result));
                        return result;
                } catch (Exception e) {
                        log.error("[{}] Streaming error: {}", agent.getName(), e.getMessage());
                        broadcast(sessionId, PipelineEvent.agentError(agent.getName(), e.getMessage()));
                        return AgentResult.builder().agent(agent.getName()).model(agent.getModel())
                                        .result("Error: " + e.getMessage()).status("error").build();
                }
        }

        private void broadcast(String sessionId, PipelineEvent event) {
                wsManager.broadcast(sessionId, event);
        }
}
