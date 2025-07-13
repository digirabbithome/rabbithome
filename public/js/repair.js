
import { db, storage } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

let photoURLs = [];
let repairData = [];

window.onload = async () => {
  // ✅ 修正 1：自動產生流水號
  document.getElementById('generate-id')?.addEventListener('click', () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    const repairId = `R${yyyy}${mm}${dd}${random}`;
    document.getElementById('repair-id').value = repairId;
  });

  // ✅ 修正 2：讀取 Firestore 的廠商資料
  const supplierSelect = document.getElementById('supplier-select');
  const suppliersRef = collection(db, 'suppliers');
  const q = query(suppliersRef, orderBy('code'));
  const suppliersSnap = await getDocs(q);
  supplierSelect.innerHTML = '<option disabled selected>請選擇廠商</option>';
  suppliersSnap.forEach(doc => {
    const d = doc.data();
    const option = document.createElement('option');
    option.value = d.shortName || '';
    option.textContent = `${d.code || ''} - ${d.shortName || ''}`;
    supplierSelect.appendChild(option);
  });

  // ✅ 照片上傳
  document.getElementById('photo-upload')?.addEventListener('change', async (event) => {
    const files = event.target.files;
    photoURLs = [];
    for (const file of files) {
      const storageRef = ref(storage, `repairs/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      photoURLs.push(url);
    }
  });

  // ✅ 表單送出寫入 Firestore
  document.getElementById('repair-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const repairId = document.getElementById('repair-id').value.trim();
    const customer = document.getElementById('customer').value.trim();
    if (!repairId || !customer) {
      alert('請填寫維修單號與客人姓名');
      return;
    }

    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const product = document.getElementById('product').value.trim();
    const description = document.getElementById('description').value.trim();
    const warranty = document.getElementById('warranty-select')?.value || '';
    const supplier = document.getElementById('supplier-select')?.value || '';

    const check = await getDoc(doc(db, 'repairs', repairId));
    if (check.exists()) {
      alert('⚠️ 此維修單號已存在，請更換！');
      return;
    }

    const data = {
      repairId,
      customer,
      phone,
      address,
      product,
      description,
      warranty,
      supplier,
      createdAt: serverTimestamp(),
      status: 1,
      photos: photoURLs
    };

    await setDoc(doc(db, 'repairs', repairId), data);
    alert('✅ 維修單送出成功！');
    document.getElementById('repair-form').reset();
    photoURLs = [];
    document.getElementById('generate-id')?.click(); // 送出後重新產生一筆
  });
};
