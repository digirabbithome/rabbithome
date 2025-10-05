import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, getDocs, collection, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const auth = getAuth(app);

function todayYMD_TPE(){
  const now = new Date();
  const tpe = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const y = tpe.getFullYear();
  const m = String(tpe.getMonth()+1).padStart(2,'0');
  const d = String(tpe.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function nowHM_TPE(){
  const now = new Date();
  const tpe = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const h = String(tpe.getHours()).padStart(2,'0');
  const n = String(tpe.getMinutes()).padStart(2,'0');
  return `${h}:${n}`;
}

async function appendWorkReportLine(lineText){
  return new Promise((resolve, reject)=>{
    onAuthStateChanged(auth, async (user)=>{
      if (!user) return reject(new Error('未登入，無法寫入工作回報'));
      try{
        const uid = user.uid || 'unknown';
        const email = user.email || '';
        const nickname = (localStorage.getItem('nickname') || (email.split('@')[0] || '未填暱稱')).trim();

        const dateStr = todayYMD_TPE();
        const monthKey = dateStr.slice(0,7);
        const timeStr = nowHM_TPE();
        const id = `${uid}_${dateStr}`;

        const ref = doc(db, 'workReports', id);
        const snap = await getDoc(ref);
        const line = `${timeStr} ${lineText}`;
        const lineHtml = `<div>${line}</div>`;

        if (snap.exists()){
          const d = snap.data() || {};
          await updateDoc(ref, {
            plainText: (d.plainText ? d.plainText + '\\n' : '') + line,
            contentHtml: (d.contentHtml ? d.contentHtml + lineHtml : lineHtml),
            updatedAt: serverTimestamp()
          });
        }else{
          await setDoc(ref, {
            author: { email, nickname },
            date: dateStr,
            monthKey,
            plainText: line,
            contentHtml: lineHtml,
            createdAt: serverTimestamp()
          });
        }
        resolve(true);
      }catch(err){
        console.error('[workReports] append failed', err);
        reject(err);
      }
    });
  });
}

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
