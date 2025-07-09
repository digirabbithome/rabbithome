
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "/js/firebase.js";

let suppliersRef = collection(db, "suppliers");
let allData = [];
let currentPage = 1;
const pageSize = 50;

window.onload = async () => {
  document.getElementById("supplierForm").addEventListener("submit", handleSubmit);
  document.getElementById("newBtn").addEventListener("click", resetForm);
  document.getElementById("searchBtn").addEventListener("click", handleSearch);
  document.getElementById("prevPage").addEventListener("click", () => changePage(-1));
  document.getElementById("nextPage").addEventListener("click", () => changePage(1));
  await renderTable();
};

function getFormData() {
  const type = Array.from(document.querySelectorAll("input[name='type']:checked")).map(cb => cb.value);
  return {
    code: document.getElementById("code").value.trim(),
    name: document.getElementById("name").value.trim(),
    shortName: document.getElementById("shortName").value.trim(),
    contact: document.getElementById("contact").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    brand: document.getElementById("brand").value.trim(),
    origin: document.getElementById("origin").value,
    payType: document.getElementById("payType").value,
    type,
    createdAt: new Date()
  };
}

function resetForm() {
  document.getElementById("supplierForm").reset();
  document.getElementById("docId").value = "";
}

async function handleSubmit(e) {
  e.preventDefault();
  const formData = getFormData();
  const docId = document.getElementById("docId").value;

  if (docId) {
    const ref = doc(db, "suppliers", docId);
    await updateDoc(ref, formData);
  } else {
    await addDoc(suppliersRef, formData);
  }

  resetForm();
  await renderTable();
}

async function renderTable() {
  const snapshot = await getDocs(suppliersRef);
  allData = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    allData.push({ ...data, id: docSnap.id });
  });

  currentPage = 1;
  displayTable();
}

function displayTable(dataArray = allData) {
  const tbody = document.querySelector("#supplierTable tbody");
  tbody.innerHTML = "";

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageData = dataArray.slice(startIndex, endIndex);

  for (let item of pageData) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.shortName}</td>
      <td>${item.phone || ""}</td>
      <td>${(item.type || []).join(", ")}</td>
      <td>
        <button onclick="editSupplier('${item.id}')">✏️</button>
        <button onclick="deleteSupplier('${item.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  updatePageInfo(dataArray.length);
}

function updatePageInfo(totalItems) {
  const pageInfo = document.getElementById("pageInfo");
  const totalPages = Math.ceil(totalItems / pageSize);
  pageInfo.textContent = `第 ${currentPage} 頁／共 ${totalPages} 頁`;
}

function changePage(direction) {
  const totalPages = Math.ceil(allData.length / pageSize);
  const newPage = currentPage + direction;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    displayTable();
  }
}

function handleSearch() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const filtered = allData.filter(item =>
    item.code?.toLowerCase().includes(keyword) ||
    item.name?.toLowerCase().includes(keyword) ||
    item.shortName?.toLowerCase().includes(keyword) ||
    item.brand?.toLowerCase().includes(keyword)
  );
  currentPage = 1;
  displayTable(filtered);
}

window.editSupplier = function (id) {
  const data = allData.find(d => d.id === id);
  if (!data) return;
  document.getElementById("docId").value = id;
  document.getElementById("code").value = data.code || "";
  document.getElementById("name").value = data.name || "";
  document.getElementById("shortName").value = data.shortName || "";
  document.getElementById("contact").value = data.contact || "";
  document.getElementById("email").value = data.email || "";
  document.getElementById("phone").value = data.phone || "";
  document.getElementById("brand").value = data.brand || "";
  document.getElementById("origin").value = data.origin || "台灣";
  document.getElementById("payType").value = data.payType || "月結";
  const typeCheckboxes = document.querySelectorAll("input[name='type']");
  typeCheckboxes.forEach(cb => {
    cb.checked = (data.type || []).includes(cb.value);
  });
};

window.deleteSupplier = async function (id) {
  if (confirm("確定要刪除這筆資料嗎？")) {
    await deleteDoc(doc(db, "suppliers", id));
    await renderTable();
  }
};
