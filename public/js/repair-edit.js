
import { db } from '/js/firebase.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  const repairID = params.get('id') || 'REPAIR123';
  const nickname = localStorage.getItem('nickname') || '未知';

  document.getElementById('repair-id').textContent = repairID;

  const docRef = doc(db, 'repairs', repairID);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    alert('找不到這筆維修資料');
    return;
  }

  const data = docSnap.data();

  document.getElementById('supplier').textContent = data.supplier || '';
  document.getElementById('contact').textContent = data.contact || '';
  document.getElementById('warranty').textContent = data.warranty || '';
  document.getElementById('description').textContent = data.description || '';
  document.getElementById('creator').textContent = data.creator || '';

  const history = data.history || {};

  if (history.status2) {
    document.getElementById('status2-info').textContent = history.status2.by + '（' + history.status2.time + '）';
    document.getElementById('status2-text').value = history.status2.note;
    document.getElementById('status-to-2').disabled = true;
  }

  if (history.status3) {
    document.getElementById('status3-info').textContent = history.status3.by + '（' + history.status3.time + '）';
    document.getElementById('status3-text').value = history.status3.note;
    document.getElementById('status-to-3').disabled = true;
  }

  if (history.status4) {
    document.getElementById('status4-info').textContent = history.status4.by + '（' + history.status4.time + '）';
    document.getElementById('status-to-4').disabled = true;
  }

  document.getElementById('status-to-2').addEventListener('click', async () => {
    const note = document.getElementById('status2-text').value;
    const now = new Date().toLocaleString();
    const update = {
      ['history.status2']: { by: nickname, time: now, note },
      status: 2
    };
    await updateDoc(docRef, update);
    alert('已更新為「已交付廠商」');
    location.reload();
  });

  document.getElementById('status-to-3').addEventListener('click', async () => {
    const note = document.getElementById('status3-text').value;
    const now = new Date().toLocaleString();
    const update = {
      ['history.status3']: { by: nickname, time: now, note },
      status: 3
    };
    await updateDoc(docRef, update);
    alert('已更新為「維修完成」');
    location.reload();
  });

  document.getElementById('status-to-4').addEventListener('click', async () => {
    const now = new Date().toLocaleString();
    const update = {
      ['history.status4']: { by: nickname, time: now },
      status: 4
    };
    await updateDoc(docRef, update);
    alert('已更新為「客人已取貨」');
    location.reload();
  });
};
