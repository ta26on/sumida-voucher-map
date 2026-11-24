const $=id=>document.getElementById(id);
let stores=[],filtered=[],shown=0;
const params=new URLSearchParams(location.search);
const filterIds=['q','area','ticket','kind'];
for(const id of filterIds) if(params.has(id)) $(id).value=params.get(id);
const categoryOptions=$('categoryOptions');
const checkedCategories=()=>categoryOptions.querySelectorAll('input:checked');
let debounce;
const norm=s=>(s||'').normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s　]/g,'');
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value??'';return e};
const ticketLabel=r=>r.ticket_type==='both'?'A券・B券':r.ticket_type==='b_only'?'B券のみ':'券種未確認';
const kindLabel=r=>r.record_type==='individual_store'?'個別店舗':'施設・チェーン単位';
function matches(r,categories){const q=norm($('q').value);if(q&&!norm([r.name,r.address,r.category,r.area].join(' ')).includes(q))return false;
if($('area').value&&r.area!==$('area').value)return false;
if(categories.size&&!categories.has(r.category))return false;
const t=$('ticket').value;if(t==='a'&&r.ticket_type!=='both')return false;if(t==='b'&&!['both','b_only'].includes(r.ticket_type))return false;if(t==='b_only'&&r.ticket_type!=='b_only')return false;
const k=$('kind').value;if(k==='individual_store'&&r.record_type!=='individual_store')return false;if(k==='other'&&r.record_type==='individual_store')return false;return true;}
function syncUrl(categories){
  const p=new URLSearchParams();
  for(const id of filterIds){
    const value=$(id).value.trim();
    if(value)p.set(id,value);
  }
  for(const category of categories)p.append('category',category);
  history.replaceState(null,'',location.pathname+(p.toString()?'?'+p:'')+location.hash);
}
function badge(label,muted=false){const e=text('span',label);e.className='tag'+(muted?' muted':'');return e;}
function openDetail(r){$('dname').textContent=r.name;const body=$('dbody');body.replaceChildren();const badges=document.createElement('div');badges.className='badges';badges.append(badge(ticketLabel(r)),badge(kindLabel(r),true));body.append(badges);
for(const [label,value] of [['住所',r.address||'住所未登録'],['地域',r.area||'未分類'],['カテゴリ',r.category||'未分類'],['掲載元',r.source||'不明']]){const p=document.createElement('p');const strong=text('strong',label+'：');p.append(strong,text('span',value));body.append(p)}
if(r.address){const link=document.createElement('a');link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(r.address);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Google マップで場所を確認 ↗';body.append(link)}
body.append(text('p','※公式掲載情報であり、現在の利用可否を保証するものではありません。'));$('detail').showModal();}
function addPage(){const container=$('results');for(const r of filtered.slice(shown,shown+30)){const card=document.createElement('button');card.type='button';card.className='store';const badges=document.createElement('div');badges.className='badges';badges.append(badge(ticketLabel(r)),badge(kindLabel(r),true));card.append(badges,text('h3',r.name),text('p',r.address||'住所未登録'),text('p',r.category||'カテゴリ未登録'));card.addEventListener('click',()=>openDetail(r));container.append(card)}shown=Math.min(shown+30,filtered.length);$('more').hidden=shown>=filtered.length;}
function render(){
  clearTimeout(debounce);
  debounce=undefined;
  const categories=new Set(Array.from(checkedCategories(),input=>input.value));
  $('categoryCount').textContent=categories.size+'件選択中';
  $('clearCategories').disabled=categories.size===0;
  syncUrl(categories);
  filtered=stores.filter(r=>matches(r,categories));
  shown=0;
  $('resultCount').textContent=filtered.length.toLocaleString('ja-JP');
  $('results').replaceChildren();
  if(!filtered.length){
    $('results').append(text('p','該当する店舗がありません。検索条件を変えてください。'));
    $('more').hidden=true;
  }else addPage();
}
function sortedValues(values){
  return [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
function options(id,values){
  for(const value of sortedValues(values)){
    const option=text('option',value);
    option.value=value;
    $(id).append(option);
  }
  $(id).value=params.get(id)||'';
}
function addCategoryOptions(){
  const selected=new Set(params.getAll('category'));
  for(const value of sortedValues(stores.map(r=>r.category))){
    const label=text('label',value);
    const input=document.createElement('input');
    input.type='checkbox';
    input.name='category';
    input.value=value;
    input.checked=selected.has(value);
    label.prepend(input);
    categoryOptions.append(label);
  }
}
function resetCategories(){
  params.delete('category');
  for(const input of checkedCategories()) input.checked=false;
}
$('close').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('click',e=>{if(e.target===$('detail'))$('detail').close()});$('more').addEventListener('click',addPage);
$('clearCategories').addEventListener('click',()=>{
  resetCategories();
  $('categorySummary').focus();
  render();
});
$('clear').addEventListener('click',()=>{
  for(const id of filterIds){
    $(id).value='';
    params.delete(id);
  }
  resetCategories();
  render();
  $('q').focus();
});
$('share').addEventListener('click',async()=>{if(debounce!==undefined)render();try{await navigator.clipboard.writeText(location.href);$('share').textContent='URLをコピーしました';setTimeout(()=>$('share').textContent='検索条件を共有',1800)}catch{prompt('このURLをコピーしてください',location.href)}});
categoryOptions.addEventListener('change',render);
for(const id of ['area','ticket','kind']) $(id).addEventListener('change',render);
$('q').addEventListener('input',()=>{
  clearTimeout(debounce);
  debounce=setTimeout(render,200);
});
fetch('stores.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{stores=data;$('total').textContent=stores.length+' 件掲載';options('area',stores.map(r=>r.area));addCategoryOptions();render()}).catch(e=>{$('total').textContent='読み込み失敗';$('results').textContent='データを読み込めません。ローカルサーバーから開いてください。 '+e.message});
