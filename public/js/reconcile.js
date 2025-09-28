const $=sel=>document.querySelector(sel);
const nf=new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});

let db = window.TemplateManagerDB || null;
let auth = window.TemplateManagerAuth || null;

function parseNumber(x){ if(x==null) return NaN; if(typeof x==='number') return x; let s=String(x).trim(); s=s.replace(/[,\s\u3000]/g,''); s=s.replace(/[^0-9.\-]/g,''); const v=parseFloat(s); return isNaN(v)?NaN:v; }
function cleanText(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function keyOf(s){ return cleanText(s).toLowerCase().replace(/[^a-z0-9一-龥x\-/_,]/g,''); }
function hasAnyKeyword(s, arr){ if(!arr||!arr.length) return false; const t = s.toLowerCase(); return arr.some(k=> t.includes(String(k).toLowerCase())); }

let posRows=[], venRows=[], showPosSimple=true, compareMode='orders';
let vendorGroups=[]; let rejectedLines=[];
let vendorTemplate=null;

// Normalize OCR text: collapse spaces between CJK to help headerRegex match
function normalizeCJKSpacing(s){
  if(!s) return '';
  let t = String(s).replace(/\r\n/g,'\n').replace(/\u3000/g,' ');
  t = t.replace(/([\u4E00-\u9FFF])\s+(?=[\u4E00-\u9FFF])/g, '$1');
  t = t.replace(/[ \t]{2,}/g, ' ');
  return t;
}

// ---- Fallback parsing helpers (tolerant) ----
function _toNumLoose(x){
  if(x==null) return NaN;
  let s = String(x);
  s = s.replace(/，/g, ',').replace(/[．。]/g, '.');
  const parts = s.split('.');
  if(parts.length>2){ const frac = parts.pop(); s = parts.join('') + '.' + frac; }
  s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n)? n : NaN;
}
  const n = parseFloat(s); return Number.isFinite(n)? n : NaN;
}
function _grabMoniesLoose(line){
  const re = /(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?/g;
  const list=[]; let m;
  while((m=re.exec(line))){ const v=_toNumLoose(m[0]); list.push({v,i:m.index}); }
  return list;
}
  return list;
}
function _stripLeadingColsLoose(s){
  let t = s.trim();
  t = t.replace(/^\d{2,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2}\s+/, '');
  t = t.replace(/^(?:銷貨|進貨)?\s*\d{6,}\s+/, '');
  t = t.replace(/^[A-Z0-9\-/（）()]+(?:\s+[A-Z0-9\-/（）()]+)*\s+/, '');
  return t;
}
function _parseLineLoose(ln){
  let s = normalizeCJKSpacing(ln).replace(/[，]/g,',').replace(/[．。]/g,'.');
  if(/(本期|總計|應收|折讓|營業稅|已收|預收)/.test(s)) return null;
  const monies = _grabMoniesLoose(s);
  if(monies.length<2) return null;
  const sub = monies[monies.length-1].v;
  const price = monies[monies.length-2].v;
  if(!(sub>0 && price>0)) return null;
  const left = s.slice(0, monies[monies.length-2].i);
  let qty = NaN;
  const mQty = left.match(/(\d+)\s*(?:片|組|個|支|枝|卷|捲|台|套|張|米|公分|KR|x)?\s*$/);
  if(mQty) qty = parseInt(mQty[1],10);
  if(!Number.isFinite(qty)){ const q = Math.round(sub/price); if(q>0) qty=q; }
  let item = _stripLeadingColsLoose(left).replace(/\s*\d+\s*(?:片|組|個|支|卷|捲|台|套|張|米|公分|KR|x)?\s*$/,'');
  item = item.replace(/[()（）]/g,'').trim();
  if(!item) return null;
  return { item, qty, price, sub };
}
function _fallbackParseLines(allLines){
  const rows=[];
  for(const ln of allLines){ const r=_parseLineLoose(ln); if(r) rows.push(r); }
  return rows;
}
// ---- end fallback helpers ----

