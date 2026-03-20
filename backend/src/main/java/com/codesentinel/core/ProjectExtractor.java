package com.codesentinel.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * ProjectExtractor — FIXED for macOS ZIPs
 *
 * Root cause: Java's ZipInputStream reads entries sequentially and fails on
 * STORED (uncompressed) entries with EXT descriptors — exactly what macOS
 * Archive Utility produces. ZipFile reads the central directory at the end of
 * the archive and handles all compression methods correctly.
 */
@Component
public class ProjectExtractor {

    private static final Logger log = LoggerFactory.getLogger(ProjectExtractor.class);

    public enum ScanMode {
        PER_FILE, AGGREGATED, SMART
    }

    public static class ProjectFile {
        private final String path, language, content;
        private final long sizeBytes;
        private final boolean smartCandidate;

        public ProjectFile(String path, String language, String content, long sizeBytes, boolean smartCandidate) {
            this.path = path;
            this.language = language;
            this.content = content;
            this.sizeBytes = sizeBytes;
            this.smartCandidate = smartCandidate;
        }

        public String getPath() {
            return path;
        }

        public String getLanguage() {
            return language;
        }

        public String getContent() {
            return content;
        }

        public long getSizeBytes() {
            return sizeBytes;
        }

        public boolean isSmartCandidate() {
            return smartCandidate;
        }
    }

    public static class ScanUnit {
        private final String label, language, code;
        private final List<String> files;

        public ScanUnit(String label, String language, String code, List<String> files) {
            this.label = label;
            this.language = language;
            this.code = code;
            this.files = files;
        }

        public String getLabel() {
            return label;
        }

        public String getLanguage() {
            return language;
        }

        public String getCode() {
            return code;
        }

        public List<String> getFiles() {
            return files;
        }
    }

    public static class ProjectScan {
        private final ScanMode mode;
        private final int totalFiles, skippedFiles;
        private final List<ScanUnit> scanUnits;

        public ProjectScan(ScanMode mode, int totalFiles, int skippedFiles, List<ScanUnit> scanUnits) {
            this.mode = mode;
            this.totalFiles = totalFiles;
            this.skippedFiles = skippedFiles;
            this.scanUnits = scanUnits;
        }

        public ScanMode getMode() {
            return mode;
        }

        public int getTotalFiles() {
            return totalFiles;
        }

        public int getSkippedFiles() {
            return skippedFiles;
        }

        public List<ScanUnit> getScanUnits() {
            return scanUnits;
        }
    }

    private static final int MAX_FILE_BYTES = 200_000;
    private static final int MAX_FILES = 200;
    private static final int MAX_ZIP_MB = 50;
    private static final int MAX_UNIT_CHARS = 80_000;

    private static final Map<String, String> LANG_MAP = new HashMap<>();
    static {
        LANG_MAP.put(".py", "python");
        LANG_MAP.put(".js", "javascript");
        LANG_MAP.put(".ts", "typescript");
        LANG_MAP.put(".tsx", "typescript");
        LANG_MAP.put(".jsx", "javascript");
        LANG_MAP.put(".java", "java");
        LANG_MAP.put(".go", "go");
        LANG_MAP.put(".rs", "rust");
        LANG_MAP.put(".rb", "ruby");
        LANG_MAP.put(".php", "php");
        LANG_MAP.put(".cs", "csharp");
        LANG_MAP.put(".cpp", "cpp");
        LANG_MAP.put(".c", "c");
        LANG_MAP.put(".kt", "kotlin");
        LANG_MAP.put(".swift", "swift");
        LANG_MAP.put(".sh", "bash");
        LANG_MAP.put(".sql", "sql");
        LANG_MAP.put(".yml", "yaml");
        LANG_MAP.put(".yaml", "yaml");
        LANG_MAP.put(".tf", "terraform");
    }

    private static final Set<String> SKIP_DIRS = new HashSet<>(
            Arrays.asList("node_modules", ".git", "__pycache__", ".venv", "venv", "env", "dist", "build", "target",
                    ".idea", ".vscode", "coverage", "vendor", "bower_components", ".gradle", ".mvn"));

    private static final Set<String> SKIP_EXT = new HashSet<>(
            Arrays.asList(".pyc", ".class", ".o", ".so", ".dll", ".exe", ".bin", ".jpg", ".jpeg", ".png", ".gif",
                    ".svg", ".ico", ".woff", ".woff2", ".ttf", ".mp4", ".mp3", ".zip", ".tar", ".gz", ".lock"));

    private static final Set<String> ENTRY_STEMS = new HashSet<>(Arrays.asList("main", "app", "index", "server", "wsgi",
            "asgi", "manage", "settings", "config", "routes", "application"));

    private static final Pattern SMART_REGEX = Pattern
            .compile("auth|login|password|secret|token|api|database|db|query|sql|"
                    + "user|admin|config|settings|env|route|controller|middleware|"
                    + "handler|endpoint|server|app|security|crypto|hash|session|"
                    + "cookie|upload|exec|shell|command|subprocess|payment|request", Pattern.CASE_INSENSITIVE);

    // ── Public API ────────────────────────────────────────────────────────────

