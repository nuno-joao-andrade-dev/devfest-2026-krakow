import { Ollama } from 'ollama';
import { Agent, FunctionTool, BaseLlm, InMemoryRunner } from '@google/adk';
import { DualLocalRAGEngine } from './ragEngine.js';
import { toolsByName, toolDefinitions } from './tools.js';

/**
 * System prompt establishing the persona and grounding rules for the assistant.
 */
export const DEFAULT_SYSTEM_INSTRUCTION = `You are the official Krakow Cultural AI Assistant — an expert Tour Guide, Historian, and City Concierge for Kraków, Poland.

Core Principles & Behavioral Guidelines:
1. Deeply Knowledgeable & Grounded: Answer questions about Kraków's landmarks, royal history, churches, legends, and Jewish heritage with rich detail and passion.
2. Anti-Hallucination: Strictly ground factual claims regarding admission prices, opening hours, ticket quotas, and contact info in native tool responses (especially 'getWawelTicketAvailability' for live Wawel admission pricing) and provided [Retrieved Local Knowledge].
3. Native Tool Usage:
   - For trumpet call times, mechanics, and cardinal directions, execute the 'getTrumpetCallSchedule' tool.
   - For Wawel Castle & Cathedral admission prices, ticket costs, exhibition fees, ticket counts, quotas, or bookings (with or without a specific date), execute the 'getWawelTicketAvailability' tool.
   - For restaurant, milk bar (bar mleczny), street food, or fine dining advice, execute the 'recommendLocalDining' tool.
4. Tone & Style: Warm, welcoming, historically accurate, polished, and structured. Use Polish cultural terminology where appropriate (e.g., Rynek Główny, Sukiennice, Hejnał, Smok Wawelski, Zapiekanka, Bar Mleczny).
5. Language: Answer in the same language the user uses (defaulting to English for international travelers, or Polish if greeted in Polish).`;

/**
 * Custom LLM provider integrating local Ollama models into the official Google ADK.
 * Subclasses @google/adk's BaseLlm.
 */
export class OllamaLlm extends BaseLlm {
  /**
   * @param {object} params
   * @param {string} [params.model=process.env.OLLAMA_MODEL || 'gemma4:e2b']
   * @param {string} [params.host=process.env.OLLAMA_HOST || 'http://127.0.0.1:11434']
   */
  constructor({
    model = process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b',
    host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
  } = {}) {
    super({ model });
    this.host = host;
    this.client = new Ollama({ host });
  }

