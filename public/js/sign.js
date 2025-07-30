
import { db, storage } from '/js/firebase.js';
import {
  collection, addDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadString, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

window.onload = () => {
  const form = document.getElementById('sign-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nickname = document.getElementById('payer').value;
    const amount = document.getElementById('amount').value;
    const note = document.getElementById('note').value;
    const type1 = document.getElementById('type1').value;

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

    if (!amount || !imageData || type1 === '' || type2 === '' || nickname === '') {
      alert('請填寫所有欄位並簽名');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'signs'), {
        amount,
        note,
        type1,
        type2,
        nickname,
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
