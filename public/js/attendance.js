
import { db } from '/js/firebase.js';
import { collection, doc, setDoc, getDocs, query, where, orderBy, serverTimestamp } 
  from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const nickname = localStorage.getItem('nickname') || '未登入使用者';
document.getElementById('nicknameTitle').textContent = nickname + ' 的出勤日記';

const btnIn = document.getElementById('btnClockIn');
const btnOut = document.getElementById('btnClockOut');
const tbody = document.querySelector('#attendanceTable tbody');

let currentMonthTotal = 0;
let currentMonthDiff = 0;

window.onload = async () => {
  await loadAttendance();
};

async function loadAttendance() {
  tbody.innerHTML = '';
  currentMonthTotal = 0;
  currentMonthDiff = 0;

  const today = new Date();
  const monthStr = today.toISOString().slice(0,7);
  const q = query(collection(db, 'attendance'), where('nickname','==',nickname), orderBy('date','desc'));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.date.startsWith(monthStr)) {
      const diff = (data.totalHours || 0) - (data.requiredHours || 0);
      currentMonthTotal += data.totalHours || 0;
      currentMonthDiff += diff;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${data.date}</td>
        <td>${data.clockIn || ''}</td>
        <td>${data.clockOut || ''}</td>
        <td>${data.totalHours || 0}</td>
        <td>${diff}</td>
        <td><input type="text" value="${data.note || ''}" data-id="${docSnap.id}" class="note-input"></td>
      `;
      tbody.appendChild(tr);
    }
  });

  document.getElementById('totalHours').textContent = currentMonthTotal.toFixed(1);
  document.getElementById('totalDiff').textContent = currentMonthDiff.toFixed(1);

  bindNoteEvents();
}

btnIn.addEventListener('click', async () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0,10);
  await setDoc(doc(collection(db,'attendance')), {
    nickname,
    date: dateStr,
    clockIn: now.toTimeString().slice(0,5),
    requiredHours: 9,
    timestamp: serverTimestamp()
  }, { merge: true });
  await loadAttendance();
});

btnOut.addEventListener('click', async () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0,10);
  await setDoc(doc(collection(db,'attendance')), {
    nickname,
    date: dateStr,
    clockOut: now.toTimeString().slice(0,5),
    totalHours: calcTotalHours(dateStr),
    requiredHours: 9,
    timestamp: serverTimestamp()
  }, { merge: true });
  await loadAttendance();
});

function bindNoteEvents() {
  document.querySelectorAll('.note-input').forEach(input => {
    input.addEventListener('blur', async (e) => {
      const id = e.target.dataset.id;
      const note = e.target.value;
      await setDoc(doc(db,'attendance',id), { note }, { merge: true });
    });
  });
}

function calcTotalHours(dateStr) {
  // 假設只有一段上下班
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const row = rows.find(r => r.children[0].textContent === dateStr);
  if (!row) return 0;
  const inTime = row.children[1].textContent;
  const outTime = row.children[2].textContent;
  if (!inTime || !outTime) return 0;

  const [inH,inM] = inTime.split(':').map(Number);
  const [outH,outM] = outTime.split(':').map(Number);
  let minutes = (outH*60+outM) - (inH*60+inM);
  let hours = Math.floor(minutes / 60);
  let rem = minutes % 60;
  if (rem >= 30) hours += 0.5;
  return hours;
}
