/* Raiz Ancestral — contador público de visitas por sessão.
 * Servidor usa exclusivamente credencial secreta (Cloudflare Pages env).
 * Sem cookies, IPs, e-mails ou IDs pessoais armazenados.
 */
const response=(data,status=200)=>Response.json(data,{
  status,
  headers:{
    'Cache-Control':'no-store, max-age=0',
    'Content-Type':'application/json; charset=utf-8',
    'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'none'
  }
});
const validUuid=s=>typeof s==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
async function rpc(env,name,args){
  const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
  const key=String(env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)throw new Error('not_configured');
  const res=await fetch(base+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify(args),
    signal:AbortSignal.timeout(8000),
    cache:'no-store'
  });
  if(!res.ok)throw new Error('upstream_'+res.status);
  return await res.json();
}
export async function onRequestGet({env}){
  try {
    const data=await rpc(env,'raiz_resumo_visitas',{});
    return response({ok:true,hoje:Number(data?.hoje)||0,mes:Number(data?.mes)||0,referencia:data?.referencia||null});
  }catch(e){return response({ok:false,erro:'Visitas temporariamente indisponíveis.'},503)}
}
export async function onRequestPost({request,env}){
  if(!String(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))
    return response({ok:false},415);
  const origin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');
  if(site && !['same-origin','none'].includes(site))return response({ok:false},403);
  if(!origin || origin!==new URL(request.url).origin)return response({ok:false},403);
  let body;
  try{
    const text=await request.text();
    if(text.length>150)return response({ok:false},413);
    body=JSON.parse(text);
  }catch{return response({ok:false},400)}
  if(!validUuid(body?.sessao))return response({ok:false},400);
  try{
    const data=await rpc(env,'raiz_contar_visita',{p_sessao:body.sessao});
    return response({ok:true,hoje:Number(data?.hoje)||0,mes:Number(data?.mes)||0,referencia:data?.referencia||null});
  }catch{return response({ok:false,erro:'Contagem temporariamente indisponível.'},503)}
}
