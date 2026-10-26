// Camada de dados: planilha do Google via Apps Script (produção) ou arquivo JSON local (teste).
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   APPS_SCRIPT_URL     URL do app da web do Apps Script (termina em /exec)
//   APPS_SCRIPT_TOKEN   a mesma senha definida em TOKEN no apps-script.gs
// Sem APPS_SCRIPT_URL usa DADOS_LOCAIS (arquivo JSON) — só para testar no computador.
// A lógica de gravação (Data contato, Canal) fica no apps-script.gs.
import fs from 'node:fs';
import zlib from 'node:zlib';

const URL_SCRIPT = (process.env.APPS_SCRIPT_URL || '').trim();
const TOKEN = (process.env.APPS_SCRIPT_TOKEN || '').trim();
const CACHE_MS = 20_000;

export const NAO_CONTATADO = 'Não contatado';
export const ENVIADA = 'Mensagem enviada';
export const OBS_VALIDAS = ['Seguindo', 'Não tem insta'];

let cache = null; // { quando, leads }

function configurado() {
  if (!URL_SCRIPT && !process.env.DADOS_LOCAIS) {
    throw new Error('Falta a variável APPS_SCRIPT_URL na Vercel. Cadastre em Settings → Environment Variables e faça Redeploy.');
  }
  if (URL_SCRIPT && !TOKEN) {
    throw new Error('Falta a variável APPS_SCRIPT_TOKEN na Vercel (a mesma senha do TOKEN no Apps Script).');
  }
}

async function chamar(opcoes) {
  let r;
  try {
    r = await fetch(opcoes.url, { redirect: 'follow', ...opcoes });
  } catch (e) {
    throw new Error('Não consegui falar com o Apps Script: ' + e.message);
  }
  if (r.url.includes('accounts.google.com')) {
    throw new Error('O Apps Script pediu login do Google: na implantação, "Quem pode acessar" precisa ser "Qualquer pessoa" (não "Qualquer pessoa com conta Google" nem "dentro da organização").');
  }
  const txt = await r.text();
  let j;
  try { j = JSON.parse(txt); } catch {
    throw new Error('O Apps Script não respondeu JSON. Confira se a implantação está como "Qualquer pessoa" e se a URL termina em /exec.');
  }
  if (j.erro) throw new Error('Planilha: ' + j.erro);
  return j;
}

async function lerPlanilha(refazer) {
  const j = await chamar({ url: `${URL_SCRIPT}?token=${encodeURIComponent(TOKEN)}${refazer ? '&refazer=1' : ''}` });
  // lista vem compactada (gzip+base64); a "camada" traz os cliques feitos depois que ela foi montada
  const linhas = j.gz ? JSON.parse(zlib.gunzipSync(Buffer.from(j.gz, 'base64')).toString('utf8')) : j.leads;
  const camada = j.camada || {};
  return linhas.map((row) => {
    const l = Object.fromEntries(j.campos.map((c, i) => [c, row[i] ?? '']));
    if (camada[l.id]) [l.status, l.obs] = camada[l.id];
    l.status = l.status || NAO_CONTATADO;
    l.ig = String(l.ig || '').trim();
    return l;
  });
}

function lerLocal() {
  const bruto = JSON.parse(fs.readFileSync(process.env.DADOS_LOCAIS, 'utf8'));
  return (bruto.leads || bruto).map((l) => ({ ...l, status: l.status || NAO_CONTATADO }));
}

export async function todos(forcar = false) {
  configurado();
  // modo local: lê o arquivo uma vez e guarda as marcações só na memória
  if (cache && (!URL_SCRIPT || (!forcar && Date.now() - cache.quando < CACHE_MS))) return cache;
  cache = { quando: Date.now(), leads: URL_SCRIPT ? await lerPlanilha(forcar) : lerLocal() };
  return cache;
}

export async function marcar(id, campos) {
  configurado();
  let novo;
  if (URL_SCRIPT) {
    novo = await chamar({
      url: URL_SCRIPT,
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // text/plain evita preflight e é o que o Apps Script aceita
      body: JSON.stringify({ token: TOKEN, id, ...campos }),
    });
  } else {
    const l = (await todos()).leads.find((x) => x.id === id);
    if (!l) return null;
    novo = { id, status: campos.status ?? l.status, obs: 'obs' in campos ? campos.obs : l.obs };
  }
  // atualiza o cache desta instância para a lista refletir na hora
  const l = cache?.leads.find((x) => x.id === id);
  if (l) Object.assign(l, { status: novo.status, obs: novo.obs });
  return novo;
}
