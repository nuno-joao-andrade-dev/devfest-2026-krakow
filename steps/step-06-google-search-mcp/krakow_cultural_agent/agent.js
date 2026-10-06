import { Agent, FunctionTool } from '@google/adk';
import { KrakowCulturalAgent, OllamaLlm, DEFAULT_SYSTEM_INSTRUCTION } from '../src/agent.js';
import { DualLocalRAGEngine } from '../src/ragEngine.js';

const ragEngine = new DualLocalRAGEngine();

// RAG Search tool for ADK Web UI
const ragTool = new FunctionTool({
  name: 'search_krakow_knowledge',
  description: 'Search the local Kraków archival and live knowledge base for verified historical facts, opening hours, prices, and emergency contacts.',
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
const mcpTools = await baseAgent.loadMcpTools();

const tools = [
  ...baseAgent.functionTools,
  ragTool,
  ...mcpTools
];

export const rootAgent = new Agent({
  name: 'krakow_cultural_mcp_agent',
  description: 'Kraków Cultural AI Concierge with Dual-Layer RAG, Native FunctionTools, and Google Search MCP Server',
  model: new OllamaLlm({
    model: process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b',
    host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
  }),
  instruction: DEFAULT_SYSTEM_INSTRUCTION,
  tools
});

export default rootAgent;
