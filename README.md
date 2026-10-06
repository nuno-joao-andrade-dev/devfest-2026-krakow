# Kraków Cultural AI Assistant

> A production-grade, code-first AI Tour Guide, Historian, and Concierge for the Royal Capital City of Kraków. Built with Node.js LTS, local **Gemma 4** orchestrated via **Ollama**, an in-memory **Dual-Layer RAG Engine**, and native JavaScript tool bindings.

---

## Hands-On Workshop Guide (5 Progressive Steps)

This repository is organized as a complete hands-on workshop. If you want to follow along step-by-step or jump directly to any stage, explore the self-contained folders in [`steps/`](./steps/):

| Step | Milestone | Location | Description |
| :---: | :--- | :--- | :--- |
| **01** | **Setup & Local LLM** | [`steps/step-01-setup-and-llm/`](./steps/step-01-setup-and-llm/README.md) | Ollama daemon setup, Gemma 4 (`gemma4:e2b`), and connectivity testing |
| **02** | **Dual-Layer RAG Engine** | [`steps/step-02-dual-layer-rag/`](./steps/step-02-dual-layer-rag/README.md) | In-memory lexical search, BM25 scoring, and hot-reloading mutable markdown |
| **03** | **Native Tool Binding** | [`steps/step-03-native-tools/`](./steps/step-03-native-tools/README.md) | JSON Schema parameters, Hejnał schedule math, and ticket simulator |
| **04** | **Google ADK Agent** | [`steps/step-04-adk-agent/`](./steps/step-04-adk-agent/README.md) | `@google/adk`, custom `BaseLlm`, `FunctionTool`, and autonomous tool loops |
| **05** | **Full Application & UI** | [`steps/step-05-full-app/`](./steps/step-05-full-app/README.md) | Complete Express 5 SPA (port 3030) + Google ADK Web Dev-UI (port 8000) |

Check out the full **[Workshop Guide & Syllabus (WORKSHOP.md)](./WORKSHOP.md)** for detailed curriculum goals, the **[GDE Slide Deck (SLIDES.md)](./SLIDES.md)**, the standalone **[`slides.html`](./slides.html)**, and the printable presentation **[`slides.pdf`](./slides.pdf)**.

---

## Architecture & System Blueprint

The Krakow Cultural AI Assistant is built according to the **Google ADK (Agent Development Kit)** component pattern. It runs entirely on-premises, eliminates external vector database dependencies (e.g. Pinecone/Chroma), prevents LLM hallucinations via local factual grounding, and executes native asynchronous JavaScript functions for real-time data lookups.
  ![Diagram](/assets/diagram.png)


---

## Technology Stack

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js (ESM `import/export`) | v24+ / LTS | Core application runtime |
| **AI Framework** | Google ADK (`@google/adk`) | v2.1.0 (Official) | Official Google Agent Development Kit for Node.js (`Agent`, `FunctionTool`, `BaseLlm`, `InMemoryRunner`, `MCPToolset`) |
| **Local LLM** | Gemma (Instruction-Tuned, e.g. `gemma4:e2b`, `gemma2:2b`) | Configured via `OLLAMA_MODEL` | Local on-device inference via Ollama (`http://localhost:11434`) |
| **Search Protocol** | Model Context Protocol (`@modelcontextprotocol/sdk`) | ^1.27.0 | Open standard stdio MCP server for live Google search & dynamic cross-content |
| **Server & API** | Express.js | ^5.2.1 | REST API & static frontend server (No Vite) |
| **Local RAG Engine** | Custom JavaScript Engine | From Scratch | In-memory tokenization, BM25 scoring & mtime cache |
| **Tool Execution** | Native & MCP Tools | Pure Node.js & Stdio | Hejnał math, Wawel ticketing, dining guide, Google Search |
| **Chat Frontend** | Vanilla HTML5, CSS3 & JavaScript | Pure Native | Responsive, accessible SPA with source & MCP badges |

---

## Tri-Layer Knowledge Base (RAG & MCP)

To eliminate hallucinations regarding historical events, admission prices, emergency services, and current city events, the assistant uses a tri-layer retrieval system:

### 1. Static Historical Corpus (`src/ragEngine.js`)
*   **Wawel Royal Hill:** Royal history from King Casimir the Great to the Polish Golden Age under King Sigismund I, Bartolomeo Berrecci's Italian Renaissance arcaded courtyard, the Royal Crypts, and the legend of *Smok Wawelski* (Wawel Dragon) and Skuba the cobbler.
*   **St. Mary's Basilica (*Bazylika Mariacka*):** Veit Stoss (*Wit Stwosz*) linden wood altarpiece (1477–1489), the unequal towers and the legend of the jealous brothers, and the 1241 Mongol siege history.
*   **Main Market Square (*Rynek Główny*):** 1257 Magdeburg charter, Cloth Hall (*Sukiennice*), Town Hall Tower, and Church of St. Adalbert.
*   **Kazimierz (Jewish Quarter):** 1335 royal charter by King Casimir III, Old Synagogue, Remah Synagogue & Renaissance cemetery, WWII Ghetto in Podgórze, Oskar Schindler's Enamel Factory, and contemporary cultural revival.

