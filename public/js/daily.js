
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, getDocs, collection, query, orderBy
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let selectedDate = getTodayString();
let nickname = localStorage.getItem("nickname") || "使用者";

document.addEventListener("DOMContentLoaded", async () => {
  renderDateButtons();
  document.getElementById("datePicker").value = selectedDate;
  document.getElementById("datePicker").addEventListener("change", async e => {
    selectedDate = e.target.value;
    await renderTasks();
  });
  await renderTasks();
});

function getTodayString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function renderDateButtons() {
  const container = document.getElementById("date-nav");
  container.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const dateStr = getTodayString(i);
    const btn = document.createElement("button");
    btn.textContent = i === 0 ? "今天" : `前${i}天`;
    btn.onclick = async () => {
      selectedDate = dateStr;
      document.getElementById("datePicker").value = selectedDate;
      await renderTasks();
    };
    container.appendChild(btn);
  }
}

async function renderTasks() {
  const taskListEl = document.getElementById("task-list");
  const recordListEl = document.getElementById("record-list");
  taskListEl.innerHTML = "";
  recordListEl.innerHTML = "";

  const snapshot = await getDocs(query(collection(db, "workItems"), orderBy("order")));
  const tasks = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    tasks.push(data.text);
  });

  const ref = doc(db, "dailyCheck", selectedDate);
  const snap = await getDoc(ref);
  const recordData = snap.exists() ? snap.data() : {};

  tasks.forEach(task => {
    const taskEl = document.createElement("div");
    taskEl.textContent = task;
    taskEl.onclick = () => markComplete(task);
    taskListEl.appendChild(taskEl);

    const row = document.createElement("div");
    row.className = "record-row";
    const logs = recordData[task] || {};
    row.textContent = Object.entries(logs).map(([name, time]) => `${name} ${time}`).join("　");
    recordListEl.appendChild(row);
  });
}

async function markComplete(task) {
  const now = new Date();
  const timeStr = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
  const ref = doc(db, "dailyCheck", selectedDate);
  const snap = await getDoc(ref);
  const oldData = snap.exists() ? snap.data() : {};
  if (!oldData[task]) oldData[task] = {};
  oldData[task][nickname] = timeStr;
  await setDoc(ref, oldData);
  await renderTasks();
}
