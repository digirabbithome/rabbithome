
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const list = document.createElement("ul");
list.id = "taskList";
list.style.listStyle = "none";
list.style.padding = "0";
document.body.appendChild(list);

const addBtn = document.createElement("button");
addBtn.textContent = "➕ 新增工作項目";
addBtn.onclick = () => {
  const li = createItem("請輸入內容");
  list.appendChild(li);
};
document.body.appendChild(addBtn);

const saveBtn = document.createElement("button");
saveBtn.textContent = "💾 儲存排序結果";
saveBtn.onclick = async () => {
  const items = [...list.querySelectorAll("li input")].map((input) => input.value.trim()).filter(v => v);
  const ref = doc(db, "workItems", "main");
  await setDoc(ref, { items });
  alert("✅ 已儲存！");
};
document.body.appendChild(saveBtn);

function createItem(text) {
  const li = document.createElement("li");
  li.style.display = "flex";
  li.style.alignItems = "center";
  li.style.gap = "10px";
  li.style.margin = "5px 0";

  const input = document.createElement("input");
  input.value = text;
  input.style.flex = "1";

  const del = document.createElement("button");
  del.textContent = "🗑️";
  del.onclick = () => li.remove();

  li.appendChild(input);
  li.appendChild(del);

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
