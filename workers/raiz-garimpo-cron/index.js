/* Cloudflare Cron Trigger: a cada 6h, sem abrir o painel.
 * Nenhuma credencial no repositório. RAIZ_GARIMPO_CRON_TOKEN é segredo Worker.
 */
export default {
 async scheduled(controller,env,ctx){
  ctx.waitUntil((async()=>{
   if(!env.RAIZ_GARIMPO_CRON_TOKEN)return;
   try{
    const result=await fetch("https://raiz-ancestral.pages.dev/api/cron-garimpo",{
     method:"POST",
     headers:{"Content-Type":"application/json","Authorization":"Bearer "+env.RAIZ_GARIMPO_CRON_TOKEN},
     body:JSON.stringify({scheduled_at:controller.scheduledTime}),
     signal:AbortSignal.timeout(110000)
    });
    if(!result.ok)console.warn("Raiz Ancestral: verificação programada indisponível. HTTP",result.status);
   }catch{console.warn("Raiz Ancestral: falha de comunicação na execução agendada")}
  })());
 },
 async fetch(){return new Response("Not Found",{status:404})}
};
