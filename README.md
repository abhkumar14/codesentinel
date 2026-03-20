# CodeSentinel Java — Multi-Agent AI Code Review

Spring Boot 3.3 + Spring AI + Ollama backend. Same React frontend as the Python version.

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Backend      | Spring Boot 3.3, Java 21            |
| AI Framework | Spring AI 1.0 (Ollama integration)  |
| Parallelism  | Virtual Threads (Java 21)           |
| Real-time    | Spring WebSocket                    |
| Registry     | Redis (Lettuce) + in-memory fallback|
| Frontend     | React 18, Vite, Tailwind CSS        |

## Prerequisites

- Java 21+
- Maven 3.9+
- Node.js 18+
- Ollama with models pulled
- Redis (optional — in-memory fallback used if unavailable)

## Quick Start (macOS)

```bash
chmod +x start-macos.sh
./start-macos.sh
```

## Manual Start

### 1. Pull Ollama models
```bash
ollama pull llama3
ollama pull codellama
```

### 2. Start Redis (optional)
```bash
brew services start redis   # macOS
# OR: redis-server
```

### 3. Build & run backend
```bash
cd backend
mvn clean package -DskipTests
java -jar target/codesentinel-backend-1.0.0.jar
# Runs on http://localhost:8080
```

### 4. Run frontend
```bash
cd frontend
npm install
npm run dev
# Opens on http://localhost:5173
```

## Project Structure

```
codesentinel-java/
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/codesentinel/
│       ├── CodeSentinelApplication.java
│       ├── agent/
│       │   ├── BaseAgent.java          ← Abstract base, Spring AI ChatClient
│       │   ├── SyntaxAgent.java
│       │   ├── SASTAgent.java          ← Static security testing
│       │   ├── DASTAgent.java          ← Dynamic security testing
│       │   ├── PentestAgent.java       ← Penetration testing simulation
│       │   ├── StyleAgent.java
│       │   ├── DependencyAgent.java
│       │   ├── SummarizerAgent.java    ← Sequential: synthesises findings
│       │   ├── HumanReviewAgent.java   ← Sequential: senior engineer review
│       │   ├── ReportAgent.java        ← Sequential: final report
│       │   └── DynamicAgent.java       ← Runtime-registered agents
│       ├── core/
│       │   ├── AgentRegistry.java      ← Redis + in-memory agent store
│       │   ├── MetaOrchestrator.java   ← Language detection + agent selection
│       │   ├── Pipeline.java           ← Parallel fan-out + sequential chain
│       │   └── WebSocketManager.java   ← Real-time broadcast hub
│       ├── api/
│       │   ├── CodeSentinelController.java  ← REST endpoints
│       │   └── PipelineWebSocketHandler.java
│       ├── config/
│       │   ├── AppConfig.java          ← WebSocket + Async config
│       │   ├── WebConfig.java          ← CORS + Redis bean
│       │   └── OllamaConfig.java       ← OllamaApi bean
│       └── model/
│           ├── AgentConfig.java
│           ├── AgentResult.java
│           ├── PipelineEvent.java
│           ├── FinalReport.java
│           ├── AnalyseRequest.java
│           └── RegisterAgentRequest.java
├── frontend/                           ← Identical to Python version
│   └── src/...
├── start-macos.sh
└── README.md
```

## Dynamic Agent Registration

```bash
curl -X POST http://localhost:8080/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "license_checker",
    "phase": "parallel",
    "model": "llama3",
    "description": "License compliance checker",
    "promptTemplate": "You are a license expert. Review this {language} code for license issues:\n\n{code}\n\nReturn JSON with findings."
  }'
```

## Key Differences from Python Version

| Feature             | Python (FastAPI)          | Java (Spring Boot)              |
|---------------------|---------------------------|---------------------------------|
| Concurrency         | asyncio + asyncio.gather  | Virtual Threads + CompletableFuture |
| AI framework        | httpx → Ollama REST       | Spring AI OllamaChatModel       |
| Streaming           | async generators          | Project Reactor Flux<String>    |
| WebSocket           | FastAPI WebSocket         | Spring WebSocket + TextWebSocketHandler |
| Agent registry      | redis.asyncio             | Spring Data Redis (Lettuce)     |
| Config              | .env / Python dicts       | application.yml                 |
