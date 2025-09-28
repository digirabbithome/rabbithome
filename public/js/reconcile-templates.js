// Compare + Groups: 逐品項 / 逐貨單 兩種對帳模式 + 模板 + 強化解析
import { db, auth } from '/js/firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const $=sel=>document.querySelector(sel);
const nf=new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});

function parseNumber(x){ if(x==null) return NaN; if(typeof x==='number') return x; const s=String(x).replace(/[, \u3000]/g,'').replace(/[^0-9.\-]/g,''); const v=parseFloat(s); return isNaN(v)?NaN:v; }
function cleanText(s){ return String(s||'').trim().replace(/[\u3000\s]+/g,' ').replace(/[\(（][^)）]*[\)）]/g,'').replace(/[*＊×xＸ]/g,'x'); }
function keyOf(s){ return cleanText(s).toLowerCase().replace(/[^a-z0-9一-龥x\-/_,]/g,''); }
function dice(a,b){ a=keyOf(a); b=keyOf(b); if(!a||!b) return 0; if(a===b) return 1; const big=s=>{const r=new Set(); for(let i=0;i<s.length-1;i++) r.add(s.slice(i,i+2)); return r}; const A=big(a),B=big(b); let inter=0; A.forEach(x=>{if(B.has(x)) inter++}); return (2*inter)/(A.size+B.size||1); }

let posRows=[], venRows=[], showPosSimple=true, compareMode='items'; // 'items' 或 'orders'
let vendorTemplate=null, runner=null;
let vendorGroups=[]; // [{date, orderNo, rows:[{item,qty,price,sub}]}]

window.onload=()=>{
  $('#loadPos').onclick=loadPosCSV;
  $('#applyPosMap').onclick=applyPosMap;
  $('#togglePosView').onchange=e=>{ showPosSimple=e.target.checked; renderPosTable(); };
  document.querySelectorAll('input[name="compareMode"]').forEach(r=> r.onchange = e=>{ compareMode=e.target.value; updateModeHint(); });
  $('#runOcr').onclick=runOcrImages;
  $('#smartParse').onclick=smartParseVendor;
  $('#runMatch').onclick=runMatch;
  $('#btnApplyTpl').onclick=applyTemplateFromFirestore;
  $('#btnSaveTpl').onclick=saveTemplateToFirestore;
  onAuthStateChanged(auth, u=> $('#runner').textContent = u ? (u.displayName||u.email||u.uid) : '未登入（僅本機）');
  updateModeHint();
};

function updateModeHint(){
  const hint = (compareMode==='orders')
    ? '目前以「貨單（日期＋貨單編號）」為單位比對：每筆貨單金額＝該區段小計總和'
    : '目前以「品項」為單位比對：逐筆比對 POS 與廠商明細';
  $('#modeHint').textContent = hint;
}

// POS CSV
let RawPos=[], PosCols=[];
function loadPosCSV(){
  const f=$('#posFile').files[0]; if(!f){ alert('請先選擇 POS CSV'); return }
  Papa.parse(f,{header:true,skipEmptyLines:true,complete:res=>{
    RawPos=res.data; if(!RawPos.length){ alert('CSV 無資料'); return }
    PosCols=Object.keys(RawPos[0]||{});
    for(const id of ['posColItem','posColQty','posColPrice','posColSub','posColVendor','posColDate','posColOrder']){
      const sel=document.getElementById(id); sel.innerHTML=''; PosCols.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
      const optEmpty=document.createElement('option'); optEmpty.value=''; optEmpty.textContent='（無）'; sel.insertBefore(optEmpty, sel.firstChild);
    }
    const guess=(keys,cands)=>keys.find(k=>cands.some(c=>k.toLowerCase().includes(c)));
    $('#posColItem').value  = guess(PosCols,['品','型號','名稱','商品','描述','品項']) || '';
    $('#posColQty').value   = guess(PosCols,['數量','qty']) || '';
    $('#posColPrice').value = guess(PosCols,['單價','價格','price']) || '';
    $('#posColSub').value   = guess(PosCols,['小計','金額','合計','total','amount']) || '';
    $('#posColVendor').value= guess(PosCols,['廠商','供應','vendor']) || '';
    $('#posColDate').value  = guess(PosCols,['日期','採購','結算','入庫']) || '';
    $('#posColOrder').value = guess(PosCols,['貨單','單號','發票','單據','單號碼','編號']) || '';
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
  })).filter(r=> (r.item || isFinite(r.sub) || r.order));
  renderPosTable(); updateTotals();
}
function renderPosTable(){
  const thead=$('#posTable thead'), tbody=$('#posTable tbody');
  if(showPosSimple){
    thead.innerHTML='<tr><th>日期</th><th>廠商</th><th>貨單編號</th><th>金額</th></tr>';
    tbody.innerHTML=posRows.map(r=>`<tr><td>${r.date||''}</td><td>${r.vendor||''}</td><td>${r.order||''}</td><td>${isFinite(r.sub)?nf.format(r.sub):(isFinite(r.qty)&&isFinite(r.price)?nf.format(r.qty*r.price):'')}</td></tr>`).join('');
  }else{
    thead.innerHTML='<tr><th>日期</th><th>廠商</th><th>貨單編號</th><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
    tbody.innerHTML=posRows.map(r=>`<tr><td>${r.date||''}</td><td>${r.vendor||''}</td><td>${r.order||''}</td><td>${r.item}</td><td>${isFinite(r.qty)?nf.format(r.qty):''}</td><td>${isFinite(r.price)?nf.format(r.price):''}</td><td>${isFinite(r.sub)?nf.format(r.sub):(isFinite(r.qty)&&isFinite(r.price)?nf.format(r.qty*r.price):'')}</td></tr>`).join('');
  }
  $('#posSum').textContent = nf.format(sumPos());
}
function sumPos(){ return posRows.reduce((a,b)=> a + (isFinite(b.sub)?b.sub: (isFinite(b.qty)&&isFinite(b.price)? b.qty*b.price:0)), 0) }

