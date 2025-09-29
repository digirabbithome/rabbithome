/*! reconcile.js (patched v1.3) — hydrate supplier select + load customParserJS | 2025-09-30 */
(function(){
  'use strict';

  // ---------- Common helpers ----------
  function F(){ return window.__Fire || {}; }
  function DB(){ return window.TemplateManagerDB || window.firebaseDb || window.db || undefined; }

  function getSupplierUILabel(){
    var el = findSupplierSelectOnReconcile();
    if (el){
      var txt = (el.options && el.selectedIndex >= 0 && el.options[el.selectedIndex].textContent) || el.value || '';
      return (txt || '').trim();
    }
    return (window.currentSupplierKey || '').trim();
  }
  function getSupplierIndex(){
    try{
      var raw = localStorage.getItem('reconcile.suppliers.index');
      return raw ? JSON.parse(raw) : { byId:{}, byLabel:{}, byCode:{} };
    }catch(e){ return { byId:{}, byLabel:{}, byCode:{} }; }
  }
  function uiLabelToSupplierId(label){
    var idx = getSupplierIndex();
    return (idx.byLabel && idx.byLabel[label]) || label;
  }

  // ---------- Hydrate supplier select on reconcile page ----------
  function findSupplierSelectOnReconcile(){
    // Priority: explicit ids/names used in your UI
    var sel = document.querySelector('[name="supplier"]') ||
              document.querySelector('#supplierSelect');
    if (sel) return sel;

    // Fallback: the first <select> under the main card header "廠商樣板" or similar
    var cards = Array.from(document.querySelectorAll('section.card, .card'));
    for (var i=0;i<cards.length;i++){
      var s = cards[i].querySelector('select');
      if (s) return s;
    }
    // Last fallback
    return document.querySelector('select');
  }

  async function hydrateSupplierSelectOnReconcile(){
    var sel = findSupplierSelectOnReconcile();
    if (!sel) return;
    if (sel.__hydrated) return;
    if (sel.options && sel.options.length > 1) { sel.__hydrated = true; return; }

    // Try local index first
    var idx = getSupplierIndex();
    var labels = Object.keys(idx.byLabel || {});
    if (labels.length){
      sel.innerHTML = '<option value="">請選擇供應商</option>' +
        labels.sort().map(function(lb){ return '<option value="'+lb+'">'+lb+'</option>'; }).join('');
      sel.__hydrated = true;
      return;
    }

    // Else try Firestore directly (same as templates page)
    try{
      var FF = F();
      if (!DB() || !FF.getDocs) throw new Error('no firestore bridge');
      var coll = FF.collection(DB(), 'suppliers');
      var q = coll;
      if (FF.query && FF.orderBy) q = FF.query(coll, FF.orderBy('code'));
      var snap = await FF.getDocs(q);
      if (!snap || snap.empty){
        if (FF.query && FF.orderBy) q = FF.query(coll, FF.orderBy('name'));
        snap = await FF.getDocs(q);
      }
      var items = [];
      snap.forEach(function(doc){
        var d = (doc.data && doc.data()) || {};
        var code = d.code || '';
        var shortName = d.shortName || d.name || doc.id;
        var label = (code ? (code + '-' + shortName) : shortName);
        items.push({ id:doc.id, code, label });
      });
      items.sort(function(a,b){ return (a.label||'').localeCompare(b.label||''); });

      // Fill select
      sel.innerHTML = '<option value="">請選擇供應商</option>' +
        items.map(function(it){ return '<option value="'+it.label+'">'+it.label+'</option>'; }).join('');
      sel.__hydrated = true;

      // Save index for later
      var index = { byId:{}, byLabel:{}, byCode:{} };
      items.forEach(function(it){
        index.byId[it.id] = it.label;
        index.byLabel[it.label] = it.id;
        if (it.code) index.byCode[it.code] = it.id;
      });
      try{ localStorage.setItem('reconcile.suppliers.index', JSON.stringify(index)); }catch(e){}
    }catch(e){
      console.warn('[reconcile] hydrate supplier select failed:', e);
      if (!sel.options.length){
        sel.innerHTML = '<option value="">（請先於樣板頁載入供應商）</option>';
      }
    }
  }

  // ---------- Load template by current UI label ----------
  async function tryLoadFromFirestoreById(supplierId){
    try{
      var FF = F();
      if (!FF.doc || !FF.getDoc || !FF.collection) return null;
      var ref = FF.doc(FF.collection(DB(), 'suppliers'), supplierId);
      var snap = await FF.getDoc(ref);
      if (!snap || !snap.exists) return null;
      var data = (snap.data && snap.data()) || {};
      var tpl = data.reconcileTemplate || data.template || data.reconcile || {};
      if (!tpl.customParserJS && typeof data.customParserJS === 'string') tpl.customParserJS = data.customParserJS;
      if (!tpl.parserOptions && data.parserOptions) tpl.parserOptions = data.parserOptions;
      return tpl;
    }catch(e){ console.warn('[reconcile] Firestore load failed:', e); return null; }
  }
  function tryLoadFromLocalById(supplierId){
    try{
      var raw = localStorage.getItem('reconcile.suppliers.'+supplierId+'.template');
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  async function loadCurrentTemplateByUILabel(label){
    var supplierId = uiLabelToSupplierId(label);
    var tpl = tryLoadFromLocalById(supplierId);
    if (tpl && (tpl.customParserJS || tpl.headerRegex || tpl.stripLines)) return { tpl, supplierId };
    var cloud = await tryLoadFromFirestoreById(supplierId);
    if (cloud) return { tpl: cloud, supplierId };
    return { tpl: tpl || {}, supplierId };
  }

  // ---------- Vendor parser loader keyed by UI label ----------
  window.reconcilePlugins = window.reconcilePlugins || {};
  window.__vendorJSCache = window.__vendorJSCache || new Map();

  async function ensureVendorParserLoaded(tpl, supplierUILabel){
    try{
      if (!tpl || !tpl.customParserJS || !supplierUILabel) return;
      var sig = supplierUILabel + '|' + tpl.customParserJS.length;
      if (window.__vendorJSCache.has(sig)) return;
      var factory = new Function('key','tpl', '"use strict";\\n' + tpl.customParserJS + '\\n//# sourceURL=tpl:' + encodeURIComponent(supplierUILabel));
      factory(supplierUILabel, tpl);
      window.__vendorJSCache.set(sig, true);
      console.log('[reconcile] vendor parser loaded for', supplierUILabel);
    }catch(e){ console.error('[reconcile] ensureVendorParserLoaded failed:', e); }
  }

  // ---------- Intercept Smart Parse ----------
  async function onSmartParseIntercept(ev){
    try{
      var label = getSupplierUILabel();
      if (!label) return;
      var box = document.querySelector('#rawText');
      if (!box || !/\\d/.test(box.value||'')) return;
      var { tpl } = await loadCurrentTemplateByUILabel(label);
      await ensureVendorParserLoaded(tpl, label);
      if (window.reconcilePlugins && window.reconcilePlugins[label]){
        ev.stopImmediatePropagation(); ev.preventDefault();
        window.reconcilePlugins[label]({ showFees:true, countFees:true, italicFees:false });
        var t=document.createElement('div');
        t.textContent='已套用『'+label+'』專用解析（樣板）';
        t.style.cssText='position:fixed;right:12px;bottom:12px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;opacity:.92;z-index:9999;';
        document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 1500);
      }
    }catch(e){ console.error(e); }
  }

  function attachSmartParseHook(){
    var btns = Array.from(document.querySelectorAll('button, [role="button"], .btn'))
      .filter(function(b){ return /智慧解析/.test((b.textContent||'').trim()); });
    btns.forEach(function(btn){
      if (btn.__reconcile_tpl_hooked) return;
      btn.__reconcile_tpl_hooked = true;
      btn.addEventListener('click', onSmartParseIntercept, true);
    });
  }

  // ---------- Init ----------
  function init(){
    hydrateSupplierSelectOnReconcile();
    attachSmartParseHook();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });
  }else{
    setTimeout(init, 0);
  }

  // expose for debug
  window.reconcileHydrateSuppliers = hydrateSupplierSelectOnReconcile;

  console.log('[reconcile] patch v1.3 ready (select hydrator + customParserJS)');
})();