// ===== Added helpers: page sorting, vendor total extraction, safe header regex =====
const RE_PAGE_TAGS = [
  /(\d+)\s*\/\s*(\d+)/g,
  /第\s*(\d+)\s*頁\s*\/\s*共\s*(\d+)\s*頁/g,
  /Page\s*(\d+)\s*(?:of|\/)\s*(\d+)/gi
];
function naturalSortFiles(fileList){
  const arr = Array.from(fileList || []);
  return arr.sort((a,b)=>{
    const an=(a.name||'').toLowerCase();
    const bn=(b.name||'').toLowerCase();
    const cmp = an.localeCompare(bn, 'zh-Hant', { numeric:true, sensitivity:'base' });
    if(cmp!==0) return cmp;
    return (a.lastModified||0) - (b.lastModified||0);
  });
}
function extractPageInfoFromText(t){
  for(const re of RE_PAGE_TAGS){
    re.lastIndex = 0;
    const m = re.exec(t||''); if(m){ const i=+m[1], tot=+m[2]; if(i>=1 && Number.isFinite(i)) return {i,tot,ok:true}; }
  }
  return {ok:false};
}
function reorderPageTextsByTag(pages){
  const withTag=[], noTag=[];
  for(const p of pages){
    const info = extractPageInfoFromText(p.text||'');
    if(info.ok) withTag.push({ ...p, _i: info.i });
    else noTag.push(p);
  }
  if(withTag.length){
    withTag.sort((a,b)=>a._i-b._i);
    return [...withTag, ...noTag];
  }
  return pages;
}
const RE_VENDOR_TOTAL = /(本期(?:總計|應收款|合計))\s*[:：]\s*([\d,]+(?:\.\d{1,2})?)/g;
function extractVendorTotal(allText){
  let m, last=null;
  while((m = RE_VENDOR_TOTAL.exec(allText||''))){ const v=parseFloat(m[2].replace(/,/g,'')); if(Number.isFinite(v)) last={label:m[1], value:v}; }
  return last;
}
function buildHeaderRegex(str){
  if(!str) return null;
  let s = String(str).trim();
  // normalize full-width parens
  s = s.replace(/（/g,'(').replace(/）/g,')');
  // allow simple wildcard *
  s = s.replace(/\*/g, '.*');
  try{ return new RegExp(s, 'i'); }
  catch(e){
    try{
      const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(esc, 'i');
    }catch(e2){ return null; }
  }
}
// ===== End helpers =====


window.addEventListener('DOMContentLoaded',()=>{
  // POS
  $('#loadPos').onclick=loadPosCSV;
  $('#applyPosMap').onclick=applyPosMap;
  $('#togglePosView').onchange=e=>{ showPosSimple=e.target.checked; renderPosTable(); };

  // Compare mode
  document.querySelectorAll('input[name="compareMode"]').forEach(r=> r.onchange = e=>{ compareMode=e.target.value; });

  // OCR / Parse
  $('#runOcr').onclick=runOcrImages;
  $('#smartParse').onclick=smartParseVendor;
  const pft=$('#parseFromText'); if(pft){ pft.onclick=()=>{ const t=$('#rawText').value||''; if(!t.trim()){ alert('請先貼上文字或執行 OCR'); return;} window.__venText = normalizeCJKSpacing(t); smartParseVendor(); }; }

  // Suppliers
  loadSuppliersForSelect();
  $('#btnApplyTpl').onclick=applyTemplateFromStore;
  const _btnV=$('#btnValidateTemplate'); if(_btnV){ _btnV.onclick=validateTemplate; }
  $('#btnReloadSuppliers').onclick=loadSuppliersForSelect;
  $('#btnApplyTplManual').onclick=applyTemplateFromManual;
  $('#btnSaveTpl').onclick=saveTemplateToStore;
});

