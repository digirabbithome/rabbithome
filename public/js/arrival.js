import { db } from '/js/firebase.js';
import {
  collection, addDoc, serverTimestamp, query, orderBy, getDocs,
  updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

let allData = [];
let sortField = 'createdAt';
let sortDirection = 'desc';
let currentPage = 1;
const pageSize = 200;

// ====== 智慧搜尋工具 ======
function baseNormalize(str = "") {
  return String(str)
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function compact(str = "") {
  return baseNormalize(str).replace(/[^a-z0-9]/g, "");
}
function tokens(str = "") {
  return baseNormalize(str).split(/[^a-z0-9]+/).filter(Boolean);
}

// 利用「快取後的欄位」做超快比對
function matchRow(query, row, tokenMode = 'OR') {
  const qC = compact(query);
  if (!qC) return false;

  // (A) 緊密包含
  if (row._searchCompact.includes(qC)) return true;

  // (B) Token 模式（OR/AND）
  const qT = tokens(query);
  const bag = row._tokensSet; // Set 快查
  const hit = (tok) => {
    if (bag.has(tok)) return true;
    // 允許前綴/包含，如 se 命中 se36
    for (const w of bag) if (w.includes(tok)) return true;
    return false;
  };
  return tokenMode === 'AND' ? qT.every(hit) : qT.some(hit);
}

// ====== 小工具 ======
function debounce(fn, wait = 400) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function fmtDate(ts){ const d = ts?.toDate?.() || null; return d ? `${d.getFullYear()}/${(d.getMonth()+1+"").padStart(2,"0")}/${(d.getDate()+"").padStart(2,"0")}` : ""; }/${(d.getMonth()+1+'').padStart(2,'0')}/${(d.getDate()+'').padStart(2,'0')} ${(''+d.getHours()).padStart(2,'0')}:${(''+d.getMinutes()).padStart(2,'0')}` : '';
}

// ====== 新增／載入 ======
async function addItem() {
  const product = document.getElementById('product').value.trim();
  const market  = document.getElementById('market').value;
  const account = document.getElementById('account').value.trim();
  const note    = document.getElementById('note').value.trim();
  const user    = localStorage.getItem('nickname') || '匿名';
  if (!product || !market) { alert('商品名稱與賣場必填'); return; }

  await addDoc(collection(db, 'arrival'), {
    product, market, account, note,
    status: '未完成',
    important: false,
    deleted: false,
    createdBy: user,
    createdAt: serverTimestamp()
  });

  document.getElementById('product').value = '';
  document.getElementById('account').value = '';
  document.getElementById('note').value = '';
  await loadData();
}

async function loadData() {
  const qy = query(collection(db, 'arrival'), orderBy('createdAt','desc'));
  const snap = await getDocs(qy);
  allData = snap.docs.map(d => {
    const obj = { id: d.id, ...d.data() };
    obj.deleted = !!obj.deleted; // 預防舊資料沒有此欄位
    // 🔍 搜尋快取
    const blob = [obj.product, obj.market, obj.account, obj.note].join(' || ');
    obj._searchCompact = compact(blob);
    obj._tokens = tokens(blob);
    obj._tokensSet = new Set(obj._tokens);
    return obj;
  });
  renderTable();
}

// ====== 篩選／排序／分頁 ======
function applyFilters(list) {
  const kw = document.getElementById('searchKeyword').value.trim();
  const fMarket = document.getElementById('searchMarket').value;
  const fTime = document.getElementById('timeFilter').value;
  const fStatus = document.getElementById('statusFilter').value;
  const mode = (document.querySelector('input[name="mode"]:checked')?.value) || 'OR';
  const now = new Date();

  return list.filter(d => {
    if (d.deleted) return false; // 軟刪除直接不顯示
    if (kw && !matchRow(kw, d, mode)) return false;
    if (fMarket && d.market !== fMarket) return false;
    if (fStatus && d.status !== fStatus) return false;
    if (fTime) {
      const days = parseInt(fTime, 10);
      const created = d.createdAt?.toDate?.();
      if (!created) return false;
      const diffDays = (now - created) / 86400000;
      if (diffDays > days) return false;
    }
    return true;
  });
}

function sortList(list) {
  const sf = sortField; const dir = sortDirection === 'asc' ? 1 : -1;
  return list.slice().sort((a,b) => {
    if (sf === 'createdAt') {
      const da = a.createdAt?.toDate?.() || new Date(0);
      const db = b.createdAt?.toDate?.() || new Date(0);
      return (da - db) * dir;
    }
    const va = (a[sf] ?? '').toString();
    const vb = (b[sf] ?? '').toString();
    return va.localeCompare(vb, 'zh-Hant') * dir;
  });
}

function renderPagination(total) {
  const p = document.getElementById('pagination');
  p.innerHTML = '';
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > pages) currentPage = pages;

  const mk = (label, page, disabled = false, active = false) => {
    const b = document.createElement('button');
    b.textContent = label; b.className = 'page-btn' + (active ? ' active' : '');
    b.disabled = disabled;
    b.addEventListener('click', () => { currentPage = page; renderTable(); });
    return b;
  };
  p.appendChild(mk('«', 1, currentPage === 1));
  p.appendChild(mk('‹', Math.max(1, currentPage - 1), currentPage === 1));
  const win = 5;
  let s = Math.max(1, currentPage - Math.floor(win/2));
  let e = Math.min(pages, s + win - 1);
  s = Math.max(1, e - win + 1);
  for (let i=s;i<=e;i++) p.appendChild(mk(String(i), i, false, i===currentPage));
  p.appendChild(mk('›', Math.min(pages, currentPage + 1), currentPage === pages));
  p.appendChild(mk('»', pages, currentPage === pages));
}

function renderTable() {
  const tbody = document.getElementById('list');
  tbody.innerHTML = '';

  let filtered = applyFilters(allData);
  filtered = sortList(filtered);

  const total = filtered.length;
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = filtered.slice(start, end);

  document.getElementById('resultInfo').textContent =
    `共 ${total} 筆，顯示第 ${start+1}-${Math.min(end,total)} 筆`;

  for (const d of pageRows) {
    const tr = document.createElement('tr');
    if (d.important) tr.classList.add('important');
    tr.innerHTML = `
      <td>${(function(){const ymd=fmtDate(d.createdAt); return ymd+` <button class="pen-btn ${d.important?'active':''}" data-id="${d.id}" title="標記重要">🖊️</button>`;})() }</td>
      <td>${d.product||''}</td>
      <td>${d.market||''}</td>
      <td>${d.account||''}</td>
      <td><input class="note-input" data-id="${d.id}" value="${(d.note||'').replace(/"/g,'&quot;')}"></td>
      <td>${d.createdBy||''}</td>
      <td>
        <select class="status-select" data-id="${d.id}"><option value="未完成" ${d.status==='未完成'?'selected':''}>未完成</option><option value="已完成" ${d.status==='已完成'?'selected':''}>已完成</option><option value="刪除">刪除</option></select>
      </td>
      <td style="text-align:center">
        <input type="checkbox" class="important-check" data-id="${d.id}" ${d.important?'checked':''}>
      </td>
      <td style="text-align:center">
        <button class="delete-btn" data-id="${d.id}">🗑 刪除</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // 即時儲存（debounce）
  document.querySelectorAll('.note-input').forEach(el => {
    const handler = debounce(async e => {
      await updateDoc(doc(db, 'arrival', el.dataset.id), { note: e.target.value });
    });
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  document.querySelectorAll('.status-select').forEach(el=>{
  el.addEventListener('change', async ()=>{
    const id = el.dataset.id; const val = el.value;
    if(val === '刪除'){
      await updateDoc(doc(db, 'arrival', id), { deleted: true });
      const row = allData.find(x=>x.id===id); if(row) row.deleted = true;
    } else {
      await updateDoc(doc(db, 'arrival', id), { status: val });
      const row = allData.find(x=>x.id===id); if(row) row.status = val;
    }
    renderTable();
  });
});

  document.querySelectorAll('.important-check').forEach(el => {
    el.addEventListener('change', async () => {
      await updateDoc(doc(db, 'arrival', el.dataset.id), { important: el.checked });
      renderTable();
    });
  });

  // 刪除（軟刪除）
  document.querySelectorAll('.delete-btn').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.id;
      if (!confirm('確定要刪除這筆嗎？（可於後台把 deleted 改回 false 復原）')) return;
      await updateDoc(doc(db, 'arrival', id), { deleted: true });
      const row = allData.find(x => x.id === id);
      if (row) row.deleted = true;
      renderTable();
    });
  });

    // 重要（🖊️）即時切換
  document.querySelectorAll('.pen-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.dataset.id; const row = allData.find(x=>x.id===id);
      const newVal = !row?.important; await updateDoc(doc(db, 'arrival', id), { important: newVal });
      if(row) row.important = newVal; renderTable();
    });
  });

  renderPagination(total);
}

