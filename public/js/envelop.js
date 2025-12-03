// === Dual daily serials (normal/big) with Firestore transaction ===
async function nextSerial(isBig) {
  try {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth()+1).padStart(2,'0');
    const d = String(now.getDate()).padStart(2,'0');
    const mmdd = m + d;
    const ref = doc(db, 'envelop-counters', `${y}-${m}-${d}`);
    const n = await runTransaction(db, async (tx)=>{
      const snap = await tx.get(ref);
      let data = snap.exists()? snap.data():{};
      const field = isBig ? 'lastBig':'lastNormal';
      const last = Number(data[field]||0);
      const next = last + 1;
      data[field] = next;
      data.ymd = `${y}-${m}-${d}`;
      tx.set(ref, data, { merge:true });
      return next;
    });
    const core = mmdd + String(n).padStart(3,'0');
    return isBig ? ('B'+core) : core;
  } catch(e) {
    // fallback local only
    try {
      const now = new Date();
      const m = String(now.getMonth()+1).padStart(2,'0');
      const d = String(now.getDate()).padStart(2,'0');
      const mmdd = m + d;
      const key = `ctr-${mmdd}-${isBig?'big':'normal'}`;
      const nxt = Number(localStorage.getItem(key)||'0') + 1;
      localStorage.setItem(key, String(nxt));
      const core = mmdd + String(nxt).padStart(3,'0');
      return isBig ? ('B'+core) : core;
    } catch(_) { return ''; }
  }
}

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
  Timestamp, addDoc, collection, doc, getDocs, orderBy, query, runTransaction, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('load', async () => {
  // 保險：若「包裹」checkbox 沒在來源那排，搬回第一顆
  (function ensureBigPkgInSourceGroup(){
    const group = document.getElementById('sourceGroup');
    const loose = document.querySelector('label.source-chip');
    if (group && loose && !group.contains(loose)) group.prepend(loose);
  })();

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
  let sortMode = null; // null | 'serialAsc' | 'serialDesc' | 'sourceAsc' | 'sourceDesc'

  document.getElementById('printNormal')?.addEventListener('click', e => {
    e.preventDefault(); handleSubmit('normal');
  });
  document.getElementById('printReply')?.addEventListener('click', e => {
    e.preventDefault(); handleSubmit('reply');
  });

  // 日期快捷鍵
  document.getElementById('btnPrevDay')?.addEventListener('click', () => {
    const d = new Date(); d.setDate(d.getDate() - 1); applyDateFilter(d, d);
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
    const selected = new Date(e.target.value); applyDateFilter(selected, selected);
  });

  searchInput?.addEventListener('input', renderFilteredData);

  // 點欄位標題排序：時間(流水號)與來源
  const recordsTable = document.getElementById('recordsTable');
  if (recordsTable) {
    const ths = recordsTable.querySelectorAll('thead th');
    // 第 0 欄：時間（流水號）
    if (ths[0]) {
      ths[0].style.cursor = 'pointer';
      ths[0].title = '點一下依流水號排序 / 再點一下反向';
      ths[0].addEventListener('click', () => {
        sortMode = (sortMode === 'serialAsc') ? 'serialDesc' : 'serialAsc';
        renderFilteredData();
      });
    }
    // 第 5 欄：來源
    if (ths[5]) {
      ths[5].style.cursor = 'pointer';
      ths[5].title = '點一下依來源排序 / 再點一下反向';
      ths[5].addEventListener('click', () => {
        sortMode = (sortMode === 'sourceAsc') ? 'sourceDesc' : 'sourceAsc';
        renderFilteredData();
      });
    }
  }

  function getCheckedSources() {
    const nodes = form.querySelectorAll('input[name="source"]:checked');
    return Array.from(nodes).map(n => n.value.trim()).filter(Boolean);
  }

  async function handleSubmit(type = 'normal') {
    const isBigPkg = !!document.getElementById('bigPkg')?.checked;
    const serialVal = await nextSerial(isBigPkg);
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
    const record = { serial: serialVal, serialCore: (serialVal||'').replace(/^B/, ''),
      senderCompany, customSender, receiverName, phone, address, customerAccount,
      product, product2, source: displaySource, account: nickname,
      timestamp: Timestamp.fromDate(now), type };

    // 先寫入 DB，再用文件 ID 開啟列印頁（讓列印頁直接讀 Firestore）
    try {
      const ref = await addDoc(collection(db, 'envelopes'), record);
      window.open(`/print.html?id=${ref.id}`, '_blank');
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
    await loadData(); await loadFavQuickButtons();
  }

  let allData = [];

  async function loadData() {
    const q = query(collection(db, 'envelopes'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    allData = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      let ts = data.timestamp;
      if (ts && typeof ts.toDate === 'function') ts = ts.toDate();
      else if (typeof ts === 'object' && ts?.seconds) ts = new Date(ts.seconds * 1000);
      else ts = new Date();

      if (ts >= currentFilter.start && ts <= currentFilter.end) {
        allData.push({ id: docSnap.id, ...data, timestamp: ts });
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

    // 2) 依日期分組（key: yyyy/MM/dd）
    const groups = {};
    filtered.forEach(item => {
      const d = item.timestamp || new Date();
      const key =
        d.getFullYear() + '/' +
        String(d.getMonth() + 1).padStart(2, '0') + '/' +
        String(d.getDate()).padStart(2, '0');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // 3) 每日內依 sortMode 排序
    const sortBySerial = arr => {
      arr.sort((a, b) => {
        const ca = (a.serialCore || a.serial || '').toString();
        const cb = (b.serialCore || b.serial || '').toString();
        const na = parseInt(ca.replace(/^B/, ''), 10) || 0;
        const nb = parseInt(cb.replace(/^B/, ''), 10) || 0;
        // 同一天內先比數字，再比是否為 B 開頭（大型包裹，要跟同號排在一起）
        let cmp = na - nb;
        if (cmp === 0) {
          const isBa = (a.serial || '').startsWith('B');
          const isBb = (b.serial || '').startsWith('B');
          if (isBa !== isBb) cmp = isBa ? -1 : 1; // B 優先
          else cmp = ca.localeCompare(cb, 'zh-Hant');
        }
        return (sortMode === 'serialAsc') ? cmp : -cmp;
      });
    };

    const sortBySource = arr => {
      arr.sort((a, b) => {
        const sa = (a.source || '');
        const sb = (b.source || '');
        let cmp = sa.localeCompare(sb, 'zh-Hant');
        if (cmp === 0) {
          // 同來源再依時間新到舊
          cmp = (b.timestamp || 0) - (a.timestamp || 0);
        }
        return (sortMode === 'sourceAsc') ? cmp : -cmp;
      });
    };

    const sortDefault = arr => {
      // 預設：時間由新到舊
      arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    };

    // 4) 日期由新到舊輸出
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

    // 區域高亮設定
    const HIGHLIGHT_AREAS = ['台北市信義區', '台中市北屯區'];
    const isAreaHit = (addr = '') => HIGHLIGHT_AREAS.some(tag => addr.includes(tag));

    sortedDates.forEach(dateStr => {
      const sep = document.createElement('tr');
      sep.className = 'date-separator';
      sep.innerHTML = `<td colspan="8">${dateStr}</td>`;
      tbody.appendChild(sep);

      const rows = groups[dateStr].slice(); // 複製一份避免影響原陣列
      if (sortMode === 'serialAsc' || sortMode === 'serialDesc') {
        sortBySerial(rows);
      } else if (sortMode === 'sourceAsc' || sortMode === 'sourceDesc') {
        sortBySource(rows);
      } else {
        sortDefault(rows);
      }

      rows.forEach(data => {
        const timeStr = data.timestamp
          ? data.timestamp.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
          : '';
        const receiverBase = (data.receiverName || '');
        const receiver = data.customerAccount
          ? `${receiverBase} (${data.customerAccount})`
          : receiverBase;

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
          <td>
            <div class="timebox">
              <div class="serial">${data.serial || '—'}</div>
              <div class="time">${timeStr}</div>
            </div>
          </td>
          <td>${receiver}</td>
          <td class="${addrClass}">${formatAddressFirst9(addr)}</td>
          <td>${data.phone || ''}</td>
          <td>${productStr}</td>
          <td>${data.source || ''}</td>
          <td>
            <input
              type="text"
              class="tracking-input"
              data-id="${data.id}"
              value="${data.trackingNumber || ''}"
              placeholder="輸入貨件單號"
            />
          </td>
          <td>
            <button type="button" class="note-btn" data-id="${data.id}" title="標記並複製單號">📝</button>
            <a href="#" data-id="${data.id}" class="reprint-link">補印</a>
          </td>
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
          window.open(`/print.html?id=${docId}`,'_blank');
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
