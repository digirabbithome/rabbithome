
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, getDocs, collection
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
  document.getElementById("date-picker").value = selectedDate;
  document.getElementById("date-picker").addEventListener("change", async (e) => {
    selectedDate = e.target.value;
    updateDateDisplay(selectedDate);
    await renderTasks();
  });
  updateDateDisplay(selectedDate);
  await renderTasks();
});

function getTodayString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function updateDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split("-");
  document.getElementById("current-date").textContent = `${y}/${m}/${d}`;
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
      document.getElementById("date-picker").value = dateStr;
      updateDateDisplay(dateStr);
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

  const q = query(collection(db, "workItems"), orderBy("order"));
  const snapshot = await getDocs(q);
  const tasks = [];
  snapshot.forEach(doc => {
    tasks.push(doc.data().text);
  });

  tasks.forEach(task => {
    const el = document.createElement("div");
    el.className = "task-item";
    el.textContent = task;
    el.onclick = () => markComplete(task);
    taskListEl.appendChild(el);
  });

  tasks.forEach(async task => {
    const taskDoc = await getDoc(doc(db, "dailyCheck", selectedDate));
    const list = taskDoc.exists() && taskDoc.data()[task] ? taskDoc.data()[task] : {};
    const section = document.createElement("div");
    section.className = "record-item";
    section.innerHTML = `<strong>${task}</strong><br>`;
    for (const [nick, time] of Object.entries(list)) {
      section.innerHTML += `<span class="record-user">${nick} ${time}</span>`;
    }
    recordListEl.appendChild(section);
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
