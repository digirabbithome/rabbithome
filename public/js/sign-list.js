
let signData = [];
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let currentPage = 1;
const itemsPerPage = 5;

// 排序與分頁渲染
function renderTable() {
  const listEl = document.getElementById('sign-list');
  listEl.innerHTML = '';

  const sorted = [...signData].sort((a, b) => {
    let valA = a[currentSortField];
    let valB = b[currentSortField];
    if (currentSortField === 'createdAt' && valA?.toDate) {
      valA = valA.toDate();
      valB = valB.toDate();
    }
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = sorted.slice(start, start + itemsPerPage);

  for (const d of pageItems) {
    const date = d.createdAt?.toDate?.().toLocaleDateString() || '';
    const name = d.type2 || '';
    const note = d.note || '';
    const amount = d.amount || '';
    const nickname = d.nickname || '';
    const sigImg = d.signatureUrl ? `<img src="${d.signatureUrl}" style="height:40px;" onmouseover="this.style.height='120px'" onmouseout="this.style.height='40px'">` : '';
    const tr = `<tr><td>${date}</td><td>${name}</td><td>${note}</td><td>${amount}</td><td>${nickname}</td><td>${sigImg}</td></tr>`;
    listEl.innerHTML += tr;
  }

  renderPagination(sorted.length);
}

function renderPagination(totalItems) {
  const pager = document.getElementById('pager');
  pager.innerHTML = '';
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return;
  const prev = document.createElement('button');
  prev.textContent = '«';
  prev.disabled = currentPage === 1;
  prev.onclick = () => { currentPage--; renderTable(); };
  pager.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.disabled = i === currentPage;
    btn.onclick = () => { currentPage = i; renderTable(); };
    pager.appendChild(btn);
  }

  const next = document.createElement('button');
  next.textContent = '»';
  next.disabled = currentPage === totalPages;
  next.onclick = () => { currentPage++; renderTable(); };
  pager.appendChild(next);
}

function fetchData() {
  import('/js/firebase.js').then(({ db }) => {
    import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js').then(module => {
      const { collection, getDocs, query, orderBy } = module;
      const q = query(collection(db, 'signs'), orderBy('createdAt', 'desc'));
      getDocs(q).then(snapshot => {
        signData = snapshot.docs.map(doc => doc.data());
        renderTable();
      });
    });
  });
}

window.onload = () => {
  fetchData();
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.field;
      if (currentSortField === field) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortField = field;
        currentSortDirection = 'asc';
      }
      renderTable();
    });
  });
};
