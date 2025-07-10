
import { db } from '/js/firebase.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.onload = () => {
  const nickname = localStorage.getItem('nickname') || '使用者';
  document.querySelector('h2').innerHTML = '✉️ 列印信封系統';

  const senderCompany = document.getElementById('senderCompany');
  const customSenderField = document.getElementById('customSenderField');

  senderCompany.addEventListener('change', () => {
    customSenderField.style.display = senderCompany.value === '其他' ? 'block' : 'none';
  });

  document.getElementById('printNormal').addEventListener('click', () => handlePrint(false));
  document.getElementById('printReply').addEventListener('click', () => handlePrint(true));

  document.getElementById('btnPrevDay').addEventListener('click', () => changeDateBy(-1));
  document.getElementById('btnLast3Days').addEventListener('click', () => changeDateBy(-3));
  document.getElementById('btnLastWeek').addEventListener('click', () => changeDateBy(-7));
  document.getElementById('datePicker').addEventListener('change', (e) => {
    if (e.target.value) loadRecordsByDate(e.target.value);
  });
  document.getElementById('searchInput').addEventListener('input', () => filterRecords());

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('datePicker').value = today;
  loadRecordsByDate(today);
};

async function handlePrint(isReply) {
  const form = document.getElementById('envelopeForm');
  const data = Object.fromEntries(new FormData(form).entries());

  const now = new Date();
  const timeString = now.toTimeString().substring(0, 5);
  const today = now.toISOString().split('T')[0];

  const nickname = localStorage.getItem('nickname') || '使用者';
  let source = data.source ? `(${data.source})` : '';
  if (isReply) source += '(回郵)';

  const record = {
    time: timeString,
    receiverName: data.receiverName || '',
    address: data.address || '',
    phone: data.phone || '',
    senderCompany: data.senderCompany,
    product: data.product || '',
    source: `${nickname}${source}`,
    type: isReply ? 'reply' : 'normal',
    timestamp: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, 'envelopes', today, 'records'), record);
    localStorage.setItem('envelopeData', JSON.stringify(record));
    const printUrl = isReply ? '/print-reply.html' : '/print.html';
    window.open(printUrl, '_blank');
  } catch (err) {
    console.error('寫入失敗', err);
  }
}

async function loadRecordsByDate(dateStr) {
  const q = query(collection(db, 'envelopes', dateStr, 'records'), orderBy('timestamp'));
  const snapshot = await getDocs(q);

  const tbody = document.getElementById('recordsBody');
  tbody.innerHTML = '';

  snapshot.forEach((doc) => {
    const d = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.time || ''}</td>
      <td>${d.receiverName || ''}</td>
      <td>${d.address || ''}</td>
      <td>${d.phone || ''}</td>
      <td>${d.source || ''}</td>
      <td><a href="#" class="reprint" data-json='${JSON.stringify(d)}'>補印</a></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('dateTitle').textContent = `📋 ${dateStr} 列印信封紀錄`;

  // 綁定補印功能
  document.querySelectorAll('.reprint').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const data = JSON.parse(el.dataset.json);
      localStorage.setItem('envelopeData', JSON.stringify(data));
      const url = data.type === 'reply' ? '/print-reply.html' : '/print.html';
      window.open(url, '_blank');
    })
  );

  filterRecords();
}

function changeDateBy(offset) {
  const picker = document.getElementById('datePicker');
  const newDate = new Date(picker.value || new Date());
  newDate.setDate(newDate.getDate() + offset);
  const formatted = newDate.toISOString().split('T')[0];
  picker.value = formatted;
  loadRecordsByDate(formatted);
}

function filterRecords() {
  const keyword = document.getElementById('searchInput').value.trim();
  const rows = document.querySelectorAll('#recordsBody tr');
  rows.forEach((row) => {
    const text = row.innerText;
    row.style.display = text.includes(keyword) ? '' : 'none';
  });
}
