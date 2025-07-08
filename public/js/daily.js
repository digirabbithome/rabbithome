
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentDate = getToday();
const taskList = document.getElementById("taskList");
const dateButtons = document.getElementById("dateButtons");
let nickname = "使用者";

function getToday(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().split("T")[0];
}

function renderDateButtons() {
  for (let i = 0; i <= 6; i++) {
    const date = getToday(i);
    const btn = document.createElement("button");
    btn.textContent = i === 0 ? `今天 (${date})` : `前 ${i} 天 (${date})`;
    btn.onclick = () => {
      currentDate = date;
      loadTasks();
    };
    dateButtons.appendChild(btn);
  }
}

async function loadTasks() {
  taskList.innerHTML = "";
  const workItemsSnapshot = await getDocs(collection(db, "workItems"));
  const workItems = [];

  workItemsSnapshot.forEach(doc => {
    workItems.push(doc.data().text);
  });

  for (let task of workItems) {
    const li = document.createElement("li");
    li.className = "task-item";

    const checkBtn = document.createElement("input");
    checkBtn.type = "checkbox";
    checkBtn.onclick = () => markDone(task);

    const label = document.createElement("label");
    label.textContent = " " + task;

    const checkLine = document.createElement("div");
    checkLine.className = "check-line";
    checkLine.id = "line-" + task;

    li.appendChild(checkBtn);
    li.appendChild(label);
    li.appendChild(checkLine);

    taskList.appendChild(li);

    loadCompletedUsers(task);
  }
}

async function markDone(task) {
  const timeStr = new Date().toTimeString().substring(0,5);
  const ref = doc(db, `dailyCheck/${currentDate}/${task}`);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  data[nickname] = timeStr;
  await setDoc(ref, data);
  loadCompletedUsers(task);
}

async function loadCompletedUsers(task) {
  const ref = doc(db, `dailyCheck/${currentDate}/${task}`);
  const snap = await getDoc(ref);
  const line = document.getElementById("line-" + task);
  line.innerHTML = "";

  if (snap.exists()) {
    const data = snap.data();
    for (let [user, time] of Object.entries(data)) {
      const span = document.createElement("span");
      span.className = "done-name";
      span.textContent = `${user} ${time}`;
      line.appendChild(span);
    }
  }
}

onAuthStateChanged(auth, user => {
  if (user) {
    nickname = localStorage.getItem("nickname") || "使用者";
    renderDateButtons();
    loadTasks();
  } else {
    window.location.href = "login.html";
  }
});
