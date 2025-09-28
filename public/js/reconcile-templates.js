// reconcile-templates.js — Full features (fixed)
import { db, auth } from '/js/firebase.js';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const $ = sel => document.querySelector(sel);
const nf = new Intl.NumberFormat('zh-TW', {minimumFractionDigits:2, maximumFractionDigits:2});

function parseNumber(x){
  if(x==null) return NaN;
  if(typeof x === 'number') return x;
  const s = String(x).replace(/[, \u3000]/g,'').replace(/[^0-9.\-]/g,'');
  const v = parseFloat(s);
  return isNaN(v)? NaN : v;
}
function cleanText(s){
  return String(s||'').trim().replace(/[\u3000\s]+/g,' ').replace(/[\(（][^)）]*[\)）]/g,'').replace(/[*＊×xＸ]/g,'x');
}
function keyOf(s){
  return cleanText(s).toLowerCase().replace(/[^a-z0-9一-龥x\-/_,]/g,'');
}
function dice(a,b){
  a = keyOf(a); b = keyOf(b); if(!a||!b) return 0;
  if(a===b) return 1;
  const bigrams = s=>{const r=new Set(); for(let i=0;i<s.length-1;i++) r.add(s.slice(i,i+2)); return r}
  const A=bigrams(a), B=bigrams(b);
  let inter=0; A.forEach(x=>{ if(B.has(x)) inter++ });
  return (2*inter)/(A.size+B.size||1);
}
function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])) }

let posRows=[], venRows=[], runner=null, runnerProfile=null;
let vendorTemplate = null;
let __matchOK=[], __matchBAD=[];

// ===== iframe-safe init =====
window.onload = () => {
  const envBadge = $('#envBadge');
  try {
    if (window.self !== window.top) envBadge.textContent = 'Rabbithome iframe 模式';
    else envBadge.textContent = '獨立頁模式';
  } catch { envBadge.textContent = '獨立頁模式'; }

  bindEvents();

  onAuthStateChanged(auth, async user => {
    if (!user) {
      $('#runner').textContent = '未登入（僅本機試用）';
      return;
    }
    runner = user;
    $('#runner').textContent = (user.displayName || user.email || user.uid);
    try {
      const p = await getDoc(doc(db, 'profiles', user.uid));
      if (p.exists()) {
        runnerProfile = p.data();
        const nick = runnerProfile.nickname || runnerProfile.nick || runnerProfile.name;
        if (nick) $('#runner').textContent = `${nick}（${user.email||user.uid}）`;
      }
    } catch {}
  });
};

function bindEvents(){
  $('#btnExport').addEventListener('click', exportCSV);
  $('#loadPos').addEventListener('click', loadPosCSV);
  $('#runOcr').addEventListener('click', runOcrImages);
  $('#smartParse').addEventListener('click', smartParseVendor);
  $('#runMatch').addEventListener('click', runMatch);
  $('#btnSave').addEventListener('click', saveSummaryToFirestore);

  $('#btnApplyTpl').addEventListener('click', applyTemplateFromFirestore);
  $('#btnSaveTpl').addEventListener('click', saveTemplateToFirestore);
}

// ===== POS CSV =====
function loadPosCSV(){
  const f = $('#posFile').files[0];
  if(!f){ alert('請先選擇 POS CSV 檔'); return }
  Papa.parse(f, { header:true, skipEmptyLines:true, complete: res => {
    const rows = res.data;
    if(!rows.length){ alert('CSV 無資料'); return }
    const cols = Object.keys(rows[0]);
    for(const id of ['posColItem','posColQty','posColPrice','posColSub','posColVendor']){
      const sel = document.getElementById(id); sel.innerHTML='';
      cols.forEach(c=>{ const opt=document.createElement('option'); opt.value=c; opt.textContent=c; sel.appendChild(opt) });
    }
    $('#posMap').style.display='flex';
    const guess = (keys, cands)=> keys.find(k=> cands.some(c=> k.toLowerCase().includes(c)));
    const kset = cols.map(c=>c);
    $('#posColItem').value = guess(kset, ['品','名','型號','品名','名稱','商品','描述','品項']) || cols[0];
    $('#posColQty').value  = guess(kset, ['數量','qty']) || cols[1];
    $('#posColPrice').value= guess(kset, ['單價','價格','price']) || cols[2];
    $('#posColSub').value  = guess(kset, ['小計','金額','總額','合計','total','amount']) || cols[3];
    $('#posColVendor').value= guess(kset, ['廠商','供應','vendor']) || cols[4] || cols[0];

    $('#applyPosMap').onclick = () => {
      const ci=$('#posColItem').value, cq=$('#posColQty').value, cp=$('#posColPrice').value, cs=$('#posColSub').value, cv=$('#posColVendor').value;
      posRows = rows.map(r=>({
        item: cleanText(r[ci]),
        qty: parseNumber(r[cq]),
        price: parseNumber(r[cp]),
        sub: parseNumber(r[cs]),
        vendor: cleanText(r[cv])
      })).filter(r=> r.item);
      renderTable('#posTable', ['品名','數量','單價','小計','廠商'], posRows, ['item','qty','price','sub','vendor']);
      updateKPI();
    }
  }})
}

