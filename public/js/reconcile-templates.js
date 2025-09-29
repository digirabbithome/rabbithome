/*! reconcile-templates.js (patched) — adds customParserJS field & saving | 2025-09-30 */
(function(){
  'use strict';

  // Heuristics: find the supplier select and the save button by text
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

  // Inject a textarea for customParserJS under the template form
  function ensureCustomParserField(){
    if (document.getElementById('customParserJS')) return;
    // find a container near "樣板" or fallback to body
    var anchors = Array.from(document.querySelectorAll('h2,h3,h4,legend,label,.title,.card-header'))
      .filter(function(n){ return /(樣板|template|廠商樣板|Suppliers)/i.test(n.textContent||''); });
    var host = (anchors[0] && anchors[0].parentElement) || document.querySelector('.card-body') || document.body;

    var wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.style.cssText = 'margin-top:12px;border:1px solid #eee;border-radius:8px;overflow:hidden;';
    wrap.innerHTML = ''
      + '<div class="card-header" style="padding:8px 12px;background:#fafafa;border-bottom:1px solid #eee;font-weight:600;">自訂解析器（customParserJS，可直接貼進 JS）</div>'
      + '<div class="card-body" style="padding:8px 12px;">'
      + '  <textarea id="customParserJS" placeholder="(可選) 貼上此供應商的專用解析器 JS，存檔後在對帳頁會自動套用" '
      + '    style="width:100%;height:260px;white-space:pre; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;"></textarea>'
      + '  <div style="margin-top:8px; font-size:12px; color:#666;">'
      + '    小提醒：這段 JS 會在瀏覽器執行，請只貼信任的內容。支援 <code>window.reconcilePlugins[key] = function(opts){...}</code> 註冊。'
      + '  </div>'
      + '</div>';
    host.appendChild(wrap);
  }

  // Best-effort Firestore helpers
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
    }catch(e){ console.warn('[templates] Firestore load fail:', e); return null; }
  }
  function tryLoadFromLocal(key){
    try{
      var raw = localStorage.getItem('reconcile.suppliers.'+key+'.template')
             || localStorage.getItem('supplierTemplates:'+key)
             || localStorage.getItem('suppliers:'+key+':reconcileTemplate');
      if (!raw) return null;
      return JSON.parse(raw);
    }catch(e){ console.warn('[templates] local parse fail:', e); return null; }
  }
  async function loadTpl(key){
    var tpl = tryLoadFromLocal(key);
    var cloud = await tryLoadFromFirestore(key);
    return cloud || tpl || {};
  }

  async function populateField(){
    var key = getSupplierKey();
    if (!key) return;
    ensureCustomParserField();
    var area = document.getElementById('customParserJS');
    var tpl = await loadTpl(key);
    area.value = (tpl && tpl.customParserJS) ? String(tpl.customParserJS) : '';
  }

  // hook save button by caption
  function attachSaveHook(){
    var btns = Array.from(document.querySelectorAll('button, [role="button"], .btn'))
      .filter(function(b){ return /(儲存到該供應商|儲存|保存)/.test((b.textContent||'').trim()); });
    if(!btns.length) return;
    btns.forEach(function(btn){
      if(btn.__tpl_save_hooked) return;
      btn.__tpl_save_hooked = true;
      btn.addEventListener('click', async function(){
        try{
          var key = getSupplierKey();
          if(!key) return;
          var area = document.getElementById('customParserJS');
          if(!area) return;
          var js = area.value || '';

          // Merge into existing template object
          var tpl = await loadTpl(key);
          tpl = tpl || {};
          tpl.customParserJS = js;

          // Save to local
          try{
            localStorage.setItem('reconcile.suppliers.'+key+'.template', JSON.stringify(tpl));
          }catch(e){ console.warn('[templates] local save fail:', e); }

          // Save to Firestore if available
          try{
            var g = window; if(g.setDoc && g.doc && g.collection){
              var db = g.firebaseDb || g.db || undefined;
              var dref = g.doc(g.collection(db || undefined, 'suppliers'), key);
              await g.setDoc(dref, { reconcileTemplate: tpl, customParserJS: js }, { merge: true });
            }
          }catch(e){ console.warn('[templates] firestore save fail:', e); }

          // toast
          var t=document.createElement('div');
          t.textContent='customParserJS 已儲存到『'+key+'』';
          t.style.cssText='position:fixed;right:12px;bottom:12px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;opacity:.92;z-index:9999;';
          document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 1500);
        }catch(e){ console.error('[templates] save hook error:', e); }
      }, true);
    });
  }

  function init(){
    ensureCustomParserField();
    attachSaveHook();
    populateField();
    // also repopulate when supplier changes
    var sel = document.querySelector('[name="supplier"]') || document.querySelector('#supplierSelect') || document.querySelector('select');
    if (sel && !sel.__tpl_change_hooked){
      sel.__tpl_change_hooked = true;
      sel.addEventListener('change', function(){ setTimeout(populateField, 0); });
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });
  }else{
    setTimeout(init, 0);
  }

  console.log('[reconcile-templates] patch ready: customParserJS field added');
})();