
import { db, storage } from '/js/firebase-sign.js';
import {
  collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

window.onload = async () => {
  const nickname = localStorage.getItem('nickname') || '未知使用者';
  document.getElementById('nickname').textContent = nickname;

  await loadNicknames();

  const form = document.getElementById('sign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payer = document.getElementById('payer').value;
      const type1 = document.getElementById('type1').value;
      let type2 = '';
      if (type1 === '供應商') {
        type2 = document.getElementById('type2-search').value.trim();
      } else {
        type2 = document.getElementById('type2')?.value.trim() || '';
      }
      const amount = parseInt(document.getElementById('amount').value);
      const note = document.getElementById('note').value.trim();
      const checkbox = document.getElementById('cashbox-checkbox');
      const isCashbox = checkbox && checkbox.checked;

      // 1. 儲存簽名圖
      const canvas = document.getElementById('signature');
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const filename = `sign_${Date.now()}.png`;
      const storageRef = ref(storage, 'signatures/' + filename);
      await uploadBytes(storageRef, blob);
      const imageUrl = await getDownloadURL(storageRef);

      // 2. 寫入主資料
      const docRef = await addDoc(collection(db, 'signs'), {
        createdAt: serverTimestamp(),
        signer: nickname,
        handler: payer, // 正確！使用付款人選擇值
        amount,
        note,
        type1,
        type2,
        imageUrl,
        cashbox: isCashbox
      });

      // 3. 若勾選內場錢櫃，更新餘額並寫入紀錄
      if (isCashbox) {
        const cashRef = doc(db, 'cashbox-status', 'currentBalance');
        const snap = await getDoc(cashRef);
        if (!snap.exists()) throw new Error('現金狀態不存在');
        const data = snap.data();
        const current = data.amount || 0;
        const newAmount = current - amount;
        await updateDoc(cashRef, { amount: newAmount });

        await addDoc(collection(db, 'cashbox-logs'), {
          createdAt: serverTimestamp(),
          from: payer,
          amount,
          type: '支出',
          nickname,
          note,
          remain: newAmount
        });
      }

      alert('✅ 送出成功！');
      location.reload();
    } catch (err) {
      console.error('發生錯誤：', err);
      alert('送出失敗，請稍後再試');
    }
  });
};

async function loadNicknames() {
  const snap = await getDocs(collection(db, 'users'));
  const payer = document.getElementById('payer');
  snap.forEach(doc => {
    const d = doc.data();
    if (d.nickname) {
      const opt = document.createElement('option');
      opt.textContent = d.nickname;
      payer.appendChild(opt);
    }
  });
}
