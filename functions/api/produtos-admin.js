/* Raiz Ancestral V12 — Admin produtos, Etapa 19.
 * Somente admin verificado via JWT + RPC is_raiz_admin.
 * A chave service role jamais chega ao cliente.
 * GET lista, POST cadastra, PATCH edita/ativa/desativa. Sem DELETE.
 */
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Authorization'}});
const fields=['nome','descricao','imagem_url','preco','loja','categoria','link_afiliado','ativo','destaque','shopee_product_id'];
function https(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname}catch{return false}}
function validate(input,update=false){
 if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Dados inválidos.'};
 const bad=Object.keys(input).filter(k=>!fields.includes(k));
 if(bad.length)return {error:'Campo não permitido: '+bad.join(', ')};
 if(!update&&!['nome','loja','categoria','link_afiliado'].every(k=>typeof input[k]==='string'&&input[k].trim()))return {error:'Informe nome, loja, categoria e link.'};
 const out={};
 for(const [key,val] of Object.entries(input)){
  if(['nome','loja','categoria','link_afiliado','imagem_url','descricao','shopee_product_id'].includes(key)){
   if(val!==null&&typeof val!=='string')return {error:'Campo inválido: '+key};
   const v=String(val??'').trim();
   const cap={nome:250,loja:55,categoria:100,link_afiliado:1800,imagem_url:1800,descricao:2000,shopee_product_id:60}[key];
   if(v.length>cap)return {error:'Campo muito longo: '+key};
   if((key==='link_afiliado'&&(!v||!https(v)))||(key==='imagem_url'&&v&&!https(v)))return {error:'Endereço HTTPS inválido em '+key};
   if(['nome','loja','categoria'].includes(key)&&!v)return {error:'Campo obrigatório: '+key};
   out[key]=v||(['imagem_url','descricao','shopee_product_id'].includes(key)?null:v);
  } else if(key==='preco'){
   if(val===''||val===null){out.preco=null;continue}
   const number=Number(val);
   if(typeof val==='boolean'||!Number.isFinite(number)||number<=0||number>1000000)return {error:'Preço inválido. Use valor positivo ou vazio.'};
   out.preco=Number(number.toFixed(2));
  }else if(key==='ativo'||key==='destaque'){
   if(typeof val!=='boolean')return {error:'O campo '+key+' exige verdadeiro ou falso.'};
   out[key]=val;
  }
 }
 if(!Object.keys(out).length)return {error:'Nenhuma alteração recebida.'};
 return {value:out};
}
async function auth(request,env){
 const raw=String(request.headers.get('authorization')||'');
 const token=raw.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||token.length>6000)return {error:'Entre como administrador.',status:401};
 const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 const service=String(env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key||!service)return {error:'Configuração administrativa indisponível.',status:503};
 try{
  const r=await fetch(base+'/rest/v1/rpc/is_raiz_admin',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(7000)});
  if(!r.ok||await r.json()!==true)return {error:'Acesso restrito ao administrador.',status:403};
 }catch{return {error:'Falha ao validar administrador.',status:502}}
 return {base,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json','Prefer':'return=representation'}};
}
async function db(ctx,path,{method='GET',body,prefer}={}){
 const headers={...ctx.headers};if(prefer)headers.Prefer=prefer;
 const resp=await fetch(ctx.base+'/rest/v1/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 const payload=await resp.text();let data;try{data=JSON.parse(payload)}catch{data=[]}
 if(!resp.ok)return {error:'Supabase retornou erro HTTP '+resp.status,status:502};
 return {data};
}
export async function onRequest({request,env}){
 if(!['GET','POST','PATCH'].includes(request.method))return json({erro:'Método não permitido.'},405);
 const ctx=await auth(request,env);if(ctx.error)return json({erro:ctx.error},ctx.status);
 if(request.method==='GET'){
  const url=new URL(request.url);
  const page=Number(url.searchParams.get('page')||1);
  const term=String(url.searchParams.get('q')||'').trim();
  if(!Number.isSafeInteger(page)||page<1||page>100000||term.length>100)return json({erro:'Filtro inválido.'},400);
  const offset=(page-1)*30;
  const params=new URLSearchParams({select:'id,nome,descricao,imagem_url,preco,loja,categoria,link_afiliado,ativo,destaque,shopee_product_id,created_at',order:'id.desc',limit:'30',offset:String(offset)});
  if(term)params.set('nome','ilike.*'+term.replace(/[%*,()]/g,'')+'*');
  const r=await db(ctx,'produtos?'+params.toString());
  if(r.error)return json({erro:r.error},r.status);
  return json({pagina:page,produtos:r.data,mais:r.data.length===30});
 }
 if(!String(request.headers.get('content-type')||'').includes('application/json'))return json({erro:'Envie JSON.'},415);
 let raw;try{raw=await request.text();if(raw.length>12000)return json({erro:'Dados grandes demais.'},413)}
 catch{return json({erro:'Falha ao ler dados.'},400)}
 let input;try{input=JSON.parse(raw)}catch{return json({erro:'JSON inválido.'},400)}
 if(request.method==='POST'){
  const checked=validate(input);
  if(checked.error)return json({erro:checked.error},400);
  const product={...checked.value,ativo:false,destaque:false};
  const r=await db(ctx,'produtos',{method:'POST',body:product});
  if(r.error)return json({erro:r.error},r.status);
  return json({ok:true,produto:r.data[0],observacao:'Cadastrado inativo para revisão.'},201);
 }
 const id=Number(input?.id);
 if(!Number.isSafeInteger(id)||id<1)return json({erro:'ID inválido.'},400);
 const checked=validate(input?.alteracoes,true);
 if(checked.error)return json({erro:checked.error},400);
 const exists=await db(ctx,'produtos?select=id&id=eq.'+id);
 if(exists.error)return json({erro:exists.error},exists.status);
 if(exists.data.length!==1)return json({erro:'Produto não encontrado.'},404);
 const r=await db(ctx,'produtos?id=eq.'+id,{method:'PATCH',body:checked.value});
 if(r.error)return json({erro:r.error},r.status);
 return json({ok:true,produto:r.data[0]});
}
