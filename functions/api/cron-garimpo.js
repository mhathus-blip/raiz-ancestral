/* Raiz Ancestral V12.8 — gatilho privado do garimpo agendado.
 * Só o Worker Cron com token secreto aciona. Credenciais Shopee e Supabase
 * service_role permanecem exclusivamente no servidor, nunca no navegador.
 * Novas ofertas ficam PENDENTES; zero publicações automáticas.
 */
const send=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function validUrl(raw,shopee=false){
 try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&(!shopee||["s.shopee.com.br","shopee.com.br","www.shopee.com.br"].includes(u.hostname))}catch{return false}
}
async function equalTokens(a,b){
 if(!a||!b||a.length!==b.length||a.length<40)return false;
 const enc=new TextEncoder();
 const [x,y]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(a)),crypto.subtle.digest("SHA-256",enc.encode(b))]);
 let diff=0;const p=new Uint8Array(x),q=new Uint8Array(y);
 for(let i=0;i<p.length;i++)diff|=p[i]^q[i];return diff===0;
}
const simplify=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function relevant(term,name){
 const ignore=new Set(["para","de","com","sem","natural","naturais","produto","kit"]);
 const tokens=[...new Set(simplify(term).split(" ").filter(t=>t.length>=3&&!ignore.has(t)))];
 const target=" "+simplify(name)+" ";
 if(!tokens.length)return false;
 return tokens.filter(w=>target.includes(" "+w+" ")).length>=Math.max(1,Math.ceil(tokens.length*0.6));
}
async function shopee(app,secret,term){
 const query='query { productOfferV2(keyword: '+JSON.stringify(term)+') { nodes { itemId productName imageUrl priceMin offerLink } } }';
 const payload=JSON.stringify({query}),stamp=Math.floor(Date.now()/1000);
 const bytes=new TextEncoder().encode(app+stamp+payload+secret);
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 const signature=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const resp=await fetch("https://open-api.affiliate.shopee.com.br/graphql",{
  method:"POST",headers:{"Content-Type":"application/json",Authorization:"SHA256 Credential="+app+", Timestamp="+stamp+", Signature="+signature},
  body:payload,signal:AbortSignal.timeout(13000)
 });
 const json=await resp.json().catch(()=>null);
 if(!resp.ok||!json||json.errors?.length||!Array.isArray(json.data?.productOfferV2?.nodes))throw Error("API Shopee indisponível ou resposta inesperada");
 return json.data.productOfferV2.nodes;
}
export async function onRequestPost({request,env}){
 const passed=String(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1]||"";
 if(!await equalTokens(passed,String(env.RAIZ_GARIMPO_CRON_TOKEN||"")))return send({erro:"Não autorizado"},401);
 let input;
 try{input=await request.json()}catch{return send({erro:"JSON inválido"},400)}
 const scheduled=Number(input?.scheduled_at);
 if(!Number.isSafeInteger(scheduled)||scheduled<1||Math.abs(Date.now()-scheduled)>45*60*1000)return send({erro:"Janela de execução inválida"},400);
 const windowTime=new Date(Math.floor(scheduled/21600000)*21600000).toISOString();
 const base=String(env.SUPABASE_URL||"").replace(/\/+$/,"").replace(/\/rest\/v1$/,"");
 const key=String(env.SUPABASE_SERVICE_ROLE_KEY||"").trim();
 const app=String(env.SHOPEE_APP_ID||"").trim(),secret=String(env.SHOPEE_APP_SECRET||"").trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key||!app||!secret)return send({erro:"Integração do servidor indisponível"},503);
 const head={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=representation"};
 async function db(path,method="GET",payload,prefer){
  const response=await fetch(base+"/rest/v1/"+path,{method,headers:{...head,...(prefer?{Prefer:prefer}:{})},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(12000)});
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw Error("Banco de dados retornou HTTP "+response.status);
  return Array.isArray(result)?result:[];
 }
 // Reserva exclusiva da janela para impedir execuções repetidas.
 let run;
 try{
  const inserted=await db("raiz_garimpo_execucoes?on_conflict=janela_utc","POST",{janela_utc:windowTime,situacao:"executando"},"resolution=ignore-duplicates,return=representation");
  if(!inserted.length)return send({ok:true,duplicada:true});
  run=inserted[0];
 }catch{return send({erro:"Não foi possível reservar execução"},502)}
 const stats={termos_consultados:0,encontrados:0,novos:0,atualizados:0};
 const temas=["chá de camomila","infusor para chá","sementes para horta","chá de hibisco"];
 const seen=new Set(),issues=[];
 try{
  for(const term of temas){
   let matches;try{matches=await shopee(app,secret,term);stats.termos_consultados++}catch{issues.push("Consulta Shopee indisponível para um dos temas");break}
   const eligible=matches.filter(p=>p?.itemId&&/^\d{3,20}$/.test(String(p.itemId))&&p?.productName&&validUrl(p.offerLink,true)&&relevant(term,p.productName)).slice(0,6);
   for(const p of eligible){
    const id=String(p.itemId);if(seen.has(id))continue;seen.add(id);stats.encontrados++;
    try{
     // Ignora produtos já cadastrados, inclusive inativos ou fantasmas.
     const inCatalog=await db("produtos?select=id&shopee_product_id=eq."+id+"&limit=1");
     if(inCatalog.length)continue;
     const existing=await db("raiz_oportunidades?select=id,status,preco_base,preco_indicativo,detectado_automaticamente,visto_em&origem=eq.shopee_api&item_externo=eq."+id+"&limit=1");
     const price=Number(p.priceMin);
     const goodPrice=Number.isFinite(price)&&price>0&&price<=1000000?Number(price.toFixed(2)):null;
     if(existing.length){
      const prev=existing[0];
      if(prev.status!=="pendente")continue;
      const oldPrice=Number(prev.preco_indicativo);
      // Preserva preço-base da primeira observação. Nova queda merece aviso.
      if(goodPrice!==null&&(prev.preco_indicativo===null||goodPrice<oldPrice)){
       const change={preco_indicativo:goodPrice,consultado_em:new Date().toISOString(),detectado_automaticamente:true,visto_em:null};
       await db("raiz_oportunidades?id=eq."+prev.id+"&status=eq.pendente","PATCH",change);
       stats.atualizados++;
      }
      continue;
     }
     const item={origem:"shopee_api",loja:"Shopee",item_externo:id,nome:String(p.productName).slice(0,250),link_afiliado:String(p.offerLink).slice(0,1800),imagem_url:validUrl(p.imageUrl)?String(p.imageUrl).slice(0,1800):null,preco_indicativo:goodPrice,preco_base:goodPrice,categoria_sugerida:"A classificar",status:"pendente",detectado_automaticamente:true,visto_em:null};
     const inserted=await db("raiz_oportunidades?on_conflict=origem,item_externo","POST",item,"resolution=ignore-duplicates,return=representation");
     if(inserted.length)stats.novos++;
    }catch{issues.push("Uma oportunidade não pôde ser registrada")}
   }
  }
 }catch{issues.push("Falha inesperada na verificação")}
 const status=issues.length?(stats.termos_consultados?"parcial":"erro"):"concluido";
 try{await db("raiz_garimpo_execucoes?id=eq."+run.id,"PATCH",{situacao:status,concluido_em:new Date().toISOString(),...stats,observacao:issues.length?[...new Set(issues)].join("; ").slice(0,500):"Varredura concluída; descontos não confirmados pela loja"})}
 catch{return send({erro:"Falha ao gravar resumo da verificação"},502)}
 return send({ok:status==="concluido",situacao:status,...stats});
}
export function onRequestGet(){return send({erro:"Método não permitido"},405)}
