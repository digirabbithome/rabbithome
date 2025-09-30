
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
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'; // v8

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

  const __v8_today = new Date(); const __v8_past = new Date(); __v8_past.setDate(__v8_today.getDate()-2);
  let currentFilter = { start: startOfDay(__v8_past), end: endOfDay(__v8_today) }; // v8 default 3 days

  document.getElementById('printNormal')?.addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('normal');
    // v8b ensure default filter
  try {
    const __t = new Date(); const __p = new Date(); __p.setDate(__t.getDate()-2);
    await applyDateFilter(__p, __t);
  } catch(e){ console.warn('v8b default applyDateFilter failed', e); }
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

  // ---- 地址顯示：去掉開頭郵遞區號，並將前6個字加底色 ----
  function formatAddress(addr) {
    let s = (addr || '').trim();
    // 移除開頭 3 或 5 碼郵遞區號與後續空白/連字符
    s = s.replace(/^\s*\d{3}(?:\d{2})?[-\s]?/, '');
    // 將前6個非空白字上色
    const chars = Array.from(s);
    let count = 0;
    let out = '';
    for (const ch of chars) {
      if (!/\s/.test(ch) && count < 6) {
        out += '<span class="addr-lead">' + ch + '</span>';
        count++;
      } else {
        out += ch;
      }
    }
    return out;
  }

  }

  

function renderFilteredData() { // v8b robust
  try {
    const keyword = (searchInput?.value || '').toLowerCase();
    const tbody = document.getElementById('recordsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const arr = Array.isArray(allData) ? allData : [];
    // 篩選
    const filtered = arr.filter(item => {
      const rn = (item.receiverName || '').toLowerCase();
      const ca = (item.customerAccount || '').toLowerCase();
      const ph = (item.phone || '').toLowerCase();
      const ad = (item.address || '').toLowerCase();
      const p1 = (item.product || '').toLowerCase();
      const p2 = (item.product2 || '').toLowerCase();
      return !keyword || rn.includes(keyword) || ca.includes(keyword) || ph.includes(keyword) || ad.includes(keyword) || p1.includes(keyword) || p2.includes(keyword);
    });

    if (!filtered.length) {
      const empty = document.createElement('tr');
      empty.innerHTML = `<td colspan="8" style="color:#888;">（這段日期沒有資料）</td>`;
      tbody.appendChild(empty);
      return;
    }

    // 依日期分組
    const fmtDate = (d) => d.toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' });
    const groups = {};
    filtered.forEach(data => {
      const ts = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp);
      if (isNaN(ts)) return;
      const key = fmtDate(ts);
      (groups[key] ||= []).push({ ...data, _ts: ts });
    });

    const sortedDates = Object.keys(groups).sort((a,b)=> new Date(b)-new Date(a));
    sortedDates.forEach(dateStr => {
      // 標題列
      const sep = document.createElement('tr');
      sep.className = 'date-heading';
      sep.innerHTML = `<td colspan="8">${dateStr} 列印信封紀錄（共 ${groups[dateStr].length} 筆）</td>`;
      tbody.appendChild(sep);

      groups[dateStr].forEach(data => {
        const timeStr = data._ts.toLocaleTimeString('zh-TW', { hour:'2-digit', minute:'2-digit' });
        const baseName = data.receiverName || '';
        const receiver = data.customerAccount ? `${baseName} (${data.customerAccount})` : baseName;

        const p1 = (data.product || '').trim();
        const p2 = (data.product2 || '').trim();
        let productStr = '';
        if (p1 && p2) productStr = `${p1}（${p2}）`;
        else if (p1) productStr = p1;
        else if (p2) productStr = `（${p2}）`;

        const addr = data.address || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${timeStr}</td>
          <td>${receiver}</td>
          <td>${formatAddress(addr)}</td>
          <td>${data.phone || ''}</td>
          <td>${productStr}</td>
          <td>${data.source || ''}</td>
          <td><input type="text" class="tracking-input" data-id="${data.id}" value="${data.trackingNumber || ''}" placeholder="輸入貨件單號" /></td>
          <td><a href="#" data-id="${data.id}" data-type="${data.type || 'normal'}" class="reprint-link">補印信封</a></td>
        `;
        tbody.appendChild(tr);
      });
    });

    // 綁事件
    document.querySelectorAll('.tracking-input').forEach(input => {
      input.addEventListener('blur', async (e) => {
        const id = e.target.getAttribute('data-id');
        const value = e.target.value.trim();
        try {
          const ref = doc(db, 'envelopes', id);
          await updateDoc(ref, { trackingNumber: value });
          console.log('[v8b] trackingNumber updated', id, value);
        } catch (err) {
          console.error('[v8b] update trackingNumber failed', err);
          alert('更新貨件單號失敗：' + err.message);
        }
      });
    });

    document.querySelectorAll('.reprint-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const docId = e.currentTarget.getAttribute('data-id');
        const type = e.currentTarget.getAttribute('data-type');
        const record = (Array.isArray(allData) ? allData : []).find(d => d.id === docId);
        if (record) {
          localStorage.setItem('envelopeData', JSON.stringify(record));
          window.open('/print.html', '_blank');
        }
      });
    });
  } catch (err) {
    console.error('renderFilteredData error (v8b):', err);
    const tbody = document.getElementById('recordsBody');
    if (tbody) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="8" style="color:#c00;">渲染失敗：${(err && err.message) || err}</td>`;
      tbody.appendChild(row);
    }
  }
}

    });
  });

  // 補印
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