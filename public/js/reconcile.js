/*! reconcile.js (patched v1.2) — load customParserJS from supplier template; plugin keyed by UI label | 2025-09-30 */
(function(){
  'use strict';

  // ---- Utilities ----
  function getSupplierUILabel(){
    // Try common selects on reconcile page
    var el = document.querySelector('[name="supplier"]')
          || document.querySelector('#supplierSelect')
          || document.querySelector('select');
    if (el){
      var txt = (el.options && el.selectedIndex >= 0 && el.options[el.selectedIndex].textContent) || el.value || '';
      return (txt || '').trim();
    }
    return (window.currentSupplierKey || '').trim(); // last resort
  }
  function getSupplierIndex(){
    try{
      var raw = localStorage.getItem('reconcile.suppliers.index');
      return raw ? JSON.parse(raw) : { byId:{}, byLabel:{}, byCode:{} };
    }catch(e){ return { byId:{}, byLabel:{}, byCode:{} }; }
  }
  function uiLabelToSupplierId(label){
    var idx = getSupplierIndex();
    return (idx.byLabel && idx.byLabel[label]) || label; // fallback use label as id
  }

  // ---- Load template (LocalStorage first; else Firestore via window.__Fire) ----
  async function tryLoadFromFirestoreById(supplierId){
    try{
      var F = window.__Fire || {};
      if (!F.doc || !F.getDoc || !F.collection) return null;
      var db = window.TemplateManagerDB || window.firebaseDb || window.db || undefined;
      var ref = F.doc(F.collection(db || undefined, 'suppliers'), supplierId);
      var snap = await F.getDoc(ref);
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
    }catch(e){ console.warn('[reconcile] local template parse fail:', e); return null; }
  }

  async function loadCurrentTemplateByUILabel(label){
    var supplierId = uiLabelToSupplierId(label);
    var tpl = tryLoadFromLocalById(supplierId);
    if (tpl && (tpl.customParserJS || tpl.headerRegex || tpl.stripLines)) return { tpl, supplierId };
    var cloud = await tryLoadFromFirestoreById(supplierId);
    if (cloud) return { tpl: cloud, supplierId };
    return { tpl: tpl || {}, supplierId };
  }

  // ---- Template-embedded parser loader (register by UI label) ----
  window.reconcilePlugins = window.reconcilePlugins || {};
  window.__vendorJSCache = window.__vendorJSCache || new Map();

  async function ensureVendorParserLoaded(tpl, supplierUILabel) {
    try {
      if (!tpl || !tpl.customParserJS || !supplierUILabel) return;
      var sig = supplierUILabel + '|' + tpl.customParserJS.length;
      if (window.__vendorJSCache.has(sig)) return;

      var factory = new Function('key','tpl',
        '"use strict";\n' + tpl.customParserJS + '\n//# sourceURL=tpl:' + encodeURIComponent(supplierUILabel)
      );
      factory(supplierUILabel, tpl);
      window.__vendorJSCache.set(sig, true);
      console.log('[reconcile] vendor parser loaded for', supplierUILabel);
    } catch (e) {
      console.error('[reconcile] ensureVendorParserLoaded failed:', e);
    }
  }

  // ---- Auto hook the Smart Parse button ----
  async function onSmartParseIntercept(ev){
    try{
      var label = getSupplierUILabel();
      if (!label) return; // let default flow run
      var { tpl } = await loadCurrentTemplateByUILabel(label);
      await ensureVendorParserLoaded(tpl, label);
      if (window.reconcilePlugins && window.reconcilePlugins[label]){
        var box = document.querySelector('#rawText');
        if (!box || !box.value || !/\\d/.test(box.value)) return; // no text, allow default
        ev.stopImmediatePropagation(); ev.preventDefault();
        window.reconcilePlugins[label]({ showFees:true, countFees:true, italicFees:false });
        // toast
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
    if(!btns.length) return;
    btns.forEach(function(btn){
      if (btn.__reconcile_tpl_hooked) return;
      btn.__reconcile_tpl_hooked = true;
      btn.addEventListener('click', onSmartParseIntercept, true); // capture
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(attachSmartParseHook, 0); });
  }else{
    setTimeout(attachSmartParseHook, 0);
  }

  // Expose utilities if existing code wants them
  window.reconcileLoadCurrentTemplateByUILabel = loadCurrentTemplateByUILabel;
  window.reconcileEnsureVendorParserLoaded = ensureVendorParserLoaded;

  console.log('[reconcile] patch v1.2 ready (UI label keyed plugins, LS+Firestore template loader)');
})();