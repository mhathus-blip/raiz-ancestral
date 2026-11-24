
/* V13 BF — verificação de descontos informados pela Shopee.
 * Somente produtos ativos já cadastrados. Nenhum preço/desconto é fabricado.
 * Resposta pública limitada, em cache; chaves permanecem no servidor.
 */
const BF_TZ='America/Sao_Paulo';
function bfDate(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:BF_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return v.year+'-'+v.month+'-'+v.day;
}
function bfJson(value,status=200){
 return Response.json(value,{status,headers:{'Cache-Control':'public, max-age=0, s-maxage=900','X-Content-Type-Options':'nosniff'}});
}
async function checkBfOffer(p,appId,secret){
 const id=String(p.shopee_product_id||'');
 if(!/^\d{3,20}$/.test(id))return null;
 const query='query { productOfferV2(itemId: '+id+') { nodes { itemId priceMin priceDiscountRate productName } } }';
 const payload=JSON.stringify({query});
 try{
  const ts=Math.floor(Date.now()/1000);
  const sig=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(appId+ts+payload+secret));
  const hash=[...new Uint8Array(sig)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const res=await fetch(SHOPEE_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'SHA256 Credential='+appId+', Timestamp='+ts+', Signature='+hash},body:payload,signal:AbortSignal.timeout(8000)});
  if(!res.ok)return null;
  const data=await res.json();
  if(data.errors?.length)return null;
  const o=(data.data?.productOfferV2?.nodes||[]).find(n=>String(n.itemId)===id);
  const rate=Number(o?.priceDiscountRate),price=Number(o?.priceMin);
  if(!o||!Number.isFinite(rate)||rate<=0||!Number.isFinite(price)||price<=0)return null;
  const url=new URL(p.link_afiliado);
  if(url.protocol!=='https:'||url.username||url.password)return null;
  return {id:p.id,nome:p.nome,imagem:p.imagem_url,loja:'Shopee',link:p.link_afiliado,preco:price,descontoInformado:true,consultadoEm:new Date().toISOString()};
 }catch{return null}
}
async function bfOffers(env,request){
 const date=bfDate();
 if(!/^2026-11-27$/.test(date))return bfJson({ativo:false,produtos:[],data:date,info:'Painel disponível somente na Black Friday (27/11/2026).'});
 const cache=typeof caches!=='undefined'?caches.default:null;
 const key=new Request(new URL('/api/shopee?bf=1',request.url).href,{method:'GET'});
 if(cache){const hit=await cache.match(key);if(hit)return hit}
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const apiKey=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'');
 const appId=String(env.SHOPEE_APP_ID||'').trim(),secret=String(env.SHOPEE_APP_SECRET||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!apiKey||!appId||!secret)
  return bfJson({ativo:true,produtos:[],info:'Consulta de promoções indisponível; confira os produtos no catálogo.'},503);
 let source;
 try{
  const url=base+'/rest/v1/produtos?select=id,nome,imagem_url,loja,link_afiliado,shopee_product_id&ativo=eq.true&loja=eq.Shopee&order=id.asc&limit=500';
  const resp=await fetch(url,{headers:{apikey:apiKey},signal:AbortSignal.timeout(7500)});
  if(!resp.ok)throw Error('supabase');
  source=await resp.json();
  if(!Array.isArray(source))throw Error('catalog');
 }catch{return bfJson({ativo:true,produtos:[],info:'Consulta do catálogo temporariamente indisponível.'},503)}
 const eligible=source.filter(p=>/^\d{3,20}$/.test(String(p.shopee_product_id||''))&&p.nome&&p.link_afiliado);
 const slot=Math.floor(Date.now()/1200000);
 const selection=[];
 if(eligible.length){
  const start=(slot*12)%eligible.length;
  for(let i=0;i<Math.min(12,eligible.length);i++)selection.push(eligible[(start+i)%eligible.length]);
 }
 const found=[];
 for(let i=0;i<selection.length;i+=4){
  const results=await Promise.all(selection.slice(i,i+4).map(p=>checkBfOffer(p,appId,secret)));
  found.push(...results.filter(Boolean));
 }
 const output=bfJson({ativo:true,data:date,produtos:found,verificados:selection.length,info:found.length?'Descontos indicados pela API Shopee; confira condições na loja.':'Nenhum desconto confirmado neste lote. Consulte novamente mais tarde.'});
 if(cache&&output.status===200)await cache.put(key,output.clone());
 return output;
}

const SHOPEE_API = "https://open-api.affiliate.shopee.com.br/graphql";

export async function onRequestGet({ env, request }) {
  if(new URL(request.url).searchParams.get('bf')==='1')return bfOffers(env,request);
  try {
    const appId = String(env.SHOPEE_APP_ID || "").trim();
    const secret = String(env.SHOPEE_APP_SECRET || "").trim();
    

    if (!appId || !secret) {
      return Response.json(
        { erro: "Credenciais da Shopee não configuradas." },
        { status: 500 }
      );
    }

    const query = `query {
      productOfferV2(keyword: "plantas") {
        nodes {
          itemId
          productName
          imageUrl
          priceMin
          priceMax
          offerLink
          commissionRate
        }
      }
    }`;

    const payload = JSON.stringify({ query });
    const timestamp = Math.floor(Date.now() / 1000);

    const mensagem = appId + timestamp + payload + secret;

    const bytes = new TextEncoder().encode(mensagem);
    const hash = await crypto.subtle.digest("SHA-256", bytes);

    const assinatura = Array.from(new Uint8Array(hash))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");

    const authorization =
      `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${assinatura}`;

    const resposta = await fetch(SHOPEE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization
      },
      body: payload
    });

    const dados = await resposta.json();

    return Response.json({
      status: resposta.ok ? "consulta_realizada" : "erro_http",
      httpStatus: resposta.status,
      dados
    });

  } catch (erro) {
    return Response.json(
      { erro: "Falha na comunicação com a Shopee." },
      { status: 500 }
    );
  }
}
