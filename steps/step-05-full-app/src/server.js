import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { AdkApiServer } from '@google/adk-devtools';
import { KrakowCulturalAgent } from './agent.js';
import { DualLocalRAGEngine } from './ragEngine.js';
import { toolsByName, toolDefinitions } from './tools.js';

// Load environment variables if .env exists
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const PORT = parseInt(process.env.PORT || '3030', 10);
const ADK_PORT = parseInt(process.env.ADK_PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MUTABLE_DIR = path.resolve(projectRoot, 'data/mutable');
process.env.MUTABLE_DIR = process.env.MUTABLE_DIR || MUTABLE_DIR;
const PUBLIC_DIR = path.resolve(projectRoot, 'public');

// Initialize Express application
const app = express();

// Request parsing middleware
app.use(express.json({ limit: '1mb' }));

// Custom structured access logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${elapsed}ms)`);
  });
  next();
});

// Initialize Dual-Layer RAG Engine and Cultural Agent
const ragEngine = new DualLocalRAGEngine({
  mutableDir: MUTABLE_DIR,
  enableCache: true
});

const agent = new KrakowCulturalAgent({
  model: process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b',
  ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  ragEngine,
  tools: toolsByName,
  toolDeclarations: toolDefinitions
});

// Serve frontend static assets strictly without Vite
app.use(express.static(PUBLIC_DIR));

// Setup live directory watcher for real-time markdown updates
let mutableWatcher = null;
if (fs.existsSync(MUTABLE_DIR)) {
  try {
    mutableWatcher = fs.watch(MUTABLE_DIR, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        console.log(`[RAG Watcher] Detected ${eventType} in mutable file: ${filename}. Dynamic cache will re-index on next query.`);
      }
    });
    // Unref so test suites and background CLI tasks can gracefully terminate without hanging
    if (mutableWatcher && typeof mutableWatcher.unref === 'function') {
      mutableWatcher.unref();
    }
    console.log(`[RAG Watcher] Actively monitoring live markdown updates in: ${MUTABLE_DIR}`);
  } catch (watchErr) {
    console.warn('[RAG Watcher] Unable to initialize fs.watch on mutable directory:', watchErr.message);
  }
} else {
  fs.mkdirSync(MUTABLE_DIR, { recursive: true });
}

/**
 * POST /api/chat
 * Primary conversational interface executing RAG retrieval, Gemma 4 inference, and tool loops.
 */
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Field "message" is required and must be a non-empty string.'
    });
  }

  const validHistory = Array.isArray(history)
    ? history.filter(item => item && typeof item.role === 'string' && typeof item.content === 'string')
    : [];

  try {
    const result = await agent.chat(message.trim(), validHistory);
    return res.json({
      success: true,
      response: result.text,
      toolsUsed: result.toolsUsed,
      sources: result.sources,
      durationMs: result.durationMs,
      offlineNotice: result.offlineNotice || false
    });
  } catch (err) {
    console.error('[API /api/chat] Unexpected processing failure:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while processing the cultural assistant request.',
      details: err.message
    });
  }
});

/**
 * GET /api/health
 * System health status including Ollama connectivity and RAG statistics.
 */
app.get('/api/health', async (req, res) => {
  let ollamaOnline = false;
  let modelsAvailable = [];

  try {
    const listRes = await agent.ollama.list();
    ollamaOnline = true;
    modelsAvailable = listRes?.models?.map(m => m.name) || [];
  } catch (e) {
    ollamaOnline = false;
  }

  const ragStats = ragEngine.getStats();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    service: 'Krakow Cultural AI Assistant',
    ollama: {
      online: ollamaOnline,
      host: agent.ollamaHost,
      configuredModel: agent.model,
      availableModels: modelsAvailable
    },
    rag: ragStats
  });
});

/**
 * GET /api/rag/stats
 * Telemetry endpoint exposing document counts across static and mutable layers.
 */