function renderTable(sel, headers, rows, keys, editable=false){
  const thead = document.querySelector(sel+' thead');
  const tbody = document.querySelector(sel+' tbody');
  thead.innerHTML = '<tr>'+ headers.map(h=>`<th>${h}</th>`).join('') + '</tr>';
  tbody.innerHTML = rows.map((r,i)=> '<tr>'+ keys.map(k=>{
    const v = (r[k]??'');
    const cell = (typeof v === 'number' && isFinite(v)) ? nf.format(v) : String(v);
    return `<td ${editable?`contenteditable data-row="${i}" data-key="${k}"`:''}>${cell}</td>`;
  }).join('') + '</tr>').join('');
  if(editable){
    tbody.querySelectorAll('[contenteditable]').forEach(td=>{
      td.addEventListener('blur', e=>{
        const i = +td.dataset.row, k = td.dataset.key;
        let val = td.textContent.trim();
        if(['qty','price','sub'].includes(k)) val = parseNumber(val);
        venRows[i][k] = val;
        updateKPI();
      })
    })
  }
}

// ===== OCR Vendor =====
async function ocrImages(files){
  const worker = await Tesseract.createWorker('eng+chi_tra');
  const out = [];
  for(let i=0;i<files.length;i++){
    const f = files[i];
    $('#ocrStatus').textContent = `辨識中 ${i+1}/${files.length}：${f.name}`;
    const { data } = await worker.recognize(f); // fixed: no rectangle:null
    out.push(data.text);
    const p = Math.round(((i+1)/files.length)*100);
    $('#ocrBar').style.width = p+'%';
  }
  await worker.terminate();
  $('#ocrStatus').textContent = '完成';
  return out;
}

async function runOcrImages(){
  const fs = $('#imgFiles').files;
  if(!fs.length){ alert('請先選擇圖片'); return }
  // Guard: not supporting PDF directly
  for(const f of fs){
    if(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')){
      alert('目前不支援直接辨識 PDF，請把 PDF 轉成 PNG/JPG 再上傳。');
      return;
    }
  }
  try{
    const texts = await ocrImages(fs);
    window.__rawVendorText = texts.join('\\n');
    venRows = [];
    renderTable('#venTable', ['品名','數量','單價','小計'], venRows, ['item','qty','price','sub'], true);
  }catch(err){
    console.error(err);
    alert('OCR 失敗：' + (err && err.message ? err.message : err));
  }
}

// ===== Templates =====
async function applyTemplateFromFirestore(){
  const name = ($('#vendorName').value || '').trim();
  if(!name){ alert('請先輸入廠商名稱'); return }
  try{
    const ref = doc(db, 'vendor_templates', name);
    const snap = await getDoc(ref);
    if(!snap.exists()){
      vendorTemplate = null;
      $('#tplStatus').textContent = `找不到模板（${name}），請解析後按「儲存模板」`; 
      return;
    }
    vendorTemplate = snap.data();
    $('#tplStatus').textContent = `已套用模板：${name}`;
    if (vendorTemplate.tolerance != null) {
      $('#tol').value = vendorTemplate.tolerance;
    }
  }catch(err){
    console.error(err);
    alert('讀取模板失敗：' + err.message);
  }
}

async function saveTemplateToFirestore(){
  const name = ($('#vendorName').value || '').trim();
  if(!name){ alert('請先輸入廠商名稱'); return }
  const payload = {
    vendorName: name,
    parseMode: (vendorTemplate?.parseMode || 'tail-sub-v2'),
    stripLines: vendorTemplate?.stripLines || [],
    qtyHintWords: vendorTemplate?.qtyHintWords || ['數量','Qty'],
    priceHintWords: vendorTemplate?.priceHintWords || ['單價','Price'],
    subHintWords: vendorTemplate?.subHintWords || ['金額','小計','Amount'],
    aliases: vendorTemplate?.aliases || {},
    tolerance: parseNumber($('#tol').value) || 1.0,
    updatedAt: serverTimestamp(),
    updatedBy: { uid: runner?.uid || null, nickname: (runnerProfile?.nickname||null) }
  };
  try{
    await setDoc(doc(db, 'vendor_templates', name), payload, { merge:true });
    vendorTemplate = payload;
    $('#tplStatus').textContent = `已儲存模板：${name}`;
    alert('模板已儲存');
  }catch(err){
    console.error(err);
    alert('儲存模板失敗：' + err.message);
  }
}

