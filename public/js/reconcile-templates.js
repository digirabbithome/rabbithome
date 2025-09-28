
// v4: 嚴格過濾 + 算式驗證（qty*price≈sub）+ 更穩定的 header 偵測
import { auth } from '/js/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const $=sel=>document.querySelector(sel);
const nf=new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});

function parseNumber(x){
  if(x==null) return NaN;
  if(typeof x==='number') return x;
  let s=String(x).trim();
  // 常見OCR：把逗號點混亂或多餘空格
  s=s.replace(/[,\s]/g,'');
  // 只留數字與小數點與負號
  s=s.replace(/[^0-9.\-]/g,'');
  // 防止 "3006000" 這類異常大數：交給上層用運算驗證過濾
  const v=parseFloat(s);
  return isNaN(v)?NaN:v;
}
function cleanText(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function keyOf(s){ return cleanText(s).toLowerCase().replace(/[^a-z0-9一-龥x\-/_,]/g,''); }

let posRows=[], venRows=[], showPosSimple=true;
let vendorGroups=[]; // [{date, orderNo, rows:[{item,qty,price,sub}]}]

window.onload=()=>{
  $('#loadPos').onclick=loadPosCSV;
  $('#applyPosMap').onclick=applyPosMap;
  $('#togglePosView').onchange=e=>{ showPosSimple=e.target.checked; renderPosTable(); };
  document.querySelectorAll('input[name="compareMode"]').forEach(r=> r.onchange = e=>{});
  $('#runOcr').onclick=runOcrImages;
  $('#smartParse').onclick=smartParseVendor;
  $('#runMatch').onclick=runMatch;
  onAuthStateChanged(auth, u=> $('#runner').textContent = u ? (u.displayName||u.email||u.uid) : '未登入（僅本機）');
};

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
    $('#ocrBar').style.width=Math.round(((i+1)/files.length)*100)+'%';
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

// Header detection helpers
function isDateToken(tok){
  tok = tok.replace(/^[^\d]+/, '').replace(/[^\d\/\.\-]/g,'');
  return /^(\d{2,4})[\/\.\-]\d{1,2}[\/\.\-]\d{1,2}$/.test(tok);
}
function findLongNumber(s){
  const digits = s.replace(/\D/g,'');
  // 取最後一組 8~14 位數（避免前面地址號碼或電話干擾）
  const m = digits.match(/(\d{8,14})\d*$/);
  return m? m[1] : null;
}

// Vendor smart parse with arithmetic validation
function smartParseVendor(){
  let text = window.__venText || '';
  if(!text){ alert('尚未有 OCR 結果'); return }

  const stripWords = new Set([
    '客戶對帳單','TEL','FAX','電話','傳真','地址','統一編號','統編',
    '客戶編號','客戶名稱','日期區間','頁','台 北市','大 同 區','民權 西 路',
    '本期合計','本期折讓','營業稅','前期應收','本期已收','預收款','本期應收款','總計','備註','收款方式'
  ]);

  const raw = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const lines = raw.filter(ln=> ![...stripWords].some(w=> w && ln.includes(w)));

  // headers: 日期 + 貨單編號
  const headers=[];
  for(let i=0;i<lines.length;i++){
    const ln=lines[i];
    const tokens=ln.split(/\s+/);
    const hasDate=tokens.some(isDateToken);
    const orderNo=findLongNumber(ln);
    if(hasDate && orderNo){
      const dateTok = tokens.find(isDateToken).replace(/[^\d\/\.\-]/g,'');
      headers.push({idx:i, date:dateTok, orderNo});
    }
  }

  vendorGroups=[];
  const tol = parseNumber($('#tol')?.value) || 3; // 算式驗證用容忍
  for(let h=0; h<headers.length; h++){
    const start=headers[h].idx+1;
    const end=(h+1<headers.length)? headers[h+1].idx : lines.length;
    const rows=[];
    for(let i=start;i<end;i++){
      const ln0=lines[i].replace(/[|│—–\-]+/g,' ').trim();
      if(!ln0) continue;

      // 1) 至少兩個數字
      const nums=[...ln0.matchAll(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?/g)].map(m=>m[0]);
      if(nums.length<2) continue;

      // 2) 嘗試從右往左挑 (price, sub) + 往前找整數 qty，並做 qty*price≈sub 驗證
      let accepted=null;
      for(let p2=nums.length-1; p2>=1; p2--){
        const sub=parseNumber(nums[p2]);
        const price=parseNumber(nums[p2-1]);
        if(!Number.isFinite(sub)) continue;
        // 找 qty：在 p2-2 ~ 0 範圍內找最右的整數
        let qty=NaN, qIdx=-1;
        for(let k=p2-2; k>=0; k--){
          const v=parseNumber(nums[k]);
          if(Number.isInteger(v) && v>=0 && v<10000){ qty=v; qIdx=k; break; }
        }
        const est = (Number.isFinite(qty)&&Number.isFinite(price)) ? qty*price : NaN;
        const ok = Number.isFinite(est) ? Math.abs(est - sub) <= tol : false;
        if(ok){
          // item = 切掉最後兩個數字（以及 qty 落點之後）
          let head=ln0;
          // 切 sub
          const idxSub=head.lastIndexOf(nums[p2]); head = idxSub>0? head.slice(0,idxSub): head;
          // 切 price
          const idxPrice=head.lastIndexOf(nums[p2-1]); head = idxPrice>0? head.slice(0,idxPrice): head;
          // 盡量切到 qty 之後
          if(qIdx>=0){
            const idxQty=head.lastIndexOf(nums[qIdx]);
            if(idxQty>0) head = head.slice(0, idxQty);
          }
          const item=cleanText(head);
          if(item && !/^\d+(\.\d+)?$/.test(item)){
            accepted = {item, qty, price, sub};
            break;
          }
        }
      }
      if(accepted){
        rows.push(accepted);
      }
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
    const sum = g.rows.reduce((a,b)=> a + sumRow(b), 0);
    html.push(`<tr class="groupRow"><td colspan="4">貨單：${g.date || ''}　#${g.orderNo || ''}　<span class="small">小計合計：${nf.format(sum)}</span></td></tr>`);
    html.push(...g.rows.map(r=> `<tr><td>${r.item}</td><td>${Number.isFinite(r.qty)?nf.format(r.qty):''}</td><td>${Number.isFinite(r.price)?nf.format(r.price):''}</td><td>${Number.isFinite(r.sub)?nf.format(r.sub):''}</td></tr>`));
  }
  tbody.innerHTML = html.join('');
  const total = venRows.reduce((a,b)=> a + sumRow(b), 0);
  $('#venSum').textContent = nf.format(total);
}

// Matching（沿用 v3 的逐品項/逐貨單，只保留逐貨單）
function runMatch(){
  // 此處先以逐貨單重點：你目前要核對單號合計
  const tolTotal = parseNumber($('#tol')?.value)||0;

  // POS 聚合（date+order）
  const posMap = new Map();
  for(const r of posRows){
    const key = `${r.date||''}|${r.order||''}`;
    const tot = sumRow(r);
    if(!posMap.has(key)) posMap.set(key, {date:r.date||'', order:r.order||'', total:0});
    posMap.get(key).total += Number.isFinite(tot)? tot : 0;
  }
  const posOrders = [...posMap.values()];

  // Vendor 聚合
  const venOrders = vendorGroups.map(g=> ({
    date: g.date || '',
    order: g.orderNo || '',
    total: g.rows.reduce((a,b)=> a + sumRow(b), 0)
  }));

  // 配對
  const used = new Set();
  const ok=[], bad=[];
  for(const p of posOrders){
    let matchIndex=-1, matchScore=-1;
    for(let i=0;i<venOrders.length;i++){
      if(used.has(i)) continue;
      const v=venOrders[i];
      let score = 0;
      if(p.order && v.order && p.order.replace(/\D/g,'')===v.order.replace(/\D/g,'')) score = 2;
      else if(p.date && v.date && p.date===v.date && Math.abs((p.total||0)-(v.total||0))<=tolTotal) score = 1;
      if(score>matchScore){ matchScore=score; matchIndex=i; }
    }
    if(matchIndex>=0 && matchScore>0){
      const v=venOrders[matchIndex]; used.add(matchIndex);
      const gap=(p.total||0)-(v.total||0);
      (Math.abs(gap)<=tolTotal? ok: bad).push({p,v,gap,method:(matchScore===2?'單號匹配':'日期+金額匹配')});
    }else{
      bad.push({p,v:null,gap:NaN,method:'未匹配'});
    }
  }
  venOrders.forEach((v,i)=>{ if(!used.has(i)) bad.push({p:null,v,method:'供應商多出',gap:NaN}); });

  // 渲染
  const okTHead = `<tr><th>POS 日期</th><th>POS 單號</th><th>POS 合計</th><th></th><th>廠商 日期</th><th>廠商 單號</th><th>廠商 合計</th><th>差額</th><th>匹配方式</th></tr>`;
  $('#tblOK thead').innerHTML = okTHead;
  $('#tblOK tbody').innerHTML = ok.map(r=>`<tr>
    <td>${r.p?.date||'—'}</td><td>${r.p?.order||'—'}</td><td>${Number.isFinite(r.p?.total)?nf.format(r.p.total):''}</td>
    <td><span class="pill ok">OK</span></td>
    <td>${r.v?.date||'—'}</td><td>${r.v?.order||'—'}</td><td>${Number.isFinite(r.v?.total)?nf.format(r.v.total):''}</td>
    <td>${Number.isFinite(r.gap)?nf.format(r.gap):''}</td><td>${r.method}</td>
  </tr>`).join('');

  $('#tblBad thead').innerHTML = okTHead;
  $('#tblBad tbody').innerHTML = bad.map(r=>`<tr>
    <td>${r.p?.date||'—'}</td><td>${r.p?.order||'—'}</td><td>${Number.isFinite(r.p?.total)?nf.format(r.p.total):''}</td>
    <td><span class="pill bad">Check</span></td>
    <td>${r.v?.date||'—'}</td><td>${r.v?.order||'—'}</td><td>${Number.isFinite(r.v?.total)?nf.format(r.v.total):''}</td>
    <td>${Number.isFinite(r.gap)?nf.format(r.gap):''}</td><td>${r.method||'—'}</td>
  </tr>`).join('');

  // Totals footer
  const posTot = posOrders.reduce((a,b)=>a+(Number.isFinite(b.total)?b.total:0),0);
  const venTot = venOrders.reduce((a,b)=>a+(Number.isFinite(b.total)?b.total:0),0);
  const diff = posTot - venTot;
  const diffClass = diff===0 ? 'diff-zero' : 'diff-pos';
  $('#ordersTotals').innerHTML = `<div class="totals">
    <div class="small">POS 合計：</div><div class="mono">${nf.format(posTot)}</div>
    <div class="small">廠商合計：</div><div class="mono">${nf.format(venTot)}</div>
    <div class="small">差額：</div><div class="mono ${diffClass}">${nf.format(diff)}</div>
  </div>`;

  updateTotals();
}

function updateTotals(){
  const pos=sumPos(), ven=venRows.reduce((a,b)=> a + sumRow(b), 0), diff=pos-ven;
  $('#posSum').textContent=nf.format(pos);
  $('#venSum').textContent=nf.format(ven);
  $('#diffSum').textContent=nf.format(diff);
}
