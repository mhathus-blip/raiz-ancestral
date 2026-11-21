/* Raiz Ancestral V12.5 — oportunidades privadas (sem publicação automática).
   Cada operação exige JWT Supabase E RPC is_raiz_admin; usa RLS do usuário. */
const answer=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Authorization"}});
const validHttps=(value,shopee=false)=>{
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&(!shopee||["s.shopee.com.br","www.shopee.com.br","shopee.com.br"].includes(u.hostname));}catch{return false}
};
async function context(request,env){
 const token=String(request.headers.get("Authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000)return {error:"Entre como administrador.",status:401};
 const base=String(env.SUPABASE_URL||"").replace(/\/+$/,"").replace(/\/rest\/v1$/,"");
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||"");
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return {error:"Conexão Supabase indisponível.",status:503};
 const headers={"apikey":key,"Authorization":"Bearer "+token,"Content-Type":"application/json"};
 try{
  const r=await fetch(base+"/rest/v1/rpc/is_raiz_admin",{method:"POST",headers,body:"{}",signal:AbortSignal.timeout(6500)});
  if(!r.ok||await r.json()!==true)return {error:"Acesso restrito ao administrador.",status:403};
 }catch{return {error:"Falha na autenticação.",status:502}}
 return {base,headers};
}
async function query(ctx,path,method="GET",payload=null){
 try{
  const r=await fetch(ctx.base+"/rest/v1/"+path,{method,headers:{...ctx.headers,Prefer:"return=representation"},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(12000)});
  const data=await r.json().catch(()=>null);
  if(!r.ok)return {error:r.status===409?"O anúncio já está na fila.":("Erro ao acessar fila (HTTP "+r.status+")."),status:r.status===409?409:502};
  return {data};
 }catch{return {error:"Fila temporariamente indisponível.",status:502}}
}
export async function onRequest({request,env}){
 if(!["GET","POST","PATCH"].includes(request.method))return answer({erro:"Método não permitido."},405);
 const ctx=await context(request,env);if(ctx.error)return answer({erro:ctx.error},ctx.status);
 if(request.method==="GET"){
  const result=await query(ctx,"raiz_oportunidades?select=id,origem,item_externo,nome,link_afiliado,imagem_url,preco_indicativo,categoria_sugerida,status,produto_id,consultado_em,revisado_em&order=consultado_em.desc&limit=100");
  return result.error?answer({erro:result.error},result.status):answer({oportunidades:result.data||[]});
 }
 if(!String(request.headers.get("Content-Type")||"").includes("application/json"))return answer({erro:"Envie JSON."},415);
 let input;try{const raw=await request.text();if(raw.length>5500)return answer({erro:"Dados grandes demais."},413);input=JSON.parse(raw)}catch{return answer({erro:"JSON inválido."},400)}
 if(request.method==="POST"){
  const id=String(input?.item_externo||"").trim();
  const nome=String(input?.nome||"").trim();
  const link=String(input?.link_afiliado||"").trim();
  const foto=String(input?.imagem_url||"").trim();
  const categoria=String(input?.categoria_sugerida||"").trim();
  const price=input?.preco_indicativo===null||input?.preco_indicativo===""?null:Number(input?.preco_indicativo);
  if(!/^\d{3,20}$/.test(id)||nome.length<3||nome.length>250||categoria.length>100||!validHttps(link,true)||link.length>1800||(foto&&(!validHttps(foto)||foto.length>1800))||price!==null&&(!Number.isFinite(price)||price<=0||price>1000000))return answer({erro:"Dados inconsistentes. Confira ID, URL Shopee, nome e preço."},400);
  const item={origem:"shopee_api",item_externo:id,nome,link_afiliado:link,imagem_url:foto||null,preco_indicativo:price,categoria_sugerida:categoria||"A classificar",status:"pendente"};
  const r=await query(ctx,"raiz_oportunidades","POST",item);
  return r.error?answer({erro:r.error},r.status):answer({ok:true,oportunidade:r.data?.[0]},201);
 }
 const id=Number(input?.id),status=String(input?.status||"");
 if(!Number.isSafeInteger(id)||id<=0||!["descartada","selecionada","pendente"].includes(status))return answer({erro:"Revisão inválida."},400);
 if(status==="selecionada"&&!Number.isSafeInteger(Number(input?.produto_id)))return answer({erro:"Selecione após cadastrar o produto como rascunho."},400);
 const changes={status,revisado_em:new Date().toISOString(),...(status==="selecionada"?{produto_id:Number(input.produto_id)}:{})};
 const result=await query(ctx,"raiz_oportunidades?id=eq."+id+"&status=eq.pendente","PATCH",changes);
 return result.error?answer({erro:result.error},result.status):result.data?.length?answer({ok:true,oportunidade:result.data[0]}):answer({erro:"Oportunidade já revisada ou não encontrada."},409);
}
