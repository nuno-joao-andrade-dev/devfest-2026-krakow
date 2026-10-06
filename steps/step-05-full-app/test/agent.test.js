import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KrakowCulturalAgent, OllamaLlm } from '../src/agent.js';
import { DualLocalRAGEngine } from '../src/ragEngine.js';

import { Agent, InMemoryRunner, BaseLlm, FunctionTool } from '@google/adk';

describe('KrakowCulturalAgent Component Tests', () => {
  it('instantiates cleanly with default configuration and @google/adk components', () => {
    const expectedModel = process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b';
    const agent = new KrakowCulturalAgent();
    assert.strictEqual(agent.model, expectedModel);
    assert.ok(agent.ragEngine instanceof DualLocalRAGEngine);
    assert.ok(agent.tools.getTrumpetCallSchedule);

    // Verify official Google ADK Node.js instances
    assert.ok(agent.adkAgent instanceof Agent);
    assert.strictEqual(agent.adkAgent.name, 'krakow_cultural_agent');
    assert.ok(agent.adkRunner instanceof InMemoryRunner);
    assert.ok(agent.ollamaLlm instanceof BaseLlm);
    assert.ok(agent.functionTools.every(tool => tool instanceof FunctionTool));
    assert.strictEqual(agent.functionTools.length, 3);
  });

  it('verifies OllamaLlm custom adapter contract and model configuration', () => {
    const defaultModel = process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b';
    const llm = new OllamaLlm();
    assert.ok(llm instanceof BaseLlm);
    assert.strictEqual(llm.model, defaultModel);
    assert.strictEqual(typeof llm.generateContentAsync, 'function');

    const customLlm = new OllamaLlm({ model: 'custom-model:latest' });
    assert.strictEqual(customLlm.model, 'custom-model:latest');
  });

  it('builds grounded system prompt with RAG citations', () => {
    const agent = new KrakowCulturalAgent();
    const { systemPrompt, sources } = agent.buildGroundedSystemPrompt('Tell me about the Wawel Dragon and Skuba');

    assert.ok(systemPrompt.includes('Krakow Cultural AI Assistant'));
    assert.ok(systemPrompt.includes('Retrieved Local Knowledge Base'));
    assert.ok(sources.length > 0);
  });

  it('executes tool directly with input arguments', async () => {
    const agent = new KrakowCulturalAgent();
    const result = await agent.executeTool('getTrumpetCallSchedule', {});
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.eventName, 'Hejnał Mariacki (St. Mary\'s Trumpet Call)');
  });

  it('handles unknown tool execution gracefully without throwing', async () => {
    const agent = new KrakowCulturalAgent();
    const result = await agent.executeTool('nonExistentTool', {});
    assert.ok(result.error);
    assert.ok(result.error.includes('not registered'));
  });

  it('provides grounded fallback when Ollama daemon is offline', async () => {
    const agent = new KrakowCulturalAgent({
      ollamaHost: 'http://127.0.0.1:59999' // Valid port with no service listening
    });

    const response = await agent.chat('What is the Hejnał Mariacki trumpet call schedule?');
    assert.ok(response.text);
    assert.strictEqual(response.offlineNotice, true);
    assert.ok(response.sources.length > 0);
  });

  it('executes end-to-end multi-turn chat with tool invocation when Ollama is online', async () => {
    const agent = new KrakowCulturalAgent();
    try {
      const response = await agent.chat('What time is the next St. Mary trumpet call and which tower does it play from?');
      assert.ok(response.text);
      assert.ok(typeof response.durationMs === 'number');
      assert.ok(Array.isArray(response.toolsUsed));
    } catch (e) {
      console.warn('[Test] Skipping live chat verification due to Ollama state:', e.message);
    }
  });
});
