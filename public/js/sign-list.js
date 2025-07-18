import { db } from '/js/firebase.js';

const tableBody = document.querySelector('#resultTable tbody');
const monthSelector = document.querySelector('#monthSelector');
const currentYear = new Date().getFullYear();
let selectedMonth = null;

function renderMonthSelector(year = currentYear) {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="year-row">
      <button onclick="changeYear(-1)">⬅️</button>
      <strong style="margin: 0 1em;">${year}</strong>
      <button onclick="changeYear(1)">➡️</button>
    </div>
    <div class="months-grid">
      ${Array.from({ length: 12 }, (_, i) => `<div class="month-cell" data-month="${year}-${(i+1).toString().padStart(2,'0')}">${i+1}月</div>`).join('')}
    </div>
  `;
  monthSelector.innerHTML = '';
  monthSelector.appendChild(container);

  document.querySelectorAll('.month-cell').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.month-cell').forEach(m => m.classList.remove('active'));
      el.classList.add('active');
      selectedMonth = el.dataset.month;
      loadData();
    };
  });
}

window.changeYear = (delta) => {
  const yearText = document.querySelector('.year-row strong');
  const newYear = parseInt(yearText.textContent) + delta;
  renderMonthSelector(newYear);
};

function loadData() {
  tableBody.innerHTML = '';
  console.log('載入月份', selectedMonth);
  // Fetch data from Firebase with selectedMonth
}

window.onload = () => {
  renderMonthSelector();
};