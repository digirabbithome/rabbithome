
import { db } from '/js/firebase.js';
import { collection, addDoc, getDocs, doc, getDoc, setDoc, serverTimestamp, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.onload = async () => {
  await loadSuppliers();

  document.getElementById('generateID').addEventListener('click', generateRepairID);
  document.getElementById('repairForm').addEventListener('submit', submitRepairForm);
};

async function loadSuppliers() {
  const supplierSelect = document.getElementById('supplier');
  supplierSelect.innerHTML = '<option value="">載入中...</option>';
  const snapshot = await getDocs(collection(db, 'suppliers'));
  supplierSelect.innerHTML = '';
  snapshot.forEach(doc => {
    const data = doc.data();
    supplierSelect.innerHTML += `<option value="${data.name}">${data.code} - ${data.name}</option>`;
  });
}

async function generateRepairID() {
  const snapshot = await getDocs(query(collection(db, 'repairs'), orderBy('createdAt', 'desc'), limit(1)));
  let newID = 'R0001';
  if (!snapshot.empty) {
    const last = snapshot.docs[0].id;
    const num = parseInt(last.replace('R', '')) + 1;
    newID = 'R' + num.toString().padStart(4, '0');
  }
  document.getElementById('repairID').value = newID;
}

async function submitRepairForm(e) {
  e.preventDefault();
  const id = document.getElementById('repairID').value.trim();
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();
  const product = document.getElementById('product').value.trim();
  const status = document.getElementById('status').value.trim();
  const warranty = document.querySelector('input[name="warranty"]:checked')?.value || '';
  const supplier = document.getElementById('supplier').value;

  if (!id || !name || !phone || !status) {
    alert('請填寫必填欄位！');
    return;
  }

  const ref = doc(db, 'repairs', id);
  await setDoc(ref, {
    customerName: name,
    phone,
    address,
    product,
    warranty,
    supplier,
    status,
    createdAt: serverTimestamp(),
    currentStatus: 1
  });

  alert('✅ 維修單已送出');
  document.getElementById('repairForm').reset();
}
