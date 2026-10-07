import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, agent } from '../src/server.js';

describe('Express REST API with Google Search MCP Tests', () => {
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
    if (agent) {
      await agent.close();
    }
  });

  it('GET /api/health returns system, RAG, and MCP telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'healthy');
    assert.match(json.service, /Google Search MCP/i);
    assert.ok(json.rag.totalChunks > 0);
    assert.ok(json.mcp, 'MCP telemetry object must be returned');
    assert.strictEqual(json.mcp.connected, true);
    assert.ok(json.mcp.tools.includes('google_search'));
    assert.ok(json.mcp.tools.includes('get_krakow_events_calendar'));
  });

  it('GET /api/tools returns both native and MCP registered tools', async () => {
    const res = await fetch(`${baseUrl}/api/tools`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.tools));
    assert.strictEqual(json.tools.length, 5, 'Should return 3 native + 2 MCP tools');

    const nativeTools = json.tools.filter(t => t.type === 'native_javascript');
    const mcpTools = json.tools.filter(t => t.type === 'model_context_protocol');

    assert.strictEqual(nativeTools.length, 3);
    assert.strictEqual(mcpTools.length, 2);
    assert.ok(mcpTools.some(t => t.name === 'google_search'));
  });

  it('POST /api/tools/:toolName executes native tool directly', async () => {
    const res = await fetch(`${baseUrl}/api/tools/getTrumpetCallSchedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.type, 'native');
    assert.strictEqual(json.output.eventName, 'Hejnał Mariacki (St. Mary\'s Trumpet Call)');
  });

  it('POST /api/tools/:toolName executes MCP google_search directly', async () => {
    const res = await fetch(`${baseUrl}/api/tools/google_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Czartoryski Museum Lady with an Ermine' })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.type, 'mcp');
    assert.ok(json.output.content);
    assert.match(json.output.content[0].text, /Czartoryski Museum/i);
  });

  it('POST /api/tools/:toolName executes MCP get_krakow_events_calendar directly', async () => {
    const res = await fetch(`${baseUrl}/api/tools/get_krakow_events_calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: 'summer' })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.type, 'mcp');
    assert.match(json.output.content[0].text, /Jewish Culture Festival/i);
  });

  it('POST /api/chat handles dynamic search inquiry', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is the schedule of the Jewish Culture Festival in Kazimierz?' })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.response);
    assert.ok(Array.isArray(json.toolsUsed));
    assert.ok(json.toolsUsed.some(t => t.name === 'google_search'));
  });

  it('GET / serves the updated frontend with MCP badges', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Kraków Cultural AI Assistant'));
    assert.ok(html.includes('tag-mcp'));
    assert.ok(html.includes('Google Search MCP Server'));
  });

  it('GET /dev-ui redirects to the Google ADK Web Dev-UI port', async () => {
    const res = await fetch(`${baseUrl}/dev-ui`, { redirect: 'manual' });
    assert.strictEqual(res.status, 302);
    assert.ok(res.headers.get('location').includes('/dev-ui'));
  });

  it('loads krakow_cultural_agent/agent.js with 6 total tools', async () => {
    const { rootAgent } = await import('../krakow_cultural_agent/agent.js');
    assert.ok(rootAgent);
    assert.strictEqual(rootAgent.name, 'krakow_cultural_mcp_agent');
    assert.strictEqual(rootAgent.tools.length, 6);
  });
});
