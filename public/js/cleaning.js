
import { db, auth } from '/js/firebase.js';
import {
  collection, addDoc, getDocs, onSnapshot, serverTimestamp, query, orderBy, doc, setDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

let currentUser = '';
const adminEmails = ['swimming8250@yahoo.com.tw', 'swimming8250@gmail.com'];

window.onload = async () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      document.body.innerHTML = '<h2>請先登入帳號再進入此頁面</h2>';
      return;
    }
    currentUser = localStorage.getItem('nickname') || user.email;
    await loadDutyPerson(); // ✅ 顯示本月值日生（插入在標題內）
    loadTasks();
    loadRecords();
  });
};

async function loadDutyPerson() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const docRef = doc(db, 'cleaningDuty', monthKey);
  const docSnap = await getDoc(docRef);
  let dutyUser = '';
  if (docSnap.exists()) {
    dutyUser = docSnap.data().user;
  }

  const title = document.querySelector('h1');
  if (title) {
    title.innerHTML = `🧹 值日打掃日誌（本月值日生：${dutyUser || '尚未指定'}）｜${currentUser}`;
  }

  // 如果是管理者，顯示設定選單與新增項目
  if (adminEmails.includes(auth.currentUser.email)) {
    const container = document.getElementById('task-form');
    const userSnap = await getDocs(collection(db, 'users'));
    const allUsers = userSnap.docs.map(doc => doc.data().nickname).filter(Boolean);

    const flexBox = document.createElement('div');
    flexBox.style.display = 'flex';
    flexBox.style.flexWrap = 'wrap';
    flexBox.style.alignItems = 'center';
    flexBox.style.gap = '8px';
    flexBox.style.marginBottom = '10px';

    const select = document.createElement('select');
    select.innerHTML = `<option value="">-- 選擇本月值日生 --</option>`;
    allUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.innerText = u;
      if (u === dutyUser) opt.selected = true;
      select.appendChild(opt);
    });
    flexBox.appendChild(select);

    const setBtn = document.createElement('button');
    setBtn.innerText = '✔️ 設定值日生';
    setBtn.onclick = async () => {
      const selected = select.value;
      if (!selected) return alert('請選擇值日生');
      await setDoc(docRef, { month: monthKey, user: selected });
      alert(`已設定 ${selected} 為本月值日生！`);
      location.reload();
    };
    flexBox.appendChild(setBtn);

    const addBtn = document.createElement('button');
    addBtn.innerText = '➕ 新增項目';
    addBtn.onclick = () => {
      const name = prompt('輸入新項目名稱');
      if (name) addDoc(collection(db, 'cleaningTasks'), { name, createdAt: serverTimestamp(), status: 'active' });
    };
    flexBox.appendChild(addBtn);

    
    // 🔻 新增刪除項目選單與按鈕
    const deleteSelect = document.createElement('select');
    deleteSelect.innerHTML = `<option value="">-- 選擇要刪除的項目 --</option>`;
    const taskSnap = await getDocs(collection(db, 'cleaningTasks'));
    const taskList = taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(task => task.status !== 'deleted');
    taskList.forEach(task => {
      const opt = document.createElement('option');
      opt.value = task.id;
      opt.innerText = task.name;
      deleteSelect.appendChild(opt);
    });
    flexBox.appendChild(deleteSelect);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = '🗑️ 刪除項目';
    
    deleteBtn.onclick = async () => {
      const id = deleteSelect.value;
      if (!id) return alert('請選擇要刪除的項目');
      if (!confirm('確定要刪除這個項目嗎？')) return;
      await setDoc(doc(db, 'cleaningTasks', id), { status: 'deleted' }, { merge: true });
      alert('已標記為刪除，請重新整理');
      location.reload();
    };

    flexBox.appendChild(deleteBtn);

    container.appendChild(flexBox);
    
  }
}

async function loadTasks() {
  const formDiv = document.getElementById('task-form');
  const taskCol = collection(db, 'cleaningTasks');
  const taskSnap = await getDocs(taskCol);
  const taskList = taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(task => task.status !== 'deleted');

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
  const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;

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

  const taskSnap = await getDocs(collection(db, 'cleaningTasks'));
  const activeTasks = taskSnap.docs
    .map(doc => doc.data())
    .filter(task => task.status !== 'deleted' && !!task.name)
    .map(task => task.name);

  const records = snap.docs
    .map(doc => doc.data())
    .filter(r => {
      const d = new Date(r.date);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      return d >= twoMonthsAgo;
    });

  const allTasksSet = new Set();
  records.forEach(r => r.items?.forEach(item => {
    if (activeTasks.includes(item)) allTasksSet.add(item);
  }));
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

