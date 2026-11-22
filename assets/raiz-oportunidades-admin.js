/* Raiz Ancestral: triagem de ofertas, ADM somente após autenticação */
(()=>{
'use strict';
const anchor=document.getElementById('raiz-gerenciar-produtos');if(!anchor)return;
const root=document.createElement('section');root.hidden=true;root.id='raiz-oportunidades-admin';
root.innerHTML='<h2>🔎 Central de oportunidades multiloja</h2><p>Busque anúncios na API Shopee e decida o que merece entrar no catálogo. <strong>Preço indicativo não comprova desconto.</strong> Nenhum produto é publicado automaticamente.</p><div class="opp-toolbar"><label>Buscar oportunidades<input id="opp-query" type="search" maxlength="140" placeholder="Ex.: infusor para chá"></label><button type="button" id="opp-find">Pesquisar</button><button type="button" id="opp-refresh">Atualizar fila</button></div><details class="opp-manual"><summary>➕ Adicionar oportunidade de outra afiliada (manual)</summary><div class="opp-manual-fields"><label>Loja <select id="opp-manual-store"><option>Amazon</option><option>Magalu</option><option>Mercado Livre</option><option>Outra afiliada</option><option>Shopee</option></select></label><label>Nome do produto <input id="opp-manual-name" type="text" maxlength="250"></label><label>Seu link de afiliado HTTPS <input id="opp-manual-link" type="url" maxlength="1800"></label><label>Link da imagem HTTPS (opcional) <input id="opp-manual-image" type="url" maxlength="1800"></label><button id="opp-manual-add" type="button">Enviar para avaliação</button></div><small>Verifique pessoalmente o programa de afiliados e os termos da loja. Nenhuma API adicional está conectada.</small></details><div class="opp-auto"><label><input type="checkbox" id="opp-automatic"> Fazer busca diária quando eu abrir o ADM neste navegador</label><label>Assuntos da busca (até três separados por vírgula)<input type="text" id="opp-topics" maxlength="180" value="chá natural, infusor para chá, sementes para horta"></label><small>Não é rastreamento 24 horas. Monitoramento contínuo por servidor requer agendamento próprio.</small></div><p id="opp-status" role="status" aria-live="polite"></p><button type="button" id="opp-view-created" hidden>🔎 Ver produto cadastrado</button><div id="opp-findings" class="opp-grid"></div><h3>📋 Aguardando decisão</h3><div id="opp-pending" class="opp-grid"></div><p>Ao aprovar, um produto é cadastrado como <strong>rascunho inativo</strong>. A publicação continua dependendo da sua decisão no cadastro de produtos.</p>';
anchor.parentNode.insertBefore(root,anchor);
const css=document.createElement('style');
css.textContent='#raiz-oportunidades-admin .opp-manual{margin:14px 0;padding:12px;background:#f0f3e6;border-radius:12px}#raiz-oportunidades-admin .opp-manual-fields{display:grid;gap:9px;margin:12px 0}#raiz-oportunidades-admin .opp-manual summary{cursor:pointer;font-weight:700}#raiz-oportunidades-admin{margin:18px auto;padding:20px;max-width:1180px;border-radius:22px;background:#fffdf3;color:#24432e;border:1px solid #ccb079}#raiz-oportunidades-admin h2{font:700 28px Georgia,serif}#raiz-oportunidades-admin .opp-toolbar{display:flex;gap:9px;flex-wrap:wrap;align-items:end}#raiz-oportunidades-admin .opp-toolbar label{flex:1 1 230px}#raiz-oportunidades-admin label{font-size:13px;font-weight:600}#raiz-oportunidades-admin input[type=search],#raiz-oportunidades-admin input[type=text],#raiz-oportunidades-admin select{display:block;width:100%;padding:10px;border:1px solid #9fb6a0;border-radius:9px;background:#fff;color:#1b3927}#raiz-oportunidades-admin button{border-radius:10px;border:1px solid #245236;background:#255d3a;color:#fff;min-height:42px;padding:8px 13px;cursor:pointer}#raiz-oportunidades-admin button:disabled{opacity:.5}#raiz-oportunidades-admin .opp-auto{margin:15px 0;padding:12px;background:#e9f0e3;border-radius:12px}#raiz-oportunidades-admin .opp-auto small{display:block}#raiz-oportunidades-admin .opp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}#raiz-oportunidades-admin .opp-card{display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid #d3d9cb;border-radius:13px;padding:12px}#raiz-oportunidades-admin .opp-card img{width:100%;height:125px;object-fit:contain}#raiz-oportunidades-admin .opp-card b{overflow-wrap:anywhere}#raiz-oportunidades-admin .opp-actions{display:flex;flex-wrap:wrap;gap:7px}#raiz-oportunidades-admin .opp-actions a{display:inline-flex;align-items:center;padding:9px;border-radius:10px;background:#e8e9dd;font-size:12px}';
document.head.append(css);
const el=id=>document.getElementById(id), msg=s=>el('opp-status').textContent=s;
let lastCreatedId=null;
function showCreated(id){
 lastCreatedId=Number.isSafeInteger(Number(id))&&Number(id)>0?Number(id):null;
 const button=el('opp-view-created');
 button.hidden=!lastCreatedId;
 if(lastCreatedId)button.textContent='🔎 Ver produto cadastrado #'+lastCreatedId;
}
el('opp-view-created').addEventListener('click',()=>{
 if(!lastCreatedId)return;
 window.dispatchEvent(new CustomEvent('raiz:admin-open-product',{detail:{id:lastCreatedId}}));
});
let token='',categories=[];
function currency(v){return Number.isFinite(Number(v))&&Number(v)>0?Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Não informado'}
function safeUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password?u.href:null}catch{return null}}
function t(tag,content){const e=document.createElement(tag);e.textContent=content||'';return e}
async function api(path,method='GET',payload){
 const r=await fetch(path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.erro||('Erro HTTP '+r.status));return data;
}
function card(item){
 const box=document.createElement('article');box.className='opp-card';
 if(item.imagem_url){const img=document.createElement('img');img.alt='Imagem da oferta';img.src=item.imagem_url;img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove());box.append(img)}
 box.append(t('b',item.nome),t('small','Preço indicativo: '+currency(item.preco_indicativo??item.preco)),t('small',(item.loja||'Shopee')+' • desconto anunciado não confirmado'));
 const base=Number(item.preco_base),current=Number(item.preco_indicativo);
 if(Number.isFinite(base)&&base>0&&Number.isFinite(current)&&current>0&&current<base){const diff=Math.round((base-current)/base*100);box.append(t('small','Queda observada de '+diff+'% desde a primeira consulta (R$ de referência: '+currency(base)+'). Não é desconto anunciado pela loja.'))}
 const url=safeUrl(item.link_afiliado);
 if(url){const a=t('a','Conferir anúncio');a.href=url;a.target='_blank';a.rel='sponsored noopener noreferrer';box.append(a)}
 return box;
}
el('opp-manual-add').addEventListener('click',async()=>{const btn=el('opp-manual-add');btn.disabled=true;try{const link=el('opp-manual-link').value.trim(),nome=el('opp-manual-name').value.trim(),imagem=el('opp-manual-image').value.trim(),loja=el('opp-manual-store').value;if(!safeUrl(link)||nome.length<3||imagem&&(!safeUrl(imagem)))throw Error('Confira nome e links HTTPS válidos.');await api('/api/oportunidades-admin','POST',{origem:'manual',loja,nome,link_afiliado:link,imagem_url:imagem,preco_indicativo:null,categoria_sugerida:'A classificar'});msg('Oportunidade de '+loja+' incluída para avaliação; não publicada.');await load()}catch(e){msg(e.message)}finally{btn.disabled=false}});
const buildCandidate=p=>({item_externo:p.itemId,nome:p.nome,link_afiliado:p.link_afiliado||'',imagem_url:p.imagem_url||'',preco_indicativo:p.preco??null,categoria_sugerida:'A classificar'});
function showFound(data){
 const area=el('opp-findings');area.replaceChildren();
 for(const p of data){
  const box=card(p),actions=document.createElement('div');actions.className='opp-actions';
  const save=t('button','Enviar para avaliação');save.type='button';save.disabled=!safeUrl(p.link_afiliado);
  save.title=save.disabled?'A API não forneceu link de afiliado Shopee válido':'Adicionar à fila privada';
  save.addEventListener('click',async()=>{save.disabled=true;try{await api('/api/oportunidades-admin','POST',buildCandidate(p));msg('Sugestão na fila; não publicada.');await load()}catch(e){msg(e.message)}finally{save.disabled=false}});
  actions.append(save);box.append(actions);area.append(box);
 }
 if(!data.length)area.append(t('p','Nenhuma sugestão encontrada para essa busca.'));
}
async function scan(q,render=true){
 if(q.length<6||q.length>140)throw Error('Digite entre 6 e 140 caracteres.');
 const data=await api('/api/shopee-sugestoes','POST',{nome:q});
 const found=Array.isArray(data.sugestoes)?data.sugestoes:[];
 if(render)showFound(found);
 return found;
}
async function load(){
 const d=await api('/api/oportunidades-admin');
 const area=el('opp-pending');area.replaceChildren();
 const pending=(d.oportunidades||[]).filter(x=>x.status==='pendente');
 if(!pending.length){area.append(t('p','Nenhuma oportunidade pendente.'));return}
 for(const p of pending){
  const box=card(p);box.append(t('small','Consulta: '+new Date(p.consultado_em).toLocaleString('pt-BR')));
  const sel=document.createElement('select');sel.setAttribute('aria-label','Categoria para o novo rascunho');
  for(const category of ['A classificar',...categories.filter(x=>x!=='A classificar')]){const option=document.createElement('option');option.value=category;option.textContent=category;sel.append(option)}
  sel.value=categories.includes(p.categoria_sugerida)?p.categoria_sugerida:'A classificar';box.append(sel);
  const actions=document.createElement('div');actions.className='opp-actions';
  const approve=t('button','Aprovar como rascunho');approve.disabled=!safeUrl(p.link_afiliado);
  approve.addEventListener('click',async()=>{
   if(!confirm('Cadastrar como RASCUNHO INATIVO? O anúncio não aparecerá na loja até você ativá-lo.'))return;
   approve.disabled=true;
   try{
    const d=await api('/api/produtos-admin','POST',{nome:p.nome,loja:p.loja||'Shopee',categoria:sel.value,link_afiliado:p.link_afiliado,imagem_url:p.imagem_url||'',descricao:'Anúncio selecionado para revisão; confirme preço, marca e quantidade antes da publicação.',preco:null,shopee_product_id:p.origem==='shopee_api'?p.item_externo:'',ativo:false,destaque:false});
    const id=Number(d.produto?.id);if(!Number.isSafeInteger(id)||id<=0)throw Error('Produto possivelmente cadastrado; confira no cadastro antes de tentar novamente.');
    showCreated(id);
    try{await api('/api/oportunidades-admin','PATCH',{id:p.id,status:'selecionada',produto_id:id})}catch{msg('Rascunho #'+id+' criado, mas houve falha em atualizar a fila; confira o cadastro.');return}
    msg('Produto #'+id+' cadastrado como INATIVO. Confira no painel antes de ativar.');await load();
   }catch(e){msg(e.message)}finally{approve.disabled=false}
  });
  const reject=t('button','Descartar');reject.type='button';reject.addEventListener('click',async()=>{if(!confirm('Descartar esta sugestão?'))return;reject.disabled=true;try{await api('/api/oportunidades-admin','PATCH',{id:p.id,status:'descartada'});msg('Sugestão descartada.');await load()}catch(e){msg(e.message);reject.disabled=false}});
  actions.append(approve,reject);box.append(actions);area.append(box);
 }
}
el('opp-find').addEventListener('click',async()=>{const btn=el('opp-find');btn.disabled=true;msg('Buscando na API...');try{const found=await scan(el('opp-query').value.trim());msg(found.length+' resultado(s), sujeitos à revisão.')}catch(e){msg(e.message)}finally{btn.disabled=false}});
el('opp-refresh').addEventListener('click',()=>{if(token)load().catch(e=>msg(e.message))});
const prefKey='raiz-oportunidades-preferencias';
try{const pref=JSON.parse(localStorage.getItem(prefKey)||'{}');el('opp-automatic').checked=!!pref.enabled;if(pref.terms)el('opp-topics').value=pref.terms}catch{}
const savePref=()=>{try{localStorage.setItem(prefKey,JSON.stringify({enabled:el('opp-automatic').checked,terms:el('opp-topics').value.slice(0,180)}))}catch{}};
el('opp-automatic').addEventListener('change',savePref);el('opp-topics').addEventListener('change',savePref);
async function daily(){
 if(!el('opp-automatic').checked)return;
 const day=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}),stamp='raiz-oportunidades-ultima-busca';
 try{if(localStorage.getItem(stamp)===day)return;localStorage.setItem(stamp,day)}catch{}
 const topics=el('opp-topics').value.split(',').map(x=>x.trim()).filter(x=>x.length>=6).slice(0,3);
 let added=0,ignored=0;
 for(const term of topics){
  let offers=[];try{offers=await scan(term,false)}catch(e){msg('Busca automática parcial: '+e.message);break}
  for(const offer of offers){
   if(!safeUrl(offer.link_afiliado)){ignored++;continue}
   try{await api('/api/oportunidades-admin','POST',buildCandidate(offer));added++}catch{ignored++}
  }
 }
 msg('Busca diária: '+added+' adicionado(s), '+ignored+' ignorado(s)/duplicado(s). Nenhum item publicado.');await load();
}
window.addEventListener('raiz:admin-tests-unlocked',async event=>{
 token=String(event.detail?.accessToken||'');if(!token)return;
 root.hidden=false;msg('Carregando fila privada...');
 try{const c=await api('/api/produtos-admin?categories=1');categories=Array.isArray(c.categorias)?c.categorias:[];await load();await daily()}catch(e){msg(e.message)}
});
})();