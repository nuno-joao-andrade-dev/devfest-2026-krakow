#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const slidesPath = path.resolve(projectRoot, 'slides.html');

const PORT = parseInt(process.env.SLIDES_PORT || process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  console.log(`[Slides Server] ${req.method} ${url.pathname}`);

  if (url.pathname === '/' || url.pathname === '/slides' || url.pathname === '/slides.html') {
    if (!fs.existsSync(slidesPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('slides.html not found. Please run "npm run slides:build" first.');
      return;
    }

    const html = fs.readFileSync(slidesPath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(html);
    return;
  }

  // Check if static file in project root or assets
  const safePath = path.normalize(path.join(projectRoot, url.pathname));
  if (safePath.startsWith(projectRoot) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    const stream = fs.createReadStream(safePath);
    res.writeHead(200);
    stream.pipe(res);
    return;
  }

  // Fallback to slides
  if (fs.existsSync(slidesPath)) {
    const html = fs.readFileSync(slidesPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log('=======================================================');
  console.log('Google Developer Experts (GDE) Slides Server Online');
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Serving: ${slidesPath}`);
  console.log('Press Ctrl+C to terminate');
  console.log('=======================================================');
});
