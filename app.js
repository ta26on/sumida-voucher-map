const $=id=>document.getElementById(id);
let stores=[],filtered=[],shown=0;
const params=new URLSearchParams(location.search);
const filterIds=['q','area','ticket','kind'];
for(const id of filterIds) if(params.has(id)) $(id).value=params.get(id);
const categoryOptions=$('categoryOptions');
const checkedCategories=()=>categoryOptions.querySelectorAll('input:checked');
let debounce;
let storeLocations={};
let origin=null;
let locationRequest=0;
const distances=new Map();
const nearbyButton=$('nearby');
const locationStatus=$('locationStatus');
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
function validCoordinates(point){
  return Number.isFinite(point?.latitude)&&Math.abs(point.latitude)<=90
    &&Number.isFinite(point?.longitude)&&Math.abs(point.longitude)<=180;
}
function distanceInMeters(from,to){
  const radians=degrees=>degrees*Math.PI/180;
  const latDelta=radians(to.latitude-from.latitude);
  const lngDelta=radians(to.longitude-from.longitude);
  const a=Math.sin(latDelta/2)**2
    +Math.cos(radians(from.latitude))*Math.cos(radians(to.latitude))*Math.sin(lngDelta/2)**2;
  return 2*6371008.8*Math.asin(Math.sqrt(Math.min(a,1)));
}
function updateDistances(){
  distances.clear();
  if(!origin)return;
  for(const store of stores){
    const point=storeLocations[store.record_id];
    if(validCoordinates(point)) distances.set(store.record_id,distanceInMeters(origin,point));
  }
}
function distanceLabel(distance){
  return distance<1000
    ? Math.round(distance).toLocaleString('ja-JP')+' m'
    : (distance/1000).toLocaleString('ja-JP',{maximumFractionDigits:1})+' km';
}
function mapLink(store){
  const point=storeLocations[store.record_id];
  const link=document.createElement('a');
  if(typeof point?.googleMapsCid==='string'&&/^\d+$/.test(point.googleMapsCid)){
    link.href='https://www.google.com/maps?cid='+point.googleMapsCid;
    link.textContent='Google マップで店舗を開く ↗';
  }else if(validCoordinates(point)){
    const query=encodeURIComponent(point.latitude+','+point.longitude);
    link.href='https://www.google.com/maps/search/?api=1&query='+query;
    link.textContent='Google マップで店舗の位置を開く ↗';
  }else if(store.address){
    link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(store.address);
    link.textContent='Google マップで住所を検索 ↗';
  }else return null;
  link.target='_blank';
  link.rel='noopener noreferrer';
  return link;
}
function openDetail(r){
  $('dname').textContent=r.name;
  const body=$('dbody');
  body.replaceChildren();
  const badges=document.createElement('div');
  badges.className='badges';
  badges.append(badge(ticketLabel(r)),badge(kindLabel(r),true));
  body.append(badges);
  const fields=[
    ['住所',r.address||'住所未登録'],
    ['地域',r.area||'未分類'],
    ['カテゴリ',r.category||'未分類'],
    ['掲載元',r.source||'不明']
  ];
  if(distances.has(r.record_id)) fields.push(['現在地からの直線距離',distanceLabel(distances.get(r.record_id))]);
  for(const [label,value] of fields){
    const p=document.createElement('p');
    p.append(text('strong',label+'：'),text('span',value));
    body.append(p);
  }
  const link=mapLink(r);
  if(link) body.append(link);
  body.append(text('p','※公式掲載情報であり、現在の利用可否を保証するものではありません。'));
  $('detail').showModal();
}
function addPage(){
  const container=$('results');
  for(const r of filtered.slice(shown,shown+30)){
    const card=document.createElement('button');
    card.type='button';
    card.className='store';
    const badges=document.createElement('div');
    badges.className='badges';
    badges.append(badge(ticketLabel(r)),badge(kindLabel(r),true));
    card.append(badges,text('h3',r.name),text('p',r.address||'住所未登録'),text('p',r.category||'カテゴリ未登録'));
    if(origin){
      const label=distances.has(r.record_id)
        ? '直線距離 約 '+distanceLabel(distances.get(r.record_id))
        : '距離未表示（店舗の座標未登録）';
      card.append(text('p',label));
    }
    card.addEventListener('click',()=>openDetail(r));
    container.append(card);
  }
  shown=Math.min(shown+30,filtered.length);
  $('more').hidden=shown>=filtered.length;
}
function resetLocation(){
  origin=null;
  locationRequest++;
  updateDistances();
  nearbyButton.removeAttribute('aria-busy');
  nearbyButton.textContent='現在地から近い順';
  nearbyButton.setAttribute('aria-pressed','false');
  if(!nearbyButton.disabled) locationStatus.textContent='';
}
nearbyButton.addEventListener('click',()=>{
  if(origin||nearbyButton.getAttribute('aria-busy')==='true'){
    resetLocation();
    render();
    return;
  }
  const request=++locationRequest;
  const finish=()=>{
    if(request!==locationRequest)return false;
    nearbyButton.removeAttribute('aria-busy');
    nearbyButton.textContent='現在地から近い順';
    return true;
  };
  nearbyButton.textContent='現在地の取得をキャンセル';
  nearbyButton.setAttribute('aria-busy','true');
  locationStatus.textContent='現在地を取得中…';
  navigator.geolocation.getCurrentPosition(({coords})=>{
    if(!finish())return;
    if(!validCoordinates(coords)){
      locationStatus.textContent='現在地を取得できませんでした。もう一度お試しください。';
      return;
    }
    origin=coords;
    updateDistances();
    nearbyButton.textContent='近い順を解除';
    nearbyButton.setAttribute('aria-pressed','true');
    render();
  },error=>{
    if(!finish())return;
    locationStatus.textContent=error.code===1
      ? '位置情報が許可されていません。ブラウザの設定をご確認ください。'
      : '現在地を取得できませんでした。もう一度お試しください。';
  },{timeout:10000,maximumAge:0});
});
function render(){
  clearTimeout(debounce);
  debounce=undefined;
  const categories=new Set(Array.from(checkedCategories(),input=>input.value));
  $('categoryCount').textContent=categories.size+'件選択中';
  $('clearCategories').disabled=categories.size===0;
  syncUrl(categories);
  filtered=stores.filter(r=>matches(r,categories));
  if(origin){
    const sortDistance=store=>distances.get(store.record_id)??Number.MAX_VALUE;
    filtered.sort((a,b)=>sortDistance(a)-sortDistance(b));
    const located=filtered.filter(store=>distances.has(store.record_id)).length;
    locationStatus.textContent=located
      ? '座標登録済みの '+located+' 件を直線距離順に表示します。'
      : '検索結果に座標登録済みの店舗がありません。';
  }
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
  resetLocation();
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
async function fetchJson(url){
  const response=await fetch(url);
  if(!response.ok)throw Error(response.status);
  return response.json();
}
const storesReady=fetchJson('stores.json').then(data=>{
  stores=data;
  $('total').textContent=stores.length+' 件掲載';
  options('area',stores.map(r=>r.area));
  addCategoryOptions();
  render();
});
storesReady.catch(error=>{
  $('total').textContent='読み込み失敗';
  $('results').textContent='データを読み込めません。ローカルサーバーから開いてください。 '+error.message;
});
Promise.all([storesReady,fetchJson('store-locations.json')]).then(([,locations])=>{
  storeLocations=locations;
  if(!window.isSecureContext||!navigator.geolocation){
    locationStatus.textContent='この環境では現在地を取得できません。';
  }else if(stores.some(store=>validCoordinates(storeLocations[store.record_id]))){
    nearbyButton.disabled=false;
  }else{
    locationStatus.textContent='座標登録済みの店舗はありません。';
  }
}).catch(()=>{
  locationStatus.textContent='現在地からの検索に必要なデータを読み込めませんでした。';
});
