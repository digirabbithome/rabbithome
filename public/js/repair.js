import { db } from '/js/firebase.js';
import {
  collection, getDocs, doc, setDoc,
  serverTimestamp, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

import {
  getStorage, ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

import {
  getAuth, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const storage = getStorage();
const auth = getAuth();
let currentUser = null;

// ✅ 檢查登入狀態
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    console.log("✅ 使用者已登入：", user.email);
  } else {
    console.warn("❌ 尚未登入，請重新登入！");
    alert("請先登入帳號才能上傳維修單！");
    window.location.href = "/login.html";
  }
});

// 載入廠商資料
async function loadSuppliers() {
  const supplierSelect = document.getElementById('supplier-select');
  const q = query(collection(db, "suppliers"), orderBy("code"));
  const querySnapshot = await getDocs(q);
  supplierSelect.innerHTML = '';
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const option = document.createElement('option');
    option.value = data.shortName || '';
    option.textContent = `${data.code} - ${data.name}`;
    supplierSelect.appendChild(option);
  });
}

// 自動產生流水號
function generateRepairID() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `R${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

document.getElementById('generate-id').addEventListener('click', () => {
  document.getElementById('repair-id').value = generateRepairID();
});

document.getElementById('repair-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) {
    alert("尚未登入，無法送出維修單！");
    return;
  }

  const repairId = document.getElementById('repair-id').value.trim();
  const supplier = document.getElementById('supplier-select').value.trim();
  const customer = document.getElementById('customer').value.trim();
  const address = document.getElementById('address').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const warranty = document.getElementById('warranty-select').value.trim();
  const product = document.getElementById('product').value.trim();
  const description = document.getElementById('description').value.trim();
  const files = document.getElementById('photo-upload').files;

  if (!repairId || !supplier || !customer) {
    alert("請完整填寫維修單號、廠商與客戶資訊");
    return;
  }

  const photoURLs = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const fileRef = ref(storage, `repairs/${repairId}/${files[i].name}`);
      await uploadBytes(fileRef, files[i]);
      const url = await getDownloadURL(fileRef);
      photoURLs.push(url);
    }
  } catch (err) {
    console.error("上傳圖片失敗", err);
    alert("圖片上傳失敗，請確認已登入或稍後再試");
    return;
  }

  const repairData = {
    repairId,
    supplier,
    customer,
    address,
    phone,
    warranty,
    product,
    description,
    photos: photoURLs,
    createdAt: serverTimestamp(),
    createdBy: currentUser.email
  };

  try {
    await setDoc(doc(db, "repairs", repairId), repairData);
    alert("✅ 維修單已成功送出！");
    document.getElementById('repair-form').reset();
  } catch (err) {
    console.error("寫入失敗", err);
    alert("❌ 維修單送出失敗！");
  }
});

window.onload = () => {
  loadSuppliers();
};
