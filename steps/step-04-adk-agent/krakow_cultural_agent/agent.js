import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent, FunctionTool } from '@google/adk';
import { KrakowCulturalAgent, OllamaLlm, DEFAULT_SYSTEM_INSTRUCTION } from '../src/agent.js';
import { DualLocalRAGEngine } from '../src/ragEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ragEngine = new DualLocalRAGEngine({
  mutableDir: path.resolve(__dirname, '../data/mutable')
});

// RAG Search tool for ADK Web UI
const ragTool = new FunctionTool({
  name: 'search_krakow_knowledge',
  description: 'Search the local Kraków archival and live knowledge base for verified historical facts, opening hours, and emergency contacts. (For Wawel Castle & Cathedral admission prices, fees, and tickets, use getWawelTicketAvailability instead).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query or topic to look up in the local Kraków corpus' }
    },
    required: ['query']
  },
  execute: async ({ query }) => {
    return ragEngine.query(query, 3);
  }
});

const baseAgent = new KrakowCulturalAgent({ ragEngine });

const tools = [
  ...baseAgent.functionTools,
  ragTool
];

export const rootAgent = new Agent({
  name: 'krakow_cultural_agent',
  model: new OllamaLlm({
    model: process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b',
    host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
  }),
  instruction: DEFAULT_SYSTEM_INSTRUCTION,
  tools
});

export default rootAgent;
