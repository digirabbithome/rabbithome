
import { db, storage } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

let photoURLs = [];

async function loadRepairList() {
  let listDiv = document.getElementById('repair-list');
  const selectedStatus = window.currentStatusFilter || 'all';
  const keyword1 = document.getElementById('search-id')?.value.trim().toLowerCase() || '';
  const keyword2 = document.getElementById('search-keyword')?.value.trim().toLowerCase() || '';

  const q2 = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q2);

  let html = `<table><thead><tr>
    <th>送修時間</th><th>維修單號</th><th>姓名</th><th>廠商</th>
    <th>商品</th><th>描述</th><th>狀態</th><th>維修天數</th><th>編輯</th>
  </tr></thead><tbody>`;

  snapshot.forEach(docSnap => {
    const d = docSnap.data();

    const matchRepairId = d.repairId?.toLowerCase().includes(keyword1);
    const matchKeyword = [d.customer, d.phone, d.address, d.supplier, d.product, d.description]
      .some(field => field?.toLowerCase().includes(keyword2));
    const statusMatch = selectedStatus === 'all' || String(d.status) === selectedStatus;

    if (!matchRepairId || !matchKeyword || !statusMatch) return;

    let dateStr = '', diffDays = '', dayClass = '';
    if (d.createdAt?.toDate) {
      const date = d.createdAt.toDate();
      dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
      const today = new Date();
      diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) dayClass = 'red-bg';
    }

    const shortDesc = d.description?.length > 15 ? d.description.slice(0,15) + '...' : d.description || '';
    const statusText = ['❓','新進','已交廠商','完成','已取貨'][d.status] || '❓';

    html += `<tr>
      <td>${dateStr}</td>
      <td>${d.repairId}</td>
      <td>${d.customer}</td>
      <td>${(d.supplier || '').substring(0, 4)}</td>
      <td>${d.product || ''}</td>
      <td>${shortDesc}</td>
      <td>${statusText}</td>
      <td class="${dayClass}">${diffDays}</td>
      <td>${['➡️','✅','↩️','📦'][d.status] || ''}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  listDiv.innerHTML = html;
}

window.onload = () => {
  const generateBtn = document.getElementById('generate-id');
  const repairIdInput = document.getElementById('repair-id');
  generateBtn?.addEventListener('click', () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    const repairId = `R${yyyy}${mm}${dd}${random}`;
    repairIdInput.value = repairId;
  });

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
      option.value = shortName;
      option.textContent = `${code} - ${shortName}`;
      supplierSelect.appendChild(option);
    });
  });

  const photoInput = document.getElementById('photo-upload');
  photoInput?.addEventListener('change', async (event) => {
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

  const repairForm = document.getElementById('repair-form');
  repairForm?.addEventListener('submit', async (e) => {
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
      document.getElementById('show-list')?.click();
      loadRepairList();
    } catch (error) {
      console.error('❌ 寫入失敗:', error);
      alert('❌ 維修單送出失敗，請稍後再試');
    }
  });

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.currentStatusFilter = btn.dataset.status;
      loadRepairList();
    });
  });

  document.getElementById('search-id')?.addEventListener('input', loadRepairList);
  document.getElementById('search-keyword')?.addEventListener('input', loadRepairList);

  loadRepairList();
};
