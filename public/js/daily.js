
import { db } from '/js/firebase.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

window.onload = async function () {
  const datePicker = document.getElementById("datePicker");
  const dateNav = document.getElementById("date-nav");
  const taskDisplay = document.getElementById("task-display");
  const selectedDateDisplay = document.getElementById("selectedDate");

  const today = new Date();
  let selectedDate = formatDate(today);

  // 初始化
  renderDateButtons();
  datePicker.value = selectedDate;
  await loadTasksAndCheckins(selectedDate);

  // 切換日曆
  datePicker.addEventListener("change", async () => {
    selectedDate = datePicker.value;
    selectedDateDisplay.innerText = `${selectedDate} 列表`;
    await loadTasksAndCheckins(selectedDate);
  });

  function renderDateButtons() {
    const labels = ["今天", "前一天", "前兩天", "前三天", "前四天", "前五天", "前六天"];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = formatDate(d);
      const btn = document.createElement("button");
      btn.innerText = labels[i];
      btn.onclick = async () => {
        selectedDate = dateStr;
        datePicker.value = selectedDate;
        selectedDateDisplay.innerText = `${selectedDate} 列表`;
        await loadTasksAndCheckins(selectedDate);
      };
      dateNav.appendChild(btn);
    }
  }

  async function loadTasksAndCheckins(dateStr) {
    taskDisplay.innerHTML = "";
    const workSnap = await getDocs(collection(db, "workItems"));
    const tasks = [];
    workSnap.forEach(doc => {
      tasks.push(doc.data().text); // 預設 text 欄位為任務名稱
    });

    // 排序與顯示
    const table = document.createElement("table");
    for (let task of tasks) {
      const row = document.createElement("tr");
      const tdTask = document.createElement("td");
      tdTask.innerText = task;
      const tdDone = document.createElement("td");
      const checkRef = collection(db, `dailyCheck/${dateStr}/${task}`);
      const checkSnap = await getDocs(checkRef);
      const doneList = [];
      checkSnap.forEach(doc => {
        doneList.push(`${doc.id} ${doc.data().time || ""}`);
      });
      tdDone.innerText = doneList.join("、");
      row.appendChild(tdTask);
      row.appendChild(tdDone);
      table.appendChild(row);
    }
    taskDisplay.appendChild(table);
  }

  function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
};
