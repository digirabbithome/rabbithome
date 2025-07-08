
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
    tasks.push({ id: docSnap.id, text: docSnap.data().text });
  });

  // 清空畫面
  taskList.innerHTML = "";

  tasks.forEach(task => {
    const li = document.createElement("li");
    li.setAttribute("data-id", task.id);
    li.draggable = true;
    li.innerHTML = `
      <span>${task.text}</span>
      <button class="delete-btn" onclick="deleteTask('${task.id}')">刪除</button>
    `;
    addDragEvents(li);
    taskList.appendChild(li);
  });
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
  alert("排序已儲存！");
};

function addDragEvents(element) {
  element.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", element.dataset.id);
    element.classList.add("dragging");
  });

  element.addEventListener("dragend", e => {
    element.classList.remove("dragging");
  });

  element.addEventListener("dragover", e => {
    e.preventDefault();
    const dragging = document.querySelector(".dragging");
    if (dragging && dragging !== element) {
      const rect = element.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      const midpoint = rect.height / 2;
      const parent = element.parentNode;
      if (offset > midpoint) {
        parent.insertBefore(dragging, element.nextSibling);
      } else {
        parent.insertBefore(dragging, element);
      }
    }
  });
}

loadTasks();
