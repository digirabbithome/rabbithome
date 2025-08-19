console.log('arrival.js v7 with extended alias mapping loaded');
// Build v3 2025-08-18T17:48:19.770516Z
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

/// ====== 智慧搜尋工具 ======
function baseNormalize(str = "") {
  return String(str)
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // 去重音
    .replace(/\s+/g, " ")
    .trim();
}

/// ====== 型號別名標準化（GRIII↔GR3、A7RIV↔A7R4、A7III↔A73、MarkII/MII/MKII/M2、RX100VII/M7/MkVII/MKVII 等） ======
const aliasMap = [
  // GR 系列
  { regex: /\bgr\s*iii\b/g,         norm: "gr3" },

  // Sony A7 系列
  { regex: /\ba7\s*r\s*iv\b/g,      norm: "a7r4" },
  { regex: /\ba7\s*r4\b/g,          norm: "a7r4" },
  { regex: /\ba7\s*iii\b/g,         norm: "a73" },
  { regex: /(mark|mk)\s*[-\s]*ii/gi,  norm: "m2" },
  { regex: /(mark|mk)\s*[-\s]*2/gi,   norm: "m2" },
  { regex: /mkii/gi,                  norm: "m2" },
  { regex: /mii/gi,                   norm: "m2" },
  { regex: /m2/gi,                    norm: "m2" },
  { regex: /\ba73\b/g,              norm: "a73" },


  // RX100 VII 全系列 → rx100m7
  { regex: /\brx100\s*mk\s*vii\b/g,         norm: "rx100m7" },
  { regex: /\brx100\s*mk\s*7\b/g,           norm: "rx100m7" },
  { regex: /\brx100\s*m7\b/g,               norm: "rx100m7" }, // RX100 M7
  { regex: /\brx100m7\b/g,                  norm: "rx100m7" }, // RX100M7
  { regex: /\brx100vii\b/g,                 norm: "rx100m7" }, // RX100VII（無空格）

function normalizeAlias(str = "") {
  // 先做 baseNormalize（全形→半形、小寫、去重音、壓空白）
  let s = baseNormalize(str);

  // 羅馬數字 → 阿拉伯數字（先長再短，避免重疊）
  s = s.replace(/\bviii\b/g,"8")
       .replace(/\bvii\b/g,"7")
       .replace(/\bvi\b/g,"6")
       .replace(/\bv\b/g,"5")
       .replace(/\biv\b/g,"4")
       .replace(/\biii\b/g,"3")
       .replace(/\bii\b/g,"2");

  // 套用特定型號別名映射
  for (const rule of aliasMap) {
    s = s.replace(rule.regex, rule.norm);
  }
  return s;
}
function compact(str = "") { return normalizeAlias(str).replace(/[^a-z0-9]/g, ""); }
function tokens(str = "") { return normalizeAlias(str).split(/[^a-z0-9]+/).filter(Boolean); }
function matchRow(query, row, tokenMode = 'OR') {
  const qC = compact(query);
  if (!qC) return false;
  if (row._searchCompact.includes(qC)) return true;
  const qT = tokens(query);
  const bag = row._tokensSet;
  const hit = (tok) => {
    if (bag.has(tok)) return true;
    for (const w of bag) if (w.includes(tok)) return true;
    return false;
  };
  return tokenMode === 'AND' ? qT.every(hit) : qT.some(hit);
}

/// ====== 小工具 ======
function debounce(fn, wait = 500) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function fmtDate(ts) {
  const d = ts?.toDate?.() || null;
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}


/// ====== 新增／載入 ======
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
    obj.deleted = !!obj.deleted;
    const blob = [obj.product, obj.market, obj.account, obj.note].join(' || ');
    obj._searchCompact = compact(blob);
    obj._tokens = tokens(blob);
    obj._tokensSet = new Set(obj._tokens);
    return obj;
  });
  renderTable();
}

/// ====== 篩選／排序／分頁 ======
function applyFilters(list) {
  const kw = document.getElementById('searchKeyword').value.trim();
  const fMarket = document.getElementById('searchMarket').value;
  const fTime = document.getElementById('timeFilter').value;
  const fStatus = document.getElementById('statusFilter').value;
  const mode = (document.querySelector('input[name="mode"]:checked')?.value) || 'OR';
  const now = new Date();

  return list.filter(d => {
    if (d.deleted) return false;
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
      <td>
        ${fmtDate(d.createdAt)}
        <button class="pen-btn ${d.important ? 'active' : ''}" data-id="${d.id}" title="標記重要">🖊️</button>
      </td>
      <td class="product">${d.product||''}</td>
      <td>${d.market||''}</td>
      <td>${d.account||''}</td>
      <td><input class="note-input" data-id="${d.id}" value="${(d.note||'').replace(/"/g,'&quot;')}"></td>
      <td>${d.createdBy||''}</td>
      <td>
        <select class="status-select" data-id="${d.id}">
          <option value="未完成" ${d.status==='未完成'?'selected':''}>未完成</option>
          <option value="已完成" ${d.status==='已完成'?'selected':''}>已完成</option>
          <option value="刪除">刪除</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // 備註即時儲存（debounce）
  document.querySelectorAll('.note-input').forEach(el => {
    const handler = debounce(async e => {
      await updateDoc(doc(db, 'arrival', el.dataset.id), { note: e.target.value });
    });
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  // 狀態切換（含刪除）
  document.querySelectorAll('.status-select').forEach(el => {
    el.addEventListener('change', async () => {
      const id = el.dataset.id;
      const val = el.value;
      if (val === '刪除') {
        await updateDoc(doc(db, 'arrival', id), { deleted: true });
        const row = allData.find(x => x.id === id);
        if (row) row.deleted = true;
      } else {
        await updateDoc(doc(db, 'arrival', id), { status: val });
        const row = allData.find(x => x.id === id);
        if (row) row.status = val;
      }
      renderTable();
    });
  });

  // 重要（🖊️）即時切換
  document.querySelectorAll('.pen-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const row = allData.find(x => x.id === id);
      const newVal = !row?.important;
      await updateDoc(doc(db, 'arrival', id), { important: newVal });
      if (row) row.important = newVal;
      renderTable();
    });
  });

  renderPagination(total);
}

/// ====== 欄位拖曳（記憶寬度） ======
function initResizableHeaders() {
  const ths = Array.from(document.querySelectorAll('thead th.resizable'));
  const colgroup = document.getElementById('colgroup');
  const cols = Array.from(colgroup.querySelectorAll('col'));

  try {
    const saved = JSON.parse(localStorage.getItem('arrival_colwidths') || '[]');
    saved.forEach((w, i) => { if (cols[i] && w) cols[i].style.width = w; });
  } catch {}

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

/// ====== 綁定 ======
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
  const auto = debounce(() => { currentPage = 1; renderTable(); }, 500);
  ['searchKeyword','searchMarket','timeFilter','statusFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', auto);
    el.addEventListener('change', auto);
  });
  document.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener('change', auto);
  });
}

// iframe 友善
window.onload = () => {
  const addBtn = document.getElementById('btnAdd');
  if (addBtn) addBtn.addEventListener('click', addItem);
  bindSearchBar();
  bindSortHeaders();
  initResizableHeaders();
  loadData();
};
