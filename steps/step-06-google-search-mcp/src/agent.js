import { Agent, BaseLlm, FunctionTool, InMemoryRunner } from '@google/adk';
import { Ollama } from 'ollama';
import { DualLocalRAGEngine } from './ragEngine.js';
import { toolDefinitions, toolsByName } from './tools.js';
import { createSearchMcpToolset } from './mcpClient.js';

export const DEFAULT_SYSTEM_INSTRUCTION = `You are the Krakow Cultural AI Concierge, an intelligent, local-first ambassador for the Royal Capital City of Kraków (Małopolska, Poland).

Core Responsibilities:
1. Provide historically accurate, culturally grounded assistance for Kraków visitors.
2. Rely primarily on verified local knowledge for historical monuments (Wawel, St. Mary's Basilica, Main Market Square, Kazimierz) and general history.
3. Call native tools for live data, pricing, and precise calculations:
   - Execute 'getWawelTicketAvailability' whenever asked about Wawel Royal Castle & Cathedral admission prices, ticket costs, exhibition fees, ticket availability, or quotas (with or without a specific date).
   - Execute 'getTrumpetCallSchedule' for Hejnał Mariacki time math, schedule, and mechanics.
   - Execute 'recommendLocalDining' for curated dining and culinary filters.
4. Call Google Search MCP tools (google_search, get_krakow_events_calendar) for dynamic cross-content: seasonal festivals, film & music events, live weather, temporary exhibitions (e.g., Leonardo da Vinci's Lady with an Ermine at Czartoryski Museum), and municipal transit updates.
5. If local RAG and native tools do not contain the answer, seamlessly use google_search to retrieve external information.
6. Adopt a warm, welcoming, scholarly yet accessible tone. Always cite sources where appropriate.`;

/**
 * Custom Google ADK BaseLlm implementation wrapping the local Ollama daemon.
 */
export class OllamaLlm extends BaseLlm {
  /**
   * @param {object} options
   * @param {string} [options.model] - Target model name
   * @param {string} [options.host] - Ollama endpoint
   */
  constructor({
    model = process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b',
    host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
  } = {}) {
    super({ model });
    this.client = new Ollama({ host });
  }

  /**
   * Transforms ADK LlmRequest to Ollama chat format and streams chunks back.
   * Supports both native FunctionTools and MCPTools.
   */
  async *generateContentAsync(llmRequest, stream, abortSignal) {
    const messages = [];

    // System instruction
    if (llmRequest.config?.systemInstruction) {
      const sysText = typeof llmRequest.config.systemInstruction === 'string'
        ? llmRequest.config.systemInstruction
        : llmRequest.config.systemInstruction.parts?.map(p => p.text).join('\n');
      if (sysText) {
        messages.push({ role: 'system', content: sysText });
      }
    }

    // Convert ADK message contents to Ollama chat format
    for (const item of (llmRequest.contents || [])) {
      if (item.role === 'user') {
        const text = item.parts?.map(p => p.text || '').join('\n') || '';
        const toolResponses = item.parts?.filter(p => p.functionResponse);

        if (toolResponses && toolResponses.length > 0) {
          for (const tr of toolResponses) {
            messages.push({
              role: 'tool',
              content: JSON.stringify(tr.functionResponse.response)
            });
          }
        } else if (text) {
          messages.push({ role: 'user', content: text });
        }
      } else if (item.role === 'model') {
        const toolCalls = item.parts?.filter(p => p.functionCall);
        if (toolCalls && toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: '',
            tool_calls: toolCalls.map(tc => ({
              function: {
                name: tc.functionCall.name,
                arguments: tc.functionCall.args || {}
              }
            }))
          });
        } else {
          const text = item.parts?.map(p => p.text || '').join('\n') || '';
          messages.push({ role: 'assistant', content: text });
        }
      }
    }

    // Convert ADK tools (FunctionTool and MCPTool) to Ollama tool definitions
    const tools = [];
    if (llmRequest.toolsDict) {
      for (const [name, t] of Object.entries(llmRequest.toolsDict)) {
        const parameters = t.parameters || t.mcpTool?.inputSchema || { type: 'object', properties: {} };
        tools.push({
          type: 'function',
          function: {
            name: t.name || name,
            description: t.description || '',
            parameters
          }
        });
      }
    }

    const response = await this.client.chat({
      model: this.model,
      messages,
      tools: tools.length > 0 ? tools : undefined
    });

    if (abortSignal?.aborted) return;

    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      yield {
        content: {
          role: 'model',
          parts: response.message.tool_calls.map((tc, idx) => ({
            functionCall: {
              id: tc.id || `call_${Date.now()}_${idx}`,
              name: tc.function.name,
              args: typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments || '{}')
                : (tc.function.arguments || {})
            }
          }))
        },
        turnComplete: true
      };
    } else {
      yield {
        content: {
          role: 'model',
          parts: [{ text: response.message.content || '' }]
        },
        finishReason: 'STOP',
        turnComplete: true
      };
    }
  }
}

