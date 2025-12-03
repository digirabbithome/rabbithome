import { db, storage } from '/js/firebase.js';
import {
  collection, addDoc, updateDoc, getDocs, serverTimestamp, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadString, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

/* ---------------------------------------------
   付款人載入（只抓正職/兼職，並排序）
--------------------------------------------- */

async function loadPayers() {
  const snap = await getDocs(collection(db, 'users'));
  const payerSelect = document.getElementById('payerSelect');

  // 允許的身份（正職 / 兼職）
  const allowedEmployment = ['full-time', 'part-time'];

  // 優先排序名單
  const priority = ['花花', '阿寶', 'Laura'];

  const payers = [];

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const nickname = d.nickname;
    if (!nickname) return;

    const employment = d.employment || '';

    // 只保留 full-time / part-time
    if (!allowedEmployment.includes(employment)) return;

    payers.push(nickname);
  });

  // 去重複
  const uniquePayers = [...new Set(payers)];

  // 排序邏輯
  uniquePayers.sort((a, b) => {
    const ia = priority.indexOf(a);
    const ib = priority.indexOf(b);

    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;

    return a.localeCompare(b, 'zh-Hant'); // 中文排序
  });

  // 清空原選單
  payerSelect.innerHTML = '';

  // 寫入排序後結果
  uniquePayers.forEach(nick => {
    const option = document.createElement('option');
    option.value = nick;
    option.textContent = nick;
    payerSelect.appendChild(option);
  });
}

/* ---------------------------------------------
   主程序 onload
--------------------------------------------- */

window.onload = async () => {
  const nickname = localStorage.getItem('nickname');
  if (!nickname) {
    alert('請先登入帳號！');
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('nickname').textContent = nickname;
  await loadPayers();

  // 預選登入者（如果他是正職/兼職）
  const payerSelect = document.getElementById('payerSelect');
  if (payerSelect && Array.from(payerSelect.options).some(o => o.value === nickname)) {
    payerSelect.value = nickname;
  }

  const type1 = document.getElementById('type1');
  const container = document.getElementById('type2-container');

  /* ---------------------------------------------
     第一層身分切換（供應商 / 物流 / 其他）
  --------------------------------------------- */
  type1.addEventListener('change', () => {
    if (type1.value === '供應商') {
      container.innerHTML = `
        <input type="text" id="type2-search" placeholder="搜尋供應商" required />
        <ul id="type2-list" class="popup-list"></ul>
      `;

      const searchBox = document.getElementById('type2-search');

      searchBox.addEventListener('input', () => {
        const keyword = searchBox.value.toLowerCase();
        const list = document.getElementById('type2-list');

        if (!keyword) {
          list.innerHTML = '';
          return;
        }

        list.innerHTML = '';

        getDocs(collection(db, 'suppliers')).then(snap => {
          snap.forEach(docSnap => {
            const d = docSnap.data();

            if (
              d.code &&
              d.shortName &&
              d.code !== '000' &&
              !/測試|test|樣品/i.test(d.shortName)
            ) {
              const name = d.shortName.length > 4 ? d.shortName.slice(0, 4) : d.shortName;
              const label = `${d.code} - ${name}`;

              if (label.toLowerCase().includes(keyword)) {
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
          <option value="">請選擇物流公司</option>
          <option>新竹</option>
          <option>黑貓</option>
          <option>大榮</option>
          <option>宅配通</option>
          <option>順豐</option>
          <option>UPS</option>
          <option>DHL</option>
          <option>Uber</option>
          <option>LALA</option>
          <option>其他</option>
        </select>
      `;

    } else {
      container.innerHTML =
        '<input type="text" id="type2" placeholder="請填寫名稱" required>';
    }
  });

  /* ---------------------------------------------
     提交表單
  --------------------------------------------- */
  const form = document.getElementById('sign-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = Number(document.getElementById('amount').value);
    const note = document.getElementById('note').value;
    const type1Value = type1.value;
    const payer = payerSelect.value;
    const cashboxChecked = document.getElementById('cashboxCheckbox').checked;

    const inputSearch = document.getElementById('type2-search');
    const inputSelect = document.getElementById('type2');

    let type2 = '';
    if (inputSearch) {
      type2 = inputSearch.value.trim();
    } else if (inputSelect) {
      type2 = inputSelect.value.trim();
    }

    const canvas = document.getElementById('signature');
    const imageData = canvas.toDataURL('image/png');

    if (!payer || !amount || !type1Value || !type2) {
      alert('請填寫所有欄位與簽名');
      return;
    }

    try {
      // 1️⃣ 新增簽收資料
      const docRef = await addDoc(collection(db, 'signs'), {
        amount,
        note,
        type1: type1Value,
        type2,
        nickname: payer,          // 簽收人
        operator: nickname,       // 操作人
        cashbox: cashboxChecked,
        createdAt: serverTimestamp()
      });

      // 2️⃣ 上傳簽名圖片
      const imgRef = ref(storage, `signatures/${docRef.id}.png`);
      await uploadString(imgRef, imageData, 'data_url');
      const url = await getDownloadURL(imgRef);
      await updateDoc(docRef, { signatureUrl: url });

      // 3️⃣ 若有扣錢櫃 → cashbox workflow
      if (cashboxChecked) {
        const statusRef = doc(db, 'cashbox-status', 'main');
        const statusSnap = await getDoc(statusRef);

        const currentAmount = statusSnap.exists() ? statusSnap.data().amount || 0 : 0;
        const newAmount = currentAmount - amount;

        const reason = `${type1Value} - ${type2}${note ? ' / ' + note : ''}`;

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
