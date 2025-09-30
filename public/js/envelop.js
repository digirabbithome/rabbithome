
import {
  db } from '/js/firebase.js';
import {
  collection, addDoc, Timestamp, query, orderBy, getDocs, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('load', async () => {
  const form = document.getElementById('envelopeForm');
  const otherField = document.getElementById('customSenderField');
  const companySelect = document.getElementById('senderCompany');
  const searchInput = document.getElementById('searchInput');
  const dateTitle = document.getElementById('dateTitle');

  // 初始顯示：選「其他」才打開自訂公司
  if (companySelect && otherField) {
    const toggleOther = () => { otherField.style.display = companySelect.value === '其他' ? 'block' : 'none'; };
    companySelect.addEventListener('change', toggleOther);
    toggleOther();
  }

  let currentFilter = { start: startOfDay(new Date()), end: endOfDay(new Date()) };

  document.getElementById('printNormal')?.addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('normal');
  });
  document.getElementById('printReply')?.addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('reply');
  });

  // 日期快捷鍵
  document.getElementById('btnPrevDay')?.addEventListener('click', () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    applyDateFilter(d, d);
  });
  document.getElementById('btnLast3Days')?.addEventListener('click', () => {
    const today = new Date(); const past = new Date(); past.setDate(today.getDate() - 2);
    applyDateFilter(past, today);
  });
  document.getElementById('btnLastWeek')?.addEventListener('click', () => {
    const today = new Date(); const past = new Date(); past.setDate(today.getDate() - 6);
    applyDateFilter(past, today);
  });
  document.getElementById('datePicker')?.addEventListener('change', (e) => {
    const selected = new Date(e.target.value);
    applyDateFilter(selected, selected);
  });

  searchInput?.addEventListener('input', renderFilteredData);

  function getCheckedSources() {
    const nodes = form.querySelectorAll('input[name="source"]:checked');
    return Array.from(nodes).map(n => n.value.trim()).filter(Boolean);
  }

  async function handleSubmit(type = 'normal') {
    const senderCompany = form.senderCompany.value;
    const customSender = form.customSender?.value || '';
    const receiverName = form.receiverName.value;
    const phone = form.phone.value;
    const address = form.address.value;
    const customerAccount = form.customerAccount?.value || '';
    const product = form.product.value;
    const product2 = form.product2?.value || '';
    const checkedSources = getCheckedSources();
    const sourceStr = checkedSources.join('、');
    const nickname = localStorage.getItem('nickname') || '匿名';

    const displaySource = type === 'reply'
      ? (sourceStr ? `${nickname}(${sourceStr})(回郵)` : `${nickname}(回郵)`)
      : (sourceStr ? `${nickname}(${sourceStr})` : nickname);

    const now = new Date();
    const record = {
      senderCompany,
      customSender,
      receiverName,
      phone,
      address,
      customerAccount,
      product,
      product2,
      source: displaySource,
      account: nickname,
      timestamp: Timestamp.fromDate(now),
      type
    };

    // 開啟列印頁並把資料塞進 localStorage
    localStorage.setItem('envelopeData', JSON.stringify(record));
    window.open('/print.html', '_blank');

    try {
      await addDoc(collection(db, 'envelopes'), record);
      alert('✅ 資料已儲存！');
      form.reset();
      if (companySelect) companySelect.value = '數位小兔';
      if (otherField) otherField.style.display = 'none';
      await loadData();
  await loadFavQuickButtons();
    } catch (err) {
      alert('❌ 寫入失敗：' + err.message);
    }
  }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0); }
  function endOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59); }

  async function applyDateFilter(start, end) {
    currentFilter = { start: startOfDay(start), end: endOfDay(end) };
    await loadData();
  await loadFavQuickButtons();
  }

  let allData = [];

  async function loadData() {
    const q = query(collection(db, 'envelopes'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    allData = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      let ts = data.timestamp;
      if (ts && typeof ts.toDate === 'function') {
        ts = ts.toDate();
      } else if (typeof ts === 'object' && ts?.seconds) {
        ts = new Date(ts.seconds * 1000);
      } else {
        ts = new Date();
      }
      if (ts >= currentFilter.start && ts <= currentFilter.end) {
        allData.push({ id: doc.id, ...data, timestamp: ts });
      }
    });

    const fmt = (d) => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    if (dateTitle) {
      const same = currentFilter.start.toDateString() === currentFilter.end.toDateString();
      dateTitle.textContent = (same
        ? `${fmt(currentFilter.start)} 列印信封紀錄`
        : `${fmt(currentFilter.start)}–${fmt(currentFilter.end)} 列印信封紀錄`);
    }

    renderFilteredData();
  }

  function renderFilteredData() {
    const keyword = ((searchInput && searchInput.value) || '').toLowerCase();
    const tbody = document.getElementById('recordsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = allData.filter(item =>
      (item.receiverName || '').toLowerCase().includes(keyword) ||
      (item.customerAccount || '').toLowerCase().includes(keyword) ||
      (item.phone || '').toLowerCase().includes(keyword) ||
      (item.address || '').toLowerCase().includes(keyword) ||
      (item.product || '').toLowerCase().includes(keyword) ||
      (item.product2 || '').toLowerCase().includes(keyword)
    );

    filtered.forEach(data => {
      const timeStr = data.timestamp.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      const receiverBase = (data.receiverName || '');
      const receiver = data.customerAccount ? `${receiverBase} (${data.customerAccount})` : receiverBase;

      const p1 = (data.product || '').trim();
      const p2 = (data.product2 || '').trim();
      let productStr = '';
      if (p1 && p2) productStr = `${p1}（${p2}）`;
      else if (p1) productStr = p1;
      else if (p2) productStr = `（${p2}）`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td><button type="button" class="note-btn" data-id="${data.id}" title="標記並複製貨件單號">✎</button> ${receiver}</td>
        <td>${data.address || ''}</td>
        <td>${data.phone || ''}</td>
        <td>${productStr}</td>
        <td>${data.source || ''}</td>
        <td><input type="text" class="tracking-input" data-id="${data.id}" value="${data.trackingNumber || \'\'}" data-prev="${data.trackingNumber || \'\'}" placeholder="輸入貨件單號" /></td>
        <td><a href="#" data-id="${data.id}" data-type="${data.type || 'normal'}" class="reprint-link">補印信封</a></td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.reprint-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const docId = e.currentTarget.getAttribute('data-id');
        const type = e.currentTarget.getAttribute('data-type');
        const record = allData.find(d => d.id === docId);
        if (record) {
          localStorage.setItem('envelopeData', JSON.stringify(record));
          window.open('/print.html', '_blank');
        }
      });
    });
  }

  await loadData();
  await loadFavQuickButtons();
  // ===== 常用信封快捷鍵（chips + auto print） =====
  async function loadFavQuickButtons() {
    const favContainer = document.getElementById('favQuickList');
    const favSection   = document.getElementById('favSection');
    if (!favContainer || !favSection) return;
    favContainer.innerHTML = '';

    try {
      const snap = await getDocs(collection(db, 'favEnvelopes'));
      let count = 0;
      snap.forEach(docSnap => {
        const d = docSnap.data() || {};
        const shortName = (d.shortName || '').trim();
        const name = d.name || '';
        const phone = d.phone || '';
        const address = d.address || '';
        if (!shortName) return;
        count++;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.textContent = shortName;
        btn.title = `${name} ${phone} ${address}`.trim();
        btn.addEventListener('click', async () => {
          const f = document.getElementById('envelopeForm');
          if (!f) return;
          const rn = f.querySelector('#receiverName');
          const ph = f.querySelector('#phone');
          const ad = f.querySelector('#address');
          if (rn) rn.value = name;
          if (ph) ph.value = phone;
          if (ad) ad.value = address;

          // 若開啟「點按即列印」，自動送出並寫入紀錄
          const clickToPrint = document.getElementById('favClickToPrint')?.checked;
          if (clickToPrint) {
            const type = (document.querySelector('input[name="favPrintType"]:checked')?.value === 'reply') ? 'reply' : 'normal';
            await handleSubmit(type);
          }
        });
        favContainer.appendChild(btn);
      });
      favSection.style.display = count > 0 ? 'block' : 'none';
    } catch (err) {
      console.warn('載入常用信封失敗：', err);
      favSection.style.display = 'none';
    }
  }

});


