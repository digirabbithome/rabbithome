
import { db, storage } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

let photoURLs = []
let repairData = []
let sortField = 'createdAt'
let sortDirection = 'desc'

async function loadRepairList() {
  const q2 = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q2)
  repairData = snapshot.docs.map(doc => doc.data())
  renderTable()
}

window.onload = async () => {
  window.currentStatusFilter = ['1', '2']

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      window.currentStatusFilter = btn.dataset.status
      renderTable()
    })
  })

  document.getElementById('search-id')?.addEventListener('input', renderTable)
  document.getElementById('search-keyword')?.addEventListener('input', renderTable)

  document.getElementById('generate-id')?.addEventListener('click', async () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `${yyyy}${mm}${dd}`;

    const q = query(collection(db, 'repairs'), orderBy('repairId'));
    const snapshot = await getDocs(q);
    let count = 0;
    snapshot.forEach(doc => {
      const id = doc.id;
      if (id.startsWith(prefix)) {
        count++;
      }
    });

    const newId = prefix + String(count + 1).padStart(2, '0');
    document.getElementById('repair-id').value = newId;
  });

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

  document.getElementById('repair-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const repairId = document.getElementById('repair-id').value.trim();
    const customer = document.getElementById('customer').value.trim();
    const line = document.getElementById('line')?.value.trim() || '';
    if (!repairId || (!customer && !line)) {
      alert('請填寫維修單號與姓名或 LINE 名稱');
      return;
    }

    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const product = document.getElementById('product').value.trim();
    const description = document.getElementById('description').value.trim();
    const warranty = document.getElementById('warranty-select')?.value || '';
    const supplierSelect = document.getElementById('supplier-select');
    const supplier = supplierSelect && supplierSelect.selectedIndex > 0 ? supplierSelect.value : '';

    const check = await getDoc(doc(db, 'repairs', repairId));
    if (check.exists()) {
      alert('⚠️ 此維修單號已存在，請更換！');
      return;
    }

    const data = {
      repairId,
      customer,
      line,
      phone,
      address,
      product,
      description,
      warranty,
      supplier,
      createdAt: serverTimestamp(),
      status: 1,
      photos: photoURLs,
      user: localStorage.getItem('nickname') || '未知使用者'
    };

    await setDoc(doc(db, 'repairs', repairId), data);
    alert('✅ 維修單送出成功！');
    document.getElementById('repair-form').reset();
    photoURLs = [];
    document.getElementById('show-list')?.click();
    loadRepairList();
  });

  loadRepairList();
}

function renderTable() {
  const keyword = document.getElementById('search-keyword')?.value.trim().toLowerCase() || '';
  const listSection = document.getElementById('repair-list');
  listSection.innerHTML = '';

  repairData.forEach(d => {
    const match = [d.customer, d.phone, d.address, d.line, d.description].some(field =>
      field?.toLowerCase().includes(keyword)
    );
    if (!match) return;

    let nameDisplay = '';
    if (d.customer && d.line) {
      nameDisplay = `${d.customer} / ${d.line}`;
    } else if (d.customer) {
      nameDisplay = d.customer;
    } else if (d.line) {
      nameDisplay = d.line;
    }

    const row = document.createElement('div');
    row.textContent = `${d.repairId} – ${nameDisplay}`;
    listSection.appendChild(row);
  });
}
