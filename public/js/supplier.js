
import {
  getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { db } from "/js/firebase.js";

let suppliersRef = collection(db, "suppliers");
let allData = [];

window.onload = async () => {
  document.getElementById("supplierForm").addEventListener("submit", handleSubmit);
  document.getElementById("newBtn").addEventListener("click", resetForm);
  document.getElementById("searchBtn").addEventListener("click", handleSearch);
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
  const tbody = document.querySelector("#supplierTable tbody");
  tbody.innerHTML = "";
  const snapshot = await getDocs(suppliersRef);
  allData = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    allData.push({ ...data, id: docSnap.id });
  });

  displayTable(allData);
}

function displayTable(dataArray) {
  const tbody = document.querySelector("#supplierTable tbody");
  tbody.innerHTML = "";
  for (let item of dataArray) {
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

function handleSearch() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const filtered = allData.filter(item =>
    item.code?.toLowerCase().includes(keyword) ||
    item.name?.toLowerCase().includes(keyword) ||
    item.shortName?.toLowerCase().includes(keyword) ||
    item.brand?.toLowerCase().includes(keyword)
  );
  displayTable(filtered);
}
