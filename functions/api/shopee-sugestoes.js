/* Raiz Ancestral V12 — Etapa 21: diagnóstico de ofertas Shopee, somente leitura.
 * Consulta autenticada por administrador; NUNCA troca link afiliado ou grava preço.
 * Dados de ofertas são sugestões, não prova de identidade do anúncio.
 */
const reply=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const validHttps=v=>{try{let u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname}catch{return false}};
const words=s=>[...new Set(normalize(s).split(' ').filter(v=>v.length>=2&&(!['com','sem','para','unidades','unidade','pacote','produto','natural'].includes(v)||normalize(s)===v)))];
const codes=s=>(normalize(s).match(/\b\d+(?:g|kg|ml|l|un|und|unid|unidades|unidade|pcs)\b/g)||[]);
function nameScore(a,b){
 const aw=words(a),bn=normalize(b);
 const hits=aw.filter(w=>bn.includes(w)).length;
 const ac=codes(a),bc=codes(b);
 const conflicting=ac.length&&bc.length&&!ac.some(v=>bc.includes(v));
 return {score:aw.length?Math.round(100*hits/aw.length):0,conflicting:!!conflicting};
}
function queryTerms(name){
 const cleaned=normalize(name);
 const arr=[String(name).trim().slice(0,100)];
 // Shopee pesquisa por relevância, nomes exatos longos frequentemente não retornam resultados.
 const terms=words(name).filter(x=>!/^\d/.test(x));
 if(terms.length>=2)arr.push(terms.slice(0,4).join(' ').slice(0,75));
 if(terms.length>=3)arr.push(terms.slice(0,3).join(' ').slice(0,55));
 return [...new Set(arr.map(x=>x.trim()).filter(x=>x.length>=2))].slice(0,3);
}
async function offers(appId,secret,term){
 const query='query { productOfferV2(keyword: '+JSON.stringify(term)+') { nodes { itemId productName imageUrl priceMin priceMax offerLink } } }';
 const payload=JSON.stringify({query}), timestamp=Math.floor(Date.now()/1000);
 const data=new TextEncoder().encode(appId+timestamp+payload+secret);
 const hash=await crypto.subtle.digest('SHA-256',data);
 const signature=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
 let r;
 try{r=await fetch('https://open-api.affiliate.shopee.com.br/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'SHA256 Credential='+appId+', Timestamp='+timestamp+', Signature='+signature},body:payload,signal:AbortSignal.timeout(11000)})}
 catch{return {ok:false,code:'ERRO_REDE',detail:'Tempo de resposta excedido ou comunicação indisponível.'}}
 let j;
 try{j=await r.json()}catch{return {ok:false,code:'RESPOSTA_INVALIDA',detail:'API retornou resposta não reconhecida.'}}
 if(!r.ok||j.errors?.length){
  const err=Array.isArray(j.errors)?j.errors[0]||{}:{};
  const graphCode=String(err.extensions?.code||err.code||'').slice(0,60).replace(/[^A-Za-z0-9_-]/g,'');
  // Não devolver mensagens da API, que podem conter identificadores e informações internas.
  return {ok:false,code:'API_REJEITOU_CONSULTA',http:r.status,graphCode};
 }
 return {ok:true,nodes:Array.isArray(j.data?.productOfferV2?.nodes)?j.data.productOfferV2.nodes:[]};
}
export async function onRequestPost({request,env}){
 if(!String(request.headers.get('content-type')||'').includes('application/json'))return reply({erro:'Envie JSON.'},415);
 const token=String(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000)return reply({erro:'Faça login de administrador.'},401);
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return reply({erro:'Configuração de autenticação indisponível.',diagnostico:'SUPABASE_CONFIG'},503);
 try{
  const chk=await fetch(base+'/rest/v1/rpc/is_raiz_admin',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(6500)});
  if(!chk.ok||await chk.json()!==true)return reply({erro:'Acesso restrito ao administrador.'},403);
 }catch{return reply({erro:'Falha ao confirmar acesso administrativo.'},502)}
 let body;
 try{const raw=await request.text();if(raw.length>1800)return reply({erro:'Consulta grande demais.'},413);body=JSON.parse(raw)}
 catch{return reply({erro:'Dados inválidos.'},400)}
 const name=String(body?.nome||'').trim();
 if(name.length<2||name.length>140)return reply({erro:'Informe nome entre 2 e 140 caracteres.'},400);
 const appId=String(env.SHOPEE_APP_ID||'').trim(),secret=String(env.SHOPEE_APP_SECRET||'').trim();
 if(!appId||!secret)return reply({erro:'Integração de afiliados da Shopee não está configurada.',diagnostico:'SHOPEE_CREDENCIAIS_AUSENTES'},503);
 const terms=queryTerms(name),attempts=[],seen=new Map();
 for(const term of terms){
  const result=await offers(appId,secret,term);
  attempts.push({tipo:term===terms[0]?'nome_completo':'busca_resumida',status:result.ok?'OK':result.code,recebidas:result.nodes?.length||0,...(!result.ok?{http:result.http||null,codigo_api:result.graphCode||null}:{})});
  if(!result.ok){
   // Falha na assinatura ou API não será resolvida por tentativas com outros termos.
   return reply({erro:result.code==='ERRO_REDE'?'A Shopee não respondeu à consulta.':'A API Shopee rejeitou a consulta. Confira o diagnóstico abaixo.',diagnostico:result.code,tentativas:attempts,observacao:'Nenhum produto foi cadastrado ou alterado.'},502);
  }
  for(const p of result.nodes){
   if(!p?.itemId||!p?.productName)continue;
   const sc=nameScore(name,p.productName);
   if(sc.score<40||sc.conflicting)continue;
   const id=String(p.itemId);
   const price=Number(p.priceMin);
   const offerLink=String(p.offerLink||'');
   const validAffiliate=validHttps(offerLink)&&(()=>{try{return ['s.shopee.com.br','www.shopee.com.br','shopee.com.br'].includes(new URL(offerLink).hostname)}catch{return false}})();
   const value={itemId:id,nome:String(p.productName).slice(0,250),imagem_url:validHttps(p.imageUrl)?String(p.imageUrl):'',preco:Number.isFinite(price)&&price>0?Number(price.toFixed(2)):null,link_afiliado:validAffiliate?offerLink:'',correspondencia:sc.score,quantidade_compativel:!sc.conflicting};
   const prev=seen.get(id);if(!prev||value.correspondencia>prev.correspondencia)seen.set(id,value);
  }
  if(seen.size>=6)break;
 }
 const sugestoes=[...seen.values()].sort((a,b)=>b.correspondencia-a.correspondencia).slice(0,6);
 return reply({modo:'SOMENTE_LEITURA',sugestoes,diagnostico:sugestoes.length?'SUGESTOES_ENCONTRADAS':'SEM_CORRESPONDENCIA',tentativas:attempts,observacao:'A API não confirmou a identidade do link afiliado. Confira produto, sabor, marca, peso e quantidade; valores são apenas referência.'});
}
export function onRequestGet(){return reply({erro:'Use POST autenticado.'},405)}