// Vendor OCR + Parse with grouping
async function ocrImages(files){
  const worker=await Tesseract.createWorker('eng+chi_tra');
  const out=[];
  for(let i=0;i<files.length;i++){
    const f=files[i];
    $('#ocrStatus').textContent=`辨識中 ${i+1}/${files.length}：${f.name}`;
    const {data}=await worker.recognize(f);
    out.push(data.text);
    $('#ocrBar').style.width=Math.round(((i+1)/fs.length)*100)+'%';
  }
  await worker.terminate();
  $('#ocrStatus').textContent='完成';
  return out;
}
async function runOcrImages(){
  const fs=$('#imgFiles').files;
  if(!fs.length){ alert('請先選擇圖片'); return }
  for(const f of fs){ if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){ alert('請將 PDF 轉成 PNG/JPG 再上傳'); return; } }
  const texts = await ocrImages(fs);
  window.__venText = texts.join('\n');
  $('#venTable thead').innerHTML='<tr><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
  $('#venTable tbody').innerHTML='';
}

function isDateToken(tok){
  tok = tok.replace(/[^\d\/\.\-]/g,'');
  return /^(\d{2,4})[\/\.\-]\d{1,2}[\/\.\-]\d{1,2}$/.test(tok);
}
function findLongNumber(s){
  const digits = s.replace(/\D/g,'');
  const m = digits.match(/(\d{8,14})/);
  return m? m[1] : null;
}

function smartParseVendor(){
  let text = window.__venText || '';
  if(!text){ alert('尚未有 OCR 結果'); return }

  const stripWords = new Set([
    '客戶對帳單','TEL','FAX','電話','傳真','地址','統一編號','統編',
    '客戶編號','客戶名稱','日期區間','頁',
    '本期合計','本期折讓','營業稅','前期應收','本期已收','預收款','本期應收款','總計','備註','收款方式'
  ]);
  const raw = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const lines = raw.filter(ln=> ![...stripWords].some(w=> w && ln.includes(w)));

  // 找 header（日期 + 貨單編號）
  const headers=[];
  for(let i=0;i<lines.length;i++){
    const ln=lines[i];
    const tokens=ln.split(/\s+/);
    const hasDate=tokens.some(isDateToken);
    const orderNo=findLongNumber(ln);
    if(hasDate && orderNo) headers.push({idx:i, date:tokens.find(isDateToken), orderNo});
  }

  vendorGroups=[];
  for(let h=0; h<headers.length; h++){
    const start=headers[h].idx+1;
    const end=(h+1<headers.length)? headers[h+1].idx : lines.length;
    const rows=[];
    for(let i=start;i<end;i++){
      const ln0=lines[i].replace(/[|│—–\-]+/g,' ').trim();
      if(!ln0) continue;
      const nums=[...ln0.matchAll(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?/g)].map(m=>m[0]);
      if(nums.length<2) continue;
      let head=ln0.slice(0, ln0.lastIndexOf(nums.at(-1)));
      if(nums.length>=2){ const idx2=head.lastIndexOf(nums.at(-2)); if(idx2>0) head=head.slice(0,idx2); }
      let item=cleanText(head); if(!item || /^\d+(\.\d+)?$/.test(item)) continue;
      const sub=parseNumber(nums.at(-1));
      const price=parseNumber(nums.at(-2));
      let qty=NaN; for(let k=nums.length-3;k>=0;k--){ const v=parseNumber(nums[k]); if(Number.isInteger(v)){ qty=v; break } }
      rows.push({ item, qty:isNaN(qty)?1:qty, price:isNaN(price)?NaN:price, sub });
    }
    vendorGroups.push({ date: headers[h].date, orderNo: headers[h].orderNo, rows });
  }

  venRows = vendorGroups.flatMap(g=> g.rows);
  renderVendorGroupedTable();
  updateTotals();
}

