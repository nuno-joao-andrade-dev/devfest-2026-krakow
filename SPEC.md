# Technical Specification: Krakow Cultural AI Assistant

This document defines the comprehensive technical specification and architectural blueprint for the **Krakow Cultural AI Assistant and 5-Step Progressive Workshop**. It integrates all user instructions, architectural constraints, and engineering decisions established for the project.

---

## 1. Project Core Objective

Build a code-first, deeply knowledgeable AI agent acting as a Tour Guide, Historian, and Concierge for the Royal Capital City of Kraków. The agent must run entirely locally, leverage local data to eliminate hallucinations, execute native asynchronous tool bindings, and be delivered as both a full-stack production application and a 5-step self-contained hands-on workshop.

---

## 2. Technical Stack and Core Constraints

1.  **Runtime and Language:**
    *   100% JavaScript (Node.js LTS, ECMAScript Modules `import/export`).
    *   Zero Python runtime or dependencies. All previous Python agent prototypes are removed.
2.  **Local LLM Model:**
    *   Configurable via the `OLLAMA_MODEL` environment variable (secondary fallback `MODEL`, default `gemma4:e2b`).
    *   Supports alternative models seamlessly (such as `qwen2.5:3b`, `llama3.2:3b`, etc.) without code modifications.
    *   Orchestrated locally via the Ollama daemon (`http://127.0.0.1:11434`, configurable via `OLLAMA_HOST`).
    *   Chosen for minimal GPU memory overhead (~1.8 GB VRAM) and fast local inference latency.
3.  **AI Orchestration Framework:**
    *   Official Google ADK (`@google/adk`, v2.1+) and `@google/adk-devtools`.
    *   Custom LLM adapter extending `@google/adk`'s `BaseLlm` with `generateContentAsync`.
    *   Native function tools registered through `@google/adk`'s `FunctionTool` with strict JSON Schema parameter definitions.
    *   Autonomous multi-turn execution loops powered by `@google/adk`'s `InMemoryRunner`.
    *   ADK CLI agent discovery via pure JavaScript root agent: `krakow_cultural_agent/agent.js`.
4.  **Network Ports and Serving:**
    *   Express 5 Web Application and REST API: **Port 3030**.
    *   Official Google ADK Web Dev-UI (`AdkApiServer`): **Port 8000**.
    *   SPA client redirection route: `GET /dev-ui` redirects to `http://localhost:8000/dev-ui`.
5.  **Concurrent Background Process Architecture:**
    *   Both the Express application (port 3030) and the Google ADK Dev-UI server (port 8000) must execute concurrently within the exact same Node.js process (`src/server.js`), sharing memory, models, and RAG cache.
