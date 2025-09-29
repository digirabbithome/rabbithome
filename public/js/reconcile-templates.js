/*! reconcile-templates.js (patched v1.2) — old IDs + customParserJS + supplier index | 2025-09-30 */
(function(){
  'use strict';

  function F(){ return window.__Fire || {}; }
  function DB(){ return window.TemplateManagerDB || window.firebaseDb || window.db || undefined; }

  // -------- Suppliers list (uses old IDs) --------
  async function mgrLoadSuppliers(){
    try{
      const sel = document.getElementById('mgrSupplierSelect');
      if(!sel){ console.warn('#mgrSupplierSelect 不存在'); return; }

      if(!DB()){
        sel.innerHTML = '<option value="">未連線 Firebase（僅可離線）</option>';
        return;
      }

      const FF = F();
      const coll = FF.collection(DB(), 'suppliers');
      let q = coll;
      if (FF.query && FF.orderBy) q = FF.query(coll, FF.orderBy('code'));

      let snap = await FF.getDocs(q);
      // fallback order by name if empty (or code not indexed)
      if (!snap || snap.empty){
        console.warn('[mgr] suppliers orderBy("code") 無結果，改用 name');
        if (FF.query && FF.orderBy) q = FF.query(coll, FF.orderBy('name'));
        snap = await FF.getDocs(q);
      }

      const items = [];
      snap.forEach(function(doc){
        const d = (doc.data && doc.data()) || {};
        const code = d.code || '';
        const shortName = d.shortName || d.name || doc.id;
        const label = (code ? (code + '-' + shortName) : shortName);
        items.push({ id: doc.id, code, label });
      });

      items.sort(function(a,b){ return (a.label||'').localeCompare(b.label||''); });

      sel.innerHTML = '<option value="">請選擇</option>' +
        items.map(it=>`<option value="${it.id}">${it.label}</option>`).join('');

      // build & store index for reconcile page (label<->id<->code)
      const index = { byId:{}, byLabel:{}, byCode:{} };
      items.forEach(it=>{
        index.byId[it.id] = it.label;
        index.byLabel[it.label] = it.id;
        if (it.code) index.byCode[it.code] = it.id;
      });
      try{ localStorage.setItem('reconcile.suppliers.index', JSON.stringify(index)); }catch(e){}
    }catch(e){
      console.error('[mgrLoadSuppliers] error:', e);
      const sel = document.getElementById('mgrSupplierSelect');
      if (sel) sel.innerHTML = '<option value="">載入失敗</option>';
    }
  }

  // -------- Load template for selected supplier --------
  async function mgrLoadFromSupplier(){
    const supplierId = document.getElementById('mgrSupplierSelect')?.value||'';
    if(!supplierId){ alert('請先選擇供應商'); return; }
    if(!DB()){ alert('未連線 Firebase'); return; }

    const FF = F();
    const ref = FF.doc(FF.collection(DB(), 'suppliers'), supplierId);
    const snap = await FF.getDoc(ref);
    if(!snap.exists()){ document.getElementById('mgrStatus').textContent='找不到供應商'; return; }

    const root = (snap.data && snap.data()) || {};
    const data = root.reconcileTemplate || {};

    // Fields
    setValNum('tolerance', (data.tolerance!=null? data.tolerance: 3));
    setVal('strip', (data.stripLines||[]).join('\n'));
    setVal('aliases', safeStringify(data.aliases||{}, 2));
    setVal('kwFreight', (data.freightKeywords||[]).join(', '));
    setVal('kwDiscount', (data.discountKeywords||[]).join(', '));
    setVal('headerRegex', data.headerRegex || '');

    // customParserJS (template field is preferred; fallback to root for backward compat)
    ensureCustomParserField();
    setVal('customParserJS', String(data.customParserJS || root.customParserJS || ''));

    // also cache locally for reconcile page usage
    try{
      const cache = Object.assign({}, data);
      localStorage.setItem('reconcile.suppliers.'+supplierId+'.template', JSON.stringify(cache));
    }catch(e){}

    setStatus('已載入 suppliers 樣板');
  }

  // -------- Save template for selected supplier --------
  async function mgrSaveToSupplier(){
    const supplierId = document.getElementById('mgrSupplierSelect')?.value||'';
    if(!supplierId){ alert('請先選擇供應商'); return; }
    if(!DB()){ alert('未連線 Firebase'); return; }

    const payload = {
      tolerance: toNum(getVal('tolerance'), 3),
      stripLines: splitLines(getVal('strip')),
      aliases: parseJSON(getVal('aliases')),
      freightKeywords: splitCSV(getVal('kwFreight')),
      discountKeywords: splitCSV(getVal('kwDiscount')),
      headerRegex: (getVal('headerRegex')||'').trim() || null,
      customParserJS: (getVal('customParserJS')||'').trim(),
      updatedAt: new Date().toISOString()
    };

    const FF = F();
    const ref = FF.doc(FF.collection(DB(), 'suppliers'), supplierId);
    await FF.setDoc(ref, { reconcileTemplate: payload, customParserJS: payload.customParserJS }, { merge:true });

    try{
      localStorage.setItem('reconcile.suppliers.'+supplierId+'.template', JSON.stringify(payload));
    }catch(e){}

    setStatus('已儲存到 suppliers');
  }

  // -------- Helpers --------
  function setVal(id, v){ var el=document.getElementById(id); if(el) el.value = v; }
  function setValNum(id, v){ var el=document.getElementById(id); if(el) el.value = String(v); }
  function getVal(id){ var el=document.getElementById(id); return el ? el.value : ''; }
  function splitLines(s){ return (s||'').split(/\n+/).map(function(x){return x.trim();}).filter(Boolean); }
  function splitCSV(s){ return (s||'').split(',').map(function(x){return x.trim();}).filter(Boolean); }
  function parseJSON(s){ try{ return s ? JSON.parse(s) : {}; } catch(e){ alert('aliases 不是合法 JSON'); throw e; } }
  function safeStringify(o, n){ try{ return JSON.stringify(o,null,n); }catch(e){ return '{}'; } }
  function toNum(s, def){ var x=parseFloat(s); return isFinite(x)?x:def; }
  function setStatus(msg){ var el=document.getElementById('mgrStatus'); if(el) el.textContent = msg; }

  function ensureCustomParserField(){
    if (document.getElementById('customParserJS')) return;
    var main = document.querySelector('main .wrap') || document.querySelector('main') || document.body;
    // 插進「樣板內容」卡片之後，保持風格一致
    var card = document.createElement('section');
    card.className = 'card';
    card.innerHTML = '<h3>自訂解析器（customParserJS）</h3>' +
      '<div class="kv">' +
      '  <label>customParserJS（貼上 JS 原始碼）</label>' +
      '  <textarea id="customParserJS" class="code" style="height:260px" placeholder="貼上此供應商的專用解析器 JS；儲存後對帳頁會優先套用"></textarea>' +
      '  <div class="small">會存到 suppliers/{id}.reconcileTemplate.customParserJS（同時鏡射到根 customParserJS 便於其它頁讀取）</div>' +
      '</div>';
    var blocks = document.querySelectorAll('main .card');
    var anchor = blocks[blocks.length-1] || main;
    anchor.parentNode.insertBefore(card, anchor.nextSibling);
  }

  // -------- Bind old buttons --------
  window.addEventListener('DOMContentLoaded', function(){
    ensureCustomParserField();
    mgrLoadSuppliers();
    var ld = document.getElementById('mgrLoad'); if (ld) ld.onclick = mgrLoadFromSupplier;
    var sv = document.getElementById('mgrSave'); if (sv) sv.onclick = mgrSaveToSupplier;
  });

  // Expose for console testing
  window.mgrLoadSuppliers = mgrLoadSuppliers;
  window.mgrLoadFromSupplier = mgrLoadFromSupplier;
  window.mgrSaveToSupplier = mgrSaveToSupplier;

  console.log('[reconcile-templates] patch v1.2 ready (old IDs + customParserJS + index)');
})();