import { db, auth } from '/js/firebase.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.onload = async () => {
  const nickname = localStorage.getItem('nickname') || '使用者';
  document.querySelector('h2').innerHTML = '✉️ 列印信封系統';

  const senderCompany = document.getElementById('senderCompany');
  const customSenderField = document.getElementById('customSenderField');

  senderCompany.addEventListener('change', () => {
    customSenderField.style.display = senderCompany.value === '其他' ? 'block' : 'none';
  });

  document.getElementById('printNormal').addEventListener('click', () => handlePrint(false));
  document.getElementById('printReply').addEventListener('click', () => handlePrint(true));

  await loadTodayRecords();
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
    const printUrl = isReply ? '/print-reply.html' : '/print.html';
    window.open(printUrl + '?' + new URLSearchParams(record), '_blank');
  } catch (err) {
    console.error('寫入失敗', err);
  }
}

async function loadTodayRecords() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const q = query(collection(db, 'envelopes', today, 'records'), orderBy('timestamp'));
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
      <td><a href="#">補印</a></td>
    `;
    tbody.appendChild(tr);
  });
}