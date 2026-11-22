/* Monitor multiloja de disponibilidade — ADM, sem exclusão de produtos. */
(()=>{
'use strict';
const anchor=document.getElementById('raiz-gerenciar-produtos');if(!anchor)return;
const pane=document.createElement('section');pane.id='raiz-fantasmas-admin';pane.hidden=true;
pane.innerHTML='<h2>👻 Monitor de produtos fantasmas — multiloja</h2><p>Quando um anúncio não aparece na API, o sistema o marca como <strong>suspeito</strong>. A decisão de ocultar como <strong>fantasma</strong> exige confirmação. O cadastro nunca é apagado.</p><p>🟢 Shopee: consulta à API de afiliados · 🟡 Amazon, Magalu e outras: conferência manual até integrar APIs autorizadas.</p><div class="ghost-tools"><label>ID do produto <input id="ghost-id" type="number" min="1" step="1" placeholder="Ex.: 120"></label><button id="ghost-search" type="button">Buscar ID</button><button id="ghost-check" type="button">Verificar na afiliada</button><button id="ghost-refresh" type="button">Atualizar lista</button></div><label><input id="ghost-daily" type="checkbox"> Verificar até 4 produtos Shopee uma vez ao dia, quando eu abrir o ADM</label><p class="ghost-note">Esta checagem não funciona com o ADM fechado. Uma API sem resultados não comprova remoção; falhas de rede não modificam produtos.</p><p id="ghost-status" role="status" aria-live="polite"></p><div id="ghost-selected"></div><h3>Suspeitos e fantasmas</h3><div id="ghost-list"></div>';
anchor.parentNode.insertBefore(pane,anchor);
const style=document.createElement('style');style.textContent='#raiz-fantasmas-admin{max-width:1120px;margin:18px auto;padding:20px;border:1px solid #dbcb9b;border-radius:18px;background:#fffaf1;color:#244631}#raiz-fantasmas-admin[hidden]{display:none!important}#raiz-fantasmas-admin h2{font:700 26px Georgia,serif}#raiz-fantasmas-admin .ghost-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:12px 0}#raiz-fantasmas-admin input[type=number]{display:block;width:140px;padding:9px;border:1px solid #a8b8a4;border-radius:8px;color:#23432d;background:white}#raiz-fantasmas-admin button{padding:9px 12px;border:1px solid #275639;border-radius:10px;background:#2c5d3c;color:white;cursor:pointer;min-height:40px}#raiz-fantasmas-admin button:disabled{opacity:.5}#raiz-fantasmas-admin .ghost-note{font-size:12px;color:#62695c}#raiz-fantasmas-admin .ghost-card{padding:12px;border-radius:12px;border:1px solid #d7ddce;background:#fff;margin:9px 0}#raiz-fantasmas-admin .ghost-card>*{display:block;margin:5px 0}#raiz-fantasmas-admin .ghost-buttons{display:flex;gap:7px;flex-wrap:wrap}';document.head.append(style);
const el=id=>document.getElementById(id),msg=s=>el('ghost-status').textContent=s;
let token='',busy=false;
async function api(path,method='GET',body){
 const r=await fetch(path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.erro||'Erro HTTP '+r.status);return data;
}
function text(tag,value){const e=document.createElement(tag);e.textContent=String(value??'');return e}
function button(label,fn){const b=text('button',label);b.type='button';b.addEventListener('click',fn);return b}
function card(p){
 const box=document.createElement('article');box.className='ghost-card';
 const st=p.disponibilidade==='fantasma'?'👻 Fantasma — oculto':p.disponibilidade==='suspeito'?'⚠️ Suspeito — revisar':'✅ Normal';
 box.append(text('b','#'+p.id+' — '+p.nome),text('small',(p.loja||'Loja')+' · '+(p.ativo?'Ativo':'Inativo')+' · '+st));
 if(p.disponibilidade_observacao)box.append(text('small',p.disponibilidade_observacao));
 const actions=document.createElement('div');actions.className='ghost-buttons';
 actions.append(button('Abrir cadastro',()=>window.dispatchEvent(new CustomEvent('raiz:admin-open-product',{detail:{id:Number(p.id)}}))));
 actions.append(button('Verificar anúncio',()=>verify([Number(p.id)])));
 if(p.disponibilidade!=='fantasma')actions.append(button('👻 Marcar fantasma',()=>mark(p.id,'fantasma')));
 if(p.disponibilidade!=='normal')actions.append(button('Restaurar',()=>mark(p.id,'normal')));
 box.append(actions);return box;
}
async function show(id){const d=await api('/api/produtos-admin?id='+id);el('ghost-selected').replaceChildren(card(d.produto))}
async function refresh(){const d=await api('/api/disponibilidade-admin');const a=el('ghost-list');a.replaceChildren();for(const p of d.produtos||[])a.append(card(p));if(!a.children.length)a.append(text('p','Nenhum suspeito ou fantasma.'))}
async function mark(id,estado){
 const message=estado==='fantasma'?'Ocultar produto #'+id+' na loja pública, preservando no ADM?':'Restaurar produto #'+id+'? Se estiver ativo, ele voltará a aparecer na loja.';
 if(!confirm(message))return;
 try{await api('/api/disponibilidade-admin','POST',{acao:'marcar',id:Number(id),estado});msg('Produto #'+id+': '+estado+'.');await refresh();await show(id)}catch(e){msg(e.message)}
}
async function verify(ids){
 if(busy)return;busy=true;el('ghost-check').disabled=true;msg('Verificando anúncios autorizados...');
 try{const d=await api('/api/disponibilidade-admin','POST',{acao:'verificar',ids});msg((d.resultados||[]).map(x=>'#'+x.id+': '+x.resultado+' ['+(x.estado||'inalterado')+']').join(' | ')||'Consulta sem resposta.');await refresh();if(ids.length===1)await show(ids[0])}
 catch(e){msg(e.message)}finally{busy=false;el('ghost-check').disabled=false}
}
function getId(){const id=Number(el('ghost-id').value);if(!Number.isSafeInteger(id)||id<1){msg('Informe um ID válido.');return null}return id}
el('ghost-search').addEventListener('click',async()=>{const id=getId();if(!id)return;try{await show(id);msg('Produto carregado.')}catch(e){msg(e.message)}});
el('ghost-check').addEventListener('click',()=>{const id=getId();if(id)verify([id])});
el('ghost-refresh').addEventListener('click',()=>refresh().then(()=>msg('Lista atualizada.')).catch(e=>msg(e.message)));
try{el('ghost-daily').checked=localStorage.getItem('raiz-ghost-daily')==='sim'}catch{}
el('ghost-daily').addEventListener('change',()=>{try{localStorage.setItem('raiz-ghost-daily',el('ghost-daily').checked?'sim':'nao')}catch{}});
async function daily(){
 if(!el('ghost-daily').checked)return;
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
 try{if(localStorage.getItem('raiz-ghost-daily-date')===today)return}catch{}
 try{
  const d=await api('/api/produtos-admin?estado=ativos&page=1');
  const ids=(d.produtos||[]).filter(p=>String(p.loja||'').toLowerCase()==='shopee'&&/^\d{3,20}$/.test(String(p.shopee_product_id||''))).slice(0,4).map(p=>Number(p.id));
  if(!ids.length){msg('Nenhum ID Shopee válido entre os 30 produtos ativos mais recentes.');return}
  await verify(ids);
  try{localStorage.setItem('raiz-ghost-daily-date',today)}catch{}
 }catch(e){msg('Busca diária parcial: '+e.message)}
}
window.addEventListener('raiz:admin-tests-unlocked',async e=>{token=String(e.detail?.accessToken||'');if(!token)return;pane.hidden=false;try{await refresh();await daily()}catch(err){msg(err.message)}});
})();