
// 將地址前 9 個字套上粗體 + 黃底
function formatAddressFirst9(addr) {
  var s = String(addr || '');
  s = s.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');
  var first = s.slice(0, 9);
  var rest  = s.slice(9);
  return '<span class="addr-first9">' + first + '</span>' + rest;
}


import { db } from '/js/firebase.js';
import {
  collection,
  addDoc,
  Timestamp,
  query,
  orderBy,
  getDocs,
  updateDoc,
  doc
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

  const __today = new Date(); const __past3 = new Date(); __past3.setDate(__today.getDate()-2);
  let currentFilter = { start: startOfDay(__past3), end: endOfDay(__today) };

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

    // 1) 關鍵字過濾
    const filtered = allData.filter(item =>
      (item.receiverName || '').toLowerCase().includes(keyword) ||
      (item.customerAccount || '').toLowerCase().includes(keyword) ||
      (item.phone || '').toLowerCase().includes(keyword) ||
      (item.address || '').toLowerCase().includes(keyword) ||
      (item.product || '').toLowerCase().includes(keyword) ||
      (item.product2 || '').toLowerCase().includes(keyword)
    );

    // 2) 依「日期字串」分群
    const fmtDate = (d) => d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const groups = {};
    filtered.forEach(data => {
      const dstr = fmtDate(data.timestamp);
      (groups[dstr] ||= []).push(data);
    });

    // 3) 區域高亮關鍵字（可自行增減）
    const HIGHLIGHT_AREAS = [
      '台北市信義區',
      '台中市北屯區'
    ];

    const isAreaHit = (addr='') => HIGHLIGHT_AREAS.some(tag => addr.includes(tag));

    // 4) 依日期由新到舊輸出
    const sortedDates = Object.keys(groups).sort((a,b) => new Date(b) - new Date(a));
    sortedDates.forEach(dateStr => {
      // 日期分隔列
      const sep = document.createElement('tr');
      sep.className = 'date-separator';
      sep.innerHTML = `<td colspan="8">${dateStr}</td>`;
      tbody.appendChild(sep);

      // 當日資料
      groups[dateStr].forEach(data => {
        const timeStr = data.timestamp.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        const receiverBase = (data.receiverName || '');
        const receiver = data.customerAccount ? `${receiverBase} (${data.customerAccount})` : receiverBase;

        const p1 = (data.product || '').trim();
        const p2 = (data.product2 || '').trim();
        let productStr = '';
        if (p1 && p2) productStr = `${p1}（${p2}）`;
        else if (p1) productStr = p1;
        else if (p2) productStr = `（${p2}）`;

        const addr = data.address || '';
        const addrClass = isAreaHit(addr) ? 'area-highlight' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><a href="#" data-id="${data.id}" data-type="${data.type || 'normal'}" class="reprint-link">補印信封</a></td>
        `;
        tbody.appendChild(tr);
      });
    });

    // 5) 綁定事件（補印、追蹤單號回填）
    document.querySelectorAll('.tracking-input').forEach(input => {
      input.addEventListener('blur', async (e) => {
        const id = e.target.getAttribute('data-id');
        const value = e.target.value.trim();
        try {
          const ref = doc(db, 'envelopes', id);
          await updateDoc(ref, { trackingNumber: value });
          console.log('trackingNumber updated', id, value);
        } catch(err) { console.error('update trackingNumber failed', err); }
      });
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


// --- note feature: toggle row highlight and copy tracking number ---
function copyToClipboard(text) {
  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function(){});
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  }
}

function bindNoteButtons(){
  var btns = document.querySelectorAll('.note-btn');
  for (var i=0;i<btns.length;i++){
    btns[i].addEventListener('click', function(e){
      e.preventDefault();
      var tr = e.target.closest('tr');
      if (tr) tr.classList.toggle('row-note');
      var trackingInput = tr ? tr.querySelector('.tracking-input') : null;
      var tracking = trackingInput ? (trackingInput.value || '') : '';
      copyToClipboard(tracking);
      try {
        var oldTitle = e.target.title;
        e.target.title = tracking ? ('已複製：' + tracking) : '已標記（此列尚未填單號）';
        setTimeout(function(){ e.target.title = oldTitle; }, 1200);
      } catch(_){}
    });
  }
}

// call bindNoteButtons after render
setTimeout(bindNoteButtons, 500);
