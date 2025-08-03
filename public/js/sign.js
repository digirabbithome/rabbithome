import { db, storage } from '/js/firebase.js';
import {
  collection, addDoc, updateDoc, getDocs, serverTimestamp
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

  const form = document.getElementById('sign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = document.getElementById('amount').value;
    const note = document.getElementById('note').value;
    const type1 = document.getElementById('type1').value;
    const payer = document.getElementById('payerSelect').value;

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
        createdAt: serverTimestamp()
      });

      const imageRef = ref(storage, 'signatures/' + docRef.id + '.png');
      await uploadString(imageRef, imageData, 'data_url');
      const imageUrl = await getDownloadURL(imageRef);
      await updateDoc(docRef, { signatureUrl: imageUrl });

      alert('簽收紀錄已送出！');
      window.location.reload();
    } catch (err) {
      console.error('寫入錯誤', err);
      alert('送出失敗，請稍後再試');
    }
  });
};