  /**
   * Generates content for an ADK LLM request using local Ollama.
   * @param {object} llmRequest - ADK LLM Request object
   * @param {boolean} [stream=false]
   * @param {AbortSignal} [abortSignal]
   */
  async *generateContentAsync(llmRequest, stream = false, abortSignal) {
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

    // Convert ADK tools to Ollama tool definitions
    const tools = [];
    if (llmRequest.toolsDict) {
      for (const [name, t] of Object.entries(llmRequest.toolsDict)) {
        tools.push({
          type: 'function',
          function: {
            name: t.name || name,
            description: t.description || '',
            parameters: t.parameters || { type: 'object', properties: {} }
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
 * KrakowCulturalAgent
 * Google ADK (Agent Development Kit v2.1.0) Agent component for Node.js,
 * orchestrating local Gemma 4, dual-layer RAG context injection, and asynchronous tool bindings.
 */
export class KrakowCulturalAgent {
  /**
   * @param {object} [config]
   * @param {string} [config.model] - Name of the local Ollama model
   * @param {string} [config.ollamaHost] - Ollama server endpoint
   * @param {DualLocalRAGEngine} [config.ragEngine] - Injected RAG engine instance
   * @param {object} [config.tools] - Map of tool implementations
   * @param {Array<object>} [config.toolDeclarations] - Tool schemas for model
   * @param {string} [config.systemInstruction] - Base system prompt
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
    this.ollama = new Ollama({
      host: this.ollamaHost
    });

    // Custom ADK BaseLlm connected to local Ollama
    this.ollamaLlm = new OllamaLlm({
      model: this.model,
      host: this.ollamaHost
    });

    // Register Google ADK FunctionTools
    this.functionTools = this.initFunctionTools();

    // Create the official @google/adk Agent instance
    this.adkAgent = new Agent({
      name: 'krakow_cultural_agent',
      model: this.ollamaLlm,
      instruction: this.systemInstruction,
      tools: this.functionTools
    });

    // Create the @google/adk InMemoryRunner
    this.adkRunner = new InMemoryRunner({
      agent: this.adkAgent
    });
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
   * Assemble system prompt with dynamically retrieved RAG context.
   * @param {string} userMessage - User query
   * @returns {{ systemPrompt: string, sources: Array<object> }}
   */
  buildGroundedSystemPrompt(userMessage) {
    const { contextText, sources } = this.ragEngine.formatContextForPrompt(userMessage, 4);

    const systemPrompt = `${this.systemInstruction}

[Retrieved Local Knowledge Base - RAG Grounding]
${contextText}

Use the above verified local knowledge to answer questions accurately without fabricating dates, costs, or contacts.`;

    return { systemPrompt, sources };
  }

  /**
   * Execute an individual tool invocation by name with input arguments.
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
      } catch (e) {
        parsedArgs = { raw: toolArgs };
      }
    }

    console.log(`[Agent] Executing tool '${toolName}' with arguments:`, JSON.stringify(parsedArgs));
    const startTime = Date.now();
    try {
      const output = await fn(parsedArgs || {});
      const elapsed = Date.now() - startTime;
      console.log(`[Agent] Completed tool '${toolName}' in ${elapsed}ms`);
      return output;
    } catch (err) {
      console.error(`[Agent] Tool '${toolName}' threw an error:`, err.message);
      return {
        error: `Tool execution failed: ${err.message}`
      };
    }
  }

  /**
   * Core agent processing turn utilizing @google/adk InMemoryRunner with Ollama Gemma 4.
   * @param {string} userMessage - User's input prompt
   * @param {Array<{ role: string, content: string }>} [chatHistory=[]] - Previous conversation history
   * @returns {Promise<{ text: string, toolsUsed: Array<object>, sources: Array<object>, durationMs: number }>}
   */
  async chat(userMessage, chatHistory = []) {
    const startTime = Date.now();
    const toolsUsed = [];

    // 1. Enrich prompt with dual-layer local RAG context
    const { systemPrompt, sources } = this.buildGroundedSystemPrompt(userMessage);

    // Dynamic session ID for the turn
    const userId = 'visitor_' + Date.now();

    try {
      // 2. Instantiate dynamic ADK Agent with current grounded system prompt
      const dynamicAgent = new Agent({
        name: 'krakow_cultural_agent',
        model: this.ollamaLlm,
        instruction: systemPrompt,
        tools: this.functionTools
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

      // Graceful fallback explaining local LLM state while still providing RAG context
      return this.handleOllamaOfflineFallback(userMessage, sources, networkErr);
    }
  }

  /**
   * Fallback response generator if the local Ollama instance is not yet running or model is downloading.
   * Synthesizes an informative answer using the grounded RAG context and executes direct tools if relevant.
   * @private
   */
  async handleOllamaOfflineFallback(userMessage, sources, error) {
    console.warn('[Agent] Operating in Grounded RAG Direct Mode (Ollama offline).');

    // Run deterministic tool if query directly asks for schedule, tickets, or food
    const toolsUsed = [];
    let toolSummary = '';

    const lower = userMessage.toLowerCase();
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
      toolSummary += `\n\n🏰 **Wawel Ticket & Pricing Check:** ${result.mondaySpecialNotice || result.recommendation}. State Rooms: ${stateRooms?.availableTickets} tickets remaining${priceText}. Booking: ${result.officialBookingPortal}`;
    }

    if (lower.includes('eat') || lower.includes('food') || lower.includes('restaurant') || lower.includes('bar mleczny') || lower.includes('dining')) {
      const result = await this.executeTool('recommendLocalDining', { district: 'Old Town', budget: 'moderate' });
      toolsUsed.push({ name: 'recommendLocalDining', args: { district: 'Old Town', budget: 'moderate' }, result });
      toolSummary += `\n\n🍽️ **Top Culinary Recommendation:** ${result.recommendations[0]?.name} (${result.recommendations[0]?.cuisine}) - ${result.recommendations[0]?.address}.`;
    }

    const topKnowledge = sources.length > 0
      ? sources.map(s => `• **${s.title}** (${s.file || s.source || s.layer}): ${s.snippet || ''}`).join('\n\n')
      : 'No specific snippet matched.';

    const notice = `> ⚠️ *Note: Local Ollama daemon is currently offline at ${this.ollamaHost} or model \`${this.model}\` is loading (${error.message}). Displaying grounded knowledge from Kraków dual-layer RAG engine.*`;

    const generatedText = `${notice}\n\n### Kraków Cultural Knowledge Engine (ADK Grounded Mode)\n\n**Matching Archival & Live Records:**\n${topKnowledge}${toolSummary}\n\n*To activate full local conversational intelligence, start Ollama with:* \`ollama run gemma4\``;

    return {
      text: generatedText,
      toolsUsed,
      sources,
      durationMs: 50,
      offlineNotice: true
    };
  }
}
