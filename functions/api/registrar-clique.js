/* Raiz Ancestral V12 — contabilizador anônimo de saídas para lojas.
 * Coleta somente ID do produto; nenhum IP, cookie, agente ou identificador pessoal
 * é enviado ao Supabase. Nunca interfere no link afiliado.
 */
const answer=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequestPost({request,env}){
 if(!String(request.headers.get('content-type')||'').startsWith('application/json'))return answer({ok:false},415);
 // Rejeita chamadas iniciadas por outros sites, inclusive quando Origin estiver ausente.
 const fetchSite=String(request.headers.get('sec-fetch-site')||'').toLowerCase();
 if(fetchSite && fetchSite!=='same-origin' && fetchSite!=='none')return answer({ok:false},403);
 const origin=request.headers.get('origin');
 if(origin){try{const u=new URL(origin),host=new URL(request.url);if(u.origin!==host.origin)return answer({ok:false},403)}catch{return answer({ok:false},403)}}
 let raw;
 try{raw=await request.text()}catch{return answer({ok:false},400)}
 if(raw.length>128)return answer({ok:false},413);
 let id;
 try{id=JSON.parse(raw)?.id}catch{return answer({ok:false},400)}
 if(!Number.isSafeInteger(id)||id<=0)return answer({ok:false},400);
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return answer({ok:false},503);
 try{
  const resp=await fetch(base+'/rest/v1/rpc/raiz_registrar_clique_produto',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_produto_id:id}),signal:AbortSignal.timeout(5000)});
  if(!resp.ok)return answer({ok:false},502);
  return answer({ok:true});
 }catch{return answer({ok:false},502)}
}
export function onRequestGet(){return answer({ok:false},405)}
