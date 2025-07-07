import { db } from '../firebase/firebase.js';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const taskContainer = document.getElementById("task-container");
const taskInput = document.getElementById("taskInput");
const addTaskButton = document.getElementById("addTask");

let tasks = [];

function renderTasks() {
  taskContainer.innerHTML = "";
  tasks.forEach((task, index) => {
    const div = document.createElement("div");
    div.className = "task-card";
    div.draggable = true;
    div.textContent = task.text;
    div.dataset.index = index;

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.onclick = async () => {
      tasks.splice(index, 1);
      await saveTasks();
    };

    div.appendChild(del);
    taskContainer.appendChild(div);
  });
}

async function loadTasks() {
  const snapshot = await getDocs(collection(db, "workItems"));
  tasks = [];
  snapshot.forEach((doc) => {
    tasks.push({ id: doc.id, text: doc.data().text });
  });
  renderTasks();
}

async function saveTasks() {
  const ref = collection(db, "workItems");
  const snapshot = await getDocs(ref);
  for (const docSnap of snapshot.docs) {
    await deleteDoc(doc(ref, docSnap.id));
  }
  for (const task of tasks) {
    await addDoc(ref, { text: task.text });
  }
  renderTasks();
}

addTaskButton.onclick = async () => {
  const val = taskInput.value.trim();
  if (val) {
    tasks.push({ text: val });
    taskInput.value = "";
    await saveTasks();
  }
};

taskContainer.addEventListener("dragstart", (e) => {
  e.dataTransfer.setData("text/plain", e.target.dataset.index);
});

taskContainer.addEventListener("dragover", (e) => {
  e.preventDefault();
});

taskContainer.addEventListener("drop", async (e) => {
  const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
  const to = parseInt(e.target.dataset.index, 10);
  if (!isNaN(from) && !isNaN(to) && from !== to) {
    const moved = tasks.splice(from, 1)[0];
    tasks.splice(to, 0, moved);
    await saveTasks();
  }
});

loadTasks();