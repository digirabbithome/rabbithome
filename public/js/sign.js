import { db, storage } from '/js/firebase.js';
import {
  collection, addDoc, doc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadString, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

window.onload = () => {
  const nickname = localStorage.getItem('nickname');
  if (!nickname) {
    alert('請先登入帳號！');
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('nickname').textContent = nickname;

  const form = document.getElementById('sign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = document.getElementById('amount').value;
    const note = document.getElementById('note').value;
    const type1 = document.getElementById('type1').value;
    const type2 = document.getElementById('type2')?.value || '';
    const canvas = document.getElementById('signature');
    const imageData = canvas.toDataURL('image/png');

    if (!amount || !imageData || type1 === '' || type2 === '') {
      alert('請填寫金額、選擇分類、公司資訊並簽名');
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

      await updateDoc(doc(docRef), { signatureUrl: imageUrl });

      alert('簽收紀錄已送出！');
      window.location.reload();
    } catch (err) {
      console.error('寫入錯誤', err);
      alert('送出失敗，請稍後再試');
    }
  });
};
