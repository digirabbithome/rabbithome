
import { db } from '/js/firebase.js'
import { collection, query, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let signData = []

function renderTable(data) {
  const tbody = document.getElementById("sign-body")
  tbody.innerHTML = data.map(d => `
    <tr>
      <td>${new Date(d.createdAt?.seconds * 1000).toLocaleDateString()}</td>
      <td>${d.type2 || ""}</td>
      <td>${d.note || ""}</td>
      <td>${d.amount || ""}</td>
      <td>${d.nickname || ""}</td>
      <td><img src="${d.signatureUrl}" class="thumb" /></td>
    </tr>
  `).join("")
}

function applySearch() {
  const keyword = document.getElementById("search-input")?.value.trim().toLowerCase()
  if (!keyword) return renderTable(signData)

  const filtered = signData.filter(d => {
    const fields = [d.type2, d.note, d.amount, d.nickname]
    return fields.some(f => (f || "").toString().toLowerCase().includes(keyword))
  })
  renderTable(filtered)
}

window.onload = async () => {
  const snapshot = await getDocs(query(collection(db, "signs"), orderBy("createdAt", "desc")))
  signData = snapshot.docs.map(doc => doc.data())
  renderTable(signData)

  document.getElementById("search-input")?.addEventListener("input", applySearch)
}



let currentPage = 1;
const itemsPerPage = 20;

function renderTable(data) {
  const tbody = document.getElementById("sign-body");
  tbody.innerHTML = "";

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedData = data.slice(startIdx, endIdx);

  paginatedData.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.createdAt || ''}</td>
      <td>${item.shortName || ''}</td>
      <td>${item.note || ''}</td>
      <td>${item.amount || ''}</td>
      <td>${item.nickname || ''}</td>
      <td><img src="${item.signatureUrl || ''}" class="thumbnail" onmouseover="this.style.transform='scale(2)'" onmouseout="this.style.transform='scale(1)'"/></td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination(data.length);
}

function renderPagination(totalItems) {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return;

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "上一頁";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable(window.filteredData || window.fullData);
    }
  };
  pagination.appendChild(prevBtn);

  const pageInfo = document.createElement("span");
  pageInfo.textContent = ` 第 ${currentPage} 頁 / 共 ${totalPages} 頁 `;
  pagination.appendChild(pageInfo);

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "下一頁";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTable(window.filteredData || window.fullData);
    }
  };
  pagination.appendChild(nextBtn);
}
