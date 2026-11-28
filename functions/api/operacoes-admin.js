/* Raiz Ancestral — central operacional de preços e relatório semanal.
 * Exclusivo a administradores com MFA aal2 + RPC is_raiz_admin.
 * GET consulta em leitura; POST altera apenas o estado interno de revisão,
 * nunca o preço, link, publicação ou produto.
 */
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
function aal2(token){
 try{const s=token.split('.')[1];if(!s)return false;const claims=JSON.parse(atob(s.replace(/-/g,'+').replace(/_/g,'/')));return claims.aal==='aal2'}catch{return false}
}
export async function onRequest({request,env}){
 const method=request.method;
 if(!['GET','POST'].includes(method))return reply({erro:'Método não permitido'},405);
 const token=String(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000)return reply({erro:'Autenticação requerida'},401);
 if(!aal2(token))return reply({erro:'MFA exigido'},403);
 const host=new URL(request.url);
 if(method==='POST'){
  const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
  if(origin&&origin!==host.origin||site&&!['same-origin','none'].includes(site))return reply({erro:'Origem não permitida'},403);
 }
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'');
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return reply({erro:'Configuração indisponível'},503);
 const hdr={apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const call=(uri,options={})=>fetch(base+'/rest/v1/'+uri,{...options,headers:{...hdr,...options.headers},signal:AbortSignal.timeout(12000)});
 try{
  const auth=await call('rpc/is_raiz_admin',{method:'POST',body:'{}'});
  if(!auth.ok||await auth.json()!==true)return reply({erro:'Acesso administrativo não autorizado'},403);
  if(method==='GET'){
   const [products,notes,report]=await Promise.all([
    call('produtos?select=id,nome,loja,categoria,preco,ativo,imagem_url,link_afiliado,created_at&order=id.desc&limit=1000'),
    call('raiz_revisao_precos_status?select=produto_id,situacao,nota,atualizado_em&limit=1000'),
    call('rpc/raiz_relatorio_semanal_operacional',{method:'POST',body:'{}'})
   ]);
   if(!products.ok||!notes.ok||!report.ok)return reply({erro:'Consulta indisponível',status:[products.status,notes.status,report.status]},502);
   const [produtos,estados,semanal]=await Promise.all([products.json(),notes.json(),report.json()]);
   if(!Array.isArray(produtos)||!Array.isArray(estados)||!semanal)return reply({erro:'Dados inválidos'},502);
   return reply({ok:true,produtos,estados,semanal,amostraLimitada:produtos.length>=1000});
  }
  const raw=await request.text();
  if(raw.length>700)return reply({erro:'Conteúdo excessivo'},413);
  let input;try{input=JSON.parse(raw)}catch{return reply({erro:'JSON inválido'},400)}
  const id=Number(input?.produto_id),situacao=String(input?.situacao||''),nota=String(input?.nota||'').trim();
  if(!Number.isSafeInteger(id)||id<=0||!['revisar','consultar_na_loja','conferido'].includes(situacao)||nota.length>280)
   return reply({erro:'Revisão inválida'},400);
  const existing=await call('produtos?select=id&id=eq.'+id+'&limit=1');
  if(!existing.ok||(await existing.json()).length!==1)return reply({erro:'Produto não encontrado'},404);
  const result=await call('raiz_revisao_precos_status?on_conflict=produto_id',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
   body:JSON.stringify({produto_id:id,situacao,nota,atualizado_em:new Date().toISOString()})
  });
  if(!result.ok)return reply({erro:'Não foi possível registrar a revisão'},502);
  const rows=await result.json();
  return reply({ok:true,estado:rows[0]||{produto_id:id,situacao,nota}});
 }catch{return reply({erro:'Falha de comunicação com a central operacional'},503)}
}
