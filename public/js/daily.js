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

  const taskDisplay = document.getElementById("task-display");
  taskDisplay.innerHTML = ""; const table = document.createElement("table"); table.style.width = "100%"; table.style.borderSpacing = "0 10px"; taskDisplay.appendChild(table);

  const ref = doc(db, "dailyCheck", selectedDate);
  const snap = await getDoc(ref);
  const recordData = snap.exists() ? snap.data() : {};

  for (const task of taskDocs) {
    const taskName = task.text;
    const row = document.createElement("tr"); row.style.verticalAlign = "top";
    row.className = "task-row"; row.style.background = "#fff"; row.style.borderRadius = "10px"; row.style.boxShadow = "0 0 4px rgba(0,0,0,0.1)";

    const name = document.createElement("div");
    name.className = "task-name";
    name.textContent = taskName;
    name.onclick = () => markComplete(taskName);

    const record = document.createElement("div");
    record.className = "task-records";
    const logs = recordData[taskName] || {};
    const entries = Object.entries(logs).map(([user, time]) => `${user} ${time}`);
    record.textContent = entries.join("　");

    const td1 = document.createElement("td"); td1.style.padding = "10px"; td1.appendChild(name); row.appendChild(td1);
    const td2 = document.createElement("td"); td2.style.padding = "10px"; record.style.textAlign = "left"; td2.appendChild(record); row.appendChild(td2);
    table.appendChild(row);
  }
}

\1
  // ✅ 通知右邊 daily-report.html 重新刷新
  (function notifyWorkReportsUpdated() {
    const msg = { source: "rabbithome", type: "workReports:updated", at: Date.now() };
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage(msg, "*");
      if (window.top && window.top !== window) window.top.postMessage(msg, "*");
      window.dispatchEvent(new CustomEvent("workReports:updated", { detail: msg }));
    } catch (e) {
      console.warn("[daily] 通知右邊刷新失敗：", e);
    }
  })();
\2
