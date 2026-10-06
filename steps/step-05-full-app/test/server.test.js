import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/server.js';

describe('Express REST API & Static Serving Tests', () => {
  let testServer;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        const port = testServer.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  it('GET /api/health returns system and RAG telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'healthy');
    assert.strictEqual(json.service, 'Krakow Cultural AI Assistant');
    assert.ok(json.rag.totalChunks > 0);
  });

  it('GET /api/tools returns registered tool definitions', async () => {
    const res = await fetch(`${baseUrl}/api/tools`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.tools));
    assert.strictEqual(json.tools.length, 3);
  });

  it('GET /api/rag/stats returns chunk telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/rag/stats`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.staticChunkCount > 0);
    assert.ok(json.data.mutableChunkCount > 0);
  });

  it('POST /api/tools/:toolName executes tool directly', async () => {
    const res = await fetch(`${baseUrl}/api/tools/getTrumpetCallSchedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.output.eventName, 'Hejnał Mariacki (St. Mary\'s Trumpet Call)');
  });

  it('POST /api/tools/recommendLocalDining returns culinary recommendations', async () => {
    const res = await fetch(`${baseUrl}/api/tools/recommendLocalDining`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district: 'Old Town', budget: 'milk bar' })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.output.recommendations.length > 0);
  });

  it('POST /api/tools/:toolName returns 404 for unknown tool', async () => {
    const res = await fetch(`${baseUrl}/api/tools/unknownToolName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.ok(json.error.includes('Tool \'unknownToolName\' not found'));
  });

  it('POST /api/chat rejects missing message parameter', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.ok(json.error.includes('Field "message" is required'));
  });

  it('POST /api/chat handles valid chat inquiry with grounded response', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What time is the next trumpet call?' })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.response);
    assert.ok(Array.isArray(json.sources));
    assert.ok(Array.isArray(json.toolsUsed));
    assert.ok(typeof json.durationMs === 'number');
  });

  it('GET / serves the static HTML single-page frontend', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Kraków Cultural AI Assistant'));
    assert.ok(html.includes('Hejnał'));
  });

  it('GET /unknown/spa/route falls back to serving static index.html', async () => {
    const res = await fetch(`${baseUrl}/tours/kazimierz`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Kraków Cultural AI Assistant'));
  });

  it('GET /dev-ui redirects to the Google ADK Web Dev-UI port', async () => {
    const res = await fetch(`${baseUrl}/dev-ui`, { redirect: 'manual' });
    assert.strictEqual(res.status, 302);
    assert.ok(res.headers.get('location').includes('/dev-ui'));
  });

  it('loads krakow_cultural_agent/agent.js as pure JavaScript rootAgent', async () => {
    const { rootAgent } = await import('../krakow_cultural_agent/agent.js');
    assert.ok(rootAgent);
    assert.strictEqual(rootAgent.name, 'krakow_cultural_agent');
    assert.ok(rootAgent.tools.some(t => t.name === 'search_krakow_knowledge'));
  });
});
