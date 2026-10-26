// GET /api/leads?q=&status=&obs=&cidade=&segmento=&ig=1&pagina=0
import { todos, NAO_CONTATADO } from '../lib/dados.js';

const POR_PAGINA = 40;
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function contar(leads, campo) {
  const n = {};
  for (const l of leads) if (l[campo]) n[l[campo]] = (n[l[campo]] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1]);
}

export default async function handler(req, res) {
  try {
    const p = new URL(req.url, 'http://x').searchParams;
    const { leads } = await todos(p.get('recarregar') === '1');
    const q = norm(p.get('q')).trim();
    const st = p.get('status') || '';
    const ob = p.get('obs') || '';
    const cid = p.get('cidade') || '';
    const seg = p.get('segmento') || '';
    const soIg = p.get('ig') === '1';

    const filtrados = leads.filter((l) =>
      // "Mensagem enviada" inclui quem já avançou na planilha (Respondeu, Interessado...)
      (!st || (st === NAO_CONTATADO ? l.status === NAO_CONTATADO : l.status !== NAO_CONTATADO)) &&
      (!ob || (ob === '-' ? !l.obs : l.obs === ob)) &&
      (!cid || l.cidade === cid) && (!seg || l.segmento === seg) && (!soIg || l.ig) &&
      (!q || norm(`${l.nome} ${l.ig} ${l.bairro}`).includes(q)));

    const total = filtrados.length;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const pagina = Math.min(Math.max(0, parseInt(p.get('pagina') || '0', 10) || 0), paginas - 1);
    const itens = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
      .map(({ id, nome, status, obs, msg, ig, cidade, bairro, segmento }) => ({ id, nome, status, obs, msg, ig, cidade, bairro, segmento }));

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      total, pagina, paginas, itens,
      contadores: {
        leads: leads.length,
        enviadas: leads.filter((l) => l.status !== NAO_CONTATADO).length,
        seguindo: leads.filter((l) => l.obs === 'Seguindo').length,
        semInsta: leads.filter((l) => l.obs === 'Não tem insta').length,
      },
      opcoes: { cidades: contar(leads, 'cidade'), segmentos: contar(leads, 'segmento') },
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
}
