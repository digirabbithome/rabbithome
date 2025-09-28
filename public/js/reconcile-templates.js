// reconcile-templates.js — Compare版：保留POS簡化顯示選項 + 明細比對 + 差額 + 誰有誰沒有
import { db, auth } from '/js/firebase.js';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const $=sel=>document.querySelector(sel);
const nf=new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});

function parseNumber(x){ if(x==null) return NaN; if(typeof x==='number') return x; const s=String(x).replace(/[, \u3000]/g,'').replace(/[^0-9.\-]/g,''); const v=parseFloat(s); return isNaN(v)?NaN:v; }
function cleanText(s){ return String(s||'').trim().replace(/[\u3000\s]+/g,' ').replace(/[\(（][^)）]*[\)）]/g,'').replace(/[*＊×xＸ]/g,'x'); }
function keyOf(s){ return cleanText(s).toLowerCase().replace(/[^a-z0-9一-龥x\-/_,]/g,''); }
function dice(a,b){ a=keyOf(a); b=keyOf(b); if(!a||!b) return 0; if(a===b) return 1; const big=s=>{const r=new Set(); for(let i=0;i<s.length-1;i++) r.add(s.slice(i,i+2)); return r}; const A=big(a),B=big(b); let inter=0; A.forEach(x=>{if(B.has(x)) inter++}); return (2*inter)/(A.size+B.size||1); }

let posRows=[], venRows=[], showPosSimple=true;
let __matchOK=[], __matchBAD=[];

window.onload=()=>{
  $('#loadPos').onclick=loadPosCSV;
  $('#applyPosMap').onclick=applyPosMap;
  $('#togglePosView').onchange=e=>{ showPosSimple=e.target.checked; renderPosTable(); };
  $('#runOcr').onclick=runOcrImages;
  $('#smartParse').onclick=smartParseVendor;
  $('#runMatch').onclick=runMatch;
};

// ===== POS CSV（支援完整欄位，但可切換簡化顯示） =====
let RawPos=[], PosCols=[];
function loadPosCSV(){
  const f=$('#posFile').files[0]; if(!f){ alert('請先選擇 POS CSV'); return }
  Papa.parse(f,{header:true,skipEmptyLines:true,complete:res=>{
    RawPos=res.data; if(!RawPos.length){ alert('CSV 無資料'); return }
    PosCols=Object.keys(RawPos[0]||{});
    for(const id of ['posColItem','posColQty','posColPrice','posColSub','posColVendor','posColDate']){
      const sel=document.getElementById(id); sel.innerHTML=''; PosCols.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
    }
    const guess=(keys,cands)=>keys.find(k=>cands.some(c=>k.toLowerCase().includes(c)));
    $('#posColItem').value  = guess(PosCols,['品','型號','名稱','商品','描述','品項']) || PosCols[0];
    $('#posColQty').value   = guess(PosCols,['數量','qty']) || PosCols[1]||PosCols[0];
    $('#posColPrice').value = guess(PosCols,['單價','價格','price']) || PosCols[2]||PosCols[0];
    $('#posColSub').value   = guess(PosCols,['小計','金額','合計','total','amount']) || PosCols[3]||PosCols[0];
    $('#posColVendor').value= guess(PosCols,['廠商','供應','vendor']) || PosCols[4]||PosCols[0];
    $('#posColDate').value  = guess(PosCols,['日期','採購','結算','入庫']) || PosCols[5]||PosCols[0];
  }})
}
function applyPosMap(){
  if(!RawPos.length){ alert('請先讀取 CSV'); return }
  const ci=$('#posColItem').value, cq=$('#posColQty').value, cp=$('#posColPrice').value, cs=$('#posColSub').value, cv=$('#posColVendor').value, cd=$('#posColDate').value;
  posRows = RawPos.map(r=>({
    date: cleanText(r[cd]),
    vendor: cleanText(r[cv]),
    item: cleanText(r[ci]),
    qty: parseNumber(r[cq]),
    price: parseNumber(r[cp]),
    sub: parseNumber(r[cs])
  })).filter(r=> r.item || isFinite(r.sub));
  renderPosTable();
  updateTotals();
}
function renderPosTable(){
  const thead=$('#posTable thead'), tbody=$('#posTable tbody');
  if(showPosSimple){
    thead.innerHTML='<tr><th>日期</th><th>廠商</th><th>金額</th></tr>';
    tbody.innerHTML=posRows.map(r=>`<tr><td>${r.date||''}</td><td>${r.vendor||''}</td><td>${isFinite(r.sub)?nf.format(r.sub):(isFinite(r.qty)&&isFinite(r.price)?nf.format(r.qty*r.price):'')}</td></tr>`).join('');
  }else{
    thead.innerHTML='<tr><th>日期</th><th>廠商</th><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
    tbody.innerHTML=posRows.map(r=>`<tr><td>${r.date||''}</td><td>${r.vendor||''}</td><td>${r.item}</td><td>${isFinite(r.qty)?nf.format(r.qty):''}</td><td>${isFinite(r.price)?nf.format(r.price):''}</td><td>${isFinite(r.sub)?nf.format(r.sub):(isFinite(r.qty)&&isFinite(r.price)?nf.format(r.qty*r.price):'')}</td></tr>`).join('');
  }
  $('#posTotal').textContent = nf.format(sumPos());
}
function sumPos(){ return posRows.reduce((a,b)=> a + (isFinite(b.sub)?b.sub: (isFinite(b.qty)&&isFinite(b.price)? b.qty*b.price:0)), 0) }

