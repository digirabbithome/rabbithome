
import { db } from '/js/firebase.js';
import { collection, addDoc, Timestamp, query, orderBy, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('load', async () => {
  const form = document.getElementById('envelopeForm');
  const otherField = document.getElementById('customSenderField');
  const companySelect = document.getElementById('senderCompany');
  const addressInput = document.getElementById('address');

  const today = new Date().toISOString().split('T')[0];

  companySelect.addEventListener('change', () => {
    otherField.style.display = companySelect.value === '其他' ? 'block' : 'none';
  });

  // 兩個按鈕
  const btnNormal = document.getElementById('printNormal');
  const btnReply = document.getElementById('printReply');

  const handleSubmit = async (type = "normal") => {
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
      otherField.style.display = 'none';
      loadTodayRecords(); // 重新載入
    } catch (err) {
      alert('❌ 寫入失敗：' + err.message);
    }
  };

  btnNormal.addEventListener('click', (e) => {
    e.preventDefault();
    handleSubmit("normal");
  });
  btnReply.addEventListener('click', (e) => {
    e.preventDefault();
    handleSubmit("reply");
  });

  async function loadTodayRecords() {
    const q = query(collection(db, 'envelopes'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const tbody = document.getElementById('recordsBody');
    tbody.innerHTML = '';

    snapshot.forEach(doc => {
      const data = doc.data();
      const ts = data.timestamp.toDate();
      const dateStr = ts.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td>${data.receiverName || ''}</td>
        <td>${data.address || ''}</td>
        <td>${data.phone || ''}</td>
        <td>${data.product || ''}</td>
        <td>${data.source || ''}</td>
        <td><a href="#" data-id="${doc.id}" data-type="${data.type || 'normal'}" class="reprint-link">補印信封</a></td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.reprint-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const docId = e.target.dataset.id;
        const type = e.target.dataset.type;
        const docSnap = await getDocs(query(collection(db, 'envelopes')));
        let targetData = null;
        docSnap.forEach(d => {
          if (d.id === docId) targetData = d.data();
        });
        if (targetData) {
          localStorage.setItem('envelopeData', JSON.stringify(targetData));
          window.open(type === "reply" ? '/print-reply.html' : '/print.html', '_blank');
        }
      });
    });
  }

  loadTodayRecords();
});
