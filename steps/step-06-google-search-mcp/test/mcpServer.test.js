import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGoogleSearchMcpServer,
  executeGoogleSearch,
  KRAKOW_DYNAMIC_EVENTS,
  KRAKOW_SPECIAL_EXHIBITS,
  KRAKOW_CITY_INFO
} from '../src/mcpServer.js';

describe('Google Search & Dynamic Cross-Content MCP Server Unit Tests', () => {

  it('instantiates McpServer with expected server metadata', () => {
    const server = createGoogleSearchMcpServer();
    assert.ok(server, 'McpServer should be instantiated');
    assert.strictEqual(typeof server.tool, 'function', 'Server should have a tool registration method');
  });

  it('verifies static events database contains key annual Kraków festivals', () => {
    assert.ok(Array.isArray(KRAKOW_DYNAMIC_EVENTS), 'KRAKOW_DYNAMIC_EVENTS must be an array');
    assert.ok(KRAKOW_DYNAMIC_EVENTS.length >= 6, 'Should define at least 6 landmark cultural events');

    const filmFest = KRAKOW_DYNAMIC_EVENTS.find(e => e.id === 'kff-2026');
    assert.ok(filmFest, 'Kraków Film Festival must be registered');
    assert.match(filmFest.title, /Kraków Film Festival/i);
    assert.strictEqual(filmFest.category, 'film');

    const jewishFest = KRAKOW_DYNAMIC_EVENTS.find(e => e.id === 'fkz-2026');
    assert.ok(jewishFest, 'Jewish Culture Festival must be registered');
    assert.match(jewishFest.venue, /Kazimierz/i);
    assert.strictEqual(jewishFest.season, 'summer');

    const lajkonik = KRAKOW_DYNAMIC_EVENTS.find(e => e.id === 'lajkonik-2026');
    assert.ok(lajkonik, 'Lajkonik Pageant must be registered');
    assert.strictEqual(lajkonik.category, 'tradition');
  });

  it('verifies special exhibitions cross-content database', () => {
    assert.ok(Array.isArray(KRAKOW_SPECIAL_EXHIBITS), 'KRAKOW_SPECIAL_EXHIBITS must be an array');
    const daVinci = KRAKOW_SPECIAL_EXHIBITS.find(e => e.title.includes('Lady with an Ermine'));
    assert.ok(daVinci, 'Lady with an Ermine exhibit must be present');
    assert.match(daVinci.location, /Czartoryski Museum/i);
    assert.match(daVinci.hours, /Tuesday - Sunday/i);
  });

  it('executes search for Kraków festivals and returns accurate event citations', async () => {
    const results = await executeGoogleSearch('When is the Kraków Film Festival taking place?', 2);
    assert.ok(Array.isArray(results), 'Results should be an array');
    assert.ok(results.length > 0, 'Should return at least 1 result');
    
    const matched = results.some(r => r.title.includes('Film Festival') || r.snippet.includes('Film Festival'));
    assert.ok(matched, 'Results should match the film festival inquiry');
    assert.ok(results[0].link.startsWith('http'), 'Result link should be a valid URL');
    assert.ok(results[0].source, 'Result must include a source attribution');
  });

  it('executes search for Leonardo da Vinci and retrieves Czartoryski Museum details', async () => {
    const results = await executeGoogleSearch('Where is Leonardo da Vinci Lady with an Ermine exhibited?', 2);
    assert.ok(results.length > 0);
    const daVinciResult = results.find(r => r.title.includes('Lady with an Ermine'));
    assert.ok(daVinciResult, 'Should find Lady with an Ermine exhibit');
    assert.match(daVinciResult.snippet, /Czartoryski Museum/i);
    assert.match(daVinciResult.snippet, /PLN/i);
  });

  it('executes search for airport transit and returns Balice commuter train facts', async () => {
    const results = await executeGoogleSearch('How to get from Krakow Airport Balice to city center train', 2);
    assert.ok(results.length > 0);
    const airportResult = results.find(r => r.title.includes('Airport') || r.snippet.includes('Airport'));
    assert.ok(airportResult, 'Should find airport transit information');
    assert.match(airportResult.snippet, /SKA1/i);
    assert.match(airportResult.snippet, /17 minutes/i);
  });

  it('executes search for seasonal weather and returns temperature insights', async () => {
    const results = await executeGoogleSearch('What is the weather like in Kraków in summer?', 2);
    assert.ok(results.length > 0);
    const weatherResult = results.find(r => r.title.includes('Weather') || r.snippet.includes('Summer'));
    assert.ok(weatherResult, 'Should find weather results');
    assert.match(weatherResult.snippet, /22°C to 30°C/i);
  });

  it('provides graceful fallback search for generic queries', async () => {
    const results = await executeGoogleSearch('pottery workshop in podgórze', 1);
    assert.strictEqual(results.length, 1);
    assert.match(results[0].title, /Municipal Portal Search/i);
    assert.match(results[0].source, /InfoKraków/i);
  });
});
