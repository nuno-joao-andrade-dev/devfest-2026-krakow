import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Agent, BaseLlm, InMemoryRunner } from '@google/adk';
import { KrakowCulturalAgent } from '../src/agent.js';
import { createSearchMcpToolset } from '../src/mcpClient.js';

describe('Google ADK & MCP Search Integration Tests', () => {

  it('initializes KrakowCulturalAgent and connects to MCP Server over stdio', async () => {
    const agent = new KrakowCulturalAgent();
    assert.ok(agent, 'Agent should be initialized');
    assert.strictEqual(typeof agent.chat, 'function', 'Agent should provide chat method');

    const mcpTools = await agent.loadMcpTools();
    assert.ok(Array.isArray(mcpTools), 'mcpTools must be an array');
    assert.strictEqual(mcpTools.length, 2, 'Should discover exactly 2 tools from MCP Server');

    const toolNames = mcpTools.map(t => t.name);
    assert.ok(toolNames.includes('google_search'), 'Must include google_search tool');
    assert.ok(toolNames.includes('get_krakow_events_calendar'), 'Must include get_krakow_events_calendar tool');

    await agent.close();
  });

  it('executes MCP google_search directly via tool instance', async () => {
    const toolset = createSearchMcpToolset();
    const tools = await toolset.getTools();
    const searchTool = tools.find(t => t.name === 'google_search');

    assert.ok(searchTool, 'google_search tool must be returned by toolset');
    assert.strictEqual(typeof searchTool.runAsync, 'function');

    const result = await searchTool.runAsync({
      args: { query: 'Jewish Culture Festival dates' },
      toolContext: { abortSignal: new AbortController().signal }
    });

    assert.ok(result, 'Result should exist');
    assert.ok(Array.isArray(result.content), 'Result should have content array');
    assert.match(result.content[0].text, /Jewish Culture Festival/i);
    assert.match(result.content[0].text, /Kazimierz/i);

    await toolset.close();
  });

  it('executes MCP get_krakow_events_calendar filtered by category', async () => {
    const toolset = createSearchMcpToolset();
    const tools = await toolset.getTools();
    const calendarTool = tools.find(t => t.name === 'get_krakow_events_calendar');

    const result = await calendarTool.runAsync({
      args: { season: 'summer', category: 'festivals' },
      toolContext: { abortSignal: new AbortController().signal }
    });

    assert.ok(result.content[0].text.includes('Jewish Culture Festival'));
    await toolset.close();
  });

  it('runs an ADK multi-turn execution loop calling google_search via InMemoryRunner', async () => {
    // Custom Mock LLM simulating ADK agent calling google_search then answering
    class MockSearchLlm extends BaseLlm {
      constructor() {
        super({ model: 'mock-gemma4' });
        this.step = 0;
      }
      async *generateContentAsync(llmRequest) {
        if (this.step === 0) {
          this.step++;
          yield {
            content: {
              role: 'model',
              parts: [{
                functionCall: {
                  id: 'call_search_1',
                  name: 'google_search',
                  args: { query: 'Leonardo da Vinci Lady with an Ermine exhibition' }
                }
              }]
            },
            turnComplete: true
          };
        } else {
          yield {
            content: {
              role: 'model',
              parts: [{
                text: 'Leonardo da Vinci\'s masterpiece *Lady with an Ermine* is exhibited at the Czartoryski Museum in Kraków.'
              }]
            },
            finishReason: 'STOP',
            turnComplete: true
          };
        }
      }
    }

    const toolset = createSearchMcpToolset();
    const mcpTools = await toolset.getTools();

    const testAgent = new Agent({
      name: 'test_mcp_agent',
      model: new MockSearchLlm(),
      instruction: 'You are a test cultural assistant.',
      tools: mcpTools
    });

    const runner = new InMemoryRunner({ agent: testAgent });
    const events = [];

    for await (const event of runner.runEphemeral({
      userId: 'test_user_42',
      newMessage: {
        role: 'user',
        parts: [{ text: 'Where can I see Leonardo da Vinci\'s Lady with an Ermine?' }]
      }
    })) {
      events.push(event);
    }

    // Verify tool call event
    const toolCallEvent = events.find(e =>
      e.content?.parts?.some(p => p.functionCall?.name === 'google_search')
    );
    assert.ok(toolCallEvent, 'InMemoryRunner should record the google_search functionCall');

    // Verify tool response event
    const toolRespEvent = events.find(e =>
      e.content?.parts?.some(p => p.functionResponse?.name === 'google_search')
    );
    assert.ok(toolRespEvent, 'InMemoryRunner should record the google_search functionResponse');
    assert.match(
      JSON.stringify(toolRespEvent.content),
      /Czartoryski Museum/i,
      'MCP response must contain Czartoryski Museum'
    );

    // Verify final synthesized text
    const finalEvent = events.find(e =>
      e.content?.parts?.some(p => p.text?.includes('Czartoryski Museum'))
    );
    assert.ok(finalEvent, 'Final response text must synthesize the MCP search findings');

    await toolset.close();
  });

  it('gracefully executes offline fallback with MCP tool execution', async () => {
    const agent = new KrakowCulturalAgent();
    const fallback = await agent.handleOllamaOfflineFallback(
      'When does the Kraków Film Festival start?',
      [],
      new Error('Model connection simulated offline')
    );

    assert.ok(fallback, 'Fallback object should be returned');
    assert.ok(fallback.text.includes('Film Festival') || fallback.text.includes('Google Search MCP'));
    assert.ok(fallback.toolsUsed.length >= 1, 'Should execute MCP search tool in fallback');
    assert.strictEqual(fallback.toolsUsed[0].name, 'google_search');

    await agent.close();
  });

  it('triggers getWawelTicketAvailability in fallback when asked for Wawel prices or tickets', async () => {
    const agent = new KrakowCulturalAgent();
    const fallback = await agent.handleOllamaOfflineFallback(
      'What are the Wawel Castle admission prices and ticket costs?',
      [],
      new Error('Model connection simulated offline')
    );

    assert.ok(fallback);
    assert.ok(fallback.toolsUsed.some(t => t.name === 'getWawelTicketAvailability'));
    assert.ok(fallback.text.includes('Wawel Ticket'));
    await agent.close();
  });
});