// --- Delegated handlers: note toggle + copy, and tracking blur save ---
(function(){
  function copyText(text){
    try{
      if (navigator && navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(String(text||'')); return;
      }
    }catch(e){}
    try{
      var ta=document.createElement('textarea');
      ta.style.position='fixed'; ta.style.opacity='0';
      ta.value=String(text||'');
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }catch(e){}
  }
  var tbody = document.getElementById('recordsBody') || document.querySelector('tbody');
  if (!tbody) return;

  tbody.addEventListener('click', function(ev){
    var t = ev.target;
    while (t && t!==tbody && !(t.classList && t.classList.contains('note-btn'))) t = t.parentNode;
    if (!t || !t.classList || !t.classList.contains('note-btn')) return;
    ev.preventDefault();
    var tr = t;
    while (tr && tr.nodeName !== 'TR') tr = tr.parentNode;
    if (tr) tr.classList.toggle('row-note');
    var input = tr ? tr.querySelector('.tracking-input') : null;
    var val = input ? (input.value || '') : '';
    copyText(val);
  });

  tbody.addEventListener('blur', function(ev){
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('tracking-input')) return;
    var id = t.getAttribute('data-id');
    var value = (t.value || '').trim();
    (async function(){
      try{
        var ref = doc(db, 'envelopes', id);
        await updateDoc(ref, { trackingNumber: value });
        console.log('[trackingNumber updated]', id, value);
      }catch(err){
        console.error('update trackingNumber failed', err);
      }
    })();
  }, true);
})();


