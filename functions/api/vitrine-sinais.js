/* V14.2 — Sinais agregados e anônimos para curadoria das vitrines.
 * Retorna somente ID do produto e contagem de cliques em 7/30 dias.
 * Não consulta ou expõe visitantes, IPs, cookies nem credenciais privadas.
 */
const reply=(data,status=200)=>Response.json(data,{status,headers:{
 'Cache-Control':status===200?'public, max-age=0, s-maxage=3600':'no-store',
 'X-Content-Type-Options':'nosniff'
}});
export async function onRequestGet({request,env}){
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return reply({sinais:[]},503);
 const cache=typeof caches!=='undefined'?caches.default:null;
 const cacheKey=new Request(new URL('/api/vitrine-sinais',request.url).href);
 try{
  if(cache){const cached=await cache.match(cacheKey);if(cached)return cached}
  const response=await fetch(base+'/rest/v1/rpc/raiz_sinais_vitrine_publica',{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
   body:'{}',signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)return reply({sinais:[]},502);
  const data=await response.json();
  if(!Array.isArray(data))return reply({sinais:[]},502);
  const clean=data.slice(0,200).map(x=>({
   id:Number(x.id),cliques_7d:Math.max(0,Number(x.cliques_7d)||0),
   cliques_30d:Math.max(0,Number(x.cliques_30d)||0)
  })).filter(x=>Number.isSafeInteger(x.id)&&x.id>0);
  const output=reply({sinais:clean,atualizadoEm:new Date().toISOString()});
  if(cache)await cache.put(cacheKey,output.clone());
  return output;
 }catch{return reply({sinais:[]},503)}
}
export function onRequestPost(){return reply({erro:'Método não permitido'},405)}
