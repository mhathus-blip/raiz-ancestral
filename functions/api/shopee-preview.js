// Cloudflare Pages Function: functions/api/shopee-preview.js
// Consulta de teste: NÃO grava, altera ou exclui produtos.
// V3: consultas com diagnóstico e uma repetição para erros temporários.
// Os candidatos exigem revisão de preço, categoria e procedência antes de importar.
const API = 'https://open-api.affiliate.shopee.com.br/graphql';
const GRUPOS = [
  { categoria: 'Chás e Ervas', quantidade: 12, termos: [
    'cha camomila', 'cha hibisco', 'cha hortela', 'cha erva cidreira',
    'cha capim limao', 'cha erva doce', 'cha verde', 'cha de ervas',
    'camomila', 'hibisco', 'hortela', 'erva cidreira', 'cha natural'
  ] },
  { categoria: 'Suplementos Naturais', quantidade: 10, termos: [
    'psyllium fibra', 'spirulina', 'chlorella', 'fibra alimentar',
    'suplemento natural', 'suplemento fibras', 'inulina', 'farelo de aveia'
  ] },
  { categoria: 'Alimentos Naturais', quantidade: 8, termos: [
    'mel puro', 'aveia em flocos', 'semente de chia', 'linhaça',
    'castanhas naturais', 'curcuma em po', 'chia', 'linhaça dourada', 'aveia', 'mel' 
  ] }
];
const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

const aguardar = ms => new Promise(resolve => setTimeout(resolve, ms));

async function consultarShopee(appId, secret, termo) {
  const query = `query { productOfferV2(keyword: ${JSON.stringify(termo)}) { nodes { itemId productName imageUrl priceMin priceMax offerLink commissionRate } } }`;
  const payload = JSON.stringify({ query });
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      // Assinatura refeita em cada tentativa para não reutilizar timestamp antigo.
      const timestamp = Math.floor(Date.now() / 1000);
      const bytes = new TextEncoder().encode(appId + timestamp + payload + secret);
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      const signature = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}` },
        body: payload
      });
      const data = await r.json();
      if (r.ok && !data.errors?.length) return { ofertas: data.data?.productOfferV2?.nodes || [], tentativas: tentativa };
      const mensagem = JSON.stringify(data.errors || []).slice(0, 350);
      const temporario = r.status === 429 || r.status >= 500 || /System Error|10000|temporar|timeout/i.test(mensagem);
      if (!temporario || tentativa === 2) throw new Error(`Shopee: '${termo}' (HTTP ${r.status}, tentativa ${tentativa}): ${mensagem}`);
    } catch (e) {
      if (tentativa === 2 || /Shopee:/.test(String(e.message))) throw e;
    }
    await aguardar(600);
  }
}

export async function onRequestGet({ request, env }) {
  const token = String(env.IMPORT_PREVIEW_TOKEN || '');
  const recebido = request.headers.get('X-Import-Token') || '';
  if (!token || !recebido || token.length !== recebido.length) return json({ erro: 'Acesso não autorizado.' }, 401);
  // Comparação em tempo constante (sem revelar o token)
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ recebido.charCodeAt(i);
  if (diff !== 0) return json({ erro: 'Acesso não autorizado.' }, 401);
  const appId = String(env.SHOPEE_APP_ID || '').trim();
  const secret = String(env.SHOPEE_APP_SECRET || '').trim();
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || '');
  if (!appId || !secret || !url || !key) return json({ erro: 'Configure SHOPEE_APP_ID, SHOPEE_APP_SECRET, SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.' }, 500);
  try {
    const db = await fetch(`${url}/rest/v1/produtos?select=nome,link_afiliado&loja=ilike.Shopee`, { headers: { apikey: key } });
    if (!db.ok) throw new Error(`Supabase retornou HTTP ${db.status}. Confira a política de leitura (RLS).`);
    const existentes = await db.json();
    const nomes = new Set(existentes.map(p => normalizar(p.nome)));
    const links = new Set(existentes.map(p => String(p.link_afiliado || '').trim()).filter(Boolean));
    const ids = new Set();
    const selecionados = [];
    const contagens = {};
    const avisos = [];
    const diagnostico = [];
    for (const grupo of GRUPOS) {
      let adicionados = 0;
      for (const termo of grupo.termos) {
        if (adicionados >= grupo.quantidade) break;
        let ofertas;
        try {
          const resultado = await consultarShopee(appId, secret, termo);
          ofertas = resultado.ofertas;
          diagnostico.push({ categoria: grupo.categoria, termo, status: 'ok', ofertas: ofertas.length, tentativas: resultado.tentativas });
        } catch (e) {
          avisos.push(e.message);
          diagnostico.push({ categoria: grupo.categoria, termo, status: 'erro' });
          continue;
        }
        for (const p of ofertas) {
          if (adicionados >= grupo.quantidade) break;
          const id = String(p.itemId || '').trim();
          const nome = String(p.productName || '').trim();
          const link = String(p.offerLink || '').trim();
          const imagem = String(p.imageUrl || '').trim();
          const preco = Number(p.priceMin);
          if (!id || !nome || !/^https:\/\//.test(link) || !/^https:\/\//.test(imagem) || !Number.isFinite(preco) || preco <= 0) continue;
          const nomeNormal = normalizar(nome);
          if (ids.has(id) || nomes.has(nomeNormal) || links.has(link)) continue;
          ids.add(id); nomes.add(nomeNormal); links.add(link);
          selecionados.push({ itemId: id, nome, descricao: '', loja: 'Shopee', imagem_url: imagem, preco, categoria: grupo.categoria, link_afiliado: link, ativo: true, destaque: false });
          adicionados++;
        }
      }
      contagens[grupo.categoria] = adicionados;
      if (adicionados < grupo.quantidade) avisos.push(`Categoria ${grupo.categoria}: ${adicionados}/${grupo.quantidade} candidatos. Necessária revisão ou nova busca.`);
    }
    return json({ modo: 'PREVIA_SEM_GRAVACAO', total: selecionados.length, meta: GRUPOS.reduce((total, grupo) => total + grupo.quantidade, 0), contagens, avisos, diagnostico, produtos: selecionados });
  } catch (e) { return json({ erro: 'Não foi possível gerar a prévia.', detalhe: String(e.message || e) }, 502); }
}
