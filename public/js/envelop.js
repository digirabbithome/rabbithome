import { db } from '/js/firebase.js';
import { collection, addDoc, Timestamp, query, where, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-lite.js';

window.addEventListener('load', () => {
  const form = document.getElementById('envelopeForm');
  const otherField = document.getElementById('customSenderField');
  const companySelect = document.getElementById('senderCompany');

  companySelect.addEventListener('change', () => {
    otherField.style.display = companySelect.value === '其他' ? 'block' : 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const senderCompany = form.senderCompany.value;
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
      senderCompany,
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
    window.open('/print.html', '_blank');

    try {
      await addDoc(collection(db, 'envelopes'), record);
      alert('✅ 資料已儲存！');
      form.reset();
      companySelect.value = '數位小兔';
      otherField.style.display = 'none';
      loadTodayRecords(); // 更新表格
    } catch (err) {
      alert('❌ 寫入失敗：' + err.message);
    }
  });

  loadTodayRecords();
});

async function loadTodayRecords() {
  const tbody = document.getElementById('recordsBody');
  if (!tbody) return;

  tbody.innerHTML = '🔄 載入中...';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const q = query(
    collection(db, 'envelopes'),
    where('timestamp', '>=', Timestamp.fromDate(todayStart)),
    where('timestamp', '<', Timestamp.fromDate(todayEnd)),
    orderBy('timestamp', 'desc')
  );

  try {
    const snapshot = await getDocs(q);
    let html = '';
    snapshot.forEach(doc => {
      const d = doc.data();
      const ts = d.timestamp?.toDate?.();
      const timeStr = ts ? `${ts.getHours()}:${ts.getMinutes().toString().padStart(2, '0')}` : '';
      html += `
        <tr>
          <td>${timeStr}</td>
          <td>${d.receiverName || ''}</td>
          <td>${d.address || ''}</td>
          <td>${d.phone || ''}</td>
          <td>${d.product || ''}</td>
          <td>${d.source || ''}</td>
          <td>${d.account || ''}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html || '<tr><td colspan="7">😴 今日尚無資料</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">❌ 載入失敗：${err.message}</td></tr>`;
  }
}
