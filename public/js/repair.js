
import { db } from '/js/firebase.js'
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

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

  // 撈取廠商列表並顯示在選單
  const supplierSelect = document.getElementById('supplier-select');
  const suppliersRef = collection(db, 'suppliers');
  const q = query(suppliersRef, orderBy('code'));

  getDocs(q).then((snapshot) => {
    supplierSelect.innerHTML = '';

    // 加上預設選項
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
      option.value = code;
      option.textContent = `${code} - ${shortName}`;
      supplierSelect.appendChild(option);
    });
  }).catch((error) => {
    console.error('載入廠商失敗:', error);
  });
};
