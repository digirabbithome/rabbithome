
import { db, storage } from '/js/firebase.js';
import {
  collection, addDoc, updateDoc, serverTimestamp, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadString, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

window.onload = async () => {
  const nickname = localStorage.getItem('nickname') || '';
  const payerSelect = document.getElementById('payer');
  const users = await getUsers();
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.nickname;
    opt.textContent = u.nickname;
    payerSelect.appendChild(opt);
  });

  const form = document.getElementById('sign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payer = payerSelect.value;
    const amount = parseInt(document.getElementById('amount').value);
    const note = document.getElementById('note').value.trim();
    const type1 = document.getElementById('type1').value;
    const cashboxChecked = document.getElementById('cashboxCheck').checked;

    let type2 = '';
    const searchInput = document.getElementById('type2-search');
    const selectInput = document.getElementById('type2');
    if (searchInput && searchInput.style.display !== 'none') {
      type2 = searchInput.value.trim();
    } else if (selectInput) {
      type2 = selectInput.value.trim();
    }

    const canvas = document.getElementById('signature');
    const imageData = canvas.toDataURL('image/png');

    if (!amount || !imageData || !payer || !type1 || !type2) {
      alert('請填寫完整資訊並簽名');
      return;
    }

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

    if (cashboxChecked) {
      const statusRef = doc(db, 'cashbox-status', 'main');
      const snap = await getDoc(statusRef);
      const oldAmount = snap.exists() ? snap.data().amount : 0;
      const newAmount = oldAmount - amount;

      await updateDoc(statusRef, {
        amount: newAmount,
        updatedBy: payer,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'cashbox-records'), {
        amount,
        type: 'out',
        reason: `${type2}${note ? ' / ' + note : ''}`,
        createdAt: serverTimestamp(),
        balanceAfter: newAmount,
        user: payer
      });
    }

    alert('簽收紀錄已送出！');
    window.location.reload();
  });
};

async function getUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(doc => doc.data());
}
