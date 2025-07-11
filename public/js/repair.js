
import { db, storage } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

let photoURLs = [];

window.onload = () => {
  // 自動產生維修單號
  const generateBtn = document.getElementById('generate-id');
  const repairIdInput = document.getElementById('repair-id');

  generateBtn.addEventListener('click', () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    const repairId = `R${yyyy}${mm}${dd}${random}`;
    repairIdInput.value = repairId;
  });

  // 撈取廠商列表
  const supplierSelect = document.getElementById('supplier-select');
  const suppliersRef = collection(db, 'suppliers');
  const q = query(suppliersRef, orderBy('code'));

  getDocs(q).then((snapshot) => {
    supplierSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.textContent = '請選擇廠商';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    supplierSelect.appendChild(defaultOption);

    snapshot.forEach((doc) => {
      const data = doc.data();
      const code = data.code || '';
      const shortName = data.shortName || '';
      const option = document.createElement('option');
      option.value = shortName || code;
      option.textContent = `${code} - ${shortName}`;
      supplierSelect.appendChild(option);
    });
  });

  // 經典圖片上傳（原始檔名 + getDownloadURL 儲存）
  const photoInput = document.getElementById('photo-upload');
  photoInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    photoURLs = [];

    for (const file of files) {
      const storageRef = ref(storage, `repairs/${file.name}`);
      try {
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        photoURLs.push(url);
      } catch (err) {
        console.error('上傳失敗:', err);
      }
    }
  });

  // 表單送出
  const repairForm = document.getElementById('repair-form');
  repairForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const repairId = document.getElementById('repair-id').value.trim();
    const customer = document.getElementById('customer').value.trim();
    if (!repairId || !customer) {
      alert('請填寫必填欄位：維修單號與客人姓名');
      return;
    }

    const checkDoc = await getDoc(doc(db, 'repairs', repairId));
    if (checkDoc.exists()) {
      alert('⚠️ 此維修單號已存在，請更換單號！');
      return;
    }

    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const product = document.getElementById('product').value.trim();
    const description = document.getElementById('description').value.trim();
    const warranty = document.getElementById('warranty-select')?.value || '';
    const supplier = document.getElementById('supplier-select')?.value || '';

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

    try {
      await setDoc(doc(db, 'repairs', repairId), data);
      alert('✅ 維修單送出成功！');
      repairForm.reset();
      photoURLs = [];
    } catch (error) {
      console.error('❌ 寫入失敗:', error);
      alert('❌ 維修單送出失敗，請稍後再試');
    }
  });
};
