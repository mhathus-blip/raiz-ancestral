/* V13.1: painel vivo. Exibe produtos reais somente no ADM autenticado. */
(()=>{
'use strict';
const app=document.getElementById('raiz-v13');if(!app)return;
const overview=app.querySelector('[data-view="overview"] .v13-view');if(!overview)return;
const widget=document.createElement('section');widget.id='v131-live';widget.className='v13-card v131-live';
widget.innerHTML='<div class="v131-heading"><div><span class="v131-overline">✦ CATÁLOGO EM TEMPO REAL</span><h3>🌿 Painel vivo dos produtos</h3><p>Fotos, anúncios e edição direta do catálogo.</p></div><div class="v131-head-actions"><button type="button" data-live-refresh>↻ Atualizar</button><a href="/" target="_blank" rel="noopener noreferrer">↗ Abrir vitrine</a></div></div>'+
'<div class="v131-tabs" role="tablist" aria-label="Visualizar produtos"><button type="button" role="tab" aria-selected="true" data-live-tab="recentes">🕒 Recentes</button><button type="button" role="tab" aria-selected="false" data-live-tab="maisclicados">📈 Mais clicados</button><button type="button" role="tab" aria-selected="false" data-live-tab="rascunhos">📝 Rascunhos</button><button type="button" role="tab" aria-selected="false" data-live-tab="sempreco">💰 Sem preço</button><button type="button" role="tab" aria-selected="false" data-live-tab="vitrine">🛍️ Vitrine pública</button></div>'+
'<div class="v138-categories" aria-label="Filtrar por categoria"><div class="v138-categories-title"><strong>✧ Categorias dos produtos</strong><span id="v138-category-caption">Buscando categorias…</span></div><div class="v138-category-chips" id="v138-category-chips" role="group" aria-label="Selecionar categoria"><button type="button" data-category="" aria-pressed="true">▦ Todas as categorias</button></div></div>'+
'<div class="v131-toolbar"><label for="v131-search">🔎 Buscar <input id="v131-search" type="search" maxlength="100" placeholder="Nome do produto..."></label><span id="v131-summary" role="status" aria-live="polite">Aguardando autenticação...</span></div>'+
'<div class="v131-scroll-area" id="v131-scroll-area" tabindex="0" role="region" aria-label="Produtos com rolagem vertical"><div class="v131-products" id="v131-products"></div><div class="v131-load-more" id="v131-load-more" aria-live="polite">Role para carregar mais produtos</div><div id="v131-sentinel" aria-hidden="true"></div></div><div class="v131-bottom"><span id="v131-count">Produtos exibidos conforme você rola</span><button type="button" data-open="products">Gerenciar catálogo</button></div>';
const anchor=overview.querySelector('.v13-grid');if(anchor)anchor.insertAdjacentElement('afterend',widget);else overview.append(widget);
const el=id=>document.getElementById(id),grid=el('v131-products'),status=el('v131-summary'),search=el('v131-search');
let token='',tab='recentes',category='',page=1,next=false,serial=0,busy=false,shown=0;
const scrollArea=el('v131-scroll-area'),loadMore=el('v131-load-more'),sentinel=el('v131-sentinel'),chips=el('v138-category-chips');
const safe=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname?u.href:null}catch{return null}};
const text=(tag,value,klass)=>{const e=document.createElement(tag);e.textContent=String(value??'');if(klass)e.className=klass;return e};
const money=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Consultar preço na loja';
async function api(path){const r=await fetch(path,{headers:{Authorization:'Bearer '+token},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.erro||'Falha HTTP '+r.status);return d}
function card(p){
 const box=document.createElement('article');box.className='v131-product';
 const picture=document.createElement('div');picture.className='v131-picture';
 const source=safe(p.imagem_url);
 if(source){const img=document.createElement('img');img.src=source;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{img.remove();picture.append(text('span','🌿','v131-fallback'))});picture.append(img)}
 else picture.append(text('span','🌿','v131-fallback'));
 const info=document.createElement('div');info.className='v131-info';
 const meta=document.createElement('div');meta.className='v131-meta';
 meta.append(text('span',p.loja||'Loja parceira'),text('span',p.disponibilidade==='fantasma'?'👻 Fantasma':p.disponibilidade==='suspeito'?'⚠ Suspeito':p.ativo?'● Ativo':'○ Inativo','v131-tag'));
 const name=text('h4',p.nome||'Produto sem nome');name.title=p.nome||'';
 info.append(meta,name,text('strong',money(p.preco),'v131-price'),text('small',p.categoria||'A classificar','v131-category'));
 const actions=document.createElement('div');actions.className='v131-actions';
 const edit=text('button','✎ Editar');edit.type='button';edit.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('raiz:admin-open-product',{detail:{id:Number(p.id)}})));actions.append(edit);
 const link=safe(p.link_afiliado);
 if(link){const a=text('a','↗ Anúncio');a.href=link;a.target='_blank';a.rel='sponsored noopener noreferrer';actions.append(a)}
 box.append(picture,info,actions);return box;
}
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
async function loadCategories(){
 try{
  const data=await api('/api/produtos-admin?categories=1');
  if(!token)return;
  const names=[...new Set((data.categorias||[]).map(v=>String(v||'').trim()).filter(Boolean))];
  chips.replaceChildren();
  const choices=[['','▦ Todas as categorias'],...names.map(n=>[n,n])];
  for(const [value,label] of choices){
   const button=text('button',label);button.type='button';button.dataset.category=value;
   button.setAttribute('aria-pressed',String(value===category));
   chips.append(button);
  }
  if(category&&!names.includes(category)){category='';load(true)}
  el('v138-category-caption').textContent=names.length+' categorias disponíveis · escolha uma para localizar e editar';
 }catch(err){
  el('v138-category-caption').textContent='Categorias indisponíveis: '+err.message;
 }
}
async function getPage(){
 if(tab==='maisclicados'){
  const d=await api('/api/painel-resumo?dias=30');
  const ids=(d.dados?.top_produtos||[]).map(p=>Number(p.id)).filter(i=>Number.isSafeInteger(i)&&i>0);
  const products=await Promise.allSettled(ids.map(id=>api('/api/produtos-admin?id='+id)));
  const term=search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const found=products.filter(p=>p.status==='fulfilled'&&p.value.produto).map(p=>p.value.produto)
   .filter(p=>(!term||norm(p.nome).includes(term))&&(!category||String(p.categoria||'').trim()===category));
  const start=(page-1)*6;
  return {produtos:found.slice(start,start+6),mais:found.length>start+6};
 }
 const params=new URLSearchParams({page:String(page),page_size:'6',estado:tab==='rascunhos'?'inativos':tab==='vitrine'?'ativos':'todos'});
 if(tab==='sempreco')params.set('preco','sem');
 if(category)params.set('categoria',category);
 if(search.value.trim())params.set('q',search.value.trim());
 return api('/api/produtos-admin?'+params);
}
async function load(reset=false){
 if(!token||busy&&!reset)return;
 if(reset){
  serial++;page=1;next=true;shown=0;scrollArea.scrollTop=0;
  grid.replaceChildren();
 }
 const ticket=serial;
 if(!next)return;
 busy=true;let succeeded=false;loadMore.textContent='Carregando mais produtos...';status.textContent='Consultando catálogo...';
 try{
  const d=await getPage();
  if(ticket!==serial)return;
  const products=Array.isArray(d.produtos)?d.produtos:[];
  if(!products.length&&!shown)grid.append(text('p',tab==='maisclicados'?'Nenhum produto com cliques nos últimos 30 dias.':'Nenhum produto corresponde aos filtros.','v131-empty'));
  const fragment=document.createDocumentFragment();
  for(const p of products)fragment.append(card(p));
  grid.append(fragment);
  shown+=products.length;
  next=!!d.mais&&products.length>0;
  page++;
  succeeded=true;
  status.textContent=shown+' produto(s) exibido(s)'+(next?' · role para ver mais':' · fim da lista');
  el('v131-count').textContent=shown+' produto(s) carregado(s)';
  loadMore.textContent=next?'Role para carregar mais produtos':'✓ Todos os produtos desta seleção foram carregados';
 }catch(err){
  if(ticket!==serial)return;
  loadMore.textContent='Falha ao carregar: '+err.message+'. Role novamente ou clique em Atualizar.';
  status.textContent='Consulta interrompida após '+shown+' produtos';
 }finally{
  // Não liberar uma busca antiga para sobrescrever o estado de um novo filtro.
  if(ticket===serial){busy=false;if(succeeded&&next&&scrollArea.scrollHeight<=scrollArea.clientHeight+100)queueMicrotask(()=>load());}
 }
}
const observer=new IntersectionObserver(entries=>{
 if(entries.some(e=>e.isIntersecting)&&token&&next&&!busy)load();
},{root:scrollArea,rootMargin:'170px 0px',threshold:0});
observer.observe(sentinel);
chips.addEventListener('click',event=>{
 const button=event.target.closest('button[data-category]');if(!button)return;
 category=button.dataset.category||'';
 for(const chip of chips.querySelectorAll('button[data-category]'))chip.setAttribute('aria-pressed',String(chip===button));
 load(true);
});
widget.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.liveTab){tab=b.dataset.liveTab;for(const item of widget.querySelectorAll('[data-live-tab]'))item.setAttribute('aria-selected',String(item===b));load(true);return}
 if(b.hasAttribute('data-live-refresh')){loadCategories();load(true)}
});
let delay;search.addEventListener('input',()=>{clearTimeout(delay);delay=setTimeout(()=>load(true),340)});
scrollArea.addEventListener('scroll',()=>{if(token&&next&&!busy&&scrollArea.scrollTop+scrollArea.clientHeight>=scrollArea.scrollHeight-190)load()},{passive:true});
window.addEventListener('raiz:admin-tests-unlocked',event=>{token=String(event.detail?.accessToken||'');if(token){loadCategories();load(true)}});
})();