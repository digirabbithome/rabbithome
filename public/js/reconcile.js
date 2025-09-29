/*! reconcile.js (patched v1.1) — template.customParserJS loader | 2025-09-30 */
(function(){
  'use strict';
  function getSupplierKey(){
    var el = document.querySelector('[name="supplier"]')
          || document.querySelector('#supplierSelect')
          || document.querySelector('select');
    if (el){
      var val = (el.value || '').trim();
      if (val) return val;
      var opt = el.options && el.options[el.selectedIndex];
      if (opt && opt.textContent) return opt.textContent.trim();
    }
    return (window.currentSupplierKey || '').trim();
  }
  async function tryLoadFromFirestore(key){
    try{
      var g = window; if(!g.getDoc || !g.doc || !g.collection) return null;
      var db = g.firebaseDb || g.db || undefined;
      var dref = g.doc(g.collection(db || undefined, 'suppliers'), key);
      var snap = await g.getDoc(dref);
      if (!snap || !snap.exists) return null;
      var data = snap.data ? snap.data() : (snap._document && snap._document.data) || {};
      var tpl = data.reconcileTemplate || data.template || data.reconcile || {};
      if (!tpl.customParserJS && typeof data.customParserJS === 'string') tpl.customParserJS = data.customParserJS;
      if (!tpl.parserOptions && data.parserOptions) tpl.parserOptions = data.parserOptions;
      return tpl;
    }catch(e){ console.warn('[reconcile] Firestore load failed:', e); return null; }
  }
  function tryLoadFromLocal(key){
    try{
      var raw = localStorage.getItem('reconcile.suppliers.'+key+'.template')
             || localStorage.getItem('supplierTemplates:'+key)
             || localStorage.getItem('suppliers:'+key+':reconcileTemplate');
      if (!raw) return null;
      return JSON.parse(raw);
    }catch(e){ console.warn('[reconcile] local template parse fail:', e); return null; }
  }
  async function loadCurrentTemplate(key){
    var tpl = tryLoadFromLocal(key);
    if (tpl && (tpl.customParserJS || tpl.headerRegex || tpl.stripLines)) return tpl;
    var cloud = await tryLoadFromFirestore(key);
    if (cloud) return cloud;
    return tpl || {};
  }
  window.reconcilePlugins = window.reconcilePlugins || {};
  window.__vendorJSCache = window.__vendorJSCache || new Map();
  async function ensureVendorParserLoaded(tpl, supplierKey) {
    try {
      if (!tpl || !tpl.customParserJS || !supplierKey) return;
      var sig = supplierKey + '|' + tpl.customParserJS.length;
      if (window.__vendorJSCache.has(sig)) return;
      var factory = new Function('key','tpl',
        '"use strict";\n' + tpl.customParserJS + '\n//# sourceURL=tpl:' + encodeURIComponent(supplierKey)
      );
      factory(supplierKey, tpl);
      window.__vendorJSCache.set(sig, true);
      console.log('[reconcile] vendor parser loaded for', supplierKey);
    } catch (e) {
      console.error('[reconcile] ensureVendorParserLoaded failed:', e);
    }
  }
  async function onSmartParseIntercept(ev){
    try{
      var key = getSupplierKey();
      if (!key) return;
      var tpl = await loadCurrentTemplate(key);
      await ensureVendorParserLoaded(tpl, key);
      if (window.reconcilePlugins && window.reconcilePlugins[key]){
        var box = document.querySelector('#rawText');
        if (!box || !box.value || !/\d/.test(box.value)) return;
        ev.stopImmediatePropagation(); ev.preventDefault();
        window.reconcilePlugins[key]({ showFees:true, countFees:true, italicFees:false });
        var t=document.createElement('div');
        t.textContent='已套用『'+key+'』專用解析（樣板）';
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
      btn.addEventListener('click', onSmartParseIntercept, true);
    });
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(attachSmartParseHook, 0); });
  }else{
    setTimeout(attachSmartParseHook, 0);
  }
  window.reconcileEnsureVendorParserLoaded = ensureVendorParserLoaded;
  window.reconcileLoadCurrentTemplate = loadCurrentTemplate;
  console.log('[reconcile] patch v1.1 ready');
})();