/**
 * Full-featured Kraków Cultural Agent orchestrating Local RAG, Native FunctionTools,
 * and external Google Search via Model Context Protocol (MCP).
 */
export class KrakowCulturalAgent {
  /**
   * @param {object} [config]
   * @param {string} [config.model] - Model identifier
   * @param {string} [config.ollamaHost] - Ollama daemon URL
   * @param {DualLocalRAGEngine} [config.ragEngine] - Local RAG instance
   * @param {object} [config.tools] - Native JavaScript functions
   * @param {Array<object>} [config.toolDeclarations] - Tool declarations
   * @param {string} [config.systemInstruction] - Base system prompt
   * @param {MCPToolset} [config.mcpToolset] - Optional custom MCPToolset
   */
  constructor(config = {}) {
    this.model = config.model || process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b';
    this.ollamaHost = config.ollamaHost || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    this.ragEngine = config.ragEngine || new DualLocalRAGEngine();
    this.tools = config.tools || toolsByName;
    this.toolDeclarations = config.toolDeclarations || toolDefinitions;
    this.systemInstruction = config.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
    this.maxToolLoops = 5;

    // Ollama client for fallback and direct operations
    this.ollama = new Ollama({ host: this.ollamaHost });

    // Custom ADK BaseLlm connected to local Ollama
    this.ollamaLlm = new OllamaLlm({
      model: this.model,
      host: this.ollamaHost
    });

    // Native Google ADK FunctionTools
    this.functionTools = this.initFunctionTools();

    // MCP Toolset for Google Search & Dynamic Cross-Content
    this.mcpToolset = config.mcpToolset || createSearchMcpToolset();
    this.mcpTools = [];
    this.mcpLoaded = false;
  }

  /**
   * Wraps native JavaScript tools into official Google ADK FunctionTools.
   * @returns {Array<FunctionTool>}
   */
  initFunctionTools() {
    const adkTools = [];
    for (const toolDef of this.toolDeclarations) {
      const toolName = toolDef.function.name;
      const fn = this.tools[toolName];
      if (typeof fn === 'function') {
        adkTools.push(new FunctionTool({
          name: toolName,
          description: toolDef.function.description || '',
          parameters: toolDef.function.parameters || { type: 'object', properties: {} },
          execute: async (args) => {
            return await this.executeTool(toolName, args);
          }
        }));
      }
    }
    return adkTools;
  }

  /**
   * Initializes and loads MCP tools asynchronously from the MCP server.
   * @returns {Promise<Array<object>>}
   */
  async loadMcpTools() {
    if (!this.mcpLoaded) {
      try {
        this.mcpTools = await this.mcpToolset.getTools();
        this.mcpLoaded = true;
      } catch (err) {
        console.warn('[Agent] Unable to initialize MCP Toolset:', err.message);
        this.mcpTools = [];
      }
    }
    return this.mcpTools;
  }

  /**
   * Assemble system prompt with dynamically retrieved RAG context.
   * @param {string} userMessage - User query
   * @returns {{ systemPrompt: string, sources: Array<object> }}
   */
  buildGroundedSystemPrompt(userMessage) {
    const { contextText, sources } = this.ragEngine.formatContextForPrompt(userMessage, 4);

    const systemPrompt = `${this.systemInstruction}

[Retrieved Local Knowledge Base - RAG Grounding]
${contextText}

Use the above verified local knowledge when answering historical or municipal questions. For external cultural festivals, temporary exhibits (e.g. Lady with an Ermine), or live weather, invoke the Google Search MCP tools.`;

    return { systemPrompt, sources };
  }

