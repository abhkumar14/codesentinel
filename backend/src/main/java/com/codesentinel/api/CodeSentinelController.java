package com.codesentinel.api;

import com.codesentinel.core.AgentRegistry;
import com.codesentinel.core.Pipeline;
import com.codesentinel.core.ProjectExtractor;
import com.codesentinel.core.ProjectExtractor.ProjectScan;
import com.codesentinel.core.ProjectExtractor.ScanMode;
import com.codesentinel.core.ProjectExtractor.ScanUnit;
import com.codesentinel.core.WebSocketManager;
import com.codesentinel.model.AgentConfig;
import com.codesentinel.model.AnalyseRequest;
import com.codesentinel.model.PipelineEvent;
import com.codesentinel.model.RegisterAgentRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CodeSentinelController {

    private final Pipeline pipeline;
    private final AgentRegistry registry;
    private final WebSocketManager wsManager;
    private final ProjectExtractor projectExtractor;

    private final ConcurrentHashMap<String, Thread> activeSessions = new ConcurrentHashMap<>();

    // ── Single snippet analysis ───────────────────────────────────────────────

    @PostMapping("/analyse")
    public ResponseEntity<Map<String, String>> analyse(@Valid @RequestBody AnalyseRequest request) {
        String sessionId = UUID.randomUUID().toString();
        pipeline.run(request.getCode(), sessionId, request.getSelectedAgents());
        return ResponseEntity.ok(Map.of("session_id", sessionId, "status", "started"));
    }

    @DeleteMapping("/analyse/{sessionId}")
    public ResponseEntity<Map<String, String>> cancelAnalysis(@PathVariable String sessionId) {
        Thread t = activeSessions.remove(sessionId);
        if (t != null) {
            t.interrupt();
            return ResponseEntity.ok(Map.of("status", "cancelled"));
        }
        return ResponseEntity.notFound().build();
    }

    // ── ZIP project analysis (NEW) ────────────────────────────────────────────

    /**
     * POST /api/analyse-project
     * Accepts a multipart/form-data request with:
     * file — the .zip archive
     * mode — smart | aggregated | per_file (default: smart)
     */
    @PostMapping(value = "/analyse-project", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> analyseProject(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "mode", defaultValue = "smart") String mode) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        String filename = Objects.requireNonNullElse(file.getOriginalFilename(), "project.zip");
        if (!filename.toLowerCase().endsWith(".zip")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only .zip files are supported"));
        }
        if (!List.of("smart", "aggregated", "per_file").contains(mode)) {
            return ResponseEntity.badRequest().body(Map.of("error", "mode must be: smart | aggregated | per_file"));
        }

        String sessionId = UUID.randomUUID().toString();
        final ScanMode scanMode = ScanMode.valueOf(mode.toUpperCase());

        try {
            byte[] zipBytes = file.getBytes();
            runProjectAnalysis(zipBytes, filename, scanMode, sessionId);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }

        return ResponseEntity.ok(Map.of(
                "session_id", sessionId,
                "status", "started",
                "filename", filename,
                "mode", mode));
    }

    @Async
    protected void runProjectAnalysis(byte[] zipBytes, String filename,
            ScanMode mode, String sessionId) {
        try {
            wsManager.broadcast(sessionId, PipelineEvent.pipelineStatus("extracting_zip", filename));

            ProjectScan scan = projectExtractor.extract(zipBytes, mode);

            // Tell UI about project structure
            wsManager.broadcast(sessionId, buildProjectInfoEvent(scan, filename));

            List<Map<String, Object>> allUnitReports = new ArrayList<>();

            for (int i = 0; i < scan.getScanUnits().size(); i++) {
                ScanUnit unit = scan.getScanUnits().get(i);

                // unit_start event
                wsManager.broadcast(sessionId, PipelineEvent.builder()
                        .type("unit_start")
                        .build());
                // broadcast raw map for extra fields
                wsManager.broadcast(sessionId, buildUnitStartEvent(i, scan.getScanUnits().size(), unit));

                // Run full pipeline on this scan unit
                pipeline.run(unit.getCode(), sessionId, null, unit.getLabel());

                Map<String, Object> unitReport = new LinkedHashMap<>();
                unitReport.put("label", unit.getLabel());
                unitReport.put("language", unit.getLanguage());
                unitReport.put("files", unit.getFiles());
                allUnitReports.add(unitReport);

                wsManager.broadcast(sessionId, buildUnitCompleteEvent(i, unit.getLabel()));
            }

            // project_complete
            wsManager.broadcast(sessionId, buildProjectCompleteEvent(scan, filename, allUnitReports));

        } catch (IllegalArgumentException e) {
            wsManager.broadcast(sessionId, PipelineEvent.pipelineStatus("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Project analysis failed: {}", e.getMessage(), e);
            wsManager.broadcast(sessionId,
                    PipelineEvent.pipelineStatus("error", "Unexpected error: " + e.getMessage()));
        }
    }

    @GetMapping("/scan-modes")
    public ResponseEntity<Map<String, Object>> scanModes() {
        return ResponseEntity.ok(Map.of("modes", List.of(
                Map.of("id", "smart", "label", "Smart Scan", "description",
                        "Only high-risk files (auth, DB, routes, config). Fastest."),
                Map.of("id", "aggregated", "label", "Full Scan", "description",
                        "All files grouped by language. Thorough."),
                Map.of("id", "per_file", "label", "Per-file Scan", "description",
                        "Each file scanned individually. Most detailed, slowest."))));
    }

    // ── Agent registry ────────────────────────────────────────────────────────

    @GetMapping("/agents")
    public ResponseEntity<Map<String, List<AgentConfig>>> listAgents() {
        return ResponseEntity.ok(Map.of("agents", registry.listAll()));
    }

    @PostMapping("/agents/register")
    public ResponseEntity<Map<String, Object>> registerAgent(@Valid @RequestBody RegisterAgentRequest req) {
        if (!List.of("parallel", "sequential").contains(req.getPhase())) {
            return ResponseEntity.badRequest().body(Map.of("error", "phase must be 'parallel' or 'sequential'"));
        }
        AgentConfig config = registry.registerDynamic(
                req.getName(), req.getPhase(), req.getModel(), req.getPromptTemplate(), req.getDescription());
        return ResponseEntity.ok(Map.of("status", "registered", "agent", config));
    }

    @PatchMapping("/agents/{name}/toggle")
    public ResponseEntity<Map<String, Object>> toggleAgent(@PathVariable String name,
            @RequestBody Map<String, Boolean> body) {
        registry.toggle(name, Boolean.TRUE.equals(body.get("enabled")));
        return ResponseEntity.ok(Map.of("status", "updated", "agent", name, "enabled", body.get("enabled")));
    }

    @DeleteMapping("/agents/{name}")
    public ResponseEntity<Map<String, Object>> deleteAgent(@PathVariable String name) {
        try {
            registry.deleteDynamic(name);
            return ResponseEntity.ok(Map.of("status", "deleted", "agent", name));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "agents_registered", registry.listAll().size(),
                "registry_backend", registry.getBackend()));
    }

    // ── Event builders ────────────────────────────────────────────────────────

    private PipelineEvent buildProjectInfoEvent(ProjectScan scan, String filename) {
        // Use a custom subclass trick — broadcast raw via a map
        return PipelineEvent.builder()
                .type("project_info")
                .message(filename + " | " + scan.getTotalFiles() + " files | mode=" + scan.getMode())
                .build();
    }

    private PipelineEvent buildUnitStartEvent(int index, int total, ScanUnit unit) {
        return PipelineEvent.builder()
                .type("unit_start")
                .agent(unit.getLabel())
                .phase(unit.getLanguage())
                .message(index + "/" + total)
                .build();
    }

    private PipelineEvent buildUnitCompleteEvent(int index, String label) {
        return PipelineEvent.builder()
                .type("unit_complete")
                .agent(label)
                .status("complete")
                .build();
    }

    private PipelineEvent buildProjectCompleteEvent(ProjectScan scan, String filename,
            List<Map<String, Object>> reports) {
        return PipelineEvent.builder()
                .type("project_complete")
                .status("complete")
                .message(filename + " — " + scan.getScanUnits().size() + " units analysed")
                .build();
    }
}
