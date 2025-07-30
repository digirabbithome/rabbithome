
import { db, storage } from '/js/firebase.js';
import {
  collection, addDoc, updateDoc, getDoc, getDocs, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadString, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

async function loadPayers() {
  const snapshot = await getDocs(collection(db, 'users'));
  const payerSelect = document.getElementById('payer');

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.nickname) {
      const opt = document.createElement('option');
      opt.value = data.nickname;
      opt.textContent = data.nickname;
      payerSelect.appendChild(opt);
    }
  });
}

window.onload = () => {
  const loginNickname = localStorage.getItem('nickname') || '未登入';
  document.getElementById('login-user').textContent = loginNickname;
  loadPayers();

  const form = document.getElementById('sign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payer = document.getElementById('payer').value;
    const amountStr = document.getElementById('amount').value;
    const amount = parseInt(amountStr);
    const note = document.getElementById('note').value;
    const type1 = document.getElementById('type1').value;
    const type2 = document.getElementById('type2-search')?.value.trim() || document.getElementById('type2')?.value.trim();
    const cashboxChecked = document.getElementById('cashbox')?.checked;

    const canvas = document.getElementById('signature');
    const imageData = canvas.toDataURL('image/png');

    if (!loginNickname || !payer || !amount || !type1 || !type2 || !imageData) {
      alert('請填寫所有欄位並簽名');
      return;
    }

    try {
      const signRef = await addDoc(collection(db, 'signs'), {
        amount,
        note,
        type1,
        type2,
        nickname: loginNickname,
        payer,
        cashbox: !!cashboxChecked,
        createdAt: serverTimestamp()
      });

      const imageRef = ref(storage, 'signatures/' + signRef.id + '.png');
      await uploadString(imageRef, imageData, 'data_url');
      const imageUrl = await getDownloadURL(imageRef);
      await updateDoc(signRef, { signatureUrl: imageUrl });

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
          createdBy: loginNickname,
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
