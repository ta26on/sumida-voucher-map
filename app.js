const $=id=>document.getElementById(id);
let stores=[],filtered=[],shown=0;
const params=new URLSearchParams(location.search);
for(const id of ['q','area','category','ticket','kind']) if(params.has(id)) $(id).value=params.get(id);
const norm=s=>(s||'').normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s　]/g,'');
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value??'';return e};
const ticketLabel=r=>r.ticket_type==='both'?'A券・B券':r.ticket_type==='b_only'?'B券のみ':'券種未確認';
const kindLabel=r=>r.record_type==='individual_store'?'個別店舗':'施設・チェーン単位';
function matches(r){const q=norm($('q').value);if(q&&!norm([r.name,r.address,r.category,r.area].join(' ')).includes(q))return false;
if($('area').value&&r.area!==$('area').value)return false;
if($('category').value&&r.category!==$('category').value)return false;
const t=$('ticket').value;if(t==='a'&&r.ticket_type!=='both')return false;if(t==='b'&&!['both','b_only'].includes(r.ticket_type))return false;if(t==='b_only'&&r.ticket_type!=='b_only')return false;
const k=$('kind').value;if(k==='individual_store'&&r.record_type!=='individual_store')return false;if(k==='other'&&r.record_type==='individual_store')return false;return true;}
function syncUrl(){const p=new URLSearchParams();for(const id of ['q','area','category','ticket','kind'])if($(id).value.trim())p.set(id,$(id).value.trim());history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
function badge(label,muted=false){const e=text('span',label);e.className='tag'+(muted?' muted':'');return e;}
function openDetail(r){$('dname').textContent=r.name;const body=$('dbody');body.replaceChildren();const badges=document.createElement('div');badges.className='badges';badges.append(badge(ticketLabel(r)),badge(kindLabel(r),true));body.append(badges);
for(const [label,value] of [['住所',r.address||'住所未登録'],['地域',r.area||'未分類'],['カテゴリ',r.category||'未分類'],['掲載元',r.source||'不明']]){const p=document.createElement('p');const strong=text('strong',label+'：');p.append(strong,text('span',value));body.append(p)}
if(r.address){const link=document.createElement('a');link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(r.address);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Google マップで場所を確認 ↗';body.append(link)}
body.append(text('p','※公式掲載情報であり、現在の利用可否を保証するものではありません。'));$('detail').showModal();}
function addPage(){const container=$('results');for(const r of filtered.slice(shown,shown+30)){const card=document.createElement('button');card.type='button';card.className='store';const badges=document.createElement('div');badges.className='badges';badges.append(badge(ticketLabel(r)),badge(kindLabel(r),true));card.append(badges,text('h3',r.name),text('p',r.address||'住所未登録'),text('p',r.category||'カテゴリ未登録'));card.addEventListener('click',()=>openDetail(r));container.append(card)}shown=Math.min(shown+30,filtered.length);$('more').hidden=shown>=filtered.length;}
function render(){syncUrl();filtered=stores.filter(matches);shown=0;$('resultCount').textContent=filtered.length.toLocaleString('ja-JP');$('results').replaceChildren();if(!filtered.length){$('results').append(text('p','該当する店舗がありません。検索条件を変えてください。'));$('more').hidden=true}else addPage();}
function options(id,values){const selected=params.get(id)||'';for(const value of [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'))){const o=document.createElement('option');o.value=value;o.textContent=value;$(id).append(o)}$(id).value=selected;}
$('close').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('click',e=>{if(e.target===$('detail'))$('detail').close()});$('more').addEventListener('click',addPage);
$('clear').addEventListener('click',()=>{for(const id of ['q','area','category','ticket','kind'])$(id).value='';render();$('q').focus()});
$('share').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);$('share').textContent='URLをコピーしました';setTimeout(()=>$('share').textContent='検索条件を共有',1800)}catch{prompt('このURLをコピーしてください',location.href)}});
let debounce;for(const id of ['q','area','category','ticket','kind'])$(id).addEventListener(id==='q'?'input':'change',()=>{clearTimeout(debounce);debounce=setTimeout(render,id==='q'?200:0)});
fetch('stores.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{stores=data;$('total').textContent=stores.length+' 件掲載';options('area',stores.map(r=>r.area));options('category',stores.map(r=>r.category));render()}).catch(e=>{$('total').textContent='読み込み失敗';$('results').textContent='データを読み込めません。ローカルサーバーから開いてください。 '+e.message});
