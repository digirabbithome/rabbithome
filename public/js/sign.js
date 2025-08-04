
import { db, storage } from '/js/firebase.js';
import {
  collection, addDoc, updateDoc, getDocs, serverTimestamp, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadString, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

async function loadPayers() {
  const snap = await getDocs(collection(db, 'users'));
  const payerSelect = document.getElementById('payerSelect');
  snap.forEach(doc => {
    const d = doc.data();
    if (d.nickname) {
      const option = document.createElement('option');
      option.value = d.nickname;
      option.textContent = d.nickname;
      payerSelect.appendChild(option);
    }
  });
}

window.onload = async () => {
  const nickname = localStorage.getItem('nickname');
  if (!nickname) {
    alert('請先登入帳號！');
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('nickname').textContent = nickname;
  await loadPayers();

  const type1 = document.getElementById('type1');
  const container = document.getElementById('type2-container');

  type1.addEventListener('change', () => {
    if (type1.value === '供應商') {
      container.innerHTML = `
        <input type="text" id="type2-search" placeholder="搜尋供應商" required />
        <ul id="type2-list" class="popup-list"></ul>
      `;
      const searchBox = document.getElementById('type2-search');
      searchBox.addEventListener('input', () => {
        const keyword = searchBox.value.toLowerCase();
        if (!keyword) {
          document.getElementById('type2-list').innerHTML = '';
          return;
        }
        keyword = searchBox.value.toLowerCase();
        const list = document.getElementById('type2-list');
        list.innerHTML = '';
        getDocs(collection(db, 'suppliers')).then(snap => {
          snap.forEach(doc => {
            const d = doc.data();
            if (
      d.code &&
      d.shortName &&
      d.code !== '000' &&
      !/測試|test|樣品/.test(d.shortName)
    ) {
              const name = d.shortName.length > 4 ? d.shortName.slice(0, 4) : d.shortName;
              const label = d.code + ' - ' + name;
              if (label.toLowerCase().includes(keyword) || d.shortName.toLowerCase().includes(keyword)) {
                const li = document.createElement('li');
                li.textContent = label;
                li.onclick = () => {
                  searchBox.value = label;
                  list.innerHTML = '';
                };
                list.appendChild(li);
              }
            }
          });
        });
      });
    } else if (type1.value === '物流') {
      container.innerHTML = `
        <select id="type2" required>
          <option>新竹</option><option>黑貓</option><option>大榮</option>
          <option>宅配通</option><option>順豐</option>
          <option>Uber</option><option>LALA</option><option>其他</option>
        </select>`;
    } else {
      container.innerHTML = '<input type="text" id="type2" placeholder="請填寫名稱" required>';
    }
  });

  const form = document.getElementById('sign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = Number(document.getElementById('amount').value);
    const note = document.getElementById('note').value;
    const type1 = document.getElementById('type1').value;
    const payer = document.getElementById('payerSelect').value;
    const cashboxChecked = document.getElementById('cashboxCheckbox').checked;

    const searchInput = document.getElementById('type2-search');
    const selectInput = document.getElementById('type2');
    let type2 = '';
    if (searchInput) {
      type2 = searchInput.value.trim();
    } else if (selectInput) {
      type2 = selectInput.value.trim();
    }

    const canvas = document.getElementById('signature');
    const imageData = canvas.toDataURL('image/png');

    if (!payer || !amount || type1 === '' || type2 === '') {
      alert('請填寫所有欄位與簽名');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'signs'), {
        amount,
        note,
        type1,
        type2,
        nickname: payer,
        cashbox: cashboxChecked,
        createdAt: serverTimestamp()
      });

      const imageRef = ref(storage, 'signatures/' + docRef.id + '.png');
      await uploadString(imageRef, imageData, 'data_url');
      const imageUrl = await getDownloadURL(imageRef);
      await updateDoc(docRef, { signatureUrl: imageUrl });

      if (cashboxChecked) {
        // 讀取現有 cashbox 金額
        const statusRef = doc(db, 'cashbox-status', 'main');
        const statusSnap = await getDoc(statusRef);
        const currentAmount = statusSnap.exists() ? statusSnap.data().amount || 0 : 0;
        const newAmount = currentAmount - amount;

        const reason = `${type1} - ${type2}${note ? ' / ' + note : ''}`;

        await addDoc(collection(db, 'cashbox-records'), {
          amount,
          type: 'out',
          user: payer,
          reason,
          createdAt: serverTimestamp(),
          balanceAfter: newAmount
        });

        await updateDoc(statusRef, {
          amount: newAmount,
          updatedAt: serverTimestamp(),
          updatedBy: payer
        });
      }

      alert('簽收紀錄已送出！');
      window.location.reload();
    } catch (err) {
      console.error('寫入錯誤', err);
      alert('送出失敗，請稍後再試');
    }
  });
};