### 2. Mutable Dynamic Layer (`data/mutable/`)
Live markdown documents parsed at query time with file modification time (`mtime`) caching:
*   `data/mutable/wawel_pricing.md`: Current admission prices for State Rooms, Royal Crypts, Dragon's Den, opening hours, free Monday rules, and official booking contacts.
*   `data/mutable/tourist_services.md`: Emergency dispatch lines (112, 997, 998, 999, 986), InfoKraków visitor centers (Sukiennice, Wyspiański Pavilion, Kazimierz, Airport), guide associations, and luggage storage.

> **Zero-Downtime Updates:** You can edit any file in `data/mutable/` or add new `.md` files at any time. The internal cache detects file modification timestamps immediately without restarting the server or redeploying code.

### 3. Dynamic Model Context Protocol (MCP) Search Layer
A standalone MCP server running over stdio provides on-demand live Google Custom Search and dynamic municipal intelligence:
*   **Annual Festivals & Celebrations:** Kraków Film Festival, Jewish Culture Festival in Kazimierz, Lajkonik Pageant, Wianki summer solstice, Sacrum Profanum, Conrad Festival, and Christmas Market.
*   **Special & Temporary Museum Exhibitions:** Real-time exhibition locations and visitor hours for Leonardo da Vinci's *Lady with an Ermine* (Czartoryski Museum), Rynek Underground, and Wawel Arras Tapestries.
*   **Transit & Weather Intelligence:** Commuter rail (SKA1 Balice Airport to Kraków Główny in 17 minutes) and seasonal weather insights.

---

## Native Bound Tools

The agent has native bindings to three asynchronous tools declared with standard JSON Schema parameters:

1.  **`getTrumpetCallSchedule()`**
    *   Calculates the exact minutes remaining until the next hourly performance of the *Hejnał Mariacki*.
    *   Returns the cardinal direction sequence: South (Wawel Castle / King), West (Town Hall / Mayor), North (Florian Gate / Guards), East (Fire Station).
    *   Details the acoustic history of the sudden break in the melody honoring the 1241 watchman.
