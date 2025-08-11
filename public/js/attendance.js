import { db } from '/js/firebase.js';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const nickname = localStorage.getItem('nickname') || '未知使用者';
document.getElementById('nickname-title').textContent = nickname + ' 的出勤日記';

const recordsBody = document.getElementById('records-body');
const totalHoursEl = document.getElementById('total-hours');
const totalDiffEl = document.getElementById('total-diff');

async function loadRecords() {
  const q = query(collection(db, 'attendance'), where('nickname', '==', nickname), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  let totalHours = 0, totalDiff = 0;
  recordsBody.innerHTML = '';
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    const diff = (d.hours || 0) - (d.expectedHours || 0);
    totalHours += d.hours || 0;
    totalDiff += diff;
    recordsBody.innerHTML += `<tr>
      <td>${d.date}</td>
      <td>${d.clockIn || ''}</td>
      <td>${d.clockOut || ''}</td>
      <td>${d.hours || ''}</td>
      <td>${diff}</td>
      <td contenteditable onblur="saveNote('${docSnap.id}', this.innerText)">${d.note || ''}</td>
    </tr>`;
  });
  totalHoursEl.textContent = totalHours;
  totalDiffEl.textContent = totalDiff;
}

window.saveNote = async (id, note) => {
  await updateDoc(doc(db, 'attendance', id), { note });
};

document.getElementById('clock-in-btn').addEventListener('click', async () => {
  const today = new Date().toISOString().split('T')[0];
  await addDoc(collection(db, 'attendance'), {
    nickname, date: today, clockIn: new Date().toLocaleTimeString('zh-TW', { hour12: false }), expectedHours: 8, createdAt: serverTimestamp()
  });
  await loadRecords();
});

document.getElementById('clock-out-btn').addEventListener('click', async () => {
  const today = new Date().toISOString().split('T')[0];
  await addDoc(collection(db, 'attendance'), {
    nickname, date: today, clockOut: new Date().toLocaleTimeString('zh-TW', { hour12: false }), hours: 8, expectedHours: 8, createdAt: serverTimestamp()
  });
  await loadRecords();
});

loadRecords();