  /**
   * Execute an individual native tool invocation by name with input arguments.
   * @param {string} toolName - Registered tool name
   * @param {object|string} toolArgs - Arguments from LLM
   * @returns {Promise<object>} Execution result
   */
  async executeTool(toolName, toolArgs) {
    const fn = this.tools[toolName];
    if (typeof fn !== 'function') {
      const errorMsg = `Tool '${toolName}' is not registered on this agent.`;
      console.warn(`[Agent] ${errorMsg}`);
      return { error: errorMsg };
    }

    let parsedArgs = toolArgs;
    if (typeof toolArgs === 'string') {
      try {
        parsedArgs = JSON.parse(toolArgs);
      } catch {
        parsedArgs = {};
      }
    }

    const start = Date.now();
    try {
      console.log(`[Agent] Executing tool '${toolName}' with arguments:`, JSON.stringify(parsedArgs));
      const result = await fn(parsedArgs);
      console.log(`[Agent] Completed tool '${toolName}' in ${Date.now() - start}ms`);
      return result;
    } catch (err) {
      console.error(`[Agent] Tool execution failed for '${toolName}':`, err.message);
      return { error: err.message };
    }
  }

  /**
   * Core multi-turn agent processing turn utilizing Google ADK InMemoryRunner,
   * Local RAG Grounding, and Dynamic Google Search via MCP.
   *
   * @param {string} userMessage - User's input prompt
   * @param {Array<{ role: string, content: string }>} [chatHistory=[]] - Previous conversation history
   * @returns {Promise<{ text: string, toolsUsed: Array<object>, sources: Array<object>, durationMs: number }>}
   */
  async chat(userMessage, chatHistory = []) {
    const startTime = Date.now();
    const toolsUsed = [];

    // 1. Enrich prompt with dual-layer local RAG context
    const { systemPrompt, sources } = this.buildGroundedSystemPrompt(userMessage);

    // 2. Ensure MCP tools are discovered
    const mcpTools = await this.loadMcpTools();
    const allTools = [...this.functionTools, ...mcpTools];

    const userId = 'visitor_' + Date.now();

    try {
      // 3. Create dynamic Agent instance with both native and MCP tools
      const dynamicAgent = new Agent({
        name: 'krakow_cultural_mcp_agent',
        model: this.ollamaLlm,
        instruction: systemPrompt,
        tools: allTools
      });

      const runner = new InMemoryRunner({ agent: dynamicAgent });

      let finalContent = '';
      let llmError = null;

      // Run multi-turn tool calling loop through official Google ADK
      for await (const event of runner.runEphemeral({
        userId,
        newMessage: {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      })) {
        if (event.errorCode || event.errorMessage) {
          llmError = new Error(event.errorMessage || event.errorCode);
        }

        if (event.content?.parts) {
          for (const part of event.content.parts) {
            if (part.functionCall) {
              toolsUsed.push({
                name: part.functionCall.name,
                args: part.functionCall.args,
                id: part.functionCall.id
              });
            } else if (part.functionResponse) {
              const matchingCall = toolsUsed.find(t => t.id === part.functionResponse.id || t.name === part.functionResponse.name);
              if (matchingCall) {
                matchingCall.result = part.functionResponse.response;
              }
            } else if (part.text) {
              finalContent += part.text;
            }
          }
        }
      }

      if (llmError && !finalContent.trim()) {
        return this.handleOllamaOfflineFallback(userMessage, sources, llmError);
      }

      const durationMs = Date.now() - startTime;
      return {
        text: finalContent.trim(),
        toolsUsed,
        sources,
        durationMs
      };
    } catch (networkErr) {
      console.error(`[Agent] Google ADK / Ollama connection failure (model: ${this.model}, host: ${this.ollamaHost}):`, networkErr.message);
      return this.handleOllamaOfflineFallback(userMessage, sources, networkErr);
    }
  }

  /**
   * Offline fallback mode: combines local RAG, native tools, and direct MCP tool fallback.
   * @private
   */
  async handleOllamaOfflineFallback(userMessage, sources, error) {
    console.warn('[Agent] Operating in Grounded RAG Direct Mode (Ollama offline).');

    const toolsUsed = [];
    let toolSummary = '';
    const lower = userMessage.toLowerCase();

    // Check Hejnał
    if (lower.includes('hejnał') || lower.includes('trumpet') || lower.includes('bugle')) {
      const result = await this.executeTool('getTrumpetCallSchedule', {});
      toolsUsed.push({ name: 'getTrumpetCallSchedule', args: {}, result });
      toolSummary += `\n\n🎺 **Live Hejnał Schedule:** Next call in ${result.nextOccurrenceInMinutes} minutes (at ${result.nextScheduledTime}). Played 4 times to cardinal directions from St. Mary's 82m tower.`;
    }

    // Check Wawel Tickets & Pricing
    const isWawelQuery = lower.includes('wawel') || lower.includes('castle') || lower.includes('cathedral');
    const isPriceOrTicket = lower.includes('ticket') || lower.includes('availability') || lower.includes('pricing') || lower.includes('price') || lower.includes('cost') || lower.includes('fee') || lower.includes('admission');
    if ((isWawelQuery && isPriceOrTicket) || lower.includes('ticket') || (lower.includes('price') && lower.includes('wawel'))) {
      const result = await this.executeTool('getWawelTicketAvailability', { date: 'today' });
      toolsUsed.push({ name: 'getWawelTicketAvailability', args: { date: 'today' }, result });
      const stateRooms = result.exhibitions?.[0];
      const priceText = stateRooms ? ` (Regular: ${stateRooms.priceRegularPLN} PLN, Reduced: ${stateRooms.priceReducedPLN} PLN)` : '';
      toolSummary += `\n\n🏰 **Wawel Ticket Availability & Pricing Check:** ${result.mondaySpecialNotice || result.recommendation}. State Rooms: ${stateRooms?.availableTickets} tickets remaining${priceText}. Booking: ${result.officialBookingPortal}`;
    }

    // Check Dining
    if (lower.includes('eat') || lower.includes('food') || lower.includes('restaurant') || lower.includes('bar mleczny') || lower.includes('dining')) {
      const result = await this.executeTool('recommendLocalDining', { district: 'Old Town', budget: 'moderate' });
      toolsUsed.push({ name: 'recommendLocalDining', args: { district: 'Old Town', budget: 'moderate' }, result });
      toolSummary += `\n\n🍽️ **Top Culinary Recommendation:** ${result.recommendations[0]?.name} (${result.recommendations[0]?.cuisine}) - ${result.recommendations[0]?.address}.`;
    }

    // Check MCP Google Search / Cultural Calendar
    if (lower.includes('festival') || lower.includes('event') || lower.includes('calendar') || lower.includes('weather') || lower.includes('exhibit') || lower.includes('ermine') || lower.includes('da vinci')) {
      const mcpTools = await this.loadMcpTools();
      const searchTool = mcpTools.find(t => t.name === 'google_search');
      if (searchTool) {
        try {
          const res = await searchTool.runAsync({
            args: { query: userMessage, numResults: 2 },
            toolContext: { abortSignal: new AbortController().signal }
          });
          const text = res?.content?.[0]?.text || '';
          toolsUsed.push({ name: 'google_search', args: { query: userMessage }, result: res });
          toolSummary += `\n\n🔍 **Live Search (Google Search MCP):**\n${text}`;
        } catch (e) {
          console.warn('[Agent] MCP fallback search error:', e.message);
        }
      }
    }

    const ragSnippets = sources.map(s => `• **${s.title}** (${s.file || s.source}): ${s.snippet || ''}`).join('\n\n');

    const synthesizedText = `[Grounded RAG Direct Mode - Local Knowledge & MCP Tools]

Witamy w Krakowie! I am operating in grounded direct-mode while the local Ollama LLM is offline or initializing.

Here is verified information retrieved directly from our local dual-layer knowledge base and MCP search tools:

${ragSnippets || 'No direct local historical documents matched, but tools have been executed below.'}
${toolSummary}

---
*Status: Powered by Google ADK & Dual-Layer RAG with Google Search MCP (Local Model offline).*`;

    return {
      text: synthesizedText,
      toolsUsed,
      sources,
      durationMs: 45
    };
  }

  /**
   * Gracefully close background MCP sessions.
   */
  async close() {
    if (this.mcpToolset) {
      await this.mcpToolset.close();
    }
  }
}

/**
 * Convenience factory to create a fully wired KrakowCulturalAgent with MCP support.
 * @param {object} [opts]
 * @returns {KrakowCulturalAgent}
 */
export function createAgent(opts = {}) {
  return new KrakowCulturalAgent(opts);
}

export { DualLocalRAGEngine } from './ragEngine.js';
export { toolDefinitions, toolsByName } from './tools.js';