function renderVendorGroupedTable(){
  const thead=$('#venTable thead'), tbody=$('#venTable tbody');
  thead.innerHTML='<tr><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
  const html=[];
  for(const g of vendorGroups){
    const sum = g.rows.reduce((a,b)=> a + (isFinite(b.sub)?b.sub : (isFinite(b.qty)&&isFinite(b.price)? b.qty*b.price:0)), 0);
    html.push(`<tr class="groupRow"><td colspan="4">貨單：${g.date || ''}　#${g.orderNo || ''}　<span class="small">小計合計：${nf.format(sum)}</span></td></tr>`);
    html.push(...g.rows.map(r=> `<tr><td>${r.item}</td><td>${isFinite(r.qty)?nf.format(r.qty):''}</td><td>${isFinite(r.price)?nf.format(r.price):''}</td><td>${isFinite(r.sub)?nf.format(r.sub):''}</td></tr>`));
  }
  tbody.innerHTML = html.join('');
  const total = venRows.reduce((a,b)=> a + (isFinite(b.sub)?b.sub:(isFinite(b.qty)&&isFinite(b.price)?b.qty*b.price:0)), 0);
  $('#venSum').textContent = nf.format(total);
}

// Templates
async function applyTemplateFromFirestore(){
  const name = ($('#vendorName').value || '').trim();
  if(!name){ alert('請先輸入廠商名稱'); return }
  const snap = await getDoc(doc(db,'vendor_templates', name));
  if(!snap.exists()){ vendorTemplate=null; $('#tplStatus').textContent = `找不到模板（${name}）`; return; }
  vendorTemplate = snap.data(); $('#tplStatus').textContent = `已套用模板：${name}`;
  if(vendorTemplate.tolerance!=null) $('#tol').value = vendorTemplate.tolerance;
}
async function saveTemplateToFirestore(){
  const name = ($('#vendorName').value || '').trim();
  if(!name){ alert('請先輸入廠商名稱'); return }
  const payload={
    vendorName:name,
    stripLines: vendorTemplate?.stripLines || [],
    aliases: vendorTemplate?.aliases || {},
    tolerance: parseNumber($('#tol').value) || 1.0,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db,'vendor_templates', name), payload, {merge:true});
  vendorTemplate = payload; $('#tplStatus').textContent = `已儲存模板：${name}`;
}

// ===== Matching =====
function sumRow(r){ return isFinite(r.sub)? r.sub : (isFinite(r.qty)&&isFinite(r.price)? r.qty*r.price : 0); }

function runMatch(){
  if(compareMode==='orders'){ runMatchOrders(); return; }
  runMatchItems();
}

function runMatchItems(){
  const tol = parseNumber($('#tol').value)||0;
  const used=new Set(); const ok=[], bad=[];
  for(const p of posRows){
    let best=-1,score=0;
    for(let i=0;i<venRows.length;i++){
      if(used.has(i)) continue;
      const v=venRows[i];
      const s=(keyOf(v.item)===keyOf(p.item))?1: dice(p.item,v.item);
      if(s>score){ score=s; best=i; }
    }
    const pSub = sumRow(p);
    if(best>=0 && score>=0.55){
      const v=venRows[best]; used.add(best);
      const vSub = sumRow(v);
      const gap = pSub - vSub;
      (Math.abs(gap)<=tol? ok: bad).push({pos:p, ven:v, score, gap});
    }else{
      bad.push({pos:p, ven:null, score, gap:NaN});
    }
  }
  venRows.forEach((v,i)=>{ if(!used.has(i)) bad.push({pos:null, ven:v, score:0, gap:NaN}); });

  renderCompareRows('#tblOK', ok, true);
  renderCompareRows('#tblBad', bad, false);
  updateTotals();
}

