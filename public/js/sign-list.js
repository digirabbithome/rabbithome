
import { db } from '/js/firebase.js'

document.addEventListener("DOMContentLoaded", () => {
  initMonthSelector();
  renderTable();
});

function initMonthSelector() {
  const grid = document.getElementById("month-grid");
  if (!grid) return;

  const now = new Date();
  let currentYear = now.getFullYear();

  const yearSpan = document.getElementById("currentYear");
  const prevYearBtn = document.getElementById("prevYear");
  const nextYearBtn = document.getElementById("nextYear");

  function renderMonths() {
    grid.innerHTML = "";
    yearSpan.textContent = currentYear;
    for (let m = 0; m < 12; m++) {
      const cell = document.createElement("div");
      cell.className = "month-cell";
      cell.textContent = `${m + 1} 月`;
      cell.onclick = () => {
        const monthStr = `${currentYear}-${(m + 1).toString().padStart(2, "0")}`;
        // 在這裡觸發篩選邏輯
        console.log("篩選月份", monthStr);
      };
      grid.appendChild(cell);
    }
  }

  prevYearBtn.onclick = () => {
    currentYear--;
    renderMonths();
  };
  nextYearBtn.onclick = () => {
    currentYear++;
    renderMonths();
  };

  renderMonths();
}

function renderTable() {
  console.log("表格渲染功能尚未補上");
}
