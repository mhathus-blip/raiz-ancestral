/* Raiz Ancestral V12 — Admin produtos, Etapa 19.
 * Somente admin verificado via JWT + RPC is_raiz_admin.
 * Usa RLS do Supabase com token pessoal de administrador; sem service role.
 * GET lista, POST cadastra, PATCH edita/ativa/desativa. Sem DELETE.
 */
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Authorization'}});
const fields=['nome','descricao','imagem_url','preco','loja','categoria','link_afiliado','ativo','destaque','shopee_product_id'];

// Sugestões conservadoras: correspondência forte primeiro; casos ambíguos ficam em revisão.
function suggestCategory(name){
 const text=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const has=re=>re.test(text);
 if(has(/\b(adubo|fertilizante|npk|bokashi|substrato|ureia|húmus|humus|calcario)\b/))return 'Jardinagem e Fertilizantes';
 if(has(/\b(tesoura de poda|pulverizador|regador|enxada|pa de jardim|ferramenta de jardinagem)\b/))return 'Ferramentas para Jardinagem';
 if(has(/\b(alpiste|painco|comedouro|bebedouro|poleiro|gaiola|viveiro|ninho para|casinha para|mistura para passaros)\b/) || (has(/\b(ave|aves|passaro|passaros|calopsita|periquito|canario|papagaio|pintassilgo|coleiro|agapornis|mandarim)\b/) && has(/\b(racao|alimento|alimentacao|mistura|sementes|semente|comedouro|bebedouro|ninho|casinha|poleiro|gaiola|viveiro)\b/)))return 'Aves e Animais de Jardim';
 if(has(/\b(semente|sementes|muda|mudas|horta|hortaliça|hortalica|germinacao)\b/))return 'Hortas e Sementes';
 if(has(/\b(vaso decorativo|arranjo artificial|buque artificial|decoracao|ornamento|arvore artificial)\b/))return 'Decoração Natural';
 if(has(/\b(rosa natural|orquidea viva|flor natural|flores vivas)\b/))return 'Flores';
 if(has(/\b(shampoo|sabonete|creme corporal|hidratante|cosmetico|oleo para pele)\b/))return 'Beleza e Cuidados Naturais';
 if(has(/\b(capsulas|capsula|spirulina|chlorella|psyllium|suplemento alimentar|creatina)\b/) && !has(/\b(barra|barras|barrinha|barrinhas)\b/))return 'Suplementos Naturais';
 if(has(/\b(xicara|xicaras|caneca|canecas|copo|copos|garrafa|garrafas|bule|bules|chaleira|chaleiras|infusor|infusores|coador(?:es)? de cha|jarra|jarras|kit(?:s)? (?:de )?cha|conjunto(?:s)? (?:de )?(?:xicara|cha)|bandeja(?:s)? (?:para|de) cha|termica|termicas|termico|termicos)\b/))return 'Acessórios para Chá e Bebidas';
 if(has(/\b(cha|chas|camomila|hibisco|infusao|erva doce|hortela|capim limao)\b/))return 'Chás e Ervas';
 if(has(/\b(barra|barras|barrinha|barrinhas|cereal|granola|aveia|palha italiana|pasta de amendoim|amendoim|castanha|snack|farinha|chia|linhaca|mel puro|cookie|biscoito)\b/))return 'Alimentos Naturais';
 return 'A classificar';
}
function https(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname}catch{return false}}
function validate(input,update=false){
 if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Dados inválidos.'};
 const bad=Object.keys(input).filter(k=>!fields.includes(k));
 if(bad.length)return {error:'Campo não permitido: '+bad.join(', ')};
 if(!update&&!['nome','loja','link_afiliado'].every(k=>typeof input[k]==='string'&&input[k].trim()))return {error:'Informe nome, loja e link.'};
 const out={};
 for(const [key,val] of Object.entries(input)){
  if(['nome','loja','categoria','link_afiliado','imagem_url','descricao','shopee_product_id'].includes(key)){
   if(val!==null&&typeof val!=='string')return {error:'Campo inválido: '+key};
   const v=String(val??'').trim();
   const cap={nome:250,loja:55,categoria:100,link_afiliado:1800,imagem_url:1800,descricao:2000,shopee_product_id:60}[key];
   if(v.length>cap)return {error:'Campo muito longo: '+key};
   if((key==='link_afiliado'&&(!v||!https(v)))||(key==='imagem_url'&&v&&!https(v)))return {error:'Endereço HTTPS inválido em '+key};
   if(['nome','loja'].includes(key)&&!v)return {error:'Campo obrigatório: '+key};
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
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)return {error:'Conexão administrativa não configurada.',status:503};
 try{
  const r=await fetch(base+'/rest/v1/rpc/is_raiz_admin',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(7000)});
  if(!r.ok||await r.json()!==true)return {error:'Acesso restrito ao administrador.',status:403};
 }catch{return {error:'Falha ao validar administrador.',status:502}}
 return {base,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json','Prefer':'return=representation'}};
}
async function db(ctx,path,{method='GET',body,prefer}={}){
 const headers={...ctx.headers};if(prefer)headers.Prefer=prefer;
 const resp=await fetch(ctx.base+'/rest/v1/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 const payload=await resp.text();let data;try{data=JSON.parse(payload)}catch{data=[]}
 if(!resp.ok)return {error:'Supabase retornou erro HTTP '+resp.status,status:502};
 return {data};
}
// Leitura paginada de até 10 mil produtos, sempre sob RLS do administrador.
async function readCatalogForAdmin(ctx,columns){
 const items=[];
 let lastId=null;
 for(let page=0;page<20;page++){
   const params=new URLSearchParams({select:columns,order:'id.desc',limit:'500'});
   if(lastId!==null)params.set('id','lt.'+lastId);
   const r=await db(ctx,'produtos?'+params.toString());
   if(r.error)return r;
   const batch=r.data||[];
   items.push(...batch);
   if(batch.length<500)break;
   lastId=Number(batch[batch.length-1].id);
   if(!Number.isSafeInteger(lastId)||lastId<1)break;
 }
 return {data:items};
}
export async function onRequest({request,env}){
 if(!['GET','POST','PATCH'].includes(request.method))return json({erro:'Método não permitido.'},405);
 const ctx=await auth(request,env);if(ctx.error)return json({erro:ctx.error},ctx.status);
 if(request.method==='GET'){
  const url=new URL(request.url);
  // Exportação administrativa em lotes, SEM mutação e sem expor token no arquivo.
  // Exige a mesma verificação Supabase Auth + is_raiz_admin das outras ações.
  if(url.searchParams.get('export')==='1'){
    // Exportação em ordem de ID, com cursor estável (evita pular registros
    // quando novos produtos são cadastrados durante o download).
    // Mantém modo legado por page para compatibilidade; o novo ADM usa cursor.
    const batch=500;
    const cursorParam=url.searchParams.get('cursor');
    const cursorMode=cursorParam!==null;
    const page=Number(url.searchParams.get('page')||1);
    if(!Number.isSafeInteger(page)||page<1||page>25)return json({erro:'Lote de backup inválido.'},400);
    const cursor=cursorMode?Number(cursorParam):0;
    if(cursorMode&&(!Number.isSafeInteger(cursor)||cursor<0))return json({erro:'Cursor de backup inválido.'},400);
    const params=new URLSearchParams({
      select:'id,created_at,nome,descricao,imagem_url,preco,loja,categoria,link_afiliado,ativo,destaque,shopee_product_id',
      order:'id.asc',limit:String(batch)
    });
    if(cursorMode){
      if(cursor>0)params.set('id','gt.'+cursor);
    }else{
      params.set('offset',String((page-1)*batch));
    }
    const result=await db(ctx,'produtos?'+params.toString());
    if(result.error)return json({erro:result.error},result.status);
    const items=result.data||[];
    const last=items.length?Number(items[items.length-1].id):cursor;
    if(items.length&&(!Number.isSafeInteger(last)||last<1))
      return json({erro:'Falha de integridade: identificador inválido.'},502);
    return json({pagina:page,produtos:items,mais:items.length===batch,proximo_cursor:last});
  }
  if(url.searchParams.get('categories')==='1'){
   const r=await readCatalogForAdmin(ctx,'id,categoria');
   if(r.error)return json({erro:r.error},r.status);
   return json({categorias:[...new Set(['Acessórios para Chá e Bebidas','Aves e Animais de Jardim',...(r.data||[]).map(p=>String(p.categoria||'').trim()).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'pt-BR'))});
  }
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
  // Evita inserção duplicada por link ou nome. A pesquisa é feita sob a RLS do administrador.
  const existing=await readCatalogForAdmin(ctx,'id,nome,link_afiliado,loja');
  if(existing.error)return json({erro:existing.error},existing.status);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const duplicado=(existing.data||[]).find(p=>String(p.link_afiliado||'').trim()===checked.value.link_afiliado||
    (String(p.loja||'').toLowerCase()===String(checked.value.loja||'').toLowerCase()&&norm(p.nome)===norm(checked.value.nome)));
  if(duplicado)return json({erro:'Já existe um anúncio semelhante no catálogo (ID '+duplicado.id+'). Revise antes de cadastrar.',produto_existente:duplicado.id},409);
  const provided=String(checked.value.categoria||'').trim();
  const suggested=suggestCategory(checked.value.nome);
  const categoria=(!provided||provided==='A classificar')?suggested:provided;
  // Respeita a opção de visibilidade escolhida explicitamente no formulário.
  // Rascunho continua o padrão. Ativação exige imagem HTTPS revisada,
  // da mesma forma que a edição de um produto existente.
  const publicar=checked.value.ativo===true;
  if(publicar&&!https(checked.value.imagem_url)){
    return json({erro:'Para ativar no primeiro cadastro, informe e confira uma URL de imagem HTTPS válida.'},422);
  }
  const product={...checked.value,categoria,ativo:publicar,destaque:false};
  const r=await db(ctx,'produtos',{method:'POST',body:product});
  if(r.error)return json({erro:r.error},r.status);
  return json({ok:true,produto:r.data[0],observacao:publicar?'Produto cadastrado e ativado.':'Cadastrado inativo para revisão.'},201);
 }
 const id=Number(input?.id);
 if(!Number.isSafeInteger(id)||id<1)return json({erro:'ID inválido.'},400);
 const checked=validate(input?.alteracoes,true);
 if(checked.error)return json({erro:checked.error},400);
 const exists=await db(ctx,'produtos?select=id&id=eq.'+id);
 if(exists.error)return json({erro:exists.error},exists.status);
 if(exists.data.length!==1)return json({erro:'Produto não encontrado.'},404);
 // Não publicar novo anúncio sem uma imagem válida; uma sugestão nunca é aplicada automaticamente.
 if(checked.value.ativo===true){
  const current=await db(ctx,'produtos?select=id,imagem_url&id=eq.'+id);
  if(current.error)return json({erro:current.error},current.status);
  const image=Object.prototype.hasOwnProperty.call(checked.value,'imagem_url')?checked.value.imagem_url:current.data?.[0]?.imagem_url;
  if(!image||!https(image))return json({erro:'Para ativar este produto, informe uma URL de imagem HTTPS válida e revise a fotografia.'},422);
 }
 const r=await db(ctx,'produtos?id=eq.'+id,{method:'PATCH',body:checked.value});
 if(r.error)return json({erro:r.error},r.status);
 return json({ok:true,produto:r.data[0]});
}
