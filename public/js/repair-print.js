import { db } from '/js/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const repairId = urlParams.get('id');
  if (!repairId) return;

  const docSnap = await getDoc(doc(db, 'repairs', repairId));
  if (!docSnap.exists()) return;
  const data = docSnap.data();

  document.getElementById('repairId').innerText = repairId;
  document.getElementById('fillDate').innerText = data.date || '';
  document.getElementById('warranty').innerText = data.warranty || '';
  document.getElementById('phone').innerText = data.phone || '';
  document.getElementById('address').innerText = data.address || '';
  document.getElementById('product').innerText = data.product || '';
  document.getElementById('description').innerText = data.description || '';
  document.getElementById('handler').innerText = data.nickname || '';
};
