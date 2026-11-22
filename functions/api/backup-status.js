/* Raiz Ancestral — private backup health. Only verified admin (AAL2). */
const respond=(v,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Authorization"}});
function aal2(t){try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).aal==="aal2"}catch{return false}}
async function supa(base,key,token,fn){
 const r=await fetch(base+"/rest/v1/rpc/"+fn,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{}",cache:"no-store",signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error("Supabase returned "+r.status+" from "+fn);
 return await r.json();
}
function dayBr(d=new Date()){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const x=Object.fromEntries(p.filter(v=>v.type!=="literal").map(v=>[v.type,v.value]));
 return x.year+"-"+x.month+"-"+x.day;
}
function days(a,b){return Math.round((Date.parse(b+"T12:00:00Z")-Date.parse(a+"T12:00:00Z"))/86400000)}
async function latest(bucket,prefix){
 let cursor,result=null;
 do{
  const page=await bucket.list({prefix,limit:1000,...(cursor?{cursor}:{})});
  for(const o of page.objects||[]){
   const m=/^(\d{4}-\d{2}-\d{2})\.json$/.exec(o.key.slice(prefix.length));
   if(m&&(!result||m[1]>result.dia))result={dia:m[1],key:o.key,bytes:o.size};
  }
  cursor=page.truncated?page.cursor:null;
 }while(cursor);
 return result;
}
export async function onRequestGet({request,env}){
 const token=String(request.headers.get("Authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000||!aal2(token))return respond({erro:"Login administrativo com MFA obrigatório."},401);
 const base=String(env.SUPABASE_URL||"").replace(/\/+$/,"").replace(/\/rest\/v1$/,"");
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||"").trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key||!env.RAIZ_BACKUPS)return respond({erro:"Monitoramento indisponível."},503);
 try{
  if(await supa(base,key,token,"is_raiz_admin")!==true)return respond({erro:"Permissão administrativa necessária."},403);
  const [banco,diario,quinzenal]=await Promise.all([
   supa(base,key,token,"raiz_status_monitoramento_backup"),
   latest(env.RAIZ_BACKUPS,"daily/"),
   latest(env.RAIZ_BACKUPS,"archive/")
  ]);
  const hoje=dayBr(),auditoria=banco?.ultima_auditoria,alertas=[];
  if(!banco?.monitor_ativo)alertas.push("Uma ou mais rotinas de backup estão desativadas.");
  if(!diario||days(diario.dia,hoje)>1)alertas.push("O arquivo diário externo está atrasado.");
  if(!quinzenal||days(quinzenal.dia,hoje)>16)alertas.push("O arquivo quinzenal externo está atrasado.");
  if(auditoria?.status==="falha")alertas.push("A auditoria encontrou falha na execução dos backups.");
  if(auditoria?.dia&&days(auditoria.dia,hoje)>1)alertas.push("A verificação diária está atrasada.");
  return respond({ok:true,situacao:alertas.length?"atencao":"normal",alertas,
   agendamentos_ativos:banco?.agendamentos_ativos||0,ultima_auditoria:auditoria||null,
   backup_interno:banco?.ultimo_backup_interno||null,r2_diario:diario,r2_quinzenal:quinzenal});
 }catch(e){console.error("RAIZ_MONITOR_FAIL",String(e?.message||"unknown"));return respond({erro:"Erro ao verificar backups. Confira os logs privados."},502)}
}
export function onRequestPost(){return respond({erro:"Método inválido"},405)}
