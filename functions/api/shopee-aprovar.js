// Endpoint administrativo: importa SOMENTE produtos explicitamente aprovados.
// Nunca use a service role key no navegador.
const responder = (data, status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const normalizar = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function tokenValido(expected, supplied) {
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  let diff=0; for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);
  return diff===0;
}
const categorias = new Set(['Alimentos e Bebidas','Alimentos Naturais','Beleza e Cuidados Naturais','Chás e Ervas','Decoração Natural','Ferramentas para Jardinagem','Flores','Hortas e Sementes','Jardinagem e Fertilizantes','Suplementos Naturais']);
function urlHttps(v) { try { const u=new URL(v); return u.protocol==='https:' && !!u.hostname && !u.username && !u.password; } catch { return false; } }
export async function onRequestPost({request,env}) {
  if(!tokenValido(String(env.IMPORT_PREVIEW_TOKEN||''),String(request.headers.get('X-Import-Token')||''))) return responder({erro:'Não autorizado.'},401);
  if(!String(request.headers.get('content-type')||'').includes('application/json')) return responder({erro:'Envie JSON.'},415);
  const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
  const key=String(env.SUPABASE_SERVICE_ROLE_KEY||'');
  if(!urlHttps(base)||!key) return responder({erro:'Configuração do servidor incompleta.'},500);
  let body;
  try { const raw=await request.text(); if(raw.length>100000) return responder({erro:'Solicitação grande demais.'},413); body=JSON.parse(raw); }
  catch {return responder({erro:'JSON inválido.'},400);}
  if(body?.confirmar!=='IMPORTAR_APROVADOS'||!Array.isArray(body.produtos)||body.produtos.length<1||body.produtos.length>20) return responder({erro:'Informe confirmar=IMPORTAR_APROVADOS e de 1 a 20 produtos aprovados.'},400);
  const aprovados=[]; const rejeitados=[]; const nomesNovos=new Set(); const linksNovos=new Set();
  for(const [i,p] of body.produtos.entries()) {
    const nome=String(p?.nome||'').trim(),link=String(p?.link_afiliado||'').trim(),imagem=String(p?.imagem_url||'').trim();
    const categoria=String(p?.categoria||'').trim(),preco=Number(p?.preco),nomeKey=normalizar(nome);
    if(!nome||nome.length>250||!urlHttps(link)||!urlHttps(imagem)||!categorias.has(categoria)||!Number.isFinite(preco)||preco<=0||preco>1000000||nomesNovos.has(nomeKey)||linksNovos.has(link)) { rejeitados.push({indice:i,motivo:'Dados inválidos ou repetidos no lote'}); continue; }
    nomesNovos.add(nomeKey); linksNovos.add(link);
    aprovados.push({nome,descricao:String(p.descricao||'').slice(0,1000),imagem_url:imagem,preco,loja:'Shopee',categoria,link_afiliado:link,ativo:true,destaque:false});
  }
  if(!aprovados.length) return responder({modo:'SEM_GRAVACAO',importados:0,rejeitados},422);
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  try {
    // Leitura de todo o catálogo para reduzir duplicação entre lojas.
    const r=await fetch(`${base}/rest/v1/produtos?select=nome,link_afiliado&limit=10000`,{headers});
    if(!r.ok) return responder({erro:`Falha ao consultar catálogo (HTTP ${r.status}). Nenhuma gravação realizada.`},502);
    const existentes=await r.json();
    const nomes=new Set(existentes.map(p=>normalizar(p.nome))); const links=new Set(existentes.map(p=>String(p.link_afiliado||'').trim()));
    const novos=[];
    for(const p of aprovados) {
      if(nomes.has(normalizar(p.nome))||links.has(p.link_afiliado)) {rejeitados.push({nome:p.nome,motivo:'Já existe no catálogo'});continue;}
      nomes.add(normalizar(p.nome)); links.add(p.link_afiliado); novos.push(p);
    }
    if(!novos.length) return responder({modo:'SEM_GRAVACAO',importados:0,rejeitados});
    const insert=await fetch(`${base}/rest/v1/produtos`,{method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(novos)});
    if(!insert.ok) return responder({erro:`Falha na inserção (HTTP ${insert.status}).`,detalhe:(await insert.text()).slice(0,300),rejeitados},502);
    const gravados=await insert.json();
    return responder({modo:'IMPORTACAO_CONFIRMADA',importados:gravados.length,ids:gravados.map(p=>p.id),rejeitados});
  }catch(e){return responder({erro:'Falha de comunicação com Supabase.',detalhe:String(e.message||e)},502);}
}
export function onRequestGet(){return responder({erro:'Use POST autenticado.'},405);}
