
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc,
  deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const workItemsCol = collection(db, "workItems");

const taskList = document.getElementById("taskList");

async function loadTasks() {
  const querySnapshot = await getDocs(workItemsCol);
  const tasks = [];

  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();
    tasks.push({ id: docSnap.id, text: data.text, order: data.order ?? 999 });
  });

  // 依照 order 排序
  tasks.sort((a, b) => a.order - b.order);

  // 清空畫面
  taskList.innerHTML = "";

  tasks.forEach((task, index) => {
    const li = document.createElement("li");
    li.setAttribute("data-id", task.id);
    li.draggable = true;
    li.innerHTML = `
      <span><strong>${index + 1}.</strong> ${task.text}</span>
      <button class="delete-btn" onclick="deleteTask('${task.id}')">刪除</button>
    `;
    taskList.appendChild(li);
  });

  addDragListeners(); // 每次重新載入任務後都加上拖曳事件
}

window.addTask = async function () {
  const input = document.getElementById("taskInput");
  const text = input.value.trim();
  if (text) {
    await addDoc(workItemsCol, { text });
    input.value = "";
    loadTasks();
  }
};

window.deleteTask = async function (id) {
  await deleteDoc(doc(db, "workItems", id));
  loadTasks();
};

window.saveOrder = async function () {
  const items = document.querySelectorAll("#taskList li");
  for (let i = 0; i < items.length; i++) {
    const id = items[i].getAttribute("data-id");
    await updateDoc(doc(db, "workItems", id), { order: i });
  }
  console.log("✅ 排序已更新");
  alert("排序已儲存！");
  loadTasks(); // 重新顯示排序號碼
};

function addDragListeners() {
  const items = document.querySelectorAll("#taskList li");
  items.forEach(item => {
    item.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", item.dataset.id);
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    item.addEventListener("dragover", e => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (dragging && dragging !== item) {
        const rect = item.getBoundingClientRect();
        const offset = e.clientY - rect.top;
        const midpoint = rect.height / 2;
        const parent = item.parentNode;
        if (offset > midpoint) {
          parent.insertBefore(dragging, item.nextSibling);
        } else {
          parent.insertBefore(dragging, item);
        }
      }
    });
  });
}

loadTasks();
