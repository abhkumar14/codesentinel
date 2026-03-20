package com.codesentinel.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// ── Agent registry entry ──────────────────────────────────────────────────────
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentConfig {
    private String name;
    private String phase; // "parallel" | "sequential"
    private String model;
    private boolean builtin;
    private String description;
    private String promptTemplate;
    private boolean enabled;
}
