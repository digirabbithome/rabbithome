
import { db } from '/js/firebase.js';
import {
  doc, setDoc, getDoc, collection, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const today = new Date();
const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
document.getElementById('date-title').textContent = `📅 ${dateStr} 每日工作狀態`;

const nickname = localStorage.getItem('nickname') || '匿名';
const workList = document.getElementById('work-list');

async function fetchWorkItems() {
  const snapshot = await getDocs(collection(db, 'workItems'));
  const workItems = snapshot.docs.map(doc => doc.data().text);
  renderWorkList(workItems);
}

function renderWorkList(items) {
  workList.innerHTML = '';
  items.forEach(task => {
    const row = document.createElement('tr');
    const taskCell = document.createElement('td');
    taskCell.textContent = task;

    const statusCell = document.createElement('td');
    statusCell.id = `status-${task}`;
    statusCell.style.whiteSpace = 'nowrap';
    statusCell.style.textAlign = 'left';

    row.appendChild(taskCell);
    row.appendChild(statusCell);
    workList.appendChild(row);

    row.addEventListener('click', () => markTaskComplete(task));
    loadTaskStatus(task);
  });
}

async function markTaskComplete(task) {
  const now = new Date();
  const timeStr = now.toTimeString().substring(0,5);
  const ref = doc(db, 'dailyCheck', dateStr, task, nickname);
  const snap = await getDoc(ref);

  let data = {};
  if (snap.exists()) {
    const existing = snap.data();
    if (Array.isArray(existing.times)) {
      data = { times: [...existing.times, timeStr] };
    } else if (existing.time) {
      data = { times: [existing.time, timeStr] };
    } else {
      data = { times: [timeStr] };
    }
  } else {
    data = { times: [timeStr] };
  }

  await setDoc(ref, data);
  loadTaskStatus(task);
}

async function loadTaskStatus(task) {
  const container = document.getElementById(`status-${task}`);
  const ref = doc(db, 'dailyCheck', dateStr, task, nickname);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    let display = '';
    if (Array.isArray(data.times)) {
      display = data.times.join(', ');
    } else if (data.time) {
      display = data.time;
    }
    container.textContent = `${nickname} ${display} 完成`;
  } else {
    container.textContent = '';
  }
}

fetchWorkItems();