// ===== Smart Parse with Template =====
function smartParseVendor(){
  let text = window.__rawVendorText || '';
  if(!text){ alert('尚未有 OCR 結果'); return }

  if (vendorTemplate?.stripLines?.length){
    const strips = vendorTemplate.stripLines.map(s=>s.trim()).filter(Boolean);
    const lines = text.split(/\n+/);
    const kept = lines.filter(ln => !strips.some(s => ln.includes(s)));
    text = kept.join('\n');
  }

  const lines = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const rows=[];
  for(const ln of lines){
    const nums = [...ln.matchAll(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?/g)].map(m=>m[0]);
    if(nums.length>=2){
      const maybeSub = parseNumber(nums.at(-1));
      const maybePrice = parseNumber(nums.at(-2));
      let qty = NaN;
      for(let i=nums.length-3;i>=0;i--){ const v = parseNumber(nums[i]); if(Number.isInteger(v)){ qty=v; break } }
      let cutIdx = ln.lastIndexOf(nums.at(-1));
      let head = ln.slice(0, cutIdx);
      if(nums.length>=2){
        const idx2 = head.lastIndexOf(nums.at(-2));
        if(idx2>0) head = head.slice(0, idx2);
      }
      head = head.replace(/[\s\t]+$/,'');
      let item = cleanText(head);

      if (vendorTemplate?.aliases && vendorTemplate.aliases[item]) {
        item = vendorTemplate.aliases[item];
      }

      if(item && !isNaN(maybeSub)){
        rows.push({ item, qty: isNaN(qty)?1:qty, price: isNaN(maybePrice)? NaN: maybePrice, sub: maybeSub });
      }
    }
  }
  if(!rows.length){ alert('解析失敗：請確認圖片清晰或手動編輯表格'); }
  venRows = rows;
  renderTable('#venTable', ['品名','數量','單價','小計'], venRows, ['item','qty','price','sub'], true);
  updateKPI();
}

function sumSub(rows){ return rows.reduce((a,b)=> a + (isFinite(b.sub)? b.sub : (isFinite(b.qty)&&isFinite(b.price)? b.qty*b.price : 0)), 0) }
function updateKPI(){
  $('#kPos').textContent = posRows.length? nf.format(sumSub(posRows)) : '–';
  $('#kVen').textContent = venRows.length? nf.format(sumSub(venRows)) : '–';
  if(posRows.length||venRows.length){
    const diff = sumSub(posRows) - sumSub(venRows);
    $('#kDiff').textContent = nf.format(diff);
  } else $('#kDiff').textContent = '–';
}

function runMatch(){
  const tol = parseNumber($('#tol').value)||0;
  const usedVen = new Set();
  const oks=[], bads=[];

  for(const p of posRows){
    const k = keyOf(p.item);
    let bestIdx=-1, bestScore=0;
    for(let i=0;i<venRows.length;i++){
      if(usedVen.has(i)) continue;
      const v = venRows[i];
      const score = (keyOf(v.item)===k) ? 1 : dice(p.item, v.item);
      if(score>bestScore){ bestScore=score; bestIdx=i }
    }
    if(bestIdx>=0 && bestScore>=0.55){
      const v = venRows[bestIdx];
      usedVen.add(bestIdx);
      const pSub = isFinite(p.sub)? p.sub : (p.qty||0)*(p.price||0);
      const vSub = isFinite(v.sub)? v.sub : (v.qty||0)*(v.price||0);
      const gap = pSub - vSub;
      if(Math.abs(gap) <= tol){
        oks.push({ pos:p, ven:v, score:bestScore, gap });
      } else {
        bads.push({ pos:p, ven:v, score:bestScore, gap });
      }
    } else {
      bads.push({ pos:p, ven:null, score:bestScore, gap:NaN });
    }
  }
  venRows.forEach((v,i)=>{ if(!usedVen.has(i)) bads.push({ pos:null, ven:v, score:0, gap:NaN }) });

  renderCompare('#tblOK', oks, true);
  renderCompare('#tblBad', bads, false);

  __matchOK = oks;
  __matchBAD = bads;

  $('#kMatch').textContent = String(oks.length);
}

