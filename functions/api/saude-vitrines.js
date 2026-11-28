/* Raiz Ancestral — saúde das vitrines: somente leitura do catálogo público.
 * Teste estrutural da fonte de dados; não afirma que o DOM renderizou em cada dispositivo.
 * Cache de 15 minutos para evitar sobrecarga e alarmes por oscilações curtas.
 */
const reply=(payload,status=200)=>Response.json(payload,{status,headers:{
 'Cache-Control':status===200?'public, max-age=0, s-maxage=900':'no-store',
 'X-Content-Type-Options':'nosniff'
}});
const valid=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}};
export async function onRequestGet({request,env}){
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'');
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return reply({ok:false,estado:'configuracao_indisponivel'},503);
 const cache=typeof caches!=='undefined'?caches.default:null;
 const cacheKey=new Request(new URL('/api/saude-vitrines',request.url));
 if(cache){const hit=await cache.match(cacheKey);if(hit)return hit}
 try{
  const response=await fetch(base+'/rest/v1/produtos?select=id,nome,imagem_url,link_afiliado,loja,categoria&ativo=eq.true&order=id.desc&limit=500',{
   headers:{apikey:key},signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)return reply({ok:false,estado:'catalogo_http_'+response.status},503);
  const products=await response.json();
  if(!Array.isArray(products))return reply({ok:false,estado:'resposta_invalida'},503);
  const n=products.length;
  const broken=products.filter(p=>!p.id||!p.nome||!valid(p.link_afiliado)||!valid(p.imagem_url)).length;
  const ok=n>=1&&broken===0;
  const output=reply({
    ok,estado:ok?'operacional':n===0?'catalogo_vazio':'cadastros_para_revisar',
    produtos_amostrados:n,limite_amostragem:500,links_imagens_ou_nomes_invalidos:broken,
    verificado_em:new Date().toISOString(),
    escopo:'integridade dos registros ativos e resposta do Supabase; não testa renderização, disponibilidade de terceiros ou compras'
  },ok?200:503);
  if(ok&&cache)await cache.put(cacheKey,output.clone());
  return output;
 }catch{return reply({ok:false,estado:'consulta_indisponivel',verificado_em:new Date().toISOString()},503)}
}
export function onRequestPost(){return reply({erro:'Método não permitido'},405)}