2.  **`getWawelTicketAvailability({ date })`**
    *   Simulates real-time remaining ticket capacity for Wawel Royal Castle exhibitions (*Royal State Rooms*, *Royal Private Apartments*, *Crown Treasury*, and *Dragon's Den*).
    *   Enforces Monday free-entry rules and highlights sold-out warnings.
3.  **`recommendLocalDining({ district, budget })`**
    *   Curates authentic dining venues based on district (`Old Town`, `Kazimierz`, `Podgórze`) and budget tier (`budget`/`milk bar`, `moderate`, `fine dining`).
    *   Includes traditional milk bars (*Bar Mleczny Górnik*, *Pod Temidą*), folk taverns (*Morskie Oko*, *Pod Aniołami*), and Kraków's 2-Michelin-starred *Bottiglieria 1881*.

---

## Getting Started

### Prerequisites

1.  **Node.js**: Version 20.x or 24.x (LTS) installed:
    ```bash
    node -v
    npm -v
    ```
2.  **Ollama**: Installed locally on your operating system ([ollama.ai](https://ollama.ai)).

---

### Step 1: Install Ollama & Pull Your Target Model

Start the Ollama daemon and pull the instruction model (default `gemma4:e2b`, or `gemma2:2b` for lower-RAM setups):

```bash
# Start Ollama service (if not already running as a system daemon)
ollama serve

# Pull your preferred model
ollama pull gemma4:e2b
# Or for machines with < 8 GB RAM:
# ollama pull gemma2:2b

# (Optional) Test model directly in terminal
ollama run gemma4:e2b
```

---

### Step 2: Install Project Dependencies

Clone or navigate to the project directory and install the latest stable dependencies:

```bash
cd devfest_krakow_2026
npm install
```

---

### Step 3: Configure Environment Variables

Create a `.env` file based on the provided `.env.example`:

```bash
cp .env.example .env
```

Default configuration in `.env`:
```env
PORT=3030
HOST=0.0.0.0
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:e2b
MUTABLE_DATA_DIR=data/mutable
```

#### Environment Variables Reference

| Variable | Description | Default | Alternative Examples |
| :--- | :--- | :--- | :--- |
| `OLLAMA_MODEL` | Local Ollama model identifier | `gemma4:e2b` | `gemma2:2b`, `qwen2.5:3b` |
| `OLLAMA_HOST` | Ollama daemon HTTP endpoint | `http://127.0.0.1:11434` | `http://192.168.1.100:11434` |
| `PORT` | Web app & REST API port | `3030` | `8080`, `3000` |
| `ADK_PORT` | Google ADK Web Dev-UI port | `8000` | `8001`, `9000` |
| `HOST` | Interface IP binding | `0.0.0.0` | `127.0.0.1` |
| `MUTABLE_DATA_DIR` | Directory containing hot-reloaded markdown | `data/mutable` | `/path/to/markdown` |

> **Dynamic Model Override:**  
> You can also override the model directly when launching scripts:
> ```bash
> OLLAMA_MODEL=gemma2:2b npm start
> ```

---

### Step 4: Launch the Server

Start the production server (runs both Express and the official Google ADK Dev-UI in the same background process):

```bash
npm start
```

For development with native file watching:

```bash
npm run dev
```

You will see:
```
=======================================================
Kraków Cultural AI Assistant running locally
URL: http://localhost:3030
Google ADK Dev-UI: http://localhost:8000/dev-ui
Local Model: gemma4:e2b via Ollama (http://127.0.0.1:11434)
Mutable RAG Directory: .../data/mutable
[RAG Watcher] Actively monitoring live markdown updates in: .../data/mutable
=======================================================
```

Open your browser:
*   **Web Chat & Tour Concierge:** **`http://localhost:3030`**
*   **Official Google ADK Web Dev-UI:** **`http://localhost:8000/dev-ui`** (or click the header badge in the chat UI, or visit `http://localhost:3030/dev-ui`)

To start the ADK Web Dev-UI standalone:
```bash
npm run adk
```

---

## Running the Test Suite

The project includes an automated test suite verifying all 6 workshop steps:

```bash
# Run tests across all 6 workshop steps (121 tests)
npm test

# Or run tests for a specific workshop step:
npm run test:step-01
npm run test:step-02
npm run test:step-03
npm run test:step-04
npm run test:step-05
npm run test:step-06
```

---

## REST API Reference

### 1. Send Chat Message
*   **Endpoint:** `POST /api/chat`
*   **Request Body:**
    ```json
    {
      "message": "When is the next Hejnał Mariacki and why does it stop suddenly?",
      "history": []
    }
    ```
*   **Response:**
    ```json
    {
      "success": true,
      "response": "The next Hejnał Mariacki will be played in...",
      "toolsUsed": [
        {
          "name": "getTrumpetCallSchedule",
          "args": {},
          "result": { ... }
        }
      ],
      "sources": [
        {
          "id": "static-hejnał-mariacki-history",
          "title": "The Hejnał Mariacki Tradition & Mongol Siege",
          "layer": "static",
          "score": 42.5
        }
      ],
      "durationMs": 482
    }
    ```

### 2. System Health & Telemetry
*   **Endpoint:** `GET /api/health`
*   **Response:**
    ```json
    {
      "status": "healthy",
      "uptimeSeconds": 120,
      "service": "Krakow Cultural AI Assistant",
      "ollama": {
        "online": true,
        "host": "http://127.0.0.1:11434",
        "configuredModel": "gemma4"
      },
      "rag": {
        "staticChunkCount": 9,
        "mutableChunkCount": 6,
        "totalChunks": 15
      }
    }
    ```

### 3. Enumerate Native Tools
*   **Endpoint:** `GET /api/tools`
*   **Response:** Lists JSON schema parameters for all exposed tools.

### 4. Execute Native Tool Directly
*   **Endpoint:** `POST /api/tools/:toolName`
*   **Example:** `POST /api/tools/getWawelTicketAvailability` with body `{"date": "2026-10-15"}`.

---

## Project Directory Structure

```
├── SPEC.md                           # Original technical specification
├── README.md                         # Complete blueprint & operational documentation
├── package.json                      # Pure ESM config & latest dependencies
├── .env.example                      # Environment variables template
├── data/
│   └── mutable/                      # Live markdown knowledge base (hot-reloaded)
│       ├── wawel_pricing.md          # Ticket prices, hours, and booking lines
│       └── tourist_services.md       # Emergency lines, InfoKraków, and transit
├── src/
│   ├── ragEngine.js                  # In-memory dual-layer RAG & BM25 retrieval engine
│   ├── tools.js                      # Native tools: trumpet call, tickets, dining
│   ├── agent.js                      # Google ADK agent component & Gemma 4 orchestrator
│   └── server.js                     # Express server & static frontend host (No Vite)
├── public/
│   └── index.html                    # Minimalist, elegant Kraków-themed chat SPA
└── test/
    ├── ragEngine.test.js             # RAG engine unit tests
    ├── tools.test.js                 # Tool execution unit tests
    ├── agent.test.js                 # Agent lifecycle & grounding tests
    └── server.test.js                # Express REST API & static delivery tests
```

---

## License

Licensed under the Apache-2.0 License.
