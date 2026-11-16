// Cloudflare Pages Function: functions/api/shopee-verificar.js
// Consulta SOMENTE LEITURA. Não altera Supabase ou catálogo.
// Usa productOfferV2(keyword) e compara IDs; ausência na busca NÃO indica indisponibilidade.
const API = 'https://open-api.affiliate.shopee.com.br/graphql';
const ALVOS = [
  ['58214218572','cha camomila'],
  ['22195083025','cha de ervas'],
  ['58262473092','cha hortela'],
  ['20347799468','cha hortela'],
  ['58250766970','cha capim limao'],
  ['22920935582','cha capim limao'],
  ['22920975727','cha erva doce'],
  ['14221895193','mel puro'],
  ['58204721607','aveia em flocos'],
  ['58217743679','semente de chia'],
  ['22693867512','semente de chia'],
  ['23695176625','linhaça dourada']
];
const responder = (dados, status=200) => Response.json(dados, {status, headers:{'Cache-Control':'no-store'}});
const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));
async function pesquisar(appId, secret, keyword) {
  const query = `query { productOfferV2(keyword: ${JSON.stringify(keyword)}) { nodes { itemId productName imageUrl priceMin priceMax offerLink commissionRate } } }`;
  const body = JSON.stringify({query});
  let ultimaFalha = '';
  for (let tentativa=1; tentativa<=2; tentativa++) {
    try {
      const timestamp = Math.floor(Date.now()/1000);
      const bytes = new TextEncoder().encode(appId + timestamp + body + secret);
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      const signature = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
      const resposta = await fetch(API, {method:'POST', headers:{'Content-Type':'application/json',Authorization:`SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`}, body});
      const dados = await resposta.json();
      if (resposta.ok && !dados.errors?.length) return {nodes: dados.data?.productOfferV2?.nodes || [], tentativas};
      ultimaFalha = `HTTP ${resposta.status}: ${JSON.stringify(dados.errors || []).slice(0,250)}`;
      if (resposta.status !== 429 && resposta.status < 500 && !/10000|System Error/i.test(ultimaFalha)) break;
    } catch (erro) { ultimaFalha = String(erro.message || erro).slice(0,250); }
    if (tentativa===1) await dormir(650);
  }
  throw new Error(ultimaFalha || 'Erro desconhecido');
}
export async function onRequestGet({request,env}) {
  const token = String(env.IMPORT_PREVIEW_TOKEN || '');
  const recebido = request.headers.get('X-Import-Token') || '';
  if (!token || token.length !== recebido.length) return responder({erro:'Acesso não autorizado'},401);
  let diferenca=0;
  for(let i=0;i<token.length;i++) diferenca |= token.charCodeAt(i)^recebido.charCodeAt(i);
  if(diferenca) return responder({erro:'Acesso não autorizado'},401);
  const appId=String(env.SHOPEE_APP_ID || '').trim();
  const secret=String(env.SHOPEE_APP_SECRET || '').trim();
  if(!appId || !secret) return responder({erro:'Configure as credenciais Shopee'},500);
  const termos=[...new Set(ALVOS.map(x=>x[1]))];
  const resultados={};
  const avisos=[];
  for(const termo of termos) {
    try { resultados[termo]=await pesquisar(appId,secret,termo); }
    catch(e) { resultados[termo]={erro:String(e.message || e)}; avisos.push(`Falha na pesquisa ${termo}`); }
  }
  const produtos=ALVOS.map(([itemId,termo])=>{
    const resultado=resultados[termo];
    if(resultado.erro) return {itemId,termo,status:'ERRO_NA_CONSULTA',detalhe:resultado.erro};
    const item=resultado.nodes.find(p=>String(p.itemId)===itemId);
    if(!item) return {itemId,termo,status:'NAO_ENCONTRADO_NOS_20_RESULTADOS',observacao:'Não significa anúncio indisponível'};
    return {itemId,termo,status:'ENCONTRADO_NA_BUSCA',nome:item.productName,imagem_url:item.imageUrl,preco_min:Number(item.priceMin),preco_max:Number(item.priceMax),link_afiliado:item.offerLink,comissao:item.commissionRate};
  });
  return responder({modo:'SOMENTE_LEITURA',versao:'VERIFICACAO_V1',metodo:'Busca por palavra-chave e comparação exata de itemId; não confirma estoque, reputação ou preço final',total_alvos:ALVOS.length,encontrados:produtos.filter(p=>p.status==='ENCONTRADO_NA_BUSCA').length,consultas:termos.map(termo=>({termo,status:resultados[termo].erro?'erro':'ok',quantidade:resultados[termo].nodes?.length ?? null})),avisos,produtos});
}