app.get('/api/rag/stats', (req, res) => {
  res.json({
    success: true,
    data: ragEngine.getStats()
  });
});

/**
 * GET /api/tools
 * Introspection endpoint enumerating all bound native JavaScript tools.
 */
app.get('/api/tools', (req, res) => {
  res.json({
    success: true,
    tools: toolDefinitions.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters
    }))
  });
});

/**
 * POST /api/tools/:toolName
 * Direct invocation endpoint for testing individual agent tools.
 */
app.post('/api/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const toolArgs = req.body || {};

  if (!toolsByName[toolName]) {
    return res.status(404).json({
      success: false,
      error: `Tool '${toolName}' not found. Available: ${Object.keys(toolsByName).join(', ')}`
    });
  }

  try {
    const output = await agent.executeTool(toolName, toolArgs);
    return res.json({
      success: true,
      tool: toolName,
      output
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /dev-ui
 * Redirects browser clients directly to the official Google ADK Web Dev-UI.
 */
app.get('/dev-ui', (req, res) => {
  const targetHost = req.hostname === '0.0.0.0' ? 'localhost' : req.hostname;
  res.redirect(`http://${targetHost}:${ADK_PORT}/dev-ui`);
});

// Fallback route for SPA client navigation
app.use((req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Krakow Cultural Assistant Frontend not found. Ensure public/index.html exists.');
  }
});

let server = null;
let adkServer = null;

/**
 * Start the official Google ADK API and Web Dev-UI server in the same process.
 * @param {number} [port=ADK_PORT]
 * @param {string} [host=HOST]
 * @returns {Promise<AdkApiServer|null>}
 */
export async function startAdkServer(port = ADK_PORT, host = HOST) {
  try {
    const bindHost = host === '0.0.0.0' ? '127.0.0.1' : host;
    adkServer = new AdkApiServer({
      agentsDir: projectRoot,
      port,
      host: bindHost,
      serveDebugUI: true,
      allowedHosts: ['localhost', '127.0.0.1', bindHost]
    });
    await adkServer.start();
    console.log(`🧭 Google ADK Web Dev-UI running at: http://${bindHost}:${port}/dev-ui`);
    return adkServer;
  } catch (err) {
    console.warn(`[ADK Server] Note: Google ADK Dev-UI could not bind on port ${port}: ${err.message}`);
    return null;
  }
}

/**
 * Stop the Google ADK server if running.
 */
export async function stopAdkServer() {
  if (adkServer) {
    try {
      await adkServer.stop();
      adkServer = null;
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

/**
 * Start the HTTP server (Express + Google ADK Dev-UI).
 * @param {number} [port=PORT]
 * @param {string} [host=HOST]
 * @returns {Promise<import('node:http').Server>}
 */
export async function startServer(port = PORT, host = HOST) {
  // Start the official Google ADK Web Dev-UI concurrently in the same process
  await startAdkServer(ADK_PORT, host);

  return new Promise((resolve) => {
    server = app.listen(port, host, () => {
      console.log(`=======================================================`);
      console.log(`🏰 Kraków Cultural AI Assistant running locally`);
      console.log(`📡 URL: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
      console.log(`🧭 Google ADK Dev-UI: http://${host === '0.0.0.0' ? 'localhost' : host}:${ADK_PORT}/dev-ui`);
      console.log(`🧠 Local Model: ${agent.model} via Ollama (${agent.ollamaHost})`);
      console.log(`📁 Mutable RAG Directory: ${MUTABLE_DIR}`);
      console.log(`=======================================================`);
      resolve(server);
    });
  });
}

// Auto-start when executed directly and not in test mode
if (process.env.NODE_ENV !== 'test') {
  startServer(PORT, HOST);
}

// Graceful process shutdown handler
const shutdown = async () => {
  console.log('\n[Server] Received shutdown signal. Closing HTTP listeners...');
  await stopAdkServer();
  if (server) {
    server.close(() => {
      console.log('[Server] Process terminated cleanly.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, server, adkServer };
