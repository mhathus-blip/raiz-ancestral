/* Etapa 20 — sugestões da API Shopee, nunca grava produtos e não substitui o link afiliado original.
 * Não pesquisa páginas arbitrárias e não presume que a oferta encontrada é o anúncio do usuário.
 */
const respond=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function secureUrl(raw){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}
}
export async function onRequestPost({request,env}){
 const token=String(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000)return respond({erro:'Faça login de administrador.'},401);
 if(!String(request.headers.get('content-type')||'').includes('application/json'))return respond({erro:'Envie JSON.'},415);
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return respond({erro:'Supabase indisponível.'},503);
 try{
  const check=await fetch(base+'/rest/v1/rpc/is_raiz_admin',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(6500)});
  if(!check.ok||await check.json()!==true)return respond({erro:'Acesso restrito.'},403);
  const raw=await request.text();
  if(raw.length>1800)return respond({erro:'Consulta muito longa.'},413);
  const data=JSON.parse(raw);
  const term=String(data?.nome||'').trim().slice(0,140);
  if(term.length<6||term.length>140)return respond({erro:'Informe pelo menos 6 caracteres do nome do produto.'},400);
  const appId=String(env.SHOPEE_APP_ID||'').trim(),secret=String(env.SHOPEE_APP_SECRET||'').trim();
  if(!appId||!secret)return respond({erro:'Credenciais da API Shopee não configuradas.'},503);
  const query='query { productOfferV2(keyword: '+JSON.stringify(term)+') { nodes { itemId productName imageUrl priceMin priceMax offerLink } } }';
  const payload=JSON.stringify({query});
  const timestamp=Math.floor(Date.now()/1000);
  const bytes=new TextEncoder().encode(appId+timestamp+payload+secret);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const signature=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const r=await fetch('https://open-api.affiliate.shopee.com.br/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'SHA256 Credential='+appId+', Timestamp='+timestamp+', Signature='+signature},body:payload,signal:AbortSignal.timeout(12000)});
  const result=await r.json();
  if(!r.ok||result.errors?.length)return respond({erro:'A Shopee não retornou ofertas válidas nesta consulta.'},502);
  const words=norm(term).split(' ').filter(w=>w.length>2);
  const matches=(result.data?.productOfferV2?.nodes||[])
   .filter(p=>p?.itemId&&p?.productName&&secureUrl(p?.imageUrl)&&secureUrl(p?.offerLink))
   .map(p=>{
    const n=norm(p.productName),hits=words.filter(w=>n.includes(w)).length;
    const price=Number(p.priceMin);
    return {itemId:String(p.itemId),nome:String(p.productName).slice(0,250),imagem_url:String(p.imageUrl),preco:Number.isFinite(price)&&price>0?Number(price.toFixed(2)):null,correspondencia:words.length?Math.round(100*hits/words.length):0};
   })
   .filter(p=>p.correspondencia>=35)
   .sort((a,b)=>b.correspondencia-a.correspondencia)
   .slice(0,6);
  return respond({modo:'SUGESTOES_SEM_GRAVACAO',sugestoes:matches,observacao:'Resultados aproximados. Confira marca, sabor, peso e quantidade antes de aplicar. O link afiliado informado não é substituído.'});
 }catch{return respond({erro:'Não foi possível obter sugestões da Shopee.'},502)}
}
export function onRequestGet(){return respond({erro:'Use POST autenticado.'},405)}
