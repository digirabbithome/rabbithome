import { db } from '/js/firebase.js';
import { collection, query, orderBy, addDoc, serverTimestamp, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const nickname = localStorage.getItem('nickname') || '不明使用者';
document.getElementById('page-title').textContent = `${nickname}的出勤日記`;

const recordBody = document.getElementById('record-body');
const totalHoursEl = document.getElementById('total-hours');
const totalDiffEl = document.getElementById('total-diff');

// 即時顯示與加總
let monthlyTotal = 0;
let monthlyDiff = 0;
let todayDate = new Date().toISOString().slice(0, 10);
let todayData = { clockIn: '', clockOut: '', hours: 0, diff: 0 };

async function loadRecords() {
  recordBody.innerHTML = '';
  monthlyTotal = 0;
  monthlyDiff = 0;
  const q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    const diff = (d.hours || 0) - (d.standardHours || 8);
    monthlyTotal += d.hours || 0;
    monthlyDiff += diff;
    const row = `<tr>
      <td>${d.date}</td>
      <td>${d.clockIn || ''}</td>
      <td>${d.clockOut || ''}</td>
      <td>${d.hours || 0}</td>
      <td>${diff}</td>
      <td contenteditable="true" data-id="${docSnap.id}" class="note-cell">${d.note || ''}</td>
    </tr>`;
    recordBody.insertAdjacentHTML('beforeend', row);
  });
  totalHoursEl.textContent = monthlyTotal.toFixed(1);
  totalDiffEl.textContent = monthlyDiff.toFixed(1);
}

document.getElementById('clock-in').addEventListener('click', async () => {
  if (todayData.clockIn) return; // 防止重複打卡
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  todayData.clockIn = timeStr;
  await addDoc(collection(db, 'attendance'), {
    date: todayDate,
    clockIn: timeStr,
    clockOut: '',
    hours: 0,
    standardHours: 8,
    note: '',
    nickname,
    createdAt: serverTimestamp()
  });
  await loadRecords(); // 即時刷新
});

document.getElementById('clock-out').addEventListener('click', async () => {
  if (!todayData.clockIn || todayData.clockOut) return;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  todayData.clockOut = timeStr;
  const [h1, m1] = todayData.clockIn.split(':').map(Number);
  const [h2, m2] = timeStr.split(':').map(Number);
  todayData.hours = ((h2*60 + m2) - (h1*60 + m1)) / 60;
  todayData.diff = todayData.hours - 8;
  await addDoc(collection(db, 'attendance'), {
    date: todayDate,
    clockIn: todayData.clockIn,
    clockOut: todayData.clockOut,
    hours: todayData.hours,
    standardHours: 8,
    note: '',
    nickname,
    createdAt: serverTimestamp()
  });
  await loadRecords();
});

window.onload = loadRecords;