// ====== 欄位拖曳（記憶寬度） ======
function initResizableHeaders() {
  const ths = Array.from(document.querySelectorAll('thead th.resizable'));
  const colgroup = document.getElementById('colgroup');
  const cols = Array.from(colgroup.querySelectorAll('col'));

  // 載入記憶寬度
  try {
    const saved = JSON.parse(localStorage.getItem('arrival_colwidths') || '[]');
    saved.forEach((w, i) => { if (cols[i] && w) cols[i].style.width = w; });
  } catch {}

  // 為每個 th 加 resizer
  ths.forEach((th, i) => {
    const handle = document.createElement('span');
    handle.className = 'col-resizer';
    th.appendChild(handle);

    let startX = 0;
    let startW = 0;

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const newW = Math.max(60, startW + dx);
      cols[i].style.width = newW + 'px';
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // 存寬度
      const widths = cols.map(c => c.style.width || '');
      localStorage.setItem('arrival_colwidths', JSON.stringify(widths));
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = parseInt(cols[i].style.width || th.getBoundingClientRect().width, 10);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

// ====== 綁定 ======
function bindSortHeaders() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', (e) => {
      if (e.target.classList.contains('col-resizer')) return;
      const f = th.dataset.sort;
      if (sortField === f) { sortDirection = (sortDirection === 'asc' ? 'desc' : 'asc'); }
      else { sortField = f; sortDirection = 'asc'; }
      document.querySelectorAll('th[data-sort]').forEach(x => x.classList.remove('sort-asc','sort-desc'));
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      renderTable();
    });
  });
}

function bindSearchBar() {
  document.getElementById('btnSearch').addEventListener('click', () => {
    currentPage = 1; renderTable();
  });
  document.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener('change', () => { currentPage = 1; renderTable(); });
  });
}

// iframe 友善
window.onload = () => {
  // 自動搜尋監聽
  const auto = debounce(()=>{ currentPage=1; renderTable(); }, 500);
  ["searchKeyword","searchMarket","timeFilter","statusFilter"].forEach(id=>{
    const el = document.getElementById(id); if(!el) return; el.addEventListener("input", auto); el.addEventListener("change", auto);
  });
document.getElementById('btnAdd').addEventListener('click', addItem);
  bindSearchBar();
  bindSortHeaders();
  initResizableHeaders();
  loadData();
};
