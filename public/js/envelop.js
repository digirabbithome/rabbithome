
import { db, auth } from '/js/firebase.js';
import { collection, addDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('load', () => {
  const form = document.getElementById('envelopeForm');
  const otherField = document.getElementById('customSenderField');
  const companySelect = document.getElementById('senderCompany');
  const addressInput = document.getElementById('address');

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

    // 儲存進 localStorage 給 print.html 使用
    localStorage.setItem('envelopeData', JSON.stringify(record));

    // 稍微延遲再開啟新頁列印，避免資料還沒寫入 localStorage
    setTimeout(() => {
      window.open('/print.html', '_blank');
    }, 200);

    // 寫入 Firebase
    try {
      await addDoc(collection(db, 'envelopes'), record);
      alert('✅ 資料已儲存！');
      form.reset();
      companySelect.value = '數位小兔';
      otherField.style.display = 'none';
    } catch (err) {
      alert('❌ 寫入失敗：' + err.message);
    }
  });
});
