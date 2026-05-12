#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    let filePath = path.join(root, decodeURIComponent(url.pathname));
    if (url.pathname === '/') filePath = path.join(root, 'examples/static-interface/index.html');
    const normalized = path.normalize(filePath);
    if (!normalized.startsWith(root)) throw new Error('Path traversal rejected');
    const data = await fs.readFile(normalized);
    const ext = path.extname(normalized);
    res.setHeader('Content-Type', ext === '.html' ? 'text/html' : 'application/octet-stream');
    res.end(data);
  } catch (err) {
    res.statusCode = 404;
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Static example server listening on http://127.0.0.1:${port}`);
});
