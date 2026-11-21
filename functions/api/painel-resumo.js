/* Alias com nome neutro para evitar filtros de bloqueio de URLs de analytics.
 * Mesma segurança: JWT + is_raiz_admin + RLS; nenhuma leitura pública.
 */
/* Raiz Ancestral V12 — Painel estatístico, exclusivo do administrador.
 * Consulta RLS e RPC protegida; sem armazenar IP, e-mail ou identificação pessoal.
 */
const answer=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Authorization'}});
export async function onRequestGet({request,env}){
 const token=String(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000)return answer({erro:'Faça login administrativo.'},401);
 const period=Number(new URL(request.url).searchParams.get('dias')||30);
 if(![7,30,90].includes(period))return answer({erro:'Período inválido.'},400);
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return answer({erro:'Supabase indisponível.'},503);
 try{
  const headers={apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const authorized=await fetch(base+'/rest/v1/rpc/is_raiz_admin',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(6000)});
  if(!authorized.ok||await authorized.json()!==true)return answer({erro:'Acesso administrativo necessário.'},403);
  const response=await fetch(base+'/rest/v1/rpc/raiz_resumo_cliques',{method:'POST',headers,body:JSON.stringify({p_dias:period}),signal:AbortSignal.timeout(11000)});
  if(!response.ok)return answer({erro:'Falha ao obter estatísticas. Código '+response.status},502);
  const data=await response.json();
  return answer({ok:true,dados:data,coleta:'cliques nos links de saída dos produtos; não representa vendas, visitas ou compradores'});
 }catch{return answer({erro:'Falha na consulta das estatísticas.'},502)}
}
export function onRequestPost(){return answer({erro:'Use GET autenticado.'},405)}