// Suppliers helpers (Firestore)
async function loadSuppliersForSelect(){
  const sel = document.getElementById('supplierSelect');
  const hint = document.getElementById('supplierLoadHint');
  try{
    if(!sel) return;
    sel.innerHTML = '<option value="">（載入中…）</option>';
    if(hint) hint.textContent = 'loading suppliers…';
    if(!window.TemplateManagerDB){
      sel.innerHTML = '<option value="">未連線 Firebase（僅可離線測試）</option>';
      if(hint) hint.textContent = 'no Firebase db detected';
      return;
    }
    const F = window.__Fire;
    const q = F.query(F.collection(window.TemplateManagerDB,'suppliers'), F.orderBy('code'));
    const snap = await F.getDocs(q);
    const items = [];
    snap.forEach(doc=>{
      const d = doc.data();
      const label = `${d.code||''}-${d.shortName||d.name||doc.id}`.trim();
      items.push({id:doc.id, label});
    });
    sel.innerHTML = '<option value="">請選擇供應商</option>' + items.map(it=>`<option value="${it.id}">${it.label}</option>`).join('');
  }catch(e){
    const sel = document.getElementById('supplierSelect');
    if(sel) sel.innerHTML = '<option value="">載入供應商失敗</option>';
    console.error(e);
  }
}
async function applyTemplateFromStore(){
  const supplierId = document.getElementById('supplierSelect')?.value || '';
  if(!supplierId){ alert('請先選擇供應商'); return; }
  if(!window.TemplateManagerDB){ alert('未連線 Firebase，無法從 suppliers 讀取樣板'); return; }
  const F = window.__Fire;
  const snap = await F.getDoc(F.doc(window.TemplateManagerDB,'suppliers', supplierId));
  if(!snap.exists()){ $('#tplStatus').textContent='找不到供應商文件'; return; }
  const data = snap.data();
  vendorTemplate = data.reconcileTemplate || null;
  if(!vendorTemplate){ $('#tplStatus').textContent='此供應商尚未設定樣板'; return; }
  if(vendorTemplate.tolerance!=null) $('#tol').value = vendorTemplate.tolerance;
  $('#tplStatus').textContent='已套用樣板（suppliers）';
}
async function saveTemplateToStore(){
  const supplierId = document.getElementById('supplierSelect')?.value || '';
  if(!supplierId){ alert('請先選擇供應商'); return; }
  if(!window.TemplateManagerDB){ alert('未連線 Firebase，無法寫入 suppliers'); return; }
  const payload={
    stripLines: vendorTemplate?.stripLines || [],
    aliases: vendorTemplate?.aliases || {},
    tolerance: parseNumber($('#tol').value) || 3.0,
    freightKeywords: vendorTemplate?.freightKeywords || ['運費','服務費','包裝費'],
    discountKeywords: vendorTemplate?.discountKeywords || ['折讓','折扣','折抵'],
    headerRegex: vendorTemplate?.headerRegex || null,
    updatedAt: new Date().toISOString()
  };
  const F = window.__Fire;
  const ref = F.doc(window.TemplateManagerDB,'suppliers', supplierId);
  const snap = await F.getDoc(ref);
  if(!snap.exists()){ alert('供應商文件不存在'); return; }
  await F.setDoc(ref, { reconcileTemplate: payload }, { merge:true });
  vendorTemplate = payload;
  $('#tplStatus').textContent='樣板已儲存到 suppliers';
}

