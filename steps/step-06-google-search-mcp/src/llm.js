import { Ollama } from 'ollama';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables from step directory or root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || process.env.MODEL || 'gemma4:e2b';

/**
 * Creates and returns an Ollama client instance.
 * @param {string} [host=OLLAMA_HOST]
 * @returns {Ollama}
 */
export function createOllamaClient(host = OLLAMA_HOST) {
  return new Ollama({ host });
}

/**
 * Check if the local Ollama daemon is reachable and whether the target model is installed.
 * @param {Ollama} [client]
 * @param {string} [targetModel=OLLAMA_MODEL]
 * @returns {Promise<{ online: boolean, models: string[], modelFound: boolean }>}
 */
export async function checkOllamaHealth(client = createOllamaClient(), targetModel = OLLAMA_MODEL) {
  try {
    const listResponse = await client.list();
    const modelNames = listResponse?.models?.map(m => m.name) || [];
    const modelFound = modelNames.some(name => name === targetModel || name.startsWith(targetModel.split(':')[0]));
    return {
      online: true,
      models: modelNames,
      modelFound
    };
  } catch (error) {
    return {
      online: false,
      models: [],
      modelFound: false,
      error: error.message
    };
  }
}

/**
 * Perform a simple text generation query against local Gemma 4.
 * @param {string} prompt
 * @param {object} [options]
 * @returns {Promise<{ response: string, durationMs: number }>}
 */
export async function queryGemma(prompt, options = {}) {
  const client = options.client || createOllamaClient();
  const model = options.model || OLLAMA_MODEL;

  const start = Date.now();
  const res = await client.generate({
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.2
    }
  });

  return {
    response: res.response.trim(),
    durationMs: Date.now() - start
  };
}

// Standalone execution verification
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('🔍 Checking local Ollama connectivity at:', OLLAMA_HOST);
  console.log('🧠 Target Model:', OLLAMA_MODEL);

  const health = await checkOllamaHealth();
  if (!health.online) {
    console.error('❌ Could not connect to Ollama daemon! Ensure "ollama serve" is running.');
    process.exit(1);
  }

  console.log('✅ Ollama daemon is ONLINE.');
  console.log('📦 Available models:', health.models.join(', ') || '(none)');

  if (!health.modelFound) {
    console.warn(`⚠️ Warning: Model "${OLLAMA_MODEL}" not found in local library. Run: ollama pull ${OLLAMA_MODEL}`);
  } else {
    console.log(`✅ Model "${OLLAMA_MODEL}" is ready locally!`);
    console.log('\n🚀 Sending test query to Gemma 4: "Summarize Kraków in one short sentence."\n');

    const result = await queryGemma('Summarize Kraków in one short sentence.');
    console.log('💬 Gemma 4 Response:\n' + result.response);
    console.log(`⏱️ Duration: ${result.durationMs}ms`);
  }
}
