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
  document.getElementById("datePicker").value = selectedDate;
  document.getElementById("datePicker").addEventListener("change", async e => {
    selectedDate = e.target.value;
    await renderTasks();
  });
  renderDateButtons();
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
      document.getElementById("datePicker").value = dateStr;
      await renderTasks();
    };
    container.appendChild(btn);
  }
}

async function renderTasks() {
  document.getElementById("selectedDate").textContent = selectedDate.replace(/-/g, "/");

  const snapshot = await getDocs(query(collection(db, "workItems"), orderBy("order")));
  const taskDocs = [];
  snapshot.forEach(doc => taskDocs.push(doc.data()));

  const usersSet = new Set();
  const allRecords = {};

  for (const task of taskDocs) {
    const taskName = task.text;
    const snap = await getDoc(doc(db, "dailyCheck", selectedDate));
    const done = snap.exists() && snap.data()[taskName] ? snap.data()[taskName] : {};
    allRecords[taskName] = done;
    Object.keys(done).forEach(nick => usersSet.add(nick));
  }

  const users = [...usersSet];
  const mainTable = document.getElementById("main-table");
  mainTable.innerHTML = "";

  const headerRow = document.createElement("div");
  headerRow.className = "table-row table-header";

  const taskHeader = document.createElement("div");
  taskHeader.className = "table-cell";
  taskHeader.textContent = "任務";
  headerRow.appendChild(taskHeader);

  users.forEach(user => {
    const cell = document.createElement("div");
    cell.className = "table-cell";
    cell.textContent = user;
    headerRow.appendChild(cell);
  });
  mainTable.appendChild(headerRow);

  for (const task of taskDocs) {
    const row = document.createElement("div");
    row.className = "table-row";

    const taskCell = document.createElement("div");
    taskCell.className = "table-cell task-col";
    taskCell.textContent = task.text;
    taskCell.onclick = () => markComplete(task.text);
    row.appendChild(taskCell);

    users.forEach(user => {
      const cell = document.createElement("div");
      cell.className = "table-cell";
      const record = allRecords[task.text]?.[user] || "";
      cell.textContent = record;
      row.appendChild(cell);
    });

    mainTable.appendChild(row);
  }
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
