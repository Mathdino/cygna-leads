// POST /api/marcar  { id, status?, obs? }
import { marcar, NAO_CONTATADO, ENVIADA, OBS_VALIDAS } from '../lib/dados.js';

async function corpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let txt = '';
  for await (const parte of req) txt += parte;
  return txt ? JSON.parse(txt) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });
  try {
    const d = await corpo(req);
    const campos = {};
    if ('status' in d) {
      if (![NAO_CONTATADO, ENVIADA].includes(d.status)) return res.status(400).json({ erro: 'status inválido' });
      campos.status = d.status;
    }
    if ('obs' in d) {
      if (d.obs && !OBS_VALIDAS.includes(d.obs)) return res.status(400).json({ erro: 'observação inválida' });
      campos.obs = d.obs || '';
    }
    if (!d.id || !Object.keys(campos).length) return res.status(400).json({ erro: 'faltou id ou campo' });
    const lead = await marcar(String(d.id), campos);
    if (!lead) return res.status(404).json({ erro: 'lead não encontrado' });
    const { id, status, obs } = lead;
    res.status(200).json({ id, status, obs });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
}
