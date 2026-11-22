/* V13 - navegação administrativa progressiva; só aparece após autenticação.
   Não modifica APIs ou regras de publicação. */
(()=>{
'use strict';
const pages=[
 ['overview','Visão geral','◈','Prioridades e indicadores'],
 ['opportunities','Oportunidades','✦','Pesquisa e fila privada'],
 ['products','Produtos','▤','Catálogo e rascunhos'],
 ['ghosts','Disponibilidade','◉','Suspeitos e fantasmas'],
 ['prices','Auditoria de preços','◇','Conferência e relatórios'],
 ['stats','Estatísticas','▥','Cliques e desempenho'],
 ['campaigns','Campanhas','❀','Simulador e temas'],
 ['automation','Automações','⚙','Garimpo de seis horas'],
 ['backup','Backup','⬡','Exportação segura']
];
const bindings={
 opportunities:['raiz-oportunidades-admin'],
 products:['raiz-gerenciar-produtos'],
 ghosts:['raiz-fantasmas-admin'],
 prices:['raiz-auditoria-precos','raiz-reconciliacao-precos','raiz-shopee-api-preview'],
 stats:['raiz-estatisticas'],
 campaigns:['raiz-central-automacoes']
};
const id=x=>document.getElementById(x);
const node=(tag,klass,txt)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(txt!==undefined)e.textContent=txt;return e};
const app=node('div');app.id='raiz-v13';app.hidden=true;
app.innerHTML='<div class="v13-backdrop" id="v13-backdrop"></div>'+
 '<aside class="v13-side" aria-label="Menu administrativo">'+
 '<div class="v13-brand"><span class="v13-mark">🌿</span><div><div class="v13-brand-title">Raiz Ancestral</div><small>PAINEL INTELIGENTE V13</small></div></div>'+
 '<div class="v13-side-caption">Central de gestão</div><nav class="v13-nav" id="v13-nav" aria-label="Seções"></nav>'+
 '<div class="v13-foot"><div><strong>●</strong> Acesso administrativo verificado</div><div id="v13-footer-status">Aguardando indicadores</div></div></aside>'+
 '<main class="v13-main"><header class="v13-top">'+
 '<button type="button" class="v13-button v13-nav-toggle" id="v13-menu-button" aria-label="Abrir menu">☰</button>'+
 '<div class="v13-head-text"><b id="v13-head-title">Visão geral</b><small id="v13-head-subtitle">Controle operacional</small></div>'+
 '<div class="v13-top-actions"><button type="button" class="v13-chip v13-alert-shortcut" id="v13-top-alerts" title="Abrir oportunidades e alertas">Verificando alertas</button>'+
 '<button type="button" class="v13-button v13-optional" id="v13-compact" aria-pressed="false">▦ Compacto</button>'+
 '<button type="button" class="v13-button" id="v13-refresh">↻ Atualizar</button>'+
 '<button type="button" class="v13-button primary" id="v13-new-product">+ Produto</button></div></header>'+
 '<div class="v13-work" id="v13-work"></div></main>';
document.body.append(app);
const work=id('v13-work'),nav=id('v13-nav'),navButtons=new Map(),modules=new Map();
let token='',mounted=false;
for(const [key,title,icon,subtitle] of pages){
 const btn=node('button');btn.type='button';btn.dataset.open=key;btn.append(node('span','v13-emoji',icon),node('span','',title));nav.append(btn);navButtons.set(key,btn);
 const panel=node('div','v13-panel');panel.dataset.view=key;panel.hidden=key!=='overview';
 const view=node('div','v13-view');
 if(key==='overview'){
  view.innerHTML='<div class="v13-view-heading"><div><h2>Bem-vindo à central de gestão</h2><p>Seus indicadores e próximas ações, sem rolagem interminável.</p></div><span class="v13-chip" id="v13-summary-stamp">Dados privados</span></div>'+
  '<div class="v13-kpis"><article class="v13-kpi"><small>📦 Produtos ativos</small><strong id="v13-active">—</strong><div class="v13-kpi-note">Na vitrine pública</div></article>'+
  '<article class="v13-kpi"><small>📝 Rascunhos</small><strong id="v13-inactive">—</strong><div class="v13-kpi-note">Aguardando revisão</div></article>'+
  '<article class="v13-kpi"><small>💰 Sem preço</small><strong id="v13-missing">—</strong><div class="v13-kpi-note">Confirmar no parceiro</div></article>'+
  '<article class="v13-kpi"><small>✦ Pendentes</small><strong id="v13-pending">—</strong><div class="v13-kpi-note">Oportunidades para avaliação</div></article></div>'+
  '<div class="v13-grid"><article class="v13-card"><h3>⚡ Acesso rápido</h3><p>Abra diretamente a ferramenta desejada.</p>'+
  '<div class="v13-action-grid"><button class="v13-quick" data-open="opportunities"><span>✦</span> Avaliar oportunidades</button>'+
  '<button class="v13-quick" data-open="products"><span>▤</span> Gerenciar catálogo</button>'+
  '<button class="v13-quick" data-open="ghosts"><span>◉</span> Monitor de fantasmas</button>'+
  '<button class="v13-quick" data-open="prices"><span>◇</span> Auditar preços</button>'+
  '<button class="v13-quick" data-open="campaigns"><span>❀</span> Campanhas</button>'+
  '<button class="v13-quick" data-open="stats"><span>▥</span> Estatísticas</button></div></article>'+
  '<article class="v13-card"><h3>🔔 Pendências inteligentes</h3><p>Resumo obtido das APIs administrativas.</p>'+
  '<div id="v13-alert-list">Consultando dados...</div><p class="v13-secondary" id="v13-run-summary"></p></article></div>'+
  '<div class="v13-card" style="margin-top:16px"><h3>🌿 Segurança preservada</h3><p>As ações de cadastro, aprovação e publicação continuam exigindo as confirmações e permissões anteriores. Ofertas sugeridas não são descontos comprovados.</p></div>';
 }else{
  const heading=node('div','v13-view-heading'),copy=node('div');
  copy.append(node('h2','',icon+' '+title),node('p','',subtitle));heading.append(copy);view.append(heading);
  const module=node('div','v13-module');module.dataset.module=key;modules.set(key,module);view.append(module);
 }
 panel.append(view);work.append(panel);
}
function mount(){
 if(mounted)return;
 for(const [name,ids] of Object.entries(bindings)){
  const dst=modules.get(name);
  for(const key of ids){const section=id(key);if(section){section.hidden=false;dst.append(section)}}
 }
 const automation=modules.get('automation'),backup=modules.get('backup');
 const campaigns=modules.get('campaigns');
 // V12 deixou controles de simulação fora da janela principal. Preserva os nós
 // e seus listeners, apenas realocando-os após o login para a aba correta.
 const simulator=node('article','v13-card v13-campaign-preview');
 simulator.id='v13-campaign-preview';
 simulator.append(node('h3','','🎨 Simulador de campanhas e vitrine sazonal'),
  node('p','','Escolha a campanha e a data para visualizar sua decoração e a seleção temática. A simulação não publica alterações.'));
 const toolbar=document.querySelector('body > .season-toolbar')||document.querySelector('.season-toolbar');
 if(toolbar)simulator.append(toolbar);
 const hint=node('p','v13-hint','Selecione uma campanha no simulador para ver sua prévia aqui.');
 hint.id='v13-campaign-hint';
 simulator.append(hint);
 const banner=document.querySelector('.season-banner');
 if(banner)simulator.append(banner);
 campaigns.prepend(simulator);
 const vitrine=id('raiz-vitrine-campanha');
 if(vitrine)campaigns.append(vitrine);
 const updateCampaignHint=()=>{
  const active=document.body.dataset.season||'normal';
  hint.textContent=vitrine&&!vitrine.hidden?'Prévia temática carregada. Confira os anúncios antes de qualquer publicação.':
   active==='normal'?'Nenhuma campanha temática ativa na data simulada. Escolha uma comemoração acima.':
   'Campanha '+active+' selecionada. A seleção temática pode ficar vazia se não houver produtos correspondentes.';
 };
 new MutationObserver(updateCampaignHint).observe(document.body,{attributes:true,attributeFilter:['data-season']});
 if(vitrine)new MutationObserver(updateCampaignHint).observe(vitrine,{attributes:true,attributeFilter:['hidden']});
 updateCampaignHint();
 const extra=node('article','v13-card');
 extra.append(node('h3','','⚙ Estado da varredura automática'),node('p','','O agendamento independente do navegador precisa estar ativo no servidor. A verificação diária ao abrir o ADM continua configurável nas ferramentas abaixo.'));
 const run=node('p','v13-hint','Verificando histórico...');run.id='v13-automation-run';extra.append(run);
 const go=node('button','v13-button primary','Abrir central de oportunidades');go.type='button';go.dataset.open='opportunities';extra.append(go);automation.append(extra);
 const backupCard=node('article','v13-card');backupCard.append(node('h3','','⬡ Backup e relatórios'),node('p','','Baixe uma cópia completa do cadastro, sem publicar ou alterar produtos. A exportação depende do acesso administrativo.'));
 const backupArea=id('raiz-auto-backup-json')?.closest('.raiz-auto-backup');
 if(backupArea)backupCard.append(backupArea);
 else backupCard.append(node('p','v13-hint','Ferramenta de exportação não encontrada; não foi possível habilitar o backup.'));
 const back=node('button','v13-button','Conferir auditoria de preços');back.type='button';back.dataset.open='prices';backupCard.append(back);backup.append(backupCard);
 const old=id('raiz-admin-atalhos');if(old)old.hidden=true;
 mounted=true;
}
function open(key){
 if(!navButtons.has(key))key='overview';
 for(const section of app.querySelectorAll('.v13-panel'))section.hidden=section.dataset.view!==key;
 for(const [k,button] of navButtons){if(k===key)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')}
 const meta=pages.find(p=>p[0]===key);
 id('v13-head-title').textContent=meta[1];id('v13-head-subtitle').textContent=meta[3];
 id('v13-work').scrollTop=0;app.classList.remove('v13-menu-open');
 try{history.replaceState(null,'',location.pathname+location.search+'#v13-'+key)}catch{}
}
const numeric=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('pt-BR'):'—';
const addAlert=(message,key,emoji)=>{
 const line=node('div','v13-alert-line');line.append(node('span','',emoji),node('span','',message));
 if(key){const btn=node('button','v13-button','Abrir');btn.type='button';btn.dataset.open=key;line.append(btn)}
 id('v13-alert-list').append(line);
};
async function fetchPrivate(path){
 const response=await fetch(path,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
 if(!response.ok)throw Error('HTTP '+response.status);
 return response.json();
}
async function refresh(){
 if(!token)return;
 id('v13-refresh').disabled=true;
 try{
  const responses=await Promise.allSettled([
   fetchPrivate('/api/painel-resumo?dias=30'),
   fetchPrivate('/api/oportunidades-admin'),
   fetchPrivate('/api/disponibilidade-admin')
  ]);
  const stats=responses[0].status==='fulfilled'?responses[0].value?.dados:null;
  const opportunities=responses[1].status==='fulfilled'?responses[1].value:null;
  const ghosts=responses[2].status==='fulfilled'?responses[2].value:null;
  const catalog=stats?.catalogo||{};
  id('v13-active').textContent=numeric(catalog.ativos);
  id('v13-inactive').textContent=numeric(catalog.inativos);
  id('v13-missing').textContent=numeric(catalog.sem_preco);
  const pending=(opportunities?.oportunidades||[]).filter(x=>x.status==='pendente');
  id('v13-pending').textContent=opportunities?numeric(pending.length):'—';
  const m=opportunities?.monitor,run=m?.ultimo,unseen=m?.nao_vistas;
  id('v13-top-alerts').textContent=unseen>0?'✦ '+unseen+' novos alertas':'✓ Ver alertas';
  id('v13-summary-stamp').textContent='Atualizado '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  id('v13-alert-list').replaceChildren();
  if(Number(catalog.sem_preco)>0)addAlert(numeric(catalog.sem_preco)+' produtos sem preço confirmado','prices','💰');
  if(pending.length)addAlert(pending.length+' oportunidades aguardando revisão','opportunities','✦');
  if((ghosts?.produtos||[]).length)addAlert(ghosts.produtos.length+' suspeitos ou fantasmas para conferir','ghosts','◉');
  if(!run)addAlert('Agendamento 6h ainda sem execução registrada.','automation','⏱');
  else if(run.situacao!=='concluido')addAlert('Última varredura: '+run.situacao,'automation','⚠');
  if(!id('v13-alert-list').children.length)addAlert('Nenhuma pendência detectada pelas consultas disponíveis.',null,'✓');
  if(!stats||!opportunities||!ghosts)addAlert('Algumas consultas estão indisponíveis; dados parciais.',null,'⚠');
  const status=run?'Última varredura: '+new Date(run.concluido_em||run.iniciado_em).toLocaleString('pt-BR')+' · '+run.situacao:'Sem execução agendada registrada.';
  id('v13-run-summary').textContent=status;
  id('v13-automation-run').textContent=status+(run?' · Novas: '+run.novos+' · Quedas observadas: '+run.atualizados:'');
  id('v13-footer-status').textContent=run?.situacao==='concluido'?'Última verificação concluída':'Automação 6h pendente ou parcial';
 }catch{ id('v13-top-alerts').textContent='Indicadores temporariamente indisponíveis' }
 finally{id('v13-refresh').disabled=false}
}
app.addEventListener('click',event=>{
 const target=event.target.closest('[data-open]');if(target){open(target.dataset.open);return}
 const link=event.target.closest('a[href^="#"]');if(!link)return;
 const map={'#raiz-gerenciar-produtos':'products','#raiz-estatisticas':'stats','#raiz-auditoria-precos':'prices','#raiz-reconciliacao-precos':'prices','#raiz-shopee-api-preview':'prices','#raiz-central-automacoes':'campaigns','#raiz-oportunidades-admin':'opportunities','#raiz-fantasmas-admin':'ghosts','#raiz-vitrine-campanha':'campaigns'};
 const anchor=link.getAttribute('href'),tab=map[anchor];
 if(!tab)return;
 event.preventDefault();open(tab);
 const destination=document.querySelector(anchor);
 if(anchor==='#raiz-vitrine-campanha'&&(!destination||destination.hidden)){
  id('v13-campaign-hint').textContent='A vitrine temática ainda não está disponível. Escolha uma campanha no simulador acima.';
  id('season-mode')?.focus();return;
 }
 if(destination&&!destination.hidden)destination.scrollIntoView({behavior:'smooth',block:'start'});
});
id('v13-refresh').addEventListener('click',refresh);
id('v13-top-alerts').addEventListener('click',()=>open('opportunities'));
id('v13-new-product').addEventListener('click',()=>{open('products');id('raiz-prod-new')?.click()});
id('v13-menu-button').addEventListener('click',()=>app.classList.toggle('v13-menu-open'));
id('v13-backdrop').addEventListener('click',()=>app.classList.remove('v13-menu-open'));
id('v13-compact').addEventListener('click',()=>{
 const compact=app.classList.toggle('v13-compact');
 id('v13-compact').setAttribute('aria-pressed',String(compact));
 id('v13-compact').textContent=compact?'▦ Confortável':'▦ Compacto';
 try{localStorage.setItem('raiz-v13-compact',compact?'1':'0')}catch{}
});
try{if(localStorage.getItem('raiz-v13-compact')==='1'){app.classList.add('v13-compact');id('v13-compact').setAttribute('aria-pressed','true');id('v13-compact').textContent='▦ Confortável'}}catch{}
window.addEventListener('raiz:admin-open-product',()=>open('products'),{capture:true});
window.addEventListener('raiz:admin-tests-unlocked',e=>{
 token=String(e.detail?.accessToken||'');if(!token)return;
 mount();document.body.classList.add('raiz-v13-active');app.hidden=false;
 const hash=String(location.hash||'').replace(/^#/,'');
 const names={'raiz-gerenciar-produtos':'products','raiz-estatisticas':'stats','raiz-oportunidades-admin':'opportunities','raiz-fantasmas-admin':'ghosts'};
 open(hash.startsWith('v13-')?hash.slice(4):names[hash]||'overview');
 refresh();
});

/* V13.6 — indicador líquido elástico inspirado nas transições do vídeo de referência.
   Elemento decorativo: botões reais continuam acionáveis e acessíveis. */
const liquidIndicator=node('span','v136-liquid-indicator');
liquidIndicator.setAttribute('aria-hidden','true');
nav.prepend(liquidIndicator);
let liquidReady=false;
function positionLiquidIndicator(){
 const active=nav.querySelector('button[aria-current="page"]');
 if(!active||app.hidden)return;
 liquidIndicator.style.setProperty('--liquid-y',active.offsetTop+'px');
 liquidIndicator.style.setProperty('--liquid-h',active.offsetHeight+'px');
 liquidIndicator.style.setProperty('--liquid-w',active.offsetWidth+'px');
 if(!liquidReady){
  liquidIndicator.classList.add('v136-ready');
  liquidReady=true;
 }
}
const liquidObserver=new MutationObserver(()=>requestAnimationFrame(positionLiquidIndicator));
liquidObserver.observe(nav,{subtree:true,attributes:true,attributeFilter:['aria-current']});
nav.addEventListener('pointermove',event=>{
 const button=event.target.closest('button');
 if(!button||!nav.contains(button))return;
 const rect=button.getBoundingClientRect();
 button.style.setProperty('--liquid-x',((event.clientX-rect.left)/rect.width*100).toFixed(1)+'%');
 button.style.setProperty('--liquid-py',((event.clientY-rect.top)/rect.height*100).toFixed(1)+'%');
});
if(typeof ResizeObserver==='function')new ResizeObserver(positionLiquidIndicator).observe(nav);
window.addEventListener('resize',positionLiquidIndicator,{passive:true});

window.addEventListener('keydown',e=>{if(e.key==='Escape')app.classList.remove('v13-menu-open')});
})();