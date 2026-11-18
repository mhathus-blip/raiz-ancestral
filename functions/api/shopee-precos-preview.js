/**
 * Raiz Ancestral V12 — Etapa 17: diagnóstico de preços, somente leitura.
 * POST /api/shopee-precos-preview {ids:[41,40,...]}, até 4 por consulta.
 * Exige Supabase access_token e RPC is_raiz_admin. Não grava no banco.
 */
const SHOPEE='https://open-api.affiliate.shopee.com.br/graphql';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const allowedHost=h=>['s.shopee.com.br','shopee.com.br','www.shopee.com.br'].includes(h);
function itemIdFromUrl(raw){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||!allowedHost(u.hostname)||u.username||u.password)return null;
  const path=decodeURIComponent(u.pathname).slice(0,700);
  const match=path.match(/-i\.(\d{3,20})\.(\d{3,20})(?:\/|$|\?)/i)||path.match(/\/product\/(\d{3,20})\/(\d{3,20})(?:\/|$)/i);
  if(match)return match[2];
  const shop=u.searchParams.get('shopid')||u.searchParams.get('shopId');
  const item=u.searchParams.get('itemid')||u.searchParams.get('itemId');
  return /^\d{3,20}$/.test(shop||'')&&/^\d{3,20}$/.test(item||'')?item:null;
 }catch{return null;}
}
async function resolveLink(raw){
 let current;
 try{current=new URL(raw)}catch{return {status:'URL_INVALIDA'}}
 if(current.protocol!=='https:'||!allowedHost(current.hostname)||current.username||current.password)return {status:'URL_INVALIDA'};
 const visited=new Set();
 for(let i=0;i<5;i++){
  const id=itemIdFromUrl(current.href);
  if(id)return {status:'ITEM_IDENTIFICADO',itemId:id};
  if(visited.has(current.href))break;
  visited.add(current.href);
  let resp;
  try{resp=await fetch(current.href,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(4500)})}
  catch{return {status:'LINK_NAO_RESOLVIDO'}}
  const location=resp.headers.get('location');
  if(resp.status<300||resp.status>=400||!location)return {status:'LINK_SEM_ID_EXPLICITO'};
  let next;
  try{next=new URL(location,current)}catch{return {status:'REDIRECIONAMENTO_INVALIDO'}}
  if(next.protocol!=='https:'||!allowedHost(next.hostname)||next.username||next.password)return {status:'REDIRECIONAMENTO_EXTERNO'};
  current=next;
 }
 return {status:'LINK_NAO_RESOLVIDO'};
}
async function queryShopee(appId,secret,itemId){
 if(!/^\d{3,20}$/.test(itemId))return {status:'ID_INVALIDO'};
 const query=`query { productOfferV2(itemId: ${itemId}) { nodes { itemId productName priceMin priceMax offerLink } } }`;
 const payload=JSON.stringify({query});
 try{
  const timestamp=Math.floor(Date.now()/1000);
  const message=new TextEncoder().encode(appId+timestamp+payload+secret);
  const digest=await crypto.subtle.digest('SHA-256',message);
  const signature=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const response=await fetch(SHOPEE,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`},body:payload,signal:AbortSignal.timeout(9000)});
  const data=await response.json();
  if(!response.ok||data.errors?.length)return {status:'CONSULTA_API_FALHOU'};
  const item=(data.data?.productOfferV2?.nodes||[]).find(x=>String(x.itemId)===itemId);
  if(!item)return {status:'NAO_ENCONTRADO_NA_API'};
  const min=Number(item.priceMin),max=Number(item.priceMax);
  if(!Number.isFinite(min)||min<=0||(Number.isFinite(max)&&max>0&&max<min))return {status:'PRECO_INVALIDO'};
  return {status:'PRECO_CONSULTADO',itemId,preco_min:min,preco_max:Number.isFinite(max)&&max>0?max:null,nome_api:String(item.productName||'').slice(0,180)};
 }catch{return {status:'CONSULTA_API_FALHOU'}}
}
export async function onRequestPost({request,env}){
 if(!String(request.headers.get('content-type')||'').includes('application/json'))return reply({erro:'JSON necessário.'},415);
 const token=String(request.headers.get('Authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>5000)return reply({erro:'Faça login de administrador.'},401);
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return reply({erro:'Servidor Supabase não configurado.'},500);
 const headers={apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 try{
  const auth=await fetch(`${base}/rest/v1/rpc/is_raiz_admin`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(6000)});
  if(!auth.ok||await auth.json()!==true)return reply({erro:'Administrador não autorizado.'},403);
  const raw=await request.text();
  if(raw.length>5000)return reply({erro:'Solicitação grande demais.'},413);
  const ids=JSON.parse(raw)?.ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>4||new Set(ids.map(String)).size!==ids.length||!ids.every(x=>Number.isSafeInteger(x)&&x>0))return reply({erro:'Informe de 1 a 4 IDs únicos e positivos.'},400);
  const data=await fetch(`${base}/rest/v1/produtos?select=id,nome,loja,preco,link_afiliado,shopee_product_id&id=in.(${ids.join(',')})`,{headers:{apikey:key,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(6000)});
  if(!data.ok)return reply({erro:'Falha ao consultar catálogo autorizado.'},502);
  const products=await data.json();
  const appId=String(env.SHOPEE_APP_ID||'').trim(),secret=String(env.SHOPEE_APP_SECRET||'').trim();
  if(!appId||!secret)return reply({erro:'A API da Shopee não está configurada.'},503);
  const output=[];
  for(const id of ids){
   const p=products.find(x=>Number(x.id)===id);
   if(!p){output.push({id,status:'NAO_ENCONTRADO'});continue}
   if(String(p.loja||'').trim().toLowerCase()!=='shopee'){output.push({id,status:'OUTRA_LOJA'});continue}
   if(p.preco!==null&&p.preco!==''&&Number.isFinite(Number(p.preco))&&Number(p.preco)>0){output.push({id,status:'JA_POSSUI_PRECO'});continue}
   // Preferir o itemId confirmado e armazenado no Supabase; links encurtados nem sempre expõem o ID.
   const storedId=String(p.shopee_product_id||'').trim();
   const resolved=/^\d{3,20}$/.test(storedId)?{status:'ITEM_IDENTIFICADO',itemId:storedId,fonte:'ID_CADASTRADO'}:await resolveLink(String(p.link_afiliado||''));
   if(resolved.status!=='ITEM_IDENTIFICADO'){output.push({id,nome:p.nome,status:resolved.status});continue}
   output.push({id,nome:p.nome,fonte_id:resolved.fonte||'LINK',...await queryShopee(appId,secret,resolved.itemId)});
  }
  return reply({modo:'SOMENTE_LEITURA',total:output.length,resultados:output,observacao:'Nenhum registro foi alterado. Preços são indicativos da API e precisam de conferência.'});
 }catch{return reply({erro:'Falha na consulta; nenhuma alteração foi realizada.'},502)}
}
export function onRequestGet(){return reply({erro:'Use POST autenticado.'},405)}
