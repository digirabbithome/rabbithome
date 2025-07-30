
import { db, storage } from '/js/firebase.js';
import {
  collection, addDoc, updateDoc, getDoc, getDocs, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadString, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

async function loadNicknames() {
  const snapshot = await getDocs(collection(db, 'users'));
  const nicknameSelect = document.getElementById('nickname');
  const payerSelect = document.getElementById('payer');

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.nickname) {
      const opt1 = document.createElement('option');
      opt1.value = data.nickname;
      opt1.textContent = data.nickname;
      nicknameSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = data.nickname;
      opt2.textContent = data.nickname;
      payerSelect.appendChild(opt2);
    }
  });
}

window.onload = () => {
  loadNicknames();

  const form = document.getElementById('sign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedNickname = document.getElementById('nickname').value;
    const payer = document.getElementById('payer').value;
    const amountStr = document.getElementById('amount').value;
    const amount = parseInt(amountStr);
    const note = document.getElementById('note').value;
    const type1 = document.getElementById('type1').value;
    const type2 = document.getElementById('type2-search')?.value.trim() || document.getElementById('type2')?.value.trim();
    const cashboxChecked = document.getElementById('cashbox')?.checked;

    const canvas = document.getElementById('signature');
    const imageData = canvas.toDataURL('image/png');

    if (!selectedNickname || !payer || !amount || !type1 || !type2 || !imageData) {
      alert('請填寫所有欄位並簽名');
      return;
    }

    try {
      // Step 1: 新增 signs 簽名資料
      const signRef = await addDoc(collection(db, 'signs'), {
        amount,
        note,
        type1,
        type2,
        nickname: selectedNickname,
        payer,
        cashbox: !!cashboxChecked,
        createdAt: serverTimestamp()
      });

      const imageRef = ref(storage, 'signatures/' + signRef.id + '.png');
      await uploadString(imageRef, imageData, 'data_url');
      const imageUrl = await getDownloadURL(imageRef);
      await updateDoc(signRef, { signatureUrl: imageUrl });

      // Step 2: 若勾選內場錢櫃，寫入 cashbox-records 並更新餘額
      if (cashboxChecked) {
        const statusRef = doc(db, 'cashbox-status', 'currentBalance');
        const statusSnap = await getDoc(statusRef);
        let currentBalance = statusSnap.exists() ? statusSnap.data().value || 0 : 0;
        const newBalance = currentBalance - amount;

        await addDoc(collection(db, 'cashbox-records'), {
          type: 'out',
          amount,
          reason: type2,
          user: payer,
          createdBy: selectedNickname,
          createdAt: serverTimestamp(),
          balanceAfter: newBalance
        });

        await updateDoc(statusRef, { value: newBalance });
      }

      alert('簽收紀錄已送出！');
      window.location.reload();
    } catch (err) {
      console.error('寫入錯誤', err);
      alert('送出失敗，請稍後再試');
    }
  });
};
