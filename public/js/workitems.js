
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import Sortable from "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/+esm";

const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const taskList = document.getElementById("taskList");
const tasksRef = collection(db, "workItems");

// 載入任務
async function loadTasks() {
  taskList.innerHTML = "";
  const snapshot = await getDocs(tasksRef);
  snapshot.forEach(docSnap => {
    addTaskItem(docSnap.data().text, docSnap.id);
  });
}
loadTasks();

// 新增任務
document.getElementById("addTaskBtn").addEventListener("click", async () => {
  const text = prompt("請輸入任務（例如 9:30 QA）");
  if (text) {
    const docRef = await addDoc(tasksRef, { text });
    addTaskItem(text, docRef.id);
  }
});

// 儲存排序
document.getElementById("saveBtn").addEventListener("click", async () => {
  const items = taskList.querySelectorAll("li");
  let i = 0;
  for (const item of items) {
    const id = item.dataset.id;
    await setDoc(doc(tasksRef, id), { text: item.innerText.replace(" 🗑️", "") });
    i++;
  }
  alert("✅ 已儲存任務順序！");
});

// 加入任務項目
function addTaskItem(text, id) {
  const li = document.createElement("li");
  li.innerText = text;
  li.dataset.id = id;

  const del = document.createElement("span");
  del.innerText = " 🗑️";
  del.style.cursor = "pointer";
  del.onclick = async () => {
    await deleteDoc(doc(tasksRef, id));
    li.remove();
  };
  li.appendChild(del);
  taskList.appendChild(li);
}

// 拖曳排序
Sortable.create(taskList, { animation: 150 });
