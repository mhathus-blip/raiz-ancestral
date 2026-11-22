/* Raiz V12.7 - verificação conservadora multiloja (Shopee disponível).
 * Sem varredura de sites não autorizados. A ausência numa API indica SUSPEITA, não remoção certa.
 * O administrador confirma o estado FANTASMA; RLS oculta fantasmas do público.
 */
const reply=(v,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Authorization"}});
async function auth(request,env){
 const token=String(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000)return {error:"Faça login no ADM.",status:401};
 const base=String(env.SUPABASE_URL||"").replace(/\/+$/,"").replace(/\/rest\/v1$/,"");
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||"").trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return {error:"Supabase não configurado.",status:503};
 const headers={apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json"};
 try{
  const check=await fetch(base+"/rest/v1/rpc/is_raiz_admin",{method:"POST",headers,body:"{}",signal:AbortSignal.timeout(6500)});
  if(!check.ok||await check.json()!==true)return {error:"Administrador não autorizado.",status:403};
 }catch{return {error:"Falha na autenticação.",status:502}}
 return {base,headers};
}
async function data(ctx,path,method="GET",body=null){
 try{
  const r=await fetch(ctx.base+"/rest/v1/"+path,{method,headers:{...ctx.headers,Prefer:"return=representation"},...(body!==null?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(9000)});
  const json=await r.json().catch(()=>null);
  if(!r.ok)return {error:"Banco não respondeu (HTTP "+r.status+").",status:502};
  return {value:json};
 }catch{return {error:"Falha de comunicação com Supabase.",status:502}}
}
function validId(x){return Number.isSafeInteger(x)&&x>0}
async function shopee(app,secret,id){
 if(!/^\d{3,20}$/.test(id))return {kind:"nao_suportado",reason:"ID Shopee ausente ou inválido"};
 if(!app||!secret)return {kind:"indeterminado",reason:"Credenciais Shopee não configuradas"};
 const query='query { productOfferV2(itemId: '+id+') { nodes { itemId productName priceMin } } }';
 const payload=JSON.stringify({query}),stamp=Math.floor(Date.now()/1000);
 const bytes=new TextEncoder().encode(app+stamp+payload+secret);
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
 try{
  const r=await fetch("https://open-api.affiliate.shopee.com.br/graphql",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"SHA256 Credential="+app+", Timestamp="+stamp+", Signature="+hash},body:payload,signal:AbortSignal.timeout(10000)});
  const json=await r.json().catch(()=>null);
  if(!r.ok||!json||json.errors?.length)return {kind:"indeterminado",reason:"Consulta Shopee falhou ou foi recusada"};
  const nodes=json.data?.productOfferV2?.nodes;
  if(!Array.isArray(nodes))return {kind:"indeterminado",reason:"Resposta Shopee sem formato esperado"};
  if(nodes.some(x=>String(x.itemId)===id))return {kind:"encontrado",reason:"Anúncio localizado na API de afiliados"};
  return {kind:"ausente",reason:"Anúncio não retornou na API de afiliados; não comprova exclusão da loja"};
 }catch{return {kind:"indeterminado",reason:"Timeout ou erro de rede na Shopee"}}
}
export async function onRequest({request,env}){
 if(!["GET","POST"].includes(request.method))return reply({erro:"Método inválido."},405);
 const ctx=await auth(request,env);if(ctx.error)return reply({erro:ctx.error},ctx.status);
 if(request.method==="GET"){
  const r=await data(ctx,"produtos?select=id,nome,loja,ativo,disponibilidade,disponibilidade_observacao,disponibilidade_verificada_em,disponibilidade_falhas,shopee_product_id&disponibilidade=neq.normal&order=disponibilidade_verificada_em.desc.nullslast&limit=100");
  return r.error?reply({erro:r.error},r.status):reply({produtos:r.value||[],integracoes:[{loja:"Shopee",modo:"api_autorizada"},{loja:"Amazon",modo:"manual_ate_integracao"},{loja:"Magalu",modo:"manual_ate_integracao"},{loja:"Outras afiliadas",modo:"manual_ate_integracao"}]});
 }
 if(!String(request.headers.get("content-type")||"").includes("application/json"))return reply({erro:"Envie JSON."},415);
 let body;try{const raw=await request.text();if(raw.length>2200)return reply({erro:"Dados grandes demais."},413);body=JSON.parse(raw)}catch{return reply({erro:"JSON inválido."},400)}
 if(body?.acao==="marcar"){
  const id=Number(body.id),status=String(body.estado||"");
  if(!validId(id)||!["normal","fantasma","suspeito"].includes(status))return reply({erro:"Estado inválido."},400);
  const found=await data(ctx,"produtos?select=id,disponibilidade&id=eq."+id+"&limit=1");
  if(found.error)return reply({erro:found.error},found.status);
  if(found.value?.length!==1)return reply({erro:"Produto não encontrado."},404);
  const edit={disponibilidade:status,disponibilidade_observacao:status==="normal"?"Restaurado pelo administrador":status==="fantasma"?"Marcado fantasma após revisão do administrador":"Enviado à revisão pelo administrador",disponibilidade_verificada_em:new Date().toISOString(),...(status==="normal"?{disponibilidade_falhas:0}:{})};
  const result=await data(ctx,"produtos?id=eq."+id,"PATCH",edit);
  return result.error?reply({erro:result.error},result.status):reply({ok:true,produto:result.value?.[0]});
 }
 if(body?.acao!=="verificar"||!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>4||new Set(body.ids).size!==body.ids.length||!body.ids.every(validId))return reply({erro:"Informe de 1 a 4 IDs válidos."},400);
 const ids=body.ids;
 const found=await data(ctx,"produtos?select=id,nome,loja,disponibilidade,disponibilidade_falhas,shopee_product_id&id=in.("+ids.join(",")+")");
 if(found.error)return reply({erro:found.error},found.status);
 const app=String(env.SHOPEE_APP_ID||"").trim(),secret=String(env.SHOPEE_APP_SECRET||"").trim();
 const result=[];
 for(const id of ids){
  const p=(found.value||[]).find(x=>Number(x.id)===id);
  if(!p){result.push({id,resultado:"não encontrado no cadastro"});continue}
  const provider=String(p.loja||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(provider!=="shopee"){result.push({id,loja:p.loja,resultado:"integração futura; verificar manualmente",estado:p.disponibilidade});continue}
  const outcome=await shopee(app,secret,String(p.shopee_product_id||""));
  if(outcome.kind==="indeterminado"||outcome.kind==="nao_suportado"){result.push({id,resultado:outcome.reason,estado:p.disponibilidade,alterado:false});continue}
  if(p.disponibilidade==="fantasma"){result.push({id,resultado:outcome.reason,estado:"fantasma",alterado:false,observacao:"O administrador deve restaurar manualmente."});continue}
  const next=outcome.kind==="ausente"?"suspeito":"normal";
  const changes={disponibilidade:next,disponibilidade_verificada_em:new Date().toISOString(),disponibilidade_observacao:outcome.reason,disponibilidade_falhas:outcome.kind==="ausente"?Math.min(1000,Math.max(0,Number(p.disponibilidade_falhas)||0)+1):0};
  const write=await data(ctx,"produtos?id=eq."+id,"PATCH",changes);
  result.push({id,resultado:write.error?write.error:outcome.reason,estado:write.error?p.disponibilidade:next,alterado:!write.error});
 }
 return reply({resultados:result,observacao:"Ausência na API gera SUSPEITA, nunca fantasma automático; falhas de rede não mudam o cadastro."});
}
