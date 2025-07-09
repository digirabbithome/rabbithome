
import { db } from '/js/firebase.js';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

function formatTime(ts) {
  const date = ts.toDate();
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

async function loadTodayRecords() {
  const tbody = document.getElementById('recordsBody');
  tbody.innerHTML = '🕐 正在載入信封資料，請稍候...';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const q = query(
    collection(db, 'envelopes'),
    where('timestamp', '>=', Timestamp.fromDate(today)),
    where('timestamp', '<', Timestamp.fromDate(tomorrow))
  );

  try {
    const snapshot = await getDocs(q);
    tbody.innerHTML = '';
    snapshot.forEach(doc => {
      const d = doc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatTime(d.timestamp)}</td>
        <td>${d.receiverName || ''}</td>
        <td>${d.address || ''}</td>
        <td>${d.phone || ''}</td>
        <td>${d.product || ''}</td>
        <td>${d.source || ''}</td>
        <td>${d.account || ''}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7">❌ 無法載入資料</td></tr>';
  }
}

function handleEnvelopeSubmit(isReply = false) {
  const form = document.getElementById('envelopeForm');
  const companySelect = document.getElementById('senderCompany');
  const customSender = form.customSender?.value || '';
  const receiverName = form.receiverName.value;
  const phone = form.phone.value;
  const address = form.address.value;
  const product = form.product.value;
  const source = form.querySelector('input[name="source"]:checked')?.value || '';
  const nickname = localStorage.getItem('nickname') || '匿名';
  const fullSource = source ? `${nickname}(${source})` : nickname;
  const now = new Date();

  const record = {
    type: isReply ? 'reply' : 'normal',
    senderCompany: companySelect.value,
    customSender,
    receiverName,
    phone,
    address,
    product,
    source: fullSource,
    account: nickname,
    timestamp: Timestamp.fromDate(now)
  };

  localStorage.setItem('envelopeData', JSON.stringify(record));
  setTimeout(() => window.open(isReply ? '/print-reply.html' : '/print.html', '_blank'), 200);

  addDoc(collection(db, 'envelopes'), record)
    .then(() => {
      alert('✅ 資料已儲存！');
      form.reset();
      companySelect.value = '數位小兔';
      document.getElementById('customSenderField').style.display = 'none';
      loadTodayRecords();
    })
    .catch(err => {
      alert('❌ 寫入失敗：' + err.message);
    });
}

window.addEventListener('load', () => {
  loadTodayRecords();

  const form = document.getElementById('envelopeForm');
  const otherField = document.getElementById('customSenderField');
  const companySelect = document.getElementById('senderCompany');
  const normalBtn = document.getElementById('printNormal');
  const replyBtn = document.getElementById('printReply');

  companySelect.addEventListener('change', () => {
    otherField.style.display = (companySelect.value === '其他') ? 'block' : 'none';
  });

  normalBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleEnvelopeSubmit(false);
  });

  replyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleEnvelopeSubmit(true);
  });
});
