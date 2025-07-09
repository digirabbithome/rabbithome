import { db, auth } from '/js/firebase.js';
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('load', async () => {
  const form = document.getElementById('envelopeForm');
  const otherField = document.getElementById('customSenderField');
  const companySelect = document.getElementById('senderCompany');
  const addressInput = document.getElementById('address');
  const todayList = document.getElementById('todayRecords');

  const nickname = localStorage.getItem('nickname') || '匿名';

  // 控制「其他」寄件公司欄位顯示
  companySelect.addEventListener('change', () => {
    if (companySelect.value === '其他') {
      otherField.style.display = 'block';
    } else {
      otherField.style.display = 'none';
    }
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
      await loadTodayRecords();
    } catch (err) {
      alert('❌ 寫入失敗：' + err.message);
    }
  });

  async function loadTodayRecords() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const q = query(
      collection(db, 'envelopes'),
      where('timestamp', '>=', Timestamp.fromDate(today)),
      where('timestamp', '<', Timestamp.fromDate(tomorrow)),
      orderBy('timestamp', 'desc')
    );

    const querySnapshot = await getDocs(q);
    todayList.innerHTML = '';
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const time = data.timestamp.toDate().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${time}</td>
        <td>${data.receiverName || ''}</td>
        <td>${data.address || ''}</td>
        <td>${data.phone || ''}</td>
        <td>${data.product || ''}</td>
        <td>${data.source || ''}</td>
        <td>${data.account || ''}</td>
        <td><button onclick="window.open('/print.html', '_blank')">重新列印</button></td>
      `;
      todayList.appendChild(row);
    });
  }

  await loadTodayRecords();
});