6.  **Dual-Layer Local RAG Engine:**
    *   Lightweight in-memory retrieval engine written in native JavaScript with zero external vector database dependencies (no Pinecone, Chroma, or SQLite-vec).
    *   Tokenization with English and Polish stop-word stripping and Unicode Polish diacritic preservation (`ż`, `ś`, `ć`, `ą`, `ę`, `ł`, `ó`, `ń`, `ź`).
    *   BM25-style lexical term scoring with source attribution citations.
    *   **Static Layer:** Hardcoded historical facts (Wawel Hill, Cathedral, St. Mary's Basilica, Cloth Hall, Kazimierz).
    *   **Mutable Layer:** Dynamic directory (`data/mutable/`) holding live markdown files (`wawel_pricing.md`, `tourist_services.md`). Scanned with file modification time (`mtime`) caching for zero-downtime hot reloading.
7.  **Frontend Architecture:**
    *   Vanilla HTML5/CSS3/JavaScript single-page application served statically via Express (`public/index.html`).
    *   Zero frontend build toolchain (no Vite, Webpack, or TypeScript compilation step).
8.  **Documentation Guidelines:**
    *   Zero icons, emojis, or decorative pictographs across all documentation (`README.md`, `WORKSHOP.md`, `SPEC.md`, and step guides). Professional, plain-text formatting only.

---

## 3. Domain Knowledge Base (RAG Injection)

The local RAG system ingests two categories of knowledge to ground the model and eliminate factual hallucinations:

### 3.1 Static Historical Corpus
*   **Wawel Royal Hill:** Royal history from Casimir III the Great through Sigismund I the Old, Italian Renaissance arcaded courtyard by Bartolomeo Berrecci, Sigismund Chapel, Royal Crypts, and the legend of Smok Wawelski (Wawel Dragon) and Skuba the cobbler.
*   **St. Mary's Basilica (Bazylika Mariacka):** Gothic architecture, Veit Stoss (Wit Stwosz) carved linden wood high altarpiece (1477-1489), asymmetric towers (82m watchtower vs. 69m bell tower), and the 1241 Mongol siege history.
*   **Main Market Square (Rynek Główny):** 1257 Magdeburg charter layout, Cloth Hall (Sukiennice), Town Hall Tower, Church of St. Adalbert, and underground archaeological museum.
*   **Kazimierz Jewish Quarter:** 1335 royal charter by King Casimir III, historical sanctuary, Old Synagogue (Synagoga Stara), Remah Synagogue and 16th-century cemetery, WWII Podgórze ghetto boundary, Oskar Schindler's Enamel Factory, and modern cultural renewal.

### 3.2 Mutable Dynamic Layer (`data/mutable/`)
*   `wawel_pricing.md`: Current admission fees (PLN) for State Rooms, Royal Apartments, Crown Treasury, Dragon's Den, free Monday access policy, seasonal opening hours, and official booking contacts.
*   `tourist_services.md`: Emergency services (112, 997, 998, 999, 986), official InfoKraków visitor centers, certified guide associations, and luggage storage facilities.

---

## 4. Native Tools Specification

The agent exposes three native asynchronous JavaScript tools defined with standard JSON Schema declarations:

1.  **`getTrumpetCallSchedule()`**
    *   Calculates exact minutes remaining until the next hourly performance of the Hejnał Mariacki.
    *   Returns directional performance sequence: South (Wawel Castle / King), West (Town Hall / Mayor), North (Florian Gate / Guards), East (Fire Station / Firemaster).
    *   Details the acoustic cutoff tradition honoring the 1241 trumpeter killed during the Mongol invasion.
2.  **`getWawelTicketAvailability({ date })`**
    *   Simulates real-time inventory for Wawel exhibitions: Royal State Rooms, Royal Private Apartments, Crown Treasury & Armoury, and Dragon's Den.
    *   Validates dates, handles omitted date parameters gracefully by defaulting to today, and flags sold-out states and free Monday rules.
3.  **`recommendLocalDining({ district, budget })`**
    *   Curates authentic dining venues based on district (`Old Town`, `Kazimierz`, `Podgórze`) and budget tier (`budget`/`milk bar`, `moderate`, `fine dining`).
    *   Includes traditional milk bars (Bar Mleczny Górnik, Pod Temidą), historic cellar restaurants (Pod Aniołami, Morskie Oko), and contemporary Michelin-rated gastronomy (Bottiglieria 1881).

---

## 5. Six-Step Hands-On Workshop Architecture

The project is structured as a progressive 6-step curriculum. Each step is completely self-contained with its own source code, documentation, and automated tests so participants can jump to any step at any time:

```
steps/
├── step-01-setup-and-llm/       # Step 1: Environment & Local LLM (5 tests)
├── step-02-dual-layer-rag/      # Step 2: Dual-Layer RAG Engine (9 tests)
├── step-03-native-tools/        # Step 3: Native Tool Binding & Execution (7 tests)
├── step-04-adk-agent/           # Step 4: Google ADK Orchestrator & Tool Loop (23 tests)
├── step-05-full-app/            # Step 5: Full Express SPA + ADK Dev-UI (35 tests)
└── step-06-google-search-mcp/   # Step 6: Google Search MCP & Dynamic Cross-Content (42 tests)
```

### Step 1: Environment Setup and Local LLM Connectivity
*   **Focus:** Verify Node.js environment, Ollama daemon health, and `gemma4:e2b` inference.
*   **Key Files:** `src/llm.js`, `test/llm.test.js`, `.env.example`, `package.json`, `README.md`.
*   **Tests:** 5 tests verifying client instantiation, host overrides, daemon health, offline handling, and live inference.

### Step 2: Dual-Layer RAG Engine (Static and Mutable)
*   **Focus:** In-memory lexical search engine, tokenization with Polish diacritic handling, heading chunking, and file modification time (`mtime`) dynamic hot reloading.
*   **Key Files:** `src/ragEngine.js`, `data/mutable/*.md`, `test/ragEngine.test.js`, `README.md`.
*   **Tests:** 9 tests verifying tokenizer, stop words, Polish characters, heading parsing, static retrieval, mutable price lookups, citations, and dynamic hot reloading with temporary file creation.

### Step 3: Native Tool Binding and Execution
*   **Focus:** Tool implementation, JSON Schema contracts, Hejnał time math, Wawel ticket simulator, and dining filters.
*   **Key Files:** `src/tools.js`, `test/tools.test.js`, `README.md`.
*   **Tests:** 7 tests verifying schedule calculations, directional dedications, ticket capacity simulation, default dates, dining filters, and schema exports.

### Step 4: Google ADK Agent Orchestration and Tool Loop
*   **Focus:** Integration with `@google/adk`. Subclass `BaseLlm` with `OllamaLlm`, wrap native functions into `FunctionTool`, and execute autonomous multi-turn loops with `InMemoryRunner`.
*   **Key Files:** `src/agent.js`, `src/ragEngine.js`, `src/tools.js`, `test/agent.test.js`, `README.md`.
*   **Tests:** 23 tests across 3 suites verifying component construction, prompt grounding, tool dispatching, offline fallback mode, and live end-to-end multi-turn conversation.

### Step 5: Full Application with Express and Google ADK Dev-UI
*   **Focus:** Production integration. Express 5 REST API (port 3030), static single-page frontend (`public/index.html`), concurrent Google ADK Web Dev-UI (`AdkApiServer` on port 8000), and pure JavaScript `krakow_cultural_agent/agent.js`.
*   **Key Files:** `src/server.js`, `src/agent.js`, `src/ragEngine.js`, `src/tools.js`, `public/index.html`, `krakow_cultural_agent/agent.js`, `test/server.test.js`, `README.md`.
*   **Tests:** 35 tests across 4 suites verifying REST endpoints, health telemetry, tool APIs, SPA fallback, dev-ui redirects, agent module exports, and end-to-end chat.

### Step 6: Google Search MCP & Dynamic Cross-Content
*   **Focus:** Model Context Protocol (`@modelcontextprotocol/sdk`) server over stdio for dynamic web search and Kraków event intelligence.
*   **Key Files:** `src/mcpServer.js`, `src/mcpClient.js`, `src/agent.js`, `src/server.js`, `public/index.html`, `test/mcpServer.test.js`, `test/mcpAgent.test.js`.
*   **Tests:** 42 tests verifying MCP server schemas, ADK MCPToolset connection, multi-turn loop, and REST endpoints.

---

## 6. Root Directory Architecture and Hygiene

To maintain separation between curriculum orchestration and step implementations, **all application source code (`src/`, `public/`, `krakow_cultural_agent/`, `test/`) is strictly excluded from the root directory**.

The root directory contains only:
1.  **Documentation:** `README.md`, `WORKSHOP.md`, `SPEC.md`.
2.  **Shared Data:** `data/mutable/` (`tourist_services.md`, `wawel_pricing.md`).
3.  **Workshop Steps:** `steps/` containing self-contained steps 1 through 6.
4.  **Root Workspace Orchestration:** `package.json`, `package-lock.json`, `node_modules`, `.env`, and `.env.example`.

Root `package.json` provides convenience test and launch scripts:
*   `npm test`: Runs the complete test suite across all 6 steps (121 tests).
*   `npm run test:step-01` through `npm run test:step-06`: Runs individual step tests.
*   `npm start`: Launches the completed Step 6 application with MCP.

---

## 7. Automated Test Suite Specification

All tests use Node.js's built-in test runner (`node:test`) and strict assertions (`node:assert/strict`) with zero external test framework dependencies.

| Step | Test Suite | Tests | Validation Scope |
| :---: | :--- | :---: | :--- |
| **01** | `step-01-setup-and-llm/test/llm.test.js` | 5 | Ollama client, custom host, health check, offline handling, live query |
| **02** | `step-02-dual-layer-rag/test/ragEngine.test.js` | 9 | Tokenization, Polish diacritics, chunk parser, static/mutable RAG, hot reload |
| **03** | `step-03-native-tools/test/tools.test.js` | 7 | Hejnał calculations, cardinal dedications, ticket simulator, dining filter, schemas |
| **04** | `step-04-adk-agent/test/**/*.test.js` | 23 | ADK components, prompt grounding, tool loops, offline fallback, live agent chat |
| **05** | `step-05-full-app/test/**/*.test.js` | 35 | Express REST API, health, tools endpoint, SPA fallback, Dev-UI redirect, full chat |
| **06** | `step-06-google-search-mcp/test/**/*.test.js` | 42 | MCP server, schemas, ADK MCPToolset, agent search loop, REST API, fallback |
| **Total** | **All 6 Steps Combined** | **121** | **Complete end-to-end verification (100% passing)** |

---

## 8. REST API Reference (Port 3030)

### 8.1 POST `/api/chat`
*   **Request Body:**
    ```json
    {
      "message": "When is the next Hejnał Mariacki and why does it stop suddenly?"
    }
    ```
*   **Response Body (200 OK):**
    ```json
    {
      "success": true,
      "response": "The Hejnał Mariacki plays every hour...",
      "sources": ["St. Mary's Basilica (Bazylika Mariacka)"],
      "toolsUsed": ["getTrumpetCallSchedule"],
      "durationMs": 1420
    }
    ```

### 8.2 GET `/api/health`
*   Returns operational telemetry, Ollama model name, daemon connectivity, and total RAG chunk count.

### 8.3 GET `/api/tools`
*   Returns JSON Schema definitions and parameter contracts for all registered native tools.

### 8.4 POST `/api/tools/:toolName`
*   Directly executes a native tool with a JSON argument payload (useful for automated testing and client-side pre-fetching).

### 8.5 GET `/dev-ui`
*   Issues an HTTP 302 redirect to `http://localhost:8000/dev-ui` for single-click access to the Google ADK Dev-UI.
