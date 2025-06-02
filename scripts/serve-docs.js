#!/usr/bin/env node

/**
 * Documentation Server
 * 
 * A simple static file server for serving generated API documentation locally.
 * This allows developers to view and test the documentation before deployment.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DOCS_PORT || 3002;
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const generatedDir = path.join(docsDir, 'generated');

// Check if generated docs exist
if (!fs.existsSync(generatedDir)) {
  console.log('📚 No generated documentation found. Running docs:generate first...');
  console.log('Please run: npm run docs:generate');
  process.exit(1);
}

// Serve static files from docs directory
app.use('/generated', express.static(generatedDir));
app.use('/docs', express.static(docsDir));

// Serve generated markdown as HTML
app.get('/api-reference', (req, res) => {
  const markdownPath = path.join(generatedDir, 'api-reference.md');
  if (fs.existsSync(markdownPath)) {
    const content = fs.readFileSync(markdownPath, 'utf8');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>API Reference - QA Platform</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
          }
          pre { 
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
          code {
            background: #f0f0f0;
            padding: 2px 4px;
            border-radius: 3px;
          }
          h1, h2, h3 { color: #333; }
          h1 { border-bottom: 2px solid #e1e4e8; padding-bottom: 10px; }
          h2 { border-bottom: 1px solid #e1e4e8; padding-bottom: 5px; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      </head>
      <body>
        <div id="content"></div>
        <script>
          document.getElementById('content').innerHTML = marked.parse(\`${content.replace(/`/g, '\\`')}\`);
        </script>
      </body>
      </html>
    `);
  } else {
    res.status(404).send('API reference not found. Please run npm run docs:generate first.');
  }
});

// Main documentation index
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QA Platform API Documentation</title>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          line-height: 1.6;
        }
        .card {
          border: 1px solid #e1e4e8;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          background: #f8f9fa;
        }
        a {
          color: #0366d6;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background: #0366d6;
          color: white;
          border-radius: 5px;
          margin: 5px;
          text-decoration: none;
        }
        .button:hover {
          background: #0256cc;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <h1>🚀 QA Platform API Documentation</h1>
      <p>Welcome to the comprehensive API documentation for the AI-Powered Linguistic QA Platform.</p>
      
      <div class="card">
        <h2>📚 Available Documentation</h2>
        <p><strong>Interactive API Docs:</strong> <a href="http://localhost:3001/api/docs" class="button">Open Swagger UI</a></p>
        <p><em>Note: Requires the main API server to be running on port 3001</em></p>
        
        <h3>Generated Documentation</h3>
        <ul>
          <li><a href="/api-reference">📖 API Reference (Markdown)</a></li>
          <li><a href="/generated/openapi-generated.json">🔧 OpenAPI Specification (JSON)</a></li>
          <li><a href="/generated/qa-platform-api.postman_collection.json">📮 Postman Collection</a></li>
        </ul>
        
        <h3>SDK Examples</h3>
        <ul>
          <li><a href="/generated/sdks/qa-platform-sdk.js">🟨 JavaScript SDK</a></li>
          <li><a href="/generated/sdks/qa_platform_sdk.py">🐍 Python SDK</a></li>
          <li><a href="/generated/sdks/curl-examples.sh">💻 cURL Examples</a></li>
        </ul>
        
        <h3>Static Documentation</h3>
        <ul>
          <li><a href="/docs/api-integration-guide.md">🔗 Integration Guide</a></li>
          <li><a href="/docs/api-error-handling.md">⚠️ Error Handling</a></li>
          <li><a href="/docs/api-endpoints-map.md">🗺️ Endpoints Map</a></li>
          <li><a href="/docs/api-specification.yaml">📋 Complete API Specification</a></li>
        </ul>
      </div>
      
      <div class="card">
        <h2>🔧 Development Tools</h2>
        <p><strong>Generate Fresh Docs:</strong> <code>npm run docs:generate</code></p>
        <p><strong>Start Main API:</strong> <code>npm run dev</code> (then visit <a href="http://localhost:3001/api/docs">interactive docs</a>)</p>
        <p><strong>Docs Server:</strong> <code>npm run docs:serve</code> (this server)</p>
      </div>
      
      <div class="card">
        <h2>📊 Quick Start</h2>
        <ol>
          <li>Start the main API server: <code>npm run dev</code></li>
          <li>Visit the interactive docs: <a href="http://localhost:3001/api/docs">http://localhost:3001/api/docs</a></li>
          <li>Test endpoints using the "Try it out" feature</li>
          <li>Download SDKs and examples from the links above</li>
        </ol>
      </div>
    </body>
    </html>
  `);
});

// Health check for the docs server
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'docs-server',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Start the documentation server
app.listen(PORT, () => {
  console.log('📚 Documentation server started!');
  console.log(`🌐 Open http://localhost:${PORT} to view documentation`);
  console.log(`🔗 Interactive API docs: http://localhost:3001/api/docs (requires main API server)`);
  console.log(`📖 Markdown docs: http://localhost:${PORT}/api-reference`);
  console.log(`🛑 Stop server: Ctrl+C`);
});

export default app; 