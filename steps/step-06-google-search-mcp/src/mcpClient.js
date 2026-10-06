import { MCPToolset } from '@google/adk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and initializes a Google ADK MCPToolset that spawns and communicates
 * with the Google Search & Dynamic Cross-Content MCP Server via stdio.
 *
 * @param {string} [customServerScript] - Optional path to the MCP server script
 * @returns {MCPToolset}
 */
export function createSearchMcpToolset(customServerScript) {
  const serverPath = customServerScript || path.resolve(__dirname, 'mcpServer.js');

  return new MCPToolset({
    type: 'StdioConnectionParams',
    serverParams: {
      command: process.execPath, // Path to node binary
      args: [serverPath]
    }
  });
}
