import { db } from './firebase.js';
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const taskList = document.getElementById('taskList');
const taskRef = collection(db, 'workItems');

async function loadTasks() {
  taskList.innerHTML = '';
  const snapshot = await getDocs(taskRef);
  snapshot.forEach((docSnap) => {
    const li = document.createElement('li');
    li.textContent = docSnap.data().title;
    li.onclick = () => removeTask(docSnap.id);
    taskList.appendChild(li);
  });
}

async function addTask() {
  const input = document.getElementById('newTask');
  const title = input.value.trim();
  if (title) {
    await addDoc(taskRef, { title });
    input.value = '';
    loadTasks();
  }
}

async function removeTask(id) {
  await deleteDoc(doc(taskRef, id));
  loadTasks();
}

window.addEventListener('DOMContentLoaded', loadTasks);
window.addTask = addTask;