// POS
let RawPos=[], PosCols=[];
function loadPosCSV(){
  const f=$('#posFile').files[0]; if(!f){ alert('請先選擇 POS CSV'); return }
  Papa.parse(f,{header:true,skipEmptyLines:true,complete:res=>{
    RawPos=res.data; if(!RawPos.length){ alert('CSV 無資料'); return }
    PosCols=Object.keys(RawPos[0]||{});
    for(const id of ['posColItem','posColQty','posColPrice','posColSub','posColVendor','posColDate','posColOrder']){
      const sel=document.getElementById(id); sel.innerHTML=''; const optEmpty=document.createElement('option'); optEmpty.value=''; optEmpty.textContent='（無）'; sel.appendChild(optEmpty);
      PosCols.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
    }
  }})
}
function applyPosMap(){
  if(!RawPos.length){ alert('請先讀取 CSV'); return }
  const ci=$('#posColItem').value, cq=$('#posColQty').value, cp=$('#posColPrice').value, cs=$('#posColSub').value, cv=$('#posColVendor').value, cd=$('#posColDate').value, co=$('#posColOrder').value;
  posRows = RawPos.map(r=>({
    date: cleanText(r[cd]||''),
    vendor: cleanText(r[cv]||''),
    order: cleanText(r[co]||''),
    item: cleanText(r[ci]||''),
    qty: parseNumber(r[cq]),
    price: parseNumber(r[cp]),
    sub: parseNumber(r[cs])
  })).filter(r=> (r.item || Number.isFinite(r.sub) || r.order));
  renderPosTable(); updateTotals();
}
function renderPosTable(){
  const thead=$('#posTable thead'), tbody=$('#posTable tbody');
  if(showPosSimple){
    thead.innerHTML='<tr><th>日期</th><th>廠商</th><th>貨單編號</th><th>金額</th></tr>';
    tbody.innerHTML=posRows.map(r=>`<tr><td>${r.date||''}</td><td>${r.vendor||''}</td><td>${r.order||''}</td><td>${Number.isFinite(r.sub)?nf.format(r.sub):(Number.isFinite(r.qty)&&Number.isFinite(r.price)?nf.format(r.qty*r.price):'')}</td></tr>`).join('');
  }else{
    thead.innerHTML='<tr><th>日期</th><th>廠商</th><th>貨單編號</th><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
    tbody.innerHTML=posRows.map(r=>`<tr><td>${r.date||''}</td><td>${r.vendor||''}</td><td>${r.order||''}</td><td>${r.item}</td><td>${Number.isFinite(r.qty)?nf.format(r.qty):''}</td><td>${Number.isFinite(r.price)?nf.format(r.price):''}</td><td>${Number.isFinite(r.sub)?nf.format(r.sub):(Number.isFinite(r.qty)&&Number.isFinite(r.price)?nf.format(r.qty*r.price):'')}</td></tr>`).join('');
  }
  $('#posSum').textContent = nf.format(sumPos());
}
function sumRow(r){ return Number.isFinite(r.sub)? r.sub : (Number.isFinite(r.qty)&&Number.isFinite(r.price)? r.qty*r.price : 0); }
function sumPos(){ return posRows.reduce((a,b)=> a + sumRow(b), 0) }

// OCR
async function ocrImages(files){
  const worker=await Tesseract.createWorker('eng+chi_tra');
  const out=[];
  for(let i=0;i<files.length;i++){
    const f=files[i];
    $('#ocrStatus').textContent=`辨識中 ${i+1}/${files.length}：${f.name}`;
    const {data}=await worker.recognize(f);
    out.push(data.text);
  }
  await worker.terminate();
  $('#ocrStatus').textContent='完成';
  return out;
}

async function runOcrImages(){
  const fs=$('#imgFiles').files;
  if(!fs.length){ alert('請先選擇圖片'); return }
  for(const f of fs){
    const name = (f.name||'').toLowerCase();
    if(f.type==='application/pdf' || name.endsWith('.pdf')){
      alert('請將 PDF 轉成 PNG/JPG 再上傳'); 
      return;
    }
  }
  const sorted = naturalSortFiles(fs);
  const texts = await ocrImages(sorted);
  const ordered = reorderPageTextsByTag(texts.map(t=>({text:t})));
  const merged = ordered.map(p=>p.text).join('\n');
  window.__venText = normalizeCJKSpacing(merged);
  const rt=$('#rawText'); if(rt){ rt.value = window.__venText; }
  const vt = extractVendorTotal(window.__venText);
  if(vt){ 
    window.__vendorTotal = vt.value; 
    const vtEl = document.getElementById('vendorTotal'); 
    if(vtEl) vtEl.textContent = nf.format(vt.value); 
  }
  $('#venTable thead').innerHTML='<tr><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
  $('#venTable tbody').innerHTML='';
}


