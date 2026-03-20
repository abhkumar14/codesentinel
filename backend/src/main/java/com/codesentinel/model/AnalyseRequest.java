package com.codesentinel.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class AnalyseRequest {
    @NotBlank(message = "Code cannot be empty")
    private String code;
    private String language;              // null = auto-detect
    private List<String> selectedAgents; // null = meta-agent decides
}
