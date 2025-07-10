
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
  getDoc,
  getDocsFromServer,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.onload = async () => {
  const nickname = localStorage.getItem('nickname') || '使用者';

  const senderCompany = document.getElementById('senderCompany');
  const customSenderField = document.getElementById('customSenderField');
  senderCompany.addEventListener('change', () => {
    customSenderField.style.display = senderCompany.value === '其他' ? 'block' : 'none';
  });

  document.getElementById('printNormal').addEventListener('click', () => handlePrint(false));
  document.getElementById('printReply').addEventListener('click', () => handlePrint(true));

  document.getElementById('btnPrevDay').addEventListener('click', () => loadRecordsByDates([getDateOffset(-1)]));
  document.getElementById('btnLast3Days').addEventListener('click', () => loadRecordsByDates(getDateRange(-2, 0)));
  document.getElementById('btnLastWeek').addEventListener('click', () => loadRecordsByDates(getDateRange(-6, 0)));
  document.getElementById('datePicker').addEventListener('change', (e) => {
    const date = e.target.value;
    if (date) loadRecordsByDates([date]);
  });
  document.getElementById('searchInput').addEventListener('input', async (e) => {
    const keyword = e.target.value.trim();
    if (keyword) {
      await searchAllRecords(keyword);
    } else {
      await loadRecordsByDates([getToday()]);
    }
  });

  await loadRecordsByDates([getToday()]);
};

function getToday() {
  return new Date().toISOString().split('T')[0];
}
function getDateOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}
function getDateRange(startOffset, endOffset) {
  const range = [];
  for (let i = startOffset; i <= endOffset; i++) {
    range.push(getDateOffset(i));
  }
  return range;
}

async function handlePrint(isReply) {
  const form = document.getElementById('envelopeForm');
  const data = Object.fromEntries(new FormData(form).entries());

  const now = new Date();
  const timeString = now.toTimeString().substring(0, 5);
  const today = getToday();

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

async function loadRecordsByDates(dates) {
  const tbody = document.getElementById('recordsBody');
  tbody.innerHTML = '';
  document.getElementById('dateTitle').textContent = `📋 查詢 ${dates.join(', ')} 的信封紀錄`;

  for (const date of dates) {
    const q = query(collection(db, 'envelopes', date, 'records'), orderBy('timestamp'));
    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => {
      const d = doc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.time || ''}</td>
        <td>${d.receiverName || ''}</td>
        <td>${d.address || ''}</td>
        <td>${d.phone || ''}</td>
        <td>${d.source || ''}</td>
        <td><a href="#" onclick="reprintEnvelope('${date}', '${doc.id}')">補印</a></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

window.reprintEnvelope = async (date, id) => {
  const docRef = collection(db, 'envelopes', date, 'records');
  const snapshot = await getDocs(query(docRef, where('__name__', '==', id)));
  if (!snapshot.empty) {
    const d = snapshot.docs[0].data();
    localStorage.setItem('envelopeData', JSON.stringify(d));
    const printUrl = d.type === 'reply' ? '/print-reply.html' : '/print.html';
    window.open(printUrl, '_blank');
  }
};

async function searchAllRecords(keyword) {
  const tbody = document.getElementById('recordsBody');
  tbody.innerHTML = '';
  document.getElementById('dateTitle').textContent = `🔍 搜尋結果：「${keyword}」`;

  const envelopesRef = collection(db, 'envelopes');
  const daysSnap = await getDocs(envelopesRef);
  for (const day of daysSnap.docs) {
    const date = day.id;
    const subRef = collection(db, 'envelopes', date, 'records');
    const subs = await getDocs(subRef);
    subs.forEach((doc) => {
      const d = doc.data();
      const keywordIn = [d.receiverName, d.phone, d.address, d.product].some(field =>
        field && field.includes(keyword)
      );
      if (keywordIn) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${d.time || ''}</td>
          <td>${d.receiverName || ''}</td>
          <td>${d.address || ''}</td>
          <td>${d.phone || ''}</td>
          <td>${d.source || ''}</td>
          <td><a href="#" onclick="reprintEnvelope('${date}', '${doc.id}')">補印</a></td>
        `;
        tbody.appendChild(tr);
      }
    });
  }
}
