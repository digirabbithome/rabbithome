
import {
  db, updateDoc, doc
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

  document.getElementById('printNormal') && addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('normal');
  });
  document.getElementById('printReply') && addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('reply');
  });

  // 日期快捷鍵
  document.getElementById('btnPrevDay') && addEventListener('click', () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    applyDateFilter(d, d);
  });
  document.getElementById('btnLast3Days') && addEventListener('click', () => {
    const today = new Date(); const past = new Date(); past.setDate(today.getDate() - 2);
    applyDateFilter(past, today);
  });
  document.getElementById('btnLastWeek') && addEventListener('click', () => {
    const today = new Date(); const past = new Date(); past.setDate(today.getDate() - 6);
    applyDateFilter(past, today);
  });
  document.getElementById('datePicker') && addEventListener('change', (e) => {
    const selected = new Date(e.target.value);
    applyDateFilter(selected, selected);
  });

  searchInput && addEventListener('input', renderFilteredData);

  
// v6plus-fixed: 保留郵遞區號，僅「縣市+區」標色（修正正則跳脫）
(?:市|縣))[\u4e00-\u9fa5]{1,3}區)/);
  if (areaMatch) {
    const area = areaMatch[1];
    s = s.replace(area, '<span class="area-highlight">' + area + '</span>');
  }
  return s;
}

function getCheckedSources() {
    const nodes = form.querySelectorAll('input[name="source"]:checked');
    return Array.from(nodes).map(n => n.value.trim()).filter(Boolean);
  }

  async function handleSubmit(type = 'normal') {
    const senderCompany = form.senderCompany.value;
    const customSender = form.customSender && value || '';
    const receiverName = form.receiverName.value;
    const phone = form.phone.value;
    const address = form.address.value;
    const customerAccount = form.customerAccount && value || '';
    const product = form.product.value;
    const product2 = form.product2 && value || '';
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
      } else if (typeof ts === 'object' && ts && seconds) {
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

  

// v4plus: 郵遞區號保留，後面「中文前 6 個字」反色標示
(?:\d{2})?)(.*)$/);
  if (!m) {
    // 沒有郵遞區號就不處理
    return s;
  }
  const zipcode = m[1];
  const rest = m[2] || '';
  let count = 0;
  let out = '';
  for (const ch of Array.from(rest)) {
    if (count < 6 && /\p{Script=Han}/u.test(ch)) {
      out += '<span class="area-highlight">' + ch + '</span>';
      count++;
    } else {
      out += ch;
    }
  }
  return zipcode + out;
}


// v04plus: 郵遞區號保留，後續「中文前 6 個字」加底色
(?:\d{2})?)(.*)$/);
  if (!m) return s;
  const zipcode = m[1];
  const rest = m[2] || '';

  // 從左到右找「前 6 個中文字」並標色（忽略非中文字）
  let count = 0;
  let out = '';
  for (const ch of Array.from(rest)) {
    if (count < 6 && /\p{Script=Han}/u.test(ch)) {
      out += '<span class="area-highlight">' + ch + '</span>';
      count++;
    } else {
      out += ch;
    }
  }
  return zipcode + out;
}


// v04plus-compat：郵遞區號保留，後續「中文前 6 個字」加底色（相容舊環境：無 || / 無 \u 正則屬性）
(?:\d{2})?)(.*)$/);
  if (!m) return s;

  var zipcode = m[1];
  var rest = m[2] || '';

  var count = 0, out = '';
  for (var i = 0; i < rest.length; i++) {
    var ch = rest[i];
    if (count < 6 && /[\u4e00-\u9fa5]/.test(ch)) {
      out += '<span class="area-highlight">' + ch + '</span>';
      count++;
    } else {
      out += ch;
    }
  }
  return zipcode + out;
}


