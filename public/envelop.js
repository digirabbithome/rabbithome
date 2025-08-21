
import { db } from '/js/firebase.js';
import {
  collection,
  addDoc,
  Timestamp,
  query,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('load', async () => {
  const form = document.getElementById('envelopeForm');
  const otherField = document.getElementById('customSenderField');
  const companySelect = document.getElementById('senderCompany');
  const searchInput = document.getElementById('searchInput');
  const dateTitle = document.getElementById('dateTitle');

  companySelect.addEventListener('change', () => {
    otherField.style.display = companySelect.value === '其他' ? 'block' : 'none';
  });

  document.getElementById('printNormal').addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('normal');
  });

  document.getElementById('printReply').addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('reply');
  });

  const btnPrevDay = document.getElementById('btnPrevDay');
  if (btnPrevDay) {
    btnPrevDay.addEventListener('click', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      applyDateFilter(yesterday, yesterday);
    });
  }

  const btnLast3Days = document.getElementById('btnLast3Days');
  if (btnLast3Days) {
    btnLast3Days.addEventListener('click', () => {
      const today = new Date();
      const past = new Date();
      past.setDate(today.getDate() - 2);
      applyDateFilter(past, today);
    });
  }

  const btnLastWeek = document.getElementById('btnLastWeek');
  if (btnLastWeek) {
    btnLastWeek.addEventListener('click', () => {
      const today = new Date();
      const past = new Date();
      past.setDate(today.getDate() - 6);
      applyDateFilter(past, today);
    });
  }

  const datePicker = document.getElementById('datePicker');
  if (datePicker) {
    datePicker.addEventListener('change', (e) => {
      const selected = new Date(e.target.value);
      applyDateFilter(selected, selected);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderFilteredData();
    });
  }

  // ====== 送出/寫入 ======
  async function handleSubmit(type = "normal") {
    const senderCompany = form.senderCompany.value;
    const customSender = form.customSender?.value || '';
    const receiverName = form.receiverName.value;
    const phone = form.phone.value;
    const address = form.address.value;
    const product = form.product.value;

    // 複選來源（可為空）
    const sources = Array.from(form.querySelectorAll('input[name="source"]:checked')).map(x => x.value);
    const nickname = localStorage.getItem('nickname') || '匿名';

    let displaySource = nickname;
    if (sources.length) displaySource = `${nickname}(${sources.join('/')})`;
    if (type === "reply") displaySource = `${displaySource}(回郵)`;

    const now = new Date();
    const record = {
      senderCompany,
      customSender,
      receiverName,
      phone,
      address,
      product,
      source: displaySource,
      account: nickname,
      timestamp: Timestamp.fromDate(now),
      type
    };

    // 開印刷頁
    localStorage.setItem('envelopeData', JSON.stringify(record));
    window.open(type === "reply" ? '/print-reply.html' : '/print.html', '_blank');

    // 寫入
    try {
      await addDoc(collection(db, 'envelopes'), record);
      alert('✅ 資料已儲存！');
      form.reset();
      companySelect.value = '數位小兔';
      otherField.style.display = 'none';
      await loadData();
    } catch (err) {
      alert('❌ 寫入失敗：' + err.message);
    }
  }

  // ====== 共用工具 ======
  function getStartOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  }
  function getEndOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  }
  function makeRangeDays(days) {
    const end = getEndOfDay(new Date());
    const startRaw = new Date();
    startRaw.setDate(startRaw.getDate() - (days - 1));
    const start = getStartOfDay(startRaw);
    return { start, end };
  }
  async function applyDateFilter(start, end) {
    currentFilter = { start: getStartOfDay(start), end: getEndOfDay(end) };
    await loadData();
  }

  let allData = [];
  let currentFilter = makeRangeDays(90); // 預設 3 個月

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
    if (dateTitle) dateTitle.textContent = `${fmt(currentFilter.start)} – ${fmt(currentFilter.end)} 列印信封紀錄`;

    renderFilteredData();
  }

  function renderFilteredData() {
    const keyword = (searchInput?.value || '').toLowerCase();
    const tbody = document.getElementById('recordsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = allData.filter(item =>
      (item.receiverName || '').toLowerCase().includes(keyword) ||
      (item.phone || '').toLowerCase().includes(keyword) ||
      (item.address || '').toLowerCase().includes(keyword) ||
      (item.product || '').toLowerCase().includes(keyword)
    );

    filtered.forEach(data => {
      const timeStr = data.timestamp.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td>${data.receiverName || ''}</td>
        <td>${data.address || ''}</td>
        <td>${data.phone || ''}</td>
        <td>${data.product || ''}</td>
        <td>${data.source || ''}</td>
        <td><a href="#" data-id="${data.id}" data-type="${data.type || 'normal'}" class="reprint-link">補印信封</a></td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.reprint-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const docId = e.target.dataset.id;
        const type = e.target.dataset.type;
        const record = allData.find(d => d.id === docId);
        if (record) {
          localStorage.setItem('envelopeData', JSON.stringify(record));
          window.open(type === "reply" ? '/print-reply.html' : '/print.html', '_blank');
        }
      });
    });
  }

  await loadData();
});
