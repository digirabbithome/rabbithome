let db=null, auth=null, isOnline=false, onlineCache=null;

window.addEventListener('message', (ev)=>{
  if(ev?.data?.type==='setFirebase'){
    db = ev.data.db || null;
    auth = ev.data.auth || null;
    isOnline = !!db;
    loadList();
  }
});

try{
  if (window.parent && window.parent.TemplateManagerDB){
    db = window.parent.TemplateManagerDB;
    auth = window.parent.TemplateManagerAuth || null;
    isOnline = !!db;
  }
}catch(e){}

const $=sel=>document.querySelector(sel);

function lsKey(){ return 'vendor_templates_store_v1'; }
function readAllLocal(){ try{ return JSON.parse(localStorage.getItem(lsKey())||'{}'); }catch{ return {}; } }
function writeAllLocal(obj){ localStorage.setItem(lsKey(), JSON.stringify(obj||{})); }

async function loadList(){
  let data=null;
  if (isOnline && db){
    const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
    const snap = await getDocs(collection(db, 'vendor_templates'));
    data = {}; snap.forEach(doc=> data[doc.id] = doc.data()); onlineCache = data;
  }else{ data = readAllLocal(); }
  renderList(data);
}
function renderList(data){
  const ul = $('#tplList'); ul.innerHTML='';
  const names = Object.keys(data).sort((a,b)=> a.localeCompare(b,'zh-Hant'));
  names.forEach(name=>{
    const li = document.createElement('li');
    li.innerHTML = `<div class="name">${name}</div>
      <div class="row">
        <button class="btn ghost" onclick="editTemplate('${name}')">編輯</button>
        <button class="btn outline" onclick="printGuide('${name}')">列印手冊</button>
        <button class="btn danger" onclick="deleteTemplate('${name}')">刪除</button>
      </div>`;
    ul.appendChild(li);
  });
  $('#count').textContent = names.length;
}

function newTemplate(){
  $('#formTitle').textContent='新增模板';
  $('#vendorName').value='';
  $('#tolerance').value='3';
  $('#strip').value='客戶對帳單\nTEL\nFAX\n統一編號\n總計';
  $('#aliases').value='{}';
}
function getStore(){ return (isOnline && onlineCache)? onlineCache : readAllLocal(); }
function editTemplate(name){
  const store = getStore();
  const data = store[name];
  if(!data){ alert('找不到模板'); return; }
  $('#formTitle').textContent = '編輯模板：' + name;
  $('#vendorName').value = name;
  $('#tolerance').value = (data.tolerance!=null? data.tolerance: 3);
  $('#strip').value = (data.stripLines||[]).join('\n');
  $('#aliases').value = JSON.stringify(data.aliases||{}, null, 2);
}

async function saveTemplate(){
  const name = ($('#vendorName').value||'').trim();
  if(!name){ alert('請輸入廠商名稱'); return; }
  const payload = {
    vendorName: name,
    tolerance: parseFloat($('#tolerance').value) || 3,
    stripLines: $('#strip').value.split(/\n+/).map(s=>s.trim()).filter(Boolean),
    aliases: safeJSON($('#aliases').value)||{},
    updatedAt: new Date().toISOString()
  };
  if(isOnline && db){
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
    payload.updatedAt = serverTimestamp();
    await setDoc(doc(db, 'vendor_templates', name), payload, {merge:true});
    if(!onlineCache) onlineCache = {}; onlineCache[name]=payload;
  }else{
    const all = readAllLocal(); all[name]=payload; writeAllLocal(all);
  }
  loadList();
  alert('已儲存');
}
function safeJSON(s){ try{ return JSON.parse(s);}catch(e){ alert('aliases 不是合法 JSON'); return null; } }
async function deleteTemplate(name){
  if(!confirm('確定刪除「'+name+'」？')) return;
  if(isOnline && db){
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
    await deleteDoc(doc(db, 'vendor_templates', name)); if(onlineCache) delete onlineCache[name];
  }else{ const all = readAllLocal(); delete all[name]; writeAllLocal(all); }
  loadList();
}
function exportAll(){
  const data = getStore();
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='vendor_templates_export.json'; a.click();
  URL.revokeObjectURL(url);
}
function importAll(ev){
  const file = ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(isOnline && db){ onlineCache = obj; } else { writeAllLocal(obj); }
      loadList(); alert('已匯入（離線模式直接存 localStorage；線上模式載入到記憶體，請逐筆儲存以寫回 Firestore）');
    }catch(e){ alert('不是合法 JSON');}
  }; reader.readAsText(file,'utf-8');
}
function printGuide(name){
  const store = getStore(); const data = store[name]; if(!data){ alert('找不到模板'); return; }
  const w = window.open('', '_blank');
  const css = `<style>body{font-family:"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0 0 8px}h2{font-size:16px;margin:16px 0 6px}.box{border:1px solid #ddd;border-radius:10px;padding:12px}code,pre{font-family:ui-monospace,Menlo,Consolas,monospace;background:#fafafa;padding:2px 6px;border-radius:6px}ul{margin:6px 0 0 18px}.muted{color:#6b7280}</style>`;
  const html = `<html><head><meta charset="utf-8"><title>模板說明：${name}</title>${css}</head><body>
  <h1>模板說明：${name}</h1><p class="muted">列印日期：${new Date().toLocaleString()}</p>
  <h2>忽略關鍵字（stripLines）</h2><div class="box"><ul>${(data.stripLines||[]).map(s=>`<li>${s}</li>`).join('')}</ul></div>
  <h2>別名對應（aliases）</h2><div class="box"><pre>${JSON.stringify(data.aliases||{}, null, 2)}</pre></div>
  <h2>金額容忍（tolerance）</h2><div class="box"><code>± ${data.tolerance!=null? data.tolerance: 3} 元</code></div>
  <hr/><p>此手冊協助對帳人員理解解析邏輯（忽略哪些行、品名統一、金額誤差容忍）。</p><script>window.print()</script></body></html>`;
  w.document.write(html); w.document.close();
}
window.addEventListener('DOMContentLoaded', loadList);