function renderCompare(sel, arr, isOK){
  const thead = document.querySelector(sel+' thead');
  const tbody = document.querySelector(sel+' tbody');
  thead.innerHTML = `<tr>
    <th class="nowrap">POS 品名</th><th>數量</th><th>小計</th>
    <th></th>
    <th class="nowrap">廠商 品名</th><th>數量</th><th>小計</th>
    <th class="nowrap">差額</th><th>相似度</th></tr>`;
  tbody.innerHTML = arr.map(r=>{
    const p = r.pos, v = r.ven;
    const pSub = p? (isFinite(p.sub)?p.sub:(p.qty||0)*(p.price||0)) : NaN;
    const vSub = v? (isFinite(v.sub)?v.sub:(v.qty||0)*(v.price||0)) : NaN;
    const gap = (isFinite(pSub)&&isFinite(vSub))? (pSub - vSub) : NaN;
    const pill = isOK? '<span class="pill ok">OK</span>' : '<span class="pill bad">Check</span>';
    return `<tr>
      <td>${p?escapeHtml(p.item):'<span class="small">—</span>'}</td>
      <td>${p&&isFinite(p.qty)? nf.format(p.qty):'<span class="small">—</span>'}</td>
      <td>${p&&isFinite(pSub)? nf.format(pSub):'<span class="small">—</span>'}</td>
      <td>${pill}</td>
      <td>${v?escapeHtml(v.item):'<span class="small">—</span>'}</td>
      <td>${v&&isFinite(v.qty)? nf.format(v.qty):'<span class="small">—</span>'}</td>
      <td>${v&&isFinite(vSub)? nf.format(vSub):'<span class="small">—</span>'}</td>
      <td>${isFinite(gap)? nf.format(gap):'<span class="small">—</span>'}</td>
      <td>${r.score? r.score.toFixed(2): '0.00'}</td>
    </tr>`;
  }).join('');
}

// ===== Export CSV =====
function exportCSV(){
  const rows=[];
  const tol = parseNumber($('#tol').value)||0;
  const usedVen = new Set();
  for(const p of posRows){
    let bestIdx=-1, bestScore=0;
    for(let i=0;i<venRows.length;i++){
      if(usedVen.has(i)) continue;
      const v = venRows[i];
      const score = (keyOf(v.item)===keyOf(p.item)) ? 1 : dice(p.item, v.item);
      if(score>bestScore){ bestScore=score; bestIdx=i }
    }
    if(bestIdx>=0 && bestScore>=0.55){
      const v = venRows[bestIdx]; usedVen.add(bestIdx);
      const pSub = isFinite(p.sub)? p.sub : (p.qty||0)*(p.price||0);
      const vSub = isFinite(v.sub)? v.sub : (v.qty||0)*(v.price||0);
      const gap = pSub - vSub;
      rows.push({
        類型: Math.abs(gap)<=tol? 'OK':'金額不符',
        POS品名:p.item, POS數量:p.qty||'', POS小計:pSub,
        廠商品名:v.item, 廠商數量:v.qty||'', 廠商小計:vSub,
        差額: gap.toFixed(2), 相似度: bestScore.toFixed(2)
      });
    } else {
      rows.push({ 類型:'POS未配對', POS品名:p.item, POS數量:p.qty||'', POS小計:(isFinite(p.sub)?p.sub:(p.qty||0)*(p.price||0)), 廠商品名:'', 廠商數量:'', 廠商小計:'', 差額:'', 相似度:'' });
    }
  }
  venRows.forEach((v,i)=>{ if(!usedVen.has(i)) rows.push({ 類型:'廠商未配對', POS品名:'', POS數量:'', POS小計:'', 廠商品名:v.item, 廠商數量:v.qty||'', 廠商小計:(isFinite(v.sub)?v.sub:(v.qty||0)*(v.price||0)), 差額:'', 相似度:'0.00' }) });

  const csv = Papa.unparse(rows);
  const blob = new Blob(["\uFEFF"+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='reconcile_diff.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
}

// ===== Save Summary =====
async function saveSummaryToFirestore(){
  const btn = $('#btnSave');
  btn.disabled = true;
  try {
    if (!db) throw new Error('Firebase 尚未就緒或 /js/firebase.js 未載入');
    const payload = {
      ranAt: serverTimestamp(),
      runnerUid: runner?.uid || null,
      runnerEmail: runner?.email || null,
      runnerName: runner?.displayName || null,
      runnerNickname: (runnerProfile?.nickname || runnerProfile?.nick || null),
      vendorName: ($('#vendorName').value || '').trim() || null,
      posTotal: sumSub(posRows),
      vendorTotal: sumSub(venRows),
      diffTotal: sumSub(posRows) - sumSub(venRows),
      okCount: (__matchOK||[]).length || 0,
      badCount: (__matchBAD||[]).length || 0,
      tplUsed: vendorTemplate ? true : false,
      tplSnapshot: vendorTemplate || null,
    };
    const ref = await addDoc(collection(db, 'reconciliations'), payload);
    alert('已儲存摘要至 Firestore：' + ref.id);
  } catch (err){
    console.error(err);
    alert('儲存失敗：' + err.message);
  } finally {
    btn.disabled = false;
  }
}