function runMatchOrders(){
  const tol = parseNumber($('#tol').value)||0;

  // 1) 聚合 POS -> 按 (date, order?) 求和
  const posMap = new Map(); // key -> {date, order, total}
  for(const r of posRows){
    const key = `${r.date||''}|${r.order||''}`;
    const tot = sumRow(r);
    if(!posMap.has(key)) posMap.set(key, {date:r.date||'', order:r.order||'', total:0});
    posMap.get(key).total += isFinite(tot)? tot : 0;
  }
  const posOrders = [...posMap.values()];

  // 2) 聚合 Vendor -> 直接從 vendorGroups
  const venOrders = vendorGroups.map(g=> ({
    date: g.date || '',
    order: g.orderNo || '',
    total: g.rows.reduce((a,b)=> a + sumRow(b), 0)
  }));

  // 3) 配對：優先以單號精準匹配；若 POS 無單號，則用日期+金額（容忍內）匹配
  const used = new Set();
  const ok=[], bad=[];

  for(const p of posOrders){
    let matchIndex=-1, matchScore=-1;
    for(let i=0;i<venOrders.length;i++){
      if(used.has(i)) continue;
      const v=venOrders[i];
      let score = 0;
      if(p.order && v.order && p.order.replace(/\D/g,'')===v.order.replace(/\D/g,'')){
        score = 2; // 強匹配：單號相同
      }else if(p.date && v.date && p.date===v.date && Math.abs((p.total||0)-(v.total||0))<=tol){
        score = 1; // 次匹配：日期相同且金額落在容忍內
      }
      if(score>matchScore){ matchScore=score; matchIndex=i; }
    }
    if(matchIndex>=0 && matchScore>0){
      const v=venOrders[matchIndex]; used.add(matchIndex);
      const gap=(p.total||0)-(v.total||0);
      (Math.abs(gap)<=tol? ok: bad).push({
        posOrder:p, venOrder:v, method:(matchScore===2?'單號匹配':'日期+金額匹配'), gap
      });
    }else{
      bad.push({posOrder:p, venOrder:null, method:'未匹配', gap:NaN});
    }
  }
  venOrders.forEach((v,i)=>{ if(!used.has(i)) bad.push({posOrder:null, venOrder:v, method:'供應商多出', gap:NaN}); });

  renderCompareOrders('#tblOK', ok, true);
  renderCompareOrders('#tblBad', bad, false);
  updateTotals();
}

function renderCompareRows(sel, arr, ok){
  const thead=document.querySelector(sel+' thead');
  const tbody=document.querySelector(sel+' tbody');
  thead.innerHTML=`<tr>
    <th>POS 品名</th><th>數量</th><th>小計</th>
    <th></th>
    <th>廠商 品名</th><th>數量</th><th>小計</th>
    <th>差額</th><th>相似度</th>
  </tr>`;
  tbody.innerHTML = arr.map(r=>{
    const p=r.pos, v=r.ven;
    const pSub=sumRow(p), vSub=sumRow(v);
    const gap=(isFinite(pSub)&&isFinite(vSub))? (pSub - vSub): NaN;
    const pill = ok? '<span class="pill ok">OK</span>' : '<span class="pill bad">Check</span>';
    return `<tr>
      <td>${p?p.item:'—'}</td><td>${p&&isFinite(p.qty)?nf.format(p.qty):''}</td><td>${p&&isFinite(pSub)?nf.format(pSub):''}</td>
      <td>${pill}</td>
      <td>${v?v.item:'—'}</td><td>${v&&isFinite(v.qty)?nf.format(v.qty):''}</td><td>${v&&isFinite(vSub)?nf.format(vSub):''}</td>
      <td>${isFinite(gap)?nf.format(gap):''}</td><td>${r.score? r.score.toFixed(2): '—'}</td>
    </tr>`;
  }).join('');
}

function renderCompareOrders(sel, arr, ok){
  const thead=document.querySelector(sel+' thead');
  const tbody=document.querySelector(sel+' tbody');
  thead.innerHTML=`<tr>
    <th>POS 日期</th><th>POS 單號</th><th>POS 合計</th>
    <th></th>
    <th>廠商 日期</th><th>廠商 單號</th><th>廠商 合計</th>
    <th>差額</th><th>匹配方式</th>
  </tr>`;
  tbody.innerHTML = arr.map(r=>{
    const p=r.posOrder, v=r.venOrder;
    const gap=(p && v && isFinite(p.total) && isFinite(v.total)) ? (p.total - v.total) : NaN;
    const pill = ok? '<span class="pill ok">OK</span>' : '<span class="pill bad">Check</span>';
    return `<tr>
      <td>${p?p.date:'—'}</td><td>${p?p.order:'—'}</td><td>${p&&isFinite(p.total)?nf.format(p.total):''}</td>
      <td>${pill}</td>
      <td>${v?v.date:'—'}</td><td>${v?v.order:'—'}</td><td>${v&&isFinite(v.total)?nf.format(v.total):''}</td>
      <td>${isFinite(gap)?nf.format(gap):''}</td><td>${r.method||'—'}</td>
    </tr>`;
  }).join('');
}

function updateTotals(){
  const pos=sumPos(), ven=venRows.reduce((a,b)=> a + sumRow(b), 0), diff=pos-ven;
  $('#posSum').textContent=nf.format(pos);
  $('#venSum').textContent=nf.format(ven);
  $('#diffSum').textContent=nf.format(diff);
}