    public ProjectScan extract(byte[] zipBytes, ScanMode mode) throws Exception {
        if (zipBytes.length > (long) MAX_ZIP_MB * 1024 * 1024) {
            throw new IllegalArgumentException("ZIP exceeds " + MAX_ZIP_MB + " MB limit");
        }
        // Write to temp file — ZipFile requires a seekable file (central directory)
        Path tempFile = Files.createTempFile("codesentinel-", ".zip");
        try {
            Files.write(tempFile, zipBytes);
            return extractFromFile(tempFile.toFile(), mode);
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    private ProjectScan extractFromFile(File zipFile, ScanMode mode) throws Exception {
        List<ProjectFile> files = new ArrayList<>();
        int skipped = 0;

        // ZipFile reads central directory — works with STORED + DEFLATED + macOS ZIPs
        try (ZipFile zf = new ZipFile(zipFile, StandardCharsets.UTF_8)) {
            Enumeration<? extends ZipEntry> entries = zf.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry.isDirectory())
                    continue;

                String entryName = entry.getName();
                Path p = Path.of(entryName);

                // Skip unwanted directories
                boolean skipDir = false;
                for (Path part : p) {
                    if (SKIP_DIRS.contains(part.toString())) {
                        skipDir = true;
                        break;
                    }
                }
                if (skipDir) {
                    skipped++;
                    continue;
                }

                String ext = getExtension(entryName).toLowerCase();
                if (SKIP_EXT.contains(ext) || !LANG_MAP.containsKey(ext)) {
                    skipped++;
                    continue;
                }
                if (entry.getSize() > MAX_FILE_BYTES || files.size() >= MAX_FILES) {
                    skipped++;
                    continue;
                }

                String content;
                try (InputStream is = zf.getInputStream(entry)) {
                    byte[] bytes = is.readAllBytes();
                    if (bytes.length > MAX_FILE_BYTES) {
                        skipped++;
                        continue;
                    }
                    content = new String(bytes, StandardCharsets.UTF_8);
                } catch (Exception e) {
                    log.warn("Skipping unreadable entry {}: {}", entryName, e.getMessage());
                    skipped++;
                    continue;
                }

                String stem = getStem(entryName).toLowerCase();
                boolean isSmart = SMART_REGEX.matcher(entryName).find() || ENTRY_STEMS.contains(stem);
                long size = entry.getSize() > 0 ? entry.getSize() : content.length();

                files.add(new ProjectFile(entryName, LANG_MAP.get(ext), content, size, isSmart));
            }
        }

        if (files.isEmpty()) {
            throw new IllegalArgumentException("No scannable source files found in the ZIP");
        }

        log.info("Extracted ZIP: {} scannable files, {} skipped, mode={}", files.size(), skipped, mode);
        return new ProjectScan(mode, files.size(), skipped, buildUnits(files, mode));
    }

    // ── Unit builders ─────────────────────────────────────────────────────────

    private List<ScanUnit> buildUnits(List<ProjectFile> files, ScanMode mode) {
        switch (mode) {
        case PER_FILE:
            return buildPerFile(files);
        case AGGREGATED:
            return buildAggregated(files);
        default:
            return buildSmart(files);
        }
    }

    private List<ScanUnit> buildPerFile(List<ProjectFile> files) {
        List<ScanUnit> units = new ArrayList<>();
        for (ProjectFile f : files) {
            units.add(new ScanUnit(f.getPath(), f.getLanguage(), "// " + f.getPath() + "\n\n" + f.getContent(),
                    Collections.singletonList(f.getPath())));
        }
        return units;
    }

    private List<ScanUnit> buildAggregated(List<ProjectFile> files) {
        Map<String, List<ProjectFile>> byLang = new LinkedHashMap<>();
        for (ProjectFile f : files)
            byLang.computeIfAbsent(f.getLanguage(), k -> new ArrayList<>()).add(f);
        List<ScanUnit> units = new ArrayList<>();
        for (Map.Entry<String, List<ProjectFile>> e : byLang.entrySet()) {
            List<String> paths = new ArrayList<>();
            for (ProjectFile f : e.getValue())
                paths.add(f.getPath());
            units.add(new ScanUnit(e.getKey() + " (" + e.getValue().size() + " files)", e.getKey(),
                    combine(e.getValue()), paths));
        }
        return units;
    }

    private List<ScanUnit> buildSmart(List<ProjectFile> files) {
        List<ProjectFile> selected = new ArrayList<>();
        for (ProjectFile f : files) {
            if (f.isSmartCandidate())
                selected.add(f);
        }
        if (selected.isEmpty())
            selected = files;

        Map<String, List<ProjectFile>> byLang = new LinkedHashMap<>();
        for (ProjectFile f : selected)
            byLang.computeIfAbsent(f.getLanguage(), k -> new ArrayList<>()).add(f);
        List<ScanUnit> units = new ArrayList<>();
        for (Map.Entry<String, List<ProjectFile>> e : byLang.entrySet()) {
            List<String> paths = new ArrayList<>();
            for (ProjectFile f : e.getValue())
                paths.add(f.getPath());
            units.add(new ScanUnit("[smart] " + e.getKey() + " — " + e.getValue().size() + " high-risk files",
                    e.getKey(), combine(e.getValue()), paths));
        }
        return units;
    }

    private String combine(List<ProjectFile> files) {
        StringBuilder sb = new StringBuilder();
        for (ProjectFile f : files) {
            sb.append("// ═══ ").append(f.getPath()).append(" ═══\n").append(f.getContent()).append("\n\n");
        }
        String result = sb.toString();
        return result.length() > MAX_UNIT_CHARS ? result.substring(0, MAX_UNIT_CHARS) + "\n\n// ... [truncated]"
                : result;
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.'), slash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
        return (dot > slash) ? filename.substring(dot) : "";
    }

    private String getStem(String filename) {
        String name = Path.of(filename).getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(0, dot) : name;
    }
}