// INIT_LAST_3_DAYS
(function(){
  try{
    if (typeof applyDateFilter === 'function'){
      var today = new Date(); var past = new Date(); past.setDate(today.getDate()-2);
      applyDateFilter(past, today);
    }
  }catch(e){ console.warn('init 3 days failed', e); }
})();


// --- delegated handlers (note + tracking autosave) ---
(function bindDelegatedHandlers(){
  var tbody = document.getElementById('recordsBody') || document.querySelector('tbody');
  if (!tbody) return;

  function copyText(text){
    try{
      if (navigator && navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(String(text||'')); return;
      }
    }catch(e){}
    try{
      var ta=document.createElement('textarea');
      ta.style.position='fixed'; ta.style.opacity='0';
      ta.value=String(text||'');
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }catch(e){}
  }

  tbody.addEventListener('click', function(ev){
    var t = ev.target;
    while (t && t!==tbody && !(t.classList && t.classList.contains('note-btn'))) t = t.parentNode;
    if (!t || !t.classList || !t.classList.contains('note-btn')) return;
    ev.preventDefault();

    var tr = t;
    while (tr && tr.nodeName !== 'TR') tr = tr.parentNode;
    if (tr) tr.classList.toggle('row-note');

    var input = tr ? tr.querySelector('.tracking-input') : null;
    var val = input ? (input.value || '') : '';
    copyText(val);
  });

  function maybeSave(target){
    if (!target || !target.classList || !target.classList.contains('tracking-input')) return;
    var id    = target.getAttribute('data-id');
    var value = (target.value || '').trim();
    var prev  = target.getAttribute('data-prev') || '';
    if (value === prev) return;
    (async function(){
      try{
        var ref = doc(db, 'envelopes', id);
        await updateDoc(ref, { trackingNumber: value });
        target.setAttribute('data-prev', value);
        console.log('[autosave] trackingNumber updated:', id, value);
      }catch(err){
        console.error('update trackingNumber failed', err);
      }
    })();
  }

  tbody.addEventListener('focusout', function(e){ maybeSave(e.target); }, true);
  tbody.addEventListener('change',   function(e){ maybeSave(e.target); }, true);
})();


