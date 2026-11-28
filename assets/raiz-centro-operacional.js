/* Raiz Ancestral V14.3: central operacional, somente após MFA. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
if(!$('raiz-price-review')||!$('raiz-weekly-report'))return;
let token='',products=[],statuses=new Map(),report=null,page=0,busy=false;
const n=x=>Number(x||0).toLocaleString('pt-BR'),money=x=>Number(x).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const missing=p=>p.preco===null||p.preco===''||!Number.isFinite(Number(p.preco))||Number(p.preco)<=0;
const current=p=>statuses.get(Number(p.id))||{situacao:'revisar',nota:''};
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el};
const say=(id,value)=>$(id).textContent=value;
const quoted=x=>{let s=String(x??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
function csv(name,rows){
 const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quoted).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function api(method,body){
 if(!token)throw Error('Entre no ADM com MFA.');
 const response=await fetch('/api/operacoes-admin',{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(23000)});
 const data=await response.json().catch(()=>({erro:'Resposta inválida'}));
 if(!response.ok)throw Error(data.erro||'HTTP '+response.status);
 return data;
}
function filtered(){
 const term=norm($('raiz-op-search').value),store=$('raiz-op-shop').value,kind=$('raiz-op-filter').value;
 return products.filter(p=>{
  if(term&&!norm(String(p.id)+' '+p.nome+' '+p.loja).includes(term))return false;
  if(store&&p.loja!==store)return false;
  const st=current(p).situacao;
  if(kind==='sem_preco')return missing(p);
  return kind==='todos'||st===kind;
 });
}
function renderPrices(){
 const absent=products.filter(missing),done=products.filter(p=>current(p).situacao!=='revisar');
 say('raiz-op-total',n(products.length));say('raiz-op-missing',n(absent.length));
 say('raiz-op-review',n(absent.filter(p=>current(p).situacao==='revisar').length));
 say('raiz-op-confirmed',n(done.length));
 const list=filtered(),pages=Math.max(1,Math.ceil(list.length/20));page=Math.min(page,pages-1);
 const fragment=document.createDocumentFragment();
 if(!list.length)fragment.append(node('p','Nenhum produto encontrado.'));
 for(const p of list.slice(page*20,page*20+20)){
  const article=node('article',undefined,'raiz-op-entry'),main=node('div',undefined,'raiz-op-entry-main');
  main.append(node('strong',p.nome||'Produto sem título'));
  main.append(node('small','#'+p.id+' · '+p.loja+' · '+(p.categoria||'Sem categoria')+' · '+(missing(p)?'Consultar preço na loja':money(p.preco))+' · '+(p.ativo?'Ativo':'Inativo')));
  try{const u=new URL(p.link_afiliado);if(u.protocol==='https:'){
   const link=node('a','Conferir anúncio da loja');link.href=u.href;link.target='_blank';link.rel='sponsored noopener noreferrer';main.append(link);
  }}catch{}
  const controls=node('div',undefined,'raiz-op-entry-controls'),select=document.createElement('select');
  select.setAttribute('aria-label','Situação do produto '+p.id);
  for(const [value,label] of [['revisar','Pendente de revisão'],['consultar_na_loja','Consultar na loja'],['conferido','Conferido manualmente']])select.add(new Option(label,value));
  select.value=current(p).situacao;
  const note=document.createElement('input');note.type='text';note.maxLength=280;note.value=current(p).nota||'';note.placeholder='Observação';note.setAttribute('aria-label','Observação do produto '+p.id);
  const save=node('button','Salvar revisão');save.type='button';
  save.addEventListener('click',async()=>{
   save.disabled=true;say('raiz-op-info','Registrando revisão do produto #'+p.id+'…');
   try{const result=await api('POST',{produto_id:Number(p.id),situacao:select.value,nota:note.value.trim()});
    statuses.set(Number(p.id),result.estado);renderPrices();say('raiz-op-info','Revisão do produto #'+p.id+' salva. Preço e publicação não foram alterados.');
   }catch(e){save.disabled=false;say('raiz-op-info','Falha ao salvar: '+e.message)}
  });
  controls.append(select,note,save);article.append(main,controls);fragment.append(article);
 }
 $('raiz-op-list').replaceChildren(fragment);
 say('raiz-op-page','Página '+(page+1)+' de '+pages+' · '+list.length+' produto(s)');
 $('raiz-op-prev').disabled=page===0;$('raiz-op-next').disabled=page>=pages-1;
}
function ranking(id,arr,label){
 const root=$(id),frag=document.createDocumentFragment(),top=Math.max(1,...arr.map(x=>Number(x.cliques)||0));
 if(!arr.length)frag.append(node('li','Sem cliques registrados nesta semana.'));
 for(const x of arr.slice(0,10)){
  const li=node('li'),strong=node('strong',label(x));
  li.append(strong,document.createTextNode(' — '+n(x.cliques)+' cliques'));
  const bar=node('span',undefined,'raiz-op-bar');bar.style.width=Math.max(3,(Number(x.cliques)||0)/top*100)+'%';li.append(bar);frag.append(li);
 }
 root.replaceChildren(frag);
}
function renderReport(){
 if(!report)return;
 say('raiz-weekly-clicks',n(report.cliques_total));say('raiz-weekly-products',n(report.produtos_com_cliques));
 say('raiz-weekly-range',report.inicio+' a '+report.fim);
 ranking('raiz-weekly-categories',report.top_categorias||[],x=>x.categoria||'Sem categoria');
 ranking('raiz-weekly-top',report.top_produtos||[],x=>'#'+x.id+' '+x.nome);
 ranking('raiz-weekly-shops',report.por_loja||[],x=>x.loja||'Loja');
 say('raiz-weekly-status','Relatório atualizado. Cliques não representam vendas ou comissões.');
}
async function load(){
 if(!token||busy)return;busy=true;
 $('raiz-op-refresh-prices').disabled=true;$('raiz-weekly-refresh').disabled=true;
 say('raiz-op-info','Atualizando revisões e catálogo…');say('raiz-weekly-status','Atualizando relatório…');
 try{
  const data=await api('GET');
  products=Array.isArray(data.produtos)?data.produtos:[];
  statuses=new Map((data.estados||[]).map(x=>[Number(x.produto_id),x]));
  report=data.semanal;
  const stores=[...new Set(products.map(p=>p.loja).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const shop=$('raiz-op-shop'),old=shop.value;shop.replaceChildren(new Option('Todas as lojas',''),...stores.map(name=>new Option(name,name)));shop.value=stores.includes(old)?old:'';
  page=0;renderPrices();renderReport();
  say('raiz-op-info',n(products.length)+' produtos analisados. Revisões não alteram preços nem publicação.'+(data.amostraLimitada?' Limite de 1000 itens alcançado.':''));
 }catch(e){say('raiz-op-info','Consulta indisponível: '+e.message);say('raiz-weekly-status','Relatório indisponível: '+e.message)}
 finally{busy=false;$('raiz-op-refresh-prices').disabled=false;$('raiz-weekly-refresh').disabled=false}
}
async function health(){
 say('raiz-health-status','Verificando saúde técnica…');$('raiz-health-refresh').disabled=true;
 try{
  const [a,b]=await Promise.all([
   fetch('/api/saude-vitrines',{cache:'no-store',signal:AbortSignal.timeout(15000)}),
   fetch('/',{cache:'no-store',signal:AbortSignal.timeout(15000)})
  ]);
  const data=await a.json(),html=await b.text();
  const present=b.ok&&html.includes('id="raiz-bf-live"')&&html.includes('id="raiz-daily-panel"');
  say('raiz-health-status',a.ok&&data.ok&&present
   ?'Operacional: catálogo respondeu, '+data.produtos_amostrados+' produtos verificados (máx. 500), links/imagens válidos e os dois painéis presentes. A renderização real em celulares não é garantida por este teste.'
   :'Atenção: catálogo '+(data.estado||'sem resposta')+'; painéis no HTML: '+(present?'sim':'não')+'. Uma falha isolada não confirma queda do site.');
 }catch(e){say('raiz-health-status','Verificação inconclusiva: '+e.message+'. Repita antes de considerar indisponibilidade.')}
 finally{$('raiz-health-refresh').disabled=false}
}
for(const id of ['raiz-op-search','raiz-op-filter','raiz-op-shop'])$(id).addEventListener(id==='raiz-op-search'?'input':'change',()=>{page=0;renderPrices()});
$('raiz-op-prev').addEventListener('click',()=>{page=Math.max(0,page-1);renderPrices()});
$('raiz-op-next').addEventListener('click',()=>{page++;renderPrices()});
$('raiz-op-refresh-prices').addEventListener('click',load);
$('raiz-weekly-refresh').addEventListener('click',load);
$('raiz-health-refresh').addEventListener('click',health);
$('raiz-op-export').addEventListener('click',()=>{
 const rows=[['ID','Produto','Loja','Categoria','Preco','Situacao','Nota','Ativo','Link']];
 for(const p of filtered()){const st=current(p);rows.push([p.id,p.nome,p.loja,p.categoria,missing(p)?'':p.preco,st.situacao,st.nota||'',p.ativo?'sim':'nao',p.link_afiliado])}
 csv('raiz-revisao-precos.csv',rows);
});
$('raiz-weekly-export').addEventListener('click',()=>{
 if(!report){say('raiz-weekly-status','Atualize o relatório antes de exportar.');return}
 const rows=[['Relatorio semanal Raiz Ancestral','Inicio',report.inicio,'Fim',report.fim],
  ['Resumo','Cliques',report.cliques_total,'Produtos com cliques',report.produtos_com_cliques],
  [],['Categorias','Cliques'],...(report.top_categorias||[]).map(x=>[x.categoria,x.cliques]),
  [],['Produtos','ID','Loja','Cliques'],...(report.top_produtos||[]).map(x=>[x.nome,x.id,x.loja,x.cliques]),
  [],['Lojas','Cliques'],...(report.por_loja||[]).map(x=>[x.loja,x.cliques]),
  [],['Aviso','Cliques de saida nao representam vendas ou comissoes']];
 csv('raiz-relatorio-semanal-'+report.fim+'.csv',rows);
});
window.addEventListener('raiz:admin-tests-unlocked',e=>{
 token=String(e.detail?.accessToken||'');if(token){void load();void health()}
});
})();
