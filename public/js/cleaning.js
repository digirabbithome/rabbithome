import { db, auth } from '/js/firebase.js';
import {
  collection, addDoc, getDocs, onSnapshot, serverTimestamp, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

let currentUser = '';
const adminEmails = ['you@example.com', 'boss@example.com']; // ← 你可以改成你自己的帳號

window.onload = async () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      document.body.innerHTML = '<h2>請先登入帳號再進入此頁面</h2>';
      return;
    }
    currentUser = localStorage.getItem('nickname') || user.email;
    document.getElementById('user-name').innerText = `｜${currentUser}`;
    loadTasks();
    loadRecords();
  });
};


async function loadTasks() {
  const formDiv = document.getElementById('task-form');
  formDiv.innerHTML = '';

  const taskCol = collection(db, 'cleaningTasks');
  const taskSnap = await getDocs(taskCol);
  const taskList = taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const listDiv = document.createElement('div');
  listDiv.className = 'task-list';

  taskList.forEach(task => {
    const div = document.createElement('div');
    div.className = 'task-item';
    div.innerHTML = `
      <label><input type="checkbox" value="${task.name}"> ${task.name}</label>
    `;
    listDiv.appendChild(div);
  });

  formDiv.appendChild(listDiv);

  const btn = document.createElement('button');
  btn.innerText = '✅ 完成並送出';
  btn.onclick = () => submitTasks(taskList);
  formDiv.appendChild(btn);

  if (adminEmails.includes(auth.currentUser.email)) {
    const addBtn = document.createElement('button');
    addBtn.innerText = '➕ 新增項目';
    addBtn.onclick = () => {
      const name = prompt('輸入新項目名稱');
      if (name) addDoc(taskCol, { name, createdAt: serverTimestamp() });
    };
    formDiv.appendChild(addBtn);
  }
}


async function submitTasks(taskList) {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
  const items = Array.from(checkboxes).map(cb => cb.value);

  if (items.length === 0) {
    alert('請至少勾選一項任務！');
    return;
  }

  const now = new Date();
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

  await addDoc(collection(db, 'cleaningLog'), {
    user: currentUser,
    date,
    time,
    items,
    createdAt: serverTimestamp()
  });

  alert('打掃紀錄已送出！');
  loadRecords();
}

async function loadRecords() {
  const recordsDiv = document.getElementById('task-records');
  const q = query(collection(db, 'cleaningLog'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  const records = snap.docs
    .map(doc => doc.data())
    .filter(r => {
      const d = new Date(r.date);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      return d >= twoMonthsAgo;
    });

  // 整理所有出現過的任務名稱
  const allTasksSet = new Set();
  records.forEach(r => r.items?.forEach(item => allTasksSet.add(item)));
  const allTasks = Array.from(allTasksSet);

  let html = `<table><thead><tr><th>姓名</th><th>日期</th><th>時間</th>`;
  allTasks.forEach(name => html += `<th>${name}</th>`);
  html += `</tr></thead><tbody>`;

  records.forEach(r => {
    html += `<tr><td>${r.user}</td><td>${r.date}</td><td>${r.time}</td>`;
    allTasks.forEach(name => {
      html += `<td>${r.items.includes(name) ? '✅' : ''}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  recordsDiv.innerHTML = html;
}
