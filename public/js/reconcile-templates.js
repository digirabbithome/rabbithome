// reconcile-templates.js (fixed version)
import { db, auth } from '/js/firebase.js';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const $ = sel => document.querySelector(sel);

async function ocrImages(files){
  const worker = await Tesseract.createWorker('eng+chi_tra');
  const out = [];
  for(let i=0;i<files.length;i++){
    const f = files[i];
    const { data } = await worker.recognize(f);
    out.push(data.text);
  }
  await worker.terminate();
  return out;
}

window.onload = () => {
  document.getElementById('runOcr').addEventListener('click', runOcrImages);
};

async function runOcrImages(){
  const fs = document.getElementById('imgFiles').files;
  if(!fs.length){ alert('請先選擇圖片'); return }
  for(const f of fs){
    if(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')){
      alert('目前不支援直接辨識 PDF，請先把 PDF 轉成 PNG/JPG 再上傳。');
      return;
    }
  }
  try{
    const texts = await ocrImages(fs);
    window.__rawVendorText = texts.join('\n');
    alert('OCR 完成，共 ' + texts.length + ' 筆');
  }catch(err){
    console.error(err);
    alert('OCR 失敗：' + (err && err.message ? err.message : err));
  }
}
