import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOllamaClient, checkOllamaHealth, queryGemma, OLLAMA_HOST, OLLAMA_MODEL } from '../src/llm.js';

describe('Step 1: Local Ollama & Gemma 4 Connectivity Tests', () => {
  it('creates an Ollama client instance with default host', () => {
    const client = createOllamaClient();
    assert.ok(client);
    assert.strictEqual(typeof client.generate, 'function');
    assert.strictEqual(typeof client.list, 'function');
  });

  it('creates an Ollama client instance with custom host', () => {
    const customHost = 'http://127.0.0.1:11434';
    const client = createOllamaClient(customHost);
    assert.ok(client);
  });

  it('checks Ollama daemon health and model availability', async () => {
    const health = await checkOllamaHealth();
    assert.strictEqual(typeof health.online, 'boolean');
    assert.ok(Array.isArray(health.models));

    if (health.online) {
      console.log(`[Test] Ollama is online with ${health.models.length} model(s): ${health.models.join(', ')}`);
      assert.ok(health.modelFound, `Target model ${OLLAMA_MODEL} should be pulled locally`);
    } else {
      console.warn('[Test] Ollama daemon is offline during test run.');
    }
  });

  it('handles offline host gracefully without unhandled rejections', async () => {
    const offlineClient = createOllamaClient('http://127.0.0.1:59999');
    const health = await checkOllamaHealth(offlineClient);
    assert.strictEqual(health.online, false);
    assert.deepStrictEqual(health.models, []);
    assert.strictEqual(health.modelFound, false);
    assert.ok(health.error);
  });

  it('executes queryGemma if Ollama is online or catches error gracefully', async () => {
    const health = await checkOllamaHealth();
    if (!health.online || !health.modelFound) {
      console.log('[Test] Skipping live query test because Ollama/model is unavailable');
      return;
    }

    const res = await queryGemma('Say "DevFest Krakow" and nothing else.');
    assert.ok(typeof res.response === 'string');
    assert.ok(res.response.length > 0);
    assert.ok(typeof res.durationMs === 'number');
    assert.ok(res.durationMs > 0);
  });
});