// v04plus-compat: 郵遞區號保留，後面的「中文前 6 個字」加底色（無 ?.?/??）
function formatAddress(addr) {
  var s = String(addr || '');
  var m = s.match(/^(\d{3}(?:\d{2})?)(.*)$/);
  if (!m) return s;

  var zipcode = m[1];
  var rest = m[2] || '';

  var count = 0, out = '';
  for (var i = 0; i < rest.length; i++) {
    var ch = rest[i];
    if (count < 6 && /[\u4e00-\u9fa5]/.test(ch)) {
      out += '<span class="area-highlight">' + ch + '</span>';
      count++;
    } else {
      out += ch;
    }
  }
  return zipcode + out;
}

function renderFilteredData() { // v4 upgrade
  const keyword = ((searchInput && searchInput.value) || '').toLowerCase();
  const tbody = document.getElementById('recordsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Filter
  const filtered = allData.filter(item =>
    (item.receiverName || '').toLowerCase().includes(keyword) ||
    (item.customerAccount || '').toLowerCase().includes(keyword) ||
    (item.phone || '').toLowerCase().includes(keyword) ||
    (item.address || '').toLowerCase().includes(keyword) ||
    (item.product || '').toLowerCase().includes(keyword) ||
    (item.product2 || '').toLowerCase().includes(keyword)
  );

  // Group by date
  const fmtDate = (d) => d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const groups = {};
  filtered.forEach(data => {
    const d = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp);
    const dstr = fmtDate(d);
    (groups[dstr] ||= []).push({ ...data, _ts: d });
  });

  // Area highlights (simple whitelist)
  const HIGHLIGHT_AREAS = ['台北市信義區','台中市北屯區'];
  const isAreaHit = (addr='') => HIGHLIGHT_AREAS.some(tag => addr.includes(tag));

  // Sorted by date desc
  Object.keys(groups).sort((a,b)=> new Date(b)-new Date(a)).forEach(dateStr => {
    // date separator row
    const sep = document.createElement('tr');
    sep.className = 'date-separator';
    sep.innerHTML = `<td colspan="9">${dateStr}</td>`;
    tbody.appendChild(sep);

    // rows for day
    groups[dateStr].forEach(data => {
      const timeStr = data._ts.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      const dateStrRow = fmtDate(data._ts);
      const receiverBase = (data.receiverName || '');
      const receiver = data.customerAccount ? `${receiverBase} (${data.customerAccount})` : receiverBase;

      const p1 = (data.product || '').trim();
      const p2 = (data.product2 || '').trim();
      let productStr = '';
      if (p1 && p2) productStr = `${p1}（${p2}）`; else if (p1) productStr = p1; else if (p2) productStr = `（${p2}）`;

      const addr = data.address || '';
      const addrClass = isAreaHit(addr) ? 'area-highlight' : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dateStrRow}</td>
        <td>${timeStr}</td>
        <td>${receiver}</td>
        <td>${formatAddress(addr)}</td>
        <td>${data.phone || ''}</td>
        <td>${productStr}</td>
        <td>${data.source || ''}</td>
        <td><input type="text" class="tracking-input" data-id="${data.id}" placeholder="輸入貨件單號" /></td>
        <td><a href="#" data-id="${data.id}" data-type="${data.type || 'normal'}" class="reprint-link">補印信封</a></td>
      `;
      tbody.appendChild(tr);
    });
  });

  // Bind tracking blur save
  document.querySelectorAll('.tracking-input').forEach(input => {
    input.addEventListener('blur', async (e) => {
      const id = e.target.getAttribute('data-id');
      const value = e.target.value.trim();
      try {
        const ref = doc(db, 'envelopes', id);
        await updateDoc(ref, { trackingNumber: value });
        console.log('[v4] trackingNumber updated', id, value);
      } catch (err) {
        console.error('update trackingNumber failed', err);
      }
    });
  });

  // Reprint
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
          const clickToPrint = document.getElementById('favClickToPrint') && checked;
          if (clickToPrint) {
            const type = (document.querySelector('input[name="favPrintType"]:checked') && value === 'reply') ? 'reply' : 'normal';
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