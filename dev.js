// Servidor só para testar no computador (na Vercel não é usado).
//   Com a planilha do Google: crie um arquivo .env (veja .env.example) e rode  node --env-file=.env dev.js
//   Sem credenciais:          DADOS_LOCAIS=dados-teste.json node dev.js  (marcações ficam só na memória)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import leads from './api/leads.js';
import marcar from './api/marcar.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORTA = Number(process.env.PORT) || 3000;
const rotas = { '/api/leads': leads, '/api/marcar': marcar };

http.createServer(async (req, res) => {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
  const rota = rotas[new URL(req.url, 'http://x').pathname];
  if (rota) return rota(req, res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(DIR, 'public', 'index.html')));
}).listen(PORTA, () => console.log(`http://localhost:${PORTA}`));
