package com.codesentinel.core;

import com.codesentinel.agent.*;
import com.codesentinel.model.AgentConfig;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * AgentRegistry — manages all agents (builtin + dynamic).
 * Primary store: Redis hash "codesentinel:agents"
 * Fallback: ConcurrentHashMap (when Redis is unavailable)
 */
@Slf4j
@Service
public class AgentRegistry {

    private static final String REGISTRY_KEY = "codesentinel:agents";

    private final ObjectMapper objectMapper = new ObjectMapper();

    // In-memory fallback store
    private final ConcurrentHashMap<String, String> memoryStore = new ConcurrentHashMap<>();

    private boolean redisAvailable = false;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    @Autowired
    private OllamaApi ollamaApi;

    @PostConstruct
    public void init() {
        // Check Redis availability
        if (redisTemplate != null) {
            try {
                redisTemplate.getConnectionFactory().getConnection().ping();
                redisAvailable = true;
                log.info("✅ Redis connected — using Redis registry");
            } catch (Exception e) {
                log.warn("⚠️  Redis unavailable ({}) — using in-memory registry", e.getMessage());
            }
        }

        // Seed built-in agents
        getBuiltinConfigs().forEach((name, config) -> {
            if (!exists(name)) {
                save(config);
                log.debug("Registered built-in agent: {}", name);
            }
        });

        log.info("AgentRegistry initialised with {} agents (backend={})",
                listAll().size(), redisAvailable ? "redis" : "in-memory");
    }

    // ── Built-in definitions ──────────────────────────────────────────────────

    private Map<String, AgentConfig> getBuiltinConfigs() {
        Map<String, AgentConfig> builtins = new LinkedHashMap<>();

        builtins.put("syntax_checker",     AgentConfig.builder().name("syntax_checker")    .phase("parallel")  .model("codellama").builtin(true).enabled(true).description("Detects syntax errors and AST-level issues").build());
        builtins.put("sast_scanner",       AgentConfig.builder().name("sast_scanner")      .phase("parallel")  .model("llama3")   .builtin(true).enabled(true).description("Static Application Security Testing").build());
        builtins.put("dast_scanner",       AgentConfig.builder().name("dast_scanner")      .phase("parallel")  .model("llama3")   .builtin(true).enabled(true).description("Dynamic Application Security Testing simulation").build());
        builtins.put("pentest_agent",      AgentConfig.builder().name("pentest_agent")     .phase("parallel")  .model("llama3")   .builtin(true).enabled(true).description("Penetration testing — attacker mindset exploit chains").build());
        builtins.put("style_linter",       AgentConfig.builder().name("style_linter")      .phase("parallel")  .model("codellama").builtin(true).enabled(true).description("Code style, naming, complexity, and maintainability").build());
        builtins.put("dependency_auditor", AgentConfig.builder().name("dependency_auditor").phase("parallel")  .model("llama3")   .builtin(true).enabled(true).description("Dependency vulnerability and supply-chain audit").build());
        builtins.put("summarizer",         AgentConfig.builder().name("summarizer")        .phase("sequential").model("llama3")   .builtin(true).enabled(true).description("Synthesises all parallel findings").build());
        builtins.put("human_reviewer",     AgentConfig.builder().name("human_reviewer")    .phase("sequential").model("llama3")   .builtin(true).enabled(true).description("Senior engineer human-style code review").build());
        builtins.put("report_generator",   AgentConfig.builder().name("report_generator")  .phase("sequential").model("llama3")   .builtin(true).enabled(true).description("Final structured executive report").build());

        return builtins;
    }

    // ── Storage helpers ────────────────────────────────────────────────────────

    private void save(AgentConfig config) {
        try {
            String json = objectMapper.writeValueAsString(config);
            if (redisAvailable) {
                redisTemplate.opsForHash().put(REGISTRY_KEY, config.getName(), json);
            } else {
                memoryStore.put(config.getName(), json);
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize agent config: {}", e.getMessage());
        }
    }

    private boolean exists(String name) {
        if (redisAvailable) {
            return Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(REGISTRY_KEY, name));
        }
        return memoryStore.containsKey(name);
    }

    private Optional<AgentConfig> load(String name) {
        try {
            String json = redisAvailable
                    ? (String) redisTemplate.opsForHash().get(REGISTRY_KEY, name)
                    : memoryStore.get(name);
            if (json == null) return Optional.empty();
            return Optional.of(objectMapper.readValue(json, AgentConfig.class));
        } catch (Exception e) {
            log.error("Failed to deserialise agent {}: {}", name, e.getMessage());
            return Optional.empty();
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    public List<AgentConfig> listAll() {
        Map<Object, Object> raw = redisAvailable
                ? redisTemplate.opsForHash().entries(REGISTRY_KEY)
                : new HashMap<>(memoryStore);

        return raw.values().stream()
                .map(v -> {
                    try { return objectMapper.readValue(v.toString(), AgentConfig.class); }
                    catch (Exception e) { return null; }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    public AgentConfig registerDynamic(String name, String phase, String model,
                                        String promptTemplate, String description) {
        AgentConfig config = AgentConfig.builder()
                .name(name).phase(phase).model(model)
                .builtin(false).description(description)
                .promptTemplate(promptTemplate).enabled(true)
                .build();
        save(config);
        log.info("Registered dynamic agent: {} (phase={})", name, phase);
        return config;
    }

    public void toggle(String name, boolean enabled) {
        load(name).ifPresent(config -> {
            config.setEnabled(enabled);
            save(config);
        });
    }

    public void deleteDynamic(String name) {
        AgentConfig config = load(name)
                .orElseThrow(() -> new IllegalArgumentException("Agent not found: " + name));
        if (config.isBuiltin()) {
            throw new IllegalArgumentException("Cannot delete built-in agents");
        }
        if (redisAvailable) {
            redisTemplate.opsForHash().delete(REGISTRY_KEY, name);
        } else {
            memoryStore.remove(name);
        }
    }

    /** Instantiate live agent objects for a given phase. */
    public List<BaseAgent> getAgentsByPhase(String phase) {
        return listAll().stream()
                .filter(c -> phase.equals(c.getPhase()) && c.isEnabled())
                .map(this::instantiate)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private BaseAgent instantiate(AgentConfig config) {
        if (config.isBuiltin()) {
            return switch (config.getName()) {
                case "syntax_checker"     -> new SyntaxAgent(ollamaApi, config.getModel());
                case "sast_scanner"       -> new SASTAgent(ollamaApi, config.getModel());
                case "dast_scanner"       -> new DASTAgent(ollamaApi, config.getModel());
                case "pentest_agent"      -> new PentestAgent(ollamaApi, config.getModel());
                case "style_linter"       -> new StyleAgent(ollamaApi, config.getModel());
                case "dependency_auditor" -> new DependencyAgent(ollamaApi, config.getModel());
                case "summarizer"         -> new SummarizerAgent(ollamaApi, config.getModel());
                case "human_reviewer"     -> new HumanReviewAgent(ollamaApi, config.getModel());
                case "report_generator"   -> new ReportAgent(ollamaApi, config.getModel());
                default -> null;
            };
        } else {
            return new DynamicAgent(config.getName(), config.getPromptTemplate(),
                    config.getModel(), config.getDescription(), ollamaApi);
        }
    }

    public String getBackend() {
        return redisAvailable ? "redis" : "in-memory";
    }
}
