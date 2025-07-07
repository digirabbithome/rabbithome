
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const list = document.getElementById("taskList");

document.getElementById("addTaskBtn").onclick = () => {
  const li = createItem("");
  list.appendChild(li);
};

document.getElementById("saveBtn").onclick = async () => {
  const items = [...list.querySelectorAll("input[type='text']")].map(input => input.value.trim()).filter(v => v);
  const ref = doc(db, "workItems", "main");
  await setDoc(ref, { items });
  alert("✅ 已儲存！");
};

function createItem(text) {
  const li = document.createElement("li");

  const input = document.createElement("input");
  input.type = "text";
  input.value = text;
  input.placeholder = "例如：9:30 QA";

  const delBtn = document.createElement("button");
  delBtn.textContent = "🗑️";
  delBtn.onclick = () => li.remove();

  li.appendChild(input);
  li.appendChild(delBtn);

  li.draggable = true;
  li.ondragstart = (e) => {
    e.dataTransfer.setData("text/plain", [...list.children].indexOf(li));
  };
  li.ondragover = (e) => e.preventDefault();
  li.ondrop = (e) => {
    e.preventDefault();
    const fromIndex = +e.dataTransfer.getData("text/plain");
    const toIndex = [...list.children].indexOf(li);
    if (fromIndex !== toIndex) {
      const item = list.children[fromIndex];
      list.removeChild(item);
      list.insertBefore(item, toIndex > fromIndex ? li.nextSibling : li);
    }
  };

  return li;
}

async function loadData() {
  const snap = await getDocs(collection(db, "workItems"));
  snap.forEach(doc => {
    const data = doc.data();
    if (Array.isArray(data.items)) {
      data.items.forEach(text => {
        list.appendChild(createItem(text));
      });
    }
  });
}

loadData();
