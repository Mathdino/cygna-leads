// Servidor só para testar no computador (na Vercel não é usado).
//   Com a planilha (APPS_SCRIPT_URL no .env):  node --env-file=.env dev.js
//   Sem planilha:                              DADOS_LOCAIS=dados-teste.json node dev.js  (marcações ficam só na memória)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import leads from './api/leads.js';
import marcar from './api/marcar.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(DIR, 'public');
const PORTA = Number(process.env.PORT) || 3000;
const rotas = { '/api/leads': leads, '/api/marcar': marcar };
const TIPOS = { '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

http.createServer(async (req, res) => {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
  const caminho = new URL(req.url, 'http://x').pathname;
  if (rotas[caminho]) return rotas[caminho](req, res);
  const arq = path.join(PUBLICO, caminho === '/' ? 'index.html' : path.normalize(caminho));
  if (!arq.startsWith(PUBLICO) || !fs.existsSync(arq)) { res.statusCode = 404; return res.end('não encontrado'); }
  res.setHeader('Content-Type', TIPOS[path.extname(arq)] || 'application/octet-stream');
  res.end(fs.readFileSync(arq));
}).listen(PORTA, () => console.log(`http://localhost:${PORTA}`));
