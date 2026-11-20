/* Raiz Ancestral V12 — resolver link de afiliado sem scraping de página.
 * Tenta redirecionamentos HTTPS em hosts permitidos e consulta produto por itemId.
 * Apenas leitura, JWT + is_raiz_admin. Nunca substitui o link de comissão.
 */
const respond=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hosts=new Set(['s.shopee.com.br','shopee.com.br','www.shopee.com.br','shopee.com','www.shopee.com','shope.ee']);
const valid=s=>{try{const u=new URL(s);return u.protocol==='https:'&&hosts.has(u.hostname.toLowerCase())&&!u.username&&!u.password&&!u.port&&u.href.length<=1800?u:null}catch{return null}};
const extract=u=>{
 let m=u.pathname.match(/-i\.(\d{3,20})\.(\d{3,20})(?:\b|\/|$)/i)||u.pathname.match(/^\/product\/(\d{3,20})\/(\d{3,20})(?:\/|$)/i);
 if(m)return {shopId:m[1],itemId:m[2]};
 const shop=u.searchParams.get('shopid')||u.searchParams.get('shop_id');
 const item=u.searchParams.get('itemid')||u.searchParams.get('item_id');
 if(/^\d{3,20}$/.test(shop||'')&&/^\d{3,20}$/.test(item||''))return {shopId:shop,itemId:item};
 return null;
};
async function auth(request,env){
 const token=String(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000)return false;
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return false;
 try{
  const r=await fetch(base+'/rest/v1/rpc/is_raiz_admin',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(6500)});
  return r.ok&&await r.json()===true;
 }catch{return false}
}
async function resolve(initial){
 let at=initial,found=extract(at),hops=0;
 while(!found&&hops<5){
  let response;
  try{
   response=await fetch(at.href,{method:'GET',redirect:'manual',headers:{'Accept':'text/html,*/*;q=0.8','User-Agent':'Mozilla/5.0 (compatible; RaizAncestralBot/1.0)'},signal:AbortSignal.timeout(6500)});
  }catch{return {found:null,diagnostico:'REDIRECIONAMENTO_INDISPONIVEL',hops}}
  if(![301,302,303,307,308].includes(response.status))return {found:null,diagnostico:response.status===403||response.status===429?'SHOPEE_BLOQUEOU_ACESSO':'SEM_REDIRECIONAMENTO_IDENTIFICAVEL',hops,status_http:response.status};
  const location=response.headers.get('location');
  if(!location)return {found:null,diagnostico:'REDIRECIONAMENTO_SEM_DESTINO',hops};
  let next;try{next=valid(new URL(location,at).href)}catch{next=null}
  if(!next)return {found:null,diagnostico:'DESTINO_NAO_PERMITIDO',hops};
  if(next.href===at.href)return {found:null,diagnostico:'REDIRECIONAMENTO_CIRCULAR',hops};
  at=next;hops++;found=extract(at);
 }
 return {found,diagnostico:found?'ID_IDENTIFICADO':'LIMITE_DE_REDIRECIONAMENTOS',hops};
}
async function offer(env,id){
 const app=String(env.SHOPEE_APP_ID||'').trim(),secret=String(env.SHOPEE_APP_SECRET||'').trim();
 if(!app||!secret)return {diagnostico:'API_SEM_CREDENCIAIS'};
 const query='query { productOfferV2(itemId: '+id+', page: 1, limit: 3) { nodes { itemId productName imageUrl priceMin priceMax shopId productLink } } }';
 const body=JSON.stringify({query}),stamp=Math.floor(Date.now()/1000);
 const bytes=new TextEncoder().encode(app+stamp+body+secret);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const sig=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 try{
  const r=await fetch('https://open-api.affiliate.shopee.com.br/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'SHA256 Credential='+app+', Timestamp='+stamp+', Signature='+sig},body,signal:AbortSignal.timeout(9500)});
  const j=await r.json();
  if(!r.ok||j.errors?.length)return {diagnostico:'API_REJEITOU_CONSULTA',http:r.status,codigo:String(j.errors?.[0]?.extensions?.code||'').slice(0,45)};
  const nodes=j.data?.productOfferV2?.nodes;
  const node=Array.isArray(nodes)?nodes.find(x=>String(x.itemId)===String(id)):null;
  if(!node)return {diagnostico:'PRODUTO_NAO_RETORNADO_PELA_API'};
  const img=node.imageUrl;
  const priceMin=Number(node.priceMin),priceMax=Number(node.priceMax);
  const minValid=Number.isFinite(priceMin)&&priceMin>0&&priceMin<=1000000;
  const maxValid=Number.isFinite(priceMax)&&priceMax>0&&priceMax<=1000000;
  const samePrice=minValid&&maxValid&&Math.abs(priceMin-priceMax)<0.005;
  // Quando há variações, não afirmar que o menor preço vale para todas.
  const price=samePrice?Number(priceMin.toFixed(2)):null;
  return {diagnostico:'PRODUTO_CONFIRMADO_PELA_API',produto:{nome:String(node.productName||'').slice(0,250),imagem_url:typeof img==='string'&&/^https:\/\//i.test(img)?img:'',shopee_product_id:String(node.itemId),preco:price,faixa_preco:minValid&&maxValid?{min:Number(priceMin.toFixed(2)),max:Number(priceMax.toFixed(2))}:null,preco_status:samePrice?'UNICO':minValid&&maxValid?'VARIACOES':'INDISPONIVEL'}};
 }catch{return {diagnostico:'FALHA_COMUNICACAO_API'}}
}
export async function onRequestPost({request,env}){
 if(!String(request.headers.get('content-type')||'').includes('application/json'))return respond({erro:'Envie JSON.'},415);
 if(!await auth(request,env))return respond({erro:'Entre como administrador.'},403);
 let payload;try{const raw=await request.text();if(raw.length>2000)return respond({erro:'Dados grandes demais.'},413);payload=JSON.parse(raw)}catch{return respond({erro:'JSON inválido.'},400)}
 const original=String(payload?.link||'').trim(),url=valid(original);
 if(!url)return respond({erro:'Informe um link HTTPS da Shopee.'},400);
 const result=await resolve(url);
 if(!result.found)return respond({ok:false,link_original:original,...result,observacao:'A Shopee não permitiu confirmar o anúncio por redirecionamento; nenhum dado foi inventado.'});
 const api=await offer(env,result.found.itemId);
 return respond({ok:true,link_original:original,shopId:result.found.shopId,itemId:result.found.itemId,redirecionamentos:result.hops,...api,observacao:'O link afiliado original foi mantido; confira os dados antes de salvar.'});
}
export function onRequestGet(){return respond({erro:'Use POST autenticado.'},405)}
