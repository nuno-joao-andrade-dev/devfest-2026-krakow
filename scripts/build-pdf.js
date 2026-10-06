#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  // Look in downloaded chrome folder
  const chromeBase = path.join(projectRoot, 'chrome');
  if (fs.existsSync(chromeBase)) {
    const entries = fs.readdirSync(chromeBase, { recursive: true });
    for (const entry of entries) {
      if (entry.endsWith('/chrome') || entry === 'chrome') {
        const fullPath = path.join(chromeBase, entry);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          return fullPath;
        }
      }
    }
  }

  // Standard locations
  const standardPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const p of standardPaths) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

const chromePath = findChrome();
const browserArg = chromePath ? `--browser-path "${chromePath}"` : '';

console.log('[PDF Builder] Compiling SLIDES.md to slides.pdf...');
if (chromePath) {
  console.log(`[PDF Builder] Using browser executable: ${chromePath}`);
}

try {
  execSync(
    `npx @marp-team/marp-cli SLIDES.md -o slides.pdf --pdf --html --allow-local-files ${browserArg}`,
    { cwd: projectRoot, stdio: 'inherit' }
  );
  
  // Also sync to step-05 and step-06 public folders
  const publicPdf05 = path.join(projectRoot, 'steps/step-05-full-app/public/slides.pdf');
  fs.copyFileSync(path.join(projectRoot, 'slides.pdf'), publicPdf05);
  const publicPdf06 = path.join(projectRoot, 'steps/step-06-google-search-mcp/public/slides.pdf');
  fs.copyFileSync(path.join(projectRoot, 'slides.pdf'), publicPdf06);
  console.log('[PDF Builder] Successfully generated slides.pdf and synced to public folders.');
} catch (err) {
  console.error('[PDF Builder] Failed to build PDF:', err.message);
  process.exit(1);
}