// ===== Vendor OCR & Parse =====
async function ocrImages(files){
  const worker=await Tesseract.createWorker('eng+chi_tra');
  const out=[];
  for(let i=0;i<files.length;i++){
    const f=files[i];
    $('#ocrStatus').textContent=`辨識中 ${i+1}/${files.length}：${f.name}`;
    const {data}=await worker.recognize(f);
    out.push(data.text);
    $('#ocrBar').style.width=Math.round(((i+1)/files.length)*100)+'%';
  }
  await worker.terminate();
  $('#ocrStatus').textContent='完成';
  return out;
}
async function runOcrImages(){
  const fs=$('#imgFiles').files;
  if(!fs.length){ alert('請先選擇圖片'); return }
  for(const f of fs){ if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){ alert('請先把 PDF 轉成 PNG/JPG 再上傳。'); return; } }
  const texts = await ocrImages(fs);
  window.__venText = texts.join('\n');
  $('#venTable thead').innerHTML='<tr><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
  $('#venTable tbody').innerHTML='';
}
function smartParseVendor(){
  let text = window.__venText || '';
  if(!text){ alert('尚未有 OCR 結果'); return }
  const lines=text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const rows=[];
  for(const ln of lines){
    const nums=[...ln.matchAll(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?/g)].map(m=>m[0]);
    if(nums.length>=2){
      const maybeSub=parseNumber(nums.at(-1));
      const maybePrice=parseNumber(nums.at(-2));
      let qty=NaN; for(let i=nums.length-3;i>=0;i--){ const v=parseNumber(nums[i]); if(Number.isInteger(v)){ qty=v; break } }
      let head=ln.slice(0, ln.lastIndexOf(nums.at(-1))); if(nums.length>=2){ const idx2=head.lastIndexOf(nums.at(-2)); if(idx2>0) head=head.slice(0,idx2); }
      const item=cleanText(head);
      if(item && !isNaN(maybeSub)) rows.push({ item, qty:isNaN(qty)?1:qty, price:isNaN(maybePrice)?NaN:maybePrice, sub:maybeSub });
    }
  }
  venRows=rows;
  const thead=$('#venTable thead'), tbody=$('#venTable tbody');
  thead.innerHTML='<tr><th>品名</th><th>數量</th><th>單價</th><th>小計</th></tr>';
  tbody.innerHTML=rows.map(r=>`<tr><td>${r.item}</td><td>${isFinite(r.qty)?nf.format(r.qty):''}</td><td>${isFinite(r.price)?nf.format(r.price):''}</td><td>${isFinite(r.sub)?nf.format(r.sub):''}</td></tr>`).join('');
  $('#venTotal').textContent = nf.format(sumVen());
  updateTotals();
}
function sumVen(){ return venRows.reduce((a,b)=> a + (isFinite(b.sub)?b.sub:(isFinite(b.qty)&&isFinite(b.price)?b.qty*b.price:0)), 0) }

// ===== Matching & Diff =====
function runMatch(){
  const tol = parseNumber($('#tol').value)||0;
  const usedVen=new Set(); const oks=[], bads=[];
  for(const p of posRows){
    const k=keyOf(p.item);
    let bestIdx=-1, bestScore=0;
    for(let i=0;i<venRows.length;i++){
      if(usedVen.has(i)) continue;
      const v=venRows[i];
      const score=(keyOf(v.item)===k)?1:dice(p.item,v.item);
      if(score>bestScore){ bestScore=score; bestIdx=i; }
    }
    if(bestIdx>=0 && bestScore>=0.55){
      const v=venRows[bestIdx]; usedVen.add(bestIdx);
      const pSub=isFinite(p.sub)?p.sub:(p.qty||0)*(p.price||0);
      const vSub=isFinite(v.sub)?v.sub:(v.qty||0)*(v.price||0);
      const gap=pSub - vSub;
      if(Math.abs(gap)<=tol) oks.push({pos:p,ven:v,score:bestScore,gap});
      else bads.push({pos:p,ven:v,score:bestScore,gap});
    }else{
      bads.push({pos:p,ven:null,score:bestScore,gap:NaN});
    }
  }
  venRows.forEach((v,i)=>{ if(!usedVen.has(i)) bads.push({pos:null,ven:v,score:0,gap:NaN}); });
  __matchOK=oks; __matchBAD=bads;
  renderCompare('#tblOK', oks, true);
  renderCompare('#tblBad', bads, false);
  updateTotals();
}
function renderCompare(sel, arr, ok){
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
    const pSub=p? (isFinite(p.sub)?p.sub:(p.qty||0)*(p.price||0)) : NaN;
    const vSub=v? (isFinite(v.sub)?v.sub:(v.qty||0)*(v.price||0)) : NaN;
    const gap = (isFinite(pSub)&&isFinite(vSub))? (pSub - vSub) : NaN;
    const pill = ok? '<span class="pill ok">OK</span>' : '<span class="pill bad">Check</span>';
    return `<tr>
      <td>${p?p.item:'—'}</td><td>${p&&isFinite(p.qty)?nf.format(p.qty):''}</td><td>${p&&isFinite(pSub)?nf.format(pSub):''}</td>
      <td>${pill}</td>
      <td>${v?v.item:'—'}</td><td>${v&&isFinite(v.qty)?nf.format(v.qty):''}</td><td>${v&&isFinite(vSub)?nf.format(vSub):''}</td>
      <td>${isFinite(gap)?nf.format(gap):''}</td><td>${r.score? r.score.toFixed(2): '0.00'}</td>
    </tr>`;
  }).join('');
}

// Totals & diff
function updateTotals(){
  const pos=sumPos(), ven=sumVen(), diff=pos-ven;
  $('#posTotal').textContent=nf.format(pos);
  $('#venTotal').textContent=nf.format(ven);
  $('#diffTotal').textContent=nf.format(diff);
}