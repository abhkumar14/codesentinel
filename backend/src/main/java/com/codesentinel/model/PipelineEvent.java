package com.codesentinel.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PipelineEvent {
    private String type; // agent_start | agent_token | agent_complete | agent_error | pipeline_complete
                         // | pipeline_status
    private String agent;
    private String phase;
    private String token;
    private AgentResult result;
    private String error;
    private String status;
    private String message;
    private FinalReport report;

    // ── Factory helpers ────────────────────────────────────────────────────────

    public static PipelineEvent agentStart(String agent, String phase) {
        return PipelineEvent.builder().type("agent_start").agent(agent).phase(phase).build();
    }

    public static PipelineEvent agentToken(String agent, String token) {
        return PipelineEvent.builder().type("agent_token").agent(agent).token(token).build();
    }

    public static PipelineEvent agentComplete(String agent, AgentResult result) {
        return PipelineEvent.builder().type("agent_complete").agent(agent).result(result).build();
    }

    public static PipelineEvent agentError(String agent, String error) {
        return PipelineEvent.builder().type("agent_error").agent(agent).error(error).build();
    }

    public static PipelineEvent pipelineStatus(String status, String message) {
        return PipelineEvent.builder().type("pipeline_status").status(status).message(message).build();
    }

    public static PipelineEvent pipelineComplete(FinalReport report) {
        return PipelineEvent.builder().type("pipeline_complete").report(report).build();
    }
}
