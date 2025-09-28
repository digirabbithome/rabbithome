import { auth } from '/js/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const $=sel=>document.querySelector(sel);
const nf=new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
function parseNumber(x){if(x==null)return NaN;const s=String(x).replace(/[, ]/g,'').replace(/[^0-9.\-]/g,'');return parseFloat(s)}
let posRows=[],venRows=[];
window.onload=()=>{
  $('#loadPos').onclick=loadPosCSV;
  $('#runOcr').onclick=runOcrImages;
  $('#smartParse').onclick=smartParseVendor;
  onAuthStateChanged(auth,u=>$('#runner').textContent=u?(u.displayName||u.email):'未登入');
}
function loadPosCSV(){
  const f=$('#posFile').files[0];if(!f){alert('請先選檔');return}
  Papa.parse(f,{header:true,skipEmptyLines:true,complete:res=>{
    const rows=res.data,cols=Object.keys(rows[0]||{});
    ['posColDate','posColVendor','posColAmount'].forEach(id=>{
      const sel=document.getElementById(id);sel.innerHTML='';cols.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)})
    });
    $('#applyPosMap').onclick=()=>{
      const cd=$('#posColDate').value,cv=$('#posColVendor').value,ca=$('#posColAmount').value;
      posRows=rows.map(r=>({date:r[cd]||'',vendor:r[cv]||'',amount:parseNumber(r[ca])})).filter(r=>r.date||r.vendor||isFinite(r.amount));
      renderPos();
    }
  }})
}
function renderPos(){
  const tb=document.querySelector('#posTable tbody');
  tb.innerHTML=posRows.map(r=>`<tr><td>${r.date}</td><td>${r.vendor}</td><td>${isFinite(r.amount)?nf.format(r.amount):''}</td></tr>`).join('');
  const tot=posRows.reduce((a,b)=>a+(isFinite(b.amount)?b.amount:0),0);
  $('#posTotal').textContent=nf.format(tot);
}
async function runOcrImages(){
  const fs=$('#imgFiles').files;if(!fs.length){alert('先選圖片');return}
  const worker=await Tesseract.createWorker('eng+chi_tra');const out=[];
  for(let i=0;i<fs.length;i++){const f=fs[i];$('#ocrStatus').textContent=`辨識中 ${i+1}/${fs.length}`;const {data}=await worker.recognize(f);out.push(data.text);$('#ocrBar').style.width=Math.round(((i+1)/fs.length)*100)+'%';}
  await worker.terminate();window.__venText=out.join('\n');$('#ocrStatus').textContent='完成';
}
function smartParseVendor(){
  const text=window.__venText||'';if(!text){alert('無 OCR 結果');return}
  const rows=[];text.split(/\n+/).forEach(ln=>{
    const nums=[...ln.matchAll(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?/g)].map(m=>m[0]);
    if(nums.length>=2){const sub=parseNumber(nums.at(-1)),price=parseNumber(nums.at(-2));rows.push({item:ln,qty:1,price,sub});}
  });
  venRows=rows;
  const tb=document.querySelector('#venTable tbody');
  tb.innerHTML=rows.map(r=>`<tr><td>${r.item}</td><td>${r.qty}</td><td>${isFinite(r.price)?nf.format(r.price):''}</td><td>${isFinite(r.sub)?nf.format(r.sub):''}</td></tr>`).join('');
  const tot=rows.reduce((a,b)=>a+(isFinite(b.sub)?b.sub:0),0);$('#venTotal').textContent=nf.format(tot);
}