// Vendor parse
function isDateToken(tok){ tok = tok.replace(/^[^\\d]+/, '').replace(/[^\\d\\/\\.\\-]/g,''); return /^(\\d{2,4})[\\/\\.\\-]\\d{1,2}[\\/\\.\\-]\\d{1,2}$/.test(tok); }
function findLongNumber(s){ const digits = s.replace(/\\D/g,''); const m = digits.match(/(\\d{8,14})\\d*$/); return m? m[1] : null; }

function smartParseVendor(){
  let text = window.__venText || '';
  const status = $('#parseStatus');
  if(!text){
    if(status) status.textContent = '沒有 OCR 文字，請先辨識或貼上文字';
    try{ alert('尚未有 OCR 結果'); }catch(e){}
    return;
  }
  if(status) status.textContent = '解析中…';

  const builtIns = [
    '客戶對帳單','TEL','FAX','電話','傳真','地址','統一編號','統編',
    '客戶編號','客戶名稱','日期區間','頁','台 北市','大 同 區','民權 西 路',
    '本期合計','本期折讓','營業稅','前期應收','本期已收','預收款','本期應收款','總計','備註','收款方式'
  ];
  const mergedStrips = new Set([...(vendorTemplate?.stripLines||[]), ...builtIns]);
  const freightKW = vendorTemplate?.freightKeywords || ['運費','服務費','包裝費','物流'];
  const discountKW = vendorTemplate?.discountKeywords || ['折讓','折扣','折抵'];
  const headerReg = buildHeaderRegex(vendorTemplate?.headerRegex);

  const raw = text.split(/\\n+/).map(s=>s.trim()).filter(Boolean);
  const lines = raw.filter(ln=> ![...mergedStrips].some(w=> w && ln.includes(w)));

  // header detection
  const headers=[];
  for(let i=0;i<lines.length;i++){
    const ln=lines[i];
    let dateTok='', orderNo=null;
    if(headerReg){
      const m = ln.match(headerReg);
      if(m){ dateTok = (m[1]||'').toString(); orderNo = (m[2]||'').toString(); }
    }else{
      const tokens=ln.split(/\\s+/);
      const hasDate=tokens.some(isDateToken);
      orderNo=findLongNumber(ln);
      if(hasDate){ dateTok = tokens.find(isDateToken).replace(/[^\\d\\/\\.\\-]/g,''); }
    }
    if(dateTok && orderNo){ headers.push({idx:i, date:dateTok, orderNo}); }
  }

  vendorGroups=[]; rejectedLines=[];
  const tol = parseNumber($('#tol')?.value) || vendorTemplate?.tolerance || 3;

  const acceptLine = (ln0)=>{
    const ln = ln0.replace(/[|│—–\\-]+/g,' ').trim();
    if(!ln) return null;

    const bigNum = (ln.match(/\\d{7,}/)? true:false);
    if(bigNum && !hasAnyKeyword(ln, freightKW) && !hasAnyKeyword(ln, discountKW)){
      rejectedLines.push({line:ln0, reason:'可疑超大數字'}); return null;
    }

    const nums=[...ln.matchAll(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?/g)].map(m=>m[0]);
    if(nums.length===0){ rejectedLines.push({line:ln0, reason:'找不到數字'}); return null; }

    if(hasAnyKeyword(ln, freightKW) || hasAnyKeyword(ln, discountKW)){
      const last = parseNumber(nums[nums.length-1]);
      if(Number.isFinite(last)){
        const sub = hasAnyKeyword(ln, discountKW)? -Math.abs(last) : last;
        return {item: cleanText(ln.replace(/[0-9.,]+/g,'')).slice(0,64), qty: 1, price: sub, sub};
      }
    }

    let accepted=null;
    for(let p2=nums.length-1; p2>=1; p2--){
      const sub=parseNumber(nums[p2]);
      const price=parseNumber(nums[p2-1]);
      if(!Number.isFinite(sub)) continue;
      let qty=NaN, qIdx=-1;
      for(let k=p2-2; k>=0; k--){
        const v=parseNumber(nums[k]);
        if(Number.isInteger(v) && v>=0 && v<10000){ qty=v; qIdx=k; break; }
      }
      const est=(Number.isFinite(qty)&&Number.isFinite(price))? qty*price : NaN;
      const ok=Number.isFinite(est)? Math.abs(est - sub) <= tol : false;
      if(ok){
        let head=ln;
        const idxSub=head.lastIndexOf(nums[p2]); head = idxSub>0? head.slice(0,idxSub): head;
        const idxPrice=head.lastIndexOf(nums[p2-1]); head = idxPrice>0? head.slice(0,idxPrice): head;
        if(qIdx>=0){ const idxQty=head.lastIndexOf(nums[qIdx]); if(idxQty>0) head = head.slice(0, idxQty); }
        let item=cleanText(head);
        if (vendorTemplate?.aliases && vendorTemplate.aliases[item]) item = vendorTemplate.aliases[item];
        if(item && !/^\\d+(\\.\\d+)?$/.test(item)){ accepted = {item, qty, price, sub}; break; }
      }
    }
    if(!accepted){ rejectedLines.push({line:ln0, reason:'不符合 qty*price≈sub'}); }
    return accepted;
  };

  if(headers.length===0){
    const anyDate = (text.match(/(\d{2,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/)||[])[1] || '';
    const anyOrder = findLongNumber(text) || '';
    const rows = parseLinesByMode(lines, acceptLine, _fallbackParseLines);
    vendorGroups.push({date:anyDate, orderNo:anyOrder, rows});
  }else{
    for(let h=0; h<headers.length; h++){
      const start=headers[h].idx+1;
      const end=(h+1<headers.length)? headers[h+1].idx : lines.length;
      const rows=[];
      for(let i=start;i<end;i++){ const r = acceptLine(lines[i]); if(r) rows.push(r); }
      vendorGroups.push({ date: headers[h].date, orderNo: headers[h].orderNo, rows });
    }
  }

  venRows = vendorGroups.flatMap(g=> g.rows);
  renderVendorGroupedTable();
  renderRejected();
  updateTotals();
  if(status){ const h=vendorGroups.length; const items=venRows.length; status.textContent = `解析完成：${h} 組貨單、${items} 筆品項（未採用 ${rejectedLines.length} 行）`; }
}

function renderVendorGroupedTable(){
  const thead=$('#venTable thead'), tbody=$('#venTable tbody');
  thead.innerHTML='<tr><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
  const html=[];
  for(const g of vendorGroups){
    const sum = g.rows.reduce((a,b)=> a + sumRow(b), 0);
    html.push(`<tr class="groupRow"><td colspan="4">貨單：${g.date || ''}　#${g.orderNo || ''}　<span class="small">小計合計：${nf.format(sum)}</span></td></tr>`);
    html.push(...g.rows.map(r=> `<tr><td>${r.item}</td><td>${Number.isFinite(r.qty)?nf.format(r.qty):''}</td><td>${Number.isFinite(r.price)?nf.format(r.price):''}</td><td>${Number.isFinite(r.sub)?nf.format(r.sub):''}</td></tr>`));
  }
  tbody.innerHTML = html.join('');
  const total = venRows.reduce((a,b)=> a + sumRow(b), 0);
  $('#venSum').textContent = nf.format(total);
}
function renderRejected(){
  const tbody = document.querySelector('#venRejected tbody');
  if(!tbody) return;
  if(!rejectedLines || !rejectedLines.length){ tbody.innerHTML = '<tr><td colspan="2" class="small">（無）</td></tr>'; return; }
  tbody.innerHTML = rejectedLines.slice(0,200).map(x=> `<tr><td>${(x.line||'').replace(/[<>&]/g, s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</td><td class="small">${x.reason||''}</td></tr>`).join('');
}

// Matching
function runMatch(){ if(document.querySelector('input[name="compareMode"]:checked')?.value==='orders'){ runMatchOrders(); } else { runMatchItems(); } }
$('#runMatch').onclick = runMatch;

function renderCompareRows(sel, arr, ok){
  const thead=document.querySelector(sel+' thead'); const tbody=document.querySelector(sel+' tbody');
  thead.innerHTML=`<tr><th>POS 品名</th><th>數量</th><th>小計</th><th></th><th>廠商 品名</th><th>數量</th><th>小計</th><th>差額</th><th>相似度</th></tr>`;
  tbody.innerHTML = arr.map(r=>{
    const p=r.pos, v=r.ven; const pSub=sumRow(p), vSub=sumRow(v);
    const gap=(Number.isFinite(pSub)&&Number.isFinite(vSub))? (pSub - vSub): NaN;
    const pill = ok? '<span class="pill ok">OK</span>' : '<span class="pill bad">Check</span>';
    return `<tr><td>${p?p.item:'—'}</td><td>${p&&Number.isFinite(p.qty)?nf.format(p.qty):''}</td><td>${p&&Number.isFinite(pSub)?nf.format(pSub):''}</td>
      <td>${pill}</td><td>${v?v.item:'—'}</td><td>${v&&Number.isFinite(v.qty)?nf.format(v.qty):''}</td><td>${v&&Number.isFinite(vSub)?nf.format(vSub):''}</td>
      <td>${Number.isFinite(gap)?nf.format(gap):''}</td><td>${r.score? r.score.toFixed(2): '—'}</td></tr>`;
  }).join('');
}
function runMatchItems(){
  const tol = parseNumber($('#tol').value)||0; const used=new Set(); const ok=[], bad=[];
  for(const p of posRows){
    let best=-1,score=0;
    for(let i=0;i<venRows.length;i++){
      if(used.has(i)) continue;
      const v=venRows[i];
      const s=(keyOf(v.item)===keyOf(p.item))?1:(()=>{ const a=keyOf(p.item), b=keyOf(v.item); const big=s=>{const r=new Set(); for(let i=0;i<s.length-1;i++) r.add(s.slice(i,i+2)); return r}; const A=big(a),B=big(b); let inter=0; A.forEach(x=>{if(B.has(x)) inter++}); return (2*inter)/(A.size+B.size||1); })();
      if(s>score){ score=s; best=i; }
    }
    const pSub = sumRow(p);
    if(best>=0 && score>=0.55){ const v=venRows[best]; used.add(best); const vSub = sumRow(v); const gap = pSub - vSub; (Math.abs(gap)<=tol? ok: bad).push({pos:p, ven:v, score, gap}); }
    else{ bad.push({pos:p, ven:null, score, gap:NaN}); }
  }
  venRows.forEach((v,i)=>{ if(!used.has(i)) bad.push({pos:null, ven:v, score:0, gap:NaN}); });
  renderCompareRows('#tblOK', ok, true); renderCompareRows('#tblBad', bad, false); updateTotals();
}
function runMatchOrders(){
  const tol = parseNumber($('#tol').value)||0;
  const posMap = new Map();
  for(const r of posRows){ const key = `${r.date||''}|${r.order||''}`; const tot = sumRow(r); if(!posMap.has(key)) posMap.set(key, {date:r.date||'', order:r.order||'', total:0}); posMap.get(key).total += Number.isFinite(tot)? tot : 0; }
  const posOrders = [...posMap.values()];
  const venOrders = vendorGroups.map(g=> ({ date: g.date || '', order: g.orderNo || '', total: g.rows.reduce((a,b)=> a + sumRow(b), 0) }));
  const used = new Set(); const ok=[], bad=[];
  for(const p of posOrders){
    let matchIndex=-1, matchScore=-1;
    for(let i=0;i<venOrders.length;i++){
      if(used.has(i)) continue; const v=venOrders[i]; let score = 0;
      if(p.order && v.order && p.order.replace(/\D/g,'')===v.order.replace(/\D/g,'')){ score = 2; }
      else if(p.date && v.date && p.date===v.date && Math.abs((p.total||0)-(v.total||0))<=tol){ score = 1; }
      if(score>matchScore){ matchScore=score; matchIndex=i; }
    }
    if(matchIndex>=0 && matchScore>0){ const v=venOrders[matchIndex]; used.add(matchIndex); const gap=(p.total||0)-(v.total||0); (Math.abs(gap)<=tol? ok: bad).push({posOrder:p, venOrder:v, method:(matchScore===2?'單號匹配':'日期+金額匹配'), gap}); }
    else{ bad.push({posOrder:p, venOrder:null, method:'未匹配', gap:NaN}); }
  }
  venOrders.forEach((v,i)=>{ if(!used.has(i)) bad.push({posOrder:null, venOrder:v, method:'供應商多出', gap:NaN}); });

  const okTHead = `<tr><th>POS 日期</th><th>POS 單號</th><th>POS 合計</th><th></th><th>廠商 日期</th><th>廠商 單號</th><th>廠商 合計</th><th>差額</th><th>匹配方式</th></tr>`;
  $('#tblOK thead').innerHTML = okTHead;
  $('#tblOK tbody').innerHTML = ok.map(r=>`<tr>
    <td>${r.posOrder?.date||'—'}</td><td>${r.posOrder?.order||'—'}</td><td>${Number.isFinite(r.posOrder?.total)?nf.format(r.posOrder.total):''}</td>
    <td><span class="pill ok">OK</span></td>
    <td>${r.venOrder?.date||'—'}</td><td>${r.venOrder?.order||'—'}</td><td>${Number.isFinite(r.venOrder?.total)?nf.format(r.venOrder.total):''}</td>
    <td>${Number.isFinite(r.gap)?nf.format(r.gap):''}</td><td>${r.method||'—'}</td>
  </tr>`).join('');

  $('#tblBad thead').innerHTML = okTHead;
  $('#tblBad tbody').innerHTML = bad.map(r=>`<tr>
    <td>${r.posOrder?.date||'—'}</td><td>${r.posOrder?.order||'—'}</td><td>${Number.isFinite(r.posOrder?.total)?nf.format(r.posOrder.total):''}</td>
    <td><span class="pill bad">Check</span></td>
    <td>${r.venOrder?.date||'—'}</td><td>${r.venOrder?.order||'—'}</td><td>${Number.isFinite(r.venOrder?.total)?nf.format(r.venOrder.total):''}</td>
    <td>${Number.isFinite(r.gap)?nf.format(r.gap):''}</td><td>${r.method||'—'}</td>
  </tr>`).join('');

  const posTot = posOrders.reduce((a,b)=>a+(Number.isFinite(b.total)?b.total:0),0);
  const venTot = venOrders.reduce((a,b)=>a+(Number.isFinite(b.total)?b.total:0),0);
  const diff = posTot - venTot;
  const diffClass = diff===0 ? 'diff-zero' : 'diff-pos';
  document.getElementById('ordersTotals').innerHTML = `<div class="totals">
    <div class="small">POS 合計：</div><div class="mono">${nf.format(posTot)}</div>
    <div class="small">廠商合計：</div><div class="mono">${nf.format(venTot)}</div>
    <div class="small">差額：</div><div class="mono ${diffClass}">${nf.format(diff)}</div>
  </div>`;

  updateTotals();
}

function updateTotals(){ const pos=sumPos(), ven=venRows.reduce((a,b)=> a + sumRow(b), 0), diff=pos-ven; $('#posSum').textContent=nf.format(pos); $('#venSum').textContent=nf.format(ven); $('#diffSum').textContent=nf.format(diff); }
async function applyTemplateFromManual(){
  const id = (document.getElementById('supplierIdManual')?.value || '').trim();
  if(!id){ alert('請輸入 suppliers 文件 ID'); return; }
  if(!window.TemplateManagerDB){ alert('未連線 Firebase'); return; }
  const F = window.__Fire;
  const ref = F.doc(window.TemplateManagerDB,'suppliers', id);
  const snap = await F.getDoc(ref);
  if(!snap.exists()){ alert('找不到此文件'); return; }
  const data = snap.data() || {};
  vendorTemplate = data.reconcileTemplate || null;
  if(!vendorTemplate){ alert('此供應商尚未設定樣板'); return; }
  if(vendorTemplate.tolerance!=null) document.getElementById('tol').value = vendorTemplate.tolerance;
  document.getElementById('tplStatus').textContent='已套用樣板（手動 ID）';
  localStorage.setItem('reconcile:lastSupplierId', id);
}
