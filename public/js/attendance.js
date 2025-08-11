import { db, auth } from '/js/firebase.js';
import { collection, getDocs, doc, updateDoc, query, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const pad2 = n => String(n).padStart(2,'0');
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' });

window.onload = () => {
  onAuthStateChanged(auth, async user => {
    if (!user) { alert('請先登入'); return; }
    document.getElementById('refresh').onclick = loadAttendance;
    document.getElementById('monthPicker').value = new Date().toISOString().slice(0,7);
    loadAttendance();
  });
};

async function loadAttendance() {
  const month = document.getElementById('monthPicker').value;
  const tableDiv = document.getElementById('attendanceTable');
  tableDiv.innerHTML = '載入中...';

  const q = query(collection(db, 'attendance'), where('month', '==', month));
  const snap = await getDocs(q);
  let html = '<table><tr><th>日期</th><th>打卡時數</th><th>狀態</th><th>操作</th></tr>';
  
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const hours = d.hoursWorked ?? 0;
    const date = d.date;
    html += `<tr>
      <td>${date}</td>
      <td>${hours}</td>
      <td>${d.status || ''}</td>
      <td><button class="edit-hours" data-id="${docSnap.id}">✏️</button></td>
    </tr>`;
  });
  html += '</table>';
  tableDiv.innerHTML = html;

  document.querySelectorAll('.edit-hours').forEach(btn => {
    btn.onclick = async () => {
      const newHours = prompt('輸入新的工時（小時數，可含0.5）');
      if (!isNaN(parseFloat(newHours))) {
        await updateDoc(doc(db, 'attendance', btn.dataset.id), { hoursWorked: parseFloat(newHours) });
        loadAttendance();
      }
    };
  });
}
