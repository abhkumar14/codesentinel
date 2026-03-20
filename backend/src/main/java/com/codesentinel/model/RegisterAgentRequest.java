package com.codesentinel.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class RegisterAgentRequest {
    @NotBlank
    private String name;

    @Pattern(regexp = "parallel|sequential", message = "phase must be 'parallel' or 'sequential'")
    private String phase = "parallel";

    private String model = "llama3";

    @NotBlank(message = "promptTemplate is required")
    private String promptTemplate;

    private String description = "";
}
