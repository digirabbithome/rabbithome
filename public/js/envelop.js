
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

  let currentFilter = { start: getStartOfDay(new Date()), end: getEndOfDay(new Date()) };

  companySelect.addEventListener('change', () => {
    if (!otherField) return;
    if (otherField) otherField.style.display = companySelect.value === '其他' ? 'block' : 'none';
  });

  document.getElementById('printNormal').addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('normal');
  });

  document.getElementById('printReply').addEventListener('click', e => {
    e.preventDefault();
    handleSubmit('reply');
  });

  document.getElementById('btnPrevDay').addEventListener('click', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    applyDateFilter(yesterday, yesterday);
  });

  document.getElementById('btnLast3Days').addEventListener('click', () => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 2);
    applyDateFilter(past, today);
  });

  document.getElementById('btnLastWeek').addEventListener('click', () => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 6);
    applyDateFilter(past, today);
  });

  document.getElementById('datePicker').addEventListener('change', (e) => {
    const selected = new Date(e.target.value);
    applyDateFilter(selected, selected);
  });

  searchInput.addEventListener('input', () => {
    renderFilteredData();
  });

  async function handleSubmit(type = "normal") {
    const senderCompany = form.senderCompany.value;
    const customSender = form.customSender?.value || '';
    const receiverName = form.receiverName.value;
    const phone = form.phone.value;
    const address = form.address.value;
    const product = form.product.value;
    const source = form.querySelector('input[name="source"]:checked')?.value || '';
    const nickname = localStorage.getItem('nickname') || '匿名';

    const fullSource = source ? `${nickname}(${source})` : nickname;
    const displaySource = type === "reply"
      ? (source ? `${nickname}(${source})(回郵)` : `${nickname}(回郵)`)
      : (source ? `${nickname}(${source})` : nickname);

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

    localStorage.setItem('envelopeData', JSON.stringify(record));
    window.open(type === "reply" ? '/print-reply.html' : '/print.html', '_blank');

    try {
      await addDoc(collection(db, 'envelopes'), record);
      alert('✅ 資料已儲存！');
      form.reset();
      companySelect.value = '數位小兔';
      if (otherField) otherField.style.display = 'none';
      await loadData();
    } catch (err) {
      alert('❌ 寫入失敗：' + err.message);
    }
  }

  function getStartOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  }

  function getEndOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  }

  async function applyDateFilter(start, end) {
    currentFilter = { start: getStartOfDay(start), end: getEndOfDay(end) };
    await loadData();
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
      } else if (typeof ts === 'object' && ts.seconds) {
        ts = new Date(ts.seconds * 1000);
      } else {
        ts = new Date();
      }

      if (ts >= currentFilter.start && ts <= currentFilter.end) {
        allData.push({ id: doc.id, ...data, timestamp: ts });
      }
    });

    dateTitle.textContent = `${currentFilter.start.getFullYear()}/${String(currentFilter.start.getMonth()+1).padStart(2,'0')}/${String(currentFilter.start.getDate()).padStart(2,'0')} 列印信封紀錄`;
    renderFilteredData();
  }

  function renderFilteredData() {
    const keyword = searchInput.value.toLowerCase();
    const tbody = document.getElementById('recordsBody');
    tbody.innerHTML = '';

    const filtered = allData.filter(item =>
      item.receiverName?.toLowerCase().includes(keyword) ||
      item.phone?.toLowerCase().includes(keyword) ||
      item.address?.toLowerCase().includes(keyword) ||
      item.product?.toLowerCase().includes(keyword)
    );

    
filtered.forEach(data => {
      const timeStr = data.timestamp.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      const receiverBase = (data.receiverName || '');
      const receiver = data.customerAccount ? `${receiverBase} (${data.customerAccount})` : receiverBase;

      // 商品顯示：可見內容 + （不顯示內容）
      let productStr = '';
      const p1 = (data.product || '').trim();
      const p2 = (data.product2 || '').trim();
      if (p1 && p2) productStr = `${p1}（${p2}）`;
      else if (p1) productStr = p1;
      else if (p2) productStr = `（${p2}）`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td>${receiver}</td>
        <td>${data.address || ''}</td>
        <td>${data.phone || ''}</td>
        <td>${productStr}</td>
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
