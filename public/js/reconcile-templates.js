async function mgrLoadSuppliers(){
  try{
    const sel = document.getElementById('mgrSupplierSelect');
    if(!window.TemplateManagerDB){
      sel.innerHTML = '<option value="">未連線 Firebase（僅可離線）</option>';
      return;
    }
    const { getDocs, collection, query, orderBy } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
    const q = query(collection(window.TemplateManagerDB,'suppliers'), orderBy('code'));
    const snap = await getDocs(q);
    const items=[]; snap.forEach(doc=>{ const d=doc.data(); items.push({id:doc.id,label:`${d.code||''}-${d.shortName||d.name||doc.id}`}); });
    sel.innerHTML = '<option value=\"\">請選擇</option>' + items.map(it=>`<option value="${it.id}">${it.label}</option>`).join('');
  }catch(e){ console.error(e); }
}
window.addEventListener('DOMContentLoaded', mgrLoadSuppliers);

async function mgrLoadFromSupplier(){
  const supplierId = document.getElementById('mgrSupplierSelect')?.value||'';
  if(!supplierId){ alert('請先選擇供應商'); return; }
  if(!window.TemplateManagerDB){ alert('未連線 Firebase'); return; }
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
  const snap = await getDoc(doc(window.TemplateManagerDB,'suppliers', supplierId));
  if(!snap.exists()){ document.getElementById('mgrStatus').textContent='找不到供應商'; return; }
  const data = snap.data().reconcileTemplate || {};
  document.getElementById('tolerance').value = (data.tolerance!=null? data.tolerance: 3);
  document.getElementById('strip').value = (data.stripLines||[]).join('\\n');
  document.getElementById('aliases').value = JSON.stringify(data.aliases||{}, null, 2);
  document.getElementById('kwFreight').value = (data.freightKeywords||[]).join(', ');
  document.getElementById('kwDiscount').value = (data.discountKeywords||[]).join(', ');
  document.getElementById('headerRegex').value = data.headerRegex || '';
  document.getElementById('mgrStatus').textContent='已載入 suppliers 樣板';
}
async function mgrSaveToSupplier(){
  const supplierId = document.getElementById('mgrSupplierSelect')?.value||'';
  if(!supplierId){ alert('請先選擇供應商'); return; }
  if(!window.TemplateManagerDB){ alert('未連線 Firebase'); return; }
  const payload = {
    tolerance: parseFloat(document.getElementById('tolerance').value) || 3,
    stripLines: document.getElementById('strip').value.split(/\\n+/).map(s=>s.trim()).filter(Boolean),
    aliases: (function(){ try{ return JSON.parse(document.getElementById('aliases').value||'{}'); }catch(e){ alert('aliases 不是合法 JSON'); throw e; } })(),
    freightKeywords: (document.getElementById('kwFreight').value||'').split(',').map(s=>s.trim()).filter(Boolean),
    discountKeywords: (document.getElementById('kwDiscount').value||'').split(',').map(s=>s.trim()).filter(Boolean),
    headerRegex: (document.getElementById('headerRegex').value||'').trim() || null,
    updatedAt: new Date().toISOString()
  };
  const { doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
  const ref = doc(window.TemplateManagerDB,'suppliers', supplierId);
  const snap = await getDoc(ref);
  if(!snap.exists()){ alert('供應商不存在'); return; }
  await setDoc(ref, { reconcileTemplate: payload }, { merge:true });
  document.getElementById('mgrStatus').textContent='已儲存到 suppliers';
}
window.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('mgrLoad').onclick = mgrLoadFromSupplier;
  document.getElementById('mgrSave').onclick = mgrSaveToSupplier;
});