/* V13.1: painel vivo. Exibe produtos reais somente no ADM autenticado. */
(()=>{
'use strict';
const app=document.getElementById('raiz-v13');if(!app)return;
const overview=app.querySelector('[data-view="overview"] .v13-view');if(!overview)return;
const widget=document.createElement('section');widget.id='v131-live';widget.className='v13-card v131-live';
widget.innerHTML='<div class="v131-heading"><div><span class="v131-overline">✦ CATÁLOGO EM TEMPO REAL</span><h3>🌿 Painel vivo dos produtos</h3><p>Fotos, anúncios e edição direta do catálogo.</p></div><div class="v131-head-actions"><button type="button" data-live-refresh>↻ Atualizar</button><a href="/" target="_blank" rel="noopener noreferrer">↗ Abrir vitrine</a></div></div>'+
'<div class="v131-tabs" role="tablist" aria-label="Visualizar produtos"><button type="button" role="tab" aria-selected="true" data-live-tab="recentes">🕒 Recentes</button><button type="button" role="tab" aria-selected="false" data-live-tab="maisclicados">📈 Mais clicados</button><button type="button" role="tab" aria-selected="false" data-live-tab="rascunhos">📝 Rascunhos</button><button type="button" role="tab" aria-selected="false" data-live-tab="sempreco">💰 Sem preço</button><button type="button" role="tab" aria-selected="false" data-live-tab="vitrine">🛍️ Vitrine pública</button></div>'+
'<div class="v131-toolbar"><label for="v131-search">🔎 Buscar <input id="v131-search" type="search" maxlength="100" placeholder="Nome do produto..."></label><span id="v131-summary" role="status" aria-live="polite">Aguardando autenticação...</span></div>'+
'<div class="v131-products" id="v131-products"></div><div class="v131-bottom"><button type="button" data-live-prev disabled>← Anterior</button><span id="v131-page">Página 1</span><button type="button" data-live-next disabled>Próxima →</button><button type="button" data-open="products">Gerenciar catálogo</button></div>';
const anchor=overview.querySelector('.v13-grid');if(anchor)anchor.insertAdjacentElement('afterend',widget);else overview.append(widget);
const el=id=>document.getElementById(id),grid=el('v131-products'),status=el('v131-summary'),search=el('v131-search');
let token='',tab='recentes',page=1,next=false,serial=0;
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
async function getPage(){
 if(tab==='maisclicados'){
  const d=await api('/api/painel-resumo?dias=30');
  const ids=(d.dados?.top_produtos||[]).map(p=>Number(p.id)).filter(i=>Number.isSafeInteger(i)&&i>0);
  const subset=ids.slice((page-1)*6,page*6);
  const products=await Promise.allSettled(subset.map(id=>api('/api/produtos-admin?id='+id)));
  return {produtos:products.filter(p=>p.status==='fulfilled'&&p.value.produto).map(p=>p.value.produto),mais:ids.length>page*6};
 }
 const params=new URLSearchParams({page:String(page),page_size:'6',estado:tab==='rascunhos'?'inativos':tab==='vitrine'?'ativos':'todos'});
 if(tab==='sempreco')params.set('preco','sem');
 if(search.value.trim())params.set('q',search.value.trim());
 return api('/api/produtos-admin?'+params);
}
async function load(){
 if(!token)return;
 const id=++serial;status.textContent='Consultando produtos...';grid.replaceChildren(text('p','Buscando anúncios...','v131-empty'));
 el('v131-page').textContent='Página '+page;el('v131-live').querySelector('[data-live-prev]').disabled=true;widget.querySelector('[data-live-next]').disabled=true;
 try{
  const d=await getPage();if(id!==serial)return;
  const products=Array.isArray(d.produtos)?d.produtos:[];
  grid.replaceChildren();
  for(const p of products)grid.append(card(p));
  if(!products.length)grid.append(text('p',tab==='maisclicados'?'Nenhum produto com cliques nos últimos 30 dias.':'Nenhum produto corresponde aos filtros.','v131-empty'));
  next=!!d.mais;
  widget.querySelector('[data-live-prev]').disabled=page<=1;
  widget.querySelector('[data-live-next]').disabled=!next;
  status.textContent=products.length+' produto(s) · página '+page+(tab==='maisclicados'?' · ranking de 30 dias':'');
 }catch(err){if(id!==serial)return;grid.replaceChildren(text('p','Consulta indisponível: '+err.message,'v131-empty'));status.textContent='Falha na consulta'}
}
widget.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.liveTab){tab=b.dataset.liveTab;page=1;for(const item of widget.querySelectorAll('[data-live-tab]'))item.setAttribute('aria-selected',String(item===b));load();return}
 if(b.hasAttribute('data-live-prev')&&page>1){page--;load();return}
 if(b.hasAttribute('data-live-next')&&next){page++;load();return}
 if(b.hasAttribute('data-live-refresh'))load();
});
let delay;search.addEventListener('input',()=>{clearTimeout(delay);delay=setTimeout(()=>{page=1;load()},340)});
window.addEventListener('raiz:admin-tests-unlocked',event=>{token=String(event.detail?.accessToken||'');if(token)load()});
})();