// --- move note button to receiver cell (2nd col) ---
(function relocateNoteBtns(){
  var tbody = document.getElementById('recordsBody') || document.querySelector('tbody');
  if (!tbody) return;
  var rows = tbody.querySelectorAll('tr');
  for (var i=0;i<rows.length;i++){
    var tr = rows[i];
    var btn = tr.querySelector('.note-btn');
    if (!btn) continue;
    var tds = tr.children;
    if (!tds || tds.length < 2) continue;
    var recv = tds[1];
    if (recv && btn.parentNode !== recv){
      recv.insertBefore(btn, recv.firstChild);
      btn.style.marginRight = '6px';
      if (!btn.title) btn.title = '標記並複製貨件單號';
    }
  }
})();


// --- init last 3 days (non-blocking) ---
(function(){
  try{
    function startOfDay(d){ var x=new Date(d); x.setHours(0,0,0,0); return x; }
    function endOfDay(d){ var x=new Date(d); x.setHours(23,59,59,999); return x; }
    var today = new Date();
    var from  = new Date(); from.setDate(today.getDate()-2);
    if (typeof applyDateFilter === 'function'){
      applyDateFilter(startOfDay(from), endOfDay(today));
    } else {
      window.currentFilter = { start: startOfDay(from), end: endOfDay(today) };
      if (typeof renderFilteredData === 'function') renderFilteredData();
    }
  }catch(e){ console.warn('init 3 days failed', e); }
})();


// === note-pen-observer v1 ===
(function(){ 
  // helper: robust copy
  function copyText(text){
    try{ if(navigator && navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(String(text||'')); return; } }catch(e){}
    try{ 
      var ta=document.createElement('textarea'); 
      ta.style.position='fixed'; ta.style.opacity='0'; 
      ta.value=String(text||''); document.body.appendChild(ta); 
      ta.focus(); ta.select(); document.execCommand('copy'); 
      document.body.removeChild(ta); 
    }catch(e){}
  }
  function ensurePenInRow(tr){
    if(!tr || tr.nodeName!=='TR') return;
    if(tr.querySelector('.note-btn')) return;
    var cells = tr.children;
    if(!cells || cells.length<2) return;
    var recv = cells[1]; // 0:時間, 1:收件人
    var btn = document.createElement('button');
    btn.type='button';
    btn.className='note-btn';
    btn.title='標記並複製貨件單號';
    btn.textContent='✎';
    recv.insertBefore(btn, recv.firstChild);
  }
  function scanAllRows(){
    var tbody=document.getElementById('recordsBody')||document.querySelector('tbody');
    if(!tbody) return;
    var rows=tbody.querySelectorAll('tr');
    for(var i=0;i<rows.length;i++) ensurePenInRow(rows[i]);
  }
  // initial scan
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', scanAllRows); } else { scanAllRows(); }
  // observe tbody mutations to keep pens present
  (function(){
    var tbody=document.getElementById('recordsBody')||document.querySelector('tbody');
    if(!tbody || !window.MutationObserver) return;
    var obs = new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var m=muts[i];
        if(m.type==='childList'){
          m.addedNodes && m.addedNodes.forEach && m.addedNodes.forEach(function(n){ if(n.nodeName==='TR') ensurePenInRow(n); });
        }
      }
    });
    obs.observe(tbody, { childList:true });
  })();
  // delegated click: toggle highlight + copy same-row tracking number
  (function(){
    var tbody=document.getElementById('recordsBody')||document.querySelector('tbody');
    if(!tbody) return;
    tbody.addEventListener('click', function(ev){
      var t=ev.target;
      while(t && t!==tbody && !(t.classList && t.classList.contains('note-btn'))) t=t.parentNode;
      if(!t || !t.classList || !t.classList.contains('note-btn')) return;
      ev.preventDefault();
      var tr=t; while(tr && tr.nodeName!=='TR') tr=tr.parentNode;
      if(tr) tr.classList.toggle('row-note');
      var input=tr?tr.querySelector('.tracking-input'):null;
      var val=input?(input.value||''):'';
      copyText(val);
    });
  })();
})();

