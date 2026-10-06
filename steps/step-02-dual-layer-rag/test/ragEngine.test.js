import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DualLocalRAGEngine, tokenize, parseMarkdownToChunks } from '../src/ragEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mutableDir = path.resolve(__dirname, '../data/mutable');

describe('DualLocalRAGEngine Unit Tests', () => {
  it('tokenizes text and strips stop words correctly', () => {
    const tokens = tokenize('The Wawel Castle in Kraków is a royal residence!');
    assert.ok(tokens.includes('wawel'));
    assert.ok(tokens.includes('castle'));
    assert.ok(tokens.includes('kraków'));
    assert.ok(tokens.includes('royal'));
    assert.ok(!tokens.includes('the'));
    assert.ok(!tokens.includes('in'));
    assert.ok(!tokens.includes('is'));
  });

  it('preserves Polish diacritics and letters during tokenization', () => {
    const tokens = tokenize('Żur, hejnał mariacki, kościół i sukiennice w Krakowie');
    assert.ok(tokens.includes('żur'));
    assert.ok(tokens.includes('hejnał'));
    assert.ok(tokens.includes('mariacki'));
    assert.ok(tokens.includes('kościół'));
    assert.ok(tokens.includes('sukiennice'));
    assert.ok(tokens.includes('krakowie'));
    assert.ok(!tokens.includes('i'));
    assert.ok(!tokens.includes('w'));
  });

  it('handles empty or non-string input safely in tokenize', () => {
    assert.deepStrictEqual(tokenize(''), []);
    assert.deepStrictEqual(tokenize('    '), []);
    assert.deepStrictEqual(tokenize(null), []);
    assert.deepStrictEqual(tokenize(undefined), []);
  });

  it('parses markdown headings into structured chunks', () => {
    const sampleMd = `# Section One\nContent for section one with crucial details.\n\n## Sub Section Two\nContent for subsection two with pricing and hours.`;
    const chunks = parseMarkdownToChunks(sampleMd, 'test.md');
    assert.strictEqual(chunks.length, 2);
    assert.ok(chunks[0].title.includes('Section One'));
    assert.ok(chunks[1].title.includes('Sub Section Two'));
  });

  it('initializes RAG engine and loads static knowledge', () => {
    const engine = new DualLocalRAGEngine({ mutableDir });
    const stats = engine.getStats();
    assert.ok(stats.staticChunkCount >= 8);
    assert.ok(stats.mutableChunkCount >= 2);
    assert.strictEqual(stats.totalChunks, stats.staticChunkCount + stats.mutableChunkCount);
  });

  it('retrieves relevant static historical content for Wawel dragon query', () => {
    const engine = new DualLocalRAGEngine({ mutableDir });
    const results = engine.retrieve('Who defeated the Wawel Dragon Smok Wawelski?');
    assert.ok(results.length > 0);
    const top = results[0];
    assert.ok(top.content.toLowerCase().includes('skuba') || top.title.toLowerCase().includes('dragon'));
    assert.strictEqual(top.layer, 'static');
  });

  it('retrieves relevant mutable content for Wawel pricing inquiry', () => {
    const engine = new DualLocalRAGEngine({ mutableDir });
    const results = engine.retrieve('How much does a ticket to Royal State Rooms cost at Wawel Castle?');
    assert.ok(results.length > 0);
    const foundMutable = results.find(r => r.layer === 'mutable');
    assert.ok(foundMutable, 'Expected at least one mutable layer chunk in results');
    assert.ok(foundMutable.content.includes('PLN'));
  });

  it('formats prompt context with accurate source attribution', () => {
    const engine = new DualLocalRAGEngine({ mutableDir });
    const { contextText, sources } = engine.formatContextForPrompt('Emergency tourist phone numbers in Krakow');
    assert.ok(sources.length > 0);
    assert.ok(contextText.includes('Knowledge Source'));
    assert.ok(contextText.includes('112') || contextText.includes('InfoKraków'));
  });

  it('hot-reloads dynamically when a new mutable file is written', () => {
    const engine = new DualLocalRAGEngine({ mutableDir });
    const initialStats = engine.getStats();

    const tempFile = path.resolve(mutableDir, 'temp_festival.md');
    try {
      fs.writeFileSync(tempFile, '# Pierogi Festival 2026\nThe annual Kraków Pierogi Festival takes place on Mały Rynek in August.');

      const results = engine.retrieve('pierogi festival');
      assert.ok(results.length > 0);
      assert.ok(results.some(r => r.title.includes('Pierogi Festival')));

      const newStats = engine.getStats();
      assert.ok(newStats.mutableChunkCount > initialStats.mutableChunkCount);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }

    // Verify cache invalidates after file deletion
    const afterDelete = engine.retrieve('pierogi festival');
    assert.ok(!afterDelete.some(r => r.title.includes('Pierogi Festival')));
  });
});
