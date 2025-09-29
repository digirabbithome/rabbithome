/*! reconcile-templates.js (patched v1.1) — customParserJS field + supplier hydrator | 2025-09-30 */
(function(){
  'use strict';

  function findSupplierSelect(){
    var sel = document.querySelector('[name="supplier"]') || document.querySelector('#supplierSelect');
    if (sel) return sel;
    // fallback: pick the first select that seems relevant
    var cands = Array.from(document.querySelectorAll('select'));
    var cand = cands.find(function(s){
      var id=(s.id||'')+(s.name||''); id=id.toLowerCase();
      return /supplier|vendor|廠商|供應商/.test(id);
    }) || cands[0];
    return cand || null;
  }

  function getSupplierKey(){
    var el = findSupplierSelect();
    if (el){
      var val = (el.value || '').trim();
      if (val) return val;
      var opt = el.options && el.options[el.selectedIndex];
      if (opt && opt.textContent) return opt.textContent.trim();
    }
    return (window.currentSupplierKey || '').trim();
  }

  // -------- Hydrate supplier select (Firestore -> LocalStorage -> leave as-is) --------
  async function hydrateSupplierSelect(){
    var sel = findSupplierSelect();
    if (!sel) return;
    if (sel.__hydrated) return;
    // If already has options beyond placeholder, keep it
    if (sel.options && sel.options.length > 1) { sel.__hydrated = true; return; }

    // Put loading indicator
    sel.innerHTML = '';
    var opt0 = document.createElement('option');
    opt0.value = ''; opt0.textContent = '（載入供應商中…）';
    sel.appendChild(opt0);

    let filled = false;

    // Try Firestore
    try{
      var g = window;
      if (g.getDocs && g.collection){
        var db = g.firebaseDb || g.db || undefined;
        var coll = g.collection(db || undefined, 'suppliers');
        var q = (g.query && g.orderBy) ? g.query(coll, g.orderBy('name')) : coll;
        var snap = await g.getDocs(q);
        if (snap && snap.forEach){
          sel.innerHTML = '';
          snap.forEach(function(doc){
            var d = doc.data ? doc.data() : {};
            var code = d.code || d.id || doc.id;
            var name = d.name || d.title || d.displayName || d.vendorName || '';
            var key = (code && name) ? (code + '-' + name) : (name || code || doc.id);
            var op = document.createElement('option');
            op.value = key; op.textContent = key;
            sel.appendChild(op);
          });
          if (sel.options.length === 0){
            // nothing produced
            throw new Error('empty suppliers in Firestore');
          }
          filled = true;
        }
      }
    }catch(e){ console.warn('[templates] Firestore suppliers load failed:', e); }

    // Fallback to LocalStorage cached templates
    if (!filled){
      try{
        sel.innerHTML = '';
        var keys = [];
        for (var i=0;i<localStorage.length;i++){
          var k = localStorage.key(i);
          var m = /^reconcile\.suppliers\.(.+)\.template$/.exec(k);
          if (m) keys.push(m[1]);
        }
        keys.sort();
        keys.forEach(function(k){
          var op = document.createElement('option');
          op.value = k; op.textContent = k;
          sel.appendChild(op);
        });
        if (sel.options.length) filled = true;
      }catch(e){ console.warn('[templates] local suppliers scan failed:', e); }
    }

    // Last resort: keep whatever was there
    if (!filled){
      sel.innerHTML = '';
      var op = document.createElement('option');
      op.value = ''; op.textContent = '（請先建立廠商或手動輸入）';
      sel.appendChild(op);
    }

    sel.__hydrated = true;
  }

  // -------- Custom Parser field --------
  function ensureCustomParserField(){
    if (document.getElementById('customParserJS')) return;
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

          var tpl = await loadTpl(key);
          tpl = tpl || {};
          tpl.customParserJS = js;

          try{ localStorage.setItem('reconcile.suppliers.'+key+'.template', JSON.stringify(tpl)); }
          catch(e){ console.warn('[templates] local save fail:', e); }

          try{
            var g = window; if(g.setDoc && g.doc && g.collection){
              var db = g.firebaseDb || g.db || undefined;
              var dref = g.doc(g.collection(db || undefined, 'suppliers'), key);
              await g.setDoc(dref, { reconcileTemplate: tpl, customParserJS: js }, { merge: true });
            }
          }catch(e){ console.warn('[templates] firestore save fail:', e); }

          var t=document.createElement('div');
          t.textContent='customParserJS 已儲存到『'+key+'』';
          t.style.cssText='position:fixed;right:12px;bottom:12px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;opacity:.92;z-index:9999;';
          document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 1500);
        }catch(e){ console.error('[templates] save hook error:', e); }
      }, true);
    });
  }

  function init(){
    hydrateSupplierSelect().then(function(){
      ensureCustomParserField();
      attachSaveHook();
      populateField();
      var sel = findSupplierSelect();
      if (sel && !sel.__tpl_change_hooked){
        sel.__tpl_change_hooked = true;
        sel.addEventListener('change', function(){ setTimeout(populateField, 0); });
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });
  }else{
    setTimeout(init, 0);
  }

  console.log('[reconcile-templates] patch v1.1 ready (supplier hydrator + customParserJS field)');
})();