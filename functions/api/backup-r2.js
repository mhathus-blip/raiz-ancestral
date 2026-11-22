/* Raiz Ancestral — backup externo privado, somente servidor Cloudflare Pages.
 * Endpoint exclusivo do pg_cron Supabase, credencial protegida no Vault/Pages.
 * R2 nunca possui domínio público; catálogo contém apenas dados comerciais.
 */
const reply=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const SECRET_HEADER="x-raiz-backup-key";
function equalSecret(a,b){
 if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length||b.length<48)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
function dateBrt(date=new Date()){
 const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"});
 const p=Object.fromEntries(fmt.formatToParts(date).filter(v=>v.type!=="literal").map(v=>[v.type,v.value]));
 return p.year+"-"+p.month+"-"+p.day;
}
function daysBetween(a,b){
 const x=Date.parse(a+"T12:00:00Z"),y=Date.parse(b+"T12:00:00Z");
 return Number.isFinite(x)&&Number.isFinite(y)?Math.round((y-x)/86400000):0;
}
async function fetchCatalog(env){
 const base=String(env.SUPABASE_URL||"").replace(/\/+$/,"").replace(/\/rest\/v1$/,"");
 const service=String(env.SUPABASE_SERVICE_ROLE_KEY||"");
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!service)throw Error("Supabase server configuration missing");
 const all=[];let cursor=null;
 for(let page=0;page<200;page++){
  const q=new URLSearchParams({select:"*",order:"id.asc",limit:"500"});
  if(cursor!==null)q.set("id","gt."+cursor);
  const res=await fetch(base+"/rest/v1/produtos?"+q.toString(),{
   headers:{apikey:service,Authorization:"Bearer "+service,Accept:"application/json"},
   cache:"no-store",signal:AbortSignal.timeout(20000)
  });
  if(!res.ok)throw Error("Database refused catalog batch (HTTP "+res.status+")");
  const chunk=await res.json();
  if(!Array.isArray(chunk))throw Error("Unexpected catalog batch");
  for(const p of chunk){
   const id=Number(p?.id);
   if(!Number.isSafeInteger(id)||id<=0||(cursor!==null&&id<=cursor))throw Error("Catalog row sequence invalid");
   if(all.length&&id<=Number(all[all.length-1].id))throw Error("Catalog ordering invalid");
   all.push(p);cursor=id;
  }
  if(chunk.length<500)break;
  if(page===199)throw Error("Catalog exceeds 100000 records; no partial backup allowed");
 }
 if(!all.length)throw Error("Catalog empty; refusing to overwrite recovery files");
 return all;
}
async function hash(str){
 const bytes=new TextEncoder().encode(str),digest=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
async function saveAndVerify(bucket,key,content,digest,quantity){
 await bucket.put(key,content,{httpMetadata:{contentType:"application/json; charset=utf-8"},customMetadata:{"sha256":digest,"products":String(quantity)}});
 const obj=await bucket.get(key);
 if(!obj)throw Error("R2 confirmation failed: missing object");
 const saved=await obj.text();
 if(await hash(saved)!==digest)throw Error("R2 verification failed: hash mismatch");
 return saved.length;
}
async function archiveDue(bucket,today){
 let cursor,mostRecent=null;
 do{
  const page=await bucket.list({prefix:"archive/",limit:1000,...(cursor?{cursor}:{})});
  for(const x of page.objects||[]){
   const m=/^archive\/(\d{4}-\d{2}-\d{2})\.json$/.exec(x.key);
   if(m&&(!mostRecent||m[1]>mostRecent))mostRecent=m[1];
  }
  cursor=page.truncated?page.cursor:null;
 }while(cursor);
 return !mostRecent||daysBetween(mostRecent,today)>=15;
}
async function expireDaily(bucket,today){
 let cursor,removed=0;
 do{
  const page=await bucket.list({prefix:"daily/",limit:1000,...(cursor?{cursor}:{})});
  for(const o of page.objects||[]){
   const m=/^daily\/(\d{4}-\d{2}-\d{2})\.json$/.exec(o.key);
   if(m&&daysBetween(m[1],today)>14){await bucket.delete(o.key);removed++}
  }
  cursor=page.truncated?page.cursor:null;
 }while(cursor);
 return removed;
}
export async function onRequestPost({request,env}){
 const given=request.headers.get(SECRET_HEADER);
 if(!equalSecret(given,env.RAIZ_BACKUP_WEBHOOK_SECRET))return reply({erro:"Acesso negado"},403);
 if(!env.RAIZ_BACKUPS||!env.SUPABASE_SERVICE_ROLE_KEY)return reply({erro:"Backup externo não configurado"},503);
 try{
  const now=new Date(),day=dateBrt(now);
  const catalog=await fetchCatalog(env);
  const data=JSON.stringify({sistema:"Raiz Ancestral",formato:1,criado_em:now.toISOString(),data_brasilia:day,quantidade:catalog.length,produtos:catalog});
  const digest=await hash(data),dailyKey="daily/"+day+".json";
  const bytes=await saveAndVerify(env.RAIZ_BACKUPS,dailyKey,data,digest,catalog.length);
  const archival=await archiveDue(env.RAIZ_BACKUPS,day);
  if(archival)await saveAndVerify(env.RAIZ_BACKUPS,"archive/"+day+".json",data,digest,catalog.length);
  const removed=await expireDaily(env.RAIZ_BACKUPS,day);
  return reply({ok:true,data:day,produtos:catalog.length,bytes,diario:dailyKey,quinzenal:archival,diarios_antigos_removidos:removed,checksum:digest});
 }catch(e){
  console.error("RAIZ_BACKUP_R2_FAILED",e?.message||"unknown");
  return reply({erro:"Falha ao criar/verificar backup externo. Conferir logs seguros."},502);
 }
}
export function onRequestGet(){return reply({erro:"Método não permitido"},405)}
