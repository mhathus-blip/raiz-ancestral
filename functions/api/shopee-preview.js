// Cloudflare Pages Function: functions/api/shopee-preview.js
// Consulta de teste: NÃO grava, altera ou exclui produtos.
// V5: filtros de uso real, diversidade, diagnostico e verificacao de codificacao.
// Os candidatos exigem revisão de preço, categoria e procedência antes de importar.
const API = 'https://open-api.affiliate.shopee.com.br/graphql';
// Cada subgrupo tem limite proprio para evitar uma vitrine dominada por um so ingrediente.
const GRUPOS = [
  { categoria: 'Chás e Ervas', quantidade: 12, buscas: [
    ['camomila', 'cha camomila', 2], ['hibisco', 'cha hibisco', 2],
    ['hortela', 'cha hortela', 2], ['cidreira', 'cha erva cidreira', 2],
    ['capim', 'cha capim limao', 2], ['erva doce', 'cha erva doce', 2],
    ['verde', 'cha verde', 2], ['mix', 'cha de ervas', 2]
  ] },
  { categoria: 'Suplementos Naturais', quantidade: 10, buscas: [
    ['psyllium', 'psyllium fibra', 2], ['spirulina', 'spirulina', 2],
    ['chlorella', 'chlorella', 2], ['inulina', 'inulina fibra', 2],
    ['fibra', 'fibra alimentar', 2], ['proteina', 'proteina vegetal', 2]
  ] },
  { categoria: 'Alimentos Naturais', quantidade: 8, buscas: [
    ['mel', 'mel puro', 2], ['aveia', 'aveia em flocos', 2],
    ['chia', 'semente de chia', 2], ['linhaca', 'linhaça dourada', 2],
    ['castanhas', 'castanhas naturais', 2], ['curcuma', 'curcuma em po', 2]
  ] }
];
// Acentos podem chegar incorretos em alguns terminais/exports: preservar nomes da API.
// Filtragem de nomes e categorias usa normalizacao, mas NAO reescreve titulos comerciais.
const contem = (s, re) => re.test(normalizar(s));
const PROIBIDOS_GERAIS = /(?:creme para pentear|shampoo|condicionador|sabonete|perfume|hidratante|mascara capilar|oleo corporal|cosmetico|racao|pet shop|semente para plantar|muda de planta|vaso de planta|fertilizante|adubo|defensivo|inseticida|brinde|amostra gratis|difusor|home spray|aromatizador|essencia para ambiente|vela aromatica|odorizador|incenso|sache perfumado|agua perfumada|limpador|desinfetante|umectacao capilar|uso capilar|para cabelo|para cabelos|para pele|cachos|crespos|uso externo|uso topico)/;
const PROIBIDOS_CHA = /(?:colageno|capsulas?|termogenic|emagre|detox|seca barriga|retencao de liquidos|diuretico|laxante|sene|senna|kombucha|soluvel|suplemento|cha branco aroma|sabor cha|perfuma|fragrancia|oleo essencial|vela|spray|difusor|aromatiz)/;
const PROIBIDOS_SUP = /(?:emagre|termogenic|seca barriga|milagre|cura|tratamento|remedio|anabol|hormonal|testosterona|quitosana|cromo|combo|kit [0-9]+x)/;
const PROIBIDOS_ALIMENTO = /(?:capsulas?|softgel|suplemento|omega [369]|creme para pentear|cosmetico|shampoo|condicionador|oleo essencial|oleo corporal|uso topico|uso externo|prensado a frio.*(?:cabelo|pele|capilar)|umectacao|aromaterapia|oleo para massagem)/;
const ALVOS = {
  'camomila': /camomila/, 'hibisco': /hibisco/, 'hortela': /hortela/,
  'cidreira': /cidreira|melissa/, 'capim': /capim limao|capim santo|capim cidreira/,
  'erva doce': /erva doce|funcho/, 'verde': /cha verde/, 'mix': /cha|ervas|infusao/,
  'psyllium': /psyllium|psilio|pissilio/, 'spirulina': /spirulina/,
  'chlorella': /chlorella|clorela/, 'inulina': /inulina/,
  'fibra': /fibra alimentar|blend de fibras|mix de fibras/, 'proteina': /proteina vegetal|proteina de ervilha/,
  'mel': /mel puro|mel de abelha|mel silvestre/, 'aveia': /aveia em flocos|farelo de aveia/,
  'chia': /semente de chia|chia em graos|chia graos/,
  'linhaca': /linhaca dourada|semente de linhaca|linhaca marrom/,
  'castanhas': /castanha de caju|castanha do para|mix de castanhas/,
  'curcuma': /curcuma em po|acafrao da terra em po/
};
function adequado(nome, grupo, familia) {
  const n = normalizar(nome);
  if (!n || PROIBIDOS_GERAIS.test(n) || !ALVOS[familia].test(n)) return false;
  if (grupo === 'Chás e Ervas') return !PROIBIDOS_CHA.test(n) && /\b(cha|ervas?|infusao|flores?|folhas?|camomila|hibisco|hortela|cidreira|capim|funcho)\b/.test(n);
  if (grupo === 'Suplementos Naturais') return !PROIBIDOS_SUP.test(n);
  if (grupo === 'Alimentos Naturais') return !PROIBIDOS_ALIMENTO.test(n) && !(/\boleo\b/.test(n) && !/\b(comestivel|alimenticio|culinario|cozinha)\b/.test(n));
  return false;
}
// Limita kits de tamanhos diferentes da mesma marca/ingrediente, sem prometer deduplicacao perfeita.
function assinaturaProduto(nome, familia) {
  return familia + ':' + normalizar(nome)
    .replace(/\b(?:[0-9]+\s*(?:g|kg|ml|l|mg|capsulas|caps|unidades|unid|x))\b/g, ' ')
    .replace(/\b(?:kit|combo|pacote|pote|frasco|original|natural|premium|puro|100|porcento)\b/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 110);
}
// Somente normaliza para comparar; nao modifica nomes comerciais retornados pela API.
const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const textoSuspeito = v => /(?:Ã.|Â.| )/.test(String(v || ''));
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
    const assinaturas = new Set();
    const selecionados = [];
    const contagens = {};
    const avisos = [];
    const diagnostico = [];
    const rejeicoes = { categoria: 0, repetido: 0, dados: 0 };
    const codificacao = { nomesSuspeitos: 0, exemplos: [] };
    for (const grupo of GRUPOS) {
      let adicionados = 0;
      const porFamilia = {};
      // Uma passagem por familia garante variedade antes de preencher os limites.
      for (const [familia, termo, limite] of grupo.buscas) {
        if (adicionados >= grupo.quantidade) break;
        let ofertas;
        try {
          const resultado = await consultarShopee(appId, secret, termo);
          ofertas = resultado.ofertas;
          diagnostico.push({ categoria: grupo.categoria, familia, termo, status: 'ok', ofertas: ofertas.length, tentativas: resultado.tentativas });
        } catch (e) {
          avisos.push(e.message);
          diagnostico.push({ categoria: grupo.categoria, familia, termo, status: 'erro' });
          continue;
        }
        for (const p of ofertas) {
          if (adicionados >= grupo.quantidade || (porFamilia[familia] || 0) >= limite) break;
          const id = String(p.itemId || '').trim();
          const nome = String(p.productName || '').trim();
          if (textoSuspeito(nome)) { codificacao.nomesSuspeitos++; if (codificacao.exemplos.length < 3) codificacao.exemplos.push(nome.slice(0, 90)); }
          const link = String(p.offerLink || '').trim();
          const imagem = String(p.imageUrl || '').trim();
          const preco = Number(p.priceMin);
          if (!id || !nome || !/^https:\/\//.test(link) || !/^https:\/\//.test(imagem) || !Number.isFinite(preco) || preco <= 0) { rejeicoes.dados++; continue; }
          if (!adequado(nome, grupo.categoria, familia)) { rejeicoes.categoria++; continue; }
          const nomeNormal = normalizar(nome);
          const assinatura = assinaturaProduto(nome, familia);
          if (ids.has(id) || nomes.has(nomeNormal) || links.has(link) || assinaturas.has(assinatura)) { rejeicoes.repetido++; continue; }
          ids.add(id); nomes.add(nomeNormal); links.add(link); assinaturas.add(assinatura);
          selecionados.push({ itemId: id, nome, descricao: '', loja: 'Shopee', imagem_url: imagem, preco, categoria: grupo.categoria, link_afiliado: link, ativo: true, destaque: false });
          porFamilia[familia] = (porFamilia[familia] || 0) + 1;
          adicionados++;
        }
      }
      contagens[grupo.categoria] = adicionados;
      diagnostico.push({ categoria: grupo.categoria, status: 'resumo', porFamilia });
      if (adicionados < grupo.quantidade) avisos.push(`Categoria ${grupo.categoria}: ${adicionados}/${grupo.quantidade} candidatos. Melhor menos itens relevantes do que completar com produtos inadequados.`);
    }
    return json({ modo: 'PREVIA_SEM_GRAVACAO', versao: 'V5', codificacao, total: selecionados.length, meta: GRUPOS.reduce((total, grupo) => total + grupo.quantidade, 0), contagens, rejeicoes, avisos, diagnostico, produtos: selecionados });
  } catch (e) { return json({ erro: 'Não foi possível gerar a prévia.', detalhe: String(e.message || e